# Changelog

## 1.8.0 — On-device AI test build (2026-10-19)

Phase 1 of the Lantern Edge AI Plan (`docs/Lantern_Edge_AI_Plan.pdf`): a
small language model that uses Lantern's tools as its source of truth,
running on a phone inside the page, or on a laptop / USB stick through
llama.cpp. 12 new modules (220 to 231); every one removable on its own.

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
- **Tests:** `npm test` 15 checks: adds AI layer (37: routing, same-origin
  detection, Assist/Chat through the route, app, bench grading with a
  perfect and a bad fake model) and isolation for the 12 AI modules.
  Verified for real against llama-server built from source with a GGUF
  model, and the in-browser engine in Chromium.

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
