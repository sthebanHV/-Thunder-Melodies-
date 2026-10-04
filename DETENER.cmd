@echo off
setlocal
cd /d "%~dp0"
"runtime\node\node.exe" "scripts\portable-launch.mjs" --stop
if errorlevel 1 pause
