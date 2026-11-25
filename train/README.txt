LANTERN MODEL TRAINING -- fit a small model to Lantern (a pilot, 1.24.38)

Adam, 2026-11-24: freeze what works best for Lantern and the model together, so the two are better than either alone,
then fine-tune each small model to it with a LoRA. This folder does the fine-tuning part, on a computer with an NVIDIA
graphics card (Adam's laptop: an RTX A5000 with 16 GB is enough for the 0.8B, 2B and 4B, and the 9B in 4-bit).

TO RUN IT
  Put this "train" folder beside the "kit" folder of a Lantern that has been set up (or inside the Lantern folder).
  Then, on a computer the kit has not run on: double-click "Check this computer (Windows).bat". It reads the graphics card, memory,
  free space and Python, says YES or NO for each model size, and writes it to computer_check.txt. It changes nothing.
  Double-click "Train Lantern model (Windows).bat"            -- the 0.8B, for the short prompt
  or, in a command window:  "Train Lantern model (Windows).bat" 2b library
  It downloads about 3 GB of free programs (PyTorch, transformers, peft) and the model's original weights, trains, and
  puts the trained model in kit\models\tuned\. Start Lantern never picks a model from there by itself.
  "Start trained model.bat" 0.8b short   starts Lantern with it. Then, in the AI tile, set Prompt size to the same
  prompt, and run the bench (set B: questions the training never saw). Compare with the stick's own model.

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
