LANTERN MODEL TRAINING -- fit a small model to Lantern (a pilot, 1.24.38)

Adam, 2026-11-24: freeze what works best for Lantern and the model together, so the two are better than either alone,
then fine-tune each small model to it with a LoRA. This folder does the fine-tuning part, on a computer with an NVIDIA
graphics card (Adam's laptop: an RTX A5000 with 16 GB is enough for the 0.8B, 2B and 4B, and the 9B in 4-bit).

TO RUN IT
  Put this "train" folder beside the "kit" folder of a Lantern that has been set up (or inside the Lantern folder).
  (On a computer with no Lantern set up it trains all the same, and leaves the model in train\out\: copy its .gguf
  to a Lantern's kit\models\tuned\ to run it.)
  Then, on a computer the kit has not run on: double-click "Check this computer (Windows).bat". It reads the graphics card, memory,
  free space and Python, says YES or NO for each model size, and writes it to computer_check.txt. It changes nothing.
  Double-click "Train Lantern model (Windows).bat"            -- the 0.8B, for the short prompt
  or, in a command window:  "Train Lantern model (Windows).bat" 2b library
  The first time it downloads free programs (PyTorch, transformers, peft) and the model's original weights -- about
  5 GB for the 0.8B, most of it PyTorch -- trains, and puts the trained model in kit\models\tuned\. Start Lantern never
  picks a model from there by itself. A second run downloads nothing.
  "Start trained model.bat" 0.8b short   starts Lantern with it. Then, in the AI tile, set Prompt size to the same
  prompt, and run the bench (set B: questions the training never saw). Compare with the stick's own model.

WITH NO INTERNET (an air-gapped computer)
  On a Windows computer that has the internet, double-click "Get everything for offline use (Windows).bat". It fetches
  into this folder PyTorch, transformers and peft for Python 3.12 (offline\wheels), Python 3.12's own installer
  (offline\), the 0.8B's and the 2B's original weights (base\) and llama.cpp's converter -- about 10 GB; installs
  nothing; and can be run again after an interruption. Other sizes:  ... --sizes 0.8b,2b,4b
  Carry this folder to the computer that trains. There, install Python from offline\python-3.12.10-amd64.exe if it has
  no Python 3.12, then run "Train Lantern model (Windows).bat": it installs from offline\wheels and downloads nothing.
  It fetches for Windows, so run it on Windows: pip works out what PyTorch needs from the computer it runs on.

WHAT IT LEARNS FROM (data\, made by build_data.js from runs\)
  Only right answers: replies the 35B wrote on Adam's laptop that Lantern passed, put to today's Lantern again and
  passed again in one round; replies Lantern sent back once and the model then got right (only the right one is a
  target); and the same sums with other numbers, each graded by the question's own ground truth. Never set B: the
  bench's set B is the test. data\summary_*.txt says what went in and what was left out, and why.
  To build it again after Lantern changes:  node train/build_data.js --runs train/runs --mode short --out train/data

WHAT IS NOT DONE YET
  This is a pilot on today's prompts, to measure how much training helps. The prompts are not frozen yet (CLAUDE.md:
  a model is trained for real only to a frozen protocol). The data leans on sums: few drawings, conversations and
  puzzles yet. Nothing here has been run on a GPU: the scripts were tried on a tiny made-up model, on a computer with
  no graphics card, up to llama.cpp's converter (which then refuses the made-up tokenizer, as it should).

The base models are Qwen3.5 (Apache-2.0): a trained model may be shared, with that licence's notice.
