@echo off
rem Runs setup-kit.ps1 (downloads the AI engine and models). Needs internet once.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-kit.ps1" %*
pause
