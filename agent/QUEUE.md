# Queue

What to do next, in order, and what has been done to each tile. Update this
file in the same commit as the work. Read `CLAUDE.md` first.

## Next, in order

1. **The 4B's six rows that fail again, word for word.** The small models'
   run on 1.24.10 (42509727008, `tests/fixtures/bench_run_1250_*.json`,
   replayed by `tests/bench_1250.js`): **0.8B 59 of 114, 2B 73, the same
   rows as on 1.24.9; 4B 106** (110 on 1.24.8 and 1.24.9). The 4B ran on an
   AMD EPYC 7763 and wrote its 1.24.7 replies to six questions word for word
   (a run's replies follow its processor, `CLAUDE.md`), so these have failed
   on two versions with the same reply, and are the work: **water-days**
   ("asked for a value"), **letters-refrigerator** (the letters retyped),
   **make-power-wheel** (three lines twice on the wheel),
   **make-music-orchestra** ("part strings": the table has strings, the
   plural rule made it "string" -- mended in 1.24.11; its brass and bass
   parts are a bar or two short and go back: Lantern arranges for orchestra
   itself, and could leave out a written part it cannot play and say so),
   **doors-host-guesses** (the classic Monty Hall from memory, for a host
   who does not know), **code-st-tank-fill** (no MAKE block: the first
   reply was "LESSON: Tank fill/stop logic" twenty times, the second prose
   and a fenced program cut off at the question's 1000 tokens, so there is
   no whole program to read; a reply cut off inside a fence could be asked
   to go on).
   Its road was drawn under a ground written after it (asked about as
   hidden: Lantern could put the ground first and say so, rule 0, a
   reviewer first) and its waltz ends on E over D, a whole step from the
   chord, which the mend does not touch (only a half step) and the bench's
   check fails: whether a last note a whole step off is mended too is a
   question for the music reviews. 1.24.10's own changes (a line written
   again, the held-note mend, the shore seen) left the 0.8B and the 2B as
   they were; the 4B's shore at sunset passed: its first block the same as
   on 1.24.8 and 1.24.9, asked about the beach with the rest, it wrote the
   line it was given (`rect 0 10.5 20 1.5 fill tan`).
   Then **the shore at sunset**, failed by all four models on 1.24.8, each
   its own way: the 0.8B kept the day's blue sky after it was told the
   line (Lantern could colour a sunset's sky itself and say so: rule 2, a
   reviewer first); the 2B and the 35B drew off the grid, the 35B its sea
   below the picture under the example's green ground (look at what the
   guide shows for a sea).
   Still from the rows of 1.24.7 (each needs a reviewer before it goes in):
   - **a send-back that ends on a choice.** `water-days`, the 4B: `=5*40`,
     `=2000/800` went back with "=5*40 (200) is worked out but never used
     ...; the formula uses 800, which is not in the question; if the person
     did not give it, ask with NEED", and the 4B asked a NEED, word for
     word as on 1.24.5 (the same row on two versions). Rule 3: give the
     line to write. Rule 7: `=2000/ANS1` is that line only when 800 stands
     for the unused step; a reviewer tries questions where the number is a
     slip and where it is truly missing. At the least, a NEED is not the
     last thing said when every number of the question is used;
   - **a word Lantern worked out, typed otherwise in the sentence.**
     `letters-refrigerator`, the 4B: its lines right ("otaegife", 8), its
     sentence "efrgefao". The check of a retyped word knows only a word
     with a few slips. The 2B did the same on 1.24.5 ("gitefr"). A quoted
     word in the ANSWER that is not in the question, beside a text the
     lines worked out, could go back with `{ANS2}` to write;
   - **"= 65*35 = 2275"** (the 0.8B on 1.24.6 and 1.24.7) is worked out as
     a test (1) and not questioned: a number question whose answer is a
     test should go back, said plainly;
   - **a guide's own line in a block**: the 0.8B's sunset house began with
     the drawing guide's sentence "One shape per line, back to front ..."
     and the title "<title> -- a simple picture on a g...";
   - music, the 4B once each: a waltz's chords to bar 9, an orchestra part
     called "strings".
