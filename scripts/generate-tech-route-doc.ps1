$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DocsDir = Join-Path $ProjectRoot "docs"
$SourceFile = Get-ChildItem -LiteralPath $DocsDir -Filter "*.md" | Select-Object -First 1

if (-not $SourceFile) {
  throw "No markdown source file found in docs directory."
}

$SourcePath = $SourceFile.FullName
$OutputPath = [System.IO.Path]::ChangeExtension($SourcePath, ".docx")

function Escape-XmlText {
  param([string]$Text)

  if ([string]::IsNullOrEmpty($Text)) {
    return ""
  }

  return [System.Security.SecurityElement]::Escape($Text)
}

function New-Block {
  param(
    [string]$Style,
    [string]$Text,
    [int]$Indent = 0
  )

  return [PSCustomObject]@{
    Style  = $Style
    Text   = $Text
    Indent = $Indent
  }
}

function Convert-MarkdownToBlocks {
  param([string[]]$Lines)

  $blocks = New-Object System.Collections.Generic.List[object]
  $buffer = New-Object System.Collections.Generic.List[string]

  function Flush-Paragraph {
    if ($buffer.Count -eq 0) {
      return
    }

    $text = (($buffer | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join " ").Trim()
    if ($text) {
      $blocks.Add((New-Block -Style "Normal" -Text $text))
    }

    $buffer.Clear()
  }

  foreach ($line in $Lines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      Flush-Paragraph
      continue
    }

    if ($line -match '^# (.+)$') {
      Flush-Paragraph
      $blocks.Add((New-Block -Style "Title" -Text $Matches[1].Trim()))
      continue
    }

    if ($line -match '^## (.+)$') {
      Flush-Paragraph
      $blocks.Add((New-Block -Style "Heading1" -Text $Matches[1].Trim()))
      continue
    }

    if ($line -match '^### (.+)$') {
      Flush-Paragraph
      $blocks.Add((New-Block -Style "Heading2" -Text $Matches[1].Trim()))
      continue
    }

    if ($line -match '^#### (.+)$') {
      Flush-Paragraph
      $blocks.Add((New-Block -Style "Heading3" -Text $Matches[1].Trim()))
      continue
    }

    if ($line -match '^- (.+)$') {
      Flush-Paragraph
      $blocks.Add((New-Block -Style "ListParagraph" -Text "• $($Matches[1].Trim())" -Indent 420))
      continue
    }

    if ($line -match '^\d+\.\s+.+$') {
      Flush-Paragraph
      $blocks.Add((New-Block -Style "ListParagraph" -Text $line.Trim() -Indent 420))
      continue
    }

    $buffer.Add($line.Trim())
  }

  Flush-Paragraph
  return $blocks
}

function Build-DocumentXml {
  param([System.Collections.Generic.List[object]]$Blocks)

  $paragraphs = foreach ($block in $Blocks) {
    $style = Escape-XmlText $block.Style
    $text = Escape-XmlText $block.Text
    $indentXml = if ($block.Indent -gt 0) { "<w:ind w:left=""$($block.Indent)""/>" } else { "" }
@"
<w:p>
  <w:pPr>
    <w:pStyle w:val="$style"/>
    $indentXml
  </w:pPr>
  <w:r>
    <w:t xml:space="preserve">$text</w:t>
  </w:r>
</w:p>
"@
  }

@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($paragraphs -join "`n")
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"@
}

function Build-StylesXml {
@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/>
        <w:lang w:val="zh-CN" w:eastAsia="zh-CN"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="320" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="120" w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="240" w:after="160"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/>
      <w:sz w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="200" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
  </w:style>
</w:styles>
"@
}

function Build-ContentTypesXml {
@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"@
}

function Build-RootRelsXml {
@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@
}

function Build-DocumentRelsXml {
@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"@
}

function Build-AppXml {
@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Title</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>Document</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company></Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>
"@
}

function Build-CoreXml {
  $created = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
@"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>零售业AI审计系统完整技术路线（客户版）</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$created</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$created</dcterms:modified>
</cp:coreProperties>
"@
}

New-Item -ItemType Directory -Force -Path $DocsDir | Out-Null

$lines = Get-Content -LiteralPath $SourcePath -Encoding UTF8
$blocks = Convert-MarkdownToBlocks -Lines $lines

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("retail-tech-route-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tempRoot "_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tempRoot "docProps") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tempRoot "word") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tempRoot "word\_rels") | Out-Null

try {
  Set-Content -LiteralPath (Join-Path $tempRoot "[Content_Types].xml") -Value (Build-ContentTypesXml) -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $tempRoot "_rels\.rels") -Value (Build-RootRelsXml) -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $tempRoot "docProps\app.xml") -Value (Build-AppXml) -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $tempRoot "docProps\core.xml") -Value (Build-CoreXml) -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $tempRoot "word\document.xml") -Value (Build-DocumentXml -Blocks $blocks) -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $tempRoot "word\styles.xml") -Value (Build-StylesXml) -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $tempRoot "word\_rels\document.xml.rels") -Value (Build-DocumentRelsXml) -Encoding UTF8

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  $tempZipPath = [System.IO.Path]::ChangeExtension($OutputPath, ".zip")
  if (Test-Path -LiteralPath $tempZipPath) {
    Remove-Item -LiteralPath $tempZipPath -Force
  }

  Compress-Archive -Path (Join-Path $tempRoot "*") -DestinationPath $tempZipPath -Force
  Move-Item -LiteralPath $tempZipPath -Destination $OutputPath -Force
  Write-Output "Created: $OutputPath"
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
