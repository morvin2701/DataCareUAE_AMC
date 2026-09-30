<#
  DcAMC - one-time set-up of the BACKEND on DataCare's Windows server (the SQL Server machine that already runs IIS and
  the ERP). The screens run on Vercel; only the API lives here. Right-click setup-server.cmd -> Run as administrator.
    Windows service "DcAmcApi"   node src\server.js on 127.0.0.1:4100  (NSSM, starts with Windows, restarts on crash)
    IIS site "DcAmcApi"          passes every request to the service - bound to a host name (-HostName amc-api.datacarewebuae.com,
                                 add an A record first) or, until DNS is ready, to a port (-Port 4190)
  Node, URL Rewrite, ARR and NSSM come from the ERP set-up (C:\DataCare\tools) and are reused.
  Run again with -Certificate -Email you@example.com once DNS points here to get the Let's Encrypt certificate (win-acme).
#>
param([string]$Root = 'C:\DcAMC', [string]$ErpRoot = 'C:\DataCare', [string]$HostName = '', [int]$Port = 4190, [switch]$Certificate, [string]$Email = '')
$ErrorActionPreference = 'Stop'
function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Native($exe, [string[]]$argv) { $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; $out = & $exe @argv 2>&1; $ErrorActionPreference = $old; return $out }
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Say 'Run as administrator.' Red; exit 1 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
foreach ($d in @("$Root", "$Root\app", "$Root\web", "$Root\logs", "$Root\tools", 'C:\AmcBkps')) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null } }
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"; if (-not (Test-Path $appcmd)) { Say 'IIS is not installed - run the ERP set-up (setup-server.ps1 in the ERP release) first.' Red; exit 1 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Node.js is missing - run the ERP set-up first.' Red; exit 1 }
Say ("Node " + (node -v)) Green
if (-not (Test-Path "$env:windir\system32\inetsrv\rewrite.dll") -or -not (Test-Path "$env:ProgramFiles\IIS\Application Request Routing\requestRouter.dll")) { Say 'URL Rewrite / ARR are missing - run the ERP set-up first.' Red; exit 1 }
Native $appcmd @('set', 'config', '-section:system.webServer/proxy', '/enabled:True', '/preserveHostHeader:True', '/commit:apphost') | Out-Null
Native $appcmd @('set', 'config', '-section:system.webServer/rewrite/allowedServerVariables', '/+[name=''HTTP_X_FORWARDED_PROTO'']', '/commit:apphost') | Out-Null
# -- NSSM: reuse the ERP's copy
$nssm = "$Root\tools\nssm.exe"
if (-not (Test-Path $nssm)) { if (Test-Path "$ErpRoot\tools\nssm.exe") { Copy-Item "$ErpRoot\tools\nssm.exe" $nssm } else { $zip = "$Root\tools\nssm.zip"; Invoke-WebRequest 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zip; Expand-Archive $zip "$Root\tools\nssm-x" -Force; Copy-Item "$Root\tools\nssm-x\nssm-2.24\win64\nssm.exe" $nssm; Remove-Item "$Root\tools\nssm-x" -Recurse -Force; Remove-Item $zip } }
Say 'NSSM ready' Green
$node = (Get-Command node).Source
if (Get-Service DcAmcApi -ErrorAction SilentlyContinue) { Native $nssm @('stop', 'DcAmcApi') | Out-Null; Native $nssm @('remove', 'DcAmcApi', 'confirm') | Out-Null }
Native $nssm @('install', 'DcAmcApi', $node, 'src\server.js') | Out-Null
foreach ($kv in @(@('AppDirectory', "$Root\app\backend"), @('AppStdout', "$Root\logs\DcAmcApi.log"), @('AppStderr', "$Root\logs\DcAmcApi.log"), @('AppRotateFiles', '1'), @('AppRotateBytes', '20000000'), @('AppRestartDelay', '3000'), @('Start', 'SERVICE_AUTO_START'), @('AppEnvironmentExtra', 'NODE_ENV=production'))) { Native $nssm (@('set', 'DcAmcApi') + $kv) | Out-Null }
Native $nssm @('set', 'DcAmcApi', 'AppExit', 'Default', 'Restart') | Out-Null
Say 'Service DcAmcApi registered (starts after the first deploy)' Green
# -- IIS site for the API: host name on 80/443, or a plain port until DNS is ready
$site = 'DcAmcApi'
if (-not ((Native $appcmd @('list', 'site', $site)) -match $site)) {
  Native $appcmd @('add', 'apppool', "/name:$site", '/managedRuntimeVersion:') | Out-Null
  $bind = if ($HostName) { "http/*:80:$HostName" } else { "http/*:${Port}:" }
  Native $appcmd @('add', 'site', "/name:$site", "/bindings:$bind", "/physicalPath:$Root\web") | Out-Null
  Native $appcmd @('set', 'app', "$site/", "/applicationPool:$site") | Out-Null
  Say "IIS site $site created ($bind)" Green
} else { Say "IIS site $site exists" Green }
Copy-Item (Join-Path $PSScriptRoot $(if ($HostName) { 'web.config' } else { 'web-http.config' })) "$Root\web\web.config" -Force
$ports = if ($HostName) { @(80, 443) } else { @($Port) }
foreach ($p in $ports) { if (-not (Get-NetFirewallRule -DisplayName "DcAMC api $p" -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName "DcAMC api $p" -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null } }
Say ("Windows firewall: " + ($ports -join ', ') + " allowed (check the hosting panel firewall too)") Green
# -- HTTPS (after DNS points here): win-acme from the ERP set-up
if ($Certificate) {
  if (-not $HostName -or -not $Email) { Say 'Give -HostName and -Email with -Certificate.' Red; exit 1 }
  $wacs = Get-ChildItem "$ErpRoot\tools" -Recurse -Filter wacs.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $wacs) { Say "win-acme (wacs.exe) not found under $ErpRoot\tools - run the ERP set-up with -Certificate once, or install win-acme." Red; exit 1 }
  & $wacs.FullName --target iis --siteid (Native $appcmd @('list', 'site', $site, '/text:id')) --host $HostName --emailaddress $Email --accepttos
  Say "Certificate requested for $HostName" Green
}
Say "Set-up done. Next: deploy-backend.ps1, fill $Root\app\backend\.env from env.production.example, start the service. On Vercel set VITE_API_URL to this API's address." Cyan
