$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$LocalTargetPath = Join-Path $ProjectRoot "launch-retail-audit-system.vbs"
$PublicTargetPath = Join-Path $ProjectRoot "launch-retail-audit-system-cloudflared.vbs"
$IconPath = Join-Path $ProjectRoot "assets\launcher\retail-audit-launcher.ico"

function Convert-CodePointsToString {
  param([int[]]$CodePoints)
  return (-join ($CodePoints | ForEach-Object { [char]$_ }))
}

$LocalShortcutName =
  (Convert-CodePointsToString @(38646, 21806, 19994)) +
  "AI" +
  (Convert-CodePointsToString @(23457, 35745, 31995, 32479)) +
  ".lnk"
$LocalShortcutPath = Join-Path $DesktopPath $LocalShortcutName
$PublicShortcutName =
  (Convert-CodePointsToString @(38646, 21806, 19994)) +
  "AI" +
  (Convert-CodePointsToString @(23457, 35745, 31995, 32479)) +
  "-Cloudflared.lnk"
$PublicShortcutPath = Join-Path $DesktopPath $PublicShortcutName
$LocalShortcutDescription =
  (Convert-CodePointsToString @(19968, 38190, 21551, 21160, 38646, 21806, 19994)) +
  " AI " +
  (Convert-CodePointsToString @(23457, 35745, 31995, 32479))
$PublicShortcutDescription =
  $LocalShortcutDescription +
  " (Cloudflared)"

if (-not (Test-Path $LocalTargetPath)) {
  throw "Missing launcher entry: launch-retail-audit-system.vbs"
}

if (-not (Test-Path $PublicTargetPath)) {
  throw "Missing launcher entry: launch-retail-audit-system-cloudflared.vbs"
}

if (-not (Test-Path $IconPath)) {
  & (Join-Path $ProjectRoot "scripts\create-shortcut-icon.ps1")
}

$shell = New-Object -ComObject WScript.Shell
$desktopShortcuts = Get-ChildItem -Path $DesktopPath -Filter *.lnk -ErrorAction SilentlyContinue
foreach ($item in $desktopShortcuts) {
  try {
    $existingShortcut = $shell.CreateShortcut($item.FullName)
    if (
      $item.FullName -notin @($LocalShortcutPath, $PublicShortcutPath) -and
      $existingShortcut.TargetPath -in @($LocalTargetPath, $PublicTargetPath)
    ) {
      Remove-Item -LiteralPath $item.FullName -Force
    }
  } catch {
    continue
  }
}

foreach ($shortcutConfig in @(
    @{
      ShortcutPath = $LocalShortcutPath
      TargetPath = $LocalTargetPath
      Description = $LocalShortcutDescription
    },
    @{
      ShortcutPath = $PublicShortcutPath
      TargetPath = $PublicTargetPath
      Description = $PublicShortcutDescription
    }
  )) {
  $shortcut = $shell.CreateShortcut($shortcutConfig.ShortcutPath)
  $shortcut.TargetPath = $shortcutConfig.TargetPath
  $shortcut.WorkingDirectory = $ProjectRoot
  $shortcut.WindowStyle = 1
  $shortcut.Description = $shortcutConfig.Description
  $shortcut.IconLocation = $IconPath
  $shortcut.Save()
}

Write-Output "Shortcuts created: $LocalShortcutPath ; $PublicShortcutPath"
