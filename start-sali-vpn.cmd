@echo off
setlocal
cd /d "%~dp0"
title Sali VPN Local Server
echo Starting Sali VPN server, WireGuard, API, Mini App and Telegram bots...
echo Keep this window open while Sali VPN is in use.
call npm run dev:publish
if errorlevel 1 (
  echo.
  echo Sali VPN failed to start. Review the error above.
  pause
)
