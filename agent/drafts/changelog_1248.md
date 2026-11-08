## 1.24.8 — The part of the article that answers (DATE)

**What was seen.** Adam ran the 35B on 1.24.6 with the encyclopedia, in
Firefox on his laptop from the `D:` stick (2026-11-08 UTC, 95 minutes):
134 of 138 scored questions, the first full run with the 24 library
questions. Its failed rows are `tests/fixtures/bench_run_1246_35b_library.json`.
Three of the five were "Not in my library" with the right article found:

- "How do I replace the battery in an iPhone 8?": the iFixit guides for
  the iPhone 8 and 8 Plus were passages 2 and 3, and what they held was
  the first step, then readers' comments (on picks and credit cards, by
  name), then the first step again;
- "What is a good way to get around Nairobi as a visitor?": Wikivoyage's
  Nairobi was passage 1, and what it said was the railway's history, a
  house to visit with a guide and the internet cafes;
- "What is oral rehydration solution made of?": the article was passage 1,
  and what it said was what it is for, the 1940s, homemade solutions not
  being well studied, and its other names.

**What it was traced to.**

- *A list item read whole.* The offline iFixit file (written by the
  openzim/ifixit scraper; its templates `guide.html`,
  `guide-step-lines-container.html` and `guide-comments.html` say how)
  makes each step a list item that holds the step's heading ("Step 3"),
  its lines, each a paragraph in a list of its own, and its readers'
  comments. Lantern read every `li` and every `p` as a paragraph: the
  step's item came out as one paragraph with the comments in it, and its
  lines again after it. The lines themselves are often shorter than 40
  characters ("Power off your iPhone."), Lantern's least for a paragraph.
- *A section's sentences do not say its heading.* Wikivoyage writes every
  town under the same headings (Understand, Get in, Get around, See, Eat,
  Sleep, Stay safe ...). The sentences under "Get around" say "matatu" and
  "taxi"; the words of the question that are left after Lantern's common
  words ("good", "way", "around", "Nairobi", "visitor") are said by the
  sentences elsewhere that mention visitors. And a sub-heading ("By taxi")
  replaced its section's heading as the paragraph's section.
- *What a thing is made of is not said with "made".* The lead of "Oral
  rehydration therapy" says that it is water with small amounts of sugar
  and salts (the live article; the offline file was not opened here).
  That sentence shares no word with the question; the one about homemade
  solutions shares two.

**Five reviews.** Each draft was given to an agent that had not seen it
written, with pages and questions of its own laid out as the offline files
are (the iFixit pages from the scraper's own templates and its table of
step labels in eleven languages), and every page in its own words:

1. 62 pages, 423 questions: 69 answers the draft lost. A list item that
   holds a list read as its own words lost its short line (a year, a
   dictionary sense, a spec); "Plant sources" skipped under "Sources";
   "What should I do if I am robbed?" given the "Do" section;
   "contains" and "including" counted as saying what a thing is made of.
2. 43 pages, 469 questions: 8 lost, among them "a mixture of cement, sand
   and water" not counted for mortar on the Cement page.
3. 46 pages, 551 questions: 37 lost. The word "step" of every label
   matched "What is the first step ...?"; "amounts of" counted for
   "Chocolate contains moderate amounts of caffeine"; a card on a page
   made from a website, and a Turkish guide's "Adım 3", read as their
   own words without their short lines; a step of eight long lines joined
   too long to fit beside the lead.
4. 53 pages, 716 questions: 21 lost. A kind or a part of the article's
   subject ("stainless steel" on Steel, "Earth's core") given its other
   kinds' make-up; "it" in a section about the Moon taken for the Earth;
   the longer labels running a detailed passage past its room.
