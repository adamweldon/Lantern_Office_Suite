# Queue

What to do next, in order, and what has been done to each tile. Update this
file in the same commit as the work. Read `CLAUDE.md` first.

## Next, in order

1. **Confirm each new version on the 35B, twice**, when a chat is linked to
   Adam's laptop (`CLAUDE.md`, "The bench on Adam's laptop"). A version that
   has not had a full run says so in its report.
2. **The offline library on the laptop.** Nothing answers on port 8081 though
   `kit\library` holds two Wikipedia files and `kit\engine\windows\kiwix` has
   `kiwix-serve.exe`. Every run there leaves out the 25 fact questions and the
   library conversations. Needs the text of the Start Lantern window, or a look
   at the screen. The Windows start script's "library first" change (1.17.0)
   was never run on Windows.
3. **Read the small models' runs and act on them.** Since 1.24.3 every push
   to a `lantern-x.y.z` branch runs the whole bench with the 0.8B, the 2B and
   the 4B on GitHub (`CLAUDE.md`, "The bench with the small models"). Before
   choosing what to fix, download the runs of the branch you start from. A
   question the 4B fails and the 35B passes comes before a new feature: find
   what Lantern gave the model or how it read the reply, fix that for every
   question of its kind, and put the failed rows in `tests/fixtures`. The
   0.8B and 2B are phone models: expect them to fail much more, and look for
   the failures many questions share.
4. **Tile audits**, one tile a session, in the order of the table below. For
   each tile:
   - open it in a real browser and use everything in it; fix what is broken,
     each fix with a test;
   - read its lessons and data against the aim: is what a person needs to
     learn, build, repair, grow or heal with this subject here, and right?
     Add what is missing, from what is public domain or openly licensed, and
     say where it came from;
   - check what the AI can reach of it (LESSON:, LOOKUP:, formula functions,
     MAKE tools) and add the hook when it cannot;
   - write the tile's row below, and the gaps left, in the report.
5. **Songbook.** Nine tunes so far, all starting on the first beat. Tunes that
   start with a pickup (Amazing Grace, Auld Lang Syne, Brahms' Lullaby,
   Greensleeves, Happy Birthday's 1893 tune) need a pickup bar checked through
   the score, the parts and the arrangement first.
6. **A second try that changes nothing.** In the run on 1.24.0 three songs
   came back unchanged or worse after Lantern's send-back. 1.24.2 writes the
   line to use. If a model still sends the same block, decide with Adam
   whether Lantern should apply the fix it named and say so.
7. **The 1.16.0 audit's feature list** (`Lantern_1.16.0_app_audit.pdf`, sent
   to Adam on 2026-10-29) was never answered. With the aim above, take the
   features that serve it without asking again; leave the rest.

## Tiles

"Audited" means the 1.16.0 pass: every control used in a real browser, bugs
fixed with tests. Nothing else in this table has been checked that way.

| Tile | What it is | Audited | Notes |
|---|---|---|---|
| Health | First aid, water, survival | no | first in line: most direct to the aim |
| Farming | Organic growing, seed saving | no | |
| Food | Nutrition, cooking, preserving | no | |
| Repair | Bicycles, small engines | no | |
| Engineering | Repair, circuits, machines | no | hydraulic, pneumatic, control and electronics drawings are correct by construction since 1.17.0 to 1.18.1 |
| Animals | Chickens, goats, livestock | no | |
| Weather | Clouds, forecasting, safety | no | |
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
| Writer | Letters, reports, homework | yes, 1.16.0 | |
| Sheets | Budgets, lists, calculations | yes, 1.16.0 | |
| Slides | Presentations and teaching | yes, 1.16.0 | |
| Calculator | Scientific calculator | yes, 1.16.0 | |
| Draw | Sketch, shapes, diagrams | yes, 1.16.0 | schematic symbols 1.15.0 |
| Code Lab | Arduino, Python, JavaScript, PLC | yes, 1.16.0 | examples by the language asked for, and the Stop-in-a-branch check, 1.24.2 |
| Music | Sound, notes, harmony, songs | no | deep work 1.19.0 to 1.24.2 (songs, instruments, orchestra, sheet reader, parts, songbook); the tile's own lessons not audited |
| Text Reader | Text from pictures, scans, PDFs | no | deep work 1.12.0 to 1.22.8 |
| Chat | Talk to the AI | no | exercised by every bench run |
| AI | Set up the offline AI and test it | no | the bench lives here |
