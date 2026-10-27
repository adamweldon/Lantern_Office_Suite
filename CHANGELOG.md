# Changelog

## 1.13.4 — Bench run 12: retyped lines run again, a rung in plain text, lamps drawn as resistors, Show what was made (2026-10-27)

Adam's run 12 (Qwen3.5-35B-A3B, sees images, Lantern 1.13.3, with the
library): **113 of 116 (97%)**. Core 32/32, fresh 5/5, hard 10/10, library
20/20, made 19/21, conversations 18/18, puzzles 9/10; without the tools 3/6
(not scored). Run 11's misses passed: the fuel (questioned with the sum,
then 28), the two-coin cups, the hens, the P1AM and stepper sketches. Adam
asked about the three that failed, and could not see the circuit or the
ladder to check them:

- **Refrigerator.** Lantern's `=REVERSE("refrigerator")` gave rotaregirfer,
  but the AI's next line typed `REMOVE("rortegifer","r")` -- its own copy with
  two letters dropped -- instead of ANS1, the third line copied that line's
  result, and the sentence put `{ANS2}` (a word) where the count goes: "which
  has otegife letters". Lantern's check missed it (rortegifer is four edits
  from rotaregirfer). Now:
  - a line that types out an earlier result with mostly the same letters
    (`sameLetters`) is questioned, as near spellings were;
  - a `{placeholder}` holding a word right before "letters", "words",
    "characters" ... is questioned, naming the line that counts;
  - when the AI's one correction still types results out, Lantern runs its
    lines again with its own results in place (`rechain`: rortegifer → ANS1,
    otegife → ANS2), puts them into the sentence ("rotaregirfer", "otaegife",
    {ANS2} → {ANS3}: 8), and the notes under the answer say both. The row
    records `rechained` and `repaired`.
  - the nearest spelling wins when a word is close to two results.
- **Ladder: one correct rung in plain text, "no MAKE block".**
  `[XIC(Start) ,XIC(Motor) ]XIC(Stop)XIC(Overload)OTE(Motor);` -- right this
  time, with the normally closed Stop on XIC -- but written in the reply with
  no MAKE block and no fence. Chat's checks for code in a reply now find
  ladder rungs on their own lines (and a one-rung fenced block), and the
  bench's MAKE path grades code in the reply the way Chat checks it, when the
  question asks for a program (`Lantern.aiAct.fromReply`; the row records
  `codeInReply`). A rung with XIO on the normally closed Stop is questioned
  there too.
- **Two lamps drawn as resistors.** `part R1 resistor "Lamp 1"`: two resistor
  symbols labelled as lamps, which the model, shown the picture, kept. A part
  whose label names another kind Lantern draws (lamp, motor, switch, diode
  ...) goes back once: "a lamp is a part of its own -- write part R1 lamp".
  Labels that name the part's own kind ("LED resistor") or a battery on a
  source are left alone.
- **A questioned schematic is drawn anyway**, with what Lantern questions under
  it, instead of "nothing was made" -- so the person sees what Lantern means.
- **Show, in the bench.** Each result has a Show button: why it failed, what
  the AI replied (its first reply too, when it was asked again), the puzzle
  blocks, and for a thing it made, the thing itself -- the circuit, the
  drawing, the program with its ladder picture -- rebuilt from the saved reply
  exactly as Lantern built it. **Open saved results…** opens a run saved as
  JSON the same way, so a run from another computer can be looked through.

Tested:
- New `tests/bench_run12.js` (21 checks) with the run's replies
  (`tests/fixtures/bench_run12_replies.json`): the letters questioned, run
  again and passed in Chat with the notes, and what is left alone; the rung in
  plain text found, checked and passed through the bench's MAKE path, prose
  that only mentions XIC, a question that asks for no program; the lamps
  questioned, corrected and passed, and labels left alone; Show on the lamps
  and ladder rows.
- `tests/ai_layer.js`: Show and Hide on the bench rows, and Open saved results.
- In Chromium: run 12's JSON opened with Open saved results, Show on the
  lamps, ladder and letters rows (the circuit and the ladder picture drawn).
- All suites pass.

## 1.13.3 — Bench run 11: results put in, two places, the lesson asked about, EXAMPLE as code, fuel the right way round (2026-10-27)

Adam's run 11 (Qwen3.5-35B-A3B, sees images, Lantern 1.13.2): **87 of 94
(93%)**. Core 32/32, fresh 5/5, hard 9/10, made 18/21, conversations 15/16,
puzzles 8/10; the same puzzles without the tools 3/6 (not scored). The
library was not reached this run, so its 20 fact questions and two library
conversations were not asked (`"library": null` in the results). Fixed since
runs 9 and 10, with the model's replies: 3 dozen eggs, the house, the sun and
the sea, the parallel resistors, the oil-change steps, the queue, the
warranty answer and reading another page. Seven of the rest were Lantern's to
fix:

- **Refrigerator: the corrected sentence still typed its own results.** The
  AI's lines were right (`=REVERSE("refrigerator")`, `=REMOVE(ANS1,"r")`,
  `=LEN(ANS2)`: otaegife, 8) but its sentence said "otageifer" and 7. Lantern
  questioned the 7 only: two swapped letters and an extra r were three
  edits, over the limit. A swap now counts as one slip, so the spelling is
  questioned too. And when the one correction comes back still typing
  Lantern's results its own way (the run sent the same sentence back),
  Lantern puts its results into the sentence -- only a word close to exactly
  one worked-out word, and a number only when exactly one result is missing
  and exactly one number matches nothing -- and the note under the answer
  says what it changed ("otageifer" → "otaegife", "7" → "8"). The bench row
  records it (`repaired`).
- **Two-coin cups: "two places to its left" written as one place.** The block
  said `swap holder of gold and left of holder of gold` and ran cleanly to a
  wrong order. A step that moves two or more places now needs a line with
  that number (`2 left of`, `shift right 2`); otherwise the block goes back
  once (`Lantern.aiPuzzleCheck.distances`).
- **Hens: LESSON: HEN HEALTH read the Health tile's guide on people.** The
  AI's two words matched the Health guide's title strongly and Chickens &
  eggs only by "hen" in its text, so only the Health guide was sent. The
  person's question now counts too (0.6 of how well each lesson matches it),
  so Chickens & eggs comes first; a lesson asked for by its exact title still
  leads.
- **Three programs had "no MAKE block".** The AI wrote `EXAMPLE: <title>`, then
  `language arduino`, the code and END -- the way Lantern had shown it a
  tested example (`EXAMPLE 1: ... / language arduino / code`). Now:
  - an `EXAMPLE:` line with code right under it (a language line, or a line
    that can only be code) is a MAKE CODE block, titled from the example's
    name; `EXAMPLE:` on its own is still Chat's command;
  - the example is shown as "Tested example 1: ..." between `<<<` and `>>>`,
    with no line to copy as a reply;
  - the bench's MAKE path runs Chat's commands (EXAMPLE:, LESSON: ...) up to
    twice when a reply has no MAKE block, as Chat does; the row records them.
  With that, the P1AM seal-in from the run passes, and so does the AccelStepper
  sketch (its end filled in: the run saved only its first 1500 characters).
- **Ladder: XIO(Stop) for a normally closed Stop.** Lantern's own prompt line
  showed `[XIC(Start) ,XIC(Motor) ]XIO(Stop)OTE(Motor);`, and the AI wrote it
  for "a normally closed Stop pushbutton": the input is on until the button
  is pressed, so XIO never lets the motor run. The prompt line now says
  `XIC(Stop)` and why, and a ladder block that examines a device the question
  calls normally closed (Stop, overload, limit, guard, float, pressure) with
  XIO goes back once (`Lantern.aiCode.ncProblems`).
