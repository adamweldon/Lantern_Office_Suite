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
  engine/<system>/kiwix/                kiwix-serve, for the library (setup fills it)
  models/                               .gguf model files (setup fills it)
  library/                              .zim encyclopedia files (setup library fills it)

1. Set up (needs internet once)
   Windows: double-click setup-kit.bat
   Mac/Linux: ./setup-kit.sh
   This fetches, in one go: llama.cpp (build b11435) for this computer;
   Qwen3.5 4B (2.7 GB) with 8 GB of memory or more, otherwise the phone
   models; then, if the computer can run a bigger model, it offers that
   (Y/N, yes after 30 s); then the offline encyclopedia (Y/N): English
   Wikipedia lead sections (about 12 GB), or Simple English (about 2.5 GB)
   if the drive has no room for the full one. Options:
     phone    Qwen3.5 0.8B (533 MB) and 2B (1.3 GB) -- also for copying onto phones
     laptop   Qwen3.5 4B (2.7 GB)       for 8 GB computers
     big      Qwen3.5 9B (5.7 GB)       for 16 GB computers
     xl       Qwen3.5 35B-A3B (17.5 GB) for 32 GB computers
     usb      engines for all three systems + 0.8B, 2B, 4B, 9B (about 10 GB)
     library  an offline encyclopedia for the AI to read: kiwix-serve and
              English Wikipedia, lead section of every article (about 12 GB);
              Simple English Wikipedia (about 2.5 GB) on a small or FAT32 drive
     library-simple   Simple English Wikipedia
     library-full     the full English Wikipedia: every article, text without
              pictures (about 60 GB; the size is read from the server). Keep
              the small one too: quick facts read the small file, explanation
              questions in Chat read whole articles. Hours to download; an
              interrupted download resumes.
     zim NAME any Kiwix file, e.g. "zim wikipedia_en_medicine_maxi" (newest
              version is found by itself; checked against its SHA-256)
     vision   the vision part of each laptop model in the kit (0.7-0.9 GB
              each; new 4B/9B/35B downloads bring theirs along): the AI can
              then look at the drawings it makes in Chat
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
   With no internet it just starts (and says it could not check).
   "start-lantern nodownload" skips the check. "setup-kit check" shows the
   memory, drive, models in the kit, and what the next start will offer or why not.
   Pick a model by hand: start-lantern 35b | 9b | 4b | 2b | 0.8b
   Vision: when models/ holds the model's vision part (mmproj-...-F16.gguf,
   from setup-kit vision), start-lantern loads it and says "Vision: ...".
   Chat can then show the AI the drawing it made, once, to check it.
   "start-lantern novision" starts without it (a little less memory).

   Offline library: when library/ holds .zim files, start-lantern also
   starts kiwix-serve on port 8081 and Lantern finds it (AI app > Offline
   library). Fact questions are then answered by reading it: the AI cites
   numbered passages and Lantern checks every quote. You can also browse the
   library itself at http://127.0.0.1:8081. Once the kit has the right model,
   start-lantern offers the encyclopedia once, the same way as a bigger model.
   Once it has the small encyclopedia, it also offers the full Wikipedia
   (about 60 GB) -- but only Y downloads it: no answer means "not now".
   With both files, Lantern uses the small one for quick facts and the full
   one when you ask Chat to explain something ("explain", "in detail", "how
   does"): it reads before the AI answers, then checks every sentence of the
   answer against what it read and shows which sentences are the AI's own.

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
 - Licences: Lantern CC0; llama.cpp MIT; Qwen3.5 Apache 2.0; kiwix-tools
   GPLv3 (a separate program); Wikipedia text CC BY-SA 4.0.
