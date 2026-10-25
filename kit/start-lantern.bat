@echo off
rem start-lantern.bat -- Lantern with its AI on a Windows computer (laptop / USB kit).
rem   start-lantern              this computer only
rem   start-lantern share        also phones on the same Wi-Fi or hotspot
rem   start-lantern gpu          use the graphics card (Vulkan)
rem   start-lantern 9b           use a particular model from models\ (35b 9b 4b 2b 0.8b)
rem   start-lantern nodownload   do not offer a bigger model
rem   start-lantern novision     do not load the model's vision part (loaded
rem                              when models\ has it: the AI can then look at
rem                              the drawings it makes)
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
set "LIBRARY=%DIR%library"
if not exist "%LIBRARY%" set "LIBRARY=%DIR%..\library"
if "%LIBRARY_PORT%"=="" set LIBRARY_PORT=8081
if "%PORT%"=="" set PORT=8080
set HOST=127.0.0.1
set NGL=-ngl 0
set "AUTO=1"
set "FORCE="
set "VISION=1"
for %%a in (%*) do (
  if /I "%%a"=="share" set HOST=0.0.0.0
  if /I "%%a"=="gpu" set NGL=
  if /I "%%a"=="nodownload" set "AUTO="
  if /I "%%a"=="novision" set "VISION="
  if /I "%%a"=="35b" set "FORCE=35B-A3B"
  if /I "%%a"=="9b" set "FORCE=9B"
  if /I "%%a"=="4b" set "FORCE=4B"
  if /I "%%a"=="2b" set "FORCE=2B"
  if /I "%%a"=="0.8b" set "FORCE=0.8B"
)
if "%LANTERN_AUTO_DOWNLOAD%"=="0" set "AUTO="
if not "%MODEL%"=="" set "AUTO="
if defined FORCE set "AUTO="
if not exist "%SITE%\index.html" (
  echo Lantern itself is not in this folder ^(no site\index.html^).
  echo Double-click the Install Lantern file for Windows first, or run setup-kit.bat: it downloads it.
  pause & exit /b 1
)
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
rem The model's vision part (mmproj-<model>-F16.gguf, from setup-kit), so the
rem AI can look at pictures -- the drawings Lantern makes for it to check.
set "MMPROJ="
set "MNAME="
for %%f in ("!M!") do set "MNAME=%%~nxf"
if defined VISION for %%v in ("%MODELS%\mmproj-*.gguf") do (
  set "VB=%%~nv"
  set "VB=!VB:mmproj-=!"
  set "VB=!VB:-BF16=!"
  set "VB=!VB:-F16=!"
  set "VB=!VB:-F32=!"
  echo !MNAME!| findstr /B /I /L /C:"!VB!-" >nul && set "MMPROJ=%%~fv"
)
set "MMARG="
if defined MMPROJ set MMARG=--mmproj "!MMPROJ!"
echo.
echo Lantern: !M! with !MEM! MB memory
if defined MMPROJ echo Vision: !MMPROJ! ^(the AI can look at the pictures it makes^)
echo Open http://127.0.0.1:%PORT%/  ^(keep this window open; close it to stop^)
if "%HOST%"=="0.0.0.0" (
  for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /C:"IPv4"') do (
    set "ip=%%i"
    set "ip=!ip: =!"
    echo Phones on this network: http://!ip!:%PORT%/
  )
)
rem The offline library: kiwix-serve on port 8081 with every ZIM in library\.
rem Lantern finds it there by itself (AI app, Offline library).
set "KIWIX=%DIR%engine\windows\kiwix\kiwix-serve.exe"
set "ZIMS="
for %%z in ("%LIBRARY%\*.zim") do set ZIMS=!ZIMS! "%%~fz"
if defined ZIMS (
  if exist "!KIWIX!" (
    start "Lantern library" /b "!KIWIX!" --port !LIBRARY_PORT! --address !HOST! -z !ZIMS!
    echo Library: !ZIMS! ^(http://127.0.0.1:!LIBRARY_PORT!/^)
  ) else (
    echo Library files found, but not kiwix-serve: run setup-kit.bat library
  )
)
rem Open Lantern as soon as the server answers. The model takes a minute or
rem more to load (minutes for a big one from a USB stick); the page shows a
rem progress bar meanwhile and connects by itself when the model is ready.
rem It is told the model's name and size and when the server started.
set "MBYTES=0"
for %%f in ("!M!") do set "MBYTES=%%~zf"
set "VBYTES=0"
if defined MMPROJ for %%f in ("!MMPROJ!") do set "VBYTES=%%~zf"
start "" /b powershell -NoProfile -Command "$t=[DateTimeOffset]::Now.ToUnixTimeMilliseconds(); for($i=0;$i -lt 60;$i++){ try { $c=New-Object Net.Sockets.TcpClient('127.0.0.1',%PORT%); $c.Close(); break } catch { Start-Sleep -Milliseconds 500 } }; Start-Process ('http://127.0.0.1:%PORT%/?kit=1&model=!MNAME!&bytes=!MBYTES!&vbytes=!VBYTES!&t=' + $t)"
echo.
echo The AI model is loading now. That takes a minute or two, longer from a USB
echo stick; Lantern's page shows a progress bar until it is ready.
echo Keep this window open: closing it stops Lantern's AI.
echo.
pushd "%DIR%engine\windows"
"%BIN%" -m "!M!" !MMARG! --path "%SITE%" --host %HOST% --port %PORT% -c 8192 %NGL%
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
