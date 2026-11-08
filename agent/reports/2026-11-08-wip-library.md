# 2026-11-08: the library change for 1.24.8, on `wip-2026-11-08-library`

**Unfinished:** waiting for Adam's answer on readers' comments in repair
guides (`QUESTIONS.md`, 1), then the version bump to 1.24.8. Built on
`lantern-1.24.7`.

## What it is

From Adam's run of the 35B on 1.24.6 with the library (134 of 138; rows in
`tests/fixtures/bench_run_1246_35b_library.json`): three "Not in my
library" answers with the right article and the wrong part of it. The
change (LIBRARY_ENGINE) reads an iFixit step as its lines without the
readers' comments, gives a travel guide's own section for a question about
it, and counts the sentences that say what a thing is made of. The draft
changelog entry is `agent/drafts/changelog_1248.md`.

## Reviews

Five agents that had not seen it written, each on pages and questions of
its own (261 pages, 2,704 questions in all, at both lengths): 69, 8, 37,
21 and 14 answers lost; each mended. Their pages are
`tests/fixtures/kiwix/library_review1_1248.json` to `_5_`, replayed by
`tests/library_review_1248.js`: none lost now but 8 answered only in a
reader's comment (left out on purpose) and 5 at the length Lantern does
not pick; 188 found that 1.24.7 does not find. The fifth review's mends
(a make-up said in figures, "sun" as a word, a town by another name) were
replayed against all five reviews; no sixth agent tried them.

## What was run

- `tests/library_sections.js` (13), `tests/library_review_1248.js`,
  `tests/library.js` (87), and the whole suite.
- Old against new on every page the tests held before, 35 questions these
  rules are not about: 1,641 of 1,750 passages the same; 109 differ (the
  guide without its comments, the town's labels and sections).
- Not on the real files (on Adam's stick); no model has run it.

## Not in it

The music mend (a held note a half step from its chord), written and
tested in the session of 2026-11-07, waits for Adam (`QUESTIONS.md`, 2).
