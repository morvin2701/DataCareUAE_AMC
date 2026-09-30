<#
  DcAMC - deploy the BACKEND (API). The screens are deployed by Vercel from git; nothing else goes on this server.
  Copy the DcAMC-Backend-Deploy folder to C:\ and run:
    cd C:\DcAMC-Backend-Deploy
    powershell -ExecutionPolicy Bypass -File .\deploy-backend.ps1
  Stops the API, replaces C:\DcAMC\app\backend (keeps .env and node_modules), copies database\ and VERSION, installs
  packages, starts the API and checks /api/health. A fresh server gets its database on the first start; later scripts
  are applied from Settings -> Field update. Asks for administrator by itself when needed.
#>
param([string]$Root = 'C:\DcAMC')
$ErrorActionPreference = 'Stop'
function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Native($exe, [string[]]$argv) { $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; $out = & $exe @argv 2>&1; $ErrorActionPreference = $old; return $out }
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Say 'Needs administrator - opening an administrator window...' Yellow; Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""; exit }
$src = $PSScriptRoot; $ver = if (Test-Path "$src\VERSION") { (Get-Content "$src\VERSION" -Raw).Trim() } else { '?' }
Say "DcAMC backend deploy - version $ver" Cyan
if (-not (Test-Path "$src\backend\package.json")) { Say "backend\package.json is missing in $src - copy the whole DcAMC-Backend-Deploy folder." Red; exit 1 }
$nssm = "$Root\tools\nssm.exe"; if (-not (Test-Path $nssm)) { Say "$nssm not found - run setup-server.cmd first." Red; exit 1 }
$app = "$Root\app\backend"; $envFile = Join-Path $app '.env'
Say '[1/5] Stopping the API...'; Native $nssm @('stop', 'DcAmcApi') | Out-Null
Say '[2/5] Copying the new code...'
if (-not (Test-Path $app)) { New-Item -ItemType Directory -Path $app | Out-Null }
Get-ChildItem $app -Force | Where-Object { $_.Name -ne '.env' -and $_.Name -ne 'node_modules' } | Remove-Item -Recurse -Force
Get-ChildItem "$src\backend" -Force | Where-Object { $_.Name -notlike '.env*' -and $_.Name -ne 'node_modules' } | Copy-Item -Destination $app -Recurse -Force
if (Test-Path "$src\database") { $db = "$Root\app\database"; if (Test-Path $db) { Remove-Item $db -Recurse -Force }; Copy-Item "$src\database" $db -Recurse -Force }
if (Test-Path "$src\VERSION") { Copy-Item "$src\VERSION" "$app\VERSION" -Force }
if (-not (Test-Path $envFile) -and (Test-Path "$envFile.txt")) { Rename-Item "$envFile.txt" '.env'; Say '  renamed .env.txt to .env' Yellow }
if (-not (Test-Path $envFile)) { Copy-Item "$src\env.production.example" "$envFile.example" -Force; Say "No $envFile - create it from env.production.example (copied next to it), then run this script again." Red; exit 1 }
Say '[3/5] Installing packages (npm ci)...'
Push-Location $app; Native 'npm.cmd' @('ci', '--omit=dev', '--no-audit', '--no-fund') | Select-Object -Last 2 | ForEach-Object { Say "  $_" }; $npmExit = $LASTEXITCODE; Pop-Location
if ($npmExit -ne 0) { Say 'npm ci failed - see the lines above. The API is stopped.' Red; exit 1 }
Say '[4/5] Starting the API...'; Native $nssm @('start', 'DcAmcApi') | Out-Null
Say '[5/5] Checking /api/health...'; $ok = $false
for ($i = 0; $i -lt 15 -and -not $ok; $i++) { Start-Sleep -Seconds 2; try { $h = Invoke-RestMethod 'http://127.0.0.1:4100/api/health' -TimeoutSec 5; $ok = [bool]$h.success } catch { } }
if ($ok) { Say ("  API OK - database " + $h.db.db + ($(if ($h.db.ok) { ' connected' } else { ' NOT connected' }))) Green; Say "Backend $ver is live." Green }
else { Say 'The API did not answer. Last lines of the log:' Red; Get-Content "$Root\logs\DcAmcApi.log" -Tail 25 -ErrorAction SilentlyContinue | ForEach-Object { Say "  $_" DarkGray }; exit 1 }
