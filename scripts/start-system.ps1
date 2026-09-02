param(
  [switch]$SkipOpenBrowser,
  [switch]$ForceSeed,
  [switch]$PublicAccess,
  [switch]$Production,
  [switch]$Cloudflared,
  [ValidateRange(1, 65535)]
  [int]$Port = 3000,
  [string]$AppUrl,
  [ValidateRange(10, 180)]
  [int]$CloudflaredTimeoutSec = 45
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "logs"
$StdOutLog = Join-Path $LogDir "system.stdout.log"
$StdErrLog = Join-Path $LogDir "system.stderr.log"
$CloudflaredStdOutLog = Join-Path $LogDir "cloudflared.stdout.log"
$CloudflaredStdErrLog = Join-Path $LogDir "cloudflared.stderr.log"
$HealthCheckUrl = "http://127.0.0.1:$Port"
$DefaultLocalUrl = "http://localhost:$Port"
$DemoProjectFile = Join-Path $ProjectRoot "data\projects\project_demo_retail_2025.json"
$ShouldUsePublicBinding = $PublicAccess -or $Production -or $Cloudflared -or -not [string]::IsNullOrWhiteSpace($AppUrl)
$RunScriptName = if ($Production) { "start:public" } elseif ($ShouldUsePublicBinding) { "dev:public" } else { "dev" }
$RequestedAppUrl = if ([string]::IsNullOrWhiteSpace($AppUrl)) { $null } else { $AppUrl.TrimEnd("/") }

function Show-LauncherPopup {
  param(
    [string]$Title,
    [string]$Message,
    [int]$Icon = 64
  )

  try {
    (New-Object -ComObject WScript.Shell).Popup($Message, 0, $Title, $Icon) | Out-Null
  } catch {
    Write-Host $Message
  }
}

function Test-AppReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $HealthCheckUrl -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Assert-CommandAvailable {
  param(
    [string]$Name,
    [string]$FriendlyName
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$FriendlyName is not available in PATH. Please install it before launching the system."
  }
}

function Resolve-CloudflaredExecutable {
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
      return $candidate
    }
  }

  throw "cloudflared is not available. Put cloudflared.exe on your Desktop, place it in the project root, or add it to PATH."
}

function Get-CurrentAppProcesses {
  $patterns = @(
    "*npm.cmd run dev*",
    "*npm.cmd run dev:public*",
    "*npm.cmd run start*",
    "*npm.cmd run start:public*",
    "*next dev*",
    "*next start*"
  )

  try {
    @(Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $commandLine = $_.CommandLine
        if (-not $commandLine) {
          return $false
        }

        if ($commandLine -notlike "*$ProjectRoot*") {
          return $false
        }

        foreach ($pattern in $patterns) {
          if ($commandLine -like $pattern) {
            return $true
          }
        }

        return $false
      })
  } catch {
    Write-Warning "Unable to inspect existing application processes: $($_.Exception.Message)"
    @()
  }
}

