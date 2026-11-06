# Queue

What to do next, in order, and what has been done to each tile. Update this
file in the same commit as the work. Read `CLAUDE.md` first.

## Next, in order

1. **Read the small models' run on 1.24.6 and act on it.** Every push to a
   `lantern-x.y.z` branch runs the whole bench with the 0.8B, the 2B and the
   4B on GitHub (`CLAUDE.md`, "The bench with the small models"). On 1.24.5:
   **4B 102 of 112, 2B 63, 0.8B 28** (the 35B, on the laptop: 111). 1.24.6
   was written from those rows (`tests/fixtures/bench_run_1245_*.json`) and
   no small model had run it when it was pushed. So first:
   - the 2B's eleven "Not in my library" for sums: its instructions for a
     sum show no decline now. Did they go? When the recipe's line goes back,
     does it fill it in?
   - **the 2B's minutes** (102 on 1.24.5, 36 on 1.24.4): its instructions
     are half the size. If the run is still slow, put what never changes at
     the top of the short prompt, so the server keeps it between questions;
   - the 0.8B copied the instructions' words in thirty replies: what does it
     copy now?
   - the Hohmann rows, with the card for two heights (4B, 2B);
   - the answers from a lesson, with instructions that show no sum
     (`suite-goats`, `food-chicken-done`, the health rows): are sentences
     cited now, or is the lesson box all the person gets?
   Then, from what the rows of 1.24.5 show and 1.24.6 does not touch:
   - **A number nobody gave, unquestioned.** `=100*12/60` for "How many
     hours will my battery run a 60 W light?" passes Lantern's check: 100
     and 12 are factors a sum may always use (percent, a dozen), and so is
     a number of the question times or over one (60/12 = 5). Only the bench
     catches it. Tighten it against the 35B's right sums
     (`bench_run_1244_35b_sums.json`) and a run.
   - **A number of the question no line uses** (`=60*5/1000*0.15*30` with
     the 100 W TV left out). Question it once: "the question also gives
     100 W".
   - **A recipe card filled by Lantern.** When a card fits and every blank
     can be filled from the question's numbers by their units, with no
     number left over, give the model the filled line
     (`=FEEDKG(20,30,800)`). Not when a blank or a number is left over.
   - **A step worked out, and a made-up number where it belonged** (the 4B,
     once: `=5*40` then `=2000/8000`). Lantern questioned it and the 4B then
     asked for a number. If it is seen again: write `=2000/ANS`.
   - **The 4B with the short prompt.** The workflow takes an input `prompt`;
     run it both ways (never on a branch whose run is in progress: a second
     run cancels the first) and keep what scores better.
   - **Puzzles.** The 2B passed 1 of 10 on 1.24.5, the 0.8B none, the 4B 9,
     and the two small ones wrote no block at all. 1.24.6 gives them the
     puzzle tool alone and asks for the block when the answer has none.
     What do they write in the block? The host who does not know where the
     car is (`doors-host-guesses`) has no tool: the 4B and the 2B answered
     the classic puzzle.
   - **A guide's own example, copied** (the 0.8B wrote the wheel guide's
     "The year" for an Ohm's law wheel, and the 2B the electronics guide's
     button into a relay driver). An example nearer the question, or none
     where the lines already say enough.
   - **LESSON: for a program** ("Tank fill/stop logic") was read the Volume
     lesson: "fill" in its title, "tank" in its text. The word that names
     the topic (logic) was the one missing.
   A question the 4B fails and the 35B passes comes before a new feature.
   Fix what Lantern gave the model or how it read the reply, for every
   question of its kind; put the failed rows in `tests/fixtures`.
2. **Confirm each new version on the 35B, twice**, when a chat is linked to
   Adam's laptop (`CLAUDE.md`, "The bench on Adam's laptop"). A version that
   has not had a full run says so in its report. 1.24.6: one full run (111
   of 112) on the build before its last change, and the four music
   questions on the build that was pushed; a full run of that build is
   still due.
3. **Finish the five Food lessons on `wip-2026-11-06`.** They are drafted
   and were checked from memory only; the checker's memory differs from the
   drafts where it matters (kidney beans, cassava, the hay box). They need
   the pages of WHO, FAO, the US FDA and USDA's food safety service opened
   -- which needs Adam at the app to approve them, or a session that may
   fetch them. The branch's `agent/wip/README.md` says what to do.
4. **Tile audits**, one tile a session, in the order of the table below. For
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
5. **Lessons Lantern does not have, which people will ask for** (found by
   asking, 1.24.5): making soap, keeping bees, pruning, sharpening a knife,
   a rocket stove, wiring a lamp to a battery, a solar charger; and the
   five held Food lessons. Each belongs to a tile's audit (Repair, Farming,
   Animals, Engineering).
6. **The offline library in the runs.** On the laptop it works, but the
   Claude app's browser pane does not let Lantern's page reach it, so runs
   made there leave out the 25 encyclopedia questions (a run in Adam's
   Chrome would include them: question for Adam). The GitHub runs have no
   library either: the Simple English one, 2.5 GB, would fit: worth adding
   to the workflow for one model.
7. **The kit's 8,192 tokens.** Lantern now shortens a request that is too
   long and sends it again (AI_FIT). Better not to get there: measure what
   Chat sends in a long puzzle conversation, and what 16,384 tokens cost in
   memory for the 0.8B, the 2B and the 4B. Whether to raise it is Adam's.
8. **Pictures for the Health lessons.** The recovery position, where the
   hands go for chest pushes, the tippy tap, the pit latrine, the arm
   measurement: a drawing each would carry more than the words. Lantern can
   draw (Draw's shapes, SVG). Whether a drawing is clear is Adam's to judge:
   make them, show him, keep what he passes.
9. **Words that differ by an ending** ("charger" and "charge", "purify" and
   "purification") do not match in Lantern's search. `LESSON_WORDS` covers
   the cases found; the stemmer itself could do more, with care (it is used
   everywhere).
10. **Songbook.** Nine tunes so far, all starting on the first beat. Tunes
    that start with a pickup (Amazing Grace, Auld Lang Syne, Brahms' Lullaby,
    Greensleeves, Happy Birthday's 1893 tune) need a pickup bar checked
    through the score, the parts and the arrangement first.
11. **A second try that changes nothing.** In the run on 1.24.0 three songs
    came back unchanged or worse after Lantern's send-back. 1.24.2 writes the
    line to use. If a model still sends the same block, decide with Adam
    whether Lantern should apply the fix it named and say so.
12. **The 1.16.0 audit's feature list** (`Lantern_1.16.0_app_audit.pdf`, sent
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
