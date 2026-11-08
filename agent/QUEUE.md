# Queue

What to do next, in order, and what has been done to each tile. Update this
file in the same commit as the work. Read `CLAUDE.md` first.

## Next, in order

1. **Read the small models' run on 1.24.7 and act on it.** Every push to a
   `lantern-x.y.z` branch runs the whole bench with the 0.8B, the 2B and the
   4B on GitHub (`CLAUDE.md`, "The bench with the small models"). On 1.24.6:
   **4B 107 of 112, 2B 57, 0.8B 51** (the 35B: 111 of 112 without the
   library on the laptop pane; 134 of 138 with it, in Adam's own browser,
   2026-11-08). 1.24.7 was written from those rows
   (`tests/fixtures/bench_run_1246_*.json`) and from two pictures Adam made
   with the 35B; no model had run it when it was pushed. So first:
   - **the 2B's sums.** It had 18 of its 27 failed sums right but for how
     it wrote the line (an arrow after it, a number typed under it, the
     numbers in braces). Eight reviews took the readers for the arrow and
     the second = out (each version handed over wrong numbers where 1.24.6
     sent the reply back): replayed as written, none of the 27 passes, as
     on 1.24.6. The short prompt no longer shows "-> volts" after a
     recipe's line, and a line with an arrow goes back with what is wrong
     said: does the 2B still write arrows? Does it fix them on the second
     turn? How many pass? A both-versions hole to look at with the rows:
     "= 65*35 = 2275" is worked out as a test (1), unquestioned.
   - **the two scene questions** (new: `make-shore-sunset`,
     `make-road-horizon`), and every other drawing: the log prints each one
     between `=== DRAWINGS` and `=== END DRAWINGS ===`. Draw them
     (`python3 tools/draw_log.py job.log <dir>`), look at the sheet, and
     send it to Adam. What do the models write with the landscape guide
     and its example? Do they copy the example whole?
   - the minutes (48, 40 and 69 on 1.24.6).
