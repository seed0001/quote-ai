@echo off
title Quote AI
cd /d "%~dp0"
echo Starting Quote AI...
echo.
echo Open http://127.0.0.1:5173/ if the browser does not open automatically.
start "" "http://127.0.0.1:5173/"
npm.cmd run dev -- --host 127.0.0.1
