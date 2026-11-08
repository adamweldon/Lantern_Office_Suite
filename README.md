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
in the Music tile turns printed music into notes, playback and MIDI -- from a
picture or a PDF, whose pages Lantern draws as they look (1.22.6) -- and
**Make a song** turns a few lines -- key, chords, a tune -- into sheet music,
sound, MIDI and WAV.
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
second try is the right one. Since v1.18.1 a circuit is also set against the
question: a pneumatic cylinder asked to return by itself at the end of its
stroke, drawn returning when its button is let go, goes back with the roller
line to add. Tables can name their columns: `=[Qty]*[Price]`.
Since v1.19.0 Chat's AI also writes **songs you can hear** (MAKE MUSIC): the
key, the chords and a melody of note names between bar lines. Lantern does
the timing (a bar's notes share it, so no bar is ever too long), the octaves,
the band, the sheet music and the sound -- Play in Chat, Save MIDI or WAV,
Open in Music. Chords alone are played in a style; a melody alone gets chords
chosen by Lantern. Since v1.20.0 the sound is **57 real instruments** -- piano,
organ, guitars, harp, basses, violin, cello, strings, trumpet, horn, tuba,
flutes, clarinet, saxophones, harmonica, accordion, bells, marimba, choir and
more -- from Adam Weldon's Generative Music Studio, each note computed the way
the instrument makes it, plus the Studio's drum kit. The AI picks them by name
(`sound violin`, `backing piano`, `bass upright`), and a song that leaves out an
instrument the question asked for goes back with the line that adds it.
Since v1.21.0 Chat **reads sheet music**: paste a picture of printed music and
Lantern reads the notes, their lengths, rests, key and time, and gives the AI
the tune's lines -- the song it makes is checked against the picture. Since
v1.21.1 the piano's left hand gives the chords, and a title printed above the
music is read too; since v1.21.2 Lantern knows famous old tunes by their first
notes, so an untitled sheet gets its real name, not a guess from the composer.
The Music tile's reader makes a song of it as well. Since v1.22.0 **an
orchestra plays it**: one line, `arrange orchestra` (or strings, a string
quartet, brass, winds), and Lantern writes every player's part from the
melody and chords -- inner voices from each chord under the tune, a real bass
line, doublings, timpani -- in an introduction (the key's chords, held), a soft pass, a full one and a
held ending; Save MIDI has a track for each player, with its level in the
mix, its seat and the dynamics, ready for a DAW (1.22.3). A question about a song
made earlier in a chat gets that song, so "fill it in with an orchestra"
just works. Since v1.22.4 the reader takes a minor key from the left hand, finds
sharps and flats before the notes (a sharp just before a chord's note, a tie
running into one, a sharp carried over the bar line by a tie), and reads
eighth rests, sixteenths whose beams run together, whole-note chords and a
piano's bar lines with ties across them. Since v1.22.5 it reads a song's sheet
(a voice over a piano) as one tune -- the voice's, and the piano's right hand
where the voice rests -- and a key signature too blurred to make out, by where
its sharps or flats sit. Since v1.22.6 a PDF of printed music -- a music
program's, with no picture in it, its notes letters of a music font -- is drawn as
it looks and read as music in Chat, the Music tile and Text Reader, its pages as
one piece, and a part for a transposing instrument (a clarinet in B♭) is given
as it sounds. Since v1.22.7 it reads the time signature as printed -- its digits
(12/8, 6/8, 3/4 ...), a C for 4/4 and a C struck through for 2/2 -- instead of
guessing it from what the bars add up to; where it read more in a bar than the
bar holds it says so once, in plain words, for you, and the AI is given the
notes alone. Since v1.22.8 it reads a page shown on a dark ground (a PDF
viewer's screenshot), and when it finds no music it can read in a picture sent
for a song, it says so -- to you and to the AI -- rather than letting a tune
from memory pass as the picture's. Since v1.22.9 “make your own song in this style” gets a
new tune (the old one under a new title goes back), and a MAKE MUSIC block you
write in Chat yourself is made as you wrote it. Since v1.22.10 the sheet music drawn under a song
is written as it plays: each note and rest a length that can be written (tied
where it must be, triplets marked), sixteenths beamed as sixteenths, and each
note given room for its head. Since v1.23.0 **Save parts** (in Chat's song card
and the Music tile) prints the sheet music for a class: the score, then each
player's part on pages of its own -- in the player's clef and key (a clarinet in
B♭ a tone up, a horn in F a fifth, a viola's alto clef), with bar numbers,
section letters, rests for the bars a player waits and the drums on a
percussion staff -- and **Save MusicXML** gives the same parts to MuseScore,
Finale, Sibelius or Dorico. An orchestra keeps the band's drums when the song's
style has them (style rock, pop, march, reggae). Since v1.23.1 a piano page with
the words printed under the right hand reads with every bar adding up: the
words' hyphens and an octave sign's dotted line are not rests, a tie's middle is
not a whole note nor its start a dot, beams inside the staff are kept, a
sixteenth rest and a dotted rest are read, two voices on a staff are one voice
each -- and a note tied to the next is held, not struck again. Since v1.24.0
**Save GMS project** saves the song for Adam Weldon's Generative Music Studio:
its 📂 Load opens it, a track for each player on the GMS instrument nearest
its own, and GMS makes the sounds.

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
| `tools/bench_pane.js` | Lantern Bench started and read from outside the page (a browser console, or a Claude chat linked to the computer): the full or quick run, or chosen questions; the rows are kept as they finish. |
| `tools/bench_headless.py` | Lantern Bench with nobody at the screen: waits for the model at the kit's address, runs the bench in a headless Chromium through `tools/bench_pane.js`, and writes the report, the failed rows as the model wrote them and a summary. |
| `.github/workflows/lantern-bench.yml` | On every push to a `lantern-x.y.z` branch: the kit's own installer and start script on a GitHub computer, then the whole bench with the 0.8B, 2B and 4B models. The score is on the job's summary page. Publishes nothing. |
| `CLAUDE.md`, `agent/` | For Claude sessions working on Lantern: the aim, the rules, how the bench is run on the laptop; the queue of work with every tile's state; a report for each session; questions for Adam. |

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
- **Pneumatic circuits** (1.18.0, `tests/pneumatic.js`): MAKE PNEUMATIC (cylinders, the valves working them, the push buttons and rollers whose air signals work those valves) drawn the ISO 1219 way -- supply and service unit, each valve's 1 on the supply line, 4 to the cap end and 2 to the rod end, 3 and 5 to exhaust, each signal to 14 or 12, two signals on one side through a shuttle or two-pressure valve, never teed -- with valves, logic valves and meter-in/meter-out added or changed and said, the lines walked as a check, what each signal does said under the drawing, the older MAKE SCHEMATIC pneumatic form piped too, and the correction turn's numbered problems and block lines (fixText); since 1.18.1 the circuit set against the question (a return at the end of the stroke, a cycle, two hands) and sent back with the line to add, from a 35B's bench reply (`tests/fixtures/bench_run_1180_35b.json`)
- **Control circuits** (1.18.0, `tests/control.js`): MAKE CONTROL ladders between L1 and L2 (or + and 0 V) -- stops in series, starts with the coil's holding contact across them, the coil at the right and its overload after it, numbered rungs and each coil's contacts listed by rung -- with the holding contact, a stop, a starter's overload, forward/reverse interlocks and a coil a start names added and said, an e-stop, fuse or shared stop in L1 ahead of every rung, the wires walked (no short, every coil between the rails, the holding contact across its start), and Draw's ladder symbols
- **Electronics** (1.18.0, `tests/electronics.js`): MAKE ELECTRONICS rails and branches with an LED's resistor, a transistor's base resistor, the diode across a coil a transistor switches, a transistor for a load too big for a pin, pull-downs, pull-ups and sensor dividers added, sized and said, inputs fed from the board's own 3.3 or 5 V; and the part / wire schematics checked: an LED's missing resistor added, one too small, a short, an ammeter across a part or a voltmeter in series sent back
- **Songs** (1.19.0, `tests/music.js`): keys, notes and chords (numerals, slash chords, spelling the key's way), the lines of a song as models write them (bold, bullets, no bar lines, B-A-G-E, x2, Verse:/Chorus: parts), a bar's notes sharing it and - holds, octaves where the tune leads (and a written octave never pulling the notes before it), the key found and chords chosen (two in a bar where the tune needs them), what cannot be right sent back with the line to write (a word that is not a note or chord, a note far from the tune, a long note a half step from its chord, a key, a waltz or a number of bars the question asked for), the styles' band parts, the MIDI file, the lead sheet's layout, the Make a song card and its examples, Chat (the correction turn, Play, Save MIDI, Open in Music) and the bench songs; 1.20.0: every one of the 57 instruments (58 with 1.22.0's timpani) plays a note (finite, not silent, not too loud in the mix), their names in a song (in the order written, the longer names first) and in a question (not a bass line, a lead or the keys), notes made once and kept, sound/backing/bass lines and each style's own instruments, a melody moved into its instrument's range or sent back when wider, the MIDI programs, and the question's instruments checked; `tests/browser/music_e2e.py` plays a song in Chromium (the instruments prepared in background workers, the moving line, Stop), checks a worker's note against the page's own, saves real MIDI and WAV files (the waltz for violin and piano among them) and opens it in the Music tile; the 35B's one miss on 1.24.6 replayed (`tests/fixtures/bench_run_1246_35b.json`): the bars a question asks for said under the guide's four-bar example, and a melody that stops short told how its last bar must end
- **Sheet music read as songs** (1.21.0, `tests/browser/sheet_read_e2e.py`, fixtures in `tests/fixtures/sheets`): twenty engraved sheets at 5.5 to 11 pixels a space read note for note (1.21.1: the left hand's chords, a printed title; 1.21.2: three at screenshot sizes; 1.22.1: a web page's banner across the music; 1.22.4: a piece in E minor with sharpened left-hand chords, ties over the bar line, beamed sixteenths and eighth rests; 1.22.5: a song with a voice over a piano; 1.22.6: a PDF of a clarinet part, drawn, read as it sounds and given in Chat; 1.22.7: every sheet's time read from its printed digits, a 12/8 piano piece and a 6/8 tune in Leland among them, and the AI given the notes without Lantern's doubts; 1.22.8: a page on a PDF viewer's dark ground, and a picture with no music said to be one) (lengths, dots, eighths, rests, key, time, accidentals), their lines played back as read, Chat reading a pasted picture with a model that sees and one that does not, the 35B's tune from memory sent back with the lines, and the Music tile's Make a song from it; `tests/music.js` checks the lines written, the check against the reading, the repeated-chord hint and (1.21.2) the tunes Lantern knows by their opening and the title check
- **Orchestras** (1.22.0, `tests/music.js`, `tests/browser/sheet_read_e2e.py`): arrange orchestra, strings, string quartet, brass and winds -- the inner voices notes of each chord, below the tune and above the bass, no parallel fifths or octaves, every note in its instrument's range, the timpani on the key note and its fifth, a MIDI track for each player; the form line, parts of the AI's own (checked against the chords, the 35B's "Violins II:" way too), a question for an orchestra checked; Chat: Adam's questions after the song replayed (the song so far given to the AI, its NEED and its "Lantern cannot" sent back with the block to write, a tune from memory sent back for the one made before)
- **Health after its audit** (1.24.4, `tests/health.js`): the tile's four groups with emergencies first and all 42 topics, the ORS mixer (a litre at once; under a litre the warning; a cupful no numbers), the figures of the lessons as sourced (and advice the 2025 guidelines dropped staying out), no medicine or dose in any health lesson, the breath and pulse counter (WHO's fast-breathing limits by age, taps over a shortened minute, a typed count), bleach for water by the CDC's table, Print on every lesson, 35 health needs said the way people say them reaching the right lesson whole and 14 near-misses reaching none, a list never cut when a lesson is given to the AI, Chat end to end with a scripted model, the bench's six health questions, and each new module dropped; `tests/browser/health_e2e.py` does it in Chromium, with a lesson printed to a real PDF
- **Food after its audit** (1.24.5, `tests/food.js`): the tile's three groups and ten topics, the preserving table (no oil covering; what each way needs to be safe; drying meat its own row), the cooking table's temperatures, the daily-needs sum (no number for a child), 67 figures and instructions of the lessons as read on the CDC's and the US National Center for Home Food Preservation's pages, what the check found wrong gone, the help guide, the lesson Chat gives for a food how-to (a procedure whole), and the bench's three food conversations with what their checks catch.
- **The lesson Chat reads by itself** (1.24.5, `tests/lesson_search.js`): a lesson that answers is found though its title lacks the word (an inner tube, purifying water, north without a compass, scurvy), no lesson is given where none answers (a well is not *Deciding well*), lessons of another tile that share one word stay out, what a hit says (cover by weight), `LESSON_WORDS` and `Lantern.mathLessons.about`, and each of those without `LESSON_WORDS`.
- **No MAKE block where a thing was asked for** (1.24.5, `tests/no_block.js`, fixture `tests/fixtures/bench_run_1244_35b.json`): the first line Lantern asks for is the one each MAKE question's model answer starts with (30 questions from 1.24.7) and no other question is asked for a block; what is left alone (a question that only opens like a request, a NEED, a short question back, a program in the reply, a reply after the block was made); the 35B's row replayed through the bench's path and through Chat; once only; without the module.
- **The small models** (1.24.5, `tests/small_models.js`, fixtures `tests/fixtures/bench_run_1244_2b.json` and `bench_run_1244_08b.json`): every failed row of the 2B and the 0.8B on 1.24.4, replayed -- a NEED for a number the question gives answered by Lantern (all 11 of the 2B's, 22 of the 0.8B's 24) and a NEED for what only the person knows left alone; the instructions (the question's numbers listed, `NEED: <what is missing>`); the short prompt for a model under 3 billion parameters, in Assist and in Chat; replies read as they were meant (`= MAKE`, `=TRACK:`, `ANS: 120*80/10000`, `ANSWER: CONVERT(...)`, one line fifty times) and thirteen kinds of reply left as they are; a request the server refuses as too long sent once more, shorter; the lesson's own sentences given without a citation, cited by Lantern; RELKE at everyday speeds; and all of it without the modules.
- **What a question is given** (1.24.6, `tests/tools_fit.js`, fixture `tests/fixtures/bench_run_1244_35b_sums.json`): the MAKE tools offered by the sense of the question's words (a ladder to climb, table salt, a sheet of plywood get none); one recipe card that fits, and none for a sum no card is for; functions picked by name; the unit a question asks for said with it and checked in the sum; a decline sent back with the recipe; the short instructions by kind; and the 35B's 45 right sums of 1.24.4 replayed with nothing questioned
- **The 4B's rows on 1.24.4, replayed** (1.24.6, `tests/bench_1244_4b.js`, fixture `tests/fixtures/bench_run_1244_4b.json`): a colour on a line of its own on a wheel, a deck written as several blocks, `[n]` as the instructions spell it, `LESSON:` as a heading and for a thing to make, a request too long for the model, a sunset under the blue of day; a roof drawn as a square left failing
- **The small models' rows on 1.24.5, replayed** (1.24.6, `tests/bench_1245_small.js`, fixtures `tests/fixtures/bench_run_1245_2b.json`, `_4b.json` and `_08b.json`): the 2B's eleven declines sent back with the recipe or the numbers, and its twenty failed sums passing with a right second reply (scripted); a change of unit named with the line; a NEED for Earth's radius answered with the recipe, in the unit asked for; the Hohmann card for two heights, and both heights and HOHMANN-for-a-time sent back with one line; a wheel's parts written out; a circuit's total worked out and added, and a copied sum sent back; a pin with two jobs, a pin nobody declared; the tested example for "without delay" and a sketch that waits in one; an output given a value twice; Chat reading the lesson for "what could be wrong" and showing it when the answer does not use it; a puzzle of several steps given its tool alone, and asked for its block when the answer has none; the 4B's `LESSON:` headings; what the 0.8B is shown no longer holding the words it copied, a sum under a NEED read, a NEED with its own answer under it sent the recipe, a sum that differs from the recipe Lantern can fill itself, amp-hours the question asks for; and what is left failing
- **A landscape the way the eye sees it** (1.24.7, `tests/scene.js`, `tests/browser/scene_e2e.py`, fixtures `tests/fixtures/scene_review_1247.json` and `scene_review2_1247.json`): Adam's two pictures with the 35B on 1.24.6, replayed as the model wrote them -- mountains with their bases in the sky stood on the horizon and drawn behind the hill, the sun put behind the land, three upright lines drawn as a road that narrows to the horizon, a shore nobody drew sent back with the line to add; each rule on its own (a strip, a river, a railway's sleepers, a setting sun over the sea, the moon, a needle peak, a snow cap and the sun's rays that go with what they belong to, a background written twice); the 216 right pictures two independent reviewers drew to break the first drafts, every one left exactly as written (a lamp, a balloon, a sunflower, an umbrella, a sail, a kite, the tiers of a pine, a bridge's piers, a gate, a horse's legs, a sky in two blues, a far beach, a hang glider, a lion at sunset), and what Lantern does with their 57 wrong ones; only a plain landscape asked in plain words, with one sky and a ground Lantern can read, is arranged; the guide and its landscape example; rule 11. In Chromium, with a stand-in model that sees: the PNG the model is shown, checked by its colours, and exactly 720 by 432
- **The fifth to eighth reviews of 1.24.7, replayed** (`tests/review5_1247.js` to `tests/review8_1247.js`, fixtures `tests/fixtures/review5_1247.json` to `review8_1247.json`; the seventh and eighth: 361 replies, 96 recipe questions, 46 pictures; where 1.24.6 sent a reply back, no wrong number is handed over; an arrow after a sum or a number after a second = goes back to the model as on 1.24.6): 191 replies (a number the model typed under its sum stands, whatever its length; a line using ANS where no line before it could run cannot run; a yes or no asked after a colon is a test; the newest question in a conversation is the question; an ANSWER line after a MAKE TABLE is the answer), 79 recipe questions (a recipe is held to only for a question made of its own words: not an axle's share, ultrasound, one orbit's length in km, drops of bleach to clean a tank), 49 pictures (the moon is left where it was drawn; a snow cap, a pale rock, a cloud on a peak at night stay as drawn), each with what 1.24.6 gave
- **The third and fourth reviews of 1.24.7, replayed** (`tests/review3_1247.js`, `tests/review4_1247.js`, fixtures `tests/fixtures/scene_review3_1247.json`, `read_review3_1247.json`, `review4_1247.json`): 371 more right pictures, every one left as written but one that looks the same (a band written twice in a row drawn once); 69 wrong ones as Lantern now draws them, each looked at (the sun just behind the first thing it was drawn over, a mountain just before the ground, what lies on either going with it, a star left behind the moon); 212 replies (a step done in the head stays; a test the question writes is the model's test; a formula is worked out unless the question names it as the thing asked); 130 recipe questions (a recipe is held to only for its own plain question: not drops "per litre", a half-wave dipole, a radio signal's time, an escape velocity in km/h)
- **The small models' rows on 1.24.6, replayed** (1.24.7, `tests/bench_1246_small.js`, fixtures `tests/fixtures/bench_run_1246_2b.json`, `_08b.json` and `_4b.json`): `=VOLTS(0.02,470) -> volts`, `= 65*35 = 2275`, `=({2000}/{15})/60` and a number typed on a `=` line after the sum, each read as the sum; and what is left as written, from two reviews: a comparison where the question asks whether something is so, an arrow in quotes, `=2000/ANS`, a number in the middle of a chain, a whole number that is the sum rounded (12 jerrycans), a number the answer names, an answer key's lines inside a MAKE DOC, a formula the question asks for; the short prompt with nothing after a recipe's line; a dose of bleach held to its recipe only for its own plain question; the 4B's wheel of bare formulas and its sketch with delay() in a comment
- **The small models' rows and drawings on 1.24.7, replayed** (1.24.8, `tests/bench_1247.js`, fixtures `tests/fixtures/bench_run_1247_08b.json`, `_2b.json` and `_4b.json`, with every drawing the run made, and `review1_1248_hidden.json` to `review3_1248_hidden.json`): no arrow after a sum from the 2B; the landscape example copied whole, and the prompt's example since 1.24.8 not a bench question; a shape under shapes of its own look, or written again further down, not asked about as hidden (the 4B's house), anything of another colour over it or a line, words or an outline caught across it asked about as before (a bull's-eye drawn inside out, a pepperoni under the cheese, a clock's hands between two faces); an oval read as the box it is drawn in; a tri with no area covering nothing; the three reviews' 386 drawings, none of their useful questions lost; 60 large outlined rects read quickly; the tank of water's send-back and the retyped letters, as they are
- **The part of an article that answers** (1.24.9, `tests/library_sections.js`, `tests/library_review_1248.js`, fixtures `tests/fixtures/kiwix/sections_1248.json` and `library_review1_1248.json` to `_5_`): a repair guide's steps read without its readers' comments, each line with its step; a step asked for by number; a travel guide's own section for getting around, eating, sleeping, crime and sights; the sentences that say what a thing is made of; the five reviews' 261 pages and 2,704 questions at both lengths, no answer of 1.24.8 lost but those only in a reader's comment
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
- **AI isolation**: removes each of the 169 AI, music, instrument, sheet-reading, library, action, Text Reader, PDF, sheet music, suite-catalog, make, READ, Code Lab, places, codes, sources and document-decline modules in turn and opens Chat, Text Reader and Music (rule 11)

`tests/browser/code_lab_e2e.py` (not part of `npm test`; needs Playwright and Chromium) drives Code Lab and Chat in a real browser: Check on a broken example, ladder drawn and turned into Structured Text, JavaScript in a real Web Worker and an endless loop stopped, and MAKE CODE from a stand-in model checked, corrected once, shown once and opened in Code Lab.

`tests/browser/health_e2e.py` (not part of `npm test`; needs Playwright and Chromium) uses the Health tile in a real browser: all 42 topics, the ORS mixer, bleach for water, the breath and pulse counter with real taps, a lesson printed to a real PDF over several pages with nothing of the tile behind it, a phone's width, and Chat with a stand-in model given the Choking lesson whole for "My son is choking".

`tests/browser/food_e2e.py` (not part of `npm test`; needs Playwright and Chromium) uses the Food tile in a real browser -- all ten topics, the two tables, the daily-needs sum typed into (an adult, then a baby), the help guide, a phone's width -- and Chat with a stand-in 2B: the short instructions, the Fermenting lesson given with every step, a formula written after `ANSWER:` computed and said, a NEED for the question's own numbers answered by Lantern, and a request refused as too long sent again shorter.

`tests/browser/bench_headless_e2e.py` (not part of `npm test`; needs Playwright and Chromium) runs `tools/bench_headless.py` against a stand-in model server that serves `site/index.html` the way the kit does: chosen questions and the quick run, the report and the failed rows it writes, a run cut off for time, and an address where nothing answers.

`tests/browser/bench_run9_e2e.py` (not part of `npm test`; needs Playwright and Chromium) runs the whole Lantern Bench in a real browser against a stand-in llama-server that sees images and answers with bench run 9's replies: the puzzle rows labelled, the cups block corrected, the sun-and-sea drawing sent back and then shown to the model as a real PNG, the queue, the dozen.

`tests/browser/text_reader_e2e.py` (not part of `npm test`; needs Playwright and Chromium) reads the fixture pages in a real browser with an error limit per page (two of them screenshots turned upside down and skewed), opens the PDF fixtures, makes a searchable PDF and reads it back with pdftotext, draws pages that have no picture (TrueType, Type 1, CFF, Type 3 and standard fonts; 1.22.6, made by `tests/fixtures/text_reader/make_pdfs.py`) and reads their words back, and reads the sheet music fixture note for note.
- **kit offer**: the USB kit's model choice and "bigger model" offer, run against a stand-in for Hugging Face (redirects to download links that refuse HEAD requests), with a fake llama-server: memory tiers, FAT32, low space, no connection, missing file, N remembered, download through the redirect; the library download (newest kiwix-tools and Kiwix file from directory listings, SHA-256 checked, damaged files deleted, Simple English on FAT32), the full Wikipedia (opt-in only, free space from the server's file size), each model's vision part (fetched with it, loaded by start-lantern with --mmproj, "novision" to skip) and kiwix-serve started on port 8081; `setup-kit.ps1` too when PowerShell is installed
