# Lantern Office Suite

Single-file, offline-first, zero-dependency office and education suite for
low-end hardware. Public domain (CC0).

Since v1.7 it includes **Compose**, a complete offline writing suite: guided
letters, CVs, essays and reports; a writing checker and live reading level in
Writer; a thesaurus; read-aloud proofreading; writing practice; mail merge;
and 18 writing lessons. See `docs/Lantern_Compose_Guide.pdf`.

Since v1.8 (test build) it includes an **on-device AI** that uses Lantern's
tools as its source of truth: it runs inside the page on a phone, or through
llama.cpp on a laptop or USB stick, with no internet after setup. See
`docs/Lantern_Edge_AI_Plan.pdf` and `docs/Lantern_AI_Test_Guide.pdf`.

Since v1.10 it includes **Text Reader**: printed text in pictures, scans,
screenshots and PDFs becomes text to search, correct, save (also as a
searchable PDF) and ask Chat about, all on the device. A **Sheet Music Reader**
in the Music tile turns printed music into notes, playback and MIDI.
Handwriting is not read yet (its module is a stub).

Since v1.12 Chat's AI can **make things in the apps**, not only drawings,
schematics and tables: a document in Writer, a deck in Slides, a Flashcards
deck and dated entries in the Planner (Lantern works out the dates from the
AI's words). Each is checked and shown in Chat first, and opens with one tap.
With a long document attached, the AI can ask to **READ** another page or
section, and Lantern reads it on demand. Since v1.12.2 a document can be saved as a PDF
file directly (**Save .pdf** in Writer and under every document the AI makes),
and asking Chat to rewrite or correct an attached document makes one.
Since v1.12.7 the AI can make a **wheel chart** (the Ohm's law power wheel, a
colour wheel, the seasons). It lists the parts and Lantern lays out every word.
Lantern also checks the formulas on a formula wheel.
Since v1.12.8 the USB kit opens Lantern while its model is still loading.
Lantern shows a progress bar and connects by itself when the model is ready.
Since v1.12.9, when Lantern has nothing on a question, Chat's AI answers from
its own knowledge (code, how-to steps, commands). It says so with "From my own
knowledge:", and Lantern labels that part as not checked.
Since v1.13.0 the **Code Lab** tile writes, checks and runs real programs:
Arduino (including the P1AM-100), Python, JavaScript, and PLC Structured Text
and ladder (rung text, drawn as rungs and turned into Structured Text). It has
45 tested examples (compiled, run or checked) and links to the free tools that
build each language. JavaScript runs in a sandbox. Chat's AI writes programs
with **MAKE CODE**; Lantern checks them and opens them in Code Lab, and says
whether one was adapted from a tested example. The turtle tile is now
**Turtle Code**, for beginners and children.
Since v1.14.0 the library has **shelves**: the USB kit can add WikiMed
(medicine), iFixit repair guides, the Wikivoyage travel guide, PhET science
simulations, Wiktionary and Wikibooks beside Wikipedia, and a question reads
the shelf it is about first. **Places** knows where 7,300 towns and cities are
(Natural Earth, public domain; every town of 1,000 and up from GeoNames when
the kit serves `site/places.txt`) and works out distances and bearings
(`DISTKM`, `BEARING`, Geography > Places & distances). **Codes** adds Morse,
the radio alphabet, base64, hex, ROT13/Caesar, SHA-256 and CRC-32 to the
formula engine. The Charter app lists every outside source and its licence
under **Sources & licences**: everything inside the single file stays CC0 or
public domain; what sits beside it keeps its own licence.
Since v1.17.0 and v1.18.0 Chat's AI draws **hydraulic, pneumatic, control and
electronic circuits** by naming the parts and what each does (MAKE HYDRAULIC,
MAKE PNEUMATIC, MAKE CONTROL, MAKE ELECTRONICS). Lantern draws every pipe, line
and wire, adds what such circuits always need (a relief valve, the holding
contact across a start button, the diode across a relay coil) and says so,
and checks the drawing before showing it. When the AI's block has a mistake,
Lantern sends back each problem and how it reads that kind of block, so the
second try is the right one. Tables can name their columns: `=[Qty]*[Price]`.

## Install on a computer (with its AI) -- two double-clicks

1. Download **[Lantern.zip](https://github.com/adamweldon/Lantern_Office_Suite/releases/latest/download/Lantern.zip)**
   (always the newest; built from `main` by `.github/workflows/lantern-zip.yml`).
   It holds one folder, `Lantern`. Extract it anywhere: a laptop, or a USB stick
   formatted exFAT (model files are over 4 GB).
2. Double-click the installer for your computer, at the top of the `Lantern` folder:

| Computer | Double-click | The first time |
|---|---|---|
| Windows | `Install Lantern (Windows).bat` | If Windows asks, choose **More info -> Run anyway** |
| Mac | `Install Lantern (Mac).command` | If macOS refuses: **System Settings -> Privacy & Security -> Open Anyway** |
| Raspberry Pi, Linux | `Install Lantern (Linux).desktop` (shows as **Install Lantern**) | If asked, choose **Execute** |

It downloads, once, the AI engine and the AI model that suits the computer's
memory (and Lantern itself, when the `kit` folder was copied on its own), then asks in popups whether to add a stronger model and an offline
encyclopedia. On a Raspberry Pi or Linux it opens Lantern's own window with
each step and a progress bar. When the ready-made engine cannot start (older
systems such as Raspberry Pi OS Bookworm), it offers to build one on the
computer (10 to 20 minutes on a Raspberry Pi 5). At the end it offers to start
Lantern. After that, double-click **Start Lantern** for your computer; keep its
window open while you use Lantern. Other Linux file managers: right-click
`kit/lantern-kit.sh` -> Run as a program, or type `sh kit/lantern-kit.sh install`.

**Lantern Watch** (1.15.0; `kit/lantern-watch.ps1` on Windows,
`kit/lantern-watch.py` on Linux, the Raspberry Pi and Mac) runs beside the AI
engine. Before the model loads it checks *free* memory, and when the model
would not fit just then it asks in a small window: a smaller model now (its
own choice after 60 s), load anyway, or stop to close programs. While the model
loads it measures the bytes read from the model's drive, free memory and
paging, and says so in the Start window's title and on Lantern's loading
screen: how much is read, how fast, the time left, a slow USB port, and "out of
memory: please wait, do not click" when the computer is moving programs to the
disk (only when free memory has really run out, 1.16.1). Each load is logged
in `kit/logs` (never in the zip). The USB port matters most: the same stick
loaded the 35B in 2 1/2 minutes from a USB 3 port and in 15 through a USB 2.0
port or adapter. Settings and details: `kit/README.txt`.

### Updating: extract the new Lantern.zip over the old Lantern folder

Download the newer `Lantern.zip` and extract it into the folder that holds your
`Lantern` folder (on a stick, the folder with `Lantern` in it); choose **Replace
the files in the destination**. The zip never holds `kit/engine`, `kit/models`
or `kit/library`, so the AI and the encyclopedia you downloaded stay. Lantern
lives in one place, `Lantern/site`; `start-lantern` uses it before any older
copy in `kit/site` and prints the version it opened. On a Raspberry Pi tick
"Overwrite existing files" when extracting. A Mac's Finder replaces whole
folders instead of merging, so on a Mac use
`ditto -x -k Lantern.zip "<folder holding Lantern>"`.

For maintainers: every push to `main` builds `Lantern.zip` (`python3
tools/make_lantern_zip.py`; it refuses when `package.json`, `site/` and the
single file disagree about the version) and puts it on the release
`v<version>`, marked Latest. GitHub's green **Code -> Download ZIP** still works
too (its folder is named `Lantern_Office_Suite-main` and holds the whole
repository).

## Three ways to run it

| Where | How |
|---|---|
| Any device, no AI | Open `Lantern_Office_Suite.html` (one file, works offline). |
| Phone or any browser, with AI | The website build in `site/`, published with GitHub Pages: open it, Add to Home Screen, download a model once in the **AI** app. |
| Laptop / USB stick, with AI | Double-click **Install Lantern**, then **Start Lantern** (above). From a terminal: `kit/setup-kit` once, then `kit/start-lantern` (see `kit/README.txt`). It uses the biggest model the computer's memory can run and offers to download a bigger one when the kit lacks it. Phones on the same Wi-Fi can share the laptop's model. |

### Publishing the website (GitHub Pages)

The `gh-pages` branch holds a copy of `site/`. Turn it on once: repository
**Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages`
/ (root) → Save**. The site appears at
`https://adamweldon.github.io/Lantern_Office_Suite/`. After changing the
suite: `python3 tools/build_site.py`, commit, then
`git subtree split --prefix site -b gh-pages && git push -f origin gh-pages`.
Any static host works (Netlify and Cloudflare Pages also read `site/_headers`
for multi-threading).

## Layout

| Path | What it is |
|---|---|
| `Lantern_Office_Suite.html` | The runnable, shareable file (self-unpacking bundle). Copy this one file to a phone, USB stick or SD card. |
| `src/lantern.inner.html` | The decoded inner suite: every `// MODULE: NAME - START/END` block. Edit and diff here; Project Context Studio ingests this directly. |
| `tools/bundle.js` | Byte-faithful decode / encode between the two. |
| `tests/` | Every check the suite must pass before a commit (`npm test`). |
| `site/` | The website build: Lantern + offline worker + install manifest + on-device AI engine (`site/ai`, wllama 3.8.1, MIT). Rebuilt by `tools/build_site.py`. `site/places.txt` (every town of 1,000 and up) is GeoNames data, **CC BY 4.0, not CC0**: keep its credit line. |
| `tools/make_places.js` | Builds the Places data: the `PLACES_DATA` module from Natural Earth 5.1.2 (public domain) and `site/places.txt` from GeoNames (CC BY 4.0). |
| `kit/` | Laptop / USB launchers and setup scripts for llama.cpp `llama-server`, and kiwix-serve for the offline library (Kiwix ZIM files in `kit/library/`). |
| `docs/Lantern_Edge_AI_Plan.pdf` | The plan: model size per device, architecture, distribution, phases, Lantern Bench. |
| `docs/Lantern_AI_Test_Guide.pdf` | Phase 1 test steps for phones and laptops, what to send back, and what was verified before release. |
| `docs/Lantern_Compose_Guide.pdf` | What the Compose writing suite does, how to use it, and how it is built. |
| `docs/Lantern_v1_6_Review.pdf` | How v1.6 was rebuilt from session history, what was fixed, what is still missing. |
| `CHANGELOG.md` | Version history. |
| `README.txt` | The plain-text guide at the top of the `Lantern` folder (Lantern.zip): what each file is, first time, every time, updating. |
| `Install Lantern (...)`, `Start Lantern (...)` | The double-click launchers for Windows, Mac and Linux / Raspberry Pi. |
| `tools/make_lantern_zip.py` | Packs `Lantern.zip`: one `Lantern` folder with the launchers, `site/`, `kit/`, `docs/`, the single file and the readme; never `kit/engine`, `kit/models`, `kit/library`. |
| `.github/workflows/lantern-zip.yml` | On every push to `main`: builds `Lantern.zip` and puts it on the latest release. |

## Working on it

```sh
node tools/bundle.js decode Lantern_Office_Suite.html src/lantern.inner.html   # unpack
# ...edit modules in src/lantern.inner.html...
node tools/bundle.js encode Lantern_Office_Suite.html src/lantern.inner.html Lantern_Office_Suite.html  # repack
node tools/bundle.js check  Lantern_Office_Suite.html src/lantern.inner.html   # must print OK before committing
```

The encoder is the exact inverse of the bundler (`JSON.stringify`, then every
`</` written as `</`); every byte outside the payload line is copied
verbatim.

## Testing

```sh
npm install   # dev tooling only (jsdom, acorn); the suite itself has no dependencies
npm test
```

`npm test` runs, against `src/lantern.inner.html`:

- **bundle check**: the shareable file decodes exactly to the source
- **structure**: START/END marker balance, size gate, no code outside modules, no 4+ blank lines, ES5-ES2017 only, `node --check`
- **regex quotes**: no quote characters inside regex literals (they desync string-blind lexers such as Project Context Studio's gate)
- **Project Context Studio gate**: what the Studio's splitter and merge gate check -- markers paired and unique, no circle among the modules named in "Depends:" headers, ( ) [ ] { } balanced in every module once strings and comments are stripped (the gate does not understand regex literals, so write \x28 \x29 \x5B \x5D \x7B \x7D \x2F inside them); modules over 2,500 tokens are listed with `--warnings`
- **boot tour**: boots the inner script the way the self-unpacking bundle does (after DOMContentLoaded), requires every app on the first home paint, then opens every app and fails on any exception
- **recovered session suites**: the July 13 page-size smoke + pagination geometry tests and the July 20 Deckplate, Assist/Astro and Forge/Chat suites, regenerated from those chats
- **compose engine**: the checker against correct and incorrect sentences (including clean text that must raise no alarms), readability maths, spelling and thesaurus data
- **compose app**: Compose and Writer driven end to end (tasks, Preview, Open in Writer, Check, Fix all safe, Words, Read aloud, Practice, Mail merge, lessons, self-tests)
- **compose isolation**: removes each of the 32 Compose modules in turn and requires the rest of the suite to boot and run without errors (rule 11)
- **AI layer**: engine routing, same-origin server detection, Assist and Chat through `Lantern.aiRoute`, the AI app and its panels, Lantern Bench graded against a perfect and a bad fake model, safety rules, answer-sentence checks, unit words, the everyday recipe cards, Earth-radius checks, checks of each formula against its question and the one correction turn
- **offline library**: search, read and passage-cutting against a stand-in kiwix-serve built from real kiwix-serve replies (five Wikipedia lead sections, CC BY-SA), the citation check (quotes must be in their passage, numbers in the cited passages), the reading turn in Assist and Chat, Chat reading first for explanation questions and checking each sentence against the passages, infobox facts, a small and a full book of one family used side by side, fact grading in the bench, the library panel, and no probing from public web addresses
- **AI makes things**: MAKE blocks (schematics, pictures, tables) found and checked, schematic layout on Draw's grid (loops, parallel rungs, one-terminal parts, polarity), circuit checks (closed loop, loose parts, unknown parts), pictures on the 20 x 12 grid, tables worked out by the sheet engine (empty-cell and text references caught), the Chat flow with one corrected block, Open in Draw (the person's drawing kept) and Open in Sheets, the look turn only when llama-server reports vision, and bench grading of the make questions; 1.12.5: junctions folded so a parallel circuit draws as a ladder, ammeters and voltmeters, note lines with {= ...} worked out on the picture, and the Ohm's-law follow-up Chat (numbers from the schematic made earlier count as given, a branch current stated in the answer is a used step, a NEED about a voltage source is not a library question); 1.12.7: a wire to an undeclared junction1 or GND makes that part, words on a drawing that run together, are cut off or are written twice go back once, and MAKE WHEEL (every word inside its wedge, no clashes; formulas in the wrong part, written twice or wrong for V = 12, I = 3, R = 4, P = 36 caught; colour wheels in their own colours; the 35B's power-wheel drawing sent back and corrected as a wheel in one Chat turn)
- **Install by double-click** (1.13.1): the kit window on a virtual screen -- a whole install with its questions as popups, the menu entry and desktop icon, installed again, Start (loading, ready, share with phones on the Wi-Fi address, stop), already running, no internet, start before install; the launchers opened the way Raspberry Pi OS's file manager and GLib open them; setup's window protocol, zenity popups, Windows message boxes falling back, an engine that cannot start (Bookworm's glibc) and building it here
- **One Lantern folder** (1.13.2): `Lantern.zip` has one top folder, `Lantern`, with the launchers, the single file, `README.txt`, `site/`, `kit/` and `docs/`, and never `kit/engine`, `kit/models`, `kit/library`, a `kit/site` copy or the repository's working parts; the run marks and Windows line endings kept; the same files from a plain folder as from git; a mismatched version refused; extracted over a copy of the USB stick's old Lantern folder: the new Lantern in place, the model, engine, library and the stick's own files untouched; Lantern found in the Lantern folder's `site/` before `kit/site` (check, Start, setup and its download, shell and PowerShell)
- **Waiting for the kit's model** (1.12.8): the page opened while llama-server still answers 503 "Loading model" shows a progress bar (model name and size, time so far and left), connects by itself when the model is ready and remembers how long it took; the corner button; asking while it loads; a saved page with the server off; nothing on a host with no model server
- **Loading screen with Lantern Watch** (1.15.0): with `&watch=<port>` from the start script, the page asks the watcher's `127.0.0.1:<port>/status` beside `/health` and shows its sentence, the measured progress and time left; the advice on its own line, and first, as a warning, when memory has run out (kept for a minute if the busy computer stops answering); the bar never moving back; the watcher's load time remembered; a hung watcher given up after 900 ms with `/health` keeping its pace; start-lantern stopped said within 5 s; nothing asked without the hint, from a phone on the Wi-Fi, or of a port that is not a number; an answer that is not a version-1 status ignored. **For real**: `kit/lantern-watch.py` run against a stand-in engine, its status read by the page over HTTP with the browser's Origin header and CORS enforced (another site refused), ready, and the load summary in the log folder
- **Lantern Watch** (1.15.0, `tests/lantern_watch/run_tests.py`): the watcher's plan cases (fits, busy, forced, novision, nothing smaller, too small in total) and load stories (a USB stick, a slow one, a cached model, memory pressure, a smaller model chosen, an engine that never starts, another server on the port) through `lantern-watch.py` and, when PowerShell is installed (`pwsh`, or `$PWSH`), through `lantern-watch.ps1` too, sample by sample the same; and in the kit test, start-lantern with the watcher in the kit: `&watch=` in the address, `--prio -1`, `LANTERN_PRIO=0`; `tests/lantern_watch/live_ps.py` runs the Windows watcher's real loop under PowerShell 7 against a stand-in engine: the first status within seconds, nothing written to the kit's log folder while the model loads, the load's log moved there at ready (with one left by a cut-off load), `firstSampleMs`, the engine stopping ends it
- **AI makes documents, slides, flashcards, plans; READ** (1.12): the MAKE DOC, SLIDES, CARDS and PLAN parsers and their checks (headings, lists, tables and bold for Writer; at most 7 points a slide; cards with both sides and no repeats; dates worked out by Lantern -- month ends, weekdays, day-and-month, nothing in the past -- and the Planner's repeats), the apps' own doors (`slideDocs`, `cardDocs`, `plannerDocs`), the prompt offering only the kind asked about, the command list saying where each opens, the Chat flow (Open in Writer / Slides / Flashcards, Add to Planner, made once however often tapped), the READ command (page, pages, section, words, "the last page", pages past the end, nothing found) and a conversation that READs words and then a section not yet read, and the four new bench questions graded with their ideal replies; 1.12.2: requests to make something from an attached document (the whole text and the MAKE instructions, not a question about it), READ: all, sentences about the document as a whole, and the Save .pdf file itself (header, cross-reference offsets, fonts, bullets, table rules, page numbers)
- **Puzzles**: the TRACK (things in a row and what they hold), TURN (a cube or a walker) and SOLVE (clue puzzles, by trying every arrangement) tools on the puzzles a 35B model was given, reworded ones, Einstein's five-house puzzle, knights and liars, a missing clue and contradicting clues; the text functions (REVERSE, REMOVE, LEN ...); Chat handing a puzzle to Lantern (results back for the answer, one correction, the tools on request, off for the bench's "alone" runs); the reasoning bench graded against a perfect model and against the 35B's real answers without the tools
- **Chat routing**: which questions go to the library and with what search words -- follow-ups searched with the AI's own words, questions about the AI or the chat answered from its reasoning, "without regard to the library" obeyed, earlier quotes counted as real, passage descriptions not taken for citations, recipe hints only with numbers -- replayed from a 35B transcript; Chat without the page (`converse`), the nine bench conversations and the five about a document (one needs READ); 1.12.9: answers from the AI's own knowledge, said with "From my own knowledge:" and labelled by Lantern (the Pi 400 clock, an AccelStepper example), still Not in my library for what no one could know offline, a general fact used in = lines versus a value only the person knows, fenced code shown in a fixed-width font
- **Text Reader**: the word model (marks inside words, lone letters, O and 0, codes, units, initials), layout on drawn bitmaps (blobs, lines, x-height, spaces measured against the font), glyph features, the PDF reader (object streams, a fax G4 picture decoded pixel for pixel, a page's own words with an embedded font), the word repairs and honest confidence (marks inside words, I for i, words run together, near misses of known words), document passages and sections, Chat answering from an attached document with its quote checked and a made-up quote caught, a question about the document itself answered as one, the Sheet Music Reader's staff finder, pitches and MIDI file, and the handwriting stub
- **Draw's schematic symbols** (1.15.0): a right-click only deletes (it used to place a symbol and delete that one), Turn and the R key turn the symbols a quarter turn (the arrow in the button's name too, a cylinder standing up), the preview under the pointer, Label never asking until a tap, each mode starting unturned
- **Hydraulic circuits** (1.17.0, `tests/hydraulic.js`): MAKE HYDRAULIC (parts and what each does) piped by Lantern -- each valve's P on the pump line, T to a tank, A to the cap end and B to the rod end, flow controls and pilot-operated checks on the right line -- with the relief valve and missing valves added and said, centres that cannot work changed and said, the pipes walked as a check (a cylinder line to tank, a valve off the pump line, the pump's outlet to tank all caught), the older MAKE SCHEMATIC hydraulic form (the 35B's) piped the same way, the bench checking the circuit, the electrical prompt free of hydraulics, Draw's ISO palette and dashed lines; `tests/browser/hydraulic_e2e.py` does it in Chromium through Chat with a stand-in model
- **Pneumatic circuits** (1.18.0, `tests/pneumatic.js`): MAKE PNEUMATIC (cylinders, the valves working them, the push buttons and rollers whose air signals work those valves) drawn the ISO 1219 way -- supply and service unit, each valve's 1 on the supply line, 4 to the cap end and 2 to the rod end, 3 and 5 to exhaust, each signal to 14 or 12, two signals on one side through a shuttle or two-pressure valve, never teed -- with valves, logic valves and meter-in/meter-out added or changed and said, the lines walked as a check, what each signal does said under the drawing, the older MAKE SCHEMATIC pneumatic form piped too, and the correction turn's numbered problems and block lines (fixText)
- **Control circuits** (1.18.0, `tests/control.js`): MAKE CONTROL ladders between L1 and L2 (or + and 0 V) -- stops in series, starts with the coil's holding contact across them, the coil at the right and its overload after it, numbered rungs and each coil's contacts listed by rung -- with the holding contact, a stop, a starter's overload, forward/reverse interlocks and a coil a start names added and said, an e-stop, fuse or shared stop in L1 ahead of every rung, the wires walked (no short, every coil between the rails, the holding contact across its start), and Draw's ladder symbols
- **Electronics** (1.18.0, `tests/electronics.js`): MAKE ELECTRONICS rails and branches with an LED's resistor, a transistor's base resistor, the diode across a coil a transistor switches, a transistor for a load too big for a pin, pull-downs, pull-ups and sensor dividers added, sized and said, inputs fed from the board's own 3.3 or 5 V; and the part / wire schematics checked: an LED's missing resistor added, one too small, a short, an ammeter across a part or a voltmeter in series sent back
- **Sheets by column name** (1.18.0, `tests/sheet_names.js`): `=[Qty]*[Price]` and `=SUM([Cost])` written as cell names by Lantern, a row copied down unchanged sent back with the formula to write, every MAKE kind's correction turn repeating its lines; `tests/browser/domains_e2e.py` drives pneumatics, control, electronics and a named-column sheet through Chat in Chromium with a stand-in model
- **The app audit** (1.16.0): **storage full** (`tests/storage_full.js`: Lantern started with the browser's storage already full still reads what was saved, and says Not saved), then one test per app: **Draw** (`tests/draw_symbols.js`: Undo/Redo and Ctrl+Z/Y, one eraser drag one undo, Clear undone, filled shapes erased from inside, tenths of a pixel, the not-saved notice); **Calculator** (`tests/calc_audit.js`: what happens after =, errors kept with their reason, brackets closed, implicit times, percent, memory and RAD kept, keyboard and dialogs; tiny and huge numbers, trig at quarter turns, LOG base, ROUND/MOD as Excel); **Sheets** (`tests/sheet_audit.js`: typing kept on click-away and leaving, pointing at cells, text cells, IF/IFERROR, Excel error codes and errors in ranges, typed 1,500/$12.50/10%, keys, CSV import); **Writer** (`tests/writer_audit.js`: paste and import cleaned, .txt lines, title once, unchanged on open, NOT saved when storage is full, Esc); **Slides** (`tests/slides_audit.js`: one show at a time, the X, no bare bullet, outline round trip, unchanged on open, the Ctrl+Z guard, keyboard thumbnails, paste); **Code Lab** (`tests/codelab_audit.js`: Find keeps its focus, quick big edits, undo by word, one comment marker, red lines move, typed extensions, NOT saved, JavaScript lines, Python one-liners, Arduino enums, a ladder ; left out, tags ignoring case, Ladder to Structured Text for TOF, RTO, RES, CTU with CTD, presets, LIM and Logix names, Run's output and timers, the drawing)
- **Code Lab** (1.13.0): the languages and install links, the highlighter, files, every language's checks on good and bad code, ladder rungs to Structured Text and the ladder drawing, JavaScript in a stand-in sandbox (output, errors, an endless loop stopped), all 45 tested examples passing their checks, the tile and the Turtle Code relabel, MAKE CODE in Chat (one corrected block, shown once, opened in Code Lab with its indents, provenance said), EXAMPLE:, code written straight into a reply, the seven program questions on the bench
- **Bench run 9 replayed**: the run's own replies through 1.13.1 -- a described place written as a name, the queue's "directly behind", retyped and restated results with `{ANS1}`/`{ANS2}`, READ at the end of a reply, a NEED Lantern answers (3 dozen), the trip-fuel card, painted-over shapes, a sun inside the sea, a total drawn as a part, a procedure without numbered steps, the look turn in the bench, the warranty grader, the puzzle rows labelled and their blocks kept
- **Bench run 11 replayed** (1.13.3): the run's own replies -- a corrected sentence that still types Lantern's results its own way, repaired and said so (and what repair leaves alone); "two places to its left" written as one place; LESSON: HEN HEALTH reading Chickens & eggs; "EXAMPLE: <title>" with code under it built as MAKE CODE, EXAMPLE: alone run as a command in the bench's MAKE path, the example shown between <<< and >>>; XIO on a normally closed Stop questioned; fuel for a trip the wrong way round questioned with the sum
- **Bench run 12 replayed** (1.13.4): the run's own replies -- a line that retyped Lantern's result with letters dropped, questioned and then run again with Lantern's results in place; {ANS2} (a word) where the count goes; a correct rung written as plain text, found and checked as Chat checks it; two lamps drawn as resistors labelled "Lamp"; the bench panel's Show, rebuilding what was made from the saved reply
- **Open modules** (1.14.0): shelves against a stand-in kiwix-serve with five books -- which shelf each book is, a medicine question reading WikiMed first and never iFixit, a repair question reading iFixit, a general one reading only the encyclopedia, the bench asking a shelf's questions only when the kit has the shelf and failing an answer that did not read it; Places -- the public-domain data in the file, capitals (South Africa's three, not Johannesburg), other names (Rangoon, Kiev, Washington, D.C.), regions, countries by other names, distances and bearings, a town the file lacks, `places.txt` loaded when served (Skiatook, Paris, Texas), the Geography card, the AI's `=DISTKM` passing the bench; Codes against published values (SHA-256, CRC-32, Morse, ICAO, base64 with UTF-8); the Charter's Sources & licences
- **Bench run 13 replayed** (1.14.1): the run's own replies -- "rotarigef" for Lantern's "rotaregirfer" (letters dropped, the rest in order) questioned and run again with Lantern's result; "What is the size of a square in meters?" answered by Lantern (the puzzle counts in squares) and the TURN block asked for; the AccelStepper sketch with `800L` passing the grader; a Structured Text tank with no PROGRAM and a valve that closes as soon as the level leaves the low float, both questioned, and the instructions copied after END left out; a ladder seal-in on `XIC(SealIn)`, a tag nothing sets, questioned, and code written into a reply sent back once (bench and Chat)
- **Bench run 14 replayed** (1.14.2, Qwen3.5-4B): lamps labelled "LED" made as lamps (not pushed to diodes); "in parallel" drawn as one loop questioned; 2 slides for "4 to 6" and "in 1 month" for "one week from today" questioned against the question; `=RUNTIME(10,60)` (a battery nobody gave) and "180 amp-hours" from watts questioned; `=1436.06/60` for Lantern's 1435.7027 run with Lantern's own result, no turn spent; Earth's mass and GM answered from PLANET; "no quote says methane" pointing at the sentence that does; the mayor right now answered as not knowable offline; "Not in the document" after 2 of 5 pages asked to READ first, and an own-knowledge guess about "this compressor" left out
- **Bench run 15 replayed** (1.14.3, Qwen3.5-4B, no library): a weight in newtons divided by 9.80665 questioned; `=60*5/1000+100*5/1000*0.15*30` (two lines glued with * past a sum) questioned with the brackets; amp-hours that are not amps x hours questioned; the nearest clinic's phone number answered as not in the library; a note line after a schematic's END kept in it; TRACK reading "person at position 2", and naming the one line that needs "2 left of" (the 4B had put 2 in both of its "left of" lines)
- **AI isolation**: removes each of the 120 AI, library, action, Text Reader, PDF, sheet music, suite-catalog, make, READ, Code Lab, places, codes, sources and document-decline modules in turn and opens Chat, Text Reader and Music (rule 11)

`tests/browser/code_lab_e2e.py` (not part of `npm test`; needs Playwright and Chromium) drives Code Lab and Chat in a real browser: Check on a broken example, ladder drawn and turned into Structured Text, JavaScript in a real Web Worker and an endless loop stopped, and MAKE CODE from a stand-in model checked, corrected once, shown once and opened in Code Lab.

`tests/browser/bench_run9_e2e.py` (not part of `npm test`; needs Playwright and Chromium) runs the whole Lantern Bench in a real browser against a stand-in llama-server that sees images and answers with bench run 9's replies: the puzzle rows labelled, the cups block corrected, the sun-and-sea drawing sent back and then shown to the model as a real PNG, the queue, the dozen.

`tests/browser/text_reader_e2e.py` (not part of `npm test`; needs Playwright and Chromium) reads the fixture pages in a real browser with an error limit per page (two of them screenshots turned upside down and skewed), opens the PDF fixtures, makes a searchable PDF and reads it back with pdftotext, and reads the sheet music fixture note for note.
- **kit offer**: the USB kit's model choice and "bigger model" offer, run against a stand-in for Hugging Face (redirects to download links that refuse HEAD requests), with a fake llama-server: memory tiers, FAT32, low space, no connection, missing file, N remembered, download through the redirect; the library download (newest kiwix-tools and Kiwix file from directory listings, SHA-256 checked, damaged files deleted, Simple English on FAT32), the full Wikipedia (opt-in only, free space from the server's file size), each model's vision part (fetched with it, loaded by start-lantern with --mmproj, "novision" to skip) and kiwix-serve started on port 8081; `setup-kit.ps1` too when PowerShell is installed