2. **Read Adam's run of 1.24.10 with the library** when he sends it. His
   1.24.9 run (2026-11-08, `tests/fixtures/bench_run_1249_35b_library.json`,
   `tests/bench_1249_35b.js`): 134 of 140, the same seven questions as
   1.24.8; the three library questions now answered from the library and
   failing on what they cite: 1.24.11 reads the medicine shelf for
   rehydration. A rule that wrote the missing QUOTE for the model, finding
   the cited sentence by its words, was tried by a reviewer and taken out:
   it verified 101 of 181 wrong answers (a dose swapped, "do not leave"
   quoted for "leave", over for under; `tests/library_quote_1251.js`,
   `tests/fixtures/review1_1251_quote.json`). The iPhone's and Nairobi's
   citations go back as before. What could help instead, each for a
   reviewer: hand the model the sentence to quote (rule 3), as "no quote
   says ..." already does, so that the model, not Lantern, says it is the
   one; and **verify()'s own holes** the review found: one good quote per
   cited passage is enough, and a majority of the answer's words, so a part
   no quote says rides on the others (a 12 in 24 hours that no quote has
   passes on 1.24.10 too).
3. **Music, after the held-note mend** (four reviews, 910 songs,
   `tests/music_review_1249.js`, `tests/music_review_1250.js`). Left as on
   1.24.8, found by the reviews:
   - a note tied into the same chord from the middle of a bar (a 4-3 across
     C | C) is asked about, and the question names the second chord while
     its line rewrites the first;
   - the line to write for the tune's end can be wrong for the song: "F - -
     C" over C ends on F; a song in C written under key A minor is told to
     end on E major;
   - `Am(maj7)` is read as Am and a "maj7" (the brackets dropped);
   - a last note a whole step above a minor chord's root ends on the third,
     where a musician ends on the root; a 4-3 over a tonic pedal is now made
     as written (the second review would have asked);
   - `style blues` turns the mend off, but the shown lines say `style
     ballad`; built again, the mend runs;
   The filled recipes (a recipe given to a small model with the question's
   numbers in it) are on `wip-2026-11-06-recipe-fill`, out of 1.24.7: two
   reviews found them wrong too often, and a list of words to refuse is
   never finished. The next attempt fills only a question whose every word
   Lantern knows (its note there says how).
   Then, from what the rows of 1.24.6 show and 1.24.7 and 1.24.8 do not touch:
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
4. **Pictures.** Adam's direction (2026-11-06): get the fundamentals of a
   scene right first -- what stands on what, what is behind what, how
   things narrow with distance -- and then let the AI draw many small
   pieces that Lantern puts together into a bigger, more detailed picture.
   1.24.7 does the first for mountains, the sun and a road (AI_SCENE),
   for a plain landscape asked in plain words only: three reviews showed
   that a rule which guesses spoils more right pictures than it mends
   wrong ones. Next:
   - **the 35B on 1.24.8**, when the laptop is linked: Adam's two requests
     and the two scene questions, and what it writes with the landscape
     guide and its example (no road since 1.24.8). Its picture is the
     test; send Adam the sheet;
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
   - **what lies hidden that is not a filled shape.** Words, a line, a
     shape drawn as an outline only, or one too small for the 0.25-cell
     sampling, wholly under a later shape, is asked about by no version
     (the three reviews of 1.24.8 drew 7 such). A clock's hands under a
     second copy of the face are caught only through the face's question.
     A check of its own, tried by a reviewer, with the reviews' drawings
     (`tests/fixtures/review*_1248_hidden.json`) as the guard;
   - **a piece of one area under another, something else on top** (a wall
     in two pieces with its window, a canopy of two greens with apples) is
     still asked about, as on 1.24.7: Lantern cannot tell it from a
     pepperoni under the sauce and the cheese (22 of the second review's
     drawings, 22 of the third's);
   - **found by the reviews of 1.24.10, left as 1.24.9 has them:** a
     railway redrawn as a gray road with gray rails, so the rails do not
     show; a setting sun the colour of its sky, over the sea, put behind
     the water and said so (D47, D71); the question about a shape caught
     between two copies names the copy, not what is caught; a whole scene
     written several times is a run to AI_DRAW, and its floating mountain
     stays (A3, A4, P1); a snow cap drawn across a mountain each time keeps
     the mountain's copies (P3); a road with a person, a car or a gate on
     it is redrawn with half of it moved (1.24.9's carrying; a rule that
     carried all of it was tried and taken out: `review4_1250_road.json`);
   - **the shore check's gaps** (`review1_1250_shore.json` to `review3_`):
     a teal sea is read as green land; a boat, the sun's path, foam 0.2
     tall count as land by colour; "riverbank", "palm", "boat" in the
     question keep the plain-landscape rules off; a beach of many small
     pebbles or planks over a covered band is asked about;
   - small things found: a circle written with four numbers (the 2B,
     once). (AI_MAKE_LAYOUT read an oval as a centre and two radii: mended
     in 1.24.8.)
5. **Confirm each new version on the 35B, twice**, when a chat is linked to
   Adam's laptop (`CLAUDE.md`, "The bench on Adam's laptop"). A version that
   has not had a full run says so in its report. 1.24.6: one full run (111
   of 112) on the build before its last change, the four music questions on
   the build that was pushed, and a second full run of that build stopped
   at 73 of 118 with nothing scored failing (Adam said to stop); then a full
   run with the library by Adam himself (134 of 138, 2026-11-08). 1.24.7
   none; 1.24.8: a full run with the library by Adam himself (134 of 140,
   2026-11-08); 1.24.9 and 1.24.10: his to come.
6. **Finish the five Food lessons on `wip-2026-11-06`.** They are drafted
   and were checked from memory only; the checker's memory differs from the
   drafts where it matters (kidney beans, cassava, the hay box). They need
   the pages of WHO, FAO, the US FDA and USDA's food safety service opened
   -- which needs Adam at the app to approve them, or a session that may
   fetch them. The branch's `agent/wip/README.md` says what to do.
7. **Tile audits**, one tile a session, in the order of the table below. For
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
8. **Lessons Lantern does not have, which people will ask for** (found by
   asking, 1.24.5): making soap, keeping bees, pruning, sharpening a knife,
   a rocket stove, wiring a lamp to a battery, a solar charger; and the
   five held Food lessons. Each belongs to a tile's audit (Repair, Farming,
   Animals, Engineering).
