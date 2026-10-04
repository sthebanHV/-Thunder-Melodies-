@echo off
setlocal
title Thunder Melodies - Portable
cd /d "%~dp0"
if not exist "runtime\node\node.exe" (
  echo Falta el runtime. Extrae TODO el ZIP en una carpeta antes de iniciar.
  pause
  exit /b 1
)
"runtime\node\node.exe" "scripts\portable-launch.mjs"
if errorlevel 1 (
  echo.
  echo No se pudo iniciar. Revisa el mensaje de arriba.
  pause
)
