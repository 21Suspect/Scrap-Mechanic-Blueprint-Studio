param([string]$Compiler, [string]$Version = '0.2.0')
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
if (-not $Compiler) { $Compiler = Join-Path $project 'dist/tools/InnoSetup/ISCC.exe' }
if (-not (Test-Path -LiteralPath $Compiler)) { throw 'Install Inno Setup 6 and supply -Compiler path/to/ISCC.exe.' }
$dist = Join-Path $project 'dist'
$cache = Join-Path $dist 'tools'
$null = New-Item -ItemType Directory -Force -Path $cache
# A new staging directory avoids destructive cleanup of any existing files.
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('bs-' + [guid]::NewGuid().ToString('N').Substring(0,8))
$payload = Join-Path $stage 'payload'
$null = New-Item -ItemType Directory -Force -Path $payload
foreach ($dir in @('lib','public','docs','examples','tests','scripts','installer')) {
 Copy-Item -LiteralPath (Join-Path $project $dir) -Destination $payload -Recurse
}
foreach ($file in @('server.mjs','mcp.mjs','capture.mjs','import-model.mjs','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','README.md','AGENTS.md','CONTRIBUTING.md','Start-Blueprint-Studio.cmd','Start-Blueprint-Studio.ps1')) {
 Copy-Item -LiteralPath (Join-Path $project $file) -Destination $payload
}
$nodeVersion = '22.23.3'
$nodeName = "node-v$nodeVersion-win-x64"
$archive = Join-Path $cache "$nodeName.zip"
$expected = '2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71'
if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest "https://nodejs.org/dist/v$nodeVersion/$nodeName.zip" -OutFile $archive }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Node archive SHA-256 verification failed.' }
Expand-Archive -LiteralPath $archive -DestinationPath $stage
Move-Item -LiteralPath (Join-Path $stage $nodeName) -Destination (Join-Path $payload 'runtime')
$node = Join-Path $payload 'runtime/node.exe'
$npm = Join-Path $payload 'runtime/node_modules/npm/bin/npm-cli.js'
Push-Location $payload
try {
 & $node $npm ci --ignore-scripts
 if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
 $oldBrowserPath=$env:PLAYWRIGHT_BROWSERS_PATH
 try {
  $env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $payload 'browsers'
  & $node 'node_modules/playwright/cli.js' install chromium --only-shell
  if ($LASTEXITCODE -ne 0) { throw 'Bundled capture browser installation failed.' }
 } finally { $env:PLAYWRIGHT_BROWSERS_PATH=$oldBrowserPath }
 & $node --test tests/paths.test.mjs tests/sensors.test.mjs tests/signal-clock.test.mjs
 if ($LASTEXITCODE -ne 0) { throw 'Packaged-runtime tests failed.' }
} finally { Pop-Location }
$csc=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $csc /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll "/out:$payload/BlueprintStudio.exe" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
& $Compiler /Q "/DPayload=$payload" "/DReleaseVersion=$Version" (Join-Path $PSScriptRoot 'BlueprintStudio.iss')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
$setup=Join-Path $dist "BlueprintStudio-Setup-$Version.exe"
$hash=(Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $(Split-Path $setup -Leaf)" | Set-Content -Encoding ascii (Join-Path $dist "BlueprintStudio-Setup-$Version.sha256")
@{version=$Version;node=$nodeVersion;nodeSha256=$expected;payload=$payload;setup=$setup;sha256=$hash} | ConvertTo-Json | Set-Content (Join-Path $dist 'installer-build.json')
Write-Output "Built $setup"
