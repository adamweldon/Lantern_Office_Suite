@echo off
rem Install Lantern (Windows) -- double-click: sets up Lantern's AI on this
rem computer (needs internet once). If Windows asks whether to run it, choose
rem Run (or More info, then Run anyway). Questions come up as message boxes;
rem this window shows the downloads.
title Lantern setup
set "LANTERN_POPUP=1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kit\setup-kit.ps1"
if errorlevel 1 goto failed
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $o = New-Object System.Windows.Forms.Form -Property @{TopMost=$true}; $m = 'Lantern is ready. Its AI works without internet from now on.' + [char]10 + [char]10 + 'To start it later, double-click Start Lantern (Windows) in the Lantern folder.' + [char]10 + [char]10 + 'Start Lantern now?'; $r = [System.Windows.Forms.MessageBox]::Show($o, $m, 'Lantern', 'YesNo', 'Information'); if ($r -eq 'Yes') { exit 0 } else { exit 1 }"
if errorlevel 1 exit /b 0
call "%~dp0kit\start-lantern.bat"
exit /b 0
:failed
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $o = New-Object System.Windows.Forms.Form -Property @{TopMost=$true}; $m = 'Setup stopped before it finished. This window shows what happened (often: no internet, or the drive is full).' + [char]10 + [char]10 + 'Fix that, then double-click Install Lantern (Windows) again. Downloads carry on where they stopped.'; [void][System.Windows.Forms.MessageBox]::Show($o, $m, 'Lantern', 'OK', 'Warning')"
pause
