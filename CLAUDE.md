# Working on Lantern

Read this first. Then read `agent/QUEUE.md` (what to do next) and the newest
file in `agent/reports/` (what the last session did and left open).

## The aim

Adam Weldon directs this project. His words (2026-11-05):

> Each module of lantern should be added to with the maximum extent you can
> apply for the purpose of maximizing the rebooting of civilization from a usb
> stick and making all of the answers the AI can give as good as possible from
> this combination to negate the need for servers and wasting of energy since
> the system can run offline locally on lower power without the internet.

So every change should make one of these true:

- a person with only the USB stick can learn, build, repair, grow or heal
  something they could not before; or
- a small offline model, using Lantern, gives a right answer where it gave a
  wrong one (or says plainly that it does not know).

## Who does what

- **Adam directs; Claude writes the code.** Commits are authored by Claude and
  committed as Adam:
  - author `Claude <noreply@anthropic.com>`
  - committer `Adam Weldon <124394482+adamweldon@users.noreply.github.com>`
  - trailers: `Directed-by: Adam Weldon <...same address...>`, then the
    `Co-Authored-By` and `Claude-Session` lines the session gives you.
- **Only Adam decides:**
  - merging to `main` (a push to `main` publishes `Lantern.zip` to everyone);
  - anything judged by ear or eye (how a song sounds, how a page looks to a
    teacher or a tradesman);
  - which of two good directions to take.
- Do not wait on him. Put the question in the report and in
  `agent/QUESTIONS.md`, and take the next item in the queue.

## Branches and versions

- The line of work is the highest-numbered `lantern-x.y.z` branch on GitHub
  (`git ls-remote --heads origin 'lantern-*'`). Start from it.
- One branch per version: `lantern-<next>`. Push the branch. Never push `main`.
- A version bump touches: the header line and `version:` in
  `src/lantern.inner.html`, `package.json`, `package-lock.json` (twice), and a
  new entry at the top of `CHANGELOG.md`. Then rebuild (below).
- Write the changelog entry the way the others are written: what was seen,
  what it was traced to, what changed, what was tested, what was not.

## Build and gates

```sh
npm ci                                   # once per clone
# edit modules in src/lantern.inner.html
python3 tools/build_site.py              # site/index.html and site/lantern-sw.js
node tools/bundle.js encode Lantern_Office_Suite.html src/lantern.inner.html Lantern_Office_Suite.html
npm test                                 # every suite; about 6 minutes; must end ALL CHECKS PASS
python3 tests/browser/<name>.py          # real-browser tests (Playwright + Chromium); run the ones your change touches
python3 tools/make_lantern_zip.py <dir>  # Lantern.zip, one Lantern folder inside
```

The rules are in the header of `src/lantern.inner.html` (rules 1 to 11). The
ones that catch people out:

- ES5 only: no arrow functions, `let`/`const`, template literals.
- Every module sits between its `MODULE: NAME - START` and `- END` markers and
  must be droppable: feature-detect every hook, never reach into another
  module.
- No quote characters inside a regex literal. Write `\x27` and `\x22`.
- A module named in another's `Depends:` header must not lead back in a circle.
- Prefer a hook (`Lantern.chatAbout`, `Lantern.musicIntent`, ...) over editing
  a big module.
- Non-ASCII characters in code are written as escapes (`\u2019`, `\u00b0`).
  A session's own tools turn an escape typed into a file into the character
  itself (found 2026-11-06, in a shell heredoc and in a whole-file write):
  patch with a script that emits the backslash, and count the characters
  afterwards.

## How Lantern and the AI share the work

These are Adam's design rules, in the order they usually apply.

1. **The least-action path is the right one.** Whatever the model is most
   likely to write should come out correct. If a model keeps making the same
   mistake, change what Lantern gives it or how Lantern reads it.
2. **Correct by construction, and said.** Lantern does the part that can be
   computed (pipes a circuit, counts bars, chooses chords, stands a mountain
   on the horizon) and says what it added or changed. A model writes
   numbers; it does not see what they draw.
3. **What cannot be right goes back once, with the line to write.** Name the
   place, say why, and write out the corrected line. A list of choices, or the
   whole guide again, does not get fixed. Nor does an example: "add a note
   like ... {=100*200/(100+200)} ohm" came back word for word under a circuit
   of 4, 6 and 12 ohm (1.24.5). The line is for THIS question, with its own
   numbers, or Lantern adds the thing itself and says so.