2. **1.24.8, ready on the side** (from Adam's run of the 35B on 1.24.6 with
   the library, `tests/fixtures/bench_run_1246_35b_library.json`; the
   patches and their tests were written in the session of 2026-11-07 and
   wait for 1.24.7's run):
   - **the part of an article that answers.** A repair guide's steps
     without its readers' comments (iFixit keeps a step's comments inside
     its list item); a travel guide's own section for getting around,
     getting there, eating, sleeping, crime, sights; the sentences that say
     what a thing is made of. Stand-in pages laid out as the offline files
     are, and a guard: every other passage of the test pages is unchanged;
   - **a held note a half step from its chord** is mended where Lantern can
     compute it (the chord of the key that holds it, in a bar of one chord;
     the nearest note of the home chord at the song's end), and said. The
     35B was told the chord and wrote the same one again on 1.24.0 and
     twice on 1.24.6. **This one waits for Adam** (item 13 below; asked in
     `QUESTIONS.md`, 1): it changes what the model wrote, and how a song
     sounds is his;
   - both need a reviewer who did not write them before they go in. The
     library change has had three (2026-11-08: 69, then 8, then 37
     breaks, each mended; a fourth was trying the mends when 1.24.7 was
     pushed). It is on `wip-2026-11-08-library`, built on 1.24.7, with its
     tests and the reviews' pages; what is left is the fourth review.
   The filled recipes (a recipe given to a small model with the question's
   numbers in it) are on `wip-2026-11-06-recipe-fill`, out of 1.24.7: two
   reviews found them wrong too often, and a list of words to refuse is
   never finished. The next attempt fills only a question whose every word
   Lantern knows (its note there says how).
   Then, from what the rows of 1.24.6 show and 1.24.7 does not touch:
   - **A guide copied whole.** The 2B and the 0.8B copied the hydraulic,
     pneumatic, control and electronics guides into their blocks, line for
     line, with the explanations, the continuation lines and `<title>`,
     `<text>`, `<name>`. Those guides are a table of every line Lantern
     reads. For a small model: the tested example nearest the question and
     a short list of lines, so that what it copies is a block.
   - **The example sum copied** (the 0.8B: `=65*35/1000` and "They cost
     {result}." for a solar panel's kWh, a heater's, a water tank's days).
     A recipe is copied instead of the example when there is one: cards for
     the sums a household asks (watts x hours in kWh and what that costs,
     litres a person a day, a journey's time from distance and speed, the
     price of so many from the price of a pack) would be general recipes,
     each with blanks a unit names.
   - **Units written inside a sum** (`=3 cups * 15 people / 6 people`,
     `=120*m*80/m/10000`: the 2B, once each).
   - **A number nobody gave, unquestioned.** `=100*12/60` for "How many
     hours will my battery run a 60 W light?" passes Lantern's check: 100
     and 12 are factors a sum may always use (percent, a dozen), and so is
     a number of the question times or over one (60/12 = 5). Only the bench
     catches it. Tighten it against the 35B's right sums
     (`bench_run_1244_35b_sums.json`) and a run.
   - **A number of the question no line uses** (`=60*5/1000*0.15*30` with
     the 100 W TV left out). Question it once: "the question also gives
     100 W".
   - **"From a 300 km orbit to the Moon's distance, 384400 km from Earth's
     centre"** is given the recipe for two radii: a body named in the
     question hides the height (AI_CHECKS' heights returns none when
     another body is named).
   - **The 4B with the short prompt.** The workflow takes an input `prompt`;
     run it both ways (never on a branch whose run is in progress: a second
     run cancels the first) and keep what scores better.
   - **Puzzles.** The 2B passed 1 of 10 on 1.24.6 and the 0.8B none; they
     write a block now, with lines Lantern cannot run ("move Gold to left
     of Gold", the question's own sentences as steps). The host who does
     not know where the car is (`doors-host-guesses`) has no tool: the 4B
     and the 2B answered the classic puzzle.
   - **LESSON: for a program** ("Tank fill/stop logic") was read the Volume
     lesson: "fill" in its title, "tank" in its text. The 4B wrote that
     line 30 times on 1.24.6 and then a program in a fence that Lantern did
     not read as one.
   A question the 4B fails and the 35B passes comes before a new feature.
   Fix what Lantern gave the model or how it read the reply, for every
   question of its kind; put the failed rows in `tests/fixtures`.
3. **Pictures.** Adam's direction (2026-11-06): get the fundamentals of a
   scene right first -- what stands on what, what is behind what, how
   things narrow with distance -- and then let the AI draw many small
   pieces that Lantern puts together into a bigger, more detailed picture.
   1.24.7 does the first for mountains, the sun and a road (AI_SCENE),
   for a plain landscape asked in plain words only: three reviews showed
   that a rule which guesses spoils more right pictures than it mends
   wrong ones. Next:
   - **the 35B on 1.24.7**, when the laptop is linked: Adam's two requests
     and the two scene questions, and what it writes with the landscape
     guide. Its picture is the test; send Adam the sheet;
   - **the look turn.** The 35B said LOOKS RIGHT to mountains in the air.
     It is now told what Lantern changed. It could also be asked what
     Lantern cannot work out (is each thing the request names in the
     picture? does anything hang in the air?). Try it on the laptop and
     keep it only if it catches more than it breaks;
   - **things that stand.** A house or a tree whose foot is above the
     ground line has not been seen yet; look for it in each run's drawings
     before writing a rule for it;
   - **more than plain landscapes.** A tent by the lake or a house on the
     hill is left as the model drew it, mountains in the air and all. The
     words Lantern knows can grow one at a time, each with right pictures
     of its own tried by a reviewer;
   - **pieces.** Two ways were put to Adam (`QUESTIONS.md`, 1): words for
     things Lantern places (mountain, road, tree: the model says what and
     roughly where, Lantern does the ground line, the order and the size
     by distance), or pieces the AI draws each on a grid of its own, which
     Lantern places by the point where the piece stands. His to choose;
   - small things found: a circle written with four numbers (the 2B,
     once); AI_MAKE_LAYOUT's `inside` reads an oval as a centre and two
     radii, AI_DRAW draws it as a box.
4. **Confirm each new version on the 35B, twice**, when a chat is linked to
   Adam's laptop (`CLAUDE.md`, "The bench on Adam's laptop"). A version that
   has not had a full run says so in its report. 1.24.6: one full run (111
   of 112) on the build before its last change, the four music questions on
   the build that was pushed, and a second full run of that build stopped
   at 73 of 118 with nothing scored failing (Adam said to stop); then a full
   run with the library by Adam himself (134 of 138, 2026-11-08). 1.24.7:
   none yet.
5. **Finish the five Food lessons on `wip-2026-11-06`.** They are drafted
   and were checked from memory only; the checker's memory differs from the
   drafts where it matters (kidney beans, cassava, the hay box). They need
   the pages of WHO, FAO, the US FDA and USDA's food safety service opened
   -- which needs Adam at the app to approve them, or a session that may
   fetch them. The branch's `agent/wip/README.md` says what to do.
6. **Tile audits**, one tile a session, in the order of the table below. For
   each tile:
   - open it in a real browser and use everything in it; fix what is broken,
     each fix with a test;
   - read its lessons and data against the aim: is what a person needs to
     learn, build, repair, grow or heal with this subject here, and right?
     Add what is missing, from what is public domain or openly licensed, and
     say where it came from;
   - **have every figure and instruction checked by a separate checker that
     has not seen the drafting**, against sources it opens itself, old
     lessons as well as new. In Health this found 30 things to change in the
     drafts and 13 in lessons that had shipped for weeks; in Food, 13 in the
     tile as it stood. **A checker that could open nothing has checked
     nothing**: what it could not read does not go in (Food, 1.24.5);
   - then **read each figure again yourself on its page** before it goes in;
   - give the lessons their words in `LESSON_WORDS` (what people will ask
     with), and try twenty questions a person would ask: does Chat find the
     lesson (`tests/lesson_search.js`)?
   - write a procedure as a list, so Chat's passage keeps every step;
   - check what the AI can reach of it (LESSON:, LOOKUP:, formula functions,
     MAKE tools) and add the hook when it cannot;
   - write the tile's row below, and the gaps left, in the report.
7. **Lessons Lantern does not have, which people will ask for** (found by
   asking, 1.24.5): making soap, keeping bees, pruning, sharpening a knife,
   a rocket stove, wiring a lamp to a battery, a solar charger; and the
   five held Food lessons. Each belongs to a tile's audit (Repair, Farming,
   Animals, Engineering).
8. **The offline library in the runs.** On the laptop it works, but the
   Claude app's browser pane does not let Lantern's page reach it, so runs
   made there leave out the encyclopedia questions. A run in Adam's own
   browser includes them: he made one on 1.24.6 (Firefox, 2026-11-08: 21 of
   the 24 library questions; the three misses are item 2). The GitHub runs have no
   library either: the Simple English one, 2.5 GB, would fit: worth adding
   to the workflow for one model.
9. **The kit's 8,192 tokens.** Lantern now shortens a request that is too
   long and sends it again (AI_FIT). Better not to get there: measure what
   Chat sends in a long puzzle conversation, and what 16,384 tokens cost in
   memory for the 0.8B, the 2B and the 4B. Whether to raise it is Adam's.
10. **Pictures for the Health lessons.** The recovery position, where the
   hands go for chest pushes, the tippy tap, the pit latrine, the arm
   measurement: a drawing each would carry more than the words. Lantern can
   draw (Draw's shapes, SVG). Whether a drawing is clear is Adam's to judge:
   make them, show him, keep what he passes.
11. **Words that differ by an ending** ("charger" and "charge", "purify" and
   "purification") do not match in Lantern's search. `LESSON_WORDS` covers
   the cases found; the stemmer itself could do more, with care (it is used
   everywhere).
12. **Songbook.** Nine tunes so far, all starting on the first beat. Tunes
    that start with a pickup (Amazing Grace, Auld Lang Syne, Brahms' Lullaby,
    Greensleeves, Happy Birthday's 1893 tune) need a pickup bar checked
    through the score, the parts and the arrangement first.
13. **A second try that changes nothing.** In the run on 1.24.0 three songs
    came back unchanged or worse after Lantern's send-back. 1.24.2 writes the
    line to use. If a model still sends the same block, decide with Adam
    whether Lantern should apply the fix it named and say so. It did again:
    the 35B's waltz on 1.24.6 (2026-11-08) and its tune of its own on 1.24.6
    (2026-11-06). The mend for a held note against its chord is written and
    tested (item 2) and asked of Adam (`QUESTIONS.md`, 1).
14. **The 1.16.0 audit's feature list** (`Lantern_1.16.0_app_audit.pdf`, sent
    to Adam on 2026-10-29) was never answered. With the aim above, take the
    features that serve it without asking again; leave the rest.

## Tiles

"Audited" means: every control used in a real browser and bugs fixed with
tests (the 1.16.0 pass); from 1.24.4 also the lessons read against the aim,
checked against sources by separate checkers, and what the AI can reach;
from 1.24.5 also each figure read again on its page, the words people ask
with, and twenty questions tried in the search.

| Tile | What it is | Audited | Notes |
|---|---|---|---|
| Health | First aid, water, survival | yes, 1.24.4 | 42 lessons (28 new, 13 corrected), a breath and pulse counter, bleach for water, Print, Chat gives the lesson for a health need. Left: no medicine (questions for Adam), no pictures, not read by a trained person; nothing yet on long illnesses (tuberculosis, HIV, diabetes, high blood pressure, epilepsy, asthma), skin and eye disease, family planning, care of the dying and the dead, disability |
| Food | Nutrition, cooking, preserving | yes, 1.24.5, against two sources only | 10 lessons (2 new, 8 revised), the tables corrected (no oil covering; temperatures), no number for a child in the sum, a help guide, three bench conversations. Checked against the CDC's and the US home-preserving centre's pages only. Left: five lessons drafted on `wip-2026-11-06` (cassava and beans, storing grain, deficiency illnesses, bread, fuel); figures not read on a page (kcal and protein a day, vitamin C, calcium, the plate, cellar storage, the sum's equation); nothing on canning (not without pressure, time and acidity from a source) |
| Farming | Organic growing, seed saving | no | |
| Repair | Bicycles, small engines | no | |
| Engineering | Repair, circuits, machines | no | hydraulic, pneumatic, control and electronics drawings are correct by construction since 1.17.0 to 1.18.1 |
| Animals | Chickens, goats, livestock | no | |
| Weather | Clouds, forecasting, safety | no | lightning is also in Health (30 minutes after the last thunder): keep the two agreeing |
| Earth | Maps, distance, climate zones | no | places and distances added in 1.14.0 |
| Community | Fair decisions, disputes, rules | no | |
| Learn to Read | Letters, sounds, first words | no | |
| Learn Math | Foundations to calculus | no | |
| Math Drill | Arithmetic practice | no | |
| Typing | Learn to type | no | |
| Flashcards | Study and memorize | no | the AI makes decks (MAKE CARDS, 1.12.0) |
| Clear Thinking | Evidence, logic, decisions | no | |
| Physics | Force, orbits, relativity | no | |
| Chemistry | Periodic table, molar mass | no | |
| Biology | Cells, body, DNA | no | |
| Sky | Time, seasons, moon, stars | no | |
| Planner | Calendar and events | no | the AI makes plans (MAKE PLAN, 1.12.0) |
| Ledger | Money in, money out | no | |
| Invoice | Invoices and receipts | no | |
| Convert | Units and currency | no | |
| Clock | Clock, stopwatch, countdown | no | |
| Backup | Save or move all your data | no | |
| Search | Find apps and content | no | |
| Connections | One idea, many doors | no | |
| Charter | A letter to the future | no | |
| Turtle Code | First programs for children | no | |
| RF Bench | Smith chart in 3D | no | |
| Deckplate | Offline music player | no | |
| Compose | Letters, CVs, essays, reports | no | has its own test suites (engine, app, isolation) |
| Forge | Edit, test, persist modules | no | |
| Assist | Ask, compute, verify | no | exercised by every bench run |
| About | Help and sharing | no | |
| Writer | Letters, reports, homework | yes, 1.16.0 | controls only |
| Sheets | Budgets, lists, calculations | yes, 1.16.0 | controls only |
| Slides | Presentations and teaching | yes, 1.16.0 | controls only |
| Calculator | Scientific calculator | yes, 1.16.0 | controls only |
| Draw | Sketch, shapes, diagrams | yes, 1.16.0 | controls only; schematic symbols 1.15.0 |
| Code Lab | Arduino, Python, JavaScript, PLC | yes, 1.16.0 | examples by the language asked for, and the Stop-in-a-branch check, 1.24.2 |
| Music | Sound, notes, harmony, songs | no | deep work 1.19.0 to 1.24.2 (songs, instruments, orchestra, sheet reader, parts, songbook); the tile's own lessons not audited |
| Text Reader | Text from pictures, scans, PDFs | no | deep work 1.12.0 to 1.22.8 |
| Chat | Talk to the AI | no | exercised by every bench run |
| AI | Set up the offline AI and test it | no | the bench lives here |
