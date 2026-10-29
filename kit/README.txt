LANTERN LAPTOP / USB KIT
========================

Lantern with its AI on a Windows, Mac or Linux computer, with no internet
after setup. The same folder works from a USB stick (format it exFAT so model
files over 4 GB fit).

Double-click (the easy way)
  At the top of the Lantern folder (the zip from GitHub, extracted):
    Install Lantern (Windows).bat / (Mac).command / (Linux).desktop
    Start Lantern   (Windows).bat / (Mac).command / (Linux).desktop
  Install asks its questions in popups (stronger model? encyclopedia?) and
  shows the downloads; on Linux and the Raspberry Pi it is a window of its
  own (lantern-kit.py, Python 3 with Tk) with the steps and a progress bar,
  and Start Lantern is a window too: Open Lantern, Share with phones, Stop.
  The first time: Windows "More info > Run anyway"; macOS "System Settings >
  Privacy & Security > Open Anyway"; Raspberry Pi "Execute".
  On Linux without Tk it opens a terminal (popups when zenity or kdialog is
  there); from a terminal: sh lantern-kit.sh install | start.
  When the ready-made Linux engine cannot start here (it is built for newer
  systems: Raspberry Pi OS Bookworm, Ubuntu 22.04 and older lack GLIBC 2.38),
  setup offers to build one on this computer: setup-kit.sh build-engine.
  A stick used by computers with different CPUs (a laptop and a Raspberry
  Pi) keeps one engine each: engine/linux and engine/linux-<cpu>.

Folder layout
  start-lantern.bat / .command / .sh   start Lantern (Windows / Mac / Linux)
  setup-kit.bat / .sh                   fetch the engine and models (once)
  lantern-kit.py / .sh                  the Linux window for both (double-click set-up)
  lantern-watch.py / .ps1               Lantern Watch: free memory before the model
                                        loads, and the load's real progress (see 2.)
  ../site/                              Lantern itself: the Lantern folder's site/,
                                        beside kit/ (kit/site only for a kit on its own;
                                        when both are there, the folder's is used)
  engine/windows|mac|linux/             llama.cpp llama-server (setup fills it)
  engine/<system>/kiwix/                kiwix-serve, for the library (setup fills it)
  models/                               .gguf model files (setup fills it)
  library/                              .zim encyclopedia files (setup library fills it)
  logs/                                 Lantern Watch's load logs (this computer's own)

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
     shelves  more free books for the AI to read, beside the encyclopedia
              (setup offers them once): WikiMed, Wikipedia's medicine
              articles (about 1 GB), iFixit repair guides (about 3 GB),
              the Wikivoyage travel guide and PhET science simulations
              (about 0.5 GB each)
     shelves-all  those and the Wiktionary dictionary (about 5 GB) and
              Wikibooks open textbooks (about 3 GB)
     shelf-medicine, shelf-repair, shelf-travel, shelf-science,
     shelf-words, shelf-textbooks   one of them
     vision   the vision part of each laptop model in the kit (0.7-0.9 GB
              each; new 4B/9B/35B downloads bring theirs along): the AI can
              then look at the drawings it makes in Chat
     check    show what this computer can run and what the kit has
     lantern  the newest Lantern from GitHub into the Lantern folder (site/
              and Lantern_Office_Suite.html; also to update it; setup fetches
              it by itself when there is none)
     build-engine   build llama-server here from the llama.cpp source (Linux;
              about 10-20 minutes on a Raspberry Pi 5). Needs a C++ compiler
              (build-essential); cmake is fetched with pip when missing
     gpu      Vulkan engine (graphics card) instead of the CPU-only one