4. **Lantern supplies what it knows.** A tested example in the language asked
   for, the lines of a tune it knows, a fact from its tables: give it to the
   model with the question.
5. **Keep the prompt short.** A small model loses instructions far back in its
   context. Offer only the tools the question is about.
6. **Never write a bench answer into Lantern.** A change must help every
   question of its kind. If the only way to pass a question is to know its
   answer, leave it failing.
7. **A rule that changes what a model wrote must be surer than the model.**
   "Could this be a mountain?" is not enough to move it: the rule has to ask
   what else it can be (a roof, a sail, a kite, an umbrella) and act only
   when the answer is nothing. The same for a line handed to a model to
   copy: a recipe is filled only when the question asks for what the recipe
   gives, in a unit it can be said in. A picture Lantern leaves wrong is as
   the model drew it; a right picture it spoils, or a wrong sum it hands
   over as the recipe, is Lantern's doing.

## What goes into the lessons and tables

People will act on what Lantern says with nobody to ask. So:

- **Right before more.** Add what you can check against a source you can name:
  a public-domain or openly licensed text, a standard, a figure that can be
  derived. Say where it came from in the lesson or the changelog. If you are
  not sure, leave it out and list the gap in the report.
- **Health, medicine, food safety, water, electricity, pressure, engines:**
  give the cautious version, say when to get a trained person, and never
  invent a dose, a time or a temperature. A new dose or drug instruction is
  Adam's to approve: put it in `agent/QUESTIONS.md`, not in the tile.
- **Licences.** Lantern is CC0. Take text only from the public domain or CC0;
  facts and figures from anywhere, in your own words. No song lyrics, and no
  melody first published after 1928.
- **Numbers the AI can use.** A table or formula a person needs is better as a
  formula function or a lesson the AI can reach (LESSON:, LOOKUP:) than as
  prose only.