5. 52 pages, 551 questions: 14 lost. A make-up said in figures ("Honey is
   about 80 percent sugars"); "sun" found in "sunlight"; a town asked for
   by another name ("How do I get to Bombay?") taken for a place near it.

Each was mended, and every review's pages are run again by the tests: of
2,704 questions at both lengths, no answer 1.24.7 found is lost but those
written in the test with why -- 8 questions whose answer is only in a
reader's comment on a repair guide (left out on purpose; one is a warning
that a fan capacitor can hold a charge: Adam's to say whether comments
come back), and 5 at the length Lantern does not pick for the question.
188 are found that 1.24.7 does not find.

**What changed** (LIBRARY_ENGINE).

- A guide's readers' comments are left out (iFixit's comment containers).
- A list item that holds a step's heading -- an iFixit step, in any of
  the scraper's languages (Step, Étape, Passo, Schritt, Stap, Paso, Adim,
  Шаг, 手順, 步骤, and the Korean label with its number first) -- is
  read as its own words. Each line of the step, however short, is a
  paragraph that begins with its step: "Step 3: Warm the bottom edge of
  the screen for a minute." An article with sections called "Step 1",
  "Step 2" is read as before. Any other list item is read whole, as
  before, and what it holds again on its own; a sentence said twice is
  given once.
- In a detailed passage a step's lines are one item again, up to 800
  characters; a longer step goes on under its number.
- The label's word "step" is not one of the question's words; a question
  that names a step ("the first step", "step 4", "the last step") is
  given that step's sentences first.
- A section is skipped by its own heading.
- A paragraph's section is its top heading and the one under it ("Get
  around / By taxi"), and the top heading is counted in the room.
- On a page with four or more of a travel guide's headings, a question
  about getting around, getting there, eating, paying, going out, a place
  to stay, crime and safety, staying healthy, sights, or things to do
  ("what is there to do in", not "what should I do if") takes the first
  sentences of that section first. A place named that is not the town
  (not in its title, nor in its first paragraph: "Diani" on Mombasa, not
  "Bombay" on Mumbai) is reached from Get around or Go next. On a travel
  guide "visitor" and "tourist" count less; "hostel" also finds
  "backpackers" and "dorm".
- A question about what a thing is made of ("made of", "ingredients",
  "composition", "consist of") counts the sentences that say so
  ("mixture of", "consists of", "with small amounts of", "produced by
  heating", "made from", "is about 80 percent") and that name the thing
  asked, word for word -- each of its words that is not the article's --
  or say "it" in the article's lead when the thing is the article's own.
  Not "contains", "including", or "amounts of" without "with".

**What was tested.**

- `npm test`: all SUITES suites pass. New: `tests/library_sections.js`
  (13 checks) with stand-in pages in `tests/fixtures/kiwix/sections_1248.json`,
  written in Lantern's own words and laid out as the offline files are: an
  iFixit guide as the scraper writes one, a Wikivoyage town long enough
  that its sentences about visitors fill a passage, an article whose lead
  says what a thing is made of without saying "made of", a list inside a
  list item. On 1.24.7 each gives what Adam's run was given (10 of the 13
  checks fail); here each gives the part that answers. And
  `tests/library_review_1248.js`: the five reviews' 261 pages and 2,704
  questions (`tests/fixtures/kiwix/library_review1_1248.json` to
  `_5_`), with whether 1.24.7 found each answer at each length.
  `tests/library.js` passes as it was (87).
- Old against new, on every page the tests held before, for 35 questions
  these rules are not about, short and detailed: 1,641 of 1,750 passages
  are the same; the 109 that differ are the guide without its comments and
  with its steps' numbers (70), and the town (39: its detailed passages
  naming a sub-section with its top heading, and its health, safety and
  eating sections brought forward for "What causes malaria?", "How many
  visitors come?" and "Which grain do most people eat?").

**What was not.**

- Not on the real files. They are on Adam's stick, and the session could
  not reach Wikipedia, Wikivoyage or Kiwix's own servers; the reviews'
  pages are 5,000 to 15,000 characters, the real ones 30,000 to 100,000.
  The next run with the library is the test.
- Search and ranking across articles are as they were; only the cutting
  of a passage changed.
- No model has run 1.24.8.
