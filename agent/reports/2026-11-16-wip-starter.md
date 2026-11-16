# 2026-11-16 — wip-2026-11-16-starter (unfinished: the next version, 1.24.22)

**Unfinished:** the new rules below have not been tried by a separate
reviewer; the version is not bumped; no changelog entry. Next session: a
reviewer on the orbit-function line and the lone language name, mend, then
1.24.22 on its own branch.

## What happened

After 1.24.21 went to `main` (Adam's word), Adam opened the one link on his
laptop. Windows Defender quarantined Get-Lantern.exe as a Trojan, and with
his stick's Lantern on 8080 the starter stopped on "another program has it".
Adam chose to give Windows Lantern.zip on the page until it is mended
(pushed to `main`, d7ad774).

A test build of the mended starter, put in his Downloads over the link to
his laptop (not through a browser): no alert; it set Lantern up in
`~\Lantern`, made its icons, fetched the engine, the 0.8B, then the 9B with
its vision part; AI ready at 13:07:59. The page never heard it (below), and
the starter stopped itself at 13:20 ("no Lantern page for 20m"). After a
reload, the 9B ran set A quick 16 of 17 and set B quick 15 of 17
(`tests/fixtures/bench_run_1261_9b_seta_quick.json`, `..._setb_quick.json`).

## On this branch

- Starter: icons by the shell-link object (no PowerShell); the Windows build
  not stripped; another Lantern on 8080 said and opened, nothing set up;
  another program there, Lantern moves to 8083 (and finds itself there).
  The starter workflow makes an icon on Windows and reads it back (passed).
- The offline worker kept the starter's first status ("downloading") and
  gave it back for good: the page never heard the AI had come, Automatic
  chose the in-page AI, and the starter, never asked, stopped after 20
  minutes. The worker no longer keeps `/lantern-setup/` nor no-store
  answers; a question under the starter with no server known asks the own
  address again (`tests/starter_page_fresh.js`).
- AI on this device: a model's vision part (mmproj) chosen as the model is
  refused, and one remembered is forgotten, with On this device back to
  Automatic (`tests/ai_device_proj.js`). Adam's browser had one, from some
  earlier use at 127.0.0.1:8080.
- ESCV/ORBITV/ORBITT given another body's radius and no GM: refused as
  "inside the Earth ... add 6371 km" (Mars, set A; the 9B wrote the same
  again) or, once Earth's radius was added as told (the Moon, set B), run
  and wrong. Now the line with the body's GM, Earth's radius left out,
  tried first, only when every other number is the question's
  (`tests/other_body_gm.js`, `tests/bench_1262.js`).
- A MAKE CODE block whose first line is a language's name alone ("arduino")
  reads it as the language line (it was "line 1 may be missing a ;").

`npm test`: ALL CHECKS PASS. Not run: the browser tests on this branch.

## Open (Adam's)

- The next release's Get-Lantern.exe, downloaded through the browser, with
  "potentially unwanted apps" blocking on: if quiet, the page offers it
  again; if not, signing (QUESTIONS 3: Artifact Signing $9.99 a month).
- The starter fetched the CPU engine; the kit can fetch the Vulkan build
  (graphics card): the 9B ran about 2 tokens a second on the CPU.
