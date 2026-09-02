param(
  [Parameter(Mandatory = $true)]
  [string]$AppUrl,

  [Parameter(Mandatory = $true)]
  [string]$TunnelName,

  [string]$CloudflaredConfig,

  [string]$CloudflaredPath,

  [ValidateRange(1, 65535)]
  [int]$Port = 3000,

  [switch]$SkipOpenBrowser
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "logs"
$TunnelStdOutLog = Join-Path $LogDir "cloudflared.named.stdout.log"
$TunnelStdErrLog = Join-Path $LogDir "cloudflared.named.stderr.log"

function Resolve-CloudflaredExecutable {
  param([string]$PreferredPath)

  if ($PreferredPath) {
    if (-not (Test-Path -LiteralPath $PreferredPath)) {
      throw "cloudflared executable not found at: $PreferredPath"
    }

    return (Resolve-Path -LiteralPath $PreferredPath).Path
  }

  $candidates = @()

  try {
    $command = Get-Command "cloudflared" -ErrorAction Stop
    if ($command.Source) {
      $candidates += $command.Source
    }
  } catch {
  }

  $candidates += @(
    (Join-Path $ProjectRoot "cloudflared.exe"),
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "cloudflared.exe")
  )

  foreach ($candidate in $candidates | Select-Object -Unique) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "cloudflared.exe was not found. Put it in the project root, your Desktop, or pass -CloudflaredPath explicitly."
}

function Get-CurrentNamedTunnelProcesses {
  param([string]$ResolvedCloudflaredPath, [string]$Name)

  try {
    @(Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $commandLine = $_.CommandLine
        if (-not $commandLine) {
          return $false
        }

        $usesCloudflared = $commandLine -like "*$ResolvedCloudflaredPath*" -or $commandLine -like "*cloudflared*"
        $runsTunnel = $commandLine -like "*tunnel*run*"
        $matchesName = $commandLine -like "*$Name*"
        return $usesCloudflared -and $runsTunnel -and $matchesName
      })
  } catch {
    Write-Warning "Unable to inspect existing named tunnel processes: $($_.Exception.Message)"
    @()
  }
}

function Stop-ManagedProcesses {
  param(
    [System.Array]$Processes,
    [string]$Description
  )

  foreach ($process in $Processes) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch {
      Write-Warning "Unable to stop $Description process $($process.ProcessId): $($_.Exception.Message)"
    }
  }
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$resolvedCloudflaredPath = Resolve-CloudflaredExecutable -PreferredPath $CloudflaredPath
$resolvedConfigPath = $null

if ($CloudflaredConfig) {
  if (-not (Test-Path -LiteralPath $CloudflaredConfig)) {
    throw "Cloudflared config file not found: $CloudflaredConfig"
  }

  $resolvedConfigPath = (Resolve-Path -LiteralPath $CloudflaredConfig).Path
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start-system.ps1") `
  -PublicAccess `
  -Production `
  -AppUrl $AppUrl `
  -Port $Port `
  -SkipOpenBrowser:$SkipOpenBrowser

Stop-ManagedProcesses `
  -Processes (Get-CurrentNamedTunnelProcesses -ResolvedCloudflaredPath $resolvedCloudflaredPath -Name $TunnelName) `
  -Description "cloudflared named tunnel"

foreach ($path in @($TunnelStdOutLog, $TunnelStdErrLog)) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

$argumentList = @("tunnel")
if ($resolvedConfigPath) {
  $argumentList += @("--config", $resolvedConfigPath)
}
$argumentList += @("run", $TunnelName)

Start-Process `
  -FilePath $resolvedCloudflaredPath `
  -ArgumentList $argumentList `
  -WorkingDirectory $ProjectRoot `
  -RedirectStandardOutput $TunnelStdOutLog `
  -RedirectStandardError $TunnelStdErrLog `
  -WindowStyle Hidden | Out-Null

if (-not $SkipOpenBrowser) {
  Start-Process $AppUrl
}

Write-Host "Fixed-domain app URL: $AppUrl"
Write-Host "Named tunnel started: $TunnelName"
Write-Host "Cloudflared logs: $TunnelStdOutLog"