9. **The offline library in the runs.** On the laptop it works, but the
   Claude app's browser pane does not let Lantern's page reach it, so runs
   made there leave out the encyclopedia questions. A run in Adam's own
   browser includes them: he made one on 1.24.6 (Firefox, 2026-11-08: 21 of
   the 24 library questions; the three misses are item 2). The GitHub runs have no
   library either: the Simple English one, 2.5 GB, would fit: worth adding
   to the workflow for one model.
10. **The kit's 8,192 tokens.** Lantern now shortens a request that is too
   long and sends it again (AI_FIT). Better not to get there: measure what
   Chat sends in a long puzzle conversation, and what 16,384 tokens cost in
   memory for the 0.8B, the 2B and the 4B. Whether to raise it is Adam's.
11. **Pictures for the Health lessons.** The recovery position, where the
   hands go for chest pushes, the tippy tap, the pit latrine, the arm
   measurement: a drawing each would carry more than the words. Lantern can
   draw (Draw's shapes, SVG). Whether a drawing is clear is Adam's to judge:
   make them, show him, keep what he passes.
12. **Words that differ by an ending** ("charger" and "charge", "purify" and
   "purification") do not match in Lantern's search. `LESSON_WORDS` covers
   the cases found; the stemmer itself could do more, with care (it is used
   everywhere).
13. **Songbook.** Nine tunes so far, all starting on the first beat. Tunes
    that start with a pickup (Amazing Grace, Auld Lang Syne, Brahms' Lullaby,
    Greensleeves, Happy Birthday's 1893 tune) need a pickup bar checked
    through the score, the parts and the arrangement first.
14. **A second try that changes nothing.** In the run on 1.24.0 three songs
    came back unchanged or worse after Lantern's send-back. 1.24.2 writes the
    line to use. If a model still sends the same block, decide with Adam
    whether Lantern should apply the fix it named and say so. It did again:
    the 35B's waltz on 1.24.6 (2026-11-08) and its tune of its own on 1.24.6
    (2026-11-06). Adam said "mend it" (2026-11-08); the mend is item 3, held
    back from 1.24.9 after its first review.
15. **The 1.16.0 audit's feature list** (`Lantern_1.16.0_app_audit.pdf`, sent
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
