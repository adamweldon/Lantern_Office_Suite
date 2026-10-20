LANTERN LAPTOP / USB KIT
========================

Lantern with its AI on a Windows, Mac or Linux computer, with no internet
after setup. The same folder works from a USB stick (format it exFAT so model
files over 4 GB fit).

Folder layout
  start-lantern.bat / .command / .sh   start Lantern (Windows / Mac / Linux)
  setup-kit.bat / .sh                   fetch the engine and models (once)
  site/                                 Lantern itself (copy from the repo)
  engine/windows|mac|linux/             llama.cpp llama-server (setup fills it)
  models/                               .gguf model files (setup fills it)

1. Set up (needs internet once)
   Windows: double-click setup-kit.bat
   Mac/Linux: ./setup-kit.sh
   This fetches llama.cpp (build b11435) for this computer and the model that
   fits its memory: Qwen3.5 4B (2.7 GB) with 8 GB or more, otherwise the phone
   models. Options:
     phone    Qwen3.5 0.8B (533 MB) and 2B (1.3 GB) -- also for copying onto phones
     laptop   Qwen3.5 4B (2.7 GB)
     big      Qwen3.5 9B (5.7 GB) for 16 GB computers
     usb      engines for all three systems + every model (about 10 GB) -- build a stick
     gpu      Vulkan engine (graphics card) instead of the CPU-only one

2. Start
   Windows: double-click start-lantern.bat
   Mac: double-click start-lantern.command (first time: right-click > Open)
   Linux: ./start-lantern.sh
   Lantern opens at http://127.0.0.1:8080 and finds the model by itself.
   Keep the window open; closing it stops the AI.

3. Share with phones (classroom)
   Start with "share" (start-lantern.bat share / ./start-lantern.sh share).
   Phones on the same Wi-Fi or the laptop's hotspot open the address the
   window prints, for example http://192.168.1.20:8080 -- no internet needed.

Notes
 - The model is picked by memory: 16 GB+ 9B, 8 GB+ 4B, 5 GB+ 2B, else 0.8B
   (whichever of those is in models/). Force one: MODEL=path/to/file.gguf
 - CPU is the default on Windows and Linux because some graphics drivers
   crash llama.cpp; add "gpu" to try the graphics card. Macs use Metal.
 - Copy models/Qwen3.5-*.gguf onto a phone and load it in Lantern's AI app
   (On this device > Load file) to give a phone the AI without downloading.
 - Licences: Lantern CC0; llama.cpp MIT; Qwen3.5 Apache 2.0.
