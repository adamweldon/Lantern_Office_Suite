@echo off
rem Get everything for offline use (Windows).bat -- fetch once what the training needs, so it can run with no internet.
rem
rem   Double-click it on a Windows computer that has the internet (the one that will train, while it is connected, or
rem   another). It fetches into this train folder: PyTorch for NVIDIA cards, transformers and peft for Python 3.12; the
rem   0.8B's and the 2B's original weights; llama.cpp's converter; and Python 3.12's own installer -- about 10 GB.
rem   Other models, from a command window:   "Get everything for offline use (Windows).bat" --sizes 0.8b,2b,4b
rem   Then carry the train folder (on the stick) to the computer that trains -- an air-gapped one too -- and run
rem   "Train Lantern model (Windows).bat" there. A file fetched whole is not fetched again: after an interruption,
rem   run this again and it goes on where it stopped. Nothing is installed on this computer.
setlocal
cd /d "%~dp0"
if not exist offline mkdir offline
set "PY="
for %%v in (3.12 3.13 3.11 3.10) do if not defined PY py -%%v -c "1" >nul 2>nul && set "PY=py -%%v"
if not defined PY python -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul && set "PY=python"
if defined PY goto fetch
echo This computer has no Python, and the fetching needs one. Fetching Python 3.12's own installer first ...
powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -UseBasicParsing https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe -OutFile offline\python-3.12.10-amd64.exe"
if not exist offline\python-3.12.10-amd64.exe ( echo Could not fetch Python. Is this computer on the internet? & pause & exit /b 1 )
echo.
echo Install it: double-click train\offline\python-3.12.10-amd64.exe and tick "Add python.exe to PATH".
echo Then run this again. The same installer goes with the train folder, for the computer that trains.
pause
exit /b 0
:fetch
%PY% -u fetch_offline.py %*
if errorlevel 1 ( echo. & echo The fetching stopped: its messages are above. Run this again to go on where it stopped. & pause & exit /b 1 )
echo.
pause
