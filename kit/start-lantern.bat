@echo off
rem start-lantern.bat -- Lantern with its AI on a Windows computer (laptop / USB kit).
rem   start-lantern              this computer only
rem   start-lantern share        also phones on the same Wi-Fi or hotspot
rem   start-lantern gpu          use the graphics card (Vulkan)
rem   start-lantern 9b           use a particular model from models\ (35b 9b 4b 2b 0.8b)
rem   start-lantern nodownload   do not offer a bigger model
rem It uses the best model in models\ that this computer's memory can run.
rem When the computer could run a better one than the kit has (and there is
rem internet and room on the drive), it asks once and downloads it in a
rem separate window while Lantern starts; the next start uses it.
setlocal EnableDelayedExpansion
set "DIR=%~dp0"
set "SITE=%DIR%site"
if not exist "%SITE%\index.html" set "SITE=%DIR%..\site"
set "MODELS=%DIR%models"
if not exist "%MODELS%" set "MODELS=%DIR%..\models"
if "%PORT%"=="" set PORT=8080
set HOST=127.0.0.1
set NGL=-ngl 0
set "AUTO=1"
set "FORCE="
for %%a in (%*) do (
  if /I "%%a"=="share" set HOST=0.0.0.0
  if /I "%%a"=="gpu" set NGL=
  if /I "%%a"=="nodownload" set "AUTO="
  if /I "%%a"=="35b" set "FORCE=35B-A3B"
  if /I "%%a"=="9b" set "FORCE=9B"
  if /I "%%a"=="4b" set "FORCE=4B"
  if /I "%%a"=="2b" set "FORCE=2B"
  if /I "%%a"=="0.8b" set "FORCE=0.8B"
)
if "%LANTERN_AUTO_DOWNLOAD%"=="0" set "AUTO="
if not "%MODEL%"=="" set "AUTO="
if defined FORCE set "AUTO="
set "BIN=%DIR%engine\windows\llama-server.exe"
if not exist "%BIN%" (
  echo llama-server.exe not found. Run setup-kit.bat first ^(needs internet once^).
  pause & exit /b 1
)
for /f %%m in ('powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1MB)"') do set MEM=%%m
if "!MEM!"=="" set MEM=8000
rem A bigger model for this computer? (asks once; downloads in its own window)
if defined AUTO powershell -NoProfile -ExecutionPolicy Bypass -File "%DIR%setup-kit.ps1" offer
set "M="
if not "%MODEL%"=="" set "M=%MODEL%"
if "!M!"=="" if defined FORCE (
  call :pick !FORCE!
  if "!M!"=="" echo No !FORCE! model in !MODELS!, so using the best one there instead.
)
if "!M!"=="" if !MEM! GEQ 28000 call :pick 35B-A3B 9B 4B 2B 0.8B
if "!M!"=="" if !MEM! GEQ 15000 call :pick 9B 4B 2B 0.8B
if "!M!"=="" if !MEM! GEQ 7000 call :pick 4B 2B 0.8B
if "!M!"=="" if !MEM! GEQ 5000 call :pick 2B 0.8B
rem Nothing that suits this memory: the smallest model there is.
if "!M!"=="" call :pick 0.8B 2B 4B 9B 35B-A3B
if "!M!"=="" for %%f in ("%MODELS%\*.gguf") do (
  echo %%~nxf | findstr /I mmproj >nul || if "!M!"=="" set "M=%%~ff"
)
if "!M!"=="" (
  echo No model in %MODELS%. Run setup-kit.bat, or copy a .gguf file there.
  pause & exit /b 1
)
echo.
echo Lantern: !M! with !MEM! MB memory
echo Open http://127.0.0.1:%PORT%/  ^(keep this window open; close it to stop^)
if "%HOST%"=="0.0.0.0" (
  for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /C:"IPv4"') do (
    set "ip=%%i"
    set "ip=!ip: =!"
    echo Phones on this network: http://!ip!:%PORT%/
  )
)
start "" /b cmd /c "timeout /t 8 >nul & start http://127.0.0.1:%PORT%/"
pushd "%DIR%engine\windows"
"%BIN%" -m "!M!" --path "%SITE%" --host %HOST% --port %PORT% -c 8192 %NGL%
popd
pause
exit /b 0

:pick
for %%p in (%*) do (
  if "!M!"=="" for %%f in ("%MODELS%\*%%p*.gguf") do (
    echo %%~nxf | findstr /I mmproj >nul || if "!M!"=="" set "M=%%~ff"
  )
)
exit /b 0
