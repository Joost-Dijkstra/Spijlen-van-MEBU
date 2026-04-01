@echo off
cd /d "%~dp0"

start "Spijlzoeker server" /min node server.js
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4173