- **A checker that could open nothing has checked nothing.** Lessons are
  checked by a separate agent that has not seen the drafting, against pages
  it opens. If it could not open a page, what it says is memory: the lesson
  waits (on a `wip-` branch), it does not go in. Then read each figure again
  yourself on its page before it goes in. Found 2026-11-06: a session with
  nobody at the app could open `cdc.gov` and `nchfp.uga.edu` and no other
  site (WHO, FAO, FDA, USDA each needed Adam's approval), and web searches
  are counted for the whole turn, checkers included (200), so spend them on
  the checking.
- **So the AI finds it.** Write a procedure as a list (Chat's passage then
  keeps every step). Give a lesson the words people will ask with in
  `LESSON_WORDS` when its title does not carry them. Try the questions a
  person would ask (`tests/lesson_search.js` has the pattern).

## Evidence

- A bench run's failed rows go in `tests/fixtures/bench_run_<version>_<model>.json`
  as the model wrote them, and tests replay them.
- **The same request does not always get the same reply.** The model server
  reuses its prompt cache, and llama.cpp says results then need not repeat. One
  row moving between runs is not a finding. The same row twice is.
- Say what was run and what was not. A fix checked only against a stand-in
  model is "tested with a stand-in", not "works on the 35B".
- **A new rule is tried by someone who did not write it.** Before a rule
  that mends, reads or fills goes in, a separate agent that has not seen it
  written makes inputs of its own (right ones above all) and tries to break
  it. What it wrote goes in `tests/fixtures/` and stays. Found 2026-11-06
  (1.24.7): the first draft's own tests all passed; a reviewer's 91 right
  pictures had 46 changed or questioned, and of its 160 filled sums 86 were
  wrong ("how many teaspoons of bleach" was given the recipe for drops).
  The tests had been written by the same hand as the rules, from the same
  cases. Mend what it finds, then have it tried again by another.

## The bench on Adam's laptop

The 35B (Qwen3.5-35B-A3B) runs on Adam's laptop from the `D:` USB stick. A
chat linked to that laptop through the Claude desktop app can run the bench
with nobody clicking. This was first done on 2026-11-05.

1. The folder `D:\Lantern` must be connected to the chat (ask once).
2. Open `http://127.0.0.1:8080/health` in the app's browser pane.
   `{"status":"ok"}` means the model is loaded. Claude cannot start or restart
   the model: Adam double-clicks Start Lantern. If nothing answers, say so.
3. To put a build on the stick, copy `site/index.html` and
   `site/lantern-sw.js` into `D:\Lantern\site`. The model stays loaded: the
   server reads that folder at each request.
4. Open `http://127.0.0.1:8080/?v=<version>-<first 8 of the file's sha256>`.
   The server sends no cache rule, so a plain reload can show the old page.
   Check `Lantern.version` in the page before running anything.
5. Evaluate `tools/bench_pane.js` in the page, then:
   - `lanternBench.start()` for the full run, `{ quick: true }` for the quick
     one, `{ ids: [...] }` or `{ match: "^make-music" }` for chosen questions;
   - `lanternBench.status()` to see where it is;
   - `lanternBench.rows("failed")` for the failed rows as the model wrote them.
6. Times on that laptop: the quick run about 12 minutes, the full run 67 to 80
   (118 questions, 112 of them scored, 3.5 to 4.1 tokens a second; 120 and
   114 from 1.24.7).
7. Leave the stick on a build that passed, make the whole folder agree
   (`Lantern_Office_Suite.html`, `CHANGELOG.md`), and tell Adam which version
   it is. His `E:` stick is the copy he keeps untouched.

The encyclopedia questions are left out of runs made this way. The library
itself runs (`http://127.0.0.1:8081` opened in the pane says "Welcome to
Kiwix Server"), but the app's browser pane does not let Lantern's page on
port 8080 make requests to another port (found 2026-11-05). A run in Adam's
own Chrome, through the Claude extension, would include them.

## The bench with the small models, on GitHub

The aim is small models. Every push to a `lantern-x.y.z` branch starts the
"Lantern Bench" workflow (`.github/workflows/lantern-bench.yml`): the kit's
own installer and start script on a GitHub computer (4 cores, 16 GB, no
graphics card), then the whole bench in a headless browser
(`tools/bench_headless.py`), once each for the 0.8B, the 2B and the 4B. It
needs nobody and no laptop. A job is green when the run finished, whatever it
scored. A push that changes only `agent/`, `docs/`, `README.md` or
`CLAUDE.md` does not start it, and nor does a new branch whose last commit
changes nothing outside them (found 2026-11-08: an empty version commit on
top of the work started no run; a session cannot start one by hand, the
dispatch is refused).

```sh
gh run list --repo adamweldon/Lantern_Office_Suite --workflow "Lantern Bench" --limit 6
gh run view <run id> --repo adamweldon/Lantern_Office_Suite --json jobs --jq '.jobs[] | "\(.databaseId) \(.name) \(.status) \(.conclusion)"'
gh api repos/adamweldon/Lantern_Office_Suite/actions/jobs/<job id>/logs > job.log   # works as soon as that job has ended
grep -n 'scored questions' job.log; sed -n '/=== FAILED ROWS/,/=== END FAILED ROWS/p' job.log
```

- The log has the summary table and, between `=== FAILED ROWS` and
  `=== END FAILED ROWS ===`, every failed row as one line of JSON (the
  question, why it failed, the model's reply). `gh run download` (the
  artifact, with the whole `report.json`) was refused from a cloud session on
  2026-11-05: the artifact store is another site. The log was not.

- Read the runs of the branch you start from before choosing what to fix: a
  question the 4B fails that the 35B passes is the work this project is for.
- What the rows of 1.24.4 taught (the 2B 46%, the 0.8B 15%, the 35B 98%): a
  small model copies what is in front of it. It wrote the instructions' own
  example of a NEED for four unrelated questions, the example sum's `/1000`
  where none belonged, and `NEED:` followed by the question because the
  instructions said `NEED: <question>`. So before changing how Lantern reads
  a reply, look at what the instructions showed the model. An example in a
  prompt is the likeliest thing a small model will write.
- What the rows of 1.24.5 taught (the 4B 91%, the 2B 56%, the 0.8B 25%; the
  35B 99%):
  - what Lantern sends BACK is copied as surely as what it shows first: the
    example sum in a request for a note, the tested example that came with
    the question (Blink, for "without delay"), the two pins and the button
    of a guide's example in a relay driver;
  - a recipe card that nearly fits is copied as it stands: both Hohmann
    cards were wrong for two heights, and three models wrote what the cards
    showed. Give the card whose blanks are what the question has;
  - a NEED or a decline often means the model did not see that Lantern has
    the thing (Earth's radius is in the recipe; there is a function for
    Fahrenheit): answer with the recipe's line.
- What the rows of 1.24.6 taught (the 4B 96%, the 2B 51%, the 0.8B 46%; the
  35B 99%):
  - what stands AFTER a line to copy is copied with it: the short prompt
    showed "=VOLTS({amps},{ohms})   -> volts", and the 2B wrote "=VOLTS(0.02,
    470) -> volts" in 24 replies. Say what a line gives above it, never
    after it;
  - read the line as the model wrote it before sending anything back: 18 of
    the 2B's 27 failed sums were right sums with an arrow after them, a
    number typed on the next line, or the numbers in the recipe's braces;
  - keep a guard of right replies and run every new reader and check over
    it: the 35B's 45 sums caught "=2000/ANS" being read as a typed number;
  - a check written from one model's row can misfire on another's (the 4B's
    comment "without using delay()" was read as a call).
- Pictures: the log prints every drawing a model made, passed or not,
  between `=== DRAWINGS` and `=== END DRAWINGS ===` (from 1.24.7).
  `python3 tools/draw_log.py job.log <dir>` draws each one as written and
  as Lantern draws it, side by side (`sheet.png`). Look at them: a row
  that passes says nothing about how its picture looks. How a picture
  looks to a person is Adam's to judge; send him the sheet.
- A run took about 36 minutes for the 2B, 50 for the 0.8B and 100 for the 4B
  on 1.24.4. Since 1.24.5 the 2B and the 0.8B get the short prompt (only
  the functions the question is about), and **the 2B's run took 102
  minutes**: a prompt that differs for every question is read afresh each
  time (the server keeps only what two requests share from their first
  character), about 1,000 tokens at 76 a second on GitHub's computer.
  1.24.6 halves it: 48 minutes for the 2B, 40 for the 0.8B, 69 for the 4B.
  Read the run's minutes as well as its score; the row count and the mode
  are in the log's summary.
- The log prints a made thing's replies whole from 1.24.6 (a program was cut
  at 700 characters before, and could not be replayed).
