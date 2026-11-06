# Queue

What to do next, in order, and what has been done to each tile. Update this
file in the same commit as the work. Read `CLAUDE.md` first.

## Next, in order

1. **Read the small models' runs and act on them.** Since 1.24.3 every push
   to a `lantern-x.y.z` branch runs the whole bench with the 0.8B, the 2B and
   the 4B on GitHub (`CLAUDE.md`, "The bench with the small models"). The
   first runs, on 1.24.3: **0.8B 15 of 103, 2B 51 of 103** (the 35B: 103 of
   103 on the same Lantern code). From 1.24.4 the job's log has every failed
   row as the model wrote it. Start there:
   - "asked for a value" is the commonest miss of both (0.8B 22, 2B 10): the
     model writes `NEED:` for a number the question gives, or for a fact a
     recipe card or a table of Lantern's has. Read the rows; what did it ask
     for? Can Lantern answer the NEED itself (`Lantern.aiNeedAnswer`), or
     fill the card's slots from the question and say so?
   - "no formula" (0.8B 14, 2B 6) and "no MAKE block" (0.8B 18): prose
     instead of the line Lantern runs. What does the reply look like?
   - three of the 2B's puzzles ended in "Server said 400 Bad Request". From
     1.24.4 the server's own reason is in the row. If it is the context
     (8192 tokens, long TRACK retries), Chat should trim before it asks.
   A question the 4B fails and the 35B passes comes before a new feature.
   Fix what Lantern gave the model or how it read the reply, for every
   question of its kind; put the failed rows in `tests/fixtures`.
2. **Confirm each new version on the 35B, twice**, when a chat is linked to
   Adam's laptop (`CLAUDE.md`, "The bench on Adam's laptop"). A version that
   has not had a full run says so in its report.
3. **The Food tile audit, next of the tiles.** Its preserving lesson said
   what Health's did (keep the air out, oil over cooked food, meat simply
   sun-dried); 1.24.4 corrected that one lesson only. Check every food
   lesson the same way Health was checked: separate checkers, named sources
   (USDA, the US National Center for Home Food Preservation, FAO, WHO five
   keys to safer food, CDC on botulism). Canning is not in Lantern and must
   not go in without pressure, time and acidity from a source.
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
     drafts and 13 in lessons that had shipped for weeks;
   - check what the AI can reach of it (LESSON:, LOOKUP:, formula functions,
     MAKE tools) and add the hook when it cannot;
   - write the tile's row below, and the gaps left, in the report.
5. **The encyclopedia questions with a real model.** The laptop's library
   works (see the 1.24.4 report): it is the Claude app's browser pane that
   cannot reach port 8081 from Lantern's page. Until Adam connects Chrome,
   no real-model run includes the 25 fact questions and the library
   conversations. Add the Simple English Wikipedia (2.5 GB,
   `kit/setup-kit.sh library-simple`) to the 4B's job in the workflow, so
   one small model is asked them on every version; see which of the fact
   questions that smaller encyclopedia can answer at all before counting
   them. The Windows start script's "library first" change (1.17.0) is
   confirmed working on Adam's laptop by the above.
6. **Pictures for the Health lessons.** The recovery position, where the
   hands go for chest pushes, the tippy tap, the pit latrine, the arm
   measurement: a drawing each would carry more than the words. Lantern can
   draw (Draw's shapes, SVG). Whether a drawing is clear is Adam's to judge:
   make them, show him, keep what he passes.
7. **Lessons found by a strong word only when they come first.** For a
   how-to, `Lantern.suite.passages(..., {strong: true})` gives nothing when
   the best-scoring lesson does not name the topic, even if the second does
   ("He fell and hit his head" found nothing before HEALTH_CHAT took health
   questions). Look at the first few hits, not only the first.
8. **Songbook.** Nine tunes so far, all starting on the first beat. Tunes that
   start with a pickup (Amazing Grace, Auld Lang Syne, Brahms' Lullaby,
   Greensleeves, Happy Birthday's 1893 tune) need a pickup bar checked through
   the score, the parts and the arrangement first.
9. **A second try that changes nothing.** In the run on 1.24.0 three songs
   came back unchanged or worse after Lantern's send-back. 1.24.2 writes the
   line to use. If a model still sends the same block, decide with Adam
   whether Lantern should apply the fix it named and say so.
10. **The 1.16.0 audit's feature list** (`Lantern_1.16.0_app_audit.pdf`, sent
    to Adam on 2026-10-29) was never answered. With the aim above, take the
    features that serve it without asking again; leave the rest.

## Tiles

"Audited" means: every control used in a real browser and bugs fixed with
tests (the 1.16.0 pass); from 1.24.4 also the lessons read against the aim,
checked against sources by separate checkers, and what the AI can reach.

| Tile | What it is | Audited | Notes |
|---|---|---|---|
| Health | First aid, water, survival | yes, 1.24.4 | 42 lessons (28 new, 13 corrected), a breath and pulse counter, bleach for water, Print, Chat gives the lesson for a health need. Left: no medicine (questions for Adam), no pictures, not read by a trained person; nothing yet on long illnesses (tuberculosis, HIV, diabetes, high blood pressure, epilepsy, asthma), skin and eye disease, family planning, care of the dying and the dead, disability |
| Food | Nutrition, cooking, preserving | no | next: its preserving lesson was corrected in 1.24.4, the rest unchecked |
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