- **Fuel for a trip, the other way round.** `=150*10/420` (3.57 litres for a
  420 km trip on a car that does 150 km on 10). New `AI_PROPORTION_CHECK`:
  for distance and fuel (km or miles, litres or gallons, one unit each), the
  distance said with the fuel is the known pair and the other is the trip;
  lines that give something else go back once with the sum ("420 km needs
  420 × 10 ÷ 150 = 28 litres"). Also "per 100 km" and "how far on 25 litres".
- **The results keep whole programs** (up to 6000 characters): run 11's
  stepper sketch was cut at 1500, mid-line.

Not changed: the die and the four houses failed only without the tools.

Tested:
- New `tests/bench_run11.js` (30 checks) replays the run's replies
  (`tests/fixtures/bench_run11_replies.json`; the stepper sketch's last four
  lines filled in, as the run saved 1500 characters): the letters repaired in
  Chat and passed, with the note; what repair leaves alone; the cups block
  questioned, corrected and passed; LESSON: HEN HEALTH reading Chickens & eggs
  and passing, while exact titles and health questions still lead; the three
  EXAMPLE replies built as MAKE CODE, two passing and the ladder questioned,
  corrected and passing through the bench's MAKE path; EXAMPLE: alone run as
  a command there; the example shown between `<<<` and `>>>`; the prompt's
  XIC(Stop); fuel questioned with the sum and passing in Assist, and the
  other ways of asking, and what is left alone.
- `tests/code_lab.js`: the example's new layout (changed with intent).
- `tests/ai_isolation.js`: `AI_PROPORTION_CHECK` added (115 modules).
- All suites pass.

## 1.13.2 — One Lantern folder: install, update and the bench fixes together (2026-10-27)

Two pieces of work were each built on 1.13.0 and each called 1.13.1, and
neither reached GitHub: the double-click installer (1.13.1 (install), below)
and the bench run 9 fixes (1.13.1 (bench), below). 1.13.2 is both, plus a
single way to get and update Lantern.

**Why bench run 10 was 1.12.9 again.** Adam's stick holds
`Lantern_USB_Kit_1.9.1\Lantern\` with `kit\`, `site\` and the single file.
The kit shows Lantern from a `site` folder, never from
`Lantern_Office_Suite.html`, so replacing that file changed nothing. And
`start-lantern` looked in `kit\site` before the Lantern folder's `site`, so even
a new `site` laid over the folder could lose to an older copy in the kit (the
installer also downloaded into `kit\site`). Run 10's 115 replies were word for
word run 9's: the 35B repeats itself exactly at temperature 0, so the next
run's changes will be Lantern's.

- **Lantern.zip: one folder, `Lantern`.** `tools/make_lantern_zip.py` packs the
  launchers, `Lantern_Office_Suite.html`, `README.txt` (new, plain text: what
  each file is, first time, every time, updating), `CHANGELOG.md`, `site/`,
  `kit/` and `docs/`. Never `kit/engine`, `kit/models`, `kit/library` (what
  setup downloads) or a `kit/site` copy, and none of the repository's working
  parts (`src/`, `tests/`, `tools/`, package files). Extracting it into the
  folder that holds a Lantern folder updates it: Windows' Extract All merges
  and asks before replacing; the models stay. It keeps the "may run" mark for
  Mac and Linux and the Windows line endings, and refuses to pack when
  `package.json`, `site/index.html`, `site/lantern-sw.js` and the single file
  disagree about the version.
- **Every push to main publishes it.** `.github/workflows/lantern-zip.yml`
  builds Lantern.zip and puts it on the release `v<version>`, marked Latest,
  with the newest changelog entry as notes, so
  `releases/latest/download/Lantern.zip` is always the newest Lantern. A push
  with the same version replaces that release's zip.
- **Lantern lives in one place: `Lantern/site`.** `start-lantern` (Windows and
  Mac/Linux) and setup look in the Lantern folder's `site` first and use
  `kit/site` only for a kit on its own; when both are there the window says
  `kit/site` is a second copy and is not used. When Lantern is missing, or for
  `setup-kit lantern`, the download goes into the Lantern folder (`site/` and
  `Lantern_Office_Suite.html`) whenever the kit sits in one.
- **The version comes from Lantern's own page.** Setup's check and the Start
  window read `version: "…"` from `site/index.html`, so a newer Lantern laid
  over an older one can never report the old number from a leftover
  `lantern-version.txt`. The Start window prints the version and the folder it
  serves, and how to update.
- **Updating on a Mac or a Raspberry Pi**, in `README.txt` and
  `kit/README.txt`: a Mac's Finder replaces whole folders (models and all)
  instead of merging, so on a Mac `ditto -x -k Lantern.zip "<folder>"`; on the
  Pi, tick "Overwrite existing files" when extracting.
- Lantern 1.13.2 everywhere: the page, the worker's cache, the single file,
  `package.json`.

Tested:
- New `tests/lantern_zip.py`: one top folder; what is in and what never is;
  the run marks and line endings; the same files from a plain folder as from
  git; refusing mismatched versions; and the stick itself:
  `Lantern_USB_Kit_1.9.1/Lantern` with a 1.12.9 `site`, an old `kit/site`, the
  35B model, the engine and the library, with Lantern.zip extracted over it:
  the new Lantern is in place, the model, engine, library and the stick's own
  Pilot Guide are untouched, and both start scripts now show the folder's
  `site`.
- `tests/kit_offer.py`: a Lantern folder with both copies (check and Start use
  the folder's, by its page's version, and say `kit/site` is not used); with
  none (setup puts Lantern into the folder, not the kit); an update for a kit
  inside a Lantern folder; the same for PowerShell (run here with pwsh 7.4).
- `tests/kit_window.py` run with Tk on Xvfb.
- All suites pass.


## 1.13.1 (install) — Install by double-click; the engine built on the computer when it must be (2026-10-25)

Adam asked for setup to be easy: download the zip from GitHub, extract it,
double-click one file, and everything else happens, with popups saying
clearly what to do. Testing on a Raspberry Pi 500 showed why it was not:
double-clicking `setup-kit.sh` opened it in Geany, and choosing the terminal
under Open With only opened a terminal with nothing to run.

- **Install Lantern / Start Lantern at the top of the folder**, one pair per
  system: `(Windows).bat`, `(Mac).command`, `(Linux).desktop`. A desktop
  entry runs on Raspberry Pi OS whether or not the zip kept the files'
  "may run" mark (its file manager asks Execute once); the command finds the
  folder from the entry's own place (libfm passes the folder, GLib the file,
  both tested, with a space in the path too).
- **Lantern's own window on Linux and the Raspberry Pi** (`kit/lantern-kit.py`,
  Python 3 with Tk, which Raspberry Pi OS has): what will be downloaded and
  the room for it; then the steps, the file being fetched, size, speed and
  time left; the questions as popups (Download it / Not now / No, don't ask
  again; Not now is the default for the full Wikipedia); a failure page that
  says why (no internet, drive full, FAT32 stick) with Try again; at the end
  a menu entry and a desktop icon, and Start Lantern now. Start Lantern is a
  window too: the model, loading then ready, Open Lantern, Share with phones
  (restarts on the Wi-Fi address and shows it), Stop; closing it stops the AI.
  Without Tk it opens a terminal, with popups when zenity or kdialog is there.
- The window drives the same scripts as the terminal (`LANTERN_UI=1`: steps,
  files and questions as `@@` lines, answers on stdin), so what is fetched and
  asked is decided in one place. `LANTERN_POPUP=zenity|kdialog|osascript` asks
  the same questions in dialogs from a terminal (the Mac installer uses it);
  `setup-kit.ps1` asks in message boxes with `LANTERN_POPUP=1` (the Windows
  installer sets it) and falls back to the window when none can show.
- **The engine must start here.** Setup now runs the engine once
  (`--version`). The ready-made Linux arm64 engine for b11435 needs GLIBC 2.38
  and GCC 13's libstdc++, so it cannot start on Raspberry Pi OS Bookworm
  (glibc 2.36) or Ubuntu 22.04. Setup says so and offers to **build the engine
  on the computer**: the llama.cpp source of the same build, one static
  `llama-server` (no libraries beside it), cmake fetched with pip when it is
  missing; about 5 minutes on two laptop cores, 10 to 20 on a Raspberry Pi 5.
  Also `setup-kit.sh build-engine`, and `check` says whether the engine starts.
- The engine's library symlinks are copied as plain files: an exFAT stick
  cannot hold symlinks, so setup on a stick stopped there on Linux.
- **A download that breaks off is no longer kept as whole.** `set -e` does not
  hold inside functions called from `&&`, so a model cut off part way was
  renamed into place and the GGUF header check passed. Now the download is
  tried again twice from where it stopped, then setup stops with the `.part`
  kept, and the next run carries on (tested against a server that drops the
  line a third of the way in). Extras that do not finish are said on the
  window's last page.
- **A stick shared by computers with different CPUs** (a laptop and a Pi)
  keeps one engine each: when `engine/linux` holds another CPU's programs,
  this computer's go in `engine/linux-<cpu>`, and start-lantern uses them.
  Before, setup said "have engine" and the build would have replaced the
  other computer's engine.
- Stopping Lantern's window never stops a download that runs in the
  background (they run in a session of their own), start-lantern waits for its
  servers on the way out (so Share with phones restarts cleanly) and stops at
  once when the engine dies at the start; on the Start window a question
  answers Not now by itself after a minute, so Lantern still starts.
- **Lantern itself comes with the install.** Tested on a Windows laptop, the
  installer fetched the models and Wikipedia, but Lantern was missing: the kit
  had always expected the repository's `site/` beside it (or a copy made by
  hand), and a `kit` folder on its own had none. Setup now looks for Lantern
  first (`kit/site`, then the repository's `site/`); when neither is there it
  downloads the main branch from GitHub (about 10 MB), checks it holds Lantern
  and puts `site/` into the kit, with `lantern-version.txt`. `setup-kit lantern`
  fetches the newest (an update), keeping the one in use until the new one is
  in place. Start says plainly when Lantern is missing instead of starting the
  engine with nothing to serve; `check` names Lantern's version and place.
  Shell and PowerShell both; the Linux window shows it as the first step.
- `setup-kit.sh info` gives the window the facts as key=value lines.
- Tests: `kit_offer.py` adds the window's questions and answers, the popups
  (a stand-in zenity), an engine that cannot start, building it (a stand-in
  source tree) and the symlinks; it also runs on a Raspberry Pi now (arm64
  engine stand-in). New `kit_window.py` runs the window on Xvfb: a whole
  install, installed again, start/share/stop, already running, offline, start
  before install, and both launchers opened as libfm and GLib open them.

## 1.13.1 (bench) — Bench run 9: what Lantern could fix (2026-10-26)

Adam's run 9 (Qwen3.5-35B-A3B, sees images, English Wikipedia, 1.12.9):
**98 of 109 (90%)**. Core 32/32, fresh 4/5, hard 9/10, library 20/20, made
10/14, conversations 16/18, puzzles 7/10. The six puzzles asked again with
the puzzle tools switched off ("alone", not scored): 3/6.

**The questions asked twice** were those six puzzles: once with Lantern's
puzzle tools, once without, to show what the tools add. The results table
did not say which row was which. In two pairs the result was backwards: the
two-coin cups failed with the tools and passed without them, and the
refrigerator letters failed both ways. Both were Lantern-side, as were
most of the other misses.

- **The results say which is which.** Each puzzle row is marked "with
  Lantern's puzzle tools" or "the same puzzle with Lantern's puzzle tools
  switched off — not scored".
- **The bench keeps the puzzle blocks.** Each row records every TRACK, TURN or
  SOLVE block the AI wrote, line by line, with what Lantern made of it. This
  run could not show the cups block; the next will.
- **Two-coin cups: a described place written as a name.** Every block that
  gives the run's wrong answer (Yellow, Green, Red, White, Blue, silver under
  Red) puts the silver coin under Red in step 4. The question says "the cup
  directly to the left of the cup holding the gold coin", which is Blue by
  then. The AI worked out the cup itself, against its instructions, and
  TRACK tracked it faithfully. Lantern now compares the block with the
  question (`AI_PUZZLE_CHECK`). A step line that names a cup the numbered
  steps never name goes back once, with the reason. Solvers can add such
  checks: `check(block, question, result)`.
- **The queue: "directly behind".** TRACK read left of, right of, 2 left of
  and holder of, but not behind, in front of, ahead of, before or after. It
  rejected "swap holder of ball and person directly behind holder of ball"
  twice, and the block itself was left as the answer. Those words now work:
  in a queue, front is first. A corrected block that fails too now gets one
  more turn: "work the puzzle out yourself, step by step".
- **Refrigerator: results retyped, and restated.** With the tools, the AI
  wrote `=REMOVE("rotarigerfer","r")`, retyping line 1's "rotaregirfer"
  with its own slip instead of ANS. Without them, it used ANS, then wrote
  "otaeigef ... 8 letters" in its sentence. Lantern only noted the mismatch.
  Now (`AI_RESULT_CHECKS`), once:
  - a = line that types out an earlier result with mistakes is questioned
    ("write ANS1 instead of typing a result out");
  - an ANSWER with no {result} that spells a worked-out word another way, or
    states a number none of the lines gave, is questioned.

  The ANSWER can name any line's result: `{ANS1}`, `{ANS2}` ... (`{result}`
  is still the last line), a word or a number. Chat's instructions say so.
- **READ at the end of an explanation.** The AI wrote two sentences, then
  `READ: page 5`, and Lantern ignored it. A command line counted only when
  it opened the reply or the reply was under 240 characters. That was
  1.11.0's rule for LESSON and MODULES, copied into READ and EXAMPLE. A
  command line that ends the reply now counts too (all four commands). One
  in the middle of a long answer still does not.
- **3 dozen eggs: Lantern answers the NEED.** The AI asked "NEED: How many
  eggs are in 3 dozen?" (`AI_NEED_ANSWERS`, `Lantern.aiNeedAnswer`).
  - Counting words are answered when they are asked about: dozen, score,
    gross, pair, ream, decade, century, fortnight.
  - So is "how many <unit> in a <unit>" that CONVERT knows.
  - Assist and Chat send the fact back for one more turn.
  - What only the person knows ("how many goats do you have") is still asked.
- **Fuel for a trip.** The AI worked out 15 km/L, then 28 L, then multiplied
  by the 10 litres again (280). New recipe card `trip-fuel`.
- **Things the AI makes** (`AI_MAKE_LAYOUT`), each sent back once:
  - **Painted-over shapes.** In the house, two rects drawn last covered the
    walls, the door and the window completely. A filled shape with nothing
    left in view is named.
  - **Above and below.** "A yellow sun above a blue sea", with a blue rect
    filling the picture, is questioned. Shapes are told apart by the
    colours the question names.
  - **Drawing instructions:** later shapes cover earlier ones; things above
    or below each other get their own areas; a roof is a tri on top of the
    walls.
  - **A total is a note, not a part.** The parallel circuit's total
    resistance was drawn as a fourth resistor (`part R_total resistor
    "{=...}"`).
  - **A procedure's steps go in a numbered list.** Plain lines print as
    separate paragraphs with no step numbers.
- **The bench's MAKE path shows a seeing model its picture**, as Chat
  always has: one look, LOOKS RIGHT or a corrected block, which is kept when
  Lantern can make it. Rows record `looked`.
- **Graders.**
  - `doc-not-covered` now accepts "Not in the document. From my own
    knowledge: warranties typically run 1 to 5 years..." (1.12.9's labelled
    own knowledge). It still fails a warranty given for this compressor.
  - `make-sun-sea` takes the lowest blue area as the sea, so a light blue
    sky above it is fine.
- **Which Lantern ran.** Run 10 was 1.12.9 again, word for word the same
  115 replies (the 35B at temperature 0 repeats itself exactly). The kit
  shows Lantern from its `site/` folder, so a new `Lantern_Office_Suite.html`
  on the stick changes nothing. The bench summary line now says
  "Lantern 1.13.1" right after the score, and the panel says which version
  it is before a run. `start-lantern` prints the folder it shows Lantern
  from (the Mac/Linux script also prints the version found there).
  (1.13.2 replaced the update steps given here with one Lantern folder.)

Not changed: the die and the four houses failed only without the tools,
which is what that comparison is for.

Tested:
- `tests/bench_run9.js` (37 checks) replays the run's own replies:
  - the cups block questioned, then corrected and passed;
  - the queue block run;
  - a block that fails twice answered by the AI;
  - both refrigerator replies questioned, and the `{ANS1}`/`{ANS2}` reply
    passed;
  - READ, LESSON and EXAMPLE lines at the end of a reply read;
  - the NEED answered in Assist and Chat (432);
  - the fuel card;
  - the house, sea, total and procedure questioned, with every ideal reply
    in the bench still building clean;
  - the look turn kept and changed;
  - the warranty grader;
  - the table labels and the recorded blocks.
- Two existing assertions changed with intent: a READ ending a long reply
  is now read, and the sun-sea check accepts Lantern's own message.
- `tests/browser/bench_run9_e2e.py` (not in `npm test`) runs the full bench
  in Chromium against a stand-in llama-server that sees images:
  - the labels;
  - the cups corrected and passed;
  - the full-picture sea sent back, then shown to the model as a real PNG
    and kept;
  - the queue;
  - the dozen.
- All 26 suites pass.

## 1.13.0 — Code Lab: real programs, checked; the AI writes them (2026-10-23)

Adam asked for a coding module with more power than the turtle: Arduino,
Python, JavaScript, Structured Text and ladder, easy to switch between, with
links to where each language's tools are installed; its own tile, with the
turtle kept for beginners; the AI able to write programs into it. This is
stage 1. Stage 2, next, is a simulator.

- **Code Lab tile** (after Turtle Code on the home screen).
  - An editor with colours, line numbers, Tab and Shift+Tab indenting,
    auto-indent, Ctrl+/ comments, and Find and replace.
  - Files kept on the device: New, Rename, Delete, Open file…, Save to
    computer (.ino, .py, .js, .st, .lad). The language can be switched at
    any time.
  - **Check** lists problems with their line numbers and marks those lines
    red in the margin. It looks for:
    - Arduino: no setup() or loop(), a missing ;, a library without its
      #include, a pin written before pinMode, Serial before Serial.begin,
      = in a condition, analogWrite on a pin with no PWM, millis() kept in
      an int, delay() in an AccelStepper sketch, P1AM used before P1.init().
    - Python: a missing colon, bad or mixed indents, Python 2 print,
      = in a condition.
    - JavaScript: anything that stops it compiling.
    - Structured Text: blocks left open, a missing THEN or DO, = used to
      assign, a missing ;, undeclared names, reserved words used as names.
    - Ladder: unknown instructions, wrong argument counts, empty branch
      legs, rungs with no output, one coil driven from two rungs, a tag used
      as both a timer and a counter.
  - **Run** for JavaScript, in a sealed Web Worker: no access to the page
    or the person's files, a 2-second limit, at most 500 lines of output.
  - **Ladder**: rung text (`[XIC(Start) ,XIC(Motor) ]XIO(Stop)OTE(Motor);`)
    is drawn as rungs. **Ladder → Structured Text** turns it into an
    IEC 61131-3 program in a new file.
  - **45 tested examples.**
    - Arduino (21): Blink to state machines, servo, 28BYJ-48, AccelStepper
      on A4988/DRV8825/TMC2209, homing, TMC2209 over UART, I2C and parallel
      LCDs, DS18B20, DHT22, HC-SR04, an I2C scanner. Each was compiled and
      linked for an Uno against the real Arduino core and libraries.
    - P1AM-100 (3): checked against the real P1AM library.
    - Python (6, three for the Raspberry Pi): run, with gpiozero's mock pins
      and a loopback serial port.
    - JavaScript (4): run.
    - Structured Text (6) and ladder (5): compiled with matiec.
  - "Build and run it on a computer" shows each language's free tools with
    their addresses written out: Arduino IDE and CLI, the P1AM-100 boards
    URL, Python, Thonny, Raspberry Pi OS, MicroPython, Node.js, OpenPLC,
    Beremiz and CODESYS.
- **Turtle Code.** The old Code tile keeps the turtle and is now labelled for
  first programs, for beginners and children. Its guide points on to Code Lab.
- **The AI writes programs (MAKE CODE).**
  - A program comes in a block: `MAKE CODE: <title>`, `language …`, the code
    with its indents, `END`.
  - Lantern checks it and sends the problems back once. It shows the code
    once, in colour, with Open in Code Lab and Save to computer, and Run
    here for JavaScript. The reply bubble points to it instead of repeating
    it.
  - When a tested example fits the question well, it goes into the AI's
    instructions. The AI can also ask for examples with `EXAMPLE: <words>`.
  - Lantern says where the code came from: "adapted from Lantern's tested
    example …" (a third or more of its lines, not counting lines every
    sketch has), or "written by the AI from its own knowledge". Either way
    it adds "checked by Lantern, not compiled or tested".
  - Code written straight into a reply in a fenced block is checked too,
    with the same buttons. Output, shell commands and data in fences are
    left alone.
  - A new Chat hook, `Lantern.chatReplyViews`, puts views under a finished
    reply.
- **Lantern Bench: 7 program questions.** Blink without delay, AccelStepper
  back and forth, a P1AM seal-in, a Python CSV average, Ohm's law in
  JavaScript, a Structured Text tank fill, and a ladder start/stop. Each
  checks what matters, such as millis() rather than delay(), or a seal-in in
  a branch. Every ideal reply was compiled or run.
- **Help.** Code Lab's guide covers the editor, checks, examples and
  languages with install links, then Arduino setup, the libraries the
  examples need, the P1AM-100 boards, a Raspberry Pi with Python, Structured
  Text in PLC tools, and a ladder rung-text reference. The guide is one of
  Lantern's lessons, so `LESSON: install arduino` finds it.
- **The two screenshot fixes** (from the AccelStepper answer in 1.12.9's
  Chat):
  - An answer from the AI's own knowledge that uses nothing from the
    passages no longer gets a long "own reasoning" list; its sources header
    says the answer uses nothing from them.
  - Code lines are no longer checked as sentences.
  - Any own-reasoning list is capped at 8 lines.

## 1.12.9 — Chat answers from the AI's own knowledge, labelled (2026-10-23)

From Adam's Chat. Two questions were refused even though the 35B knew both
answers: "provide a standard example based on general knowledge of these
components" (Arduino, AccelStepper, a TMC2209 driver) and "How do I set the
date and time on an rpi400". The model replied "my rules strictly require that
all facts and data come only from the provided library passages", and "Not in
my library" after a search that found nothing useful. Chat's instructions said
facts come only from Lantern's functions. That was too strict for code,
how-to steps and commands that the encyclopedia doesn't cover.

- **New rule for Chat's AI.**
  - It still uses Lantern first: = lines for numbers, LOOKUP for facts,
    Lantern's lessons, MAKE for things.
  - When Lantern has nothing, it answers from its own knowledge and begins
    that part with **"From my own knowledge:"**.
  - The library's, the lessons' and a document's "reply exactly: ANSWER:
    Not in my library" become "say so, then, if you know the answer, give
    it anyway, starting with 'From my own knowledge:'". This rewrite is
    applied only on the way to Chat's model.
  - "Not in my library" stays for what no one could know offline
    (tomorrow's prices, today's news, a local phone number or office holder).
  - The safety rules for medicine doses, live mains work and mixing
    chemicals are unchanged.
- **Lantern labels it.** Under every answer that is the AI's own knowledge,
  an amber note says it did not come from Lantern's library or tools, so
  Lantern did not check it. The note also appears when the AI forgot to say
  so: no library, no tools and no MAKE behind a real answer. Questions about
  the AI or Lantern keep their own single note.
- **Numbers.**
  - A general fact the AI knows (steel at about 7850 kg/m³), used in = lines
    and said to be its own, is no longer questioned.
  - A value only the person knows (their battery, their tank) is still
    asked for with NEED. The question back to the AI now spells out that
    choice.
- **Records and the bench.**
  - An own-knowledge answer is not counted as a refusal (`declined`). Chat
    records `own`.
  - The library checks treat "From my own knowledge" as no claim on the
    passages.
  - New bench conversation `chat-own-knowledge`: setting the clock on a
    Raspberry Pi from the terminal, answered and labelled.
- **Code in Chat.** Code in ``` fences shows in a fixed-width font,
  without the fence lines.
- **Assist** (the calculator-style app) keeps its strict rules.
- **Tests.** 13 new checks in `tests/chat_routing.js`:
  - the instructions;
  - the rewritten library line;
  - the Pi 400 and AccelStepper cases;
  - an unlabelled answer still labelled;
  - the mayor still declined;
  - steel's density versus "my battery";
  - the library checks;
  - one note for questions about the AI;
  - Assist unchanged;
  - the label's style;
  - fenced code;
  - the bench conversation.

  Replayed in Chromium with your three questions.

## 1.12.8 — Lantern waits for the kit's model, with a progress bar (2026-10-23)

From Adam's USB kit. start-lantern launched llama-server and opened Lantern
8 seconds later. The 35B model then took about 2 min 20 s to load from the
stick. In that time llama-server (b11435) sends the page but answers every
other request with 503 "Loading model". Lantern checked for a server once,
saw no model, fell back to "On this device" and never looked again. The page
had to be closed and opened. Nothing on screen said the model was loading,
so it was easy to think it had hung and close it.

- **A loading screen with a progress bar.** While the model loads, a screen
  over the apps shows:
  - the model's name and size;
  - a progress bar;
  - the time so far and about how long is left;
  - a request to keep the page and the black Lantern window open, because
    closing either stops the load and it starts over.

  "Use the other apps while it loads" shrinks the screen to a corner button
  ("AI loading 47% — details"). The apps work without the AI meanwhile.
- **It connects by itself.** Lantern asks the server's /health every second.
  The moment the model is ready it connects (model name and vision too), the
  bar fills, and the screen goes. No reload is needed.
- **The estimate.** The start scripts now open the page as soon as the
  server answers. They pass the model's file name, its size, the vision
  part's size and the time the server started (`?kit=1&model=…&bytes=…&t=…`;
  Lantern removes these from the address bar). So the first estimate comes
  from the file size at about 120 MB a second. After that, Lantern remembers
  how long each model took and uses that. Past the estimate the bar slows and
  does not reach the end until the model answers. The scripts' black window
  also says the model takes a while and to keep it open.
