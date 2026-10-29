LANTERN
=======

Lantern is an offline office and learning suite with its own AI. Nothing
here needs the internet after setup. Free to use, copy and share (CC0).

What is in this folder
  Install Lantern (Windows / Mac / Linux)   set up Lantern's AI on this
                                            computer (needs internet once)
  Start Lantern (Windows / Mac / Linux)     start the AI and open Lantern
  Lantern_Office_Suite.html                 the whole suite in one file:
                                            double-click it, no AI needed
  site/                                     Lantern itself, as the AI kit shows it
  kit/                                      the scripts behind Install and Start;
                                            the AI engine, models and the offline
                                            encyclopedia are downloaded into it
  docs/                                     guides (PDF)
  CHANGELOG.md                              what changed in each version

First time
  1. Double-click Install Lantern for your computer.
       Windows: if it asks, choose More info, then Run anyway.
       Mac: if it refuses, System Settings > Privacy & Security > Open Anyway.
       Raspberry Pi: choose Execute.
  2. Answer the questions in the popups (a stronger model? the offline
     encyclopedia? a shelf of more books -- medicine, repair guides,
     travel, science?). Big downloads take a while; they carry on where
     they stopped if the internet drops.
  3. At the end it offers to start Lantern.

Every time
  Double-click Start Lantern. Lantern opens in the browser at
  http://127.0.0.1:8080 . Keep the Start window open while you use it;
  closing it stops the AI.
  While the AI model loads, the Start window's title and Lantern's loading
  screen say how much of it is read, how fast, and the time left. When the
  computer is short of FREE memory just then, a small window asks first:
  use a smaller model now (chosen by itself after a minute), load the big
  one anyway, or stop so you can close other programs. If the loading
  screen says the computer has run out of memory, wait and do not click:
  it can look frozen for a minute or two.

Updating to a newer Lantern
  Download the newer Lantern.zip. It holds one folder, Lantern. Extract it
  into the folder that holds THIS Lantern folder (on a USB stick: the folder
  with Lantern in it) and choose "Replace the files in the destination".
  Everything you downloaded (kit/engine, kit/models, kit/library) is never
  in the zip, so it stays as it is. Then Start Lantern as usual: its window
  shows the version of Lantern it opened.
  Windows' Extract All merges folders and asks before replacing; on a
  Raspberry Pi tick "Overwrite existing files" when extracting. A Mac does
  not merge folders: dragging the new Lantern over the old one REPLACES it,
  models and all. On a Mac use Terminal instead:
    ditto -x -k ~/Downloads/Lantern.zip "/path/to/the/folder/holding/Lantern"
  The newest Lantern.zip is always at:
    https://github.com/adamweldon/Lantern_Office_Suite/releases/latest/download/Lantern.zip

Licences
  Everything inside Lantern_Office_Suite.html is CC0 or public domain.
  What sits beside it keeps its own licence: site/places.txt (GeoNames,
  CC BY 4.0: keep its credit line), site/ai (MIT), and the models,
  engine and library books the kit downloads (see kit/README.txt; the
  iFixit repair shelf is CC BY-NC-SA: not for sale). Lantern's Charter
  app lists them all under Sources & licences.

More: kit/README.txt (the AI kit in detail).
