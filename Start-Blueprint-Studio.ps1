$ErrorActionPreference = 'Stop'
try {
    $studioDirectory = $PSScriptRoot
    $studioPort = if ($env:PORT) { [int]$env:PORT } else { 38799 }
    if ($studioPort -lt 1 -or $studioPort -gt 65535) { throw 'PORT must be between 1 and 65535.' }
    $studioUrl = "http://127.0.0.1:$studioPort"
    $studioReady = $false
    try { $null = Invoke-RestMethod "$studioUrl/api/drafts" -TimeoutSec 2; $studioReady = $true } catch {}
    if (-not $studioReady) {
        $studioNode = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $studioNode) { throw 'Install Node.js 22 or newer, then reopen this launcher.' }
        Push-Location $studioDirectory
        try {
            if (-not (Test-Path 'node_modules/playwright/package.json')) {
                & npm.cmd ci
                if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Run npm ci in the Studio folder.' }
            }
        } finally { Pop-Location }
        $studioLogs = Join-Path $env:LOCALAPPDATA 'BlueprintStudio/logs'
        $null = New-Item -ItemType Directory -Path $studioLogs -Force
        $studioProcess = Start-Process -FilePath $studioNode.Source -ArgumentList 'server.mjs' -WorkingDirectory $studioDirectory -WindowStyle Hidden -RedirectStandardOutput "$studioLogs/server.log" -RedirectStandardError "$studioLogs/server-error.log" -PassThru
        for ($studioAttempt = 0; $studioAttempt -lt 60; $studioAttempt++) {
            Start-Sleep -Milliseconds 500
            try { $null = Invoke-RestMethod "$studioUrl/api/drafts" -TimeoutSec 1; $studioReady = $true; break } catch {}
            if ($studioProcess.HasExited) { break }
        }
        if (-not $studioReady) { throw ("Studio could not start. " + (Get-Content "$studioLogs/server-error.log" -Raw)) }
    }
    Start-Process $studioUrl
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
