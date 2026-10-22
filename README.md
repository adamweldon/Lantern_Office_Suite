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
section, and Lantern reads it on demand.

## Three ways to run it

| Where | How |
|---|---|
| Any device, no AI | Open `Lantern_Office_Suite.html` (one file, works offline). |
| Phone or any browser, with AI | The website build in `site/`, published with GitHub Pages: open it, Add to Home Screen, download a model once in the **AI** app. |
| Laptop / USB stick, with AI | `kit/`: run `setup-kit` once, then `start-lantern` (see `kit/README.txt`). It uses the biggest model the computer's memory can run and offers to download a bigger one when the kit lacks it. Phones on the same Wi-Fi can share the laptop's model. |

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
| `site/` | The website build: Lantern + offline worker + install manifest + on-device AI engine (`site/ai`, wllama 3.8.1, MIT). Rebuilt by `tools/build_site.py`. |
| `kit/` | Laptop / USB launchers and setup scripts for llama.cpp `llama-server`, and kiwix-serve for the offline library (Kiwix ZIM files in `kit/library/`). |
| `docs/Lantern_Edge_AI_Plan.pdf` | The plan: model size per device, architecture, distribution, phases, Lantern Bench. |
| `docs/Lantern_AI_Test_Guide.pdf` | Phase 1 test steps for phones and laptops, what to send back, and what was verified before release. |
| `docs/Lantern_Compose_Guide.pdf` | What the Compose writing suite does, how to use it, and how it is built. |
| `docs/Lantern_v1_6_Review.pdf` | How v1.6 was rebuilt from session history, what was fixed, what is still missing. |
| `CHANGELOG.md` | Version history. |

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
- **AI makes things**: MAKE blocks (schematics, pictures, tables) found and checked, schematic layout on Draw's grid (loops, parallel rungs, one-terminal parts, polarity), circuit checks (closed loop, loose parts, unknown parts), pictures on the 20 x 12 grid, tables worked out by the sheet engine (empty-cell and text references caught), the Chat flow with one corrected block, Open in Draw (the person's drawing kept) and Open in Sheets, the look turn only when llama-server reports vision, and bench grading of the eight make questions
- **AI makes documents, slides, flashcards, plans; READ** (1.12): the MAKE DOC, SLIDES, CARDS and PLAN parsers and their checks (headings, lists, tables and bold for Writer; at most 7 points a slide; cards with both sides and no repeats; dates worked out by Lantern -- month ends, weekdays, day-and-month, nothing in the past -- and the Planner's repeats), the apps' own doors (`slideDocs`, `cardDocs`, `plannerDocs`), the prompt offering only the kind asked about, the command list saying where each opens, the Chat flow (Open in Writer / Slides / Flashcards, Add to Planner, made once however often tapped), the READ command (page, pages, section, words, "the last page", pages past the end, nothing found) and a conversation that READs words and then a section not yet read, and the four new bench questions graded with their ideal replies
- **Puzzles**: the TRACK (things in a row and what they hold), TURN (a cube or a walker) and SOLVE (clue puzzles, by trying every arrangement) tools on the puzzles a 35B model was given, reworded ones, Einstein's five-house puzzle, knights and liars, a missing clue and contradicting clues; the text functions (REVERSE, REMOVE, LEN ...); Chat handing a puzzle to Lantern (results back for the answer, one correction, the tools on request, off for the bench's "alone" runs); the reasoning bench graded against a perfect model and against the 35B's real answers without the tools
- **Chat routing**: which questions go to the library and with what search words -- follow-ups searched with the AI's own words, questions about the AI or the chat answered from its reasoning, "without regard to the library" obeyed, earlier quotes counted as real, passage descriptions not taken for citations, recipe hints only with numbers -- replayed from a 35B transcript; Chat without the page (`converse`), the eight bench conversations and the five about a document (one needs READ)
- **Text Reader**: the word model (marks inside words, lone letters, O and 0, codes, units, initials), layout on drawn bitmaps (blobs, lines, x-height, spaces measured against the font), glyph features, the PDF reader (object streams, a fax G4 picture decoded pixel for pixel, a page's own words with an embedded font), document passages and sections, Chat answering from an attached document with its quote checked and a made-up quote caught, the Sheet Music Reader's staff finder, pitches and MIDI file, and the handwriting stub
- **AI isolation**: removes each of the 75 AI, library, action, Text Reader, PDF, sheet music, suite-catalog, make and READ modules in turn and opens Chat, Text Reader and Music (rule 11)

`tests/browser/text_reader_e2e.py` (not part of `npm test`; needs Playwright and Chromium) reads the fixture pages in a real browser with an error limit per page, opens the PDF fixtures, makes a searchable PDF and reads it back with pdftotext, and reads the sheet music fixture note for note.
- **kit offer**: the USB kit's model choice and "bigger model" offer, run against a stand-in for Hugging Face (redirects to download links that refuse HEAD requests), with a fake llama-server: memory tiers, FAT32, low space, no connection, missing file, N remembered, download through the redirect; the library download (newest kiwix-tools and Kiwix file from directory listings, SHA-256 checked, damaged files deleted, Simple English on FAT32), the full Wikipedia (opt-in only, free space from the server's file size), each model's vision part (fetched with it, loaded by start-lantern with --mmproj, "novision" to skip) and kiwix-serve started on port 8081; `setup-kit.ps1` too when PowerShell is installed