function Get-CurrentCloudflaredProcesses {
  $targetPattern = "*cloudflared*tunnel*--url*$HealthCheckUrl*"

  try {
    @(Get-CimInstance Win32_Process -ErrorAction Stop |
      Where-Object {
        $commandLine = $_.CommandLine
        if (-not $commandLine) {
          return $false
        }

        return $commandLine -like $targetPattern
      })
  } catch {
    Write-Warning "Unable to inspect existing cloudflared processes: $($_.Exception.Message)"
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

function Invoke-NpmScript {
  param(
    [string]$ScriptName,
    [string]$Description
  )

  $safeScriptName = ($ScriptName -replace '[^A-Za-z0-9._-]', '-')
  $scriptStdOut = Join-Path $LogDir "$safeScriptName.stdout.log"
  $scriptStdErr = Join-Path $LogDir "$safeScriptName.stderr.log"

  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run", $ScriptName `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $scriptStdOut `
    -RedirectStandardError $scriptStdErr `
    -WindowStyle Hidden `
    -Wait `
    -PassThru

  if ($process.ExitCode -ne 0) {
    throw "$Description failed. See logs\$safeScriptName.stderr.log for details."
  }
}

function Read-TunnelUrlFromLogs {
  $patterns = @($CloudflaredStdOutLog, $CloudflaredStdErrLog)

  foreach ($path in $patterns) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }

    $match = Select-String -LiteralPath $path -Pattern 'https://[-a-z0-9]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue |
      Select-Object -Last 1

    if ($match) {
      return $match.Matches[-1].Value.TrimEnd("/")
    }
  }

  return $null
}

function Start-CloudflaredTunnel {
  $cloudflaredExecutable = Resolve-CloudflaredExecutable

  Stop-ManagedProcesses -Processes (Get-CurrentCloudflaredProcesses) -Description "cloudflared"

  foreach ($path in @($CloudflaredStdOutLog, $CloudflaredStdErrLog)) {
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Force
    }
  }

  Start-Process `
    -FilePath $cloudflaredExecutable `
    -ArgumentList "tunnel", "--url", $HealthCheckUrl, "--no-autoupdate" `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $CloudflaredStdOutLog `
    -RedirectStandardError $CloudflaredStdErrLog `
    -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds($CloudflaredTimeoutSec)
  do {
    $tunnelUrl = Read-TunnelUrlFromLogs
    if ($tunnelUrl) {
      return $tunnelUrl
    }

    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  throw "Cloudflared tunnel startup timed out. Check logs\cloudflared.stderr.log."
}

try {
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

  Assert-CommandAvailable -Name "node" -FriendlyName "Node.js"
  Assert-CommandAvailable -Name "npm.cmd" -FriendlyName "npm"

  if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    throw "Project dependencies are missing. Please run npm install in the project directory first."
  }

  if ($Cloudflared) {
    $RequestedAppUrl = Start-CloudflaredTunnel
  }

  $DisplayUrl = if ($RequestedAppUrl) { $RequestedAppUrl } else { $DefaultLocalUrl }
  $existingAppProcesses = @(Get-CurrentAppProcesses)
  $shouldRestartExistingApp = $existingAppProcesses.Count -gt 0 -and ($Cloudflared -or $Production -or $ShouldUsePublicBinding)

  if ($existingAppProcesses.Count -gt 0 -and (Test-AppReady) -and -not $shouldRestartExistingApp) {
    if (-not $SkipOpenBrowser) {
      Start-Process $DisplayUrl
    }
    exit 0
  }

  if ($shouldRestartExistingApp) {
    Stop-ManagedProcesses -Processes $existingAppProcesses -Description "application"
    Start-Sleep -Seconds 2
  }

  if ($ForceSeed -or -not (Test-Path $DemoProjectFile)) {
    Invoke-NpmScript -ScriptName "seed" -Description "Initialize demo project"
  }

  Invoke-NpmScript -ScriptName "db:init" -Description "Sync database schema and base data"

  if ($Production) {
    Invoke-NpmScript -ScriptName "build" -Description "Build production bundle"
  }

  $commandParts = @(
    "Set-Location -LiteralPath '$ProjectRoot'",
    "`$env:PORT='$Port'"
  )

  if ($RequestedAppUrl) {
    $escapedAppUrl = $RequestedAppUrl.Replace("'", "''")
    $commandParts += "`$env:APP_URL='$escapedAppUrl'"
  }

  $commandParts += "npm.cmd run $RunScriptName"
  $startupCommand = "& { " + ($commandParts -join "; ") + " }"

  Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", $startupCommand `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $StdOutLog `
    -RedirectStandardError $StdErrLog `
    -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    if (Test-AppReady) {
      $ready = $true
      break
    }

    Start-Sleep -Seconds 2
  }

  if (-not $ready) {
    throw "System startup timed out. Check logs\system.stderr.log."
  }

  if ($Cloudflared -and $RequestedAppUrl) {
    $popupMessage = @(
      "Cloudflared public URL is ready:",
      $RequestedAppUrl,
      "",
      "Share this /auth page with other users:",
      "$RequestedAppUrl/auth"
    ) -join [Environment]::NewLine

    Show-LauncherPopup -Title "Retail Audit AI System" -Message $popupMessage -Icon 64
  }

  if (-not $SkipOpenBrowser) {
    Start-Process $DisplayUrl
  }
} catch {
  Show-LauncherPopup -Title "Retail Audit AI System" -Message $_.Exception.Message -Icon 16
  throw
}
