@echo off
rem start-lantern.bat -- Lantern with its AI on a Windows computer (laptop / USB kit).
rem   start-lantern            this computer only
rem   start-lantern share      also phones on the same Wi-Fi or hotspot
rem   start-lantern gpu        use the graphics card (Vulkan)
setlocal EnableDelayedExpansion
set "DIR=%~dp0"
set "SITE=%DIR%site"
if not exist "%SITE%\index.html" set "SITE=%DIR%..\site"
set "MODELS=%DIR%models"
if not exist "%MODELS%" set "MODELS=%DIR%..\models"
if "%PORT%"=="" set PORT=8080
set HOST=127.0.0.1
set NGL=-ngl 0
for %%a in (%*) do (
  if /I "%%a"=="share" set HOST=0.0.0.0
  if /I "%%a"=="gpu" set NGL=
)
set "BIN=%DIR%engine\windows\llama-server.exe"
if not exist "%BIN%" (
  echo llama-server.exe not found. Run setup-kit.bat first ^(needs internet once^).
  pause & exit /b 1
)
for /f %%m in ('powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1MB)"') do set MEM=%%m
if "!MEM!"=="" set MEM=8000
set "M="
if not "%MODEL%"=="" set "M=%MODEL%"
if "!M!"=="" if !MEM! GEQ 15000 call :pick 9B 4B 2B 0.8B
if "!M!"=="" if !MEM! GEQ 7000 call :pick 4B 2B 0.8B
if "!M!"=="" if !MEM! GEQ 5000 call :pick 2B 0.8B
if "!M!"=="" call :pick 0.8B 2B 4B 9B
if "!M!"=="" for %%f in ("%MODELS%\*.gguf") do (
  echo %%~nxf | findstr /I mmproj >nul || if "!M!"=="" set "M=%%~ff"
)
if "!M!"=="" (
  echo No model in %MODELS%. Run setup-kit.bat, or copy a .gguf file there.
  pause & exit /b 1
)
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