- The failed rows of a run you act on go in
  `tests/fixtures/bench_run_<version>_<model>.json`, and a test replays them.
- The same care as on the laptop: one row moving between two runs is not a
  finding. The same row failing on two versions, or on two models, is.
- `python3 tools/bench_headless.py --url <address>` does the same against any
  running Lantern (for example Adam's laptop, by hand).
- Inside a cloud session the engine can be fetched
  (`sh kit/setup-kit.sh engine`) but the model files could not (their site
  was not reachable from the session on 2026-11-05; `curl -sI
  https://huggingface.co` says whether it is now). So a small-model run is a
  push and a read of the workflow, not something done in the session.

## A session with nobody watching

Some sessions are started by a schedule (`agent/NIGHTLY.md` is their
instruction) and have no laptop and nobody to ask.

- Take the first item in `agent/QUEUE.md` that needs neither Adam nor his
  laptop; normally the next tile audit. One item, done properly.
- Pass the gates, publish it as the next version on its own branch, update
  the queue, write the report. Never `main`.
- If the gates cannot be made to pass, or the work is unfinished: push it to
  `wip-<date>` instead of a version branch, and say at the top of its report
  what is unfinished. A session that starts looks for a `wip-*` branch that
  is not yet part of the newest version, and finishes or drops it first.
- End with a short message to Adam in plain words: the branch, what a person
  or a small model can do now that they could not, what was tested and what
  was not, any question that is his.

## The queue and the reports

- `agent/QUEUE.md`: the work in order, and every tile with what has been done
  to it. Update it in the same commit as the work.
- `agent/reports/<date>-<version>.md`: one per session. What changed, what was
  run and on what, what is open.
- `agent/QUESTIONS.md`: what only Adam can answer. Short, newest first. Remove
  a question when he has answered it.
- Adam's phone does not show `.md` files. Anything written for him to read is
  a chat message or a PDF.
