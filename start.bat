@echo off
REM Ongagawa Pump Room - prototype launcher
REM Serves files over local HTTP so video/image textures load correctly.
cd /d "%~dp0"

echo Starting local server: http://localhost:8000
echo Keep this window open. Press Ctrl+C to stop.
echo.

start "" http://localhost:8000/index.html

python -m http.server 8000
if errorlevel 1 py -m http.server 8000