- **Other cases.**
  - A page opened by hand (a phone on the Wi-Fi, a reload) gets the same
    screen.
  - A saved page opened while the server is off shows only a quiet corner
    button ("AI server not answering"), and only if this address has had a
    model before. It brings up the screen if the server starts.
  - GitHub Pages and plain file hosts show nothing.
- **Asking while it loads:** Chat now says "the AI model is still loading",
  with no advice about endpoints. The AI app says "the Lantern server on
  this computer (the model is still loading)". The on-device panel no longer
  shows a red "engine could not start" error during the load. It fills in
  once the server is ready.
- **Tests.**
  - 22 new checks in `tests/ai_server_wait.js`:
    - loading, then ready, without a reload;
    - the estimate and the remembered load time;
    - the corner button;
    - asking while it loads;
    - the server off, then starting;
    - no server at all.
  - The kit test now checks the address start-lantern.sh opens and the
    Windows script's hints.
  - Both new modules are tested in isolation.
  - Replayed in Chromium against a stand-in llama-server that behaves like
    b11435 (only the page while loading, 503 for the rest).

## 1.12.7 — Wheel charts; words on a drawing checked; junctions that were never declared (2026-10-22)

From Adam's next Chat with the 35B. The parallel and series schematics came
out right, with their formulas worked out on the picture. The parallel one
took a retry first: the block wired `A1` to `junction1` but never declared
`junction1` as a part. Then came "draw the ohms law power wheel calculator
for educational purposes". The 35B wrote 27 text lines on Draw's grid and
made a gray disc with letters in a grid. Formulas ran into each other
("I=V/R V=√(PR)" read as one), eight were written twice, and three were
missing. On the look turn it said LOOKS RIGHT.

- **MAKE WHEEL**, a new kind. The AI lists the parts, one line each:
  `P watts: P = V x I | P = V^2 / R | P = I^2 x R`. Lantern does the
  sines and cosines. It cuts the circle, paints each part, and sizes every
  word to fit inside its wedge, all items at one size. A long formula breaks
  onto two lines, but never inside its brackets. It shows powers and roots
  as ² and √. Optional `centre`, `note` (with {= ...} worked out) and
  `fill <colour>` lines are allowed. The wheel opens in Draw as ordinary
  shapes. A part named after a colour (Red, Blue …) is painted that colour,
  with white words where it is dark. The AI is told to use MAKE WHEEL, not
  MAKE DRAWING, for a wheel or any labels round a circle. A car's wheels or
  a grinding wheel still go to MAKE DRAWING.
- **Formulas on a wheel are checked.** A formula must sit in the part of
  the letter it works out. No formula may appear twice. On an Ohm's law
  wheel (P or W, V or E, I, R), each formula is worked out by the formula
  engine with V = 12, I = 3, R = 4 and P = 36. A wrong one goes back:
  "P = V x R is not right: … it gives 48, not 36". Right-hand sides alone
  ("P: E x I | I^2R") are checked as that letter's formulas.
- **Words on any MAKE DRAWING are checked.** Text that runs into other
  text, text cut off at the left or top edge, and a formula written twice
  go back to the AI once, with grid positions. When the request is for a
  wheel, the message also points to MAKE WHEEL. The drawing prompt says how
  much room words need (about one cell for every three letters at size 20).
- **The look turn asks whether every word is readable**: none running into
  another, cut off or written twice.
- **A wire to a junction or ground that no part line made** (`junction1`,
  `J2`, `node`, `GND`) now makes that part, so there is no retry.
- **Tests.**
  - 18 new checks: Adam's 27-line drawing; the wheel's layout (no
    clashes, each formula inside its own wedge); the formula checks; a word
    wheel with a centre; a colour wheel; the prompt routing; and the whole
    Chat turn (the drawing sent back, the wheel made).
  - The power wheel joins the bench as its 14th make question.
  - The five new modules are tested in isolation.
  - Replayed in a browser: the undeclared junction1 schematic draws first
    time, and the power wheel opens in Draw.

## 1.12.6 — A ground as the return; the formula goes on the drawing (2026-10-22)

From Adam's next Chat: "draw an electrical schematic showing ohms law in
parallel ... with the formula shown to calculate the resistances". The
35B wired both resistors and the source's return to a ground (wire R1 G1,
wire R2 G1, wire V1 G1), and the drawing came out tangled. It worked the
formula out in = lines in its reply, which Lantern does not run next to a
MAKE block, instead of putting it on the drawing.

- **A ground used as the return to the source** is folded like a junction.
  Each load is wired back to the source's other terminal, and the ground
  symbol hangs on that return. A ground on the way round (battery,
  resistor, ground, battery) is a join too, and keeps its symbol. Both
  now draw as a closed loop or a ladder.
- **Asked for the formula, and the block has no notes?** The block goes
  back once: "the person asked for the formula on the drawing: add note
  lines". The AI is also told to put formulas and values in note lines,
  not in = lines or the answer.
