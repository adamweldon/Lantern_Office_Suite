@echo off
rem Check this computer (Windows).bat -- can this computer train a Lantern model?
rem Reads the graphics card, memory, free space and Python, says YES or NO, and writes it to computer_check.txt here.
rem It changes nothing. Then "Train Lantern model (Windows).bat" does the training.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check_computer.ps1"
echo.
echo (Written to computer_check.txt in this folder.)
pause
