@echo off
rem Train Lantern model (Windows).bat -- fit a small model to Lantern with a LoRA, on this computer's NVIDIA card.
rem
rem   Double-click it for the 0.8B, or from a command window:  "Train Lantern model (Windows).bat" 2b   (0.8b 2b 4b 9b)
rem   A second word picks the prompt the data was built for:   ... 0.8b library   (short is the default)
rem
rem What it does, each step said in this window:
rem   1. a Python of its own in train\venv (Python 3.10 to 3.13 must be installed: python.org)
rem   With no internet: run "Get everything for offline use (Windows).bat" once where there is internet, carry this
rem   folder over, and every step below finds what it needs here.
rem   2. PyTorch for NVIDIA cards, transformers and peft -- free, open-source programs
rem   3. the base model's original weights from Hugging Face (Qwen3.5, Apache-2.0), into train\base
rem   4. the training (train_lora.py) on train\data\lantern_<prompt>_train.jsonl -- right answers only
rem   5. llama.cpp's own converter (the same build as the kit's engine) and quantizer: a .gguf the stick runs
rem   6. the trained model in models\tuned\ -- never chosen by Start Lantern on its own; "Start trained model.bat" runs it
rem Nothing of the stick's own model is changed. Each step that is done already is skipped when this is run again.
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "SIZE=%~1"
if "%SIZE%"=="" set "SIZE=0.8b"
set "PROMPT=%~2"
if "%PROMPT%"=="" set "PROMPT=short"
set "QL="
if /I "%SIZE%"=="0.8b" set "HF=Qwen/Qwen3.5-0.8B"
if /I "%SIZE%"=="2b" set "HF=Qwen/Qwen3.5-2B"
if /I "%SIZE%"=="4b" set "HF=Qwen/Qwen3.5-4B"
if /I "%SIZE%"=="9b" (
  set "HF=Qwen/Qwen3.5-9B"
  set "QL=--qlora"
)
if not defined HF ( echo Which model? 0.8b, 2b, 4b or 9b. & pause & exit /b 1 )
set "DATA=data\lantern_%PROMPT%_train.jsonl"
if not exist "%DATA%" ( echo No training data at train\%DATA%. & pause & exit /b 1 )
rem the kit: its engine (llama-quantize) and its models folder
set "KIT=%~dp0..\kit"
if not exist "%KIT%\start-lantern.bat" set "KIT=%~dp0.."
rem (no Lantern beside this folder: it still trains, and the model stays in train\out)
if not exist "%KIT%\start-lantern.bat" set "KIT="
set "MODELS="
if defined KIT set "MODELS=%KIT%\models"
if defined KIT if not exist "%MODELS%" set "MODELS=%KIT%\..\models"
set "BUILD=b11435"

echo.
echo === Lantern model training: %HF%, %PROMPT% prompt ===
echo.
rem An NVIDIA card first: without one nothing below can train, so say so before any download.
where nvidia-smi >nul 2>nul
if errorlevel 1 if not exist "%SystemRoot%\System32\nvidia-smi.exe" (
  echo This computer has no NVIDIA graphics card that its driver reports, and the training needs one.
  echo Double-click Check this computer ^(Windows^).bat to see what this computer has.
  pause
  exit /b 2
)
rem With no internet: "Get everything for offline use (Windows).bat", run once on a computer that has it, leaves the
rem programs in offline\wheels (for Python 3.12), the models in base\ and llama.cpp here; then nothing below downloads.
set "OFF="
if exist "%~dp0offline\wheels\torch-*.whl" set "OFF=%~dp0offline\wheels"

echo [1/6] A Python of its own ...
set "PY="
if exist venv\Scripts\python.exe goto havevenv
if defined OFF goto findpy312
rem (PyTorch has programs for Python 3.10 to 3.13: one of those first, if the py launcher has it)
for %%v in (3.12 3.13 3.11 3.10) do if not defined PY py -%%v -c "1" >nul 2>nul && set "PY=py -%%v"
if not defined PY python -c "import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) else 1)" >nul 2>nul && set "PY=python"
if not defined PY ( echo No Python 3.10 to 3.13 found. Install Python 3.12 from python.org, tick "Add python.exe to PATH", then run this again. & pause & exit /b 1 )
goto makevenv
:findpy312
rem (the programs fetched for offline use are for Python 3.12)
py -3.12 -c "1" >nul 2>nul && set "PY=py -3.12"
if not defined PY python -c "import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)" >nul 2>nul && set "PY=python"
if defined PY goto makevenv
echo The programs fetched for offline use are for Python 3.12, and this computer has no Python 3.12.
if exist "%~dp0offline\python-3.12.10-amd64.exe" echo Install it from train\offline\python-3.12.10-amd64.exe -- it needs no internet -- then run this again.
pause
exit /b 1
:makevenv
%PY% -m venv venv || ( echo Could not make train\venv. & pause & exit /b 1 )
:havevenv
set "VPY=%~dp0venv\Scripts\python.exe"

