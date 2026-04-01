@echo off
cd /d "%~dp0"

if not exist ".spijlzoeker-server.pid" (
  echo Er is geen draaiende Spijlzoeker-server gevonden.
  timeout /t 2 /nobreak >nul
  exit /b 0
)

for /f "usebackq delims=" %%i in (".spijlzoeker-server.pid") do set SERVER_PID=%%i
if defined SERVER_PID (
  powershell -NoProfile -Command "Stop-Process -Id %SERVER_PID% -Force -ErrorAction SilentlyContinue"
)
del /f /q ".spijlzoeker-server.pid" >nul 2>&1

echo Spijlzoeker-server is gestopt.
timeout /t 2 /nobreak >nul
