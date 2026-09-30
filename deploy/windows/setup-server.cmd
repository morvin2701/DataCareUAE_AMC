@echo off
rem DcAMC backend set-up. Double-click (asks for administrator). Once per server.
net session >nul 2>&1
if errorlevel 1 (
  if "%~1"=="" (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs") else (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs")
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-server.ps1" %*
pause