echo [2/6] PyTorch for the NVIDIA card, transformers, peft ...
rem (installed once: when they are there already nothing is downloaded, so a second run needs no internet)
"%VPY%" -c "import torch, transformers, peft, accelerate, sys; sys.exit(0 if torch.cuda.is_available() else 1)" >nul 2>nul
if not errorlevel 1 goto haveprograms
if defined OFF goto offlineprograms
"%VPY%" -m pip install --upgrade pip >nul
for %%c in (cu130 cu128 cu126) do (
  "%VPY%" -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 1)" >nul 2>nul || "%VPY%" -m pip install --upgrade torch --index-url https://download.pytorch.org/whl/%%c
)
"%VPY%" -m pip install --upgrade "transformers>=5.24" "peft>=0.22" accelerate safetensors huggingface_hub sentencepiece numpy pyyaml protobuf || ( echo Could not install the training programs. With no internet, see the file Get everything for offline use, in this folder. & pause & exit /b 1 )
goto haveprograms
:offlineprograms
echo   from train\offline\wheels, with no internet
"%VPY%" -m pip install --no-index --find-links "%OFF%" torch "transformers>=5.24" "peft>=0.22" accelerate safetensors huggingface_hub sentencepiece numpy pyyaml protobuf || ( echo Could not install the programs from train\offline\wheels. & pause & exit /b 1 )
:haveprograms
"%VPY%" -c "import torch,sys; print('  GPU:', torch.cuda.get_device_name(0)); sys.exit(0)" 2>nul || ( echo PyTorch cannot see the NVIDIA card. Update the NVIDIA driver, then run this again. & pause & exit /b 1 )
if not defined QL goto bnbdone
"%VPY%" -c "import bitsandbytes" >nul 2>nul && goto bnbdone
if defined OFF "%VPY%" -m pip install --no-index --find-links "%OFF%" bitsandbytes
if not defined OFF "%VPY%" -m pip install --upgrade bitsandbytes
:bnbdone
rem (Qwen3.5's linear-attention layers run on PyTorch's own code here: right, a little slower. The faster kernels,
rem flash-linear-attention, need Triton, which on Windows is not always sure to work: not installed.)

echo [3/6] The base model's original weights (%HF%) ...
set "BASE=%~dp0base\%SIZE%"
if not exist "%BASE%\config.json" (
  "%VPY%" -c "from huggingface_hub import snapshot_download; snapshot_download('%HF%', local_dir=r'%BASE%')" || ( echo Could not download %HF%. With no internet, run the file Get everything for offline use, with --sizes %SIZE%, on a computer that has it. & pause & exit /b 1 )
)

echo [4/6] Training -- the window shows each step and the loss on questions kept out ...
rem (everything from here reads files on this computer: tell the Hugging Face programs not to look online)
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "OUT=%~dp0out\%SIZE%-%PROMPT%"
if not exist "%OUT%\adapter\adapter_config.json" (
  "%VPY%" -u train_lora.py --model "%BASE%" --data "%DATA%" --out "%OUT%" %QL% || ( echo The training stopped. Its messages are above. & pause & exit /b 1 )
)

echo [5/6] llama.cpp's converter, and the model made a .gguf ...
set "LL=%~dp0llama.cpp-%BUILD%"
if not exist "%LL%\convert_hf_to_gguf.py" (
  powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://github.com/ggml-org/llama.cpp/archive/refs/tags/%BUILD%.zip -OutFile llama-src.zip; Expand-Archive -Force llama-src.zip .; Remove-Item llama-src.zip" || ( echo Could not download llama.cpp's converter. With no internet, see the file Get everything for offline use, in this folder. & pause & exit /b 1 )
)
set "QZ=%KIT%\engine\windows\llama-quantize.exe"
if not exist "%QZ%" set "QZ="
set "NAME=%HF:Qwen/=%-Lantern-%PROMPT%"
"%VPY%" -u merge_to_gguf.py --model "%BASE%" --adapter "%OUT%\adapter" --out "%OUT%" --llama "%LL%" --quantize "%QZ%" --name "%NAME%" || ( echo The conversion stopped. Its messages are above. & pause & exit /b 1 )

echo [6/6] Into models\tuned\ ...
if not defined MODELS (
  echo   No Lantern kit beside this folder, so the trained model stays in train\out\%SIZE%-%PROMPT%\
  echo   To run it, copy its .gguf into a Lantern kit's models\tuned folder and use "Start trained model.bat" there.
  pause
  exit /b 0
)
if not exist "%MODELS%\tuned" mkdir "%MODELS%\tuned"
for %%f in ("%OUT%\%NAME%-Q4_K_M.gguf" "%OUT%\%NAME%-Q8_0.gguf") do if exist "%%~f" copy /y "%%~f" "%MODELS%\tuned\" >nul && echo   %%~nxf
echo.
echo Done. To try it: "Start trained model.bat" %SIZE% %PROMPT%   (then the bench, with Prompt size: %PROMPT%)
pause
