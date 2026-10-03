@echo off
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo Node.js and npm are not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install

echo Building the app...
call npm run build

echo Opening the local site...
start http://localhost:8443/

call npm run dev -- --host 0.0.0.0
