@echo off
setlocal
title QuoteFlow Client Portal
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing portal dependencies...
  call npm.cmd install
  if errorlevel 1 goto :failed
)

node.exe -e "const Database=require('better-sqlite3'); new Database(':memory:').close()" >nul 2>&1
if errorlevel 1 (
  echo Refreshing the local database module for this version of Node.js...
  call npm.cmd rebuild better-sqlite3 --cache "%~dp0node_modules\.npm-cache"
  if errorlevel 1 goto :failed
)

echo Building the client portal...
call npm.cmd run build
if errorlevel 1 goto :failed

echo.
echo Client portal: http://127.0.0.1:8787/
echo.
echo Keep this window open while testing. Press Ctrl+C to stop the portal.
start "" cmd.exe /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:8787/"
call npm.cmd start
exit /b %errorlevel%

:failed
echo.
echo The client portal could not be started. Review the error above.
pause
exit /b 1
