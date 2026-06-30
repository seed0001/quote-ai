@echo off
title Quote AI - Free Cloudflare Tunnel
cd /d "%~dp0"

echo Starting Quote AI...
start "Quote AI Server" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev -- --host 127.0.0.1"

echo Waiting for Quote AI...
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5173/"

echo.
echo Starting free Cloudflare Quick Tunnel...
echo The public link will appear below and remain active while this window is open.
echo.
powershell.exe -NoProfile -Command "& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://127.0.0.1:5173 2>&1 | Tee-Object -FilePath '%~dp0CLOUDFLARE_TUNNEL.log'"
