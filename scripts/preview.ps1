#Requires -Version 5.1
<#
.SYNOPSIS
Build and start the local Docker preview from any working directory.
.EXAMPLE
.\scripts\preview.ps1 -OpenBrowser
#>
[CmdletBinding()]
param(
    [ValidateRange(10, 1800)]
    [int]$WaitTimeout = 180,
    [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $repoRoot
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker is not installed or is not on PATH. Install Docker Desktop with Linux containers first.'
    }
    $dockerOS = & docker info --format '{{.OSType}}' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is not ready. Start Docker Desktop and run this script again.'
    }
    if ($dockerOS -ne 'linux') {
        throw 'This preview requires Linux containers. Switch Docker Desktop to Linux containers and try again.'
    }
    & docker compose version
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 or newer is required.' }

    if (-not (Test-Path -LiteralPath '.env')) {
        Copy-Item -LiteralPath '.env.example' -Destination '.env'
        Write-Host 'Created .env from .env.example. Existing settings are never overwritten.'
    }

    # Let Compose resolve .env, shell variables, and compose.override.yaml.
    # Capture configuration without printing potentially private environment values.
    $configJSON = & docker compose config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }
    $config = ($configJSON -join "`n") | ConvertFrom-Json
    $previewURL = [string]$config.services.app.environment.PUBLIC_ORIGIN
    $parsedURL = $null
    if (-not [Uri]::TryCreate($previewURL, [UriKind]::Absolute, [ref]$parsedURL) -or
        $parsedURL.Scheme -notin @('http', 'https') -or $parsedURL.UserInfo) {
        throw 'Set PUBLIC_ORIGIN to a valid HTTP(S) origin without credentials in .env.'
    }

    Write-Host 'Building and starting the reader preview...'
    & docker compose up --build --detach --wait --wait-timeout $WaitTimeout web
    if ($LASTEXITCODE -ne 0) {
        throw 'Preview did not become healthy. Inspect it with: docker compose ps; docker compose logs --tail 80 app web'
    }

    Write-Host ''
    Write-Host "Preview ready: $previewURL"
    Write-Host 'Re-run this script after Go or image changes. Files in web/ update through the development mount.'
    Write-Host 'Status: docker compose ps'
    Write-Host 'Logs:   docker compose logs -f app web'
    Write-Host 'Stop:   docker compose stop app web'
    Write-Host 'NewsBlur connectivity and sign-in are checked when you use the reader.'
    if ($OpenBrowser) { Start-Process -FilePath $previewURL }
}
finally {
    Pop-Location
}