- **Ladder rungs have their names beside them**, clear of the two rails.
- **Tests.** The ground-return block from the Chat, the series ground, and
  the formula request with and without notes. Replayed in a browser, the
  35B's first reply is sent back once and the corrected block shows
  "Req = ... = 66.67 ohm" and "I = ... = 0.18 A", both worked out by
  Lantern.

## 1.12.5 — Ohm's law in parallel: a clean ladder, meters, formulas on the picture (2026-10-22)

From Adam's Chat with the 35B.
- "Draw an electrical schematic that demonstrates Ohm's law in parallel":
  the first block used an ammeter, which Lantern did not have. The
  corrected one put three resistors on a junction, and that drew as a
  tangle.
- "The picture needs the formula with the circuit resistances shown": the
  AI worked the values out with = lines. Lantern questioned numbers that
  came from the AI's own schematic. The AI then asked NEED for the
  voltage, and "voltage source" sent Lantern to the encyclopedia ("Not in
  my library").

What changed:
- **Junctions folded into the wires** (new AI_SCHEMATIC_MORE). What flows
  into a junction is wired to what flows out of it, so the three
  resistors hang one under another like a ladder (the join keeps its
  dot). A part in parallel now hangs under a load rather than under the
  source.
- **Ammeter and voltmeter.** They are schematic parts ("ammeter", "amp
  meter", "voltmeter", "multimeter") and new symbols in Draw's Electrical
  mode.
- **note lines.** `note <text>` puts a line of text under the drawing (a
  formula or values for teaching). Each `{= ...}` in it is worked out by
  Lantern's formula engine, so the numbers on the picture are computed,
  not typed. A note that cannot be worked out is sent back. The AI is
  told it can redraw with notes.
- **Checks.**
  - Numbers in a MAKE block made earlier in the chat count as given.
  - A step whose value the answer states counts as used.
  - A NEED counts as a call for the encyclopedia only for "sources of
    facts", not for a voltage source.
- **Bench**: a 13th make question, a parallel circuit for a lesson with
  the total resistance shown on the picture (2 ohm).
- **Tests.** The Ohm's-law conversation replayed: the junction folded,
  meters, notes, and the follow-up not questioned, with no NEED and no
  library. The Project Context gate passes: 300 modules, 0 errors, 44
  size warnings. 81 AI modules are isolated.

## 1.12.4 — The AI knows it can make documents and PDFs, also in a follow-up (2026-10-22)

From Adam's next Chat. He pasted the manual picture and asked to "fix the
image and make a corrected pdf of it". The 35B said it could not make a
PDF and gave the corrected text in the reply instead. "Proceed with
creating a document using the Writer module" then fetched a lesson on the
writing process (LESSON: document write).

- **MAKE DOC says what it is for.** Lantern shows the document with Open in
  Writer and Save .pdf, so it is how the AI makes a Writer document or a
  PDF. It is to be used rather than LESSON when a document is wanted. The
  command list says "Save .pdf makes a PDF".
- **More ways of asking** (AI_DOC): creating, making, writing, saving, a
  corrected copy or version, "using the Writer module".
- **MAKE: <kind>** (new module AI_MAKE_ASK). When the question does not
  bring the MAKE instructions, the AI is told in one line what Lantern can
  make (a document can be saved as a PDF). For a follow-up such as "go
  ahead", it may reply MAKE: document (or slides, flashcards, plan,
  drawing, schematic, table) to get the format, then make it from the
  conversation.
- **Tests.** Adam's three phrasings, the one-line offer, everyday kind
  words, and a two-turn Chat ("What should a notice say?" then "yes, go
  ahead") that ends with a document and Save .pdf. The Project Context gate
  passes: 299 modules, 0 errors, 44 size warnings. 80 AI modules are
  isolated.

## 1.12.3 — Puzzles: take a coin out, the end cups, the middle cup (2026-10-22)

From Adam's two-coin cup puzzle in Chat. The 35B wrote "take silver from
holder of silver" and then "take silver from White". TRACK did not read
either line, although its own error message listed "take". The AI then
answered alone. It also wrote "swap Red and White" for "the two end cups
swap", naming the cups it guessed were at the ends rather than the ends.

- **take silver from White** (also "out of", "from under", "off"). The coin
  comes out of its cup, so that a later "put silver in ..." places it
  again. Taking it from the wrong cup is caught ("silver is with Blue, not
  White").
- **swap first and last**. "The two end cups swap", "swap the ends" and
  "swap the end cups" all read as swapping the first and last cups.
  "Blue and White swap" reads like "swap Blue and White".
- **holder of middle**, **holder of Blue**: a place or a cup named after
  "holder of" is that place or cup.
- **The AI is told to write places the way the puzzle says them** at that
  step (first and last, middle, holder of gold), never the names it thinks
  are there by then. Lantern works out who is there. The help lists
  "take silver from White" and "swap first and last".
- **Tests.** The puzzle as the 35B wrote it, and as the question words it,
  give Yellow, Green, Blue, Red, White, with gold under Green and silver
  under Blue. Taking a coin from the wrong cup is caught.

## 1.12.2 — Make things from an attached document; Save .pdf (2026-10-22)

From Adam's Chat with his upside-down scan of a grinder manual. The AI
corrected the text on its own, but said it could not make a PDF or use
Writer. While a document was attached, every question had been treated as
a question about it. "Turn this into a PDF", "rewrite it in the writing
module" and "write it in the text writer" did not trigger MAKE DOC. The AI
only ever had 3 of the page's passages, with no way to ask for the rest.

- **A request to make something wins over the attached document**
  (TEXT_READER_CHAT, TEXT_READER_PROMPT). The AI gets the document's whole
  text (up to 12 passages) and the MAKE instructions, not "ANSWER / Not in
  the document". It is told to correct words Text Reader misread where the
  sentence makes the right word clear, and to keep codes and numbers as
  printed when it cannot tell.
- **MAKE DOC listens for more ways of asking** (AI_DOC): rewrite, retype,
  correct, proofread, transcribe, turn into / convert / save as a PDF, "in
  Writer", "the text writer", "the writing module", "word processor".
- **Save .pdf** (PDF_DOC_LAYOUT, PDF_DOC). A PDF file straight from a
  document, with no print box: headings, paragraphs, bullet and numbered
  lists (nested), tables with ruled cells, bold and italic. It uses the
  standard Helvetica, so nothing is embedded. Pages are Letter or A4, with
  page numbers.
  - It is in Writer (a Writer tool) and beside **Open in Writer** under
    every document the AI makes.
  - Signs the standard fonts lack are written out (Ω as Ohm, → as ->).
- **READ: all.** The whole of a short document (all of a one-page scan),
  or the next unread section of a long one. When the AI has only some of a
  page's passages, it is told how many there are and how to get the rest.
  "Can you request the full text?" counts as a question about the document
  itself.
- **Sentences about the document as a whole** ("Yes, I have the page Text
  Reader read: part of a grinder manual") are no longer flagged as false
  citations. When nothing cites a passage, the check says so instead of
  "0 of 1 backed".
- **Text Reader on the real scan** (829×1160 px, upside down and slightly
  curved): 7.3% of characters wrong in 1.12.0, 3.3% in 1.12.1, 2.3% now.
  - Codes keep their digits (lO-3 → 10-3, 12-l( → 12-1(, xl6 → x16).
  - A list number run into its first word becomes 1 (I.Pressing).
  - A d with a comma touching it is no longer read as 4 (finishe4then).
  - Letters touching an f are fixed (fflnction, flmction → function),
    preferring words the same document prints clearly.
- **Tests.** Adam's three requests, the whole text for making, READ: all,
  a description of the document, and the PDF file itself (header, every
  object where the cross-reference table says, fonts, bullets, table
  rules, page numbers). The Project Context gate passes: 298 modules,
  0 errors, 44 size warnings.

## 1.12.1 — Turned and skewed screenshots read properly; honest confidence (2026-10-22)

From a test: a screenshot of a grinder manual page, upside down and a
little skewed. Lantern turned it the right way up, but read words such as
"flmction", "l@2" and "Ω" for "Th", and still called it 92% sure. In Chat,
"Can you see the text from the page Lantern read?" was handled as a fact
question.

- **Small print is enlarged before it is levelled** (TEXT_READER,
  TEXT_READER_IMAGE). Before, a tilted page was turned at its own size and
  then enlarged. At screen size that blurred the letters together.
  - Error rates on a reconstruction of the test page (15-16 px text, turned
    180° plus 2.5-3°): from 6.9-7.9% down to 0.4-1.2%. With extra blur:
    from 37-44% down to 2.7-10.8%.
  - The two earlier test sets are unchanged or better: 0.33% (was 0.40%)
    and 0.32% (was 0.31%).
- **Touching letters.**
  - A piece cut from a blob may now be a hyphen or a bracket, so 10-2,
    (but and wheel) come apart.
  - A blob that reads as a rare mark (& @ # Ω) is always tried as two
    letters.
  - m&e becomes mode and Ωne becomes fine, but only when the result is a
    word Lantern knows.
- **Blurred i.** A capital I inside a small-letter word (wIll, IndIcatIng)
  becomes i or l, whichever makes a word.
- **Lost spaces.** Words run together where blurred print lost its spaces
  ("headwillrise") get their spaces back. This only happens when the run is
  three or more everyday words.
- **Honest confidence.** These readings are no longer counted as "sure":
  - a mark inside a word (red);
  - a digit between letters (amber);
  - a near miss of a known word whose letters fit poorly (amber). Text
    Reader lists these as "May be misread: flmction → function", and
    **Use these** puts the suggestions into the text.
- **Chat: questions about the document itself** ("can you see the text?",
  "how well was it read?").
  - The AI answers in its own words about what the document is and what it
    covers. It is no longer pushed into the ANSWER / QUOTE format.
  - The AI is told which words Text Reader was unsure of.
  - "Yes" and "no" no longer need a quote that says them. This removes the
    false "no quote says yes" warning.
- **New modules** TEXT_READER_CHECK (the word repairs and confidence) and
  TEXT_READER_MISREAD (the "May be misread" note). Both are split out to
  keep TEXT_READER_WORDS and TEXT_READER_VIEW small. The Project Context
  gate passes: 296 modules, 0 errors, 44 size warnings.
- **Tests.** Two upside-down skewed screenshots were added to the browser
  test (limits 2% and 2.5%), plus checks for the word repairs, the
  confidence rules and the Chat question about the document.

## 1.12.0 — The AI makes documents, slides, flashcards and plans; READ (2026-10-22)

Built on 1.11.1, which is merged into this release.

- **MAKE DOC → Writer** (AI_DOC). Ask Chat for a letter, notice, report or
  procedure. The AI writes plain lines: `##` headings, numbered steps,
  `-` bullets, `|` table rows and `**bold**`. Lantern turns them into a
  Writer document.
  - A document that is too short or cut off is sent back once.
  - Compose's writing checker reads it, and its findings (spelling,
    grammar, punctuation) are listed under the preview.
- **MAKE SLIDES → Slides** (AI_SLIDES). `#` starts a slide and `-` adds a
  point. Lantern checks every slide has a title and something under it, at
  most 7 short points a slide and at most 25 slides.
- **MAKE CARDS → Flashcards** (AI_CARDS). One card a line as
  `front | back` (also `::` or Q:/A: pairs). Lantern checks every card has
  both sides, no card is there twice, and no answer just repeats its
  question.
- **MAKE PLAN → Planner** (AI_PLAN). One line each:
  `when | what | how often`.
  - The AI says *when* in words (today, in 3 weeks, next Monday,
    1 December) and Lantern works out the dates itself.
  - A date in the past, an unreadable date or a repeat the Planner does not
    have (every 2 weeks) is sent back.
- **One tap opens it.** Each result is shown in Chat first, with
  **Open in Writer / Slides / Flashcards** or **Add to Planner**. Nothing is
  saved until the tap, and a second tap only opens it again.
  - New host doors: `Lantern.slideDocs`, `Lantern.cardDocs` and
    `Lantern.plannerDocs`, next to `writerDocs` and `sheetDocs`.
  - The command list says which app each MAKE kind opens.
- **READ: for documents** (TEXT_READER_READ). With a long document
  attached, the AI can ask for another part: `READ: page 12`,
  `READ: pages 3-5`, `READ: section 2` or `READ: <words to find>`.
  - Pages not read yet are read first, and the answer is checked against
    them like any passage.
  - Chat's instructions say a document is attached, how many pages it has
    and which have been read.
  - Each passage block says which pages it came from and offers READ
    before "Not in the document".
  - "The last page" and "the first page" are page numbers, in a question
    and in READ.
  - A question about the document that shares no words with what was read
    gets its opening passages, so the AI can see the contents and READ on.
- **TEXT_READER_PROMPT** holds the document prompt, split from
  TEXT_READER_CHAT. This keeps both under the Studio's 2,500-token size
  warning (44 warnings, as in 1.11.1).
- **Bench**: four new make questions (a printable procedure, a 4-6 slide
  toolbox talk, the seven SI units as flashcards, a compressor plan whose
  dates must come out right) and a document conversation that needs READ
  (the person says guarantee, page 5 says warranty).
- **Tests**: `tests/ai_make_docs.js` (53 checks); the action, routing,
  layer and isolation tests updated (75 modules isolated). The Project
  Context gate passes: 294 modules, 0 errors.

## 1.11.1 — The AI knows the whole suite; pictures in Chat (2026-10-22)

Built in a separate session on top of 1.10.0, then brought into the
repository unchanged. This repository's build pipeline reproduces the file
byte for byte.

- **The AI knows the suite** (SUITE_* modules). Lantern keeps one live
  catalog of everything it has: 44 tiles, 270 lessons, 38 help guides, 66
  formula functions, 26 recipe cards, 23 flashcard decks, 40 templates, 18
  Compose tasks and 13 Chat commands. The catalog is built from the
  registries each module fills as it loads, never typed by hand.
  - Chat's instructions name every tile.
  - A question about Lantern itself ("what are your capabilities", "does
    Lantern have a farming module") gets the catalog, with buttons that open
    each entry.
  - A how-to question gets passages from the best lessons first, checked
    like library passages.
  - The AI can ask for more with `LESSON: <words>` and `MODULES: <topic>`.
- **Pictures in Chat** (CHAT_PICTURES, IMAGE_SHRINK).
  - A screenshot can be pasted, dropped or picked.
  - A model that sees images gets the picture, shrunk to at most 1280 px.
  - For a model that does not, Text Reader reads the text in the picture
    instead.
- **New Chat hooks**: `Lantern.chatSystem`, `chatAbout`, `chatCommands` and
  `chatPictures`. Also new: `Lantern.guide.list/get`,
  `Lantern.mathLessons.get` (and lesson `meta.app`) and
  `Lantern.formula.names()`. Ten engineering and RF functions now have
  descriptions in the AI's catalog.
- **Project Context Studio compatibility.**
  - Parentheses, brackets, braces and slashes inside regex literals are now
    written as \x28 \x29 \x5B \x5D \x7B \x7D \x2F. The Studio's gate
    strips strings and comments but not regex literals, so those characters
    unbalanced 17 modules.
  - Seven circular "Depends:" headers were reworded. Example: AI_ACTIONS
    named AI_DRAW, which depends on AI_ACTIONS.
- **New test `tests/pc_compat.js`** (part of `npm test`). It checks what the
  Studio's splitter and merge gate check: markers, circles in the Depends
  headers, and brackets outside strings with regex literals not understood.
  1.10.0 had 24 errors; 1.11.1 has none. 44 modules are over the 2,500-token
  size warning.
- **Tests:**
  - The isolation test covers the 15 new modules (67 in all).
  - Chat routing grades the four new bench conversations about Lantern
    itself.

## 1.10.0 — Text Reader: printed text from pictures, scans and PDFs (2026-10-21)

Lantern can now read. Pictures of pages, photos of labels and nameplates,
screenshots and scanned PDFs become text the person can search, correct and
save, and the AI can answer from. It is plain JavaScript with no font files,
no training data and no download. The idea came from the sheet music reader
built for the music studio: find the structure printed on the page and
measure against it.

- **Text Reader tile.** Open pictures or a PDF, take a photo, drop files, or
  paste a screenshot (Ctrl+V).
  - Long documents are read in sections (5, 10, 20 or 50 pages), so a whole
    manual can be worked through on a small device.
  - Each page shows the picture with a box round every word: green when
    sure, amber when fairly sure, red when guessing.
  - Corrections are learnt and remembered.
  - Save as text, open in Writer, save as a **searchable PDF**, or save every
    word with its position (JSON).
  - **Second reader.** When the AI in use can see pictures, it reads the page
    on its own; Lantern lines the two readings up word by word and marks
    every difference for the person to settle.
- **How it reads** (one module per step):
  - **Clean the page.** Evens out lighting, inverts dark-mode screenshots,
    straightens tilted scans, turns pages that are sideways or upside down,
    stands italic print upright, and removes ruled lines and frames.
  - **Find the layout.** Columns, paragraphs (cut only at a blank line),
    lines, letters and words. A gap counts as
    a space only beyond what the font itself leaves between those two
    letters, so the wide gap after a "1" is not a space.
  - **Recognise letters.** The browser draws every letter of the fonts
    installed on the computer. Lantern compares shape, position on the line,
    width and holes, then learns the page's own letters as it goes, so a
    font it does not have still reads well. Touching letters (rn, ti, ff)
    are cut apart, and letters broken by a thin stroke are joined; the word
    step decides which of these readings to keep.
  - **Choose words.** A word model learnt from Lantern's own text, plus
    numbers, units (kW, psi, ft-lb), codes (E-11), abbreviations (ISO),
    capitals after a full stop, and commas before small letters.
- **Accuracy on test pages.** The share of characters read wrong:

  | Test set | Lantern 1.10.0 | Tesseract (default settings) |
  |---|---|---|
  | 20 pages (scans, screenshots, unseen fonts, rotated, noisy, dark mode, two columns) | 0.40% | 0.24% |
  | 19 held-out pages (new text, browser screenshots, nameplates, a shaded photo, italic, typewriter) | 0.31% | 5.71% |

  These are synthetic pages. Real photos with perspective or curved pages
  will read worse.
- **PDF in.** Scanned PDFs are opened with no library. Supported picture
  formats:
  - JPEG.
  - zlib with PNG predictors.
  - LZW, ASCIIHex, ASCII85 and RunLength.
  - CCITT fax Group 3 and 4.
  - Grey, RGB, CMYK and palette colour, 1–16 bits.
  - Several picture strips on one page.

  Object streams, inherited resources and turned pages are handled. Pages
  that carry their own words (made on a computer, or scanned and read
  before) use those words: exact, with ToUnicode maps, encodings and glyph
  names. JBIG2 and JPEG 2000 pictures are reported as not readable yet.
- **PDF out.** A searchable PDF keeps each page as its picture, with
  invisible Helvetica words placed over each word. It was checked with qpdf
  and pdftotext.
- **Chat.** The 📄 button (or "Ask Chat about it" in the tile) gives Chat a
  document.
  - Each question then gets the document's most relevant passages, numbered
    like library passages ("DOCUMENT: passages from ...").
  - The AI's quotes and sentences are checked against the document.
  - "Not in the document" is a decline.
  - Naming a page reads that part first.
  - A picture of sheet music is read as notes.
- **Sheet Music Reader** in the Music tile. A rewrite of
  sheet_music_reader_v7:
  - Staff lines are removed where nothing crosses them; each note head's own
    centre gives its pitch.
  - Filled and open heads, chords and ledger lines are read, and tilted
    photos are levelled.
  - Treble, bass or piano staves; a chosen key signature.
  - Playback, MIDI and JSON export; "Ask Chat about it".
  - Pitches are read, not note lengths.
- **Handwriting** has its own module, `HANDWRITING_READER`, which is a stub
  for now. Text Reader hands it pages where most words are guesses.
- **Hooks**:
  - `Lantern.chatTools`: buttons beside Chat's Send.
  - `Lantern.chatContext`: passages from an attached document.
  - `Lantern.musicCards`: cards in the Music tile.
  - `Lantern.textReader`, `Lantern.pdf`, `Lantern.sheetMusic` and
    `Lantern.handwritingReader`.
- **Lantern Bench.** Four conversations about a compressor manual handed to
  Chat: an oil figure, a fault code, a follow-up, and a question the manual
  does not answer, which must be declined.
- **Tests:**
  - `tests/text_reader.js` (39 checks): the word model, layout on drawn
    bitmaps, glyph features, a fax G4 picture decoded pixel for pixel from a
    PDF with object streams, a page's own words with an embedded font,
    document passages, Chat answering from a document (made-up quotes
    caught), the second reader's word-by-word comparison, and the music
    staff finder, pitches and MIDI.
  - `tests/browser/text_reader_e2e.py`: real-browser reading of fixture
    pages with error limits, PDFs, a searchable PDF read back, and sheet
    music note for note.
  - The isolation test covers the 18 new modules, plus the new bench data.

## 1.9.9 — Lantern keeps track: puzzle tools for the AI (2026-10-21)

Six puzzles given to the 35B in Chat (1.9.8): it solved the original cup
shuffle, a four-house clue puzzle, a game-show door trap and a letters
puzzle, and got two wrong -- a two-coin cup shuffle (it kept the silver
coin at a place instead of in its cup) and a rolling die (it tipped toward
itself while writing "away", turned the wrong way round, and read a face
from an earlier state). Its translation of each move was right; its
bookkeeping was not. So, as with arithmetic, the AI now says *what*
happens and Lantern does the bookkeeping exactly.

- **Three puzzle tools, for any names.** In Chat the AI writes a short
  block and ends it with END; Lantern runs it, shows every step, and sends
  the results back for the ANSWER:
  - `TRACK:` things in a row and what they hold -- cups and coins, a queue,
    cars and passengers: `row`, `put gold in Green`, `swap A and B`,
    `swap contents of A and B`, `move A to last`, `shift right 1`,
    `reverse`, `add`, `remove`, `take`; places by name, position, first,
    last, middle, `2 left of X`, `holder of gold`, "two places to its left".
  - `TURN:` a cube with six labelled faces (a die -- three faces are
    enough -- or a box of colours) tipped away/toward/left/right and turned
    clockwise/counterclockwise/around; or a walker on a grid (forward, back,
    turn left/right/around, face east, go north 2) with its distance home.
  - `SOLVE:` clue puzzles -- a line of things, one line per category
    (`(repeat)` when values may repeat, `(order)` for an order), and one
    `rule` per clue: `Cara = fish`, `chef = 3`, `pilot directly left of
    cat`, `not Cara next to Ana`, `Ana in 1, 4`, `before`/`after`, `if ...
    then`, `iff`, `Ana.house + 1 = Ben.house`, or plain words ("The nurse
    lives somewhere to the right of Dev"). Lantern tries every arrangement,
    category by category, and says which one fits; if several do, where
    they differ (a clue is missing or mistranslated); if none does, which
    clue to check. Einstein's five-house puzzle takes well under a second.
- **The AI recognises the kind.** A question that looks like one of these
  gets that tool's instructions; every Chat prompt carries one line
  offering the tools (`PUZZLE TOOLS`), so the AI can ask when Lantern did
  not see a puzzle. A block Lantern cannot finish goes back once with the
  reason.
- **Letters, exactly:** `REVERSE`, `REMOVE` (letters, any case), `LEN`,
  `COUNTCHARS`, `SUBSTITUTE`, `UPPER`, `LOWER`, `LEFT`, `RIGHT`, `MID`,
  `FIND`, `SORTLETTERS`, `WORDS` -- in = lines and in Sheets. Formulas may
  now give text, and `ANS` / `ANS1` carry text too.
- **Bench: a puzzle set.** Ten puzzles with the tools (the six above, a
  queue with a ball handed on, a robot walk, knights and liars, a race
  order) and the first six again *without* the tools, reported apart and
  not scored, so a run shows what the tools add. Every answer was worked
  out by a program. The 35B's real answers without the tools are a test
  fixture: the graders pass its four right answers and fail the coin and
  the die for the right reasons.

Tested: puzzles 42 (all three tools on the bench puzzles written the way
the questions say them, Einstein's puzzle, a missing clue, contradicting
clues, every error message; Chat running a block, a correction, the tools
on request; which questions are offered which tool; the bench), all 21
suites pass; Chat in Chromium with a scripted model.

## 1.9.8 — A drawing stuck in a loop (2026-10-21)

From a 35B Chat on 1.9.7: "draw a house on a hill at sunset". The model
began well -- a hill, a house, a window -- then wrote `rect 10 6 1 1 fill
blue`, `rect 11 6 1 1 ...` up to 119 until its reply was cut off; the
retry did the same up to 77. Lantern sent back all ~100 "off the grid"
complaints, built nothing because a drawing with any problem was never
built, and still said "Lantern made a drawing" -- with no picture and no
Open in Draw button.

- **A loop is found and left out.** A run of 8 or more lines of one shape
  where a single number steps the same way each line (or the same line
  again and again) counts as a loop when the block was cut off, most of it
  is off the grid, or it is over 30 lines. A row of fence posts does not.
  It becomes ONE problem: what repeated, how often, that it was cut off,
  and what to do instead (paint an area as one shape, 30 shapes or fewer).
- **The model does not see its loop again.** The looping lines are cut
  from the reply in the history it gets for the retry (a loop in front of a
  model tends to restart it), and from what Chat shows; Chat notes that
  the reply got stuck.
- **A drawing is drawn from the lines Lantern can read**, even when other
  lines have problems, so there is a picture and an Open in Draw button to
  finish it by hand. The problems still go back to the AI once.
- **Problems are listed compactly:** three or more lines with the same
  complaint become one entry ("16 lines, from ... to ..., are off the
  grid"), at most 8 entries.
- **Chat says plainly when nothing could be made** ("Lantern could not
  make a drawing ... Nothing was made"), and if the correction is worse
  than the first block, the first block's picture is kept.
- **The drawing instructions** say to paint an area with ONE big shape,
  never rows of small squares, 30 shapes or fewer; the example now has a
  sky and ground as single rects.
- **Bench:** an 8th thing to make, "Draw a house on a hill at sunset"
  (passes with a wide warm sky rect and a house; the looping reply fails).

Tested: AI actions 66 (both real looping replies from the transcript as
fixtures, through the build and through Chat: one short reason, the loop
cut from the history, 3 shapes drawn and opened in Draw; a loop then a good
block; nothing drawable; a worse correction), all suites pass.

## 1.9.7 — Run 7: two misses out of 82 (2026-10-21)

Bench run 7 (Qwen3.5 35B-A3B, English Wikipedia mini, 1.9.6) scored
**80 of 82 (98%)**: core 32/32, fresh 5/5, hard 9/10, library 19/20, things
made 7/7, conversations 8/8. Both misses were fixable on Lantern's side.

- **Power bill: `ANS1`, `ANS2` now work.** The model added two separate
  results as `=ANS1+ANS2`, then `=ANS3*30`, `=ANS4*0.15` -- the right
  working (3.6 dollars), rejected as "Unknown name ANS1", and written the
  same way on the retry. In Assist and Chat, `ANS1` is now the first line's
  result, `ANS2` the second's (`ANS` is still the line just before), and the
  prompts say so. A reference to a line not yet worked out, or to one that
  failed, says exactly that. In run 5 the same question failed as
  `=ANS+ANS`; the check that caught it now also knows that a line named by
  `ANSn` is used.
- **Everest: a decline with the answer in front of it gets one pointer.**
  The model said "Not in my library" with Everest's article as passage 1.
  When a quick fact is declined after reading, and one sentence (or infobox
  fact) in the passages holds the question's words beyond its subject --
  "height" or "elevation" for "how tall" -- and a number when the question
  asks for one, Lantern shows the AI that sentence once and lets it decide.
  Never for questions about the person's own situation ("my town", "next
  month"), which no encyclopedia answers, nor for explanations.
- **Reading prompt:** a number a passage states (a height, a year, a count)
  is a fact to write with [n]; = lines are only for a calculation. The
  Assist rules ("every number in the = lines must come from the question")
  may have made the model think it could not state a height.
- **Passages:** a word of the article's own title counts a quarter (nearly
  every sentence of "Mount Everest" says Everest), words that ask for a
  measure match the words articles use ("tall" -> height, elevation), and a
  sentence with a number gains when the question asks for one. The infobox
  fact closest to the question comes first.
- **One article, one passage.** "Mount Everest", "Season", "Sahara" and
  "Polio vaccine" each came back twice -- the same article under a second
  name (a redirect). It is now read once, leaving room for another article.
- A recipe's blanks left in (`=({ah}*{v})/{w}`, battery-hours' first reply)
  now say so: "put the question's numbers in their place".
- **Bench:** a failed library row keeps the passages the AI read, so a
  decline can be told apart from a passage without the answer; a pointer
  turn is recorded.

Tested: AI layer 125 (the run-7 power-bill reply runs in one round and
passes), library 87 (a realistic Everest lead and infobox, a redirect that
reproduces the duplicate, the pointer in Assist and Chat, and where it must
stay quiet); every real reply from runs 1-7 replayed through the checks --
only wrong answers flagged.

## 1.9.6 — Asking the library the right questions (2026-10-21)

From a 1.9.4 Chat on the 35B with English Wikipedia: the first, clear
question went well (read first, 7 of 7 sentences backed), and the
sentence check caught the model citing passages for things they don't say
four times. But six of ten turns got worse because of Lantern, not the
model: follow-ups were searched word for word ("Is this how you work?"
found a song and "Women's work"), questions about the AI itself or asked
"without regard to the library" were forced to "Not in my library", and a
quote from turn 1's passage was taken for an invented one, throwing a good
answer away. What changed:

- **The AI writes the search for a follow-up.** When a question leans on
  earlier turns ("How are they trained?", "Is it..."), Lantern first asks
  the AI for search words -- it knows what "they" means -- and reads the
  library with those. The search Chat used is shown.
- **Not every question is for the encyclopedia.** Questions about the AI,
  Lantern or the conversation ("Is this how you work?", "are you more or
  less capable", "what have we discussed", "your previous answer") are
  answered from the AI's own reasoning, with no reading, no search on a
  decline, and a note that the answer is its own. If it still says "Not in
  my library", it is told once that this is not a library question.
- **"Without regard to the library" is obeyed** (also "from your own
  knowledge", "don't use the library"): no reading, no search at all.
- **Quotes from passages read earlier in the chat count as real** and are
  checked against those passages, instead of setting off a new search.
- **The sentence check skips sentences that describe the passages**
  ("Passage [1] lists songs...", "the passages do not cover...") and reads
  "in passage [3]" as a reference, not a citation -- both were false flags.
- **Recipe hints only go with questions that have numbers.** A unit-
  conversion hint was attached to nearly every message and leaked into a
  35B answer about how it reasons.
- Chat's instructions say plainly that questions about the AI or the chat
  are answered from its reasoning, without "Not in my library".
- Chat's turn logic runs without the page (`Lantern.CHAT.turn`,
  `converse`), so conversations can be benched.

**Bench: eight conversations** from the transcript, each run turn by turn
the way Chat runs it and graded on the last turn: "Is this how you work?"
after an explanation; "How are they trained?" (searched with the subject);
"are you more or less capable"; a question "without regard to your
library"; "sum that up and quote the passage" (no new search); "what have
we discussed"; "how is reasoning possible" about the previous answer; and a
calculation follow-up ("how many amp-hours does it use", 15 Ah). Reported
as their own set; one is in the quick run.

Tested: 19 routing tests replaying the transcript with a scripted model, a
well-behaved model passing all 8 conversations, and checks that the
transcript's own behaviour would fail them; Chat in Chromium against real
kiwix-serve. This update also carries 1.9.5 (making schematics, drawings,
tables; vision) for a stick still on 1.9.4.

## 1.9.5 — The AI makes things: schematics, drawings, tables (2026-10-21)

Chat can now be asked to **draw a circuit** (or a hydraulic or pneumatic
diagram), **draw a picture**, or **make a table**. The AI does what small
models are good at -- saying *what* -- and Lantern does *where* and *how
much*, the way it already does arithmetic:

- **MAKE SCHEMATIC**: parts and wires only (`part B1 battery "12 V"`,
  `wire B1 S1`). Lantern takes each symbol from Draw's Electrical,
  Hydraulics or Pneumatics mode, lays a loop round a rectangle, hangs a
  part in parallel below its twin like a ladder rung, hangs ground, tanks
  and gauges under their terminal, runs square wires on Draw's 20 px grid,
  marks joins with dots, mirrors a battery or diode to match a named
  terminal (`B1+`), and labels everything. Checked first: unknown parts
  (it names the ones it has), loose parts, wires to missing parts, an open
  circuit (no loop through the battery or source), a pump not reaching
  its tank. Common names are understood (bulb, LED, earth, power supply).
- **MAKE DRAWING**: shapes on a 20 x 12 grid -- whole numbers a small
  model handles -- with fill and outline colours by name; scaled up by
  Lantern. Off-grid shapes, unknown colours and wrong number counts are
  sent back.
- **MAKE SHEET**: rows with `|` between cells and `=` formulas; the sheet
  engine works them out (the same engine the person uses). A formula that
  fails, loops, reads an empty cell (an off-by-one row) or reads text is
  sent back.
- One corrected block when Lantern finds a problem, as with formulas. The
  result shows in Chat with **Open in Draw** / **Open in Sheets**; Draw
  keeps the person's own drawing ("Restore previous drawing") and fits a
  wide drawing to a small screen. Only the actions a question is about are
  described to the model, and recipe hints are left out of such requests.
- **The AI can look at its drawing.** Qwen3.5 models see images with their
  vision part (mmproj). The kit now fetches it with each laptop model
  (4B, 9B, 35B: 0.7-0.9 GB; `setup-kit vision` for models already on the
  stick) and start-lantern loads it (`--mmproj`; `novision` to skip).
  Lantern reads llama-server's /props, shows "sees images" next to the
  model, and when it can, shows the AI the finished picture once: it
  replies LOOKS RIGHT or sends a corrected block. A picture is sent once,
  not with every later turn.
- **Bench:** seven "make" questions (a lamp circuit, two lamps in
  parallel, a hydraulic press, a house with a red roof, a sun above the
  sea, a shopping table totalling 6.99, Celsius to Fahrenheit), graded by
  structure and by the sheet's numbers, reported as their own set.

Tested: 49 action tests, the kit (sh and PowerShell: vision parts fetched
and loaded), and in Chromium against a stand-in llama-server that reports
vision: the picture Lantern sends is a real PNG of the schematic (checked by
eye), the look turn, and Open in Draw. Not tested here: a real vision model
looking at it -- that is the next bench run.

## 1.9.4 — Reading before reasoning, and the full Wikipedia (2026-10-21)

From a Chat transcript on the 4B: asked to explain in detail how language
models work, it answered from memory (with a real error: GPT-style models
are not trained by masked language modelling), and when pressed it wrote
"= LOOKUP("LLM", "architecture")" and two QUOTE lines with no library
behind them, then claimed Lantern had verified them. Chat showed that
without a warning. What changed:

- **Read first.** An explanation question in Chat ("explain", "in detail",
  "how does", "tell me about") is looked up before the model answers, so it
  reasons with the passages in front of it. The search uses the subject
  words, not "explain in detail".
- **Bigger reading allowance for detail:** whole paragraphs (the sentences
  around a fact), the lead first, then the paragraphs that share most
  words, each marked with its section; about 2,200 characters a passage
  instead of 1,000. Quick facts keep the short passages.
- **Sentence-by-sentence check.** Each sentence of a detailed answer that
  cites [n] must say what passage n says (its new words and numbers); if
  not, the AI gets one turn to fix it. Sentences with no source are listed
  as the AI's own reasoning, for the reader to weigh.
- **Infobox facts.** The mini Wikipedia holds each article's infobox too,
  and Lantern used to throw it away. Its rows are now read as facts
  ("Molar mass: 44.009 g·mol^-1", "Elevation: ...") and offered in
  passages, units' powers kept, catalogue numbers left out.
- **Two Wikipedias side by side.** Books of the same Kiwix family are one
  encyclopedia: quick facts search and read the small file, explanation
  questions the full one. No article is given twice.
- **Kit:** `setup-kit library-full` downloads the full English Wikipedia
  (every article, text without pictures; the size is read from the server,
  about 60 GB) next to the small one, with the free-space check counting a
  resumed download. Once the small one is there, start-lantern offers it --
  opt-in: only Y downloads; no answer means not now; never in unattended
  setups. `setup-kit check` says whether it fits.
- **Chat holes closed:** a "= LOOKUP(...)" line is a search request, not a
  failed formula; a NEED asking for encyclopedia data searches the library;
  QUOTE lines with no passages make Lantern search (or, with no library,
  are flagged as unchecked); a model that asks to look up what it already
  has is told to answer from it; passages from earlier questions are sent
  as a short note and the oldest turns dropped from long conversations, so
  requests stay inside the server's 8,192-token window.

Tested: AI layer 119, library 76, kit (sh and PowerShell) with the full
file, and end to end in Chromium against real kiwix-serve serving the real
mini test file next to a full-articles file of the same family.

## 1.9.3 — Run 6: the 4B with English Wikipedia (2026-10-21)

Adam ran the full bench on the 4B (Qwen3.5-4B-Q4_K_M) with English
Wikipedia on the same 32 GB laptop as the 35B: **61/67** on 1.9.2.
Earlier questions 32/32, fresh 5/5, hard 8/10, library facts 16/20,
unknown 3/3, safety 3/3 by rule; four replies fixed on the correction
turn; about 10 s a question (11.3 minutes for the whole bench).

The 1.9.2 search did its job: every fact question got the right article.
The six misses, and what changed:

- **A dropped request** (Things Fall Apart): one model request in about
  a hundred failed with Firefox's "NetworkError" (a kept-alive connection
  the server had just closed). A request that never got an answer is now
  sent once more; a stopped request or a server error is not.
- **Right quote, wrong number** (Moon landing, Mandela): the quote was
  copied word for word from passage 1 but labelled [2] or [3], so the
  check said it was not in that passage. Lantern now relabels a quote
  found in another passage (QUOTE line and the answer's [n]) before
  checking, so the link goes to the article it came from.
- **NEED that repeats the question** (gold symbol: "NEED: What is the
  chemical symbol for gold?"): a NEED that only echoes a question with no
  numbers is treated as a decline, so the library gets its look.
- **Conversion done backwards** (26 miles at 40 km/h): the model worked
  out CONVERT(26,"mile","km") and then divided 26 by 1.609344 by hand.
  The unused-step check now also covers a function applied to one of the
  question's own numbers whose result nothing uses.
- **Divide by 1** (battery nobody sized: "=60/1"): the times-one check
  covers /1 as well as *1.

One more check, for answers that passed but should not have: the natural
gas answer said "methane" and quoted a real sentence from the article that
does not mention methane -- an answer from memory with a citation
attached. **Support check:** the words an answer adds to the question
must be in a verified quote (a number the quote states counts as support).

Replayed over every recorded reply from the six runs (347 formula replies,
31 cited fact answers), the new checks question only wrong or unsupported
answers.

## 1.9.2 — Run 5: the 35B with English Wikipedia (2026-10-20)

Adam built a fresh stick on another laptop (one setup run: engine, 4B,
35B-A3B, English Wikipedia mini 2026-09) and ran the full bench: **57/67**.
Earlier questions 32/32, fresh 5/5, hard 7/10, library facts 13/20,
every computed or cited answer verified; two formulas fixed on the
correction turn; about 12 s a question (3.4 tokens/s on that laptop).

All 7 fact misses were "Not in my library" after the search handed the
model the wrong articles ("Mount" and two expeditions instead of "Mount
Everest"; "UNIT" for the ohm; "Moon (disambiguation)"; "Causality" for the
seasons). No wrong fact got through. Fixes:

- **Search:** exact titles are tried for runs of the query's words,
  longest first ("mount everest" before "mount"), singular forms too, and
  never for words too general to be a subject ("cause", "unit", "year");
  disambiguation pages are skipped.
- **Ranking by reading:** up to 10 candidate articles (from the model's
  words and the question's) are read and ranked by the sentence that holds
  most of the question's words, then exact titles and title words; the 3
  best become the passages.
- **Passages by sentence:** the first sentence, then the sentences sharing
  the question's words, then the rest of the lead while there is room
  (1000 characters), so the answering sentence survives a long lead.
- A safety-rule reply is no longer followed by a pointless library lookup.
- Bench: the polio question also accepts Koprowski (Wikipedia credits
  Koprowski 1950 and Salk 1955); library facts are reported as their own
  set instead of inside "earlier questions".

Three calculation slips ran and gave wrong numbers; three checks added:

- *Step lost*: "=60*5/1000", "=100*5/1000", "=ANS+ANS" (ANS is only the
  line just before, so the 0.3 is lost) -- the unused-step check now
  follows each step through the chain.
- *Repeated step*: "=420/ANS" written twice.
- *Extra time conversion*: "40 km/h ... how many hours" then "/24".
- Replayed over all 258 real replies from the five runs, the checks flag
  only wrong answers.
- Tests: AI layer 117 checks; library 51 (a second stand-in book
  reproducing run 5's misses and decoys).

## 1.9.1 — One setup run fills an empty stick, library included (2026-10-20)

Adam: "if I extract the most recent zip into an empty USB on a different
laptop and double click setup-kit.bat, will it download everything,
including the wiki?" Not quite, in 1.9.0:

- Setup asked about the encyclopedia only when it had not just fetched a
  bigger model, so on a 16 or 32 GB laptop the library came on a later
  start, in the background. Now one setup run asks both questions (yes
  after 30 s each) and downloads the engine, the 4B, the bigger model and
  the encyclopedia in one go; a model that did not download properly stops
  the run with a message instead of being asked for again.
- The 1.9.0 update zip held only the changed site files. A fresh stick
  needs the whole site folder (offline-install files and the phone AI
  engine), so the delivery is now a complete kit zip.
- Kiwix listings: links with a path in front of the file name are
  accepted (some mirrors list them that way); Windows kiwix-tools falls
  back to the 32-bit build when there is no 64-bit one.
- Test: one setup run on an empty kit (sh and PowerShell) ends with the
  engine, 4B, 35B-A3B and English Wikipedia in place.

## 1.9.0 — Offline library: the AI reads an encyclopedia (2026-10-20)

Pilot of the next step after the bench runs: facts the model would
otherwise have to remember (or decline) are read from an offline
encyclopedia, with citations Lantern checks.

- **Kit:** `setup-kit library` installs kiwix-serve (kiwix-tools, GPLv3,
  newest release found from the download listing) and the newest English
  Wikipedia "mini" file (the lead section of every article, about 12 GB;
  Simple English Wikipedia, about 2.5 GB, when the drive is small or
  FAT32). `setup-kit zim NAME` adds any Kiwix file. Files are checked
  against their published SHA-256; a damaged one is deleted.
  `start-lantern` starts kiwix-serve on port 8081 with every file in
  `library/` (also for phones in share mode), and once the kit has the right
  model it offers the encyclopedia once, like a bigger model.
- **LIBRARY_ENGINE** (`Lantern.library`): finds the library on this computer
  or local network (never probes from a public web address), lists its
  books, searches (exact-title articles first, then full-text results for
  the question's words and for the words minus one, re-ranked by title
  words), reads articles as clean paragraphs, and cuts a passage per article
  (the lead plus the paragraphs sharing most words with the question,
  under 900 characters).
- **The reading turn** (`Lantern.assist.solve`, Chat): when the model
  replies `LOOKUP: <words>` -- a new verb in the prompt when a library is
  attached -- or says "Not in my library", Lantern searches and gives it up
  to three numbered passages. It answers with [n] after each fact and
  `QUOTE [n]:` lines; a fact plus a calculation ("how tall is Everest in
  feet?") may add `=` lines using the passages' numbers, which the number
  checks accept as given. Calculations never touch the library; the safety
  rules still answer dose questions before any lookup.
- **LIBRARY_CHECKS:** every cited passage needs a QUOTE; each quote must
  really be in its passage (copied, allowing punctuation and a word or
  two); every number in the answer must be in a passage it cites. Failures
  get the one correction turn; what is still wrong is shown. Assist and
  Chat show the sources with links into the library and each quote marked
  found or not found.
- **AI app > Offline library:** status, books, address (to use a library on
  another computer), and a search box showing exactly which passages the AI
  would get.
- **Bench v3:** 20 fact questions (category `fact`, 2 in the quick run),
  run only when a library is attached. A fact passes only with the expected
  fact AND a verified quote: a right answer from memory does not count.
- Limits of the pilot: the check proves a quote is real and the numbers
  match, not that the quote supports every word of the answer; search
  quality decides what the model can read.
- Tests: new `tests/library.js` (41 checks, against a stand-in kiwix-serve
  built from real replies); kit test covers the library download and start;
  checked in real Chromium against a real kiwix-serve (cross-origin search
  and reading, Assist with a verified quote, the panel).

## 1.8.6 — Kit fix: the 35B-A3B was never offered (2026-10-20)

Adam: "it does not download the 35b model for some reason?"

- **Cause (most likely, reproduced):** before offering a model, the kit
  checked that it could reach the file with a HEAD request that followed
  Hugging Face's redirect. Large files are served from signed storage links
  that can refuse a HEAD request (they answer a real download only), so the
  check failed, the kit concluded it was offline, and it said nothing. A
  stand-in server that behaves that way reproduces the silence with 1.8.5
  (16 test failures) and passes with 1.8.6.
- The check now stops at the redirect (a 302 from huggingface.co is
  enough); the download itself still follows it, as before.
- **Never silent again:** when it cannot check, it says why (no connection,
  or the status the site gave); `setup-kit check` now ends with what the next
  start will offer, or why not (already has it, answered N before, not
  enough room, FAT32, cannot reach the site), and shows the kit folder.
- New test `tests/kit_offer.py` (in `npm test`): the offer and model choice
  end to end against that stand-in, for `setup-kit.sh`, `start-lantern.sh`,
  and `setup-kit.ps1` when PowerShell is installed.
- Windows PowerShell 5.1: curl.exe is called by `.Path` (not `.Source`).

## 1.8.5 — The kit picks and fetches the biggest model a computer can run; run 4 checks (2026-10-20)

**Kit: automatic model size.** Asked by Adam: "couldn't it look at the
system it is on and automatically download the bigger model if it can run
it? This laptop has 32 GB."

- `start-lantern` (Windows, Mac, Linux) now checks, before starting, what
  this computer can run: 28 GB of memory or more Qwen3.5 35B-A3B, 16 GB 9B,
  8 GB 4B, 5 GB 2B, else 0.8B. If that is better than anything in the
  kit, the drive has room, and there is internet, it says so and asks once
  (Y, or N = don't ask again; yes after 30 s). The download runs in its own
  window (Mac/Linux: in the background with a log) while Lantern starts with
  the model it has; the next start uses the new one. Downloads resume after
  an interruption, a second start never begins a second download of the
  same file, and with no internet it starts quietly.
- It will not try to put a file over 4 GB on a FAT32 stick, or a model on a
  drive without room for it plus 1 GB; it says why and offers the next
  model that fits.
- **New top tier: Qwen3.5 35B-A3B** (unsloth `UD-IQ4_XS`, 17.5 GB,
  Apache-2.0): a mixture-of-experts model with about 3B parameters active
  per token, so it should run near the 4B's speed on a CPU with far more
  knowledge. Not yet run in Lantern Bench: run it on the 32 GB laptop.
- `start-lantern 35b|9b|4b|2b|0.8b` picks a model by hand; `nodownload`
  skips the check; `setup-kit check` lists what fits and what the kit has;
  `setup-kit xl` fetches the 35B-A3B. On a small computer the smallest model
  in the kit is used, never the biggest. `LANTERN_AUTO_DOWNLOAD=0` turns the
  offer off, `=1` downloads without asking (unattended set-ups).
- Tested with PowerShell 7 and sh against a local mirror: memory tiers,
  FAT32, low space, offline, already downloading, answering N and Y with
  a keyboard, and no keyboard (then nothing is downloaded or remembered).
  Not run on Windows itself yet.

**Bench run 4** (1.8.4, Qwen3.5 4B): 44/47 again, but the earlier
failures were fixed (the second-height Hohmann question on Lantern's
questioning, the goats question now asks with NEED). Three new slips ran
and gave confident wrong numbers; three checks added to `AI_CHECKS`:

- *Unused step*: "=40*5" then "=2000/2000" (the 200 was meant as the
  divisor): a worked step the last line never uses.
- *Seconds to the wrong unit*: ORBITT and HOHMANNT give seconds; the
  question asked for hours but the formula divided by 60.
- *Times one*: "=60*1/1000" for a battery size nobody gave.
- Replayed over all 163 real replies from the four runs, the checks flag
  only answers that were wrong (8 replies), never a correct one.
- Tests: AI layer 112 checks.

## 1.8.4 — Third bench run: 44/47; formulas checked against the question (2026-10-20)

Adam's run on 1.8.3 (Qwen3.5 4B, full prompt): **44/47**. Earlier questions
32/32, fresh 5/5, hard 7/10. The new correction turn worked live: the
"400 km orbit" Hohmann question was rejected ("radius 400 km is inside the
Earth"), the model fixed it on its second turn, and it passed. The three
failures all ran and gave confident wrong numbers:

- Hohmann "from a 300 km orbit to a 35786 km orbit": Earth's radius added
  to the first height but not the second (35786 km is a valid radius, so
  the inside-the-Earth check could not catch it).
- "How much feed do my goats need for 30 days?": `FEEDKG(2,30,800)`, with
  2 goats invented and 800 g taken from the recipe's example.
- "How many hours will my battery run a 60 W light?": `=60*1/60`, a battery
  size invented.

Changes:

- **Formulas are checked against the question** (`AI_CHECKS`, hook
  `Lantern.assistChecks`). *Number not in the question*: every number in
  the formula must be in the question, a unit factor or constant, a recipe
  constant, or one simple step from the question's numbers (pre-computed
  products, plus Earth's radius). *Height used as a radius*: a height the
  question gives ("a 300 km orbit", "420 km altitude", "35786 km above")
  used in an orbit formula with no Earth radius added. Replayed over all
  115 real replies from the three runs, the checks flag exactly the two
  failures they target and nothing else; they also pass every bench
  ground-truth formula.
- A questioned formula goes back to the model for its one correction turn
  with Lantern's reason (`Lantern.assist.solve`, kind "questioned"), in
  Assist, the bench and now Chat. If the second reply is still
  questioned, the person sees "Lantern still questions this answer".
- Prompt: every number must come from the question; a missing one is
  asked for with NEED, never guessed or copied from a recipe example; a
  worked NEED example (filling a tank, not a bench question).
- Bench rows record `retry` (rejected / questioned) and `flags`; summary
  counts `stillQuestioned`.
- Tests: AI layer 109 checks, 17 AI modules isolated, 7 AI self-tests.

## 1.8.3 — Second bench run: 36/37, and a harder bench (2026-10-20)

Adam's re-run on the same laptop and model (Qwen3.5 4B, full prompt) with
1.8.2 scored **36/37**: the questions from before 1.8.2 went from 18/30 to
29/30 (31/32 with the two planet questions), the five fresh questions
5/5, every computed answer used `{result}` (no sentence disagreed), and
the mayor question now declines. One failure: the Hohmann transfer "from a
400 km orbit", where the model again used 400 km as the radius.

- **Lantern rejects an orbit inside the Earth.** ORBITT, ORBITV, ESCV,
  VISVIVA, HOHMANN and HOHMANNT, when using Earth's default GM, now refuse
  a radius below Earth's surface with the fix in the message ("radius 400
  km is inside the Earth: radii are from Earth's centre, so add 6371 km to
  an altitude") instead of returning a confident wrong number. Other
  bodies (GM given) are not checked against Earth.
- **One correction turn** (`Lantern.assist.solve`). When Lantern rejects
  a formula and nothing was computed, the model gets one more turn with
  Lantern's reason, the way Chat already works. Assist shows the rejected
  reply and the corrected one; the bench records `rounds`, `fixed` and the
  rejected line, and the summary counts fixes on the second turn.
- The Hohmann recipe cards spell out that "a 400 km orbit" is an altitude;
  the transfer-time card no longer matches every question containing
  "hours".
- **Harder bench (v2, 47 questions).** The 4B model now passes almost
  everything, so the bench gains ten **hard** questions with no recipe
  aimed at them: distractor numbers (a 12 V pump's amp-hours), two-step
  rates (days a tank lasts a family, fuel for a trip), unit traps (miles at
  km/h, an orbit period in hours), a second altitude-vs-radius Hohmann
  question, and a new **need** category: two questions that leave out a
  number, which pass only by asking for it. Earlier, fresh and hard
  questions are reported apart.
- Tests: AI layer 99 checks.

## 1.8.2 — Fixes from the first Lantern Bench run (2026-10-20)

Adam's full bench on the USB kit (Qwen3.5 4B, llama-server, full prompt)
scored 18/30: tool 13/17, multi-step 1/7, unknown 2/3, safety 2/3. Every
failure was read and traced; this release fixes the ones Lantern can fix.
Re-grading the same 30 replies with 1.8.2 gives 22/30 before the model
sees the new prompt; a re-run is needed to measure the rest.

- **The number a person reads is now Lantern's.** Five passing answers had
  sentences that contradicted the computed value (car energy "1.5 million"
  for 375,000 J, "33 plants" for 132, "15 kWh" for 1.5). The prompt now asks
  for `ANSWER: <sentence with {result}>` and Lantern fills `{result}` with
  its computed number. A sentence that states its own number is checked:
  Assist, Chat and the bench flag one that disagrees, one that matches only
  in another unit, and one with a number when nothing was computed.
- **Safety rules answer before the model** (`AI_GUARD`, hook
  `Lantern.aiGuards`). Medicine doses, mixing bleach with ammonia or acids,
  live mains work and weapons get a fixed, number-free reply every time;
  the model is never asked. The 4B model had answered a child's paracetamol
  question with "NEED: dosage instructions". Rules need two kinds of word
  together, so molar masses, chlorinating water and Ohm's law still reach
  the tools (tested both ways).
- **Lantern repairs what the model gets nearly right.** Braces left in a
  filled recipe (`=({100}*{12})/{60}`) now run. `CONVERT` understands the
  unit words models type: m^2, m^3, ha, litres, cubic metres, square
  metres, sq km, tonnes, kilograms, pounds, miles, hours, years and more.
- **Prompt contract rewritten from the failures**: SI unless a function
  says otherwise, CONVERT only to change units, the last `=` line in the
  unit asked for, plain arithmetic for money, counts and recipes, NEED only
  for a number a function needs (it had asked for exchange rates to
  multiply 65 by 35), "Not in my library" for facts and people. Two worked
  examples.
- **Everyday recipe cards** (`AI_RECIPES`): tank fill time, bags in a
  total, field area in hectares, total cost, recipe scaling, animal feed
  from grams per day, Hohmann time from an altitude. These target bench
  failures directly, so the bench gains five **fresh** questions (heater
  kWh, bus hours, jerrycans, eggs by the dozen, room volume) with no card
  aimed at them; the report and summary line keep earlier and fresh
  questions apart so gains that only come from the cards are visible.
- `FEEDKG` is in the AI tool list; the Earth escape question finds
  `PLANET("earth","escape")`; the escape recipe says ESCV needs a radius.
- Bench v1: rows record `by` (model or safety rule) and `sentence`
  (filled, agrees, disagrees, other unit, unchecked); summary counts them;
  CSV gains the columns.
- Tests: AI layer 91 checks, 16 AI modules isolated, 6 AI self-tests.

## 1.8.1 — Fixes from the first laptop test (2026-10-20)

From Adam's screenshot of Chat on the USB kit (Qwen3.5 4B):

- **Answers were cut off mid-sentence.** Chat now allows 1536 tokens per
  reply (was 512) and says when an answer was cut short ("send continue").
- **Raw markdown** (`**bold**`, backticks) showed as symbols. Chat now
  renders bold, inline code, headings and `=` lines, escaped first.
- **Planet data came from the model's memory** (it typed Mars's mass and
  radius). New `PLANET_DATA` module: `PLANET("Mars","escape")` and friends
  from NASA NSSDCA fact sheets (Sun, Mercury to Neptune, Moon, Pluto: mass,
  GM, radius, equatorial radius, gravity, escape velocity, distance,
  period), in the AI tool list with three recipe cards (escape velocity,
  weight on another body, orbit period around another body), two bench
  questions and a self-test.
- Tests: AI layer 46 checks, 14 AI modules isolated.

## 1.8.0 — On-device AI test build (2026-10-19)

Phase 1 of the Lantern Edge AI Plan (`docs/Lantern_Edge_AI_Plan.pdf`): a
small language model that uses Lantern's tools as its source of truth,
running on a phone inside the page, or on a laptop / USB stick through
llama.cpp. 13 new modules (220 to 232); every one removable on its own.

- **One route for every model call** (`AI_ENGINE`, `Lantern.ai`,
  `Lantern.aiRoute`). Assist and Chat now send model calls through it.
  Engines: *server* (OpenAI-compatible; found automatically when
  llama-server serves Lantern itself) and *device* (in the page). Choice:
  Automatic / On this device / Server.
- **On-device engine** (`AI_DEVICE`): llama.cpp compiled to WebAssembly
  (wllama 3.8.1, MIT, vendored in `site/ai`), WebGPU where available,
  compatibility build for Safari and older browsers, all self-hosted so it
  works offline. Models: Qwen3.5 0.8B (533 MB) and 2B (1.28 GB), downloaded
  once into the browser's file store, or loaded from a `.gguf` copied onto
  the phone (with an option to keep a copy).
- **AI app** (`AI_APP` + panels): engine status and choice, device
  capabilities (GPU, engine build, threads, memory, storage), model
  download / load / delete, server settings with a connection test, a
  *Try it* box with timing and speed, offline / install status.
- **Lantern Bench** (`AI_BENCH_DATA`, `AI_BENCH`, `AI_PANEL_BENCH`): 30
  questions (tool, multi-step, unknown, safety); answers are proved on the
  formula engine at run time; quick (9) and full runs; JSON / CSV export.
- **Short prompts for small devices** (`AI_PROMPT`, hook
  `Lantern.assistToolFilter`): on the device engine Assist lists only the
  functions the question needs (about 400 tokens instead of about 950);
  Automatic / Short / Full, recorded in every bench report. Repeated
  prompt prefixes are reused (prompt cache).
- **Grounding rule in the Assist prompt:** questions the tools cannot
  answer (facts, news, people, prices, medicine doses, dangerous work) get
  "ANSWER: Not in my library."
- **Fixed AI tool catalog units** (the model was told the wrong units):
  `WAVELEN` takes MHz (was documented as Hz, a factor of a million),
  `FRES` takes nH and pF and returns MHz, `MATCHSER`/`MATCHSH` take
  (r, x[, z0, sign]) and return ohms / siemens.
- **Website build** (`site/`, `tools/build_site.py`): Lantern served as a
  plain page plus offline worker (`lantern-sw.js`), install manifest,
  icons, and optional cross-origin isolation for multi-threading.
- **Laptop / USB kit** (`kit/`): `setup-kit` fetches llama.cpp b11435 and
  Qwen3.5 models; `start-lantern` picks the model by memory, runs
  `llama-server --path site`, opens the browser; `share` serves phones on
  the local network.
- **Tests:** `npm test` 15 checks: adds AI layer (42: routing, same-origin
  detection, Assist/Chat through the route, short prompts, app, bench
  grading with a perfect and a bad fake model) and isolation for the 13 AI
  modules.
  Verified for real against llama-server built from source with a GGUF
  model (kit, Assist, Chat, Bench, offline reopen), and the in-browser
  engine in Chromium (fast and Safari-compat builds, kept copy reloaded
  after restart, queued requests, multi-threading via the worker switch).

## 1.7.0 — Compose: a complete writing suite (2026-10-19)

Lantern now teaches and supports **writing composition**, not just typing:
the letters, CVs, essays, reports, notices and forms that change what
happens to people. Everything runs offline on the same single file. 32 new
modules (188 to 220), all under the size gate and each removable on its own
(rule 11).

- **Compose app** (new, second on the home screen). Four tabs:
  - *Write*: 18 guided tasks (request, complaint and job-application letters,
    CV, thank-you letter, argument essay, story, summary, report,
    description, speech, personal statement, community notice, SMS, meeting
    minutes, funding proposal, incident report, news story). One part at a
    time, with a tip, help text and tap-to-insert sentence starters. Drafts
    save as you type; Preview shows reading level and suggestion count;
    *Open in Writer* builds the finished document.
  - *Practice*: 60 prompts at three levels and six kinds, word goal, timer,
    *Check my writing*, daily streak.
  - *Mail merge*: a Writer letter with `{{Name}}` gaps plus a Sheets list
    gives one printable document or separate documents. *Try an example*
    builds a sample.
  - *Learn*: 18 writing lessons, opened by the checker's *Why?* buttons.
- **Writer: Check.** Offline checker for spelling (412 common misspellings),
  grammar and confused words (39 rules: *should of, your welcome, a apple,
  bigger then* ...), punctuation and spacing, and style (long sentences,
  wordy phrases, passive voice, *very*). Show / Change to / Ignore / Why?;
  *Fix all safe* applies only the certain fixes. Live reading-level line
  (grade and ease) while you type. Headings, list items, all-bold
  subject lines and dialogue tags (*"Run!" shouted Ama.*) are not flagged.
- **Writer: Aa Words** (189-headword thesaurus; choices come back in the
  selected word's form: *walked* gives *strolled*, *quickly* gives *rapidly*,
  *things* gives *objects*; every choice for 845 test words is a dictionary
  word), **Read aloud** (sentence-by-sentence with
  highlighting, device voices), and **26 new templates** (30 in all).
- **Cards**: three writing decks (spelling, confused words, punctuation).
- **Guide**: Compose help plus new Writer sections. **Locale**: Compose
  labels in the 8 installed languages.
- **Host hooks**: `Lantern.writerDocs` (list/get/create/open) and
  `Lantern.sheetDocs` (list/values/create), documented in rule 10.
- **Forge self-tests**: 9 Compose tests, registered only when the modules
  they need are present.
- **Tests**: `npm test` now 13 checks, adding Compose engine (81),
  Compose app end to end (47) and per-module isolation for all 32 modules.
  Also verified in real Chromium at phone and desktop sizes: 42 apps, no
  page errors.

## 1.6.0 — v1.6 rebuilt from session history (2026-10-19)

The original `Lantern_Office_Suite_v1_6_STANDALONE.html` (Aug 2026, 252
modules + a Studio script block) was not recoverable. This build starts from
the last surviving file (v1.5.0, 160 modules) and restores every later change
whose source survives in chat history. Each module was regenerated by
replaying that session's own tool calls, not retyped; the method was
calibrated by regenerating the July 15 RF Bench modules byte-identically.

- **Fix: BOOT first paint** (Jul 27). Under the self-unpacking bundle only
  24 of 37 apps appeared on first open; the shell start is now deferred one
  tick so every app is on the first home paint.
- **Health split** (Jul 13). HEALTH_LESSONS + new HEALTH_LESSONS_EMERGENCY,
  6 new lessons, Health app in two sections.
- **Paper sizes and page setup** (Jul 13). WRITER_PAGES, SHEET_PAGES,
  SHEET_PRINT, SHEET_CSV, GUIDE_PAGES; rule 11 (isolation); hooks
  writerEditHooks / writerSerialize / sheetEditHooks; Writer word-count fix.
- **Deckplate music player** (Jul 20). 10 modules.
- **AI tool layer and Forge** (Jul 20). ASTRO_CELLS, ASSIST_*, MOD_FORGE,
  FORGE_APP, ASSIST_CHAT, GUIDE_AI.
- **Hardening.** Quote characters in 6 regex literals written as escapes
  (identical matching, fuzz-proven); REPAIR_LESSONS and LOCALE_WORLD split
  under the size gate (registrations byte-identical).
- **Tests.** `npm test`: 10 checks including the recovered session suites.

Not in this build (no recoverable source): the July 7 Flight / Build /
Wilderness apps, 16 domain cell functions, tiered physics lessons and
PHYSICS_DRAWINGS (that chat is unreadable), and the Studio (Generative Music
Studio) tile, which was merged outside the chats.

## 1.5.0 — baseline

The file as uploaded: 160 modules, 37 apps, CORE through GUIDE_RF.
