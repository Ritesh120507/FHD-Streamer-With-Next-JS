@echo off
title NovaStream 120Hz Next.js Server
cd /d "%~dp0"

echo =========================================================================
echo   NovaStream - 120Hz / 120 FPS WebRTC Stream Studio (Next.js + React)
echo =========================================================================
echo.

where npm.cmd >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [+] Node & NPM detected.
    echo [+] Starting Next.js 15 dev server at http://localhost:3000 ...
    start http://localhost:3000
    call npm.cmd run dev
) else (
    echo [!] NPM not found in PATH. Launching PowerShell server...
    powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
)

pause
