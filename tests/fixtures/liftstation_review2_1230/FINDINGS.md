# Second review of 1.24.30 (the lift station) — findings

Made by a second agent that had seen neither the rules written nor the first review's cases, on commit 84d4b35
(after the first review's mends). Saved from its final message (its own tools refused it a .md file).

624 cases: 555 agree, 69 do not (10 high, 38 medium, 21 low).

| Area | Cases | Agree | Disagree |
|---|---|---|---|
| A. control as models write it | 80 | 62 | 18 |
| B. plain circuits against 1.24.29 | 29 | 28 | 1 |
| C. piping, levels, standards, routing | 111 | 85 | 26 |
| D. splitting, Chat turns, the bench's path | 87 | 71 | 16 |
| D. every bench question of both sets, as a guard | 300 | 300 | 0 |
| replay.js | 607 | 546 | 61 |
| E. drawings in Chromium (replay_browser.py) | 17 | 9 | 8 |

## Disagreements by root cause, highest harm first

1. **High — ft-in with a dash loses the inches.** `1'-6"` read as 1 ft, drawn and labelled so, nothing said; "1 ft-6 in" the same; a right block sent back with "FS3 at 3 ft is not above FS2 at 3 ft". (`heightOf` lets only spaces between feet and inches.) C-lv-ft-in-dash, C-lv-ft-in-dash-and-inlet, C-lv-ft-in-dash-collide, C-lv-ft-dash-in-words, E-lv-ft-in-dash.
2. **High — with depths below grade the inlet is not converted.** In a 20 ft well an inlet 12 ft below grade is drawn 12 ft above the floor (8 ft is right); an alarm a foot above the invert is not warned of; an inlet above every float gives false notes. (`planLevels` converts only the floats.) C-lv-depths-inlet, C-lv-depths-alarm-above-inlet, E-lv-depths-inlet; C-lv-depths-false-inlet-notes.
3. **High — a lower- or mixed-case alternator tag spoils a right block.** `alternator ar m1 m2`, `alternator Ar M1 M2` go back with the wrong line "alternator M1 M1 M2". A-lowercase-everything, A-mixedcase-Ar.
4. **Medium — a block of the wrong kind is counted as the part asked for**, and Lantern says the part was made (a second MAKE CONTROL taken for the piping; the piping never made). Chat and the bench's path. (`aiParts.next` falls back to the current part.) D-turn-control-again-for-piping, D-solve-control-again, D-turn-schematic-then-obeys.
5. **Medium — what goes back for a part is checked against the whole question.** A MAKE SCHEMATIC written for the piping part is told to write it as MAKE CONTROL. D-turn-schematic-for-piping-sent-back-as-control.
6. **"Lantern made" said of a part not made.** A control block wrong twice, then "Lantern made MAKE CONTROL…" (medium); on the bench's path two prose replies for the piping, then "Lantern made your MAKE PIPING block" (low). D-turn-bad-control-twice-not-said-made, D-solve-prose-twice-not-said-made.
7. **Medium — questions in parts not split, or split wrongly.** Not split: "1) … 2) …", "as well as", "plus", "along with" (D-numbered-parens, D-as-well-as, D-plus, D-along-with). "First…, second…, and third…" loses the levels into the piping (D-first-second-third). "Draw a 2 pump lift station: the control…, the plumbing, and the float positions" makes the heading a SCHEMATIC part and loses the levels (D-colon-list-after-thing). "Then make a spreadsheet of the pump run hours" becomes SCHEMATIC (D-ladder-then-spreadsheet). A comma list ending "…for a duplex lift station" shows the control part the motor-starter guide (D-prompt-comma-list-pump-example). Low: "1. … 2. …" parts read "…relay, 2" (D-numbered-dots-text); six circuits fold three into one part (D-six-circuits).
8. **Medium — thousands separators.** "1,050 mm" read 1.05 mm, "1 050 mm" 50 mm, "el. 1,047.0 ft" labelled "el. 047.0 ft". C-lv-mm-thousands-comma, C-lv-mm-thousands-space, C-lv-elevations-thousands-comma.
9. **The first number on a line taken as the height.** A well "6 ft diameter, 12 ft deep" as 6 ft deep (medium); `inlet 8 in sewer at 6.5 ft` puts the invert at 8 in (low). C-lv-well-diameter-and-depth, C-lv-inlet-pipe-size-unquoted.
10. **Medium — MAKE LEVELS drops unquoted float jobs.** `float FS1 off 2 ft` goes back "there are no floats". C-lv-unquoted-jobs.
11. **Medium — check valves named by their kind.** "swing check valve" refused; "ball check valve" read as a ball shutoff ("P1 has two shutoff valves"). C-pp-swing-check, C-pp-ball-check; C-pp-check-tagged-cv-as-valve (low).
12. **Medium — the piping example has one pump**; copied, a two-pump question gets one pump. C-pp-example-copied.
13. **Medium — pump coils tagged KM1 (IEC) or P1 "pump 1 starter" get no overload.** A-KM-contactors-IEC, A-P-coils-starters.
14. **Lines sent back that are wrong for this block.** Medium: a triplex gets "alternator AR M1 M2" (drops pump 3) (A-triplex); "overload OL1" with no coil gets "overload OL1 CR1" (A-overloads-no-coil); duplex air compressors told to add level floats (A-compressors-pressure-switches). Low: a lag float line reusing FS3 after FS3 became the alarm (A-no-lag-line-names-free-tag); ISA floats given the example's FS1–FS4 (A-isa-tags-no-labels); low/high/high-high given the example's four (A-low-high-highhigh); `hoa SS1 M1` a list not a line, as on 1.24.29 (A-hoa-line); a pump block sent back shown the motor-starter guide (A-fix-hint-for-pump-block).
15. **The duplex pump example shown to questions that are not duplex stations**: two pumps each with their own buttons (medium), air compressors and lead/lag boilers (low). B-prompt-two-pumps-own-buttons, A-compressor-prompt, A-boilers-lead-lag-prompt.
16. **Medium, as on 1.24.29 — floats read by their job only with an alternator.** A duplex question answered without one, and a simplex with "off" and "on" floats, put both floats in series: the pump short-cycles at the on float, nothing said. A-duplex-question-no-alternator, A-simplex-off-on-floats.
17. **Questions that miss the levels or piping tools.** "a section of the wet well with the float switches", "where the floats go" (medium); "floats be set", "valves and pipes", "force main and valves" (low). C-route-section-with-floats, C-route-where-floats-go, C-route-floats-be-set, C-route-valves-and-pipes, C-route-force-main-and-valves.
18. **Labels through pipes and walls.** A long force-main label over pump 4's pipe, the header and the vault wall; a long inlet label across the well wall and both risers (medium); the header label across the vault wall in three more (low). E-pp-four-pumps-labels, E-pp-three-inlets-long; E-pp-35b-words, E-pp-triplex, E-pp-main-valves.
19. **Low — the 35B blocks' summary says FS3, the alarm float, "calls the pumps".** A-35b-block1-alarm-float-not-a-call, A-35b-block2-alarm-float-not-a-call.
20. **Low — small readings.** Typographic primes 1′-6″ (C-lv-unicode-primes); an inlet as an elevation beside floats above the floor (C-lv-mixed-inlet-elevation); "rising main" labelled "main 100 mm rising main" (C-pp-non-return-rising-main); an inlet isolation gate drawn as pump 1's discharge valve (C-pp-inlet-isolation-valve); long float labels all cut to "Float Switch …" (E-ctl-long-float-labels).

## What holds

- Both of the 35B's blocks draw and simulate right over four cycles (alternate, hold to the off float, lag runs both, alarm lights, an overload takes out only its pump).
- The instructions' example, as it stands and in about forty variations.
- All 22 plain circuits draw as on 1.24.29, but the overload trip light, which 1.24.29 had wrong.
- Every standards statement checks out: Ten States Standards 2014 (NY DEC's copy) and 2004, Ontario chapter 7, opened through WebFetch — 42.52, 44.4, 42.64, Ontario 7.2.5. Lantern cites only these.
- Chat and the bench's path make each part once and in order (one block per reply, all three at once, prose then the block, prose twice — skipped and said — the 35B's refusal, endless prose — the turn ends).
- No single-thing question split: 36 of its own and all 300 bench questions but the two lift-station ones.

## Not run

No real model (scripted stand-ins only). The standards' PDFs could not be downloaded with curl (403); read through WebFetch. Seen, not counted: in the ladder drawings each float's bulb touches the top of its label.
