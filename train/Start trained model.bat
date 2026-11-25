@echo off
rem Start trained model.bat -- Start Lantern with a model this folder trained (models\tuned\), not the stick's own.
rem   "Start trained model.bat" 0.8b short      (the size and prompt it was trained with)
rem In the AI tile set Prompt size to the same prompt (Short or Library), then run the bench, and compare the two runs.
setlocal
set "SIZE=%~1"
if "%SIZE%"=="" set "SIZE=0.8b"
set "PROMPT=%~2"
if "%PROMPT%"=="" set "PROMPT=short"
set "KIT=%~dp0..\kit"
if not exist "%KIT%\start-lantern.bat" set "KIT=%~dp0.."
set "MODELS=%KIT%\models"
if not exist "%MODELS%" set "MODELS=%KIT%\..\models"
set "MODEL="
for %%f in ("%MODELS%\tuned\*%SIZE%*-Lantern-%PROMPT%-*.gguf") do if not defined MODEL set "MODEL=%%~ff"
if not defined MODEL ( echo No trained %SIZE% model for the %PROMPT% prompt in %MODELS%\tuned. Run "Train Lantern model (Windows).bat" %SIZE% %PROMPT% first. & pause & exit /b 1 )
echo Starting Lantern with %MODEL%
call "%KIT%\start-lantern.bat"
