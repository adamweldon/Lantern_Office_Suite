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
   This fetches llama.cpp (build b11435) for this computer and Qwen3.5 4B
   (2.7 GB) with 8 GB of memory or more, otherwise the phone models. If the
   computer can run a bigger model, it then offers that too (see 2). Options:
     phone    Qwen3.5 0.8B (533 MB) and 2B (1.3 GB) -- also for copying onto phones
     laptop   Qwen3.5 4B (2.7 GB)       for 8 GB computers
     big      Qwen3.5 9B (5.7 GB)       for 16 GB computers
     xl       Qwen3.5 35B-A3B (17.5 GB) for 32 GB computers
     usb      engines for all three systems + 0.8B, 2B, 4B, 9B (about 10 GB)
     check    show what this computer can run and what the kit has
     gpu      Vulkan engine (graphics card) instead of the CPU-only one

2. Start
   Windows: double-click start-lantern.bat
   Mac: double-click start-lantern.command (first time: right-click > Open)
   Linux: ./start-lantern.sh
   Lantern opens at http://127.0.0.1:8080 and finds the model by itself.
   Keep the window open; closing it stops the AI.

   Bigger model, automatically: each start checks what this computer can
   run. If it could run a stronger model than the kit has, there is room on
   the drive and there is internet, it says so and asks once:
     Download it now?  Y = yes   N = no, and don't ask again   (yes in 30 s)
   The download runs in its own window (Mac/Linux: in the background, with a
   log in models/) while Lantern starts with the model it has; the next start
   uses the bigger one. Interrupted downloads resume. Answer N and it won't
   ask about that model again (delete models/.skip-xl etc. to be asked again).
   With no internet it just starts. "start-lantern nodownload" skips the check.
   Pick a model by hand: start-lantern 35b | 9b | 4b | 2b | 0.8b

3. Share with phones (classroom)
   Start with "share" (start-lantern.bat share / ./start-lantern.sh share).
   Phones on the same Wi-Fi or the laptop's hotspot open the address the
   window prints, for example http://192.168.1.20:8080 -- no internet needed.

Notes
 - The model is picked by memory: 28 GB+ 35B-A3B, 16 GB+ 9B, 8 GB+ 4B,
   5 GB+ 2B, else 0.8B (the best of those in models/). Force a file:
   MODEL=path/to/file.gguf
 - Qwen3.5 35B-A3B is a mixture-of-experts model: 35B parameters, about 3B
   used per word, so it should answer near the 4B's speed with much more
   knowledge. It is new to the kit: run Lantern Bench to compare it with the
   4B and 9B on your computer.
 - A FAT32 stick cannot hold the 9B or 35B files (over 4 GB); the kit says
   so and stays with the models that fit. Format sticks exFAT.
 - CPU is the default on Windows and Linux because some graphics drivers
   crash llama.cpp; add "gpu" to try the graphics card. Macs use Metal.
 - Copy models/Qwen3.5-*.gguf onto a phone and load it in Lantern's AI app
   (On this device > Load file) to give a phone the AI without downloading.
 - Licences: Lantern CC0; llama.cpp MIT; Qwen3.5 Apache 2.0.