2. Start
   Windows: double-click start-lantern.bat
   Mac: double-click start-lantern.command (first time: right-click > Open)
   Linux: ./start-lantern.sh
   Lantern opens at http://127.0.0.1:8080 and finds the model by itself.
   A big model takes a minute or more to load (a few minutes from a USB
   stick). Lantern shows a progress bar meanwhile and connects as soon as
   the model is ready -- no need to reload the page.
   Keep the window open; closing it stops the AI.

   Lantern Watch (lantern-watch.ps1 on Windows; lantern-watch.py on Linux,
   the Raspberry Pi and Mac, with Python 3) runs beside the engine:
    - Before the model loads, it checks FREE memory, not only the total.
      When the model would not fit just now, a small window asks: use the
      largest smaller model that fits (the choice it makes by itself after
      60 s), load it anyway (the computer may freeze for a few minutes), or
      stop so you can close programs (a web browser with many tabs uses a
      lot) and start again. A model picked by hand (start-lantern 35b,
      MODEL=) is never switched, only warned about. Linux without zenity:
      it takes the first choice and says so.
    - While it loads, it measures the bytes read from the model's drive,
      free memory and paging. The window's title shows the progress and the
      time left ("Lantern AI: loading 43%, about 1 min 29 s left"), a line
      is printed when something changes, and Lantern's loading screen shows
      the same: what is read from where at what speed, a slow USB port, and
      "out of memory, please wait, do not click" when the computer is moving
      programs to the disk. It answers only this computer
      (http://127.0.0.1:8082/status); phones keep the estimated bar.
    - On Linux and Mac the engine runs at a gentler priority (--prio -1),
      so the desktop stays responsive. Windows keeps normal priority.
    - Each load is logged in kit/logs (loads.csv, the last 20 load-*.csv,
      last-load.json): send loads.csv to tune Lantern for real computers.
      kit/logs is this computer's own and is never in Lantern.zip.
    - Settings: LANTERN_WATCH_PORT (default 8082); LANTERN_PRIO=0 (Linux,
      Mac: normal priority); LANTERN_PRIO=1 (Windows: try the BelowNormal
      priority class, untested). Without Python 3 or the watcher files,
      start-lantern works as before.

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
   Shelves: a question reads the shelf it is about first -- a snake bite
   reads WikiMed, a cracked phone screen reads iFixit, getting around a
   city reads Wikivoyage -- then the encyclopedia; a shelf a question is
   not about is not searched. The AI app's Offline library panel lists each
   book and what it is read for.

   Places: Lantern knows where 7,300 towns and cities are (every capital
   and region capital, the big towns) and works out how far apart two are
   and which way to go (Geography > Places & distances; the AI writes
   =DISTKM("Nairobi","Mombasa")). Served by the kit, it also reads
   Lantern/site/places.txt: every town of 1,000 people and up.

Updating Lantern
   Download the newer Lantern.zip and extract it into the folder that holds
   your Lantern folder (on the stick: the folder with Lantern in it), and
   choose Replace when it asks. Only Lantern's own files are in the zip:
   engine/, models/ and library/ here are never in it, so nothing you
   downloaded is touched. Windows (Extract All) merges the folders and asks
   before replacing files; on the Raspberry Pi, tick "Overwrite existing
   files" in the archive tool's Extract window. A Mac does not merge:
   double-clicking the zip makes "Lantern 2", and dragging a folder over
   one of the same name REPLACES it, models and all. On a Mac, in Terminal:
     ditto -x -k ~/Downloads/Lantern.zip "/Volumes/STICK/folder-with-Lantern"
   (ditto merges), or ./setup-kit.sh lantern (fetches the newest Lantern).
   start-lantern prints which Lantern it shows and its version.

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
 - Licences: Lantern CC0, and everything inside Lantern_Office_Suite.html
   is CC0 or public domain (its towns are Natural Earth's, public domain).
   Beside it: site/places.txt GeoNames, CC BY 4.0 (keep its credit line);
   site/ai wllama and llama.cpp MIT; llama.cpp MIT; Qwen3.5 Apache 2.0;
   kiwix-tools GPLv3 (a separate program); Wikipedia, WikiMed, Wikivoyage,
   Wiktionary and Wikibooks CC BY-SA 4.0; PhET CC BY 4.0; iFixit
   CC BY-NC-SA 3.0 -- non-commercial: a kit sold for money must leave the
   iFixit shelf off. The Charter app in Lantern has the full list (Sources
   & licences).
