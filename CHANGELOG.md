# Changelog

## 1.24.15 — Adam's run of 1.24.14: a door below its wall, a tree over the house, and the road drawn when none is (2026-11-12)

Adam ran the 35B on 1.24.14 with the library on his laptop (2026-11-12,
14:49 UTC, 117 minutes): **137 of 140** (135 on 1.24.13), and sent three
pictures with it: "The door to the house overlaps the ground. The tree is
not seperated from the house other than the color. There is no road in
the mountain picture where the road should be."
(`tests/fixtures/bench_run_1254_35b_library.json`, replayed by
`tests/bench_1255.js`; the two houses passed the bench and are kept under
`seen`.) The small models' run on 1.24.14 (all three on an AMD EPYC 7763,
`tests/fixtures/bench_run_1254_{4b,2b,08b}.json`): the 4B 108 of 114, its
road passing now (moved from under the ground); the 2B 74; the 0.8B 54.

**What was seen.**

- *The two coins under the cups* pass: the 35B's TRACK block, the same as
  on 1.24.11 and 1.24.13, runs with nothing questioned (1.24.14).
- *The shore at sunset* passes: told "write rect 0 9.5 20 2.5 fill sand in
  place of “rect 0 10 20 2 fill sky”", the 35B wrote that line (1.24.14).
- *The road to the horizon* fails as on 1.24.8, 1.24.9, 1.24.13: "tri 0 6
  20 6 10 0 fill gray", 26 times, and nothing on the ground. Told that if
  this tri is the road it goes up into the sky, and handed the line to
  write in its place, it wrote its own lines again. To a person, as Adam
  says, the tri is a mountain, and there is no road.
- *The house* (make-house) passed, its door "rect 8 7 4 2" on a wall "rect
  4 6 12 2": the door's top on the wall, its foot at y 9 on the grass, a
  cell below the wall's (8). The guide's example draws a door 2 high on a
  wall 4 high; the 35B drew the door, and a wall 2 high.
- *The house on a hill at sunset* passed, its tree "rect 10 5 2 4" and
  "circle 11 4 2" against the wall's corner and over the roof's: the trunk
  touches the wall, the crown covers the eave, and the tree and the house
  are one shape but for the colours.
- *The iPhone and Nairobi* fail as on 1.24.9, 1.24.11, 1.24.13 (the line
  to write is not handed to either: `QUEUE.md` 3). Three puzzles tried
  without Lantern's tools failed (not scored).

**What it was traced to, and what changed** (AI_SCENE, rule 2: Lantern
does what can be worked out, and says so; rule 7: only when it is surer
than the model).

- *Only a house asked for in plain words* (`house()`, new; rule 7). The
  door and the tree are mended only when every word of the question is one
  Lantern knows for a house (HOUSEWORDS: a house, cottage, cabin, hut, barn
  or farmhouse and its roof, door, windows and chimney; the sky, the sun,
  the time of day, hills, fields, trees, colours, plain words), and the
  picture has no line Lantern cannot place (words). A girl, a postbox, a
  yard, a corner, the left, the foreground: the picture is the model's. A
  house is a wall the house check counts (a filled rect 2 to 16 wide, 2 or
  more high) with its roof drawn after it, on its top, over its middle, at
  most three cells wider.
- *A door hung below its wall.* The one rect drawn after the wall, within
  its width, at most two fifths of it (half when a door is asked for),
  taller than wide unless a door is asked for, its top on the wall and its
  foot more than a quarter cell below the wall's (less of it below than on
  the wall), at least 0.6 wide, is moved up so its foot is the wall's, shortened to four fifths
  of the wall if taller, with what lies wholly on it (a knob, its window,
  its outline), and Lantern says so ("moved the door, “rect 8 7 4 2 fill
  dark green”, up onto its wall: its foot was at y 9, below the wall's (y
  8), on the ground, and shortened it to 1.5 high: it was 2, and the wall
  is 2 -- rect 8 6.5 4 1.5 fill dark green"). Not when anything else
  touches it (legs, a head, wheels, a step, a path's tip: shapes that share
  an edge touch, and lines do), nor when anything else on the wall or just
  under it may be the door (1 high or more by the wall's foot, in any
  colour, in outline, in lines, or drawn before the wall), nor when the
  grass drawn after the house hides the door's foot.
- *A tree drawn over the house.* A tree (an upright trunk rect of an earth
  colour, at most 2.5 wide and twice as tall, 2 or more high, with green
  circle or oval crowns on its top, at least 1.5 across and 1.6 times the
  trunk's width; a rect within the wall's ends whose foot is by the wall's
  is its door, whatever is over it) drawn after a house, its foot within a
  cell of the wall's, and covering at least half a cell of its wall and
  roof (Adam's: 1.1 cells) is moved sideways, whole, to the nearer side
  where it stands clear: at most five cells, its foot still on the ground
  (in a band or on its top edge, as the guide's own tree stands) and on no
  tri, touching nothing there (lines and all), and covering the sun, the
  moon or a cloud no more than before. Lantern says so ("moved the tree, “rect 10 5 2 4 fill
  brown” and “circle 11 4 2 fill dark green”, 2.5 to the right, clear of
  the house: it stood against the house, in front of it"). Not when the
  question puts the tree with the house (in front, behind, against, over,
  shading, a tree house, a swing, apples, by the door or the window), nor
  when anything touches it but
  the house, nor when it only touches the house or its crown is just over
  the eave (the model's "next to it").
- *No road at all* (the landscape mend, rule 3: "or Lantern adds the thing
  itself and says so"). When the question asks for a road, path, track,
  river or stream going away, and nothing at all is drawn on the ground,
  Lantern draws it -- "tri 7 12 13 12 10 H", wide at the bottom edge, a
  point on the horizon -- just after the ground, and says so; the model's
  own tri is left as drawn. Gray, or tan on gray, grey, dark gray or black
  ground; a river blue, or light blue on blue; the question's own colour
  when it names one just before the road ("a brown path"), and a dirt,
  dusty or gravel road tan (brown on sand). With the sea or a lake behind
  the land, the point is the shore. At any doubt it is asked for, as on
  1.24.14: a railway or tracks (rails are lines), two roads, a winding
  road, "a trail of clouds" or "a path of moonlight", a river and a road
  in one question, water anywhere under the road but the sea behind the
  land, a band of the road's colour across the land or a thin stripe (a
  road seen running across), a narrow tri of its colour standing on the
  horizon where the road would end (the model's road drawn upright), a
  shape of its colour lying on a hill or a mountain (a path up a hill, a
  river between mountains), a line on a hill or near the ground. The 35B's road of four versions is drawn and passes the bench.
- `tools/draw_log.py` takes its port from `DRAW_PORT` (two can run at
  once).

**Reviews.** By three agents that had not seen the rules written, each on
the draft mended after the one before; their pictures are in
`tests/fixtures/review{1,2,3}_1255_draw.json` and replayed by
`tests/review_1255.js`:

- review 1 (196 pictures): 29 right pictures changed, 24 of them spoiled --
  a child's body lifted off her legs, a car off its wheels, a lamp post, a
  porch post, a step, doors that reach through a foundation; a bush and a
  potted plant moved from the door, trees with their apples, swing or
  birdhouse left behind, a tree on a hill into the air, one onto a road,
  trees by a lake taken for a house; the road drawn the colour of grey
  ground, across the sea, as a gray "river" for a river and a road, as a
  plain tri for a railway;
- review 2 (188): 34 right pictures changed -- a girl's body, a trash can,
  a postbox, a phone box, a cactus, a gnome and a broom moved up as "the
  door" where the wall had none (or one in outline, in lines, in its own
  colour); a door's round green window, a lamp post and a mailbox moved as
  a tree; a hammock, a washing line, a dog's lead left in the air; trees put
  on a driveway, a bench, a road; shapes that share an edge not seen to
  touch; a road drawn under a path up a hill and a river between mountains
  (an hourglass), and rising out of water at the front;
- review 3 (180): 17 right pictures changed -- a door with a round green
  window, on a sill, moved as a tree; trees the question put by the door,
  by the window or at the front, and big trees in the foreground, moved
  away; a shrub in a pot; a drainpipe moved as the door; a door whose foot
  the grass drawn last hides; a road drawn for "a trail of clouds"; a tree
  moved over a gray moon, onto a pine, under a cloud; a road under one drawn
  upright on the horizon (a bowtie), and across a highway band.
- Each mended as above. Now, on the three reviews' pictures: no right
  picture is changed but one review 1 allowed ("drawn as written, or the
  whole tree moved clear"); five that review 3 called partly right change
  as their wants allow, and two of review 1's (Adam's tree among them); 37,
  23 and 45 wrong ones are mended, or asked otherwise than on 1.24.14; 1.24.14's two reviews of the road and the older
  scene reviews (606 pictures) change only wrong ones; of 205 drawings
  the models wrote on 1.24.8 to 1.24.14, only the 35B's three change. The
  mends after review 3 were checked against the three reviews' inputs,
  not by a fourth reviewer.

**What was run.** `npm test`: ALL CHECKS PASS (SUITES suites); the browser
tests of the landscape (scene), the bench (bench_run9, bench_headless).
Replayed only: no model has run 1.24.15; the small models' run starts with
the push. Adam's three pictures, as the 35B drew them and as Lantern draws
them now, were drawn in a browser (`tools/draw_log.py`) and sent to him:
how they look is his to judge.

## 1.24.14 — Adam's run of 1.24.13: a right puzzle block questioned, and the line to write for a beach, a road and a quote (2026-11-10)

Adam ran the 35B on 1.24.13 with the library on his laptop (2026-11-10,
16:18 UTC, 123 minutes): **135 of 140** (134 on 1.24.9 and 1.24.11), the
P1AM seal-in passing now (`tests/fixtures/bench_run_1253_35b_library.json`,
replayed by `tests/bench_1254.js`). The small models' run on 1.24.13
(GitHub 42740634844, all three on an AMD EPYC 7763,
`tests/fixtures/bench_run_1253_{4b,2b,08b}.json`): the 4B 107 of 114, the
same seven rows as on 1.24.12; the 2B 74; the 0.8B 54.

**What was seen.** Five rows failed on the 35B, four of them with a reply
it had written before:

- *The two coins under the cups*, its reply of 1.24.11 word for word. Its
  TRACK block was right: step 2, "the cup two places to its left", was
  "swap holder of gold and left of left of holder of gold", and Lantern ran
  the block to the right order. Then Lantern's own check said the line
  "moves 1 place" and told it to write "2 left of left of holder of gold" --
  three places, off the row. That block could not run, and the 35B worked
  the puzzle out itself, wrong, both times.
- *The iPhone 8's battery* and *Nairobi's transport*, word for word as on
  1.24.11 (failing as on 1.24.9): "discharge the battery below 25% [3]" with
  no QUOTE [3] line; "ride-hailing apps [3]" with a QUOTE [3] in no passage.
  Told "there is no QUOTE [3] line", the 35B wrote the same reply again.
- *The shore at sunset*: "tri 5 6 12 1 19 6 fill dark gray" -- an unknown
  colour "dark" -- written again on the retry.
- *The road to the horizon*: "tri 0 6 20 6 10 0 fill gray", a tri standing
  on the horizon with its point at the top of the picture, 37 times, then
  26; asked to add a road on the ground, the 35B wrote its own line again
  (the same tri on 1.24.8 and 1.24.9).
- The 4B's road, with the same first reply on 1.24.10, 1.24.11, 1.24.12 and
  1.24.13: the road, then the ground over it; asked about the hidden road
  ("draw the background first"), it kept the order.

**What it was traced to, and what changed.**

- *TRACK's check counted a chain as one place* (AI_PUZZLE_CHECK). The
  runner reads "left of left of X" as the place left of the place left of
  X; the check that a step's "two places" has a line that moves two looked
  only for a written 2. Now a step that reads, word for word, "<a name of
  the row> swaps with the <thing> N places to its left (right)", or "The
  <thing> holding the <token> swaps ...", from its own number to the next,
  with no other step saying the same of the same thing, is answered when
  the block swaps that name (or "holder of <token>") with a chain of "left
  of" ("right of") from it, N places in all (`chained()`). That is all it
  does: it never questions a block. A count that starts a chain ("2 right
  of right of Bible", three places) no longer counts as a 2 for another
  step. And when a line goes back and its place is a chain, the line to
  write is the chain written as one, the step's way ("moves 3 places:
  write “2 left of holder of coin”") -- 1.24.13 handed "2 left of left of
  ...", three places -- or the model's way when the question lists the row
  from right to left or back to front. The 35B's block of 1.24.11 and
  1.24.13 runs with nothing questioned and gives the bench's answer.
- *"dark gray" was not a colour* (AI_DRAW). The table had "light gray",
  "dark green" and "dark blue". Now "dark gray" is in it (a neutral one),
  and dark, deep, light, pale or bright before any colour of the table is
  read as a shade of it (dark: 45% toward black; light and pale: 50%
  toward white) -- not "dark white" nor "light black". A shade is its own
  fill to the landscape rules ("dark orange" is of orange's family, and is
  not taken for an orange sun). A sun in a pale, light, bright or deep
  yellow, orange, red or white, or a dark yellow, gold or orange, is a sun;
  a sunset sky in a light shade of a day's blue is asked about as one.
- *The beach line covered the model's own band* (the landscape mend). The
  35B's first shore had "rect 0 10 20 2 fill sky" at the bottom; the beach
  Lantern asked for, "rect 0 9.5 20 2.5 fill sand", covers all of it, and
  the retry was asked about the band as hidden. A band of light, shallow
  water the beach would cover, and that shows, is now named: "write rect 0
  9.5 20 2.5 fill sand in place of “rect 0 10 20 2 fill sky”". The 35B's
  shore, written so, passes the bench.
- *The road drawn going up was not named.* When a road going away has
  nothing on the ground, one tri of a road's colour stands on the horizon
  with its point at the top of the picture (y 1 or above), and the
  question asks for no mountain, hill, tree, tent, dune, rock, sand, house,
  boat or the like, the message names it: "if “tri 0 6 20 6 10 0 fill gray”
  is the road, it goes up from the horizon to a point at y 0, in the sky --
  write tri 7 12 13 12 10 6 fill gray in its place, after the ground". The
  35B's road, written so, passes the bench.
- *A road under the ground is moved* (the landscape mend, rule 2). For a
  road, path or river going away, a tri from the bottom edge up to the top
  of the ground, drawn before a band of ground that covers all of it, in
  another colour, goes just after the band, and Lantern says so ("moved
  “tri 0 12 10 6 20 12 fill gray” after “rect 0 6 20 6 fill green”: drawn
  before it, it was hidden under it"). Not when the question puts it under
  something -- snow, flood water, the tide, drifting sand, ice, fog, cloud
  -- nor when another band drawn later still covers part of it, nor when
  it is written again after the band. The 4B's road of four versions
  passes the bench now.
- *The library's send-back gave no line to write* (LIBRARY_CHECKS, rule
  3). When an answer cites [n] and has no QUOTE [n] that is in passage n,
  the problem may now end with the line: "there is no QUOTE [1] line: for
  “...” write QUOTE [1]: <the sentence>". Lantern does not write the quote
  (1.24.11 took out a rule that did: it verified 101 of 181 wrong
  answers), and verifies nothing more than before; the model writes the
  line, and the answer is checked as any other. Three reviews narrowed it
  until no wrong answer of theirs was verified once its line was written.
  The line is handed only when:
  - every part that cites [n] is a whole sentence of passage n in its own
    words, but for what says nothing -- an article, a word like "of" or
    "with", a "Step 1:", the question's own words, a "To replace the
    battery," that the passage's title or the sentence names -- with
    nothing left out that says something (a condition, "more than",
    "usually", a number, a unit, a minus, "First of all"), its words in
    order, the same "not", and no word the opposite of one of the part's
    (over and under, °F and °C, warm and cold, on and off ...);
  - the sentence does not point back ("It is about half the size of
    Earth"), and every word the question asks with (not "treat", "best",
    "way") is in the sentence or in the passage's title: no clear water's
    dose for cloudy water, no dog's for a ferret, no adults' for a child;
  - the answer has no yes or no in it, nothing uncited, and nothing below
    its ANSWER line (verify reads that line only);
  - every other part is said by one of the model's own quotes of its
    passage, its words there in order but one in four, with the same "not"
    and no opposite;
  - at most three lines, all from the passage the answer cites.
  **This does not mend the iPhone row**: the 35B's other parts paraphrase
  their quotes ("remove the four adhesive strips securing it", "Finally,
  remove the battery"), and the answer goes back as on 1.24.13. An answer
  whose other parts are their quotes' own words is handed "QUOTE [3]: Step
  1: Before you begin, discharge your iPhone battery below 25%." Nairobi's
  part is in no sentence by itself, and goes back as before.

**Reviews.** By agents that had not seen the rules written, their inputs in
`tests/fixtures/review{1,2,3}_1254_*.json`, replayed by `tests/review_1254.js`:

- review 1 (106 TRACK blocks, 286 library answers with their passages, 157
  drawings) tried the first draft. TRACK: 16 wrong blocks passed only
  because of the new count (a chain anywhere in the block counted for a
  step; "behind behind" and "2 seats left of" were counted, which the
  runner reads otherwise; a move line was counted as two places). The
  library: 34 wrong answers and 7 partly wrong ones verified once the
  handed line was written (a yes stripped, a "do not" or an "if" left out,
  "In children" left out, 74 °F matched to "74 °C (165 °F)", a wrong part
  riding on the other quotes). Drawings: the road moved out from under
  snow, flood water and a near field; a tall dark pine named as the road;
  sand "in place of" a strip the sea covers; a sun in pale yellow asked for
  again. The first draft also moved any shape a band covered, and the
  older reviews' pictures caught it (a swimmer's body under the sea, a
  lime band over two greens);
- review 2, by another agent (84 blocks, 310 answers, 116 drawings): TRACK
  passed 8 wrong blocks that 1.24.13 caught and questioned 4 right ones it
  ran (a chain counted from another thing, a step's phrase paired with
  another step's line, one phrase at two steps, "behind" in a queue listed
  back to front); the library verified 38 wrong and 15 partly wrong
  answers ("Yes." as a sentence of its own, a "For children," frame cut, a
  minus written as a dash, "more than" or "usually" left out, a sentence cut
  at "p.m.", an adult's dose handed for a child); drawings: the road moved
  out from under the tide, drifting sand and ice, a rock and a dune named
  as the road, an autumn tree's dark orange crown put behind the land as
  the sun;
- review 3, by a third agent (75 blocks, 241 answers): TRACK passed 16
  wrong blocks that 1.24.13 caught (the step's text read from step 1, so
  another step gave the swap or the thing's words; a step that lifts a
  coin; "the cup next to the gold cup"; "Di" found in "directly"); the
  library verified 65 wrong or partly wrong answers (30 moved to a passage
  about another town, drug or mountain; "It is ..." sentences; a ferret, a
  6-year-old; sentences cut at "p.m. (" and "approx."; "First of all" for
  step 4; "1/2" read as 1 to 2; "white" chocolate beside its quote's
  "dark").
- Each mended as above. Now, on the three reviews' cases: no wrong TRACK
  block passes that 1.24.13 caught, and no right one is questioned that it
  ran (18, 16 and 25 right ones are questioned; 31, 30 and 34 were); no
  wrong or partly wrong answer is verified once its handed line is written
  (23, 45 and 36 right ones are; 25 of the 1.24.11 review's 158 right
  ones); no right picture is asked or changed in a way 1.24.13 did not.
  The mends after review 3 were checked against the three reviews' inputs
  and the 1.24.11 review's, not by a fourth reviewer.

**What was run.** `npm test`: ALL CHECKS PASS (85 suites); the browser
tests of the landscape (scene), the bench (bench_run9, bench_headless).
Replayed only: no model has run 1.24.14. Whether
the 35B writes the lines it is handed -- the beach, the road, the TRACK
line -- is for Adam's next run; the small models' run starts with the push.

## 1.24.13 — A Start/Stop sketch run, not read by its names; what each kind of question costs (2026-11-09)

The 35B's P1AM seal-in on 1.24.12, on Adam's laptop, the seven program
questions on the build that was pushed (2026-11-09, 22:30 UTC): 7 of 7 by
the bench -- but its P1AM program read the normally closed Stop as
`stopPressed = !P1.readDiscrete(inSlot, 2)` (on while pressed) and then
`motorRunning = (startPressed || motorRunning) && stopPressed`: the motor
starts only with Stop held and runs only while it is held
(`tests/fixtures/bench_run_1252_35b_code_final.json`). The test build's
program had done the same with an if; 1.24.11's had let Start win. Three
times, three shapes, the same Stop.

**What it was traced to.** The bench's check read names: an if on a
"stopPressed" that turns the motor on was caught, `&& stopPressed` was not.
And Lantern's own tested P1AM example, given to the model with the
question, reads the Stop as `stopOk` (on while NOT pressed) and writes
`&& stopOk`: the 35B kept its shape, renamed the Stop the way people name
it -- stopPressed, with a `!` to make the name true -- and kept `&&`.

**What changed.**

- *A sketch run, press by press* (CODE_SCAN, new). A P1AM-100 sketch is
  read by Lantern's own small interpreter of C and run scan by scan
  through the presses a person makes, each held for eight scans: Start,
  let go, Stop, let go, both together, Stop first. Only a small part of C
  is taken -- declarations, functions, if and else, return, the operators
  of C, casts, `#define`, P1.readDiscrete and writeDiscrete (one channel or
  the whole module), millis() -- and anything else (a loop, an array, a
  string, a member) means no run. Nothing of the sketch runs as
  JavaScript; a block is its own scope, as in C; each scan has a step
  limit and the run a budget. An input the question does not mention (an
  overload contact) is tried both ways; a motor that changes from one
  scan to the next with the buttons held still is said to.
- *The bench's P1AM question is graded by what the motor does*:
  "Stop turns the motor on: it runs only while Stop is pressed", "Stop does
  not stop the motor", "Start wins over Stop", "no seal-in", "Start does not
  start the motor", "the motor starts again when Stop is let go", "the
  contactor is on output 1 of slot 2, and the sketch never drives it", "the
  motor does not settle"; the name-reading checks stay for a sketch that
  cannot be run.
- *Lantern sends it back* (AI_CODE, stopScan). When the question says how
  the Stop is wired (a normally closed or open Stop on input N, a Start on
  input M) and the run shows the Stop wrong every way an open input can
  be, the sketch goes back once with what the question says, what the run
  showed, and the line with the Stop name used the other way round, in as
  few lines as do it -- only when the sketch, run again with that line,
  works, and every other output (a lamp that shows Stop held) does what it
  did: "Write: motorRunning = (startPressed || motorRunning) &&
  !stopPressed;". It reads the wiring only where the question is plain
  about it: one Stop and one Start, NC or NO in words or in capitals (not
  "no overload"), an E-stop never taken for the Stop, the contactor's
  output not a lamp's; and it says nothing where time is part of the
  question (a run-on, a timer) or the sketch uses millis(). The rule
  taken out in 1.24.12 went by names, and a stop that turns a brake ON is
  right; this one goes by the wiring the question gives, and by the run.
- *Lantern's P1AM example names its Stop as the model does*: `bool
  stopPressed = !P1.readDiscrete(inSlot, 2);  // NC: the input is OFF while
  Stop is pressed`, and `running = (startPressed || running) &&
  !stopPressed && !overloadTripped;` -- so the shape a model copies, with
  the name it likes, is right (rule 1). Checked by the runner on the
  question's wiring and with g++ against stub headers, not against the real
  P1AM headers.
- *What each kind of question costs* (AI_BENCH, tools/bench_headless.py):
  the summary and the table give, per kind, the tokens the model wrote (all
  rounds) per right answer, the median, and the rounds per question; the
  measure for the research thread's brief on the boundary between the
  model and Lantern (`agent/briefs/2026-11-09-model-lantern-boundary.txt`,
  `agent/QUEUE.md` 2).

**Reviews.** By agents that had not seen the rules written, their inputs in
`tests/fixtures/review5_1253_*.json` and `review6_1253_*.json`, replayed by
`tests/bench_1253.js`:

- review 5 (164 sketches, each label checked with its own evaluator; 45
  sketches that try to get out): the first runner turned the sketch into
  JavaScript, and 12 sketches reached the page through it -- a function
  inside another, `({ name } = loop)`, an object with a method, an arrow
  made by an empty `#define` -- and 11 hung it or took over 30 s; 7 of 101
  right sketches got a message (a print under an if with no braces, the
  Start's "normally open" taken for the Stop's, "no overload" read as
  N.O., a lamp's output named first, a Jog on the same channel of another
  slot, a fan's run-on), the bench failed right ones (a debounce, a whole
  module read, `#define` reads) and passed wrong ones (the wrong output,
  a Start that toggles while held), and a line to write broke a lamp.
  Mended: the interpreter in place of the translation, and the rest as
  above. Now none of the 45 reaches the page, navigates or takes 3 s;
  none of the 95 right sketches gets a message or fails the bench; 45 of
  its 69 wrong ones get one -- the rest, a motor that starts again when
  Stop is let go with the Stop read right (the bench says it) and a sketch
  timed with millis(); every line to write runs right in its evaluator;
- review 6, by another agent (94 safety sketches, each in its own process;
  77 small sketches run as real C++ with g++ beside Lantern's
  interpreter; 59 start/stop sketches in other words, each line to write
  compiled and run): nothing reached the page, but six sketches took over
  2 s or ran out of memory (2,300 lines naming the Stop built every set of
  three lines before trying one; writes to ever-new slots; doubling
  macros; 100,000 nested brackets took the Start-wins reading 40 s); 18
  of the 77 ran otherwise than C (a bool not made 0 or 1, integer sizes,
  float division, casts, octal and character literals, a `#define` put in
  brackets or defined again); the bench failed a right sketch with `//`
  inside a string and passed four wrong ones it could not run; a line
  with a `//` comment hid the rest of its statement. Mended: types as C
  has them on the P1AM's 32-bit processor, macros as C puts them in, a
  slot of 0 to 15, at most 8 lines and 20 sets tried, the Start-wins
  reading only for a program under 20,000 characters, strings read before
  comments. Now all 77 run as C runs them; none of its 37 right sketches
  gets a message or fails the bench; 21 of its 22 wrong ones get one (the
  last keeps its inputs in an array, which is not run) and every line to
  write compiles and runs right; none of the 93 safety sketches reaches
  the page or takes 5 s (the 94th, a right sketch in 1 MB of blank lines,
  spends its minute in the bench's older reply parser: `QUEUE.md` 4).
  These last mends were checked against reviews 5 and 6's inputs and C,
  not by a seventh reviewer.

**What was run.** `npm test`: ALL CHECKS PASS (83 suites); the browser tests
of Code Lab, the text reader and the bench (code_lab, text_reader,
bench_headless, bench_run9). The small models' run of 1.24.12 (GitHub
42701646389, `tests/fixtures/bench_run_1252_*.json`): the 4B 107 of 114 on
the same EPYC 7763 as before -- its tank fill passes, which failed four
versions -- the 2B 73 (its Blink passes), the 0.8B 59. Not run: any model
on 1.24.13; the small models' run starts with the push. Adam is running
the 35B on 1.24.12.

## 1.24.12 — Adam's run of 1.24.11: a stop that does not stop, and programs written without their first line (2026-11-09)

Adam ran the 35B on 1.24.11 with the library on his laptop (2026-11-09,
14:05 UTC, 128 minutes): 134 of 140, as on 1.24.9
(`tests/fixtures/bench_run_1251_35b_library.json`, replayed by
`tests/bench_1251_35b.js`). The small models' run on 1.24.11 (GitHub run
42543507663, `tests/fixtures/bench_run_1251_*.json`, `tests/bench_1251.js`):
the 0.8B 59 of 114, its 1.24.10 replies word for word on the same processor;
the 2B 72 (73), on another processor; the 4B 106, the same eight rows as on
1.24.10 on the same AMD EPYC 7763, seven with the same reply.

**What was seen.**

- *1.24.11's changes did their work on the 35B.* What oral rehydration
  solution is made of is read on the medicine shelf and passes; so does the
  waltz. The iPhone and Nairobi fail on their citations, as on 1.24.9.
- *A stop that does not stop.* For "a Start button ... and a normally closed
  Stop button ... with a seal-in" on a P1AM, the 35B wrote
  `if (startPressed) { motorRunning = true; } else if (stopPressed) {
  motorRunning = false; }`. While Start is held, the else if is never
  reached: Stop cannot stop the motor. Lantern found no problem; the bench
  said "no seal-in", which was not what was wrong.
- *Programs written without the MAKE CODE line.* The 2B, for the tank fill
  and for Blink on 1.24.10 and 1.24.11 (the same rows twice): a line
  `<title>ST: Tank Fill Valve Control</title>`, a line `language st`, the
  program, END -- or the sketch between a line `<title>` and a line
  `</title>`. The instructions show `MAKE CODE: <title>`, and the
  placeholder was taken for a tag. Lantern said "no MAKE block" and never
  read the programs, one of which waited in `delay(500)` in a sketch asked
  not to.
- *The 4B's tank fill, on 1.24.8 to 1.24.11.* Its first reply was "LESSON:
  Tank fill/stop logic" over and over until its 1,000 tokens ran out; the
  second the same; the last, prose with [2] as the lessons asked and a
  program that stops half-way inside its fence -- the conversation, with
  the two runaway replies kept whole, left it too little room. Its
  orchestra began with a runaway LESSON line the same way.

**What it was traced to, and what changed.**

- *Start wins over Stop* (AI_CODE). Nothing looked at which of Start and
  Stop a program lets win. Now a program for a machine started and stopped
  by buttons is read for three shapes, in Arduino and in Structured Text:
  an if / else if chain that turns the output on before a Stop branch
  turns it off; two ifs side by side, the Stop one first (the last write
  in a scan counts); `out = start || (out && stopOk)`. It goes back once
  with the program's own lines written the way that works: the whole chain
  again, every branch kept (an e-stop, a fault, a jog, an else), the Stop
  branches moved up to just before the branch they lose to; or the two ifs
  the other way round; or `out = (start || out) && stopOk`, the stop terms
  moved out of the seal and every other term left where the model put it,
  with its brackets (`Motor := Start OR (Motor AND Auto AND NOT Stop)` ->
  `Motor := (Start OR (Motor AND Auto)) AND NOT Stop;`; `NOT (Stop OR
  Reset)` is taken as `NOT Stop AND NOT Reset`, and only the Stop goes
  out). Said with why:
  a stop overrides the start it belongs to (NFPA 79, 9.2.5.3.2; IEC
  60204-1). It speaks only where it is sure: the question names a machine
  and starting or running and stopping; the output is a machine's (not a
  lamp, an alarm, a count or a status flag -- read by the words of its
  name, so a Clamp is no lamp); the start is named as one (start, run,
  jog, forward; not a two-hand pair or "s1", nor a sensor: a level or
  float switch, a pressure switch, a photo eye, a thermostat); the conditions
  are plain inputs (names, digitalRead, readDiscrete, NOT, AND, OR, and
  what those names were set to), not comparisons, calls or members; the
  Stop input is named so (stop, e-stop, emergency, halt, overload, trip;
  not "stopped" or a stopwatch); the start does not look at that stop
  already (a "permissive"). Left alone: a toggle (a negated output in the
  condition: moving the Stop test does not mend it); a start that lasts one
  scan (its rising edge, a memory named held or last, a block's output
  `Q => StartPulse`, a bit the program clears after reading it); Stop
  having its say elsewhere in the program -- after the line, or in another
  function, since Lantern cannot follow the order functions are called in
  (it turns the output off again; a later line gives a machine the output
  together with a stop, or a permissive holding one; an if runs the
  machine from it and stops it on Stop) -- but not a lamp, a print or a
  timer's input, nor an interlock that uses the output negated; the line
  or chain inside another if; a Stop test before it that returns or
  breaks; code in a string, in a comment (nested ones too) or under `#if`.
- *A Stop that turns the output on: tried and taken out.* The 35B's second
  try at the same question, on the 1.24.12 test build, with Lantern's
  tested P1AM example in front of it: `if (startPressed || motorRunning) {
  if (stopPressed) { motorRunning = true; } else { motorRunning = false; }
  }` -- the motor on only while Stop is held. A rule that sent that back
  with the two bodies swapped was written, and the second review took it
  apart: of its 193 right programs it spoke about 27, and its swap made 17
  of them less safe (an e-stop's safe state, a dump valve, a brake, a
  ramp-down: a stop that turns something on is often the safe thing).
  Taken out. The bench says it instead (below); a surer rule is in the
  queue.
- *The bench's P1AM question* says what is wrong: "Start wins over Stop:
  while Start is held, Stop cannot stop the motor", "Stop turns the motor
  on: it runs only while Stop is pressed", or "no seal-in: nothing keeps
  the motor on once Start is let go"; a stop-first set and reset passes.
  (The bench may say what Lantern may not: it knows the question's wiring.)
- *A program without its MAKE line* (CHAT_CODE_BLOCKS). A line
  `<title>...</title>` and/or `language <one of the five>`, the program,
  then END, `>>>` or `</title>` -- or a sketch between `<title>` and
  `</title>` -- is read as the model's program, with its title, and goes
  through the same checks: the 2B's Blink goes back with the millis()
  lines, its tank fill with what is wrong in it. It needs its end line, no
  HTML tag in it, and no MAKE line in the reply; `<<<` never starts one
  (that is how Lantern shows its own examples).
- *A program cut off inside its fence.* A fence that names its language,
  opened and never closed, is read, marked cut, and the one problem sent
  back is "the program stops at line N, inside its fence: the reply was
  cut off ... write the whole program again as a MAKE CODE block, with
  fewer and shorter comments". Chat says the same under the reply. A bare
  fence left open is not read (output and data are often in one), nor one
  named pascal; one whose program ends (an END line, a sentence after a
  blank line, its brackets closed and its last line ending it) is read
  whole, not cut; one mostly sentences is not a program. A fence closed at
  the end of a code line is whole; a fence indented under a list item
  loses that indent; a fence is closed by one of its own kind at least as
  long (four backticks close three; a fence opened with four and closed
  with three, a model's slip, is closed there), and a fence shown inside a
  four-backtick or a `~~~` one is not read, nor one between Lantern's own
  `<<<` and `>>>`. A fence glued to the end of a code line closes it only
  inside a fence, and not on a line that is all comment (code with `//`
  or `#` in it, or a comment after code, ends there; backticks beyond the
  fence's own are the code's). A fence with no language that holds other
  fences (a README) is not read. `~~~` fences and the tags
  `structured_text` and `structured text` are read. A MAKE CODE block
  whose fence opens and never closes goes back cut.
- *A request kept once* (ASSIST_CHAT, AI_ACTIONS). A reply that asked for a
  command stays in the conversation with each command line once, a last
  line cut off part-way through one dropped, at most 500 characters, the
  first command always kept. Other lines -- a draft program beside the
  command -- are kept as written while there is room. In Chat a LOOKUP
  reply is kept the same way.
- *Lessons for a thing to make* (SUITE_COMMANDS, SUITE_CHAT). LESSON
  passages for a question that asks for something Lantern makes from a
  block end with that block's first line ("reply with ONLY the block ...
  Its first line is: MAKE CODE: <a short title>"), not with "answer from
  these passages and QUOTE one"; other questions end as before.

**Reviews.** Each new rule was tried by agents that had not seen it
written, with inputs of their own (all in `tests/fixtures/`, replayed by
`tests/review_1252.js`):

- Start wins over Stop, review 1 (232 programs): the first draft spoke
  about 12 programs it should have left alone (two stopwatches, a traffic
  light, a robot car, a bus stop, a selector switch, a start behind a
  "permissive" ...) and wrote 13 corrections wrong -- above all, a chain's
  other branches left off, so that the line, pasted in, dropped an e-stop
  or a fault. Mended as above: none of the 155 it said to leave alone is
  spoken about; every correction is the whole chain. 28 of its 77 wrong
  programs are left unsaid (a ternary, an SR block, a state machine, a
  timer's .Q, a start behind a function, two hands, a stop handled again
  later, a toggle ...): a miss, not a mistake;
- the readers, review 1 (140 replies): with no END, the explanation after a
  program was read into it; an HTML page's `<title>` and `<script>` were
  read as JavaScript; a draft beside a command lost its repeated lines; a
  command at the end of a long reply was cut off with the rest; output in
  a bare fence left open was read as a sketch. Mended as above.
- Start wins over Stop, review 2, by another agent (287 programs, 193
  right; the sketches and their corrections compiled with g++ against
  stub headers and run scan by scan): the "Stop turns on" rule, as above;
  the Start-wins rule spoke about 25 right programs (code in a string,
  under `#if`, a status lamp following a run flag, a start behind a
  function or a `#define`, a Stop that returns, a Stop that wins later in
  the scan, a chain inside `IF NOT Stop`). Mended: none of the 193 is
  spoken about; 54 of its 94 wrong programs are found, and every
  correction it gives compiles and, run with Start and Stop held
  together, stops the motor (four more, whose stop is a thermal trip, an
  e-stop, a normally closed contact or a command on the serial line, which
  the simulation's two buttons do not work, test that stop first as they
  should);
- the readers, review 2, by another agent (250 replies; 33 read wrong on
  the first pass): a closing fence glued to a code line, a fence indented
  under a list, prose after an open fence read as code, a fence named
  pascal, `<<<` examples read as the model's, a MAKE CODE block with an
  open fence not called cut, a LOOKUP runaway in Chat. Mended as above;
  of its 195 code replies, 21 are left, each for its reason: 8 open
  fences whose program is whole (read whole, not "cut off"), 12 misses
  (not read, or read without a title), 1 MAKE block whose open fence
  Chat also shows. No reply is told it was cut off where it was not;
- review 3, by a third agent, of what was mended after review 2 (a
  Structured Text seal-in with `OR (`, read as plain inputs at last; fence
  lengths; `<<<` examples): 147 programs of its own, each line it was
  given checked by truth table over every input and the old state, and 63
  replies (`tests/fixtures/review3_1252_*.json`). It found the one-line
  seal without the guards the ifs had: 14 of its 85 right programs spoken
  about (a Stop handled later, the line inside `IF NOT Stop`, a `RETURN`
  after Stop, starts of one scan, level switches, a latch the machine
  output gates with Stop, a strobe, a nested comment); and 5 lines that
  lost a bracket -- `(NOT Stop OR Maintenance)` handed back as `NOT Stop
  OR Maintenance`, which runs the motor on Maintenance alone. In the
  reader, 15 of 63 not as it expected (a sentence ending in three
  backticks opened a fence, a comment ending in them closed one, the form
  shown inside a fence or a `<<<` example read as the model's ...).
  Mended as above: none of the 85 is spoken about; 47 of 62 found; every
  line it is given does what the reviewer's own line does, but those of
  three programs, where Lantern moves only the stop terms and leaves an
  interlock, a mode and an overload it does not know by name (`OL1`)
  where the model put them: Stop wins, Start starts as the model wrote it. 59 of the 63
  replies read as expected; the 4 left are programs not read;
- review 4, by a fourth agent that had seen neither the rule written nor
  the earlier reviews (175 programs, 92 right, each line it was given run
  against the model's own logic: any stop on -> off, every stop off -> as
  the model wrote it; and 60 replies; `tests/fixtures/review4_1252_*.json`):
  16 of its 92 right programs spoken about (sensors not named so, an edge
  memory set in an if, a Stop handled in a helper function above or below
  loop(), an if that runs the machine from a request bit, a permissive
  holding the Stop, a Clamp read as a lamp) and one line wrong: `NOT (Stop
  OR Reset)` moved out whole, so Reset won over Start too. In the reader,
  10 of 60 not as expected (a bare four-backtick or `~~~` fence around a
  cpp one read as a program; `print(total // count)` with the fence glued
  on taken for a comment ...). Mended as above: none of the 92 is spoken
  about, 66 of 83 found, all 70 lines it is given pass its three tests;
  59 of the 60 replies read as expected (the one left: a line in a Python
  string ending in three backticks closes the fence, a program not read).
  The same build against the first three reviews' inputs: none of their
  433 right programs spoken about; 49 of 77, 54 of 94, 47 of 62 found.
  These last mends were checked against all four reviews' inputs, not by
  a fifth reviewer.

**What was run.** `npm test`: ALL CHECKS PASS (82 suites); the browser
tests of Code Lab, the text reader and the bench (code_lab, text_reader,
bench_headless, bench_run9). The 35B on Adam's laptop, the seven program
questions, on the build after the first reviews (b9f57ac, 2026-11-09):
7 of 7 (`tests/fixtures/bench_run_1252_35b_code.json`). Two rows kept: the
P1AM seal-in, whose program that time turned the motor on only while Stop
was pressed -- passed by that build's bench, failed by 1.24.12's -- and
the ladder, whose first reply asked for a LESSON and whose second, with
the lessons ending in the block's first line, was the block. Not run: a
full 35B run of the build that was pushed; the small models (their run
starts with the push).

**Not changed.** The iPhone's and Nairobi's citations, the shore at sunset
("dark gray" is not one of the drawing's colours), the road to the horizon,
the 4B's other repeated rows (QUEUE 1), a reply that echoes the MAKE CODE
instructions (the 0.8B, QUEUE 3), a Stop that turns the motor on (QUEUE 3).

## 1.24.11 — Adam's run of 1.24.9, the 4B on another processor (2026-11-08)

Adam ran the 35B on 1.24.9 with the library on his laptop (2026-11-08,
17:48 UTC, 103 minutes): 134 of 140, the same seven questions failed as on
1.24.8 (`tests/fixtures/bench_run_1249_35b_library.json`, replayed by
`tests/bench_1249_35b.js`). The small models' run on 1.24.10 (GitHub run
42509727008, `tests/fixtures/bench_run_1250_*.json`, `tests/bench_1250.js`):
the 0.8B 59 of 114 and the 2B 73, the same rows as on 1.24.9; the 4B 106
(110 on 1.24.8 and 1.24.9).

**What was seen.**

- *The library questions are answered from the library.* What oral
  rehydration solution is made of, how to replace an iPhone 8's battery,
  how to get around Nairobi: declined on 1.24.6 and 1.24.8 ("Not in my
  library"), answered rightly from the library on 1.24.9, the part of an
  article that answers now in front of the model. They fail on what they
  cite: the solution was read in Wikipedia, not WikiMed; the iPhone and
  Nairobi cite a passage without a quote from it.
- *The 4B wrote its 1.24.7 replies again.* On 1.24.10 it ran on an AMD EPYC
  7763 (on 1.24.8 an EPYC 9V74, on 1.24.9 a Xeon 8573C) and wrote, word for
  word, the replies of its 1.24.7 run to six questions, failing them again.
  1.24.10's own changes left the 0.8B and the 2B as they were; the 4B's
  shore at sunset passed, its first block (the same as on 1.24.8 and
  1.24.9) asked about the beach with the rest, the line it was given
  written back.
- The make rows of Adam's run are 1.24.8's replies word for word: on 1.24.10
  the waltz passes and the road is asked for with the line to add.

**What it was traced to, and what changed.**

- *"rehydration" was not one of the medicine shelf's words* ("dehydration"
  was), so a question about oral rehydration solution did not read WikiMed.
  Now it is, with ORS and electrolytes.
- *"part strings"* (the 4B's orchestra, on 1.24.7 and 1.24.10) went back as
  "Lantern has no such instrument": the instrument table has strings, and
  the rule that takes a plural's s off had made it "string". The name is
  looked up with its s as well. Its brass and bass parts, a bar or two
  short, still go back.
- *A run's replies follow its processor*: written into `CLAUDE.md`, with the
  six rows the 4B failed twice with the same reply as the queue's first
  item (`QUEUE.md`).

**Tried and taken out.** A rule that wrote the missing QUOTE for the model:
each part of the answer citing one passage looked for in it, the sentence
with the part's numbers, three of its words in four and the same "not"
quoted, and said. It verified the 35B's iPhone answer. An agent that had not
seen it written tried it on 339 answers of its own
(`tests/fixtures/review1_1251_quote.json`): of 181 wrong or partly wrong
answers, 1.24.10 verified 1 and the rule 101 -- a dose swapped, 165 C for
165 F, "do not leave the building" quoted for "leave the building", "over"
for "under", a step no passage has carried by the quotes of the others --
and told the person Lantern had found the sentence. Words in common do not
say what a sentence means; the check that an answer is the library's, not
the model's memory, stays the model's own quotes.
`tests/library_quote_1251.js` replays the 339 answers: each verified or not
as on 1.24.10, no QUOTE line added.

**What was tested.** `npm test` (79 suites) and the browser tests,
11, on the build that was pushed (GMS needs Adam's own file). Not tested: any model on 1.24.11 (the small models' run starts
with the push).

**Not changed.** The iPhone's and Nairobi's citations go back as on 1.24.9;
the shore at sunset for the 0.8B, the 2B and the 35B; the 4B's six rows.

## 1.24.10 — A line written again, a note held against its chord, a shore seen (2026-11-08)

Adam ran the 35B on 1.24.8 with the encyclopedia on his laptop (2026-11-08,
15:59 UTC, 100 minutes): 134 of 140 scored questions. Its seven failed rows
are `tests/fixtures/bench_run_1248_35b_library.json`. The three library
declines are 1.24.6's rows again (1.24.9 changes how the library is read; his
run of 1.24.9 is to come). Of the other four, two are mended here, and with
them the second of his two answers of 2026-11-08: "music - mend it". The
small models' runs on 1.24.8 and 1.24.9 (GitHub runs 42474037730 and
42490364017) are `tests/fixtures/bench_run_1248_*.json` and
`bench_run_1249_*.json`, replayed by `tests/bench_1248.js` and
`tests/bench_1249.js`.

**What was seen.**

- *The road into the distance.* The 35B's second reply wrote
  `tri 0 6 20 6 10 0 fill gray` 29 times, and nothing was asked about the
  road ("no road that narrows towards the horizon").
- *The waltz.* The 35B held A over E in bar 7, was told "write D or A
  there", and sent the same chords back: the same row as on 1.24.6.
- *The shore at sunset* failed for all four models, each its own way: the
  0.8B kept the day's blue sky, the 2B and the 35B drew off the grid (the
  35B's sea below the picture, under the example's green ground), the 4B
  drew no land in front of its sea. The 4B's row was the same on 1.24.8 and
  1.24.9, with the same two replies.
- 1.24.9 changed only the library, which the GitHub runs do not have: the
  0.8B failed the same 55 rows as on 1.24.8 (59 of 114), the 4B the same 4
  (110; 161 minutes on an Intel Xeon 8573C, 98 on 1.24.8 on an AMD EPYC
  9V74), the 2B 41 (73; 77 on 1.24.8, six rows moving each way: no finding).

**What it was traced to.**

- *A line written three times stopped the landscape rules.* AI_SCENE left a
  block with a line written three times or more to AI_DRAW as it was (a
  reply that ran away is AI_DRAW's to report), and AI_DRAW, since 1.24.8,
  does not ask about a shape under its own copy. So a road written 29 times
  was neither arranged nor asked about.
- *The waltz:* the line to write was given, and the model did not write it.
  The chord of the key that holds the note can be computed: Lantern's to do
  (rule 2), where it is sure (rule 7).
- *The 4B's shore:* its first block drew an orange band below the horizon,
  then the sea over it. The band, covered, was read as land in front of the
  sea, so the shore was not asked about; the 4B, asked about the hidden
  band, took it out, and the shore was asked about only then, in the last
  turn the bench gives.

**What changed.**

- *Earlier copies left out.* Where a line is written three times or more,
  and nothing drawn between the copies reaches across it (a curve's drawn
  line as AI_DRAW samples it, a line or an outline by its width, words), the
  earlier copies are left out, all of them or none, and Lantern says "left
  out N earlier copies of ...: a line written again, with nothing drawn
  between across it, draws nothing new". Not in a block cut off, nor one
  AI_DRAW reports as run away, nor where what is left would be a run. The
  35B's road is now asked for with the line to write ("add tri 7 12 13 12
  10 6 fill gray after the ground"). The picture is the same: a shape drawn
  again covers its earlier copy wherever it lies.
- *A railway with sleepers wider than its rails is left as the model drew
  it* (two level lines or more across a road of lines, reaching half a cell
  past it). On 1.24.9 the road rule redrew it going away and covered the
  sleepers drawn before the rails, or left them at their width over its
  point; with the copies left out, a railway written with its rails three
  times now reaches that rule. Every other road is as on 1.24.9. (A rule
  that carried what is drawn on a road with it was tried by two reviews and
  taken out: it left 26, then 18, right roads flat or spoiled, and carried
  half of a car or a gate.)
- *The held note, mended.* In a middle bar of one chord, a note held half
  the bar or more a half step from the chord written: Lantern plays the
  chord of the key that holds it (the dominant before the home chord where
  it can) and says so. The tune's last note, in the last bar, over the key's
  home triad: Lantern ends it on the nearest note of the chord, in the
  octave nearest the note written, in the register the tune was written in
  where it can, with its octave number where the tune wrote one or where the
  reader, placing the whole tune, would put it elsewhere; it says so once,
  and the shown lines play as the tune did (where no way of writing it
  would, it asks). Not in a blues, a mode, a
  song with parts or a form of its own, a song whose chords are another
  key's, a song cut to 96 bars, a style whose blue notes are meant (jazz,
  swing, a shuffle, rock, soul, gospel); not over the dominant, a seventh
  chord, a pedal (the same chord on both sides, however written: the line
  cliche Am | Am | Am7 | Am6 is asked about); not a major chord's seventh or
  a minor chord's ninth (colours), a slash chord's bass; not a last note
  that begins over another chord or has another chord under it (B held over
  G C, over C Am, over C C7); not a suspension or an appoggiatura (a held note that
  steps to a note of the chord before the chord ends -- the same chord under
  another name too, C then C7 -- in the key, not a tritone over the root,
  not gone back to); not where the tune touches the chord's own note in the
  bar; and none at all where one clash in the song must be asked about (a
  tune a step too high). What is asked is as on 1.24.8, with the line to
  write. A note is named as the tune wrote it (D#, not Eb).
- *A shore is judged by what is seen.* Below the horizon, at each point of
  the grid, the last solid shape there whose box has area: land is a shape
  of which two cells or more are seen, no more than its own area; water
  must be seen too. The 4B's first block is now asked about the shore with
  the rest, in its first turn. A tri of one point ("tri 1 1 1 1 1 1", the
  2B's on 1.24.7) covers nothing; the line to write, with the horizon low
  down, is the lower half of the sea, never a strip of no height; a sea
  under half a cell tall is not asked about.
- *A drawing is built once* where no line is written three times.

**Reviews.** Each rule was tried by agents that had not seen it written,
with inputs of their own, kept in `tests/fixtures/` and replayed; each time
what they found was mended, then tried again by another:

- the repeated-line rule and the road: 142 drawings
  (`review1_1250_dups.json`: lines across a copy not seen, a run lost, a
  run-away report lost, two copies of three kept), 211
  (`review2_1250_dups.json`: the sentence false over a curve's swing and a
  stroke's width, the railway's sleepers, every drawing built twice), 242
  (`review3_1250_dups.json`: the first mend of the road left 26 roads 1.24.9
  drew rightly; "thick" and an ink outline not counted; a 300-point curve
  quoted whole and sampled for every pair) and 205 road pictures
  (`review4_1250_road.json`: the rule that carried things with the road
  spoiled or left flat 18 right roads and carried 16 wrongly; taken out);
  the narrow case left is replayed over the 447 pictures of the last two:
  every road as 1.24.9 drew it but the railways with wider sleepers, a wide
  zebra and a gate;
- the music mend: 107 songs (`review1_1249_music.json`, which held it out
  of 1.24.9), 173 (`review2_1250_music.json`: colours, notes out of the key
  read as suspensions, a tune a step too high, an ending played an octave
  above its shown line), 230 (`review3_1250_music.json`: B4 over C mended
  to C4, eleven steps down; C then C7 read as two chords; F over C/F; a song
  cut to 96 bars), 400 (`review4_1250_music.json`, 54 of them the models':
  the line cliche, B over G C at the end, a mended note an octave off as
  the reader places the whole tune, said twice over C C, a rock shuffle's
  blue third);
- the shore: 238 pictures (`review1_1250_shore.json`: every change adds the
  question; a sliver of covered sand at the side edge, a thin strip seen or
  not by where the horizon was), 217 (`review2_1250_shore.json`: the tri of
  one point; a strip between two rows of points; the strip of no height)
  and 249 (`review3_1250_shore.json`: a strip 0.08 tall or a flat tri
  counted as land; a sky written last called all water; the line over all
  the sea).

What the last review of each found was mended and is replayed with its
pictures and songs, but was not tried by another: the narrow road case
(it only leaves a road as drawn), the fourth music review's mends (each
makes Lantern ask where it mended, but for where an octave number is
written), the third shore review's (each asks less where nothing can be
put in front).

Against 1.24.8, the second, third and fourth music reviews' songs: 72, 97
and 185 nearer what each wanted; 1, 1 and none further (a 4-3 over a tonic
pedal, made as written where it would be asked about; a known tune a step
too high, one chord changed, sent back by the songbook all the same).

**What was tested.** `npm test` (76 suites) and the browser tests, 11 of
them, on the build that was pushed (the bench headless and the bench run 9,
Code Lab, the domains, Food, Health, hydraulics, music, the scene, the sheet
reader, the text reader; GMS needs Adam's own file). Not tested: any model on 1.24.10 (the small models'
run starts with the push; the 35B is Adam's).

**Not changed, and written so that a change shows.** The shore at sunset for
the 0.8B (the day's blue sky), the 2B and the 35B (off the grid); a setting
sun the colour of its sky put behind the sea (1.24.9's sun rule); a railway
redrawn as a gray road with gray rails, so the rails do not show; the
question about a shape hidden between two copies names the copy, not what
is caught between them (`QUEUE.md`).

## 1.24.9 — The part of the article that answers (2026-11-08)

Adam answered two questions on 2026-11-08: a repair guide's readers'
comments stay out of what the library gives ("comments out"), and a held
note a half step from its chord is to be mended by Lantern ("mend it").
The library change is here. The mend is not yet: an agent that had not
seen it written tried it on 107 songs of its own, and of its 71 mends 38
were right; about 30 right songs were changed or made worse (a suspension
that resolves inside its bar, a cadence's leading note, a blue note, a
Mixolydian C read through the key signature, each judged alone), and in
five songs what was said or shown was not what played (an ending said as
F and played F#). It waits on `wip-2026-11-08-music` with the review's
songs (`tests/fixtures/review1_1249_music.json`), to be narrowed and tried
again.

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
2,704 questions at both lengths, no answer 1.24.7 found is lost (1.24.8
reads the library as 1.24.7 did) but those
written in the test with why -- 8 questions whose answer is only in a
reader's comment on a repair guide (left out on purpose; one is a warning
that a fan capacitor can hold a charge: Adam's to say whether comments
come back), and 5 at the length Lantern does not pick for the question.
188 are found that 1.24.7 does not find.

**What changed** (LIBRARY_ENGINE).

- A guide's readers' comments are left out (iFixit's comment containers).
  Adam's answer, 2026-11-08: "comments out".
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

- `npm test`: all 71 suites pass. New: `tests/library_sections.js`
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
- No model has run 1.24.9.


## 1.24.8 — What the small models did with 1.24.7 (2026-11-08)

**What was seen.** The small models' run on 1.24.7 (GitHub run
42456738734, 114 scored questions, no library):

| Model | Passed | Time | On 1.24.6 (of 112) |
|---|---|---|---|
| 4B | 106 (93%) | 157 min | 107 (96%), 69 min |
| 2B | 74 (65%) | 92 min | 57 (51%), 48 min |
| 0.8B | 56 (49%) | 38 min | 51 (46%), 40 min |

- *The sums.* The 2B wrote no arrow after a sum: 21 of its failed rows had
  one on 1.24.6, where the short prompt showed "-> volts" after a recipe's
  line. It passed 14 of the 21 sums (6 on 1.24.6). Its failed sums now are
  a number typed under a right sum, and huge numbers after one.
- *The landscape example, copied.* The 0.8B's and the 2B's "road
  disappearing into the distance" were the example's eight lines, word for
  word, and passed. The 4B's shore at sunset was six of them, and the 2B's
  shore was the example in orange with the sea drawn under the green
  ground. The example was a road to the mountains: the subject of a bench
  question.
- *A question nothing could answer.* The 4B's house (a wall of three dark
  green rects, one wholly under the other two) and the 0.8B's sun over the
  sea (the same circle written twice) were questioned to the end: "the ...
  is hidden under shapes drawn after it ... draw the background first".
  Every drawing in the logs and fixtures since 1.24.4 was read again: the
  2B's house had been questioned the same way on 1.24.4 (both tries) and
  1.24.5.
- *The time.* Against 1.24.6, on the 73 questions both runs passed at the
  first try, the 4B took 2.4 times as long per question (the middle half
  2.1 to 2.6), short questions as much as long ones; the 2B 1.8 times; the
  0.8B the same. The same runner image, the same two threads, the 4B with
  the same full prompt.
- *Rows on more than one version* (findings, not yet mended):
  - `water-days`, the 4B: `=5*40`, `=2000/800` went back with "=5*40 (200)
    is worked out but never used afterwards ...; the formula uses 800,
    which is not in the question; if the person did not give it, ask with
    NEED". It answered "NEED: total daily water consumption in litres",
    word for word what it answered on 1.24.5 to the same message;
  - `letters-refrigerator`: the 4B's lines were right (Lantern worked out
    "otaegife", 8) and its sentence typed "efrgefao"; the 2B did the same
    on 1.24.5. The check of a retyped word knows only a word with a few
    slips;
  - the 0.8B's "= 65*35 = 2275", worked out as a test (1), as on 1.24.6.
- *Once each:* the 4B's waltz (chords to bar 9) and orchestra (a part
  called "strings"), which it passed on 1.24.6; Blink without delay() and
  the AccelStepper sketch, which it failed on 1.24.6, passed.

**What it was traced to.**

- *The example.* A landscape question is shown one picture after the
  guide, and an example is the likeliest thing a small model writes. The
  guides for a control circuit, electronics and pneumatics each have a test
  that their example is not the bench's question; the landscape guide, new
  in 1.24.7, had none, and its example was a road into the distance. The
  bench then measured copying, not the guide.
- *The hidden shape.* The question asks for the lines in another order. A
  shape covered only by shapes of its own colour looks the same in any
  order, so nothing the model changes answers it; the small models wrote
  the same block again.
- *The time:* not traced. The log does not say which processor the job
  got.

**What changed.**

- AI_SCENE: the landscape example is "Hills and a tree": the sky; the sun
  straight after it; a gray mountain and a dark green hill, each with its
  base on the horizon; the ground; a tree in front, lower and bigger. No
  road, river, water, sunset or house. The guide's words still say how a
  road or river going away is drawn, and Lantern still asks for one when a
  question about a road going away has nothing on the ground that can be
  it. Lantern changes nothing in the example and questions nothing in it.
- AI_MAKE_LAYOUT: a hidden shape is not asked about
  - when everything drawn over it is of its own look; or
  - when the same line is written again further down, and whatever is
    caught between the two copies, across it, is hidden too (so it is
    asked about itself) or is itself a copy of a line before it (a whole
    block written twice);
  in both cases only when nothing the sampling does not see -- a line, a
  curve, words, a shape drawn as an outline only, a shape too small to
  sample -- is drawn across it in between, unless that too is written
  again further down. A colour is what it is (#fff is white, sky is light
  blue); an outline counts as another colour, except for the same outlined
  line written twice; a width on a shape with no outline does not make two
  copies differ. Anything else hidden is asked about as before. It is read
  in one pass over the picture, from the top down.
- AI_MAKE_LAYOUT reads shapes as AI_DRAW draws them: an oval in the box
  from X, Y to X+W, Y+H (it was read as a centre and two radii, so an oval
  pond wholly under the grass was not seen); a tri whose corners are on
  one point or one line as covering nothing (drawn last, "tri 16 2 16 2
  16 2" made every shape before it "hidden", on 1.24.7 too); words as far
  as their length and size reach. The drawing's plan keeps a shape's width
  and size, where the line gives them, for that.
- The bench workflow prints the processor, the number of processors, the
  memory and the instructions it has (AVX2, AVX-512) in the log and on
  the summary page.
- The run's failed rows and, new, every drawing it made:
  `tests/fixtures/bench_run_1247_08b.json`, `_2b`, `_4b`.

**What was tested.**

- `npm test`: all 69 suites pass. New: `tests/bench_1247.js` (20
  checks): the fixtures; no arrows from the 2B; the failed sums replayed as
  written (none passes: 1.24.8 does not change how a sum is read); the
  example copied, and the prompt's example now sharing only the sky and the
  ground with it; the 4B's house made as written and passing, the 0.8B's
  sun and the 2B's covered sea still asked about; the rule on its own (a
  door before its wall, a bull's-eye drawn inside out, a pepperoni partly
  under the cheese, a clock's face over its hands, an oval pond under the
  grass: asked about; the same door twice, under a door of its own colour,
  #fff then white, a wall written twice with its window on top, a car
  written twice: not); the three reviews' drawings; 60 large outlined
  rects read in well under a second; and, written as they are so that a
  change shows, the tank of water and the backwards letters. `tests/scene.js`: the example is not a bench
  question (no tri from the bottom edge, no blue, orange, red, pink or
  purple, no road, river, shore, sea, sunset or house), and Lantern
  changes nothing in it.
- Three reviews by agents that had not seen the rule written, each with
  drawings of its own, judged by what a person would see:
  1. 120 drawings. The first draft spared a shape whose every covered point
     showed its own colour on top. It lost 14 useful questions in 13
     drawings: a shape of another colour in between (a bull's-eye, an eye's
     highlight, a picture frame, drawn from the inside out), lines or words
     between two copies (a clock's hands, a chalkboard's words, a stop
     sign's word). It still asked 21 that no order could answer (an
     outlined line written twice, #fff then white, a wall written twice
     with its window on top). And it found the oval read wrong. Mended as
     above: of its drawings' useful questions none is lost (1.24.7 missed
     two, the ovals), and 89 shapes are found hidden where 1.24.7 found
     125. Still asked and of no use, 15: mostly a copy with something
     caught between it and its copy (what is caught is asked about too, and
     once it is moved the copy is not), and three backgrounds wholly
     covered by bands or squares, as on 1.24.7. Its drawings are
     `tests/fixtures/review1_1248_hidden.json`, replayed by
     `tests/bench_1247.js`.
  2. 128 drawings, on the rule as mended after the first. 9 useful
     questions lost: a window drawn as an outline only, a star too small
     for the sampling, a long caption or a large word, each caught between
     two copies; 23 still asked that no order could answer (a car, a house,
     a landscape written twice whole; a tri with no area drawn last). Two
     differences outside the question, both from the oval now read as the
     box it is drawn in, in the check of what is above what: an egg below
     a hen no longer questioned (right); a cloud level with a hilltop,
     newly questioned (a borderline case). Mended as above: of its
     drawings' useful questions none is lost, 141 shapes are found hidden
     where 1.24.7 found 189, and 22 it judged of no use are still asked
     (64 on 1.24.7): mostly a piece of one area under another piece with
     something of another colour on top (a wall in two pieces with its
     window, a canopy of two greens with apples), which Lantern cannot
     tell from a pepperoni under the sauce and the cheese. Its drawings
     are `tests/fixtures/review2_1248_hidden.json`.
  3. 138 drawings, and 1,600 random blocks of up to 60 lines, on the rule
     as mended after the second. No useful question that 1.24.7 asked is
     lost, and two are new (an oval bush, an ellipse lake, under the
     ground); 122 shapes are found hidden where 1.24.7 found 251, and 22 of
     them it judged of no use (148 on 1.24.7): a line or words that are
     part of a block written twice, caught between the copies; a background
     between two copies; something across a shape judged by its box, not
     its shape. It found the rule slow: 60 large outlined rects took 4.5 s
     (6 ms on 1.24.7), every sampled point comparing every pair over it.
     Mended: one pass from the top down (8 ms); a tri with no area caught
     between copies does not count; words are as high as it measured them
     (0.56 of a cell at size 20); a width on a shape with no outline does
     not make two copies differ. It suggested letting a line caught between
     two copies pass when it copies a line before the first: tried and
     taken out, since a clock's hands drawn before its face and again
     between two copies of the face are lost all the same. Its drawings are
     `tests/fixtures/review3_1248_hidden.json`. These last mends were
     replayed, before and after, on the three reviews' drawings and its
     1,600 blocks: no difference but 11 fewer shapes asked about in the
     blocks, each with words or a flat tri between two copies. No fourth
     agent tried them.
- Every drawing in the logs and fixtures since 1.24.4, 57 different
  replies, built again: 17 had a hidden-shape question on 1.24.7, 11 on
  1.24.8. The six that lost it: the 4B's house (both tries), the 2B's
  house on 1.24.4 (both tries), on 1.24.5, and on 1.24.6 (second try), each
  a shape under its own colour or a copy of one. Two more, the 2B's first
  houses on 1.24.6 and 1.24.7, lost one question each: a sky written over
  a sky. The 0.8B's sun is still asked about: between its two copies it
  drew a dark green rect across the first, and which it meant to show
  Lantern cannot tell.

**What was not.**

- No model has run 1.24.8. The example is expected to cost the 0.8B and
  the 2B their road into the distance, which they passed by copying.
- The time: the next run's log names the processor.
- Left failing, for the next version (`agent/QUEUE.md`, 1): the tank of
  water's send-back, the retyped letters, "= 65*35 = 2275".
- Neither 1.24.7 nor 1.24.8 asks about words, a line, a shape drawn as an
  outline only or one too small to sample, hidden under a later shape: the
  check reads only the filled shapes it can sample (`agent/QUEUE.md`).

## 1.24.7 — A landscape the way the eye sees it, the sum as the model wrote it, and the reviews that tried both (2026-11-06)

Three pieces of work. Adam drew with the 35B on 1.24.6 and sent what came
back; the small models' run on 1.24.6 was read row by row; and what was
written for both was given, before anything was pushed, to reviewers who
had not seen it written and were asked to break it. They did, eight times,
and this version is what was left standing.

**What was seen.**

- *Adam, in Chat, with the 35B:* "an ocean shore with mountains in the
  distance at sunset" came back with two gray mountains whose bases were
  flat lines in the sky (three and two cells above the sea) and the sun
  drawn last, in front of one of them; there was no shore. "A road
  disappearing into the distance over a far horizon" came back as three
  upright black lines down the green ground, the same two mountains in the
  air, and the sun in front again. The model was shown each picture and
  said LOOKS RIGHT. Every picture also had a white strip down its right
  side and along its bottom.
- *The small models on 1.24.6* (GitHub run 42201761437, 112 scored
  questions, no library):

| Model | Passed | Time | On 1.24.5 |
|---|---|---|---|
| 4B | 107 (96%) | 69 min | 102 (91%), 106 min |
| 2B | 57 (51%) | 48 min | 63 (56%), 102 min |
| 0.8B | 51 (46%) | 40 min | 28 (25%), 64 min |

  The 2B fell from 12 to 6 of the 21 function questions while the 0.8B rose
  from 6 to 16. The failed rows are `tests/fixtures/bench_run_1246_2b.json`
  (55), `_08b.json` (61) and `_4b.json` (5).
- *The first review.* The first draft had three new things: rules that
  rearrange a landscape, readers that tidy a model's reply, and recipes
  handed to a small model with the question's numbers already in them. All
  its own tests passed. A separate agent tried each on inputs of its own:
  - it drew 91 pictures that were right as written, and the scene rules
    changed or questioned 46 of them. The lamp of a lighthouse, lamps on
    their posts, balloons, sunflowers and a girl's head were taken for the
    sun and put behind things; an umbrella, a dhow's sail, kites on their
    strings and the tiers of a pine were taken for mountains in the air;
    the piers of a bridge, the posts of a gate, a horse's legs and a tree's
    trunk were redrawn as a road going away; a sunset's second band of sky
    and a long castle wall were read as the ground;
  - it asked 199 sums another way. The recipe was filled for 160 of them,
    and 86 of the filled lines were wrong: the answer wanted in another
    unit ("how many teaspoons of bleach" given the recipe for drops),
    another thing asked of the same numbers (the current a lamp draws, the
    momentum of a car), a step more (there and back, a week of days), a
    number in words, a radius read as a height;
  - it wrote replies the readers spoiled: a number set down on purpose
    dropped as a typed result, `=17*23=391` cut where the question asks
    whether they are equal, an arrow inside a quoted string, a line inside
    a MAKE block.
- *The second review*, after all of that was mended, by another agent:
  - 126 more right pictures, and 41 were changed or questioned again: a sky
    in two blues, a far beach or a field of wheat drawn as a band, a hang
    glider and an eagle over mountains, a beach ball on a "sunny" day, a
    lion's mane "at sunset", a mosque's golden dome "at dusk", a flag, a
    map, a road drawn in steps or coming in from the side;
  - 757 more sums asked another way: 406 filled, 222 wrongly. For bleach
    alone: water "from the dam", "milky water", "icy water", bleach "for
    handwashing", "to soak instruments", "in my aquarium", "scented bleach"
    each got the drinking-water recipe for drops;
  - 95 more replies, 34 read into something else: "Check whether 17 times
    23 makes 391", "Tell me if ...", "Verify that ..."; 12 jerrycans typed
    under `=250/20`; and, in readers that have been in Lantern since
    1.24.5, an answer key's "ANS: B" three times running inside a MAKE DOC
    read as once, a quiz's "ANS: 12*12" turned into a sum, "MAX(A1,B1)" as
    the answer to "which function ...?" run as a sum and failed.
- *The third review*, of what was about to be pushed, by a third agent:
  - 287 more right pictures, and 26 were changed or questioned: the sun
    put behind its own glow (a gold oval round it at sunset); a gorse bush
    on a hill, an autumn tree on a short trunk, a haystack on the horizon
    at dusk taken for the sun; "a light" (a ceiling lamp, a traffic light)
    taken for a plain landscape; a cliff or a dune rising from the bottom
    edge not counted as a shore; "a path over the hills far away" read as
    a road going away; a coast seen from above; a sea or grass written
    again on purpose (over the setting sun's lower half, a swimmer, a duck,
    the feet of fence posts) left out;
  - 45 wrong pictures, and 15 were mended into another wrong one: the sun
    drawn first, behind a mountain in the air, came in front of it once
    the mountain was stood on the horizon (the mountain went to the back of
    the sky, behind the sun); a near range went behind the far one; the
    dark disc that makes a crescent, the sun's face, a mountain's other
    half and its snow cap were left where they were; strokes of light on
    the sea were taken for the sun's rays; a road was narrowed under its
    sleepers, its dashes, a car, a boat;
  - 154 replies: 59 read otherwise than written, 38 of them right ones
    that 1.24.6 read correctly: a test the question itself writes ("What
    do you get from the test 2^10 = 1024?") cut at its second = and given
    1024; lines inside "MAKE doc:" (a kind in small letters) read as sums;
  - 88 questions about bleach: 18 given the drinking-water dose that were
    not that question ("drops of liquid chlorine", "drops of water in 1
    litre of bleach", "bleach water", "will clear 10 litres", "can I
    drink"); and, as on 1.24.6, 9 right sums for the other one-blank
    recipes told to be the recipe's ("twice round", "a half-wave", "in
    km/s", "in miles", "7000 km from the centre").
- *The fourth review*, of the third's mends, by a fourth agent:
  - of 84 right pictures, 3 changed, all one way: a star the moon was
    drawn over was put in front of the moon. Of 24 wrong ones, a road was
    redrawn over the river the model drew across it, one of two dunes in
    the air was stood on the sand and the other left floating, a moon at
    night was not known for the moon; a yellow moon was called the sun;
  - of 58 replies, 30 that 1.24.6 read right were read wrong. 14 were a
    model's last step done in its head: "=350/100", then "=28", "ANSWER: 28
    litres" for 8 litres per 100 km, read as 3.5; "=4+8+12", "=8" for an
    average, read as 24. 8 were sums asked with a formula word ("Using the
    CONVERT function, how many km ...?") left unworked. "Make the sum:"
    opened a block. A Chat answer saying what to type ("=PI()*A1^2 -> the
    area, with the radius in A1") lost its words;
  - of 42 recipe questions, 26 were given a recipe's line for another
    question: drops of bleach "per litre" given the line for the whole
    drum (40 for each litre), a half-wave dipole the whole wavelength, the
    time of a radio signal to a satellite the satellite's orbit.
- *The fifth review*, of the fourth's mends, by a fifth agent, with
  everyday sums (money, cooking, farming, building, fluids, units,
  percentages): of 113 replies, 30 more right ones whose last step was
  done in the head and that the mended rule still did not reach ("$80
  coat, 25% off": "=80*25/100", then "=60"; change from a note; what is
  left in a tank; an average whose count is one of its values;
  Fahrenheit's +32), and 10 wrong typed numbers it kept; a test against 0
  ("=MOD(391,17)=0") cut as a sum; "-> divide by 60 = 2.22" taken for a
  label; "MAKE SURE THE UNITS MATCH" read as a block; "What do I enter on
  the oven for 180 C in Fahrenheit?" given the formula and no number; the
  climb to orbit given the orbit's recipe; a white disc at night taken for
  the moon where it was a snow cap, a cloud on a peak, a snowy crown.
- *The sixth review*, of the fifth's mends, by a sixth agent: of 78
  replies, 16 right ones whose last step was a number of ten digits or
  more done in the head ("=1024^3", then "=10737418240" for 10 GiB; and
  "=2000/15", then "=2.222222222" for hours, ten digits with the
  decimals), and the right one cut where it was not the sum's value; seven
  where a Chat conversation had an older "QUESTION:" line further up and
  Lantern took it for the newest question; four asked yes or no after a
  colon or with the numbers in words ("Find out: is twelve squared one
  hundred and forty-four?"); 19 where what followed an arrow or a second =
  was a step still to do ("-> bags, rounded up", "-> percent", "->
  squared", "-> tip only") or a unit the ANSWER did not use ("-> minutes"
  over an ANSWER in hours, "= 2275 pence" over one in pounds) and Lantern
  handed the person the number before the step; five where an ANSWER line
  after a MAKE TABLE with no END, which Lantern makes as the answer, was
  read as a line of the table. Of 43 recipe questions, 28 not the card's
  own were given its line: the weight on a car's front axle, a diver
  underwater, a mass in orbit; ultrasound, sonar, a wavelength in km;
  how long one orbit is in km; and drops of bleach "to clean a 20 litre
  drinking water tank" given the dose for water to drink. Of 19 pictures,
  5 right ones changed: a snow cap, a pale rock, a cloud on a peak taken
  for the moon where the moon was drawn small, as an oval, or rising
  behind the land.
- *The seventh review*, of the sixth's mends, by a seventh agent, which
  also ran six of its replies through the whole of Chat and Assist with a
  scripted model: of 162 replies, 38 broken. A chain with an arrow on
  each line, where one arrow was read and the other not, and the next
  line's ANS was 0 ("=2*60 -> minutes", "=30*ANS -> litres": "0 litres",
  where 1.24.6 sent it back); a count rounded after the arrow or the
  second = ("=7/2 -> 4": "3.5 cars"); a chain ending in a per cent
  ("=12/80 = 0.15 = 15%": "0.15%"); an arrow's unit that is not the
  CONVERT's own; an arrow that meant "change it into" ("=3 -> minutes":
  "3 minutes" for a film of 3 hours); "pounds" taken for a price; yes or
  no asked after a full stop ("Work out 25 x 4. Is that a hundred?") or
  with "or not"; Lantern's own message taken for the question. Of 50
  recipe questions, 5 right sums in another unit (hours, km/s) told to
  write the recipe's line, for a question that named no unit. Of 28
  pictures, 4 where the question asked for the sun in front of the
  clouds, the mountains or a tree, and Lantern put it behind them.
- *The eighth review*, of the seventh's mends, by an eighth agent, ten of
  its replies run through Chat and Assist: of 199 replies, 21 broken. A
  recipe's own line with its own label read where the ANSWER used another
  unit ("=KE(1000,20) -> joules" under an ANSWER in kJ: "200000 kJ";
  "=VOLTS(0.02,470) -> volts" under mV: "9.4 mV"), or for a question it
  did not fit (Earth's weight for the Moon); a value after the arrow in a
  unit the question did not ask ("=20/60 -> 0.33 hours" for minutes); a
  tag question ("What is 65 times 35 -- 2,275, isn't it?"); "MAKE A
  NOTE:" and "SOLVE:" swallowing the ANS lines 1.24.6 read; lowercase
  "ans" after a failed line. Of 18 pictures, 5 where the question put the
  clouds behind the sun in other words.

**What they were traced to.**

- *A model writes numbers; it does not see where the ground is.* Nothing
  in Lantern knew either: a drawing was a list of shapes, checked for a
  roof, a sun and a sunset sky, and never for what stands on what.
- *The white strip:* a drawing's canvas was made 20 px larger than its
  last shape, which is right for a schematic and wrong for a picture
  whose sky reaches the edge.
- *The 2B copied what a recipe's line gives onto the line.* The short
  prompt of 1.24.6 showed a recipe as `=VOLTS({amps},{ohms})   -> volts`,
  and the 2B wrote `=VOLTS(0.02,470) -> volts`, with the right numbers, in
  24 replies. Lantern could not run the line.
- *A number typed after the sum.* `=CONVERT(26,"mile","km")` and then
  `=88.5625` on a line of its own: Lantern took the last line.
- *A result after a second =* (the 0.8B): `= 65*35 = 2275`.
- *Numbers put into the recipe's braces:* `=({2000}/{15})/60`.
- *The 4B* wrote every formula of the power wheel on a line of its own, with
  no part line; and its sketch for "without delay()", timed with millis(),
  was questioned for the word delay() in its opening comment (a check
  added in 1.24.6 that looked inside block comments).
- *What the two reviews found comes to one thing.* Each rule asked "could
  this be a mountain, the sun, a road, the recipe's sum?" and acted when
  the answer was yes. A rule that changes what a model wrote, or hands it
  a line to copy, has to ask "can it be anything else?" and act only when
  the answer is no.
- *And a list of things to refuse is never finished.* After the first
  review each rule was given its exceptions (a tri on a pole is not a
  mountain; a recipe is not filled when the question says "each way").
  The second reviewer simply used other words. What can be finished is a
  list of what Lantern does know: so the scene rules now act only on a
  question made of the words of a plain landscape, and the bleach recipe
  is held to only for a question made of its own words.
- *The first draft's tests had passed* because they were written by the
  same hand as the rules, from the same cases.
- *What the third review found* was in what Lantern did once it was sure:
  where it put a thing it moved (to the back of the sky, behind what the
  model had drawn behind it on purpose), and what it moved with it.
- *What the fourth to the eighth found* was readers that were sure where they
  could not be. A number typed under a sum may be a slip (the 2B's 88.5625
  under `=CONVERT(26,"mile","km")`) or the model's next step, and the
  fourth review's mend -- a slip is a number no step reaches -- was
  another list of steps, and the fifth found 30 more. So those readers
  were taken back to what can be known from the line itself: the line as
  written cannot run, or gives 1 for a sum, and what it meant is plain.
  And a recipe card that fits a question is not its recipe: only a card
  that says which questions are its own can be held to. The sixth found
  that the last of these lists of exceptions -- a long number is a copy,
  any word after an arrow is a label, a white disc in a question about the
  moon is the moon, a weight refuses "half" and "in water" -- were lists of
  exceptions still, and each was taken back to what Lantern can see. The
  seventh found the same of the units: a unit after an arrow can be the
  thing to change into, and "pounds" a weight or a price. What Lantern can
  see for certain is its own line: a recipe's line with its own label
  after it, or a number after a sum that is the sum's value as written.
  The eighth found that not certain either: the label is what the line
  gives, and the ANSWER may want it in another unit. A model's arrow says
  what it meant, and only it knows; the line goes back to it.

**What changed.** One new module (412 in all). The filled recipes are not
in this version (see "What is not in it").

*Pictures*

- **AI_SCENE** (new). Lantern arranges a picture only when it can do so
  without guessing:
  - *the question is a plain landscape, in words Lantern knows.* Every
    word of it has to be on a list of some 300: the words of asking and
    placing, colours, and sky, sun, moon, cloud, mountain, hill, valley,
    sea, lake, river, shore, beach, desert, plain, field, tree, road,
    path, track, railway and their like. One word that is not on it (a
    tent, a lion, a flag, a map, a mosque, a light) and the picture is the
    model's: nothing is moved. Nor a picture seen from above (a map);
  - *the block has one sky and a ground Lantern can read.* The sky is the
    one band at the top edge, not of grass or sand. The ground is the band that reaches the
    bottom edge, with at most one band lying on it (the sea behind a strip
    of sand), in a colour of land or water that is not the sky's own and
    not a sunset's. A sky in two bands, a sunset in bands, a yellow band
    behind a lake (a far beach, or the glow?): no horizon Lantern is sure
    of, and nothing is moved.
  Then it does what can be computed, and says so under the picture and to
  the model when it is shown the picture:
  - a mountain or hill (a tri on a flat base, in a mountain's colours)
    whose base is in the sky is stood on the horizon: its sides carried
    down and its peak left where the model put it, or the whole of it set
    down when that would make a needle or when something is drawn on it:
    what lies on it goes down with it (a snow cap, even one that pokes out
    a little, its other half, a hut). It goes just before the first band of
    ground, when the model drew it after it: behind what stands on the
    ground, and still in front of a far range or a sun the model drew
    before it. From 4 cells wide where the question names mountains or
    hills; from 8 where it does not (the model put them in). Not when
    something holds it up: a wall under a roof (a wall with no fill too), a
    trunk under or through a crown, a pole, a mast, a hull, a string, the
    tier below in a pine. Not when something on it pokes out (a tree on its
    slope): set down, it would leave the tree in the air. A narrower one
    beside it, on the same base and of its colour, goes down with it; if
    another would be left in the air, none is moved. Lantern calls them
    what the question does, or by their colour: hills when green, dunes when
    sand-coloured;
  - the sun drawn over land, water or cloud, and seen in front
    of it, goes just behind the first thing it was drawn over: a glow of
    its own colours drawn before that stays behind it. A setting sun drawn
    over the sea shows as half a sun; strokes of light on the water under
    it stay on the water. A circle is the sun only when it is the ONE
    circle of the sun's colours in the sky that is not the top of something
    (a lamp on its post, a balloon over its basket, a flower on its stem, a
    crown on a trunk however short) and not inside something; sitting on
    the horizon only over the sea, or red or orange at sunset (on a field
    at dusk, a gold one is a haystack as likely); and, where the question
    does not name the sun, not on a slope below the top of the land it is
    drawn over (a bush, an autumn tree). What is drawn on it goes with it:
    a disc inside it, its face, the dark disc that makes a crescent, its
    rays, lines that point away from it or small triangles. It goes behind
    land, water and clouds, not behind a star or a bird (in the sky, only a
    disc as big as the sun could be, or an oval or a bar 1.5 cells wide, is
    nearer than the sun). The moon is left where the model drew it: a white
    disc at night may be a snow cap, a cloud on a peak, a pale rock, a
    snowy crown, and in a question about the moon a yellow disc may be a
    lamp; nothing in such a picture is moved as the sun. Nor where the
    question puts the sun in front ("the sun in front of the clouds",
    "clouds behind the sun", "the sun in the foreground", "clouds at the
    back"; "the sun setting behind a hill" asks for what Lantern does);
  - a road, path, track or river that the question says goes away ("a
    road disappearing into the distance", "a track to the horizon": said
    of the road itself, not of mountains "in the distance"), written as
    two to four upright lines side by side or as one strip from the
    horizon to the bottom edge, with nothing in the picture that narrows
    already, is drawn as it looks going away: a filled tri three times as
    wide at the bottom edge with its point on the horizon, the model's
    lines carried along its edges and its middle, and any line across it
    (a sleeper) as long as the road is wide at that distance. Not a road
    with a shape on it (a car, a boat, sleepers or dashes drawn as rects):
    it would narrow under them; nor one a river or a hedge crosses.
  What it cannot make goes back once with the line to add, worked out for
  the picture's own horizon: a road asked for "into the distance" where
  nothing at all is drawn on the ground; a shore where everything below
  the horizon is water.
  In any picture, whatever the question: the sky written a second time
  further down (the 2B's house on 1.24.6: the sky again after the roof,
  twice) is left out, and so is a band written again that covers nothing
  drawn in between (the 2B's grass on 1.24.4). A sea or grass written
  again over something is the model's.
- **The guide for a landscape.** A question about mountains, hills, a
  shore, a road, a river, a horizon (and no house) gets three more lines
  of guide and a landscape as its example: the sun straight after the
  sky, two mountains on the horizon, the ground, a road that narrows, a
  tree. A house keeps the hut and its roof.
- **A drawing is its own frame.** The picture is exactly its 20 by 12
  cells: no white strip.
- **The look turn says what Lantern changed** ("Before drawing it, Lantern
  stood the 2 gray mountains on the horizon ..."): the model is looking at
  Lantern's drawing, not at its own lines.
- **Two questions in the bench** (30 things to make, 114 scored):
  `make-shore-sunset` and `make-road-horizon`, graded on what any right
  picture has: a mountain stands on the horizon, none floats, the sun is
  not drawn over the land, there is land in front of the water, a road
  narrows towards the horizon.
- `tools/bench_headless.py` prints every drawing a model made, passed or
  not, between `=== DRAWINGS` and `=== END DRAWINGS ===`, and
  `tools/draw_log.py` (new) draws each of them as written and as Lantern
  draws it, side by side: a score cannot show how a picture looks.

*Sums*

- **An arrow after a sum, or a number after a second =, goes back to the
  model** (AI_READ, ASSIST_CORE), as on 1.24.6, with what is wrong said
  plainly: "a formula line holds only the sum: what follows the arrow
  cannot be worked out. Put a step (rounding, a change of unit) in the
  sum itself, and the unit in the ANSWER" (with the recipe's line where
  there is one, as before). For a while this version read
  `=VOLTS(0.02,470) -> volts` as the sum and `= 65*35 = 2275` as `=
  65*35`, and replayed with the small models' replies as they wrote them,
  up to 15 of the 2B's failed sums and 2 of the 0.8B's passed. Eight
  reviews broke every version of those readers (above): the model meant
  a step, a unit to change into, a unit the ANSWER did not use, a test,
  and Lantern cannot see which. Each time 1.24.6 had sent the reply back,
  and the reader handed the person a wrong number. They are taken out;
  what this version changes for the 2B's arrows is where they came from,
  the short prompt (below).
- **What the readers still do**, only where the line as written cannot be
  right and what it meant is plain, never inside a block (MAKE, TRACK,
  TURN or SOLVE, with a colon and a kind Lantern makes) or a code fence:
  - a number in `{ }` is the number; a sum in `{ }` is in brackets;
  - a number typed on its own `=` line under a sum stands as the model's,
    whatever its length -- its last step done in its head ("=80*25/100",
    "=60" for a coat at 25% off; "=1024^3", "=10737418240" for 10 GiB) or
    a slip ("=3.3333333333333335" under `=100*12/60`), Lantern cannot
    tell;
  - a formula after "ANSWER:" ("ANSWER: CONVERT(26,"mile","km")") is worked
    out where Lantern can (not `MAX(A1,B1)`, with cells); where the
    question names the formula as the thing asked ("Which Calc command",
    "What do I type"), the answer says both: "SQRT(2), which gives
    1.4142". A question that names a formula and wants the number ("What
    do I enter on the oven for 180 C in Fahrenheit?") gets the number in
    it too;
  - an ANSWER line after a line of a MAKE block that is not a program
    ends the block, as it does where the block is made ("MAKE TABLE:
    Distance", "5 | ?", "ANSWER: CONVERT(5,"km","mile")" is a table and
    its answer); the formula's line goes under the ANSWER, so the table is
    as written. A program's block ends only at a bare END ("END IF" is a
    line of BASIC); a puzzle tool's block (TRACK, TURN, SOLVE) ends at an
    ANS or ANSWER line, which it never holds ("SOLVE: the cost", "ANS:
    65*35").
  Chat says what was read.
- **A line that uses ANS where no line before it could be worked out
  cannot be worked out either** (ASSIST_CORE). ANS was 0 there:
  "=2*60 -> minutes", "=30*ANS" gave 0 litres. Now the reply goes back as
  one that could not be run. After a line that was worked out, ANS is
  that line's, as before ("=2*60", "=ANS minutes", "=ANS*30" is 3600).
- **The older readers keep to the reply's own lines too** (they are from
  1.24.5): one line written three times is read as once only outside a
  block and only where the lines are not named later ("=10" three times
  and "=ANS1+ANS2+ANS3" are three resistors); "ANS: 12*12" inside a MAKE
  DOC is the document's. A line of prose that
  begins "Make sure ...", "Make the sum:", "MAKE SURE THE UNITS MATCH"
  opens no block.
- **What a recipe gives is on a line of its own, above its line** in the
  short prompt, so nothing follows the line for a model to copy.
- **A recipe is held to only for its own question**
  (`fillOnly`, a new field of a card). Since 1.24.6 a sum that gives
  another number than a one-blank recipe is sent back with the recipe's
  line. For drops of bleach in water to drink that is right when the
  question is that and nothing else (20 drops a litre is ten times the
  dose) and wrong for handwashing water, an aquarium or water from a dam.
  The card now says which questions are its own: every word one of its own
  (drops, bleach, so many litres, a jerrycan, clear water, safe, drink
  ...), "drops of bleach" said, bleach said once and not "bleach water",
  "clean" and "clear" said only of the water ("to clean a tank" asks for
  the stronger mix that cleans a container), the water to drink and not
  the bleach ("can I drink"), drinking said, and not "per litre" or "each
  litre". For any
  other, Lantern says nothing about the recipe.
  The same for the other one-blank recipes: the check speaks only for a
  card that says which questions are its own, and four now do, each for
  its plain question: a satellite's minutes for one orbit, in its own
  words (not twice round, half way, a signal's time, the orbits in a day,
  in hours, the climb to orbit, how long it stays in orbit, how long one
  orbit is in km); an escape velocity in m/s, in its own words (not km/s,
  km/h, mph); the weight in newtons of a sack, a box, a person, a car, in
  its own words (not an axle's share, in water, in orbit); a radio
  wave's whole wavelength in metres, in its own words (not ultrasound,
  sonar, a harmonic, in km). And each only where the question asks in the
  recipe's unit (minutes, m/s, metres): asked with no unit, a right sum in
  hours or km/s is not told to write the recipe's line. Not where the
  drops of bleach are what is drunk ("How many drops of bleach are safe
  to drink, in 1 litre?").
  The others (a geostationary orbit, the Schwarzschild radius, a fast
  clock, sugar and salt for ORS) say nothing: on 1.24.6 the orbit card
  told the 2B, which had the hours right for a geostationary orbit, to
  write minutes.
- **A wheel of bare formulas** ("P = V^2 / R", one to a line): each goes
  into the part for the letter it gives.
- **delay() in a comment** is not a call.
- A number that closes a chemical formula, Ca(OH)2, is not one of the
  question's numbers; the molar mass card is not offered for "how many
  moles".

**What is not in it.**

- **The recipe with the question's numbers in it.** Written for this
  version, mended after the first review, and taken out after the second
  (222 wrong lines of 406). It is on `wip-2026-11-06-recipe-fill` with
  both reviews' questions (`tests/fixtures/fill_review_1247.json`, 199,
  and `fill_review2_1247.json`, 757) and a note of what the next attempt
  has to do: fill only a question whose every word Lantern knows. A small
  model is given a recipe with its blanks, as on 1.24.6.

**What was tested.**

- `npm test`: all 68 suites pass. New: `tests/scene.js` (49 checks: Adam's
  two blocks as the 35B wrote them; each rule on its own; the reviews'
  pictures, every one, from `tests/fixtures/scene_review_1247.json` and
  `scene_review2_1247.json`: 216 right ones that come through exactly as
  written, and what Lantern does with the 57 wrong ones; the plain-word
  gate; rule 11) and `tests/bench_1246_small.js` (20: the 2B's and the
  0.8B's failed sums replayed as they wrote them; an arrow or a second =
  left as written and sent back with what is wrong said; the reviews'
  replies that must stay as written; the bleach dose held to its own
  question only; the 4B's wheel and sketch).
- The 35B's 45 right sums of 1.24.4: nothing in them is read differently,
  and no check questions one. (The guard caught `=2000/ANS` being taken
  for a typed number while this was written.)
- Eight independent reviews, each by an agent that had not seen the code
  written, on inputs of its own. The first two are in `scene.js` and
  `bench_1246_small.js`; the third to the eighth are replayed by
  `tests/review3_1247.js` (pictures, replies, recipe questions:
  `scene_review3_1247.json`, `read_review3_1247.json`), `review4_1247.js`
  to `review8_1247.js` (`review4_1247.json` to `review8_1247.json`), with
  what 1.24.6 gave beside each reply. On this build, of all eight
  reviews' inputs: no right reply that 1.24.6 read right is read wrong
  (but an ANSWER that is a MAKE DOC's first line, which is the
  document's, as AI_ACTIONS makes it); where 1.24.6 worked out no number,
  none that is wrong is handed over; no recipe line is given where it
  should not be; no right picture is changed (but three that can be read
  either way: "the sun shining over the clouds", "the sun above the
  clouds", "the clouds under the sun").
- Real Chromium, a stand-in model that sees
  (`tests/browser/scene_e2e.py`, new): the two scenes in Chat, the PNG the
  model is shown checked by its colours: the road gray and narrowing, the
  mountains on the horizon, the mountain in front of the sun, sand along
  the bottom; exactly 720 by 432.
- Ten more real-browser tests pass on this build with a stand-in model
  (bench run 9, the headless bench, Code Lab, the drawing domains,
  hydraulics, music, health, food, Text Reader, sheet reading).
  `gms_e2e.py` was not run: it needs the Generative Music Studio file.
- Looked at: Adam's two pictures before and after, and the reviews'
  pictures that Lantern changes, side by side.

**What was not.**

- **No model has run 1.24.7.** The push starts the small models' run. The
  35B has not run it: the laptop was not linked. The guide for a landscape
  and its example are new to every model.
- Whether the mended pictures look right is Adam's to judge.
- Lantern arranges a picture only for a plain landscape asked in plain
  words. A tent by the lake, a lion at sunset, a house on the hill: their
  pictures are as the model drew them, mountains in the air and all.
- Left failing as on 1.24.6, by the reviews: the 2B's 27 failed sums and
  the 0.8B's 18, replayed with their replies as they wrote them (the same
  reply twice), all fail as they did: 18 of the 2B's were right sums
  written with an arrow after them, a number typed under them, or a
  number after a second =, and Lantern cannot tell what the model meant
  by those. The short prompt no longer shows anything after a recipe's
  line, and a line with an arrow goes back with what is wrong said; the
  small models' run on 1.24.7 will say whether they still write it.
- Wrong on both versions, and left: a number after a second = under a
  question that asks for a number is worked out as a test ("= 65*35 =
  2275" gives 1, "1 cents"), and no check questions an answer of 1 or 0
  for such a question.
- The moon in front of a mountain, a cloud or the sea is left as the model
  drew it.
- Left as found, and in the tests as such: the 2B's own wrong sums
  (`=150*10/420`), units written inside a sum (`=3 cups * 15 people / 6
  people`), the hydraulic and pneumatic guides copied whole by the 2B and
  the 0.8B with their explanations, and "from a 300 km orbit to the Moon's
  distance" given the recipe for two radii.

**Seen after this was written, and left for 1.24.8.** Adam ran the 35B on
1.24.6 with the encyclopedia, in his own browser on the laptop (2026-11-08,
95 minutes): 134 of 138 scored, the first full run with the 24 library
questions (21 passed). The failed rows are
`tests/fixtures/bench_run_1246_35b_library.json`. Each of the three
"Not in my library" answers had the right article and the wrong part of
it: the opening of "Oral rehydration therapy", not what it is made of;
the first step of the iFixit guide and its readers' comments, not the
steps (the offline file keeps a step's comments inside the step's list
item, and Lantern read the whole item as one paragraph); sentences of
Wikivoyage's Nairobi about the railway and internet cafes, not its "Get
around". And the waltz again: a note a half step from its chord,
questioned with the chord to write, not mended on the second try (as on
1.24.0, and on 1.24.6 without the library). Whether Lantern should play
the chord it names itself is Adam's (`agent/QUESTIONS.md`).

## 1.24.6 — What a small model is given, and the line to write (2026-11-06)

One piece of work: the small models' runs of 1.24.5 were read row by row,
and each kind of miss was traced to what Lantern had put in front of the
model, or to what Lantern sent back.

**What was seen.** On 1.24.5, 112 scored questions, no library:

| Model | Passed | Time | Notes |
|---|---|---|---|
| 35B, on the laptop | 111 (99%) | 79 min | 7 sent back once, 6 mended. The miss: Lantern's own hint ("write arrange orchestra") for a tune that asked for no orchestra |
| 4B, GitHub | 102 (91%) | 106 min | 15 passed only on the second try |
| 2B, GitHub | 63 (56%) | 102 min | was 50 of 109 (46%) on 1.24.4, in 36 min |
| 0.8B, GitHub | 28 (25%) | 64 min | was 16 of 109 (15%) |

The failed rows as the models wrote them are
`tests/fixtures/bench_run_1245_2b.json` (49), `_4b.json` (10), `_08b.json`
(84) and `_35b.json` (1), with the 4B's seven of 1.24.4
(`bench_run_1244_4b.json`) and the 35B's 45 right sums of 1.24.4
(`bench_run_1244_35b_sums.json`: no new check may question one of them).

**What they were traced to.**

- *The short prompt made the 2B's run three times as long.* It differs for
  every question, so the model server reads it afresh each time (about
  1,000 tokens at 76 a second on GitHub's computer) where the full prompt
  had been read once and kept.
- *"ANSWER: Not in my library."* for eleven sums (the 2B): a temperature in
  Celsius, 5 kg in pounds, a bed of plants, a compass bearing. The
  instructions showed a decline and its example; Lantern sent nothing back.
- *A recipe card that did not fit.* A card fitted when the question had any
  of its keywords, part of a word included: a bed of plants "10 m long" got
  the orbit card, "12 hens" the feed sum, a baby breathing "too fast" the
  fast-moving clock. Nine sums Lantern has functions for had no card.
- *Functions picked by any shared word*: "each lays 5 eggs" brought CAESAR
  ("shift each letter").
- *A change of unit* left out (800 g a day asked in kg, a flow per minute
  asked in hours) or put in where none belonged (kW x hours / 1000: the
  instructions' example had /1000).
- *"NEED: What is the radius of Earth in kilometres?"* for a satellite's
  period (the 2B, twice; the 0.8B for an escape velocity), with the recipe
  "{alt_km}+6371" in front of it. Lantern answered with the radius in
  metres and "use PLANET"; the 2B asked again, the 0.8B wrote
  `=PLANET("Earth","radius")` and nothing else.
- *"from a 300 km orbit to a 35786 km orbit"* (the 4B, the 2B, and the 4B on
  run 3): both heights put in as radii; Lantern said "radius 300 km is
  inside the Earth"; the model wrote 300+6371 and left 35786. Lantern's own
  cards led there: one took two radii, the other a height and then a
  radius. The 2B and the 0.8B also took HOHMANN (a speed) for a time.
- *"LESSON: <a title>"* as a heading over a whole answer (the 4B, a program
  and a wheel): Lantern took it for a request, sent passages, and the
  answer under it was lost. For "LESSON: Ode to Joy Orchestra" (1.24.4) it
  had sent three passages about slides, sentences and square roots.
- *An example in what Lantern sends back is copied too.* Asked for a note
  with the formula "like note Rt = R1 x R2 / (R1 + R2) =
  {=100*200/(100+200)} ohm", the 2B wrote exactly that under a circuit of
  4, 6 and 12 ohm. Given Blink (delay(1000), twice) as the tested example
  for "without using delay()", it wrote delayMicroseconds(500). Given the
  guide's "Button and LED", it put the button and its two pins into a relay
  driver.
- *A lesson given and not used.* For "My brother is having a fit" the 0.8B
  answered "ANS: = (1) / ANS: = (2)"; the person saw which lesson the AI
  had been given and nothing of what it says. For "My hens have stopped
  laying eggs. What could be wrong?" the 2B and the 0.8B were given no
  lesson at all: the larger models ask for one (LESSON:), they do not.
- *The 0.8B copied the instructions' own words* in thirty replies ("=
  (evaluated in order; ANS ...", "ANS1"), and wrote "NEED:" before a sum of
  its own (`NEED: What is the value of 50?` / `=WEIGHT(50,"kg")`), or a NEED
  and then its own answer: each went to the person as a question.
- *Puzzles: the 2B passed 1 of 10, the 0.8B none,* and neither wrote a
  TRACK, TURN or SOLVE block once. The puzzle tools were the last 1,800
  characters of 4,000, after the sums and the functions; and nothing went
  back for an answer with no block.

**What changed.** Seven new modules (411 in all), twelve new recipe cards (44).

*What a question is given*

- **The card that fits** (ASSIST_CORE's match). A keyword counts as a whole
  word; words of a question's shape (how, many, long, km) count a quarter
  and never fit a card alone; a card's `when` says what makes it THIS sum (a
  pattern, or a function of the question); a card must score 0.6 of the
  best. Cards are fitted to the question (`Lantern.assistCardFits`): an
  orbit asked in hours is given "/3600 -> hours per orbit", not "/60".
- **Twelve cards**: Ohm's law three ways and watts (what is ASKED chooses),
  resistors in series, plants in a bed, eggs a week, a weight in newtons, a
  wavelength; and the Hohmann transfer by what the question's numbers are
  -- two heights, one height and a radius, or two radii -- for the time and
  for delta-v. Earth's cards are no longer offered for Mars or the Moon.
- **Functions by name** (AI_PROMPT's pick), or by a word of the description
  that at most two functions have and that is not a unit or a shape word.
- **Short instructions by kind, for a small model.** A sum: one way to write
  it, ANS only as the line before, NEED only when the question has fewer
  numbers than the recipe has blanks, no decline, an example with no change
  of unit and only when there is no recipe to copy (about 1,100 to 1,700
  characters; the full ones are 7,300). Words: Chat's own lines and no sum
  (2,000 characters; 9,100). A thing to make: its block guide, and only
  the kind the question's words mean (**AI_ACT_SENSE**, new: a ladder to
  climb is not ladder logic, table salt is not a table). A puzzle of
  several steps or clues: its puzzle tool and nothing else (1,100 to 1,900
  characters). The letters of a word: a sum, with the text functions.
- **AI_UNITS** (new). The change of unit the question asks for is said with
  the question ("the question gives kW and asks for kWh: kW x hours is kWh
  already, so no change of unit is needed (no /1000)") and checked in the
  sum, with the line to write ("divide by 1000 (=800*30*20/1000)").

*What goes back, with the line to write*

- **AI_NO_FORMULA** (new). A decline, or a result typed with no sum, where a
  recipe fits: the recipe's line goes back with what goes in each blank.
  With no recipe and two numbers or more: the numbers, and the sum asked
  for. A line that could not be run, where a recipe with a function fits
  and the line does not use it: the recipe goes back with the error.
- **AI_NEED_RECIPE** (new). A NEED for a planet's or the Earth's figure,
  where the question's recipe has it in its line: the answer is that line.
- **A NEED that is not one.** A NEED for a number the question gives, with
  the sum already under it: the sum is read and checked like any other. A
  NEED with its own answer or a decline under it: the recipe goes back,
  where the question fills it. A NEED on its own is a NEED.
- **The recipe Lantern can fill itself** (one blank, one number, the same
  unit): a sum that runs and gives another number goes back with the
  recipe's line (`=100*10^6/299792458` for a wavelength: `=WAVELEN(100)`).
- **Amp-hours the question asks for** are checked when the sentence names
  no unit, and the line to write counts the days ("=5*3*7").
- **AI_PUZZLE_ASK** (new). An answer to a puzzle of several steps or clues
  with no block in it is asked for the block, once, with its first line,
  for every model (not when the puzzle tools are off).
- **Heights and speeds** (AI_CHECKS; `Lantern.assistRejectHints`). Every
  height in the question is named, with the one line to write, whether the
  formula ran or not. HOHMANN or ORBITV where the question asks how long is
  questioned (only where the whole line is the speed).
- **The wheel** (AI_WHEEL_CHECK). A part with a wrong formula, or the same
  pair of letters twice, is written out: the formulas that were right as
  the model wrote them, the rest worked out by Lantern from the pairs of
  letters the part lacks (against two sets of values that obey Ohm's law).
- **A sunset** under the blue of day, **a pin with two jobs** (the button
  goes on the pin that is free), **a sketch that waits in a delay** where
  the question says without, **an output given a value twice** in
  Structured Text with nothing holding it: each goes back with its line.
- **A tune's bars.** The number of bars the question asks for is said under
  the guide's example (which has four), and a melody that stops short of
  its chords is told how its last bar must end ("end it on G, B or D, the
  notes of its chord G"). The 35B wrote four bars of melody under eight of
  chords for the same question on 1.19.0, 1.24.5 and 1.24.6.
- **LESSON:** A line that heads a long answer is a heading. Where Lantern's
  lessons have nothing on the words and a thing was asked for, it says so
  and asks for the block, with its first line. A lesson is read out for a
  LESSON request only when it is about the words or the question
  (SUITE_PASSAGES' named).

*Correct by construction, and said*

- **AI_SCHEMATIC_TOTAL** (new). One source and resistors only, all in
  parallel or all in series (a switch or an ammeter in the line counts as
  wire), each with a value: when the question asks for the total and no
  note gives it, Lantern works it out, adds the note and says so. A note
  whose sum is made of numbers that are not the circuit's goes back with
  the line. The request for a note no longer carries a sum to copy.
- Parts nobody wired or asked for are left out of a schematic; a pin a line
  names and no pin line declares is added; cards written "front: back" and
  a column named by its symbol ("Celsius (C)", =C*1.8+32) are read; a colour
  on a line of its own and "Part: P | ..." are read on a wheel; a deck
  written as several blocks is joined; "arrange" and "form" lines are left
  out of a tune that asks for no arrangement; a part that plays the tune's
  own note is not a clash; the guide's explanations copied after a line
  ("key C major    the key; a plain ...") are taken off; "[n]" written as the
  instructions spell it is taken off and Lantern cites the sentence. Each
  is said in the summary.
- **A button on a 5 V pin was said to read the supply's voltage** ("reads
  12 V while S1 is pressed"). The drawing fed it from the board's 5 V; the
  sentence now says 5 V.
- **The tested example** for "without using delay()" is Blink without
  delay: a word after "without" counts against an example that uses it.

*For the person*

- **CHAT_LESSON_SHOWN** (new). When the AI's answer uses nothing of the
  lesson Lantern gave it, the lesson's own words are shown under the reply,
  with a button to open it. Nothing is added to the AI's answer.
- **A question about what is wrong** ("My hens have stopped laying eggs.
  What could be wrong?", "Why won't my engine start?") is one Chat reads
  its lessons for by itself; the lesson is still given only when it is sure
  to be about the question.

*The bench*

- `tools/bench_headless.py` prints a made thing's replies whole (a program
  was cut at 700 characters, before its first line of code).

**What was tested.**

- `npm test`: all 60 suites pass. New: `tests/tools_fit.js` (50 checks),
  `tests/bench_1244_4b.js` (35) and `tests/bench_1245_small.js` (80), which
  replay the fixtures' rows through the changed code. Where Lantern sends
  something back, the reply that returns is scripted: with a right second
  reply all 20 of the 2B's failed sums pass, 32 of the 0.8B's 33, and five
  of the 2B's puzzles once the block is written.
- The 35B's 45 right sums of 1.24.4 replay with nothing questioned.
- Browser tests (real Chromium, a stand-in model): the headless bench, food
  (with the lesson box), health, Code Lab, domains (pneumatics, control,
  electronics), music, bench run 9, hydraulic and Text Reader pass (music
  on the build that was pushed, the others on the one before the last
  change).
- The 35B on the laptop, a full run on the build before the last change
  (the tune's bars, below): **111 of 112 (99%)**, 67 minutes, 4.1 tokens a
  second; 4 sent back once, 3 mended. The miss was `make-music-original`
  again: four bars of melody under eight of chords, in the shape of the
  guide's four-bar example; told to write four more, it ended them on C
  over G, which Lantern questioned with no turn left. That is the last
  change. With it, the four music questions were run again on the build
  that was pushed: 4 of 4. The first reply was four bars again; the second
  ended on a note of the chord. Its row is
  `tests/fixtures/bench_run_1246_35b.json`.

**What was not.**

- **No small model has run 1.24.6.** The push starts their run; what the
  2B and the 0.8B do with the new instructions is not known until it is
  read. One row moving is not a finding.
- The 35B's full run was not repeated on the build that was pushed: only
  the music questions were (the last change touches nothing else).
- The lines of the slide guide's new example (a lockout: "Take off your own
  lock only", "Tell the crew before power returns") are as 29 CFR
  1910.147(e) is recalled; the page could not be opened from this session.
- Left failing, and in the tests as such: a roof drawn as a red square; the
  host who does not know where the car is (answered as the one who does);
  a battery nobody gave, assumed; `=2000/8000` where `=2000/ANS` was meant
  (one row, once).
- How the lesson box and the drawing guide's new example look is Adam's to
  judge.

## 1.24.5 — The small models read; the Food tile audited; the right lesson found (2026-11-06)

Three pieces of work under the same aim: a small model with Lantern should
give the right answer, and what Lantern itself says should be right.

### 1. The small models

**What was seen.** Since 1.24.3 every push runs the whole bench on GitHub
with the 0.8B, the 2B and the 4B. On 1.24.4 (no library, 109 scored
questions): **the 2B passed 50 (46%), the 0.8B 16 (15%)**; the 35B, on the
laptop, 107 (98%). The 4B passed 96 of 103 (93%) on 1.24.3; its run on
1.24.4 had not ended when this was written. From 1.24.4 the job's log has
every failed row as the model wrote it. They are now
`tests/fixtures/bench_run_1244_2b.json` (59 rows) and
`bench_run_1244_08b.json` (93 rows), and `tests/small_models.js` replays
them.

**What they were traced to.** Not to what the models know. To what Lantern
gave them and how it read them:

- *"asked for a value"* (the 2B 11 times, the 0.8B 24). Asked "What voltage
  is across a 470 ohm resistor carrying 0.02 amps?" the 2B wrote `NEED: What
  is the resistance in ohms and the current in amperes?`. Four times, for
  questions about a pump, a jerrycan and a family's water, it wrote the
  instructions' own example of a NEED, word for word. The 0.8B wrote `NEED:`
  and then the question: the instructions said `NEED: <question>`.
- *"Server said 400 Bad Request"* (the 2B, 5 times): `request (8625 tokens)
  exceeds the available context size (8192 tokens)`. The model had asked
  Lantern for one thing after another, each answer was added to the
  conversation, and the kit gives every model 8,192 tokens.
- *"no formula"* and *"no MAKE block"*: `ANSWER: CONVERT(26,"mile","km")`
  (the formula where the sentence goes), `ANS: 120*80/10000` (the sum,
  labelled ANS; the 0.8B wrote most of its sums so), `= MAKE WHEEL: ...` and
  `=TRACK: Cups` (a block with the = of a formula line), `ANS: 3` fifty
  times.
- *wrong functions*: with all 75 functions in front of it the 2B took RELKE
  for a car's kinetic energy, no function for a wavelength, and declined
  "Convert 5 kg to pounds" and a bed of plants. Chat's instructions were
  9,000 characters before the question.
- *"no sentence backed by a lesson passage"*: for "My brother is having a
  fit" the 2B gave the Fits lesson's own eight sentences, in order, under
  "From my own knowledge:" and with no [n]. Lantern had found every one of
  them in the passage and counted none.
- And one that was Lantern's alone: `RELKE(1200,25)` said 383,162 J for a
  car's 375,000 J. It worked out gamma − 1 by subtracting two numbers that
  agree to fifteen places.

**What changed.**

- **AI_NEED_GIVEN** (new). A NEED for a number the question gives is
  answered by Lantern, once, with the question's numbers: "the question
  gives these numbers: 470 ohm; 0.02 amps. If the number you asked for is
  among them, use it ... Write NEED again only for a number that is not
  among them." A NEED is taken to be for something given when it quotes a
  number of the question, repeats the question, is the instructions' own
  example, or asks "how many <unit>" or "in <unit>" for a unit the question
  gives a number in. "How many goats do you have?" still goes to the person.
  It answers all 11 of the 2B's rows and 22 of the 0.8B's 24.
- **The instructions.** `NEED: <what is missing>` in every place (it was
  `<question>`). The numbers the question gives are listed under it. The
  example of a NEED is shown only for a question with fewer than two
  numbers.
- **The short prompt for a small model** (AI_PROMPT). "Automatic" was short
  only for a model running in the browser; it is now short too when the
  kit's server runs a model under 3 billion parameters (by its file name:
  `Qwen3.5-2B`, `Qwen3.5-0.8B`). The functions offered are the ones the
  question is about: for a wavelength, WAVELEN and eight others in 2,300
  characters, where it was 75 in 7,600. Chat's own instructions follow the
  same rule and fall from 9,000 characters to about 4,000. The 4B and
  larger get what they got.
- **AI_READ** (new; `Lantern.aiReplyReaders`, applied by the engine to every
  reply before anything else reads it). `= MAKE ...`, `=TRACK:` and
  `= ANSWER:` are read without their =; `ANSWER: <a formula with one of
  Lantern's functions>` as the formula and its result; `ANS: <a sum>` as a
  formula line and `ANS: <a sentence>` as the answer, when the reply has no
  = line; one ANS or = line written three times or more running, as one.
  Nothing is computed or guessed: `ANS: 3` stays a number with no sum, and
  `ANSWER: 1/2` stays an answer. Chat says what it read
  ("Lantern read a formula written after “ANSWER:” as a formula line").
- **AI_FIT** (new; `Lantern.aiFit`). When the server refuses a request as
  longer than the model can hold, Lantern shortens it by the server's own
  count and sends it once more: the longest messages (Lantern's own:
  passages, a catalog, a tool sheet) lose their middle and keep their start
  and their end; the oldest turns go only if that is not enough; the
  instructions are cut last. Chat says so.
- **A sentence a passage says, which the AI did not cite, is cited by
  Lantern.** It counts as backed, Chat says how many it found, and an
  answer made only of such sentences is no longer labelled "from the AI's
  own knowledge ... Lantern did not check it".
- **AI_NO_BLOCK** (new; in `Lantern.chatNoBlock` after MUSIC_CHAT's own),
  and the bench's path now asks as Chat does. A thing was asked for,
  Lantern can make it, and the reply has no block: the block is asked for
  once, with its first line as the instructions for that question give it
  (`MAKE PNEUMATIC` for air, `MAKE CODE` for a sketch that names an LED,
  `MAKE WHEEL` for "draw the power wheel"). This was the 35B's one miss on
  1.24.4 (below), 15 of the 0.8B's, and two of the 4B's on 1.24.3.
- **RELKE** is exact at everyday speeds (gamma − 1 = b² / (s(1 + s)), with
  b² = v²/c² and s = √(1 − b²)), and unchanged near light speed.

### 2. The lesson Chat reads by itself

**What was seen.** For a how-to Chat gives the AI Lantern's own lesson, when
it is sure one fits. It looked only at the best-scoring lesson, and was sure
when one rare word of the question was in its title. So "How do I dig a
well?" was given *Deciding well*, "How do I tan a hide?" trigonometry, "How
do I weld two steel plates?" *A balanced plate*, "How do I prevent scurvy?"
*Engine care that prevents repair* — and "How do I patch an inner tube?",
"How do I purify water?", "How do I find north without a compass?" were
given nothing, though a lesson answers each.

**What changed.**

- SUITE_SEARCH: a hit also says how much of the question it has **by
  weight** (a rare word counts for more than a common one, and a word no
  lesson has counts most), and whether a rare word of the question is in it
  anywhere.
- SUITE_PASSAGES: the first of the best five that is sure — its title and
  tile name the topic and it has a quarter of the question by weight; or its
  title names one rare word and it has half; or a rare word is in its text,
  the text matches well and it has most of the question. After it, others of
  the same tile; from another tile only a lesson that is sure itself, scores
  at least half as well, and is about the same thing or brings a rarer word
  the first lacks. A paragraph that ends in a colon brings the list it
  introduces.
- **LESSON_WORDS** (new) and `Lantern.mathLessons.about(key, words)`: a
  lesson can carry the words people ask with ("puncture, patch an inner
  tube", "purify", "find north without a compass", "scurvy"). They are its
  description: the search weighs them, the Search tile shows them under the
  title, the AI's catalog lists them. Twenty lessons have them so far; each
  tile audit adds its own.
- The area lesson says how to find the area of a field or a room (with
  hectares), so "How do I measure a field?" has its answer.
- Of 36 how-to questions, 27 were given a lesson before, four of them the
  wrong one (a carburettor got *Clean water* for animals; growing maize, the
  Forge's guide; finding north, *Natural pest control*; measuring a field,
  *Angles*). 27 are given one now, each the lesson that answers. Nine find
  nothing: soap, bees, pruning, sharpening a knife, a rocket stove, wiring
  a lamp and a solar charger have no lesson; storing grain and bread have
  one drafted (below). Of 15 questions Lantern has no lesson for, six were
  given one before and none is now.

### 3. The Food tile, audited

**What was seen.** The tile's own table still offered "Oil covering — seals
out air — cooked vegetables, cheese, herbs", which is how botulism is made;
"meat (jerky)" and fish under plain drying; "juices run clear, no pink" as
the test that chicken is cooked; and a daily-needs sum that told a 6 kg
baby to drink 0.21 litres of water. The tile had no help guide.

**How it was checked.** As Health was: a separate checker, which had not
seen the drafting, read every lesson and table against pages it opened.
This time only two sites could be opened (the others needed an approval
nobody was there to give, and the session's web searches were spent): the
US Centers for Disease Control and Prevention, and the US National Center
for Home Food Preservation, which hosts the USDA Complete Guide to Home
Canning. So **only what those pages say went in**, and every figure was
then read again on its page by the session that wrote this.

**What changed.**

- The tile: three groups (Eating well; Safe to eat; Keeping food), each
  topic shown only when its lesson is loaded. The preserving table has a
  "To be safe" column, no oil covering, and its own row for meat and fish.
  The cooking table gives temperatures first (poultry and leftovers 74 °C,
  minced meat 71 °C, whole cuts 63 °C then 3 minutes, fish 63 °C), adds
  shellfish, sprouts, pork and game, and milk from the animal, and says
  under it what to do with no thermometer. The sum shows no number for
  anyone under 18. A help guide.
- All eight lessons the tile had are revised: the four steps and their
  figures (hands 20 seconds; 4 to 60 °C; 2 hours, 1 hour above 32 °C);
  sun-drying for fruit, and what the US guide says of meat (not in the open
  air; if it must be: 6 mm strips, salted, boiled 5 minutes first, eaten
  within two weeks; never fish unsalted; pork and game cooked through);
  botulism's signs and that it is an emergency; sauerkraut as the USDA
  gives it (3 tablespoons of salt to 5 lb, 3 to 4 weeks at 21 to 24 °C),
  as steps; a baby's food from the CDC's pages (about six months, not
  before four; one food at a time, 3 to 5 days apart; nothing with honey,
  no cow's milk as a drink and no juice before 12 months); vitamin D,
  folate and zinc; iron from plants.
- Two new lessons: **Cooking food so it is safe**, and **Milk and eggs**.
- Three food conversations in the bench (sauerkraut and its salt; when
  chicken is cooked; cooked vegetables kept under oil, which must be
  answered "never").
- Health's own lesson on keeping food says how long dried meat keeps.

**Drafted and not in.** Five more lessons were written and checked only
from memory, so they are held back, with both checkers' notes, on the
branch `wip-2026-11-06`: foods that must be prepared the right way (cassava,
kidney beans, mouldy grain, green potatoes), storing grain, the illnesses
of a narrow diet, bread, and cooking with less fuel and smoke. Their
sources (WHO, FAO, the US FDA, USDA's food safety service) need opening.
The checker's own recollection differed from the drafts in places that
matter (how long kidney beans must boil; that drying alone does not make
bitter cassava safe), which is why they wait.

### 4. Lantern questioned its own example

On the 35B's full run on 1.24.4 the ladder question failed: "the question
asks for a seal-in, but no contact examines the coil RunLight". The model
had asked for Lantern's example and given it back exactly: the motor sealed
in, and a run light that follows it. Lantern's check asked **every** coil
for a seal-in. Now one coil that holds itself in is the seal-in, and when
none does, a coil that only follows another is not the one questioned. A
test holds Lantern's own ladder example to Lantern's own checks.

### What was tested

- `npm test`: all 57 suites pass (four new).
- New suites: `tests/small_models.js` (51 checks: the rows of the 2B and
  the 0.8B replayed), `tests/no_block.js` (23: the 35B's row replayed),
  `tests/lesson_search.js` (20), `tests/food.js` (34); five more checks in
  `tests/code_lab.js` (the 35B's ladder row).
- Browser tests (Chromium): the new `tests/browser/food_e2e.py` (19 checks: the Food tile used for real, and Chat with a
  stand-in 2B -- the short instructions, the lesson given whole, a formula after ANSWER:, a NEED answered, a
  request sent again shorter); and the Health, Code Lab, bench run 9, domains, headless bench, Text Reader and
  music tests, which pass.
- The 35B, laptop, full run on 1.24.4 (115 questions, no library): **107 of
  109 scored (98%)**, 80 minutes, 3.8 tokens a second; 7 sent back once, 6
  fixed. Its two misses are both answered above: `make-pneumatic` (700
  tokens of thinking aloud and no block) and `code-ladder-start-stop`
  (Lantern's own fault). The rows are `tests/fixtures/bench_run_1244_35b.json`.
- The 35B on 1.24.5: see `agent/reports/2026-11-06-1.24.5.md`.

### What was not

- **No small model has run 1.24.5 yet.** Every change above was made from
  the rows of 1.24.4 and tested by replaying them, with the reply that
  comes back after Lantern's answer written by hand. The push of this
  branch starts the run that will say what the 2B and the 0.8B do with it;
  the report has the result.
- Not checked against an opened page, and left as they were in the Food
  lessons: 2000 to 2500 kcal a day and 0.8 to 1 g of protein per kg; vitamin
  C and calcium; "use the cooking water"; the half, quarter, quarter plate;
  cellar storage. The Mifflin-St Jeor equation's constants and the four
  activity factors of the sum were compared from memory only. Boiling milk
  is derived (boiling water is hotter than any cooking temperature the CDC
  gives), not read: the CDC's page on raw milk gives no temperature. "No
  pink, clear juices, and then cook it longer" for a kitchen with no
  thermometer is WHO's wording, recalled, not opened.
- The kit still gives every model 8,192 tokens. Lantern now recovers from
  a request that is too long; whether the small models should be given
  more is a question of memory on the smallest computers, and is Adam's.

## 1.24.4 — The Health tile, audited: what to do when no help can come (2026-11-05)

The first tile audit under Adam's direction ("maximizing the rebooting of
civilization from a usb stick ... making all of the answers the AI can give
as good as possible"). Health went first: it is the tile a person is most
likely to open with nobody to ask.

**What was seen.** The tile had 14 short lessons, an ORS mixer and three
printed cards. Used in a real browser, everything opened; two things were
wrong in the mixer (it showed nothing until Mix was pressed, and for a
mouthful of water it said "0 tsp sugar + 0 tsp salt"). Read against the aim,
most of what a household needs was missing: nothing on a person who is not
breathing beyond one sentence, nothing on the recovery position, shock,
fits, poisoning, drowning, a blow to the head, a sick child's danger signs,
pneumonia, diarrhoea beyond the recipe, malaria, birth, the newborn, a
latrine, storing water. And the AI could not reach what there was: Chat
gives Lantern's lessons for a how-to question, and a person in trouble does
not ask one ("my son is choking", "she has had diarrhoea for two days").

**What changed.**

- **28 new lessons and 13 revised ones**, 42 in all, in four groups with the
  emergencies first (of the 14 the tile had, only Broken bones stands as it
  was):
  - *Emergencies:* first things first; not breathing (chest pushes); choking
    (revised); the recovery position; bleeding (revised: the tourniquet,
    packing a wound); shock; blows to the head; fits; stroke and heart
    attack; poisoning; drowning; electric shock and lightning; eyes, a
    bleeding nose, fainting; moving an injured person; bites and stings
    (reworded so "bitten by a snake" finds it).
  - *Sick children and adults:* danger signs in a child; counting breaths
    for pneumonia; diarrhoea; ORS (revised); malaria; a dangerously thin
    child (the arm measurement); pulse, breathing, temperature; caring for
    the sick at home; fear, grief and a troubled mind.
  - *Mother and baby:* pregnancy and its danger signs; a birth with no
    midwife; the first hour; the newborn.
  - *Staying well:* safe water (revised); enough water, kept safe; a pit
    latrine and a tippy tap; stopping an illness spreading; a first-aid kit.
- **Every figure was checked against a source by a separate checker** that
  had not seen the drafting, and the lessons were corrected from what the
  checkers found before anything was built. Sources, named in each module's
  header: WHO (IMCI chart booklet 2014; The Treatment of Diarrhoea 2005;
  Pregnancy, childbirth, postpartum and newborn care 2015; newborn health
  2017; Psychological first aid 2011; child growth standards 2009 / 2013);
  the Resuscitation Council UK and American Heart Association guidelines of
  2025; St John Ambulance; the UK NHS and NICE NG232; US CDC (Make Water
  Safe, seizure first aid, stroke, heart attack, carbon monoxide); US EPA;
  US Poison Control; MedlinePlus; the Sphere Handbook 2018; WEDC (pit
  latrines); Helping Babies Breathe; Hesperian (facts only); the US Army's
  First Aid manual FM 4-25.11 (public domain) for carries and stretchers.
  All of it is in Lantern's own words. What the checkers changed:
  - a baby's chest is pressed with **two thumbs**, the hands round the
    chest (2025 guidelines; two fingers were dropped as too shallow), and a
    baby's head is kept level for breaths;
  - **raising a bleeding limb is gone** (it was in the old lesson and on the
    printed card; current first-aid guidance drops it: pressure is what
    works), and the tourniquet is no longer "a last resort";
  - after a blow to the head a person **may sleep** (the draft said to wake
    them); who must be seen is listed;
  - a child's fit with fever: **no sponging or bathing**; a first fit is
    urgent;
  - chemicals are washed off for **at least 20 minutes**; a nosebleed needs
    help after **15** minutes, not 30; a faint that lasts more than a minute
    is not a faint;
  - a newborn who does not breathe: dried, rubbed two or three times, and
    helped to breathe **within the first minute** with small puffs from the
    cheeks; the womb is **not pressed to bring the afterbirth**; bleeding
    after a birth has a measure (a cloth soaked in under 5 minutes);
  - the arm measurement is found with the arm bent, taken with it hanging;
  - "speaks of harming themselves" is help **at once**, not after weeks;
  - water: 3 minutes' boiling above about 1,500 m (the lower of the CDC's
    and EPA's heights), the second dose of bleach when no chlorine can be
    smelt, weak 1% bleach, and that bleach does not kill every parasite;
  - a pit is always lined at the top, and nobody digs one alone;
  - **the lessons the tile already had were checked too, and nine were
    wrong or out of date.** Keeping food said to dry meat and fish in the
    sun as they are, that smoking preserves, and to remove "the water or the
    air": meat and fish are now salted, dried hard and cooked before eating,
    smoke alone is said not to keep food, and nothing moist is sealed
    airtight (botulism). A fever is no longer sponged. An animal bite is
    washed and left open, not covered. A snake-bitten limb is kept still and
    the person carried, not the limb held low. Heatstroke is cooled quickest
    in water to the neck. A child's milk tooth is not put back. A wound
    turning red is rested and raised, not soaked. Burns gained clothes on
    fire, chemicals, and the burns that need help.
- **No medicine and no dose anywhere in the tile** (a test now holds this).
  WHO's amounts of fluid for a child with diarrhoea are in (50 to 100 ml
  under 2 years, 100 to 200 ml older, after each loose stool): fluid, not a
  medicine. What the sources add that is a medicine (zinc, aspirin for a
  heart attack, chlorhexidine on the cord) is a question for Adam in
  `agent/QUESTIONS.md`.
- **The tile.** Topics shown only when their lesson is loaded, so each
  lesson module can be dropped. The ORS mixer answers as the tile opens; for
  under a litre it adds that so little salt cannot be measured safely, and
  for a cupful it gives no numbers at all. Two tools other modules add
  (`Lantern.healthTools`):
  - **a breath and pulse counter** (HEALTH_COUNT): it times one full minute
    while you tap at each breath or beat, or takes a count typed in, and
    says what it means: WHO's fast-breathing limits by age (60, 50, 40),
    MedlinePlus's resting pulse by age. For an older child or adult it makes
    up no limit.
  - **bleach for drinking water** (HEALTH_BLEACH): the CDC's table, for
    bleach labelled 5% to 9% or 1%, clear or cloudy; from 40 drops also in
    millilitres and teaspoons at the table's own rate.
- **Print on every lesson of every tile** (LESSON_PRINT, through a new hook
  `Lantern.lessonTools`): the lesson alone, with its title, over as many
  pages as it needs. Paper survives a dead battery.
- **Chat gives the Health lesson for a health need** (HEALTH_CHAT). A
  question that names an injury, illness or sign in a person ("he fell and
  hit his head and now he is vomiting"), or a how-to a Health lesson answers
  best, gets that lesson **whole and in its own order**, one more if it fits
  nearly as well, and never another tile's ("having a fit ... on the floor"
  was being answered from the FLOOR function's lesson). 35 questions as
  people say them reach the right lesson; 14 that only share a word ("my
  engine coughs", "my code is broken", "my goat has diarrhoea") do not.
  Medicine doses still go to the rule in AI_GUARD first.
- **A list is given to the AI whole or not at all** (SUITE_PASSAGES). The
  recovery position reached the model as steps 1, 2 and 6; 17 lessons across
  the tiles lost part of a list when asked for by their own title. A step
  left out of a procedure is worse than a longer passage.
- **Recipe cards** (HEALTH_RECIPES): ORS sugar and salt for an amount of
  water, drops of bleach for an amount of water, so the model fills in the
  litres and Lantern multiplies.
- **Six bench questions** (HEALTH_BENCH_DATA): four conversations as people
  would say them (choking, a fit, a baby breathing 56 times a minute, river
  water), graded on the right lesson being in front of the AI, a sentence
  backed by it, and the point of the lesson being said; two sums (ORS for 5
  litres, bleach for a jerrycan).
- **The model server's own reason for a refusal is passed on** (AI_ENGINE):
  the 2B's first run on GitHub lost three puzzles to "Server said 400 Bad
  Request" and nothing more. It now adds the server's message, and when it
  is the context, what to do.
- **The headless bench prints the failed rows into its log**, one line of
  JSON each, and the workflow prints the engine's complaints: a session can
  read a job's log but could not fetch its artifact.

**Tested.** `tests/health.js` (new, in `npm test`): the tile, the mixer, the
figures as sourced (a change to one is a decision, not a slip), advice the
2025 guidelines dropped staying out, no medicine or dose, the counter with
taps over a shortened minute, the CDC table's own rows, Print, the 35 and
the 14 questions, whole lessons and whole lists, Chat end to end with a
scripted model, the bench questions' checks, and each new module dropped
(rule 11). `tests/browser/health_e2e.py` (new, Chromium): every topic, the
tools with real taps, a lesson printed to a real PDF over several A5 pages
with nothing of the tile behind it, a phone's width, and Chat with a
stand-in model. `tests/ai_layer.js`, `tests/chat_routing.js` updated.
`npm test`: all suites pass.

**Not tested, and said so.** The lessons were checked against sources, not
by a doctor, a midwife or a first-aid instructor: Adam should have one read
them before `main`. The three checkers could not open every source (the WHO
2005 diarrhoea manual and the WHO pregnancy guide's own PDF were read
through copies; a few lines have no source that was opened, listed in the
report). The same wrong advice about keeping food may be in the Food tile's
own lessons: that tile is next in the queue. In 1.24.4 only that tile's
"Preserving food without a fridge" was corrected with Health's (no oil over
cooked food, no air to keep out, the botulism warning), and both lessons say
that they were wrong before. What the 35B and the small models made of the
six new questions is in the session's report.

## 1.24.3 — The bench with the small models, and nobody at the keyboard (2026-11-05)

Lantern is meant for a small model on an old computer, and every real-model
run since October has been the 35B on one laptop, started by hand. Nothing
in Lantern itself changes in this version: it adds the way to ask the small
models, on every version, without anyone being there.

- **`tools/bench_headless.py`**: Lantern Bench in a headless browser. It
  waits for the model server at the kit's address, opens Lantern, evaluates
  `tools/bench_pane.js`, runs the full bench (or `--quick`, `--ids`,
  `--match`), and writes `report.json` (the AI tile's Save JSON),
  `rows.json` as the questions finish, `failed.json` (the failed rows as
  the model wrote them, ready for `tests/fixtures`) and `summary.md`. A run
  that is out of time is stopped after the question in hand and keeps its
  rows. Exit 0 means the run finished, whatever it scored.
- **The "Lantern Bench" workflow** (`.github/workflows/lantern-bench.yml`):
  on every push to a `lantern-x.y.z` branch, a GitHub computer (4 cores,
  16 GB, no graphics card: an old laptop) gets the engine and a model with
  the kit's own installer (`kit/setup-kit.sh engine 4b`), starts Lantern
  with `kit/start-lantern.sh`, and runs the whole bench; once each for the
  0.8B, the 2B and the 4B. So it is also the first automatic run of the
  Linux installer and start script from nothing. The score is on the job's
  summary page; the report and the failed rows are its artifact. It reads
  the repository and publishes nothing. No offline library there (12 GB),
  so the encyclopedia questions are left out, as on the laptop.
- For the sessions that do the work: `CLAUDE.md` says how to read those
  runs (`gh run list`, `gh run download`) and what a run with nobody
  watching does; `agent/NIGHTLY.md` holds the instruction for a nightly
  run.
- Tests: `tests/browser/bench_headless_e2e.py` (16 checks, Chromium, a
  stand-in server serving `site/index.html`): three chosen questions (a
  right formula, a wrong one, a decline), the report, the rows, the failed
  row as written, the summary, the quick run, a run cut off for time
  (exit 3, rows kept), nothing at the address (exit 2). `npm test`: all
  suites pass.
- Not tested here: the workflow itself cannot run before it is pushed; its
  first runs are this branch's. What they showed is in the session's report
  (`agent/reports/`), and the failed rows go into `tests/fixtures` with the
  next version.
- The 35B's full run on 1.24.2 (the same Lantern code as this version) is in
  the same report.

## 1.24.2 — The right example, the rung that works, and tunes Lantern knows whole (2026-11-05)

Adam: "Keep going my direction is the intent with you as the author of the
code of course. Each module of lantern should be added to with the maximum
extent you can apply for the purpose of maximizing the rebooting of
civilization from a usb stick and making all of the answers the AI can give
as good as possible."

The four misses left by the 35B's runs on 1.24.0 and 1.24.1, each traced to
what Lantern gave the model, not to the model.

- **The ladder start/stop question was shown an Arduino sketch to start
  from.** Lantern's tested examples were ranked by words alone: for "Write
  ladder logic as rung text for a motor start/stop ... a seal-in" the
  Arduino start/stop sketch scored 26 and the ladder one 22; for "Write
  Structured Text ..." the Arduino tank sketch won. On one run the 35B asked
  for the ladder one by name and passed; on the next it wrote rungs of its
  own with Stop in a branch. An example in a language the question names
  now comes first (AI_CODE_EXAMPLES).
- **A Stop or an overload on a branch path of its own** (AI_CODE,
  `stopProblems`). `[XIC(Start),XIC(Stop),XIC(OL)]OTE(Motor);` runs the
  motor whenever Stop is not pressed: a branch is OR. Lantern said only that
  Motor was driven in two rungs, and the second try kept the branch. It now
  names the path that gets past the contact and writes the rung out the way
  that works, from the rung's own contacts: `[XIC(Start) ,XIC(Motor) ]
  XIC(Stop)XIC(OL)OTE(Motor);`. Only a rung that starts or holds its output
  is looked at -- `[XIC(Stop) ,XIC(Limit) ]OTE(Brake);` is right.
- **Songs: the bars the way they were meant** (MUSIC_SONG), and said.
  - A melody over several lines with no bar lines, 17 notes to a line: each
    line starts a new bar and a rest left over at a line's end is left out
    (32 bars, not 34 with every line a beat late and long notes against the
    wrong chords).
  - A `|` after each 4-bar phrase, two of them over 8 bars of chords: read
    as 8 bars ("the chords go on 6 bars past the melody" before). Not a bar
    of finer shares -- `C - - D E - F -` stays one bar.
- **The line to write, not a choice of things to do.** The waltz's last bar
  held G over the home chord; told "write G or Em there, or change the
  note", the 35B sent the same block back. The tune's last note over its
  home chord now gets the bar itself -- "write bar 8 of the melody as F# - -
  r" -- and any other bar the chords line with the chord that fits. What
  goes back with it is the two lines of the guide it is about, not all 35
  with every instrument (AI_MUSIC `fixHint`); and no full stop after lines
  to copy -- in a song a `.` is a held note.
- **Tunes Lantern knows whole: a songbook** (new module MUSIC_SONGBOOK).
  Three runs out of three the 35B wrote Ode to Joy from memory with its 4th
  bar's rhythm flattened, and a middle section of its own. Nine old tunes,
  free for anyone, as the lines Lantern plays with their real note lengths:
  Ode to Joy (all 16 bars), Twinkle Twinkle, Frère Jacques, Mary Had a Little
  Lamb, Jingle Bells, London Bridge, Row Row Row Your Boat, Silent Night,
  Hot Cross Buns.
  - A question that names one gets its lines to copy with the MAKE MUSIC
    instructions, as it gets the notes Lantern reads from a picture.
  - The song made is checked against them, in any key and octave; a
    flattened rhythm or a wrong note goes back with the lines. A variation,
    or a tune "in the style of" one, is the AI's own.
  - The Music tile's "Start from" list has them whole, for a class to play
    and print with Save parts.
- Tests: `tests/code_lab.js` (107: the example shown for each program
  question; the 35B's rungs, first and second try; five rungs that are
  right); `tests/music.js` (194: the three songs of the run replayed; the
  songbook -- every tune made with nothing questioned, its bars full, its
  opening the one MUSIC_TUNES knows it by, its leaps where they belong; the
  bench's own Ode check on Lantern's lines; the tune from memory sent back
  and the copy passing).

## 1.24.1 — A question with "code" in it is not a program to write (2026-11-05)

The first full Lantern Bench run that nobody clicked through: a Claude chat
linked to Adam's laptop through the Claude desktop app opened Lantern in the
app's browser pane at the kit's own address, with the 35B already loaded,
started the run and read the rows. Lantern 1.24.0, no library answering:
**99 of 103** scored questions (96%) in 72 minutes. The four misses, as the
35B wrote them, are `tests/fixtures/bench_run_1240_35b.json`.

- **`doc-fault-code` was Lantern's doing.** With the compressor manual open,
  "What does fault code E-11 mean?" was taken for something to make: the
  word "code" is one of MAKE CODE's, and any MAKE tool that fitted the
  question put Chat's document prompt into "the person wants something made
  from this document ... reply with the MAKE block". The 35B asked for a
  lesson on "Fault codes" instead, was sent Code Lab's and Turtle Code's
  guides, and answered from memory without page 3's 110 degrees C. Every
  version since 1.16.0 gave it that prompt; earlier runs passed because the
  model answered from the passages anyway.
  - **A question is answered from the pages** (TEXT_READER_CHAT). Something
    is made from an open document when it is asked for -- "make flashcards
    from this", "can you turn it into slides?", "I need a table of the fault
    codes", "Flashcards for section 3". A question that only shares a word
    with a MAKE tool ("What is the maintenance schedule?", "Is there a table
    of the fault codes?", "How do I make the compressor start?") gets its
    passages and the ANSWER / QUOTE instructions.
  - **Code, program, script and ladder are everyday words too** (AI_CODE).
    A kind of code that is not a program (fault, error, trouble, zip, area,
    building, dress, bar, QR, colour, Morse ...), a code named by its number
    (code E-17, code P0420), a code a machine shows, a wash or exercise
    program, program 3, a film script, a ladder to climb: none of these
    brings the MAKE CODE format into the prompt. A programming word left in
    the question still does: "Write Arduino code that shows the fault code
    on an LCD", "a ladder rung that seals in a motor".
- **Ladder rungs after a label, several on a line, are code in the reply**
  (CHAT_CODE_BLOCKS). On 1.24.1 the 35B answered the bench's start/stop
  question with `Ladder: [XIC(Start),XIC(Stop),XIC(OL)]OTE(Motor);[XIC(Motor)]
  XIC(Start)XIC(Stop)XIC(OL)OTE(Motor);` -- nothing in it was taken for code,
  so the bench said "no MAKE block" and the rungs were never checked. Now
  they are (the coil driven in two rungs) and go back once, as code in a
  reply does. Prose with an instruction in it is still prose.
- **The same request does not always get the same reply.** That request was
  the one 1.24.0 sent, word for word (compared outside the browser), and on
  the full run the 35B began `EXAMPLE:` instead. The model server keeps the
  last prompts it worked through and reuses what it can, and llama.cpp says
  its results are then not guaranteed to repeat exactly. So a run repeats
  word for word when the whole run is the same (bench runs 9 and 10), and a
  question that sits on the edge can go either way after any change to the
  questions before it. One row moving is not yet a finding; the same row
  twice is.
- **Not changed: the three song questions**, kept in the fixture for the fix
  to come. In each, the second try did not mend what Lantern pointed at.
  - `make-music-waltz`: the last bar holds G over a D chord; sent back, the
    35B wrote the same block again.
  - `make-music-ode`: every melody line has 17 notes and no bar lines, so
    the bars drift to 34; sent back, it wrote 40 chords instead.
  - `make-music-orchestra`: 2 bars of tune under 8 of chords; the same block
    again. (This question and the waltz had never met a real model.)
- **Swapping Lantern under a loaded model.** The kit's server reads
  `Lantern\site` from the disk at each request, so a new `index.html` and
  `lantern-sw.js` there are the new version with the model still loaded
  (tried: 1.24.0 to 1.23.1 and back, the model answering throughout). It
  sends no cache rule with the page, so a browser may show the copy it has:
  open the address with something new after it (`/?v=1.24.1`), or Ctrl+F5.
- Seen on the run, not looked into: nothing answered on the library's port
  (8081) though both Wikipedia files and kiwix-serve are on the stick, so
  the 25 fact questions and the library conversations were left out.
- Tests: `tests/code_lab.js` (99: 23 everyday questions that are not
  programs, 16 that are, every program question of the bench; the 35B's
  one-line ladder reply read, checked, sent back and passing on the
  corrected block);
  `tests/ai_make_docs.js` (78: the run's row; seven questions answered from
  the pages and seven requests made; the conversation, with page 3 and the
  answer's instructions in one round and the bench's own check passing).

## 1.24.0 — Save a song as a Generative Music Studio project (2026-11-04)

Adam: "we should also add a button that exports the song as a generative
music studio project that will open in the standalone
Generative_Music_Studio html since most of the sounds are generated the same
there should be a lightweight way to achieve this?"

- **Save GMS project** (Chat's song card and the Music tile, MUSIC_GMS): the
  song as GMS's own project file (`format: "gms-project"`, version 2 -- what
  GMS's 💾 Save writes and its 📂 Load reads). Only the notes travel: GMS
  makes every note's sound itself as it loads the file ("Synthesizing
  n/total"), as it does for a project from another device.
  - A track for each player -- a band's tune, chords, bass and drums, or an
    orchestra's players in score order -- with the GMS instrument nearest
    its own (GMS's presets: violin, cello, trumpet, flute, clarinet, harp,
    electric guitar ...; an oboe or a bassoon on its clarinet, a horn on its
    brass section, a tuba on its trombone).
  - Each note on the sixteenth-note step its time puts it (a triplet's on
    the nearest), a chord's notes on one step, how hard on the step; the
    drums on GMS's drum track by the General MIDI numbers it reads; the
    timpani on its toms (GMS has no pitched drum); the tempo; a song played
    twice written out twice (GMS has no repeat).
  - A GMS note sounds for its track's length, not the note's: an instrument
    that holds a note (strings, winds, brass, organ, choir) is set to the
    part's notes, so short ones do not run together; a struck or plucked one
    rings half a second past them, up to its GMS preset's length.
- Tests: `tests/music.js` (167: the band's and the orchestra's projects --
  the file's format, tracks, instruments, steps, drum numbers, lengths; the
  button in Chat and the Music tile); `tests/browser/gms_e2e.py` (new: the
  standalone Generative_Music_Studio.html loads Lantern's projects with its
  own Load -- every track, every note's sound made, its mix not silent; give
  it the path to GMS).

## 1.23.1 — A piano page read with its bars adding up (2026-11-03)

Adam's second test piece -- a piano arrangement in B major, with the words
printed under the right hand -- "came out with some recognizable notes with
the timing of playback not quite correct". Every bar but one was read as
longer than 4/4 (some as two or three bars long), so each played its notes
squeezed into a bar's time, and three bars were said to have no left hand.
What the reader took for music that was not, and what it missed:

- **Words under the music**: a hyphen between syllables was read as a half
  rest. A half or whole rest is now only read inside the staff -- so are not
  the dotted line of an octave sign under the left hand, or a beam's end
  under the staff.
- **Ties**: the middle of a short tie, thick where it bends, was read as a
  whole note; the start of one, cut short by the staff line taken out, as a
  dot. A note with no stem close between two notes is a tie's middle; a dot
  is small and round, and sits close after its note, not halfway to the
  next. And a note tied to the next at its pitch is now **held, not struck
  again**: the melody line writes it "-" (16 ties on Adam's page).
- **Beams inside the staff** (high notes with their stems down): a bar of
  them made one staff line's band look ten rows thick, and the beams were
  taken out with the lines -- the sixteenths read as quarters, and that
  line's key signature short of a sharp. A staff's line thickness is now
  never more than the middle one's and two.
- **Rests**: a sixteenth rest (as tall as a quarter rest, its foot a thin
  stroke) is read; an eighth rest whose ball was taken for a head, and the
  dot after it, is a dotted eighth rest; a lone sixteenth's two flags run
  together, where the bar's length says so, are two.
- **Two voices on a staff**: a left hand's quarters over its whole notes (or
  a right hand's tune over a line of its own) made the bar twice as long. A
  bar that reads too long is now the voice that fills it -- the stems up for
  a tune, the stems down or the whole notes for a bass; a whole note in a
  chord keeps its own length.
- A beam's end under the staff, taken for a note whose stem was the note
  above's, is not a note.
- The bars with no left hand are named as the time signature's doubts are
  (bars 7 and 9, not "7–9" for two bars apart).

Adam's page now reads 15 bars of 4/4 with every bar adding up and the
chords from the left hand in every bar. Tests: a piece written for them,
`piano_b_lyrics_900.png` (MusicXML in `expected.json`: words with hyphens,
ties, dotted rhythms, beams inside the staff, a sixteenth rest, a dotted
eighth rest, an octave sign, a left hand in two voices) -- every note, length
and rest, its chords, its three ties (`tests/browser/sheet_read_e2e.py`);
the earlier sheets read as before.

## 1.23.0 — Every player's part, for a class; the drums kept (2026-11-03)

Adam: “We should have another button to export all the sheet music pieces
that all the instruments would have to play for a band or orchestra for a
class that a teacher could give to the students. We should include drums
also as those seem to be missing from some of these pieces.”

- **Save parts** (Chat's song card and the Music tile, MUSIC_PARTS): a PDF
  to print, letter size -- the score first (every part as it sounds, “in
  C”; the staves of a bar lined up), then each player's part on pages of
  its own, written as that player reads it:
  - in its clef (a viola's alto clef, a cello's, bassoon's, tuba's and
    timpani's bass clef; a piano's or a harp's by where its notes lie) and
    key: a clarinet or trumpet in B♭ a tone above it sounds, a horn in F a
    fifth, an alto sax a sixth, a guitar and a bass an octave;
  - the notes a player starts together on one stem, beamed and tied as the
    lead sheet is (1.22.10), each note spelled the way the tune wrote it or
    the chord gives it (E7/G#'s G#, not A♭);
  - bar numbers, the sections' letters (A, B, C, D) with how loud each comes
    in (p, f), a stretch of bars' rest as one bar with its number, the
    chord names over a band's tune and chords, “Play 2 times” and the
    repeat sign for a song that repeats;
  - **the drums** on a percussion staff: bass drum in the bottom space,
    snare in the third, hi-hat and cymbals over the staff with x heads.
- **Save MusicXML**: the same parts for MuseScore, Finale, Sibelius or
  Dorico -- each part's transposition, clef and key, ties, triplets, chord
  symbols, rehearsal letters and dynamics; the drums unpitched, each on its
  General MIDI key.
- **Drums kept in an orchestra** (MUSIC_ARRANGE, MUSIC_SONG): a song whose
  style has drums (rock, pop, march, reggae, or a drums line) keeps them as
  a player of its own -- the beat in the soft and full passes, a crash where
  everyone comes in, none in the introduction; Save MIDI puts them on the
  drum channel (10). Every band style now has its drums (MUSIC_BAND): a
  ballad's and a waltz's soft kick and hi-hat, folk's snare on 2 and 4.
- **A rock guitar's power chord on the chord's root** (MUSIC_BAND): built on
  the note after a slash, E7/G# played G# D# against the tune's D.
- The PDF writer takes the producer's name (`Lantern.pdf.searchable(pages,
  {producer})`).
- Tests: `tests/music.js` (162: the parts of a rock band and of an orchestra
  with its drums, each bar adding up; transpositions, clefs and keys; E7/G#
  spelled; the MusicXML well formed, every bar four quarters, the clarinet's
  transposition, the drums unpitched; Save parts and Save MusicXML in Chat's
  card), `tests/browser/music_e2e.py` (Save parts gives a PDF of the score
  and each part for Frère Jacques -- horn, brass, tuba, drums; Save MusicXML a
  well-formed file).

## 1.22.10 — The sheet music written as the song plays (2026-11-03)

Adam: the song Lantern made from the Final Countdown screenshot sounded
right, but the sheet music drawn under it looked wrong for 4/4 -- some bars
seemed to hold the wrong number of notes. The notes were placed by time
alone, so two sixteenths sat on top of the note after them and read as a
chord; two sixteenths beamed after eighths got no second beam and read as
eighths; and a length with no single written note (five sixteenths, a beat
and a half of rest) was drawn as the nearest one.

- **Each note and rest is a length that can be written** (MUSIC_SCORE): a
  note too long for one is tied (five eighths: a half and an eighth; five
  sixteenths: a quarter and a sixteenth); a rest is written from the beat it starts on (a
  quarter and an eighth); a third of a beat is a triplet's, with a 3 over it.
- **Beams as a player reads them**: eighths share a beam across half a 4/4
  bar, but a beat with sixteenths (or triplets) in it is beamed on its own;
  a second beam joins sixteenths, a short one marks a sixteenth beside an
  eighth; 6/8, 9/8 and 12/8 by the dotted quarter.
- **Room for every head**: notes and rests spaced by how long they last, a
  sixteenth about two thirds of a quarter's room, more for a sharp or a dot;
  fewer bars to a line when a bar needs it. The moving line follows the
  notes where they are drawn.
- Tests: `tests/music.js` (152: Adam's song's bars add up as written, its
  sixteenths and rests, a tied note, every note at least 12 px from the
  last).

## 1.22.9 — A song of its own; a block you write, made as written (2026-11-03)

Adam's next trial: the Final Countdown screenshot read (1.22.8) and played,
then arranged for orchestra -- then “make your own song in this same style
and feel”. The 35B wrote a new tune, The Dawn Breaker; Lantern sent it back
for not being the song made before (it took any question after a song as
“keep the tune” unless it asked to change the melody), and the AI wrote the
old tune again under the new title. Adam pasted the AI's own block back to
hear it: Lantern gave the AI the song so far instead, and the old tune was
made again.

- **A new song in the same style is a new tune**: “your own song”, “in the
  same style and feel”, “a new piece like it”. The AI is told to keep the
  key, time, tempo, style and sound (and arrange) lines and write a title,
  melody and chords of its own; the old melody under a new title goes back.
- **A MAKE MUSIC block you write in Chat is made as you wrote it** (on one
  line, as Chat's box takes it, its lines found by their first words): the
  AI is given it to write again, and a song with another tune goes back with
  your lines.
- Tests: `tests/music.js` (151); `tests/browser/sheet_read_e2e.py` (a new song
  in the same style after the orchestra; a block written on one line).

## 1.22.8 — A page on a dark ground; a picture not read is said (2026-11-03)

Adam pasted a screenshot of a piano sheet in a PDF viewer -- the page on the
viewer's dark grey -- and asked Chat to make it a playable song. The song
made did not match the picture. Lantern had read nothing: the grey's rows
were ink across most of the picture, so no staff line was found. Nothing was
said, and the 35B (which sees the picture, but cannot read its notes
reliably) wrote the example melody from Lantern's own MAKE MUSIC guide four
times under the printed title -- with every other line of the guide too,
an orchestra and its form among them.

- **The page cut out of a dark ground** (SHEET_MUSIC_SONG): the columns
  mostly paper, then the rows mostly paper between them, cut only when what
  is left out is dark. The same sheet, cropped, had read note for note
  before; now the viewer's screenshot does too (12 bars, its chords as
  printed).
- **A picture not read is said.** When pictures go with a question asking
  for them as music (“make this into a playable song”, “play the sheet
  music”) and Lantern reads no music in them, the person is told, and the
  AI is told not to write a tune as the picture's -- to say Lantern could not
  read the notes and ask for a closer picture of the page alone. A song made
  anyway goes back; saying so is not sent back for having no MAKE block. (A
  song about a picture is another question.)
- **The guide's example tune goes back** when a song is made of it, unless
  the question gives those notes.
- **An orchestra nobody asked for goes back** (leave out the arrange and form
  lines), unless the question asks for one or to arrange it, or the song so
  far was arranged. The guide now says the arrange and form lines are only
  for when the person asks.
- Tests: `tests/music.js` (149: the example tune, the unasked orchestra, a
  picture not read); `tests/browser/sheet_read_e2e.py` (ode_viewer.png, the
  piano Ode on a PDF viewer's dark ground, made by make_sheets.py; Chat with a
  picture that has no music in it). Adam's screenshot stays local (a
  copyrighted song).

## 1.22.7 — The time signature as printed; the AI given the notes alone (2026-11-03)

Adam's next test: a 12/8 piece in G minor (a melody staff resting over a
piano). Lantern read it as 4/4, and the note Chat showed was full of
“bar 4 adds up to 52 beats, not 4”. He asked whether that helps the AI,
and what Lantern was disagreeing with -- a reader should report what it read.
It was Lantern checking its own reading against a time it had guessed from
what most bars added up to; it never read the 12/8 printed after the key, so
almost every bar looked wrong, and the AI, handed the list, “corrected” the
music.

- **The time signature is read as printed**: the digits after the key (12/8,
  6/8, 3/4, 5/4, 6/16 ...), a C for 4/4 and a C struck through for 2/2. The
  digits are read the way Text Reader reads letters -- Lantern draws 0 to 9 in
  the computer's bold serif fonts and compares their shapes -- with their
  holes counted (a 6's low, a 9's high, an 8's two; a 6 curled shut on itself,
  as MuseScore 4's Leland draws it). Read on the first line of music only;
  where the digits leave two readings close, what the bars add up to chooses;
  with none printed, the bars decide as before. Adam's sheet now reads 9 bars
  in G minor, 12/8, its left hand exact.
- **The AI is given the notes alone.** Bars Lantern read too much into are
  said once, for the person, in plain words (“the rhythm of bars 1, 2 and 4
  is unsure: more was read in each than a bar of 12/8 holds”); each still
  plays in a bar's time. Lantern's doubts are no longer in the AI's prompt --
  it cannot see the picture to put them right.
- A singer's staff resting through the piano's lines gives way to the piano,
  and a small staff over a piano's (its spaces narrower) is joined to it; a
  staff on its own with no note on it is not the tune.
- A beam below the staff rising to its last note is no longer read as a note
  under the staff (and that note no longer taken for its flag).
- MAKE MUSIC takes any time the reader reads (up to 16 beats; 2, 4, 8 or 16).
- Tests: `tests/music.js` (146: the bars named once, a 12/8 reading's lines);
  `tests/browser/sheet_read_e2e.py` (every sheet's time read from its digits;
  barcarolle_g_piano_900.png, a 12/8 piece written for the tests, and
  jig_d_900/760.png, a 6/8 tune engraved in Leland, made by make_sheets.py;
  Chat gives the AI the notes and the person the doubts). Adam's sheet stays
  local (a published arrangement).

## 1.22.6 — A PDF of printed music (2026-11-02)

Adam opened a PDF of Ode to Joy for clarinet (a Sibelius file from IMSLP)
in Lantern: it loaded, but neither Lantern nor the AI knew it was music. A
music program's PDF has no picture in it -- its staff lines and stems are
drawn as lines, and its notes, clefs, rests and sharps as letters of a music
font -- so Text Reader took its "words" (nonsense) and there was no page to
read music from.

- **A PDF page drawn as it looks** (PDF_DRAW, new): the page's drawing
  program -- lines, curves, fills, line widths, dashes, colours, clipping,
  forms and pictures -- and its words in the fonts the PDF carries, from the
  fonts' own outlines: TrueType (and CID-keyed TrueType), CFF (Type 1C, and
  CID-keyed), Type 1 (decrypted; flex, accented letters) and Type 3; a font
  the PDF does not carry is drawn in the browser's nearest, spaced by its own
  widths. No library: it stays offline.
- **Music PDFs read as music**: in Chat (the page button, dropped or pasted,
  or the picture button), the Music tile (Open a picture or PDF of music) and
  Text Reader (This PDF is printed music: Read the music). The pages with
  staves are drawn and read as one piece; the AI is shown the pages and given
  the tune's lines; the title comes from the PDF's own words.
- **A part for a transposing instrument is given as it sounds**: a clarinet
  or trumpet in B♭ (a whole step lower), a horn in F, a saxophone in E♭,
  a clarinet in A, named above the music. Adam's clarinet part, printed in E
  major, plays in D major as the orchestra hears it.
- The Sheet Music Reader: a staff of its own (a part's, in any clef) is a
  tune, not a left hand; a first or last bar with nothing read in it (a
  part's rest under another instrument's cue notes) is a bar still; the minor
  key's raised seventh is known by its letter (C# minor's B#, not a C), and
  how long the tune holds each key note helps choose major or minor.
- Text Reader draws a PDF page that has no picture and no words of its own,
  and reads it like a picture.
- Tests: `tests/music.js` (144: transposing parts); `tests/browser/sheet_read_e2e.py`
  (ode_clarinet.pdf, made by make_sheets.py: drawn, read as it sounds, in
  the Music tile, and in Chat dropped and through the page button);
  `tests/browser/text_reader_e2e.py` (fonts_tt_t1.pdf, fonts_cff.pdf,
  fonts_web.pdf, made by make_pdfs.py: each font kind drawn and read back).
  Adam's PDF stays local (not committed).

## 1.22.5 — A song's sheet: a voice over a piano (2026-11-02)

Adam tried two more pieces after 1.22.4 played his E minor piece well. One
was a song's sheet -- a voice with its words over a piano, in B major -- and
it came out with 18 bars where there are 10, in E major, and with most of
its chords chosen by Lantern rather than read.

- **A song's sheet is one tune.** The staves of a line of music are joined
  at their left end; with a voice over a piano's two staves, Lantern read the
  voice and the piano's right hand as two stretches of tune, one after the
  other. Now the tune is the voice's, and in a bar where the voice has no
  note (the piano's introduction, a bar's rest) the right hand's; the left
  hand gives the chords, bar for bar. A voice's bar of rest that is not seen
  (a small picture's whole rest) still takes its place.
- **The key signature as a row of one kind.** Five sharps were read as four
  (the first too blurred to know), as none on the left hand's staves, and on
  the voice's staff a sharp was taken for a common-time C. Now the row of
  sharps or flats after the clef is counted whole, those too blurred to know
  where their kind would sit; with none known (a small picture's blots),
  where they sit says which kind they are.
- **A sharp touching its note** (a small picture's) is cut from it where the
  least ink joins them -- not the left half of a chord's open heads, which
  hold on by every rim.
- Small pictures: the picture of the song is very small (its staff lines
  4.4 pixels apart), and many of its bars' lengths are still not read. The
  test piece reads note for note down to about 5 pixels; Lantern says when a
  closer picture would read surer.
- Tests: `tests/music.js` (142: a song's staves grouped by the line joining
  them); `tests/browser/sheet_read_e2e.py` (voice_e_piano_900.png, a song
  written for the tests: the tune from the voice and the right hand, the key,
  the chords). Adam's picture stays local (not committed).

## 1.22.4 — The Sheet Music Reader on a piece it did not know (2026-11-02)

Adam checked the reader with a piece other than the Ode: a piano sheet in E
minor with a melody of sixteenths and eighth rests over a left hand of
chords. It was close in places and far off in others -- the key read as G
major, the last bar's left hand lost, rests a beat too long, and the
sharpened chords (D to D#dim, B with its D#) read as other chords.

- **The key's mode from the left hand too**: where its first and last notes
  sit, and a raised seventh in it, with where the tune ends -- E minor, not
  G major.
- **Sharps, flats and naturals first**, taken out of the ink before the notes
  are read: a sharp just before a chord's note made heads of its own, moved
  the note's, and lent it a stem. Each one belongs to the note at its height
  after it (in a chord, the others are not sharpened). A tie running into a
  sharp is cut off it; a flat's bowl must be at its foot (a note with its
  stem down is not a flat).
- **A note tied over the bar line keeps its sharp** (the B chord's D#).
- **A bar line running on to the other staff** is a bar line even with a
  tie across it, and a key signature ends where its sharps stop standing
  close together (a left hand's first chord's D# is not a second sharp in
  the key); a key's sharp blurred past knowing, close after one, is another.
- **The notes**: eighth rests are two spaces tall in some fonts (they were
  read as quarter rests); two beams the picture ran together still count as
  two (sixteenths, not eighths); a tie lying along a staff line no longer
  hides the last line's left hand; a stack of whole notes is a chord, not
  notes with stems or a beam; a head found twice, half a space apart, is one
  (and the note between two such doubles is kept); a beam below the staff
  is not a note on a ledger line; a tie's end is not a rest; a repeat bar
  line is a bar line.
- **The chords**: a minor key's raised seventh chord (D#dim in E minor), and
  a bass spelt as its chord has it (E/G#, not E/Ab).
- Tests: `tests/music.js` (141: the mode from the left hand, D#dim, E/G#);
  `tests/browser/sheet_read_e2e.py` (75: minor_e_piano_900.png and _760.png,
  a piece written for the tests -- every note, the key E minor, the chords).
  Adam's picture stays local (not committed).

## 1.22.3 — The orchestra's MIDI file, ready for a DAW (2026-11-01)

Adam took an orchestral song's MIDI file into a DAW: a named track and a
channel for each player, the General MIDI instruments, tempo, time and key
were there -- but every track came in at the same level and in the middle,
and the soft and full passes differed only by velocity.

- **Each track starts with its level in Lantern's own mix** (volume, CC7):
  the tune 100, the cellos 84, the second violins and violas 74, the
  doublings of the tune (flute, oboe, trumpet) and the held chords (horns,
  clarinet) lower -- as Lantern plays it.
- **Its seat** (pan, CC10), as an orchestra sits: first violins left, second
  violins left of centre, violas, cellos and double basses to the right,
  horns left, trumpets right, woodwinds and timpani in the middle. Brass,
  winds and a string quartet sit their own way.
- **The instrument's name** on each track, with its player's name.
- **The soft and full passes on expression** (CC11: 100 and 127) as well as
  velocity.
- **For orchestral sample libraries** (a setting in Music, under Make a song;
  Chat's Save MIDI follows it): the dynamics on the mod wheel too (CC1: 60
  soft, 100 full), and a held instrument's line overlaps each next note a
  little (legato), never the same pitch again. Off by default: on a plain
  General MIDI player the mod wheel is vibrato.
- Tests: `tests/music.js` (138: each track's level, seat and dynamics, the
  library setting, legato only for held lines).

## 1.22.2 — An orchestra starts at the start (2026-10-31)

Adam's trial of 1.22.1: an orchestra's song seemed to start on the second
line of music, and at other places after Stop and Play.

- **The introduction is a lead-in, not the tune's last phrase.** It played
  the end of the tune first, so the music -- and the moving line, which went
  to that phrase on the score -- seemed to start in the middle. Now it is the
  key's chord and its dominant seventh, held quietly (the orchestra's over a
  timpani roll into the tune), and the tune starts at its first bar. The line
  waits at the first bar through the introduction.
- **The card says which part is playing** -- Introduction, The tune, softly,
  Everyone, The last chord -- since an orchestra plays the tune twice and the
  line goes back to the start for the second time.
- Tests: `tests/music.js` (133: the introduction's chords, no tune in it,
  where the line stands).

## 1.22.1 — Another sheet: a banner, a long bar, a beam on a line (2026-10-31)

Adam's trial of 1.22.0 with two more screenshots. The orchestra worked, but
Lantern misread both sheets, and then sent the AI back again and again for
copying its lines exactly:

- **A song copying the lines exactly is never sent back.** A bar read too
  long ("bar 2 adds up to 8 beats") is written as a bar of the lines, which
  plays its notes in a bar's time; Lantern then compared the AI's song with
  what it had read, not with what its own lines play, so a perfect copy went
  back with "the melody is not the one Lantern read" -- on both of Adam's
  sheets. Now the check is against the tune as the lines play it.
- **A banner across the music** (a web page's "Buy & Start Playing" over a
  preview) is left out as paper and said: "a band across the picture covers
  some of the music: notes under it are not read". It had stopped the bar
  lines of the music above it from being found (one bar of 18 beats), and
  added a note that was not there.
- **Bars with no left hand in the picture** (covered, or cut off) get chords
  Lantern chooses from the tune, each run of them as one stretch, and the AI
  is told which bars those are.
- **The left hand's chord notes** are used, not only its lowest: C with A
  over it is F/C, not C.
- **A beam lying along a staff line** made that line look thick, and the
  beams were taken out with the lines: the eighths were read as quarters.
  The line is now the rows that run furthest.
- **A treble clef in pieces** (cut by the staff lines taken out) was taken
  for a bass clef, so the first line of music was dropped. A piece that
  reaches past the staff is a treble clef's.
- **A wide, leaning open note** found a little low is checked from its own
  middle.
- Tests: `tests/music.js` (132), `tests/browser/sheet_read_e2e.py` (65
  checks, a thirteenth sheet: the piano Ode with a banner across its second
  left hand, made by make_sheets.py).

## 1.22.0 — An orchestra plays it (2026-10-31)

Adam's trial of 1.21.2: Lantern read his Ode to Joy, named it and the 35B made
it right, chords and all. Then he asked "Can you fill in the missing pieces of
the song with an orchestra?" The 35B asked whether to go ahead, wrote an
arrangement in prose -- the second violins, violas, cellos and basses all the
tune moved down, the basses walking E D C B under G7 -- and, asked to use
Lantern's tools, said they could not make an orchestral file. It was half
right: Lantern had the instruments but a song could only name three of them,
and nothing to write a second part.

- **arrange orchestra.** One line in MAKE MUSIC (or strings, string quartet,
  brass, winds) and Lantern writes every player's part from the melody and
  chords, correct by construction (MUSIC_ARRANGE): the inner voices are notes
  of each chord, below the tune at every moment and above the bass, each the
  chord's nearest to the one before, the third always there and the seventh
  when the chord has one, no fifths or octaves moving in parallel; the bass is
  each chord's bass note, moving root to fifth when everyone plays; every part
  in its instrument's range. The orchestra's twelve players: flute, oboe,
  clarinet, bassoon, horns, trumpet, timpani, first and second violins,
  violas, cellos, double basses. The form: an introduction (the tune's last
  phrase on the oboe over the strings), the tune softly on the strings, the
  tune for everyone (violins, flute, oboe and trumpet on it, horns and
  clarinet in the chords, the timpani), and the last chord held over a
  timpani roll; `form intro soft full coda` changes the order.
- **Timpani** (Lantern's own, CC0): a kettle drum's membrane modes, tuned to
  the key note and its fifth.
- **Parts of the AI's own**: `part viola: E D C D | ...` -- or the way the 35B
  wrote them, `Violins II: C4 C D E | ...` -- checked against the chords (a
  long note a half step from one goes back), the instrument's range and the
  tune's bars, and played for that player.
- **Save MIDI** has a track for each player, in score order; Play and Save WAV
  play every part at its own share of the mix.
- **Questions after a song** (MUSIC_CHAT): a question about a song made earlier
  in the chat is given that song as it was made, with how to have an
  orchestra play it, and the MAKE MUSIC instructions; the new song keeps the
  earlier melody unless the question asks to change it. "Fill in", "arrange
  ... for", "orchestra", "string quartet" are music questions now, and a song
  for an orchestra with no arrange line goes back with the line to add.
- **A reply with no block** where Lantern can make what was asked (Chat's new
  hook, Lantern.chatNoBlock): one that asks whether to go ahead, says Lantern
  cannot, or writes the parts out in prose goes back once, with the block to
  write -- the song's own lines and `arrange orchestra`.
- The Music tile: Ode to Joy for orchestra among the examples. The bench: the
  Ode arranged for orchestra (28 make questions).
- Tests: `tests/music.js` (130: the arranger's voices, ranges, parallels,
  timpani, form, parts, MIDI tracks; Adam's two questions replayed in Chat),
  `tests/browser/sheet_read_e2e.py` (60 checks: the same questions after the
  pasted sheet), `tests/ai_isolation.js` (147 modules).

## 1.21.2 — Lantern knows the tune; small screenshots read right (2026-10-31)

Adam pasted a second screenshot of Ode to Joy, this one with no title -- only
"Ludwig van Beethoven" printed at the top right. The 35B called the song
Für Elise (a guess from the composer), and the last part had a few wrong
notes, different from the first time.

- **Lantern knows famous old tunes by their first notes.** A new module,
  MUSIC_TUNES, holds the openings of 26 public-domain tunes (Ode to Joy,
  Für Elise, Twinkle Twinkle, Frère Jacques, Jingle Bells, Greensleeves,
  Minuet in G, Amazing Grace ...), matched by the steps between notes so any
  key works, after up to three notes of introduction; a tune that is only a
  scale is not one. A sheet read with no title printed gets the tune's name:
  Chat tells the AI "Lantern knows the tune by its first 13 notes: Ode to Joy
  (Beethoven (Symphony No. 9), 1824)" and gives it a `title` line; with no
  name the AI is told to use words printed above the music or call it Sheet
  music, not to guess a famous piece from its composer. The Music tile's
  reader shows the name too.
- **A song with another name goes back.** When Lantern has the name (printed
  above the music, or a tune it knows), a song titled otherwise is sent back:
  "the song is called “Für Elise”, but Lantern knows the tune as
  “Ode to Joy”: write MAKE MUSIC: Ode to Joy". Other words for it pass
  ("Beethoven's Ode to Joy (piano)").
- **The last part's wrong notes.** At this screenshot's size (staff lines 6.75
  pixels apart) a piece of the beam joining two eighth notes was read as a
  whole note D5; a note with no stem must now stand alone. Read right now on
  both of Adam's screenshots, all 12 bars, with the left hand's chords to the
  end: `... | G7 E7/G# | Am G` (the G# touching its sharp, and the natural
  touching its G, are read now).
- **More of the reader, at screenshot sizes** (staff lines 6 to 7 pixels
  apart): a flag and a head in one patch split by height and place; a key
  signature's flat whose stem and bowl came apart, and a natural whose two
  strokes did, joined again; a lone stroke is not a flat; ink taken as a
  note's sharp is not a whole note of its own; a head with its accidental
  touching it is found at its right part, with its stem; a piece of a whole
  note's rim cut off by the staff lines is not a rest; a note just after a bar
  line no longer hides the bar line (only ink running on from the line counts
  as its head); a wide, open whole note is not taken for a rest; the first
  note of a staff with no time signature is not taken for one. 46 of 49 test
  sheets at 700 to 1300 pixels wide read note for note (all from 760 up).
- Tests: `tests/music.js` (106: the tune finder, the title check),
  `tests/browser/sheet_read_e2e.py` (58 checks: three sheets at screenshot
  sizes, the 35B's "Für Elise" sent back), `tests/ai_isolation.js` (145
  modules).

## 1.21.1 — The left hand's chords, the heading's title (2026-10-31)

From Adam's trial of 1.21.0 with the 35B: Lantern read his Ode to Joy
screenshot and the 35B copied the tune into MAKE MUSIC on the first try --
the song matched the sheet note for note. Two of its lines were still guesses:
the title ("Lantern's Sheet Music Reader") and the chords (C | G | F | C ...
of its own, so bar 4's D D sat over C), while the sheet's left hand plainly
plays C | G | C | G ... and G C in the last bars.

- **Chords from the left hand.** Piano music's bass staves are read too, bar
  for bar against the tune's, and each bass note (or each half bar of a busy
  bass) becomes the chord of the key -- or one leading to a chord of the key,
  like E7 to Am -- that has it in it, best as its root, with the most of the
  tune over it: `chords C | G7 | C | G | C | G7 | C | G C | G C | G7 C | G7 C |
  G C` for the test Ode, and on Adam's sheet the same until bar 11 (its G#
  touches the sharp in front of it, so that bar keeps G). A bass note G#
  under E and D is E7/G#. The AI is given the chords line with the tune, and
  a song with chords of its own goes back: "the chords are not the ones the
  left hand plays in the picture (bar 3 has C): write the chords line exactly
  as read". The same root passes (G for G7).
- **A note beyond the staff needs its ledger lines**: the "p" printed
  between Adam's staves was being read as a whole note.
- **The title from the heading.** Text Reader reads the strip above the
  music; the biggest line in the middle is the title (a composer's name at
  the side is not), given to the AI as a `title` line and shown in the
  Music tile's reader. Only what it reads surely: on Adam's sheet the display
  capitals come out with an Omega for the O ("[Omega]DE TO JOY"), so no title is given there and the AI is
  told to title the song with the tune's name, not Lantern's.
- Tests: `tests/music.js` (99), `tests/browser/sheet_read_e2e.py` (45 checks:
  the chords of the piano sheets, a sheet with its title and composer, and the
  35B's 1.21.0 reply sent back for the chords), a ninth test sheet.

## 1.21.0 — Chat reads sheet music (2026-10-31)

Adam pasted a screenshot of Ode to Joy into Chat and asked it to read the music
and make a playable file. The 35B made out the title, said it could not see the
picture, and wrote the tune from memory: right for eight bars, then a third
phrase that is not Ode to Joy, the 4th bar's dotted rhythm evened out, and a
4-bar chord loop repeated under 15 bars whose clash it never fixed. Lantern had
the Studio's sheet music reader in the Music tile, but Chat never ran it, it
read pitches only, and on that screenshot (staff lines one pixel thin, seven
apart) it found no staves at all.

- **The Sheet Music Reader reads songs** (SHEET_MUSIC_SONG). Note lengths --
  filled or open heads (judged in grey, so a small half note's hole counts),
  stems, flags and beams counted from the ink joined to the stem's tip, dots,
  whole notes -- bar lines, rests (whole, half, quarter, eighth), the clef, the
  key signature and the time, and accidentals that last their bar. A picture
  is first enlarged until its staff lines are 16 pixels apart, with the ink cut
  eased until thin lines hold; a short last line of music is found too. What
  only looks like a note is set aside: a flag's curl, time-signature digits, a
  rest, a bar line's edge. The tune is the treble staff's top notes. The
  reading is written as MAKE MUSIC lines -- `key C major`, `time 4/4`,
  `melody E4 E F G | ... | E - - D D - r -` -- with an octave only where
  Lantern would otherwise place a note elsewhere.
- **Tested on engraved sheets** (tests/fixtures/sheets, made with Verovio from
  public-domain tunes and our own): Ode to Joy (alone and for piano, with
  rests), Twinkle in G, a waltz in F, a tune in B flat with whole and half
  rests, Frere Jacques in D with eighths, a tune in A minor with G sharps.
  Read note for note at 7 and 11 pixels a space, most at 5.5; Adam's
  screenshot reads all 12 bars right. A picture smaller than 6.5 pixels a
  space is read with a note that a closer picture reads surer.
- **Chat reads pasted music** (SHEET_MUSIC_CHAT), whether the AI can see
  pictures or not, and gives the AI the lines as read with MAKE MUSIC, so the
  least it can write is the right tune. The song it makes is checked against
  the reading, note for note and length for length; a tune from memory goes
  back with the lines. A question about a picture of music is offered MAKE
  MUSIC even when it does not say "play".
- **A chord that repeats under a longer melody** and clashes says where to
  write it: "(bar 15 plays the chords line's bar 3 again: write a chord for
  each of the 15 bars, or leave the chords line out and Lantern chooses
  them)" -- the 35B's 4-bar loop under 15 bars could not be fixed by changing
  one chord it never wrote.
- **The Music tile's reader** shows the tune as song lines with **Make a
  song from it**, which opens it in the Make a song card to play on any of
  the 57 instruments. Its pitch view now reads small screenshots too.
- Tests: `tests/music.js` (96), `tests/browser/sheet_read_e2e.py` (the eight
  sheets, Chat with a model that sees and one that does not, the 35B's reply
  sent back, the Music tile), `tests/ai_isolation.js` (144 modules).

## 1.20.0 — Real instruments for songs (2026-10-30)

Adam asked to borrow the sound of his **Generative Music Studio** so Lantern's
songs sound like instruments, and so the AI can choose among them. 1.19's songs
played on a few oscillators each; 1.20.0 plays them on the Studio's instrument
engines, and the AI writes which instruments play the tune, the chords and the
bass.

- **57 instruments, carried over from the Studio** (given by their author to
  Lantern under CC0): piano with stiff-string inharmonicity and a soundboard,
  electric piano, harpsichord, Hammond organ (full and jazz drawbars), acoustic,
  nylon and electric guitars, concert and celtic harp, koto, four basses
  (electric, upright, synth, slap), violin, viola, cello, contrabass and a
  string section (Helmholtz bowing, body resonances), trumpet, trombone, French
  horn, tuba, brass section, concert/alto flute, piccolo, recorder, pan flute,
  shakuhachi, ocarina, clarinet, bass clarinet, oboe, bassoon, four saxophones,
  harmonica, accordion, melodica, glockenspiel, vibraphone, celesta, chimes,
  church bell, marimba, xylophone, kalimba, balafon, choir (aah, ooh), solo
  voice, synth lead and pad. The engines are ported to ES5 unchanged in what
  they compute (checked sample for sample against the Studio's own), each in
  its module (MUSIC_INST_*), and the Studio's **drum kit** (kick, snare,
  hi-hats, clap, rimshot, toms, crash, ride, 808 boom) replaces 1.19's.
- **The notes are made before the song starts.** Each pitch of each instrument
  is computed once (a held note as long as its longest note, a struck or
  plucked one as long as it rings), in background workers -- one for each
  spare core -- and kept for the next play (MUSIC_SAMPLER). Play says
  "Preparing the instruments... 40%", then plays; a short song is ready in about
  half a second. Save WAV does the same. Where the notes cannot be made, 1.19's
  quick voices still play. The song's last notes ring out.
- **The AI chooses the instruments by name.** `sound violin` (the tune),
  `backing piano` (the chords), `bass upright` (the bass), or all at once:
  `sound violin and piano`, `melody (violin):`, `chords (harp):`. `backing
  off` and `bass off` leave a part out. Each style keeps its own band unless
  told otherwise: a ballad's piano and upright bass, folk's guitar, a march's
  brass and tuba, rock's electric guitar, reggae's organ, pop's electric piano.
  The AI's prompt lists the instruments by family; the How to write it help in
  Music shows the same.
- **Mistakes caught by design.** A melody moves by octaves into its
  instrument's range (down two octaves for a tuba, said), and the chords and
  bass into theirs; a tune wider than its instrument plays goes back with the
  note and the fix ("bar 1's C4 (C5) is below it -- write that part an octave
  higher, or choose an instrument that plays it all"). An instrument the
  question names must play: "a waltz for violin and piano" with the tune on
  the flute goes back with "write sound violin (the melody's instrument) or
  backing violin (the chords')"; one instrument asked for a tune ("on the
  cello") plays the tune. A bass line, a lead, the keys or a horn section are
  not taken as instruments. An instrument Lantern does not have is said, and
  the flute plays.
- **MIDI files** carry each part's General MIDI program (violin 40, upright
  bass 32 ...) and the new drums.
- **The bench** has a third song: *a gentle 8-bar waltz in D major for violin
  and piano* (3/4, D major, 8 bars of tune, the tune on the violin and the
  chords on the piano). The song guide also shows how a dotted rhythm is
  written in shares.
- **The 1.19.1 run (35B, 122 of 123 scored):** the sunset house now passes
  with the roof line Lantern worked out; the tune of its own was sent back for
  its short melody and passed when filled; Ode to Joy failed fairly -- the 4th
  bar was evened out (E D D - for E. D D) and the second phrase ended on B
  instead of D. C C.
- New examples in Make a song: *Little waltz* (violin and piano), Ode to Joy on
  the cello, Twinkle on a music box, Frere Jacques on French horn, Harbour
  lights on melodica.
- Tests: `tests/music.js` (88: every instrument plays a finite, audible note
  at a sane level; names in songs and questions; notes made once and kept;
  sound, backing and bass lines; ranges; MIDI programs; the question's
  instruments; the waltz); `tests/browser/music_e2e.py` (the notes prepared in
  workers, a worker's note against the page's own, the waltz as a WAV);
  `tests/ai_isolation.js` now removes 142 modules in turn, the 12 instrument,
  drum and sampler modules among them.

## 1.19.1 — A tune cut short, a house with no roof (2026-10-30)

From Adam's full bench run on 1.19.0 with the 35B: 122 of 123 scored, both new
song questions passed. Two of those passes were too generous, and the one fail
was a fair grade that Lantern could have prevented.

- **make-music-ode passed, but only half of it was there.** The 35B wrote the
  theme's first phrase in C (the notes right) under 8 bars of chords -- bars 5
  to 8 played chords with no tune -- and evened out the 4th bar (E D D - for the
  theme's dotted E. D D). **make-music-original** did the same: 4 bars of tune
  under the 8 bars of chords the question asked for (its long F# over G was
  caught and fixed). Now **chords that go on well past the melody are sent
  back** with the bars to fill: "the chords go on 4 bars past the melody (bars 5
  to 8 have no tune): write the melody for bars 5 to 8 too, or end the chords
  at bar 4". A bar or two of chords after the tune is an ending, said as before.
  A question's number of bars is now counted on the tune when there is one.
- **The bench** checks Ode to Joy's rhythm as well as its notes (in any note
  values: its 4th bar is a dotted quarter, an eighth and a half note), and the
  tune of its own must itself fill the 8 bars. The run's two song rows would
  now be sent back; as written, both fail.
- **make-sunset-house failed, rightly**: the run-away squares were caught and
  left out, but the corrected picture was a wall with a window and no roof --
  and the model, shown its picture, kept it. **A drawing is now set against
  the question**: a house asked for needs a roof on its wall, and Lantern gives
  the roof to add, worked out from the wall ("no roof sits on its wall (rect 7 6
  6 4 fill brown): add tri 6 6 10 3 14 6 fill red after the wall"); with no wall
  at all, the wall and the roof. A sun asked for needs a sun (circle 16 3 2 fill
  yellow). These come with the first correction, alongside a run-away's.
- A note without an octave keeps a little more room around where the tune
  began (a ninth, not a fifth), so F G A B then D climbs to the D above.
- Re-grading every make row of both 35B runs with 1.19.1: only the two song
  rows change grade; the sunset stays a fail, now with the roof to add.
- Tests: `tests/music.js` (64), `tests/ai_actions.js` (105), from
  `tests/fixtures/bench_run_1190_35b.json` (the run's three rows).

## 1.19.0 — Songs you can hear: MAKE MUSIC (2026-10-30)

Adam asked Chat (the 35B) to "create the note progression from One Love so that
we can hear it". It answered that it "cannot generate audio files or play
music", gave chords and note names as prose, wrote a `MAKE: table` block
Lantern could not read and quoted a library it had not been shown. Lantern had
a Music tile (a keyboard, frequencies, lessons, the Sheet Music Reader) but
nothing the AI could write a song with, and nothing that played one. 1.19.0
adds both, built the same correct-by-construction way as the circuits: the AI
does the fuzzy half (which song, which chords, which notes), Lantern the exact
half (timing, octaves, the band, the sound, the sheet music, the files).

- **MAKE MUSIC.** The AI writes the lines a musician jots down:
  `key E minor`, `tempo 76`, `time 4/4`, `style reggae`, `sound flute`,
  `chords Em | Am | B7 | Em`, `melody B A G E | A - G F# | E - - r`. Only the
  lines it needs: chords alone are played in the style; a melody alone gets
  chords chosen by Lantern; with no key line, Lantern finds the key.
- **Wrong by construction is impossible where it can be.** A note's length is
  its share of its bar (the notes of a bar share it equally, `-` holds one more
  share, `r` rests), so no bar is ever too long or too short and the AI never
  counts beats or writes fractions. A note without an octave goes where the tune
  leads -- nearest the note before, and of a fourth down or a fifth up the one
  that keeps the tune near where it began (Twinkle climbs to G and comes home to
  the same C); a written octave is where it says and never pulls the notes before
  it. A plain letter takes the key's sharps and flats (F is F# in D major; `Fn`
  is natural). Chords: letters and kinds (C, Cm, C7, Cmaj7, Cm7, Cdim, Caug,
  Csus4, C6, C9, Cadd9, C/G ...) or numerals in the key (I IV V7 vi, i iv V
  bVII, V/V). A part's chords repeat under a longer melody; a melody too low or
  high moves by octaves. Everything Lantern added or changed is said.
- **What cannot be right goes back once, with the line to write**: a word that
  is not a note or a chord (with how notes and lengths are written), a note far
  from the rest of the tune, a long note a half step from its chord (with the
  chords of the key that fit it: "write Am or C there"), and a song that is not
  what the question asked -- its key, a waltz's 3/4, its number of bars. The
  correction turn repeats how Lantern reads a MAKE MUSIC block.
- **Lines as models write them** are read: a colon or not, bold, bullets,
  "Melody (violin):", `Em - Am - B7`, `B-A-G-E`, no bar lines (a note a beat),
  `(x2)`, Verse: / Chorus: parts; a stray line is named, not swallowed.
- **The band**: ballad, block, strum, arpeggio, waltz, march, folk, pop, rock,
  reggae (the skank off the beat, the one drop) or none; chords voiced below the
  tune, each voicing nearest the last; bass on the root (or the slash note) and
  its fifth; drums where the style has them.
- **The sound**, made in the browser with Web Audio -- nothing to download:
  flute, piano, organ, strings, bell, guitar, brass, lead, bass and drums.
  **Play** in Chat starts at once and **Stop** is immediate; a red line moves
  along the bars. **Save WAV** renders the song (OfflineAudioContext, 44.1 kHz,
  never clipped); **Save MIDI** writes a standard file (tracks for melody, chords,
  bass and drums; tempo, time and key signatures) for any music program.
- **The sheet music**: a lead sheet -- clef, key and time signatures, notes
  where their time puts them (open heads, stems, flags, beams, dots, sharps and
  flats as the key and the bar need them, ledger lines, ties over bar lines,
  rests in the gaps) and the chord names above; with no melody, a slash a beat.
- **Make a song** in the Music tile: the same lines typed by hand, redrawn as
  you type, kept (music.song), Save MIDI and WAV, How to write it, and examples
  to start from -- two Lantern tunes, Beethoven's Ode to Joy (1824), Twinkle
  Twinkle (1761; Lantern chooses its chords) and Frere Jacques. **Open in Music**
  from Chat brings the song there, with what Lantern chose written in.
- **Chat**: music questions ("create the note progression ... so we can hear
  it", "what are the chords of ...", "play ... for me", "sheet music for ...")
  get MAKE MUSIC and nothing else; an essay on music, an Arduino buzzer program
  or meeting notes do not; sheet music is not a drawing or a table. The greeting
  says songs can be made.
- **Bench**: two make questions (26 in all): Ode to Joy, checked note for note
  by the intervals of its theme's first 15 notes in any key, and an original
  8-bar tune in G major with chords at a walking pace, ending on a note of its
  last chord.
- Tests: `tests/music.js` (59 checks), `tests/browser/music_e2e.py` (Chromium:
  the correction turn, Play and the moving line, Stop, real MIDI and WAV files,
  Open in Music, every example); `ai_actions.js` (ten actions, 26 make
  questions), `ai_layer.js` (version, 26 make questions), `ai_isolation.js` (the
  ten new modules removed in turn).
- Examples and tests use tunes in the public domain or Lantern's own.

## 1.18.1 — The circuit set against the question; pictures painted a square at a time (2026-10-30)

From Adam's full bench run on 1.18.0 with the 35B (120 of 121 scored), and
the two rows he was unsure of.

- **make-pneumatic failed, and rightly.** The question asks for a cylinder
  that "returns by itself when it reaches the end of its stroke". The 35B wrote
  `cylinder C1 double`, `valve V1 C1 5/2 button`, `flow F1 C1 retract`, which
  is a right circuit for another question: C1 extends while the button is held
  and returns on V1's spring when it is let go. Lantern drew that correctly and
  said what it does, but never set it against the question, so the block was
  never sent back. **Now a MAKE PNEUMATIC circuit is checked against what the
  question asks:** a return at the end of the stroke needs a roller the
  cylinder trips when fully out; a cycle ("keeps going back and forth") needs a
  roller at each end; two hands ("both buttons pressed together") needs `and`
  on the second button's line. When the circuit does not do what was asked, it
  is drawn and shown, and goes back once with the line to add:
  "...but it returns only when V1's push button is let go (V1's spring): add a
  roller valve C1 trips when fully out -- roller S1 C1 extended -- and Lantern
  makes V1 hold its position until the roller sends it back". With that one
  line the 35B's block passes. A hold-to-extend question, or a single-acting
  cylinder returning on its spring, is not questioned.
- **make-sunset-house passed, and should not have.** The first reply ran away:
  `rect 9 7 2 2 fill blue` and `rect 10 8 1 1 fill blue` written in turn,
  their x counting up to 52 until the reply was cut off. Lantern's loop check
  only knew one line repeated, so the AI heard "31 lines are off the grid" and
  cut the same strip short at x 20, past the frame -- no roof, and the bench
  passed it because it counted shapes. Now:
  - **two or three lines written in turn are a loop too**, said as one
    problem with the one line that paints their area (`rect 9 7 11 2 fill
    blue`), worked out by Lantern;
  - **six or more small touching rects of one fill and no outline** are one
    area painted a square at a time: questioned, with the one line that paints
    it (a row of outlined bricks is not);
  - **a rect wholly outside the picture** (`rect 20 8 1 1` starts at its right
    edge) is off the grid, and rects are cut to the frame when drawn;
  - **the bench's house needs a roof**: a wall with a tri (or a rect) whose
    base sits on its top. The 35B's corrected block now fails, questioned.
- **The bench row says "2nd try" only when Lantern questioned the first
  reply.** The pneumatic row read "2nd try failed too", but its second round was
  the AI looking at its own picture (it kept it), not a correction. A look is
  now said as "saw its picture and kept it" (or "changed it").
- Re-grading the run's other 22 make rows with 1.18.1 changes nothing.
- Tests: `tests/pneumatic.js` (the 35B's block questioned, the one-line fix
  passing, cycles and two hands), `tests/ai_actions.js` (the period-2 loop, the
  strip, bricks, the frame, the roof), `tests/ai_layer.js` (a saved run's row
  labels), from `tests/fixtures/bench_run_1180_35b.json` (the run's two rows).

## 1.18.0 — Pneumatics, control circuits and electronics correct by construction (2026-10-29)

Adam's direction after 1.17.0: every Lantern module should make mistakes
unlikely by design. The least-effort command any AI writes should give the
correct drawing, and when the AI writes something that cannot be drawn,
Lantern should show it where it went wrong, so its second try is right. The AI
does the fuzzy half (what the question asks for, which parts, what each does);
Lantern does the exact half (ports, wiring, rules, sizes); the bench measures
how well the two work together. 1.18.0 does for pneumatics, control circuits
and electronics what 1.17.0 did for hydraulics, and sharpens the correction
turn for every MAKE block.

- **The correction turn shows the AI how Lantern reads its block.** When
  Lantern questions a block, the AI now gets each problem on a numbered line
  (the line that was wrong, and what to write instead), then the lines of that
  kind of block -- MAKE PNEUMATIC, HYDRAULIC, CONTROL, ELECTRONICS, SCHEMATIC,
  or for any other kind its own instruction lines up to END. A small model that
  has lost the instructions far back in its context has them again where it
  looks. Chat and the bench use the same message (`Lantern.aiAct.fixText`).
- **MAKE PNEUMATIC.** The AI names cylinders, the valves working them and the
  push buttons and rollers whose air signals work those valves: `cylinder C1
  double`, `valve V1 C1 5/2`, `button S1 V1`, `roller S2 C1 extended`, `flow
  F1 C1 extend`. Lantern draws the ISO 1219 circuit, bottom to top: the air
  supply and service unit (filter, regulator, gauge), the supply line to every
  valve's 1, the signal valves, the valves working the cylinders -- ports
  numbered the ISO 5599 way, 4 to the cap end, 2 to the rod end, 3 and 5 to
  exhaust -- and the cylinders, with each roller's mark at the end of stroke
  that trips it. A signal goes to 14 (works the valve) or 12 (returns it); a
  valve signalled both ways keeps its position. Two signals on one side are
  never teed (the air would blow out of the other valve's exhaust): Lantern
  adds a shuttle valve (OR), or a two-pressure valve (AND) when the AI writes
  `and` or one is the cylinder's home roller, and says so. Defaults are said
  (a 5/2 worked by a push button; a 3/2 for a single-acting cylinder;
  meter-out speed control, meter-in for a single-acting extend); what cannot
  work goes back with the line to write (a double-pilot valve nothing returns,
  a pump in an air circuit, three signals on one side). The lines are walked
  as a check, and what each signal does is said under the drawing: "S1 (push
  button) switches V1: C1 extends; S2 (roller, C1 fully out) switches it back:
  C1 retracts". The older MAKE SCHEMATIC pneumatic form is piped too.
- **MAKE CONTROL.** Relays, contactors, push buttons and pilot lights, drawn
  as a US ladder between L1 and L2 (+ and 0 V for DC): `stop PB1`, `start PB2
  M1`, `overload OL1 M1`, `coil M1 "motor starter"`, `lamp LT1 M1 "run"
  green`. Stops in series, starts in parallel with the coil's own holding
  (seal-in) contact, the coil at the right with its overload after it,
  numbered rungs, each coil's contacts listed by rung beside L2. Lantern adds
  and says the holding contact, a stop for a circuit that holds itself in, a
  motor starter's overload, the interlocks between a forward and a reverse
  coil, and a coil a start names; an e-stop, a fuse or one stop for several
  coils is drawn in L1 ahead of every rung. The least a model can write --
  `start PB2 M1` and `lamp LT1 M1` -- is a correct, complete starter circuit.
  The wires are walked: no rung can join L1 to L2 through contacts alone,
  every coil and light sits between the rails, every contact belongs to a
  drawn coil, the holding contact is across its start. Timers (on-delay, their
  timed contacts open or closed), limit, pressure, float and temperature
  switches, solenoids and horns are drawn too. A part/wire block for a control
  question goes back pointing at MAKE CONTROL. The ladder symbols are in
  Draw's Electrical palette.
- **MAKE ELECTRONICS.** `supply "12 V"`, `pin P1 "Arduino D7"`, `relay K1`,
  `transistor Q1 K1 P1`, `led D1 P2 green`, `switch S1 P3`, `sensor LDR1
  P4`. Lantern draws the + rail and 0 V with a branch for each thing powered
  or read, current flowing down, and adds, sizes and says what such circuits
  need: an LED's resistor ((V - Vf) / 15 mA, the next E12 value up), a
  transistor's base resistor (a tenth of the load's current into the base),
  the diode across a relay coil, motor or solenoid a transistor switches
  (cathode to +), a transistor between a pin and a load too big for it, a push
  button's pull-down or pull-up, a sensor's divider, inputs fed from the
  board's own 3.3 or 5 V when the rail is higher, and the board's GND joined to
  0 V. A resistor the AI sizes is checked. The wires are walked as a check.
- **The schematics the AI already writes are checked** (part and wire lines):
  an LED with no resistor gets one, sized and said; an LED resistor too small,
  a short (a switch or ammeter straight across the battery), an ammeter across
  a part or a voltmeter in series goes back to the AI, with the drawing shown.
  A battery or source is drawn with its + where the current leaves it and a
  diode with its anode where the current comes in (before, an LED on the top
  row was drawn backwards against the battery); an LED whose anode the wires
  put on a named "B1-" goes back as the wrong way round, with what to write.
- **Each question reaches the right builder.** A control or electronics
  question reaches MAKE CONTROL or MAKE ELECTRONICS even without the word
  "circuit", and is never offered as a grid picture; a circuit to draw with an
  Arduino in it is not offered as a program unless the code is asked for too.
  The instruction lines line up as the model reads them.
- **Tables by column name.** MAKE SHEET formulas may name columns:
  `=[Qty]*[Price]` is this row's cells, `=SUM([Cost])` the rows above. Lantern
  writes the cell names, so a formula copied down a column cannot point at the
  wrong row. A formula written with cell names that looks at another row than
  the rest of its column goes back with the formula to write.
- **Hydraulics:** a single-acting cylinder's extend speed is metered in (said
  when meter-out was asked); compressors, exhausts and air in an oil circuit
  point at MAKE PNEUMATIC.
- **Bench:** three new make questions -- `make-pneumatic` (push to extend,
  automatic return), `make-control` (a motor starter with its holding contact,
  overload and run light) and `make-electronics` (an Arduino pin switching a
  12 V relay through a transistor: the base resistor and the coil's diode are
  checked). Each checks what the circuit does, not just its parts. The bench
  has 24 make questions; totals change from 1.17.0.
- **Tests:** `tests/pneumatic.js`, `tests/control.js`, `tests/electronics.js`,
  `tests/sheet_names.js`; `tests/browser/domains_e2e.py` drives all four
  through Chat in Chromium with a stand-in model.

## 1.17.0 — Hydraulic circuits correct by construction (2026-10-29)

Adam spotted that the 35B's bench drawing for "a pump takes oil from a tank and
feeds a cylinder through a valve, and the oil returns to the tank" was wrong:
the cylinder looked single-acting with no spring, and the return came off the
line between the valve and the cylinder. It was mostly Lantern: the AI wired
each pipe the way current goes round an electrical loop (Lantern's
instructions asked for exactly that), Lantern's valve had two ports (no P, T,
A, B), the layout put the return on the cylinder's feed port -- a short to
tank -- and only "the pump reaches the tank" was checked, so the bench passed
it. Its own model answer had the same short. Adam's direction: make the
correct drawing the path of least resistance for any AI model, with the
drawing rules and the hydraulic flows baked into the tool, so complexity can
be added easily.

- **MAKE HYDRAULIC: the AI names the parts and what each does; Lantern does
  every pipe.** `pump P1 "20 L/min"`, `relief R1 "150 bar"`, `cylinder C1
  double "press ram"`, `motor M1`, `valve V1 C1 4/3 tandem solenoid`, `flow F1
  C1 extend meter-out`, `check K1 C1`, `gauge`, `filter`, `accumulator`,
  `note`. Lantern draws the one correct circuit in the ISO layout: the power
  unit at the bottom (tank, strainer, electric motor, pump, relief valve to its
  own tank), the pressure line along to each valve's P, each T to a tank of its
  own, A to the cap end and B to the rod end of the cylinder it works (or a
  motor's two ports), a flow control on the line it meters with its check
  letting oil back freely, a pilot-operated check nearest the cylinder with its
  pilot line (dashed) from the other line. Port letters on every valve.
- **Defaults, said.** No relief valve: one is added ("every pump needs one").
  A cylinder with no valve gets a 4/3, spring centred, worked by a lever. One
  valve gets a tandem centre (the pump unloads at rest), several get closed
  centres. A single-acting cylinder gets a spring and a 3/2. What cannot work
  is changed and said: a tandem or open centre beside other valves on one pump
  line (it would send all the pump's oil to tank). Chat and the drawing say
  what Lantern added or changed.
- **Checked as pipes.** Before anything is shown, the drawing is walked as
  pipes: no line from the pump to tank except through the relief valve, every
  valve's P on the pressure line and T to a tank, every cylinder port joined
  to its own valve. Two valves for one cylinder, a valve for a cylinder that is
  not there, or a valve Lantern does not draw yet (sequence, reducing,
  counterbalance ...) go back to the AI with what it can use instead.
- **The older form is piped the same way.** A MAKE SCHEMATIC block in hydraulic
  mode (parts and wires, what models wrote before) is read for its parts and
  which valve works which cylinder, and Lantern does the piping: the 35B's
  pump -> valve -> cylinder -> tank now draws as a correct circuit at once, with
  no correction round.
- **The bench checks the circuit**, not just that four parts are connected; its
  model answer is a MAKE HYDRAULIC block.
- **Draw's Hydraulics palette** has the ISO symbols too: 4/3 (closed and tandem
  centre), 4/2 and 3/2 valves, a spring-return cylinder, a motor turning both
  ways, relief, check and flow control valves, an electric motor and an
  accumulator. Draw draws dashed lines (pilot lines).
- A new part is one entry in the builder's list of roles and one place in the
  layout; the checks stay the same.
- **The library starts first.** start-lantern gives kiwix-serve up to 10 s to
  answer before it starts the AI model: on a slow USB port the model's read
  held a library started after it for 14 minutes.
- Tests: `tests/hydraulic.js` (in npm test), `tests/browser/hydraulic_e2e.py`
  (Chat with a stand-in model, in Chromium); the kit test checks that the
  library answers before the engine starts.

## 1.16.1 — Lantern Watch from two real laptops: no stall on a slow port, warnings only for a real shortage (2026-10-29)

Adam loaded the 35B with 1.15.0's watcher on two laptops from the same USB
stick: his 32 GB work laptop (a USB 3 port, 120-146 MB/s, 2 1/2 minutes) and
his 64 GB home laptop (a USB-C port through which the stick read at 20-29
MB/s, 15 minutes). Their logs (kit/logs) showed:

- **The watcher stopped for 14 minutes on the slow port.** Its log has no rows
  from 30 s until the model was read, and the black window printed nothing
  meanwhile. llama.cpp asks Windows for the whole model at once (prefetch),
  and anything else that touches the stick waits behind it -- the library
  (kiwix-serve) only started then too. The watcher's first log write, at
  30 s, got stuck in that queue. Now nothing is written while the model
  loads (the rows stay in memory and are written at ready, stop or exit),
  and the watcher's working directory moves from start-lantern's, on the
  stick, to the temp folder. The live test now runs past 30 s and checks
  that nothing is written, the watcher still answers, and the log has a row
  every second or two all through the load.
- **"Heavy" only for a real shortage.** At work the warning came from
  Windows' commit charge at 98% (the prefetch) while 5 GB was still free --
  the laptop stayed smooth with a video playing, Fusion 360 open and a copy
  running. Commit near the limit now counts only when free memory is low
  too. And "tight" no longer comes from paging alone: at home it came with
  38 GB free. Paging counts when less than 4 GB is free. Both laptops' loads
  are new watcher stories (`watch_work_prefetch`, `watch_free_paging`): no
  warning, in the Python and the PowerShell watcher alike.
- **The warning stays on the loading screen at least 20 s** (Adam's was gone
  before he had read it), and says the AI is still loading: "It may stop
  responding for a minute or two, but the AI is still loading. Please wait,
  and do not click or open anything meanwhile."
- **When to ask about memory is unchanged.** The one time it asked (16.7 GB
  free for the 35B), the model was still in memory from the load before,
  which the watcher cannot see beforehand; the loads after it confirm the
  rule.
- The kit README says what a port does: 145 MB/s in a USB 3 port, 26 MB/s
  through a USB 2.0 port or adapter, for the same stick. Watcher version 1.1.

## 1.16.0 — The app audit: Draw, Code Lab, Sheets, Writer, Slides, Calculator (2026-10-29)

Adam asked for every module to be gone through, its mistakes fixed and what
it lacks next to the programs people know listed, so he does not have to find
them himself. Each app was used for real in Chromium (desktop and phone
width), its bugs fixed with a test each, and its missing features written up
for Adam to choose from (the findings PDF that comes with this release).
Built on 1.15.0 (Lantern Watch); nothing in the watcher changed.

- **Every app: NOT saved is said.** When the browser's storage was full,
  Lantern's store dropped the save without a word: the apps said "saved" and
  the work was gone after closing. A refused save is now kept in memory for
  the session and read back first, `set()` says it failed, and a red bar
  says Not saved; Writer, Code Lab and the others say NOT saved where they
  said saved. And when the storage was already full as Lantern started, its
  test write was refused and Lantern ran as if nothing had ever been saved:
  every document seemed gone (they were still there). It reads them now,
  and says Not saved when a change cannot be kept. Esc closes the dialog
  on top in every app.
- **Draw.** A real history: Undo and Redo, Ctrl+Z / Ctrl+Y, one eraser drag
  is one undo, Clear can be undone (Undo after erasing took away a
  different shape). Filled shapes are erased from inside. Points are kept
  to a tenth of a pixel, so about three times more drawing fits; past the
  limit a notice stays on screen (it stopped saving silently).
- **Calculator.** A number after = starts a new sum (2+3= then 7 gave 57);
  an operator goes on from the answer itself (1/3= x3= gives 1); an error
  keeps the sum and says why; open brackets are closed; 2π, 2 MR and 2 e
  multiply; 50% is 0.5; memory and RAD are kept and shown; the keyboard
  takes letters, e and comparisons; dialogs keep their keys. Shared with
  Sheets, Assist and Chat: tiny and huge results keep their digits
  (Planck's constant x2 was 0, 10^300 Infinity), trig is exact at quarter
  turns and TAN(90) undefined, LOG(x, base), ROUND and MOD as Excel, FACT of
  a fraction an error.
- **Sheets.** Typing is kept when another cell is clicked or the sheet is
  left (it was thrown away); clicking a cell while a formula is typed puts
  the cell in it; formulas read text cells; IF guards a division and gives
  text; IFERROR; =PI(); errors as Excel names them (#DIV/0!, #VALUE!,
  #NAME?), and an error or a loop inside a range shows in its total (a SUM
  over a 1/0 looked right); 1,500, $12.50 and 10% are numbers; Excel's
  keys; CSV import replaces the sheet or opens a new one, and says what did
  not fit (rows past 100 went without a word); page edges no longer catch
  clicks meant for cells; the chart prints alone, with its bars.
- **Writer.** Pasted and imported HTML keeps its structure, not its styling
  or script; Save .txt has one line per paragraph; Save .html has the title
  once and table lines; opening a document does not change its date; the
  last words are saved when the page closes; Normal text and Clear keep the
  order of headings; the toolbar no longer covers the first item of other
  apps' lists; Fit width fits a phone; printing on a paper size starts at
  the top; Backspace at a page edge joins paragraphs.
- **Slides.** Space or Enter on Present no longer stacks shows that cover
  the app; on a phone the left third (or a swipe) goes back and an X ends
  the show; words shrink until the slide fits; pasted text is cleaned;
  transparent PNGs on white, not black; a picture the browser cannot show
  (HEIC) is refused; Outline .txt imports back as the same deck; Ctrl+Z no
  longer empties the deck title; thumbnails work by keyboard.
- **Code Lab.** Find marks the match in yellow and keeps the cursor in its
  box (a second Enter typed a line break over the match); Replace all, Tab
  and Ctrl+/ on hundreds of lines take a moment, not 7 to 27 seconds; Ctrl+Z
  takes back a word, not a letter; Ctrl+/ takes off one comment marker; red
  line numbers move with their lines; a typed extension (blink.py) picks
  the language; JavaScript mistakes have their line; Python one-line blocks
  and the last item of an Arduino enum are not called mistakes. Ladder: a
  rung whose ; was left out is said and stays a rung of its own; tags
  ignore case, as in Logix; OSR and OSF. Ladder -> Structured Text: TOF's
  .TT, RTO kept until RES, RES on timers and counters, CTU with CTD on one
  tag (CTUD), CTD as Logix counts, presets changed by MOV, LIM outside a
  band, Logix names like Local:1:I.Data.0; and not from ladder with
  mistakes in it. Run prints NaN, Map, Set and errors as they are, waits
  for its timers (up to 10 s), reports a failed promise, and says when
  output was cut at 500 lines. The ladder drawing fits wide rungs and long
  tags and stays readable on a phone.
- Tests: `tests/storage_full.js`, `tests/draw_symbols.js` (more), `tests/calc_audit.js`,
  `tests/sheet_audit.js`, `tests/writer_audit.js`, `tests/slides_audit.js`,
  `tests/codelab_audit.js`, all in `npm test`; each app also checked in
  Chromium at desktop and phone width.
- Not changed yet (in the findings PDF): Writer's Save .pdf paper settings,
  undo for Replace all, the phone toolbar, Find across paragraphs; Slides on
  a phone with a long deck; Sheets' grid is still 100 rows by A-Z; Draw's
  delete by touch; the Calculator has no text field on a phone.

## 1.15.0 — Lantern Watch: the truth while the model loads, and no freeze from it (2026-10-28)

From Adam's USB kit. The 35B took minutes to load from the stick, parts of
the laptop froze meanwhile, and people clicked around and made it worse. The
start scripts picked the model by total memory, and the loading bar was an
estimate from the file size. (1.14.3 is on main: the 35B scored 118 of 118 on
it, run 17.) Lantern Watch was written in another thread as a drop-in for
1.14.3 and merged here:

- **Free memory, not total.** `kit/lantern-watch.ps1` (Windows) and
  `kit/lantern-watch.py` (Linux, Raspberry Pi, Mac; Python 3, standard library
  only) check free memory before the engine starts. When the picked model
  does not fit just then, a small window asks: the largest smaller model that
  fits (the choice it makes by itself after 60 s), load anyway, or stop to
  close programs. A model named by hand (`35b`, `MODEL=`) is never switched,
  only warned about; with no way to ask (Linux without zenity) it takes the
  first choice and says so. 8 GB laptops are asked only when more than
  1.5 GB would have to be pushed out.
- **Gentler.** On Linux and Mac the engine runs at `--prio -1` (nice 5,
  SCHED_BATCH threads). Windows keeps normal priority: llama.cpp's LOW leaves
  Windows 11 power throttling on. `LANTERN_PRIO=1` tries the BelowNormal
  priority class there instead (untested); `LANTERN_PRIO=0` turns `--prio`
  off.
- **The real story.** The watcher measures the bytes read from the model's
  drive, free memory, paging and the engine's memory, once a second. The
  black window's title counts up ("Lantern AI: loading 43%, about 1 min 29 s
  left") with a `[Lantern]` line when something changes; on Linux the kit
  window shows the same with a real progress bar. It answers
  `http://127.0.0.1:8082/status` (`LANTERN_WATCH_PORT`), for this computer
  only, with CORS for Lantern's own address only, and the start script tells
  the page its port (`&watch=8082`).
- **The loading screen reads it** (`AI_SERVER_WAIT`, `AI_SERVER_WAIT_VIEW`).
  Beside `/health`, the page asks the watcher (given up after 900 ms, so the
  loop keeps its pace) and shows its sentence ("Reading the AI model from the
  USB stick: 7.7 of 18.1 GB at 120 MB/s, about 1 min 29 s left."), its
  measured progress and time left, and its advice on a line of its own -- a
  slow USB port, the smaller model and why. When memory has run out the
  advice comes first, as a warning ("It can look frozen for a minute or two.
  Please wait, and do not click"), stays for a minute if the busy computer
  stops answering, and the corner button says "low memory, please wait". The
  bar never moves back; the watcher's load time is the one remembered; a
  watcher and a server that both go quiet mean start-lantern has stopped, said
  within 5 s instead of a minute. With no `&watch=` (an older start script),
  on a phone on the Wi-Fi (its own 127.0.0.1 is not the laptop's), or with no
  answer for 5 s, the screen is the 1.12.8 estimate as before.
- **Stopped for memory.** When the person chooses to stop, start-lantern says
  why and stops; the Linux kit window (told `FAIL memory`) says what to close
  and offers Start again.
- **Logs** of every load in `kit/logs` (`loads.csv`, the last 20 `load-*.csv`,
  `last-load.json`, `last-plan.json`), written every 30 s, to tune it from real
  computers. `kit/logs` is in `.gitignore` and never in `Lantern.zip`.
- Without Python 3 or the watcher files, start-lantern runs exactly as in
  1.14.3 (no `--prio`, no `&watch=`); a Mac whose `python3` is only the
  developer-tools stub skips the watcher, so no installer pops up.
- Tests: `tests/lantern_watch/run_tests.py` (165 checks: the plan cases, seven
  load stories, and the PowerShell and Python watchers agreeing sample by
  sample when pwsh is installed); `tests/ai_server_watch.js` (the loading
  screen against the watcher's own example statuses); `tests/ai_server_watch_live.js`
  (the real `lantern-watch.py` against a stand-in engine, read by the page
  over HTTP with CORS enforced, ready, the load log); the kit test runs
  start-lantern with the watcher in the kit (`&watch=`, `--prio -1`,
  `LANTERN_PRIO=0`) and without it.
- Not yet run on Windows itself (the CIM counters, the drive's bus type, the
  question window, the `.bat` hooks under cmd.exe), on a Mac, or on the Pi with
  the exFAT stick: the PowerShell watcher ran here under PowerShell 7 on Linux.
- From Adam's first self-test on Windows (PowerShell 5.1): a model path typed
  as `kit\models\...` had no drive letter, so the drive's read counter was not
  found (`drive=no`). The Windows watcher now makes every path full first
  (start-lantern.bat already passed full paths; `MODEL=` may not).
- From Adam's first loads on Windows (the 35B from a USB stick, 2026-10-29):
  the free-memory question, its countdown and "load anyway" worked, but the
  watcher said nothing until the model was ready. Its log showed why: before
  its first reading it asked Windows' storage tools what kind of drive the
  stick is and created its log file there, and with the stick reading the
  model at full speed that took 125 s (the 4B, read in 30 s, was measured
  from the start). Now the plan works out the drive's kind before the engine
  starts, while the stick is idle; the watcher takes its letter from the path
  and, if needed, Windows' instant drive type, takes its first reading at
  once, and keeps its log off the stick until the model has loaded (rows go
  to the temp folder meanwhile, and move to `kit\logs` at ready, with any
  left there by a load that was cut off). `last-load.json` says how soon the
  first reading came (`firstSampleMs`). Tested under PowerShell 7 here
  (`tests/lantern_watch/live_ps.py`); the self-test shows the instant check.
- Code Lab's ladder: a new ladder file, the rung-text reference and two
  comments showed the start/stop rung as `XIO(Stop)`, while the example, the
  AI's prompt and Lantern's own check (1.13.3) use `XIC(Stop)` for a Stop
  wired normally closed. Adam asked about it. They all say `XIC(Stop)` now,
  and the reference explains that XIC and XIO examine the bit, not the
  switch: a normally closed Stop or overload has its bit on until it is
  pressed or trips; XIO is for "only while this is off" (an interlock, a
  fault, a counter not yet done).
- Draw's schematic symbols, from Adam's Hydraulics drawing: right-clicking a
  placed flow arrow did not delete it -- the right button placed a new arrow
  first, and the delete took that one (with the Pen it left a dot). Only the
  main button places or draws now; a right-click (or a Mac's Ctrl-click)
  only deletes. And a flow arrow could only point right: **Turn** (or the
  **R** key) turns the symbols you place a quarter turn clockwise -- flow and
  force arrows any way, a cylinder standing up, a pump on its side -- and the
  arrow in the button's name turns with it. A faint copy of the symbol
  follows the pointer, so you see where and which way it will land (not for
  Label, which asks for its text). `tests/draw_symbols.js`.

## 1.14.3 — Bench run 15, the 4B again: a sum glued with *, newtons over g, the line that needs the 2 (2026-10-28)

Adam ran the 4B on 1.14.2 with no library: **88 of 96 (92%)** -- core
30/32, fresh 7/7, hard 9/10, made 19/21, conversations 15/16, puzzles 8/10
(without the tools 1/6, not scored). On the same 96 questions run 14 (1.14.1)
scored 79: every miss 1.14.2 aimed at passed -- the satellite with its
retyped number, the made-up battery, the mayor, both lamp circuits, the
slides, the planner, both document questions -- and the house, the knights
and "Is this how you work?" passed too. Of the eight left, Lantern can catch
six:

- **Divided by g.** `=70*ANS/9.80665` for a 70 kg person's weight on the
  Moon in newtons. A formula that divides by 9.80665 (9.81, 9.8) when the
  question asks for newtons is questioned: that gives kilograms-force.
- **A sum glued with \*.** `=60*5/1000+100*5/1000*0.15*30` -- the lines for
  both kWh and for the price over 30 days, joined with * -- multiplies only
  the TV's part (2.55 dollars for 3.60). A line that is two earlier lines
  joined with * or /, one of them a sum, is questioned with the brackets
  (`=(60*5/1000+100*5/1000)*0.15*30`, or `=ANS5*ANS4`).
- **Amp-hours any wrong way.** `=60/3` "amp-hours" (1.14.2 caught only
  watts x hours). With one current and one time in the question, amp-hours
  that are not amps x hours (times the days or weeks it counts) are
  questioned with 5 A x 3 h = 15.
- **The nearest clinic's phone number.** "NEED: the name or address of the
  clinic" is answered by Lantern: no place's phone number, address or
  opening hours are in its library.
- **A note after END.** The parallel circuit's `note Rt = ...` came after
  END in both of the 4B's blocks, so Lantern asked for the formula it had
  been given. Note lines straight after a schematic's, drawing's or wheel's
  END are now part of it.
- **TRACK.** "swap person at position 2 and person at position 4" was not
  read as places; it is now ("at position 2", "in position 2"). And told
  only that no line moved 2 places for "two places to its left", the 4B put
  2 in both of its "left of" lines, and the one for "directly to the left"
  fell off the row: Lantern now pairs the steps' place phrases with the
  block's lines and names the one line that needs the 2.
- Left as the model's: the game-show doors with a host who does not know,
  and a house drawing stuck repeating one line.
- Tests: `tests/bench_run15.js` (16 checks from the 4B's replies); every
  passing reply of runs 13, 14 and 15 (176) re-checked: none newly
  questioned.

## 1.14.2 — Bench run 14, the 4B: what Lantern can catch for a small model (2026-10-28)

Adam ran the bench with Qwen3.5-4B (the model Lantern picks on 8 GB
computers) on 1.14.1: **100 of 118 (85%)** -- core 31/32, fresh 7/7, hard
8/10, library 19/20, made 14/21, conversations 14/18, puzzles 7/10. The 35B
scored 118 of 118 on the same build, and 1.14.1 went to `main`. The 4B is
the one most kits will run, so its misses show where Lantern's checks fall
short. About two thirds were Lantern's to catch; the rest (the game-show
doors with a host who does not know, knights and liars and the coin cups
answered without the puzzle tools, "Is this how you work?", a house with a
tiny roof, a drawing stuck repeating one line) are the model's, and Lantern
does not write the bench's answers into itself. Everything below is a check
on the reply, not a change to what the AI is told, so the 35B's replies are
graded as before.

- **Lantern made two of them.** The 4B drew both lamp circuits with lamps
  labelled "LED"; Lantern's label check (1.13.4) sent them back as diodes,
  and both lost their lamps. A lamp labelled LED, bulb or light is a lamp.
- **Parallel asked, series drawn.** Three resistors and two lamps "in
  parallel" were drawn as one loop through every part. When the question
  says parallel, two parts of a kind wired to each other go back once, with
  how to wire each across the source.
- **Slides and the planner against the question.** 2 slides for "4 to 6
  slides" goes back with the count; a plan with no line on a date the
  question gives ("starting one week from today" -- the 4B wrote "in 1
  month", the line in Lantern's own example) goes back with that date.
- **A made-up input.** `=RUNTIME(10,60)` for "How many hours will my battery
  run a 60 W light?" -- 10 passed as a unit factor. A bare number in a
  required input of one of Lantern's quantity functions must come from the
  question (or two of its numbers combined); otherwise it is questioned.
- **Amp-hours from watts.** "180 amp-hours" from 60 W x 3 h is watt-hours:
  questioned, with amps x hours (5 x 3).
- **A result retyped with its own rounding.** `=1436.06/60` after Lantern
  worked out 1435.7027: Lantern now runs `=ANS4/60` itself, and puts the
  new number in the sentence, when that leaves nothing to question -- no
  turn spent (the 4B's first reply was right but for this; questioned, it
  then asked for Earth's mass). Only numbers of four or more figures within
  0.2% of an earlier result, and not in the question.
- **What Lantern knows, it says.** A NEED for a planet's mass, GM, radius,
  gravity, escape speed or orbit is answered from PLANET; a NEED for the
  town, asked who is mayor right now, is answered that no place's office
  holder right now is in the library. "No quote says methane" now quotes
  the passage sentence that does say it.
- **Not in the document.** Said after seeing 2 of a manual's 5 pages, the AI
  is asked once to READ the page that may say it; and an own-knowledge guess
  about "this compressor" (most compressors have a 1-year warranty) is left
  out of the answer, with a note saying what was left out.
- Tests: `tests/bench_run14.js` (33 checks from the 4B's own replies; where
  Lantern sends something back, the reply that comes back is scripted).
  Code Lab's and the make-docs tests accept Lantern questioning first.

## 1.14.1 — Bench run 13: a retype with letters dropped, the size of a square, a tank valve held open, a seal-in on the coil (2026-10-27)

Adam's run 13 (Qwen3.5-35B-A3B, sees images, Lantern 1.14.0, with the
library): **113 of 118 (96%)**. Core 32/32, fresh 7/7 (both new Places
questions: the AI wrote `=DISTKM("Nairobi","Mombasa")` and
`=BEARING("Tulsa","Dallas")`), hard 10/10, library 20/20, conversations
18/18, made 18/21, puzzles 8/10; without the tools 4/6 (not scored). The
shelf questions were skipped: this kit has only Wikipedia. 1.14.0 went to
`main` on these results. The five misses:

- **Refrigerator again.** The next line typed `REMOVE("rotarigef","r")` --
  Lantern's "rotaregirfer" with three letters dropped -- and the retype test
  (1.13.4) missed it: every letter of rotarigef is in rotaregirfer and most
  are in the same order, but it is a quarter shorter. Lantern then repaired
  the sentence to the AI's own wrong chain ("otaigef", 7). Now a word whose
  letters are all in an earlier result, mostly in order, counts as a retype:
  questioned, and when the same reply comes back Lantern runs the lines
  again with its own result (`REMOVE(ANS1,"r")`: otaegife, 8).
- **Robot walk: "NEED: What is the size of a square in meters?"** The
  question counts its moves in squares. Lantern answers that NEED itself
  ("a square is the unit: no size in metres is needed") -- not when the
  question gives or asks for metres -- and the follow-up asks a puzzle for
  its tool block (TURN), not = lines.
- **AccelStepper: the grader was wrong.** The sketch was right (`const long
  moveSteps = 800L`, moved there and back to 0); the grader looked for 800
  with no `L`. It accepts the suffix now, so this was really 114 of 118.
- **Structured Text tank: no PROGRAM, and the valve not held.** The 35B
  wrote a bare VAR block and `FillValve := LowFloat AND NOT HighFloat;`,
  which closes the valve as soon as the level rises past the low float, long
  before the high one -- then copied six lines of Lantern's own MAKE CODE
  instructions after END. Now, for Structured Text the AI writes:
  - code outside PROGRAM ... END_PROGRAM (or a FUNCTION_BLOCK) is questioned;
  - when the question turns something on when one input comes on and off
    when another comes on, an output that is on only while the first is on
    is questioned, with the two ways to hold it (`FillValve := (LowFloat OR
    FillValve) AND NOT HighFloat;`, or set and reset with IF);
  - lines after the block that copy Lantern's instructions are left out of
    the reply;
  - the grader also fails a valve that is not held open between the floats.
- **Ladder: XIC(SealIn).** One rung in plain text, with the seal-in contact
  on `SealIn`, a tag no rung sets. When the question asks for a seal-in,
  Lantern now questions a coil whose own contact is in no branch, naming
  the stray tag ("write XIC(Motor) in its place"). Code written straight
  into a reply, when the question asked for a program and Lantern finds
  problems, now goes back once as a MAKE block does -- in Chat and on the
  bench -- asking for a corrected MAKE CODE block.
- Tests: `tests/bench_run13.js` (29 checks, from the run's own replies);
  Code Lab's "no seal-in" check accepts Lantern questioning it first.

## 1.14.0 — Open modules: library shelves, places and distances, codes, sources & licences (2026-10-27)

Adam asked how Lantern compares with the other offline-knowledge projects
(Project NOMAD, Internet-in-a-Box, RACHEL, Kolibri, Kiwix itself) and then to
"borrow where applicable and allowable to make more open modules for Lantern
and the AI to close the competition". Their lead was content breadth (many
Kiwix books, not only Wikipedia), maps, and data tools. This release borrows
the open parts and ties each one to the AI, so the AI can use it and Lantern
can check the result:

- **Library shelves.** The kit can add more free Kiwix books beside the
  encyclopedia: WikiMed (Wikipedia's medicine articles, about 1 GB), iFixit
  repair guides (3 GB), the Wikivoyage travel guide and PhET science
  simulations (0.5 GB each), and with `shelves-all` the Wiktionary dictionary
  (5 GB) and Wikibooks textbooks (3 GB). Setup offers the practical shelf once
  (N is remembered); `setup-kit shelves`, `shelves-all` and `shelf-<name>`
  fetch them, and `check` lists them (shell and PowerShell). The kit window
  shows the step as "More books".
  - A question reads **the shelf it is about** first, then the encyclopedia
    (`Lantern.library.order`): a snake bite reads WikiMed, a phone battery
    iFixit, getting around Nairobi Wikivoyage. A shelf a question is not about
    is not searched -- Mars is not looked up in iFixit. The Offline library
    panel says what each book is read for.
  - Five bench questions need a shelf (snakebite first aid, oral rehydration,
    an iPhone battery, Nairobi transport, a word's meaning). The bench asks
    them only when the kit has that shelf, and an answer passes only if it
    read and quoted that shelf.
  - Not checked from here: download.kiwix.org cannot be reached from where
    this was built, so the book names (`wikipedia_en_medicine_nopic`,
    `ifixit_en_all`, `wikivoyage_en_all_nopic`, `phet_en_all`,
    `wiktionary_en_all_nopic`, `wikibooks_en_all_nopic`) come from Kiwix's
    catalogue as of mid-2026. Setup looks in the book's own folder, then
    `other` and `zimit`, and says plainly when a name is not found.
- **Places.** Where 7,336 towns and cities are -- every capital, every region
  capital and the big towns -- from **Natural Earth 5.1.2, which is public
  domain**, so the single file stays CC0. Served by the kit or the website,
  Lantern also reads `site/places.txt`: every town of 1,000 people and up
  (135,195), from **GeoNames, CC BY 4.0**. That one is not public domain, so it
  is a separate file with its credit line at the top, never inside the single
  file.
  - Formula functions `DISTKM` (straight-line distance, two names or four
    numbers), `BEARING` (degrees to set off on), `DIRECTION` (in words),
    `LAT`, `LON` and `PLACE` (which town Lantern means). "Paris" is the
    biggest Paris; "Paris, TX", "Paris, Texas" and "Paris (France)" narrow it.
    Accents, St./Saint, other names Natural Earth lists (Rangoon, Kiev),
    D.C./U.S.A./U.K., regions (London, Ontario) and countries by other names
    (Deutschland, Burma, Ivory Coast) all work. Capitals are the official
    ones (South Africa's three, Dodoma, Porto-Novo, Astana; not Johannesburg
    or Lagos). People are counted for the urban area, and PLACE says so.
  - Geography has a **Places & distances** card: two towns, where each is,
    the distance in km and miles and which way to set off.
  - The AI has DISTKM, BEARING and PLACE in its catalogue, two recipe cards
    and two new bench questions (Nairobi to Mombasa; the bearing from Tulsa to
    Dallas), worked out by Lantern.
- **Codes.** `MORSE`/`UNMORSE`, `NATO` (the ICAO radio alphabet: Alfa,
  Juliett), `BASE64`/`UNBASE64` (UTF-8), `HEX`/`UNHEX`, `ROT13`, `CAESAR`,
  `SHA256` and `CRC32`, checked against their published test values, in the
  formula engine and the AI's catalogue (`Lantern.codes`).
- **Sources & licences.** A new section in the Charter (and
  `Lantern.sources`, for machines) lists everything Lantern borrows, where it
  sits and what its licence asks: in the file, CC0 and public domain only;
  beside it, GeoNames (CC BY 4.0), wllama and llama.cpp (MIT), Qwen3.5
  (Apache 2.0), kiwix-tools (GPL 3.0), the Wikimedia books (CC BY-SA 4.0),
  PhET (CC BY 4.0) and iFixit (**CC BY-NC-SA 3.0: a kit sold for money must
  leave the iFixit shelf off**). The Charter shows sections from other
  modules (`Lantern.charterSections`). Suite search finds "Sources &
  licences". README.txt and kit/README.txt say the same.
- Tests: `tests/open_modules.js` (40 checks: shelves against a stand-in
  kiwix-serve with five books, Places, Codes, Sources); the four new modules
  in the AI isolation test (rule 11); the kit's shelves in `kit_offer.py`.
- `tools/make_places.js` builds both place lists; how to fetch its inputs is
  at its top.

## 1.13.4 — Bench run 12: retyped lines run again, a rung in plain text, lamps drawn as resistors, Show what was made (2026-10-27)

Adam's run 12 (Qwen3.5-35B-A3B, sees images, Lantern 1.13.3, with the
library): **113 of 116 (97%)**. Core 32/32, fresh 5/5, hard 10/10, library
20/20, made 19/21, conversations 18/18, puzzles 9/10; without the tools 3/6
(not scored). Run 11's misses passed: the fuel (questioned with the sum,
then 28), the two-coin cups, the hens, the P1AM and stepper sketches. Adam
asked about the three that failed, and could not see the circuit or the
ladder to check them:

- **Refrigerator.** Lantern's `=REVERSE("refrigerator")` gave rotaregirfer,
  but the AI's next line typed `REMOVE("rortegifer","r")` -- its own copy with
  two letters dropped -- instead of ANS1, the third line copied that line's
  result, and the sentence put `{ANS2}` (a word) where the count goes: "which
  has otegife letters". Lantern's check missed it (rortegifer is four edits
  from rotaregirfer). Now:
  - a line that types out an earlier result with mostly the same letters
    (`sameLetters`) is questioned, as near spellings were;
  - a `{placeholder}` holding a word right before "letters", "words",
    "characters" ... is questioned, naming the line that counts;
  - when the AI's one correction still types results out, Lantern runs its
    lines again with its own results in place (`rechain`: rortegifer → ANS1,
    otegife → ANS2), puts them into the sentence ("rotaregirfer", "otaegife",
    {ANS2} → {ANS3}: 8), and the notes under the answer say both. The row
    records `rechained` and `repaired`.
  - the nearest spelling wins when a word is close to two results.
- **Ladder: one correct rung in plain text, "no MAKE block".**
  `[XIC(Start) ,XIC(Motor) ]XIC(Stop)XIC(Overload)OTE(Motor);` -- right this
  time, with the normally closed Stop on XIC -- but written in the reply with
  no MAKE block and no fence. Chat's checks for code in a reply now find
  ladder rungs on their own lines (and a one-rung fenced block), and the
  bench's MAKE path grades code in the reply the way Chat checks it, when the
  question asks for a program (`Lantern.aiAct.fromReply`; the row records
  `codeInReply`). A rung with XIO on the normally closed Stop is questioned
  there too.
- **Two lamps drawn as resistors.** `part R1 resistor "Lamp 1"`: two resistor
  symbols labelled as lamps, which the model, shown the picture, kept. A part
  whose label names another kind Lantern draws (lamp, motor, switch, diode
  ...) goes back once: "a lamp is a part of its own -- write part R1 lamp".
  Labels that name the part's own kind ("LED resistor") or a battery on a
  source are left alone.
- **A questioned schematic is drawn anyway**, with what Lantern questions under
  it, instead of "nothing was made" -- so the person sees what Lantern means.
- **Show, in the bench.** Each result has a Show button: why it failed, what
  the AI replied (its first reply too, when it was asked again), the puzzle
  blocks, and for a thing it made, the thing itself -- the circuit, the
  drawing, the program with its ladder picture -- rebuilt from the saved reply
  exactly as Lantern built it. **Open saved results…** opens a run saved as
  JSON the same way, so a run from another computer can be looked through.

Tested:
- New `tests/bench_run12.js` (21 checks) with the run's replies
  (`tests/fixtures/bench_run12_replies.json`): the letters questioned, run
  again and passed in Chat with the notes, and what is left alone; the rung in
  plain text found, checked and passed through the bench's MAKE path, prose
  that only mentions XIC, a question that asks for no program; the lamps
  questioned, corrected and passed, and labels left alone; Show on the lamps
  and ladder rows.
- `tests/ai_layer.js`: Show and Hide on the bench rows, and Open saved results.
- In Chromium: run 12's JSON opened with Open saved results, Show on the
  lamps, ladder and letters rows (the circuit and the ladder picture drawn).
- All suites pass.

## 1.13.3 — Bench run 11: results put in, two places, the lesson asked about, EXAMPLE as code, fuel the right way round (2026-10-27)

Adam's run 11 (Qwen3.5-35B-A3B, sees images, Lantern 1.13.2): **87 of 94
(93%)**. Core 32/32, fresh 5/5, hard 9/10, made 18/21, conversations 15/16,
puzzles 8/10; the same puzzles without the tools 3/6 (not scored). The
library was not reached this run, so its 20 fact questions and two library
conversations were not asked (`"library": null` in the results). Fixed since
runs 9 and 10, with the model's replies: 3 dozen eggs, the house, the sun and
the sea, the parallel resistors, the oil-change steps, the queue, the
warranty answer and reading another page. Seven of the rest were Lantern's to
fix:

- **Refrigerator: the corrected sentence still typed its own results.** The
  AI's lines were right (`=REVERSE("refrigerator")`, `=REMOVE(ANS1,"r")`,
  `=LEN(ANS2)`: otaegife, 8) but its sentence said "otageifer" and 7. Lantern
  questioned the 7 only: two swapped letters and an extra r were three
  edits, over the limit. A swap now counts as one slip, so the spelling is
  questioned too. And when the one correction comes back still typing
  Lantern's results its own way (the run sent the same sentence back),
  Lantern puts its results into the sentence -- only a word close to exactly
  one worked-out word, and a number only when exactly one result is missing
  and exactly one number matches nothing -- and the note under the answer
  says what it changed ("otageifer" → "otaegife", "7" → "8"). The bench row
  records it (`repaired`).
- **Two-coin cups: "two places to its left" written as one place.** The block
  said `swap holder of gold and left of holder of gold` and ran cleanly to a
  wrong order. A step that moves two or more places now needs a line with
  that number (`2 left of`, `shift right 2`); otherwise the block goes back
  once (`Lantern.aiPuzzleCheck.distances`).
- **Hens: LESSON: HEN HEALTH read the Health tile's guide on people.** The
  AI's two words matched the Health guide's title strongly and Chickens &
  eggs only by "hen" in its text, so only the Health guide was sent. The
  person's question now counts too (0.6 of how well each lesson matches it),
  so Chickens & eggs comes first; a lesson asked for by its exact title still
  leads.
- **Three programs had "no MAKE block".** The AI wrote `EXAMPLE: <title>`, then
  `language arduino`, the code and END -- the way Lantern had shown it a
  tested example (`EXAMPLE 1: ... / language arduino / code`). Now:
  - an `EXAMPLE:` line with code right under it (a language line, or a line
    that can only be code) is a MAKE CODE block, titled from the example's
    name; `EXAMPLE:` on its own is still Chat's command;
  - the example is shown as "Tested example 1: ..." between `<<<` and `>>>`,
    with no line to copy as a reply;
  - the bench's MAKE path runs Chat's commands (EXAMPLE:, LESSON: ...) up to
    twice when a reply has no MAKE block, as Chat does; the row records them.
  With that, the P1AM seal-in from the run passes, and so does the AccelStepper
  sketch (its end filled in: the run saved only its first 1500 characters).
- **Ladder: XIO(Stop) for a normally closed Stop.** Lantern's own prompt line
  showed `[XIC(Start) ,XIC(Motor) ]XIO(Stop)OTE(Motor);`, and the AI wrote it
  for "a normally closed Stop pushbutton": the input is on until the button
  is pressed, so XIO never lets the motor run. The prompt line now says
  `XIC(Stop)` and why, and a ladder block that examines a device the question
  calls normally closed (Stop, overload, limit, guard, float, pressure) with
  XIO goes back once (`Lantern.aiCode.ncProblems`).
- **Fuel for a trip, the other way round.** `=150*10/420` (3.57 litres for a
  420 km trip on a car that does 150 km on 10). New `AI_PROPORTION_CHECK`:
  for distance and fuel (km or miles, litres or gallons, one unit each), the
  distance said with the fuel is the known pair and the other is the trip;
  lines that give something else go back once with the sum ("420 km needs
  420 × 10 ÷ 150 = 28 litres"). Also "per 100 km" and "how far on 25 litres".
- **The results keep whole programs** (up to 6000 characters): run 11's
  stepper sketch was cut at 1500, mid-line.

Not changed: the die and the four houses failed only without the tools.

Tested:
- New `tests/bench_run11.js` (30 checks) replays the run's replies
  (`tests/fixtures/bench_run11_replies.json`; the stepper sketch's last four
  lines filled in, as the run saved 1500 characters): the letters repaired in
  Chat and passed, with the note; what repair leaves alone; the cups block
  questioned, corrected and passed; LESSON: HEN HEALTH reading Chickens & eggs
  and passing, while exact titles and health questions still lead; the three
  EXAMPLE replies built as MAKE CODE, two passing and the ladder questioned,
  corrected and passing through the bench's MAKE path; EXAMPLE: alone run as
  a command there; the example shown between `<<<` and `>>>`; the prompt's
  XIC(Stop); fuel questioned with the sum and passing in Assist, and the
  other ways of asking, and what is left alone.
- `tests/code_lab.js`: the example's new layout (changed with intent).
- `tests/ai_isolation.js`: `AI_PROPORTION_CHECK` added (115 modules).
- All suites pass.

## 1.13.2 — One Lantern folder: install, update and the bench fixes together (2026-10-27)

Two pieces of work were each built on 1.13.0 and each called 1.13.1, and
neither reached GitHub: the double-click installer (1.13.1 (install), below)
and the bench run 9 fixes (1.13.1 (bench), below). 1.13.2 is both, plus a
single way to get and update Lantern.

**Why bench run 10 was 1.12.9 again.** Adam's stick holds
`Lantern_USB_Kit_1.9.1\Lantern\` with `kit\`, `site\` and the single file.
The kit shows Lantern from a `site` folder, never from
`Lantern_Office_Suite.html`, so replacing that file changed nothing. And
`start-lantern` looked in `kit\site` before the Lantern folder's `site`, so even
a new `site` laid over the folder could lose to an older copy in the kit (the
installer also downloaded into `kit\site`). Run 10's 115 replies were word for
word run 9's: the 35B repeats itself exactly at temperature 0, so the next
run's changes will be Lantern's.

- **Lantern.zip: one folder, `Lantern`.** `tools/make_lantern_zip.py` packs the
  launchers, `Lantern_Office_Suite.html`, `README.txt` (new, plain text: what
  each file is, first time, every time, updating), `CHANGELOG.md`, `site/`,
  `kit/` and `docs/`. Never `kit/engine`, `kit/models`, `kit/library` (what
  setup downloads) or a `kit/site` copy, and none of the repository's working
  parts (`src/`, `tests/`, `tools/`, package files). Extracting it into the
  folder that holds a Lantern folder updates it: Windows' Extract All merges
  and asks before replacing; the models stay. It keeps the "may run" mark for
  Mac and Linux and the Windows line endings, and refuses to pack when
  `package.json`, `site/index.html`, `site/lantern-sw.js` and the single file
  disagree about the version.
- **Every push to main publishes it.** `.github/workflows/lantern-zip.yml`
  builds Lantern.zip and puts it on the release `v<version>`, marked Latest,
  with the newest changelog entry as notes, so
  `releases/latest/download/Lantern.zip` is always the newest Lantern. A push
  with the same version replaces that release's zip.
- **Lantern lives in one place: `Lantern/site`.** `start-lantern` (Windows and
  Mac/Linux) and setup look in the Lantern folder's `site` first and use
  `kit/site` only for a kit on its own; when both are there the window says
  `kit/site` is a second copy and is not used. When Lantern is missing, or for
  `setup-kit lantern`, the download goes into the Lantern folder (`site/` and
  `Lantern_Office_Suite.html`) whenever the kit sits in one.
- **The version comes from Lantern's own page.** Setup's check and the Start
  window read `version: "…"` from `site/index.html`, so a newer Lantern laid
  over an older one can never report the old number from a leftover
  `lantern-version.txt`. The Start window prints the version and the folder it
  serves, and how to update.
- **Updating on a Mac or a Raspberry Pi**, in `README.txt` and
  `kit/README.txt`: a Mac's Finder replaces whole folders (models and all)
  instead of merging, so on a Mac `ditto -x -k Lantern.zip "<folder>"`; on the
  Pi, tick "Overwrite existing files" when extracting.
- Lantern 1.13.2 everywhere: the page, the worker's cache, the single file,
  `package.json`.

Tested:
- New `tests/lantern_zip.py`: one top folder; what is in and what never is;
  the run marks and line endings; the same files from a plain folder as from
  git; refusing mismatched versions; and the stick itself:
  `Lantern_USB_Kit_1.9.1/Lantern` with a 1.12.9 `site`, an old `kit/site`, the
  35B model, the engine and the library, with Lantern.zip extracted over it:
  the new Lantern is in place, the model, engine, library and the stick's own
  Pilot Guide are untouched, and both start scripts now show the folder's
  `site`.
- `tests/kit_offer.py`: a Lantern folder with both copies (check and Start use
  the folder's, by its page's version, and say `kit/site` is not used); with
  none (setup puts Lantern into the folder, not the kit); an update for a kit
  inside a Lantern folder; the same for PowerShell (run here with pwsh 7.4).
- `tests/kit_window.py` run with Tk on Xvfb.
- All suites pass.


## 1.13.1 (install) — Install by double-click; the engine built on the computer when it must be (2026-10-25)

Adam asked for setup to be easy: download the zip from GitHub, extract it,
double-click one file, and everything else happens, with popups saying
clearly what to do. Testing on a Raspberry Pi 500 showed why it was not:
double-clicking `setup-kit.sh` opened it in Geany, and choosing the terminal
under Open With only opened a terminal with nothing to run.

- **Install Lantern / Start Lantern at the top of the folder**, one pair per
  system: `(Windows).bat`, `(Mac).command`, `(Linux).desktop`. A desktop
  entry runs on Raspberry Pi OS whether or not the zip kept the files'
  "may run" mark (its file manager asks Execute once); the command finds the
  folder from the entry's own place (libfm passes the folder, GLib the file,
  both tested, with a space in the path too).
- **Lantern's own window on Linux and the Raspberry Pi** (`kit/lantern-kit.py`,
  Python 3 with Tk, which Raspberry Pi OS has): what will be downloaded and
  the room for it; then the steps, the file being fetched, size, speed and
  time left; the questions as popups (Download it / Not now / No, don't ask
  again; Not now is the default for the full Wikipedia); a failure page that
  says why (no internet, drive full, FAT32 stick) with Try again; at the end
  a menu entry and a desktop icon, and Start Lantern now. Start Lantern is a
  window too: the model, loading then ready, Open Lantern, Share with phones
  (restarts on the Wi-Fi address and shows it), Stop; closing it stops the AI.
  Without Tk it opens a terminal, with popups when zenity or kdialog is there.
- The window drives the same scripts as the terminal (`LANTERN_UI=1`: steps,
  files and questions as `@@` lines, answers on stdin), so what is fetched and
  asked is decided in one place. `LANTERN_POPUP=zenity|kdialog|osascript` asks
  the same questions in dialogs from a terminal (the Mac installer uses it);
  `setup-kit.ps1` asks in message boxes with `LANTERN_POPUP=1` (the Windows
  installer sets it) and falls back to the window when none can show.
- **The engine must start here.** Setup now runs the engine once
  (`--version`). The ready-made Linux arm64 engine for b11435 needs GLIBC 2.38
  and GCC 13's libstdc++, so it cannot start on Raspberry Pi OS Bookworm
  (glibc 2.36) or Ubuntu 22.04. Setup says so and offers to **build the engine
  on the computer**: the llama.cpp source of the same build, one static
  `llama-server` (no libraries beside it), cmake fetched with pip when it is
  missing; about 5 minutes on two laptop cores, 10 to 20 on a Raspberry Pi 5.
  Also `setup-kit.sh build-engine`, and `check` says whether the engine starts.
- The engine's library symlinks are copied as plain files: an exFAT stick
  cannot hold symlinks, so setup on a stick stopped there on Linux.
- **A download that breaks off is no longer kept as whole.** `set -e` does not
  hold inside functions called from `&&`, so a model cut off part way was
  renamed into place and the GGUF header check passed. Now the download is
  tried again twice from where it stopped, then setup stops with the `.part`
  kept, and the next run carries on (tested against a server that drops the
  line a third of the way in). Extras that do not finish are said on the
  window's last page.
- **A stick shared by computers with different CPUs** (a laptop and a Pi)
  keeps one engine each: when `engine/linux` holds another CPU's programs,
  this computer's go in `engine/linux-<cpu>`, and start-lantern uses them.
  Before, setup said "have engine" and the build would have replaced the
  other computer's engine.
- Stopping Lantern's window never stops a download that runs in the
  background (they run in a session of their own), start-lantern waits for its
  servers on the way out (so Share with phones restarts cleanly) and stops at
  once when the engine dies at the start; on the Start window a question
  answers Not now by itself after a minute, so Lantern still starts.
- **Lantern itself comes with the install.** Tested on a Windows laptop, the
  installer fetched the models and Wikipedia, but Lantern was missing: the kit
  had always expected the repository's `site/` beside it (or a copy made by
  hand), and a `kit` folder on its own had none. Setup now looks for Lantern
  first (`kit/site`, then the repository's `site/`); when neither is there it
  downloads the main branch from GitHub (about 10 MB), checks it holds Lantern
  and puts `site/` into the kit, with `lantern-version.txt`. `setup-kit lantern`
  fetches the newest (an update), keeping the one in use until the new one is
  in place. Start says plainly when Lantern is missing instead of starting the
  engine with nothing to serve; `check` names Lantern's version and place.
  Shell and PowerShell both; the Linux window shows it as the first step.
- `setup-kit.sh info` gives the window the facts as key=value lines.
- Tests: `kit_offer.py` adds the window's questions and answers, the popups
  (a stand-in zenity), an engine that cannot start, building it (a stand-in
  source tree) and the symlinks; it also runs on a Raspberry Pi now (arm64
  engine stand-in). New `kit_window.py` runs the window on Xvfb: a whole
  install, installed again, start/share/stop, already running, offline, start
  before install, and both launchers opened as libfm and GLib open them.

## 1.13.1 (bench) — Bench run 9: what Lantern could fix (2026-10-26)

Adam's run 9 (Qwen3.5-35B-A3B, sees images, English Wikipedia, 1.12.9):
**98 of 109 (90%)**. Core 32/32, fresh 4/5, hard 9/10, library 20/20, made
10/14, conversations 16/18, puzzles 7/10. The six puzzles asked again with
the puzzle tools switched off ("alone", not scored): 3/6.

**The questions asked twice** were those six puzzles: once with Lantern's
puzzle tools, once without, to show what the tools add. The results table
did not say which row was which. In two pairs the result was backwards: the
two-coin cups failed with the tools and passed without them, and the
refrigerator letters failed both ways. Both were Lantern-side, as were
most of the other misses.

- **The results say which is which.** Each puzzle row is marked "with
  Lantern's puzzle tools" or "the same puzzle with Lantern's puzzle tools
  switched off — not scored".
- **The bench keeps the puzzle blocks.** Each row records every TRACK, TURN or
  SOLVE block the AI wrote, line by line, with what Lantern made of it. This
  run could not show the cups block; the next will.
- **Two-coin cups: a described place written as a name.** Every block that
  gives the run's wrong answer (Yellow, Green, Red, White, Blue, silver under
  Red) puts the silver coin under Red in step 4. The question says "the cup
  directly to the left of the cup holding the gold coin", which is Blue by
  then. The AI worked out the cup itself, against its instructions, and
  TRACK tracked it faithfully. Lantern now compares the block with the
  question (`AI_PUZZLE_CHECK`). A step line that names a cup the numbered
  steps never name goes back once, with the reason. Solvers can add such
  checks: `check(block, question, result)`.
- **The queue: "directly behind".** TRACK read left of, right of, 2 left of
  and holder of, but not behind, in front of, ahead of, before or after. It
  rejected "swap holder of ball and person directly behind holder of ball"
  twice, and the block itself was left as the answer. Those words now work:
  in a queue, front is first. A corrected block that fails too now gets one
  more turn: "work the puzzle out yourself, step by step".
- **Refrigerator: results retyped, and restated.** With the tools, the AI
  wrote `=REMOVE("rotarigerfer","r")`, retyping line 1's "rotaregirfer"
  with its own slip instead of ANS. Without them, it used ANS, then wrote
  "otaeigef ... 8 letters" in its sentence. Lantern only noted the mismatch.
  Now (`AI_RESULT_CHECKS`), once:
  - a = line that types out an earlier result with mistakes is questioned
    ("write ANS1 instead of typing a result out");
  - an ANSWER with no {result} that spells a worked-out word another way, or
    states a number none of the lines gave, is questioned.

  The ANSWER can name any line's result: `{ANS1}`, `{ANS2}` ... (`{result}`
  is still the last line), a word or a number. Chat's instructions say so.
- **READ at the end of an explanation.** The AI wrote two sentences, then
  `READ: page 5`, and Lantern ignored it. A command line counted only when
  it opened the reply or the reply was under 240 characters. That was
  1.11.0's rule for LESSON and MODULES, copied into READ and EXAMPLE. A
  command line that ends the reply now counts too (all four commands). One
  in the middle of a long answer still does not.
- **3 dozen eggs: Lantern answers the NEED.** The AI asked "NEED: How many
  eggs are in 3 dozen?" (`AI_NEED_ANSWERS`, `Lantern.aiNeedAnswer`).
  - Counting words are answered when they are asked about: dozen, score,
    gross, pair, ream, decade, century, fortnight.
  - So is "how many <unit> in a <unit>" that CONVERT knows.
  - Assist and Chat send the fact back for one more turn.
  - What only the person knows ("how many goats do you have") is still asked.
- **Fuel for a trip.** The AI worked out 15 km/L, then 28 L, then multiplied
  by the 10 litres again (280). New recipe card `trip-fuel`.
- **Things the AI makes** (`AI_MAKE_LAYOUT`), each sent back once:
  - **Painted-over shapes.** In the house, two rects drawn last covered the
    walls, the door and the window completely. A filled shape with nothing
    left in view is named.
  - **Above and below.** "A yellow sun above a blue sea", with a blue rect
    filling the picture, is questioned. Shapes are told apart by the
    colours the question names.
  - **Drawing instructions:** later shapes cover earlier ones; things above
    or below each other get their own areas; a roof is a tri on top of the
    walls.
  - **A total is a note, not a part.** The parallel circuit's total
    resistance was drawn as a fourth resistor (`part R_total resistor
    "{=...}"`).
  - **A procedure's steps go in a numbered list.** Plain lines print as
    separate paragraphs with no step numbers.
- **The bench's MAKE path shows a seeing model its picture**, as Chat
  always has: one look, LOOKS RIGHT or a corrected block, which is kept when
  Lantern can make it. Rows record `looked`.
- **Graders.**
  - `doc-not-covered` now accepts "Not in the document. From my own
    knowledge: warranties typically run 1 to 5 years..." (1.12.9's labelled
    own knowledge). It still fails a warranty given for this compressor.
  - `make-sun-sea` takes the lowest blue area as the sea, so a light blue
    sky above it is fine.
- **Which Lantern ran.** Run 10 was 1.12.9 again, word for word the same
  115 replies (the 35B at temperature 0 repeats itself exactly). The kit
  shows Lantern from its `site/` folder, so a new `Lantern_Office_Suite.html`
  on the stick changes nothing. The bench summary line now says
  "Lantern 1.13.1" right after the score, and the panel says which version
  it is before a run. `start-lantern` prints the folder it shows Lantern
  from (the Mac/Linux script also prints the version found there).
  (1.13.2 replaced the update steps given here with one Lantern folder.)

Not changed: the die and the four houses failed only without the tools,
which is what that comparison is for.

Tested:
- `tests/bench_run9.js` (37 checks) replays the run's own replies:
  - the cups block questioned, then corrected and passed;
  - the queue block run;
  - a block that fails twice answered by the AI;
  - both refrigerator replies questioned, and the `{ANS1}`/`{ANS2}` reply
    passed;
  - READ, LESSON and EXAMPLE lines at the end of a reply read;
  - the NEED answered in Assist and Chat (432);
  - the fuel card;
  - the house, sea, total and procedure questioned, with every ideal reply
    in the bench still building clean;
  - the look turn kept and changed;
  - the warranty grader;
  - the table labels and the recorded blocks.
- Two existing assertions changed with intent: a READ ending a long reply
  is now read, and the sun-sea check accepts Lantern's own message.
- `tests/browser/bench_run9_e2e.py` (not in `npm test`) runs the full bench
  in Chromium against a stand-in llama-server that sees images:
  - the labels;
  - the cups corrected and passed;
  - the full-picture sea sent back, then shown to the model as a real PNG
    and kept;
  - the queue;
  - the dozen.
- All 26 suites pass.

## 1.13.0 — Code Lab: real programs, checked; the AI writes them (2026-10-23)

Adam asked for a coding module with more power than the turtle: Arduino,
Python, JavaScript, Structured Text and ladder, easy to switch between, with
links to where each language's tools are installed; its own tile, with the
turtle kept for beginners; the AI able to write programs into it. This is
stage 1. Stage 2, next, is a simulator.

- **Code Lab tile** (after Turtle Code on the home screen).
  - An editor with colours, line numbers, Tab and Shift+Tab indenting,
    auto-indent, Ctrl+/ comments, and Find and replace.
  - Files kept on the device: New, Rename, Delete, Open file…, Save to
    computer (.ino, .py, .js, .st, .lad). The language can be switched at
    any time.
  - **Check** lists problems with their line numbers and marks those lines
    red in the margin. It looks for:
    - Arduino: no setup() or loop(), a missing ;, a library without its
      #include, a pin written before pinMode, Serial before Serial.begin,
      = in a condition, analogWrite on a pin with no PWM, millis() kept in
      an int, delay() in an AccelStepper sketch, P1AM used before P1.init().
    - Python: a missing colon, bad or mixed indents, Python 2 print,
      = in a condition.
    - JavaScript: anything that stops it compiling.
    - Structured Text: blocks left open, a missing THEN or DO, = used to
      assign, a missing ;, undeclared names, reserved words used as names.
    - Ladder: unknown instructions, wrong argument counts, empty branch
      legs, rungs with no output, one coil driven from two rungs, a tag used
      as both a timer and a counter.
  - **Run** for JavaScript, in a sealed Web Worker: no access to the page
    or the person's files, a 2-second limit, at most 500 lines of output.
  - **Ladder**: rung text (`[XIC(Start) ,XIC(Motor) ]XIO(Stop)OTE(Motor);`)
    is drawn as rungs. **Ladder → Structured Text** turns it into an
    IEC 61131-3 program in a new file.
  - **45 tested examples.**
    - Arduino (21): Blink to state machines, servo, 28BYJ-48, AccelStepper
      on A4988/DRV8825/TMC2209, homing, TMC2209 over UART, I2C and parallel
      LCDs, DS18B20, DHT22, HC-SR04, an I2C scanner. Each was compiled and
      linked for an Uno against the real Arduino core and libraries.
    - P1AM-100 (3): checked against the real P1AM library.
    - Python (6, three for the Raspberry Pi): run, with gpiozero's mock pins
      and a loopback serial port.
    - JavaScript (4): run.
    - Structured Text (6) and ladder (5): compiled with matiec.
  - "Build and run it on a computer" shows each language's free tools with
    their addresses written out: Arduino IDE and CLI, the P1AM-100 boards
    URL, Python, Thonny, Raspberry Pi OS, MicroPython, Node.js, OpenPLC,
    Beremiz and CODESYS.
- **Turtle Code.** The old Code tile keeps the turtle and is now labelled for
  first programs, for beginners and children. Its guide points on to Code Lab.
- **The AI writes programs (MAKE CODE).**
  - A program comes in a block: `MAKE CODE: <title>`, `language …`, the code
    with its indents, `END`.
  - Lantern checks it and sends the problems back once. It shows the code
    once, in colour, with Open in Code Lab and Save to computer, and Run
    here for JavaScript. The reply bubble points to it instead of repeating
    it.
  - When a tested example fits the question well, it goes into the AI's
    instructions. The AI can also ask for examples with `EXAMPLE: <words>`.
  - Lantern says where the code came from: "adapted from Lantern's tested
    example …" (a third or more of its lines, not counting lines every
    sketch has), or "written by the AI from its own knowledge". Either way
    it adds "checked by Lantern, not compiled or tested".
  - Code written straight into a reply in a fenced block is checked too,
    with the same buttons. Output, shell commands and data in fences are
    left alone.
  - A new Chat hook, `Lantern.chatReplyViews`, puts views under a finished
    reply.
- **Lantern Bench: 7 program questions.** Blink without delay, AccelStepper
  back and forth, a P1AM seal-in, a Python CSV average, Ohm's law in
  JavaScript, a Structured Text tank fill, and a ladder start/stop. Each
  checks what matters, such as millis() rather than delay(), or a seal-in in
  a branch. Every ideal reply was compiled or run.
- **Help.** Code Lab's guide covers the editor, checks, examples and
  languages with install links, then Arduino setup, the libraries the
  examples need, the P1AM-100 boards, a Raspberry Pi with Python, Structured
  Text in PLC tools, and a ladder rung-text reference. The guide is one of
  Lantern's lessons, so `LESSON: install arduino` finds it.
- **The two screenshot fixes** (from the AccelStepper answer in 1.12.9's
  Chat):
  - An answer from the AI's own knowledge that uses nothing from the
    passages no longer gets a long "own reasoning" list; its sources header
    says the answer uses nothing from them.
  - Code lines are no longer checked as sentences.
  - Any own-reasoning list is capped at 8 lines.

## 1.12.9 — Chat answers from the AI's own knowledge, labelled (2026-10-23)

From Adam's Chat. Two questions were refused even though the 35B knew both
answers: "provide a standard example based on general knowledge of these
components" (Arduino, AccelStepper, a TMC2209 driver) and "How do I set the
date and time on an rpi400". The model replied "my rules strictly require that
all facts and data come only from the provided library passages", and "Not in
my library" after a search that found nothing useful. Chat's instructions said
facts come only from Lantern's functions. That was too strict for code,
how-to steps and commands that the encyclopedia doesn't cover.

- **New rule for Chat's AI.**
  - It still uses Lantern first: = lines for numbers, LOOKUP for facts,
    Lantern's lessons, MAKE for things.
  - When Lantern has nothing, it answers from its own knowledge and begins
    that part with **"From my own knowledge:"**.
  - The library's, the lessons' and a document's "reply exactly: ANSWER:
    Not in my library" become "say so, then, if you know the answer, give
    it anyway, starting with 'From my own knowledge:'". This rewrite is
    applied only on the way to Chat's model.
  - "Not in my library" stays for what no one could know offline
    (tomorrow's prices, today's news, a local phone number or office holder).
  - The safety rules for medicine doses, live mains work and mixing
    chemicals are unchanged.
- **Lantern labels it.** Under every answer that is the AI's own knowledge,
  an amber note says it did not come from Lantern's library or tools, so
  Lantern did not check it. The note also appears when the AI forgot to say
  so: no library, no tools and no MAKE behind a real answer. Questions about
  the AI or Lantern keep their own single note.
- **Numbers.**
  - A general fact the AI knows (steel at about 7850 kg/m³), used in = lines
    and said to be its own, is no longer questioned.
  - A value only the person knows (their battery, their tank) is still
    asked for with NEED. The question back to the AI now spells out that
    choice.
- **Records and the bench.**
  - An own-knowledge answer is not counted as a refusal (`declined`). Chat
    records `own`.
  - The library checks treat "From my own knowledge" as no claim on the
    passages.
  - New bench conversation `chat-own-knowledge`: setting the clock on a
    Raspberry Pi from the terminal, answered and labelled.
- **Code in Chat.** Code in ``` fences shows in a fixed-width font,
  without the fence lines.
- **Assist** (the calculator-style app) keeps its strict rules.
- **Tests.** 13 new checks in `tests/chat_routing.js`:
  - the instructions;
  - the rewritten library line;
  - the Pi 400 and AccelStepper cases;
  - an unlabelled answer still labelled;
  - the mayor still declined;
  - steel's density versus "my battery";
  - the library checks;
  - one note for questions about the AI;
  - Assist unchanged;
  - the label's style;
  - fenced code;
  - the bench conversation.

  Replayed in Chromium with your three questions.

## 1.12.8 — Lantern waits for the kit's model, with a progress bar (2026-10-23)

From Adam's USB kit. start-lantern launched llama-server and opened Lantern
8 seconds later. The 35B model then took about 2 min 20 s to load from the
stick. In that time llama-server (b11435) sends the page but answers every
other request with 503 "Loading model". Lantern checked for a server once,
saw no model, fell back to "On this device" and never looked again. The page
had to be closed and opened. Nothing on screen said the model was loading,
so it was easy to think it had hung and close it.

- **A loading screen with a progress bar.** While the model loads, a screen
  over the apps shows:
  - the model's name and size;
  - a progress bar;
  - the time so far and about how long is left;
  - a request to keep the page and the black Lantern window open, because
    closing either stops the load and it starts over.

  "Use the other apps while it loads" shrinks the screen to a corner button
  ("AI loading 47% — details"). The apps work without the AI meanwhile.
- **It connects by itself.** Lantern asks the server's /health every second.
  The moment the model is ready it connects (model name and vision too), the
  bar fills, and the screen goes. No reload is needed.
- **The estimate.** The start scripts now open the page as soon as the
  server answers. They pass the model's file name, its size, the vision
  part's size and the time the server started (`?kit=1&model=…&bytes=…&t=…`;
  Lantern removes these from the address bar). So the first estimate comes
  from the file size at about 120 MB a second. After that, Lantern remembers
  how long each model took and uses that. Past the estimate the bar slows and
  does not reach the end until the model answers. The scripts' black window
  also says the model takes a while and to keep it open.
- **Other cases.**
  - A page opened by hand (a phone on the Wi-Fi, a reload) gets the same
    screen.
  - A saved page opened while the server is off shows only a quiet corner
    button ("AI server not answering"), and only if this address has had a
    model before. It brings up the screen if the server starts.
  - GitHub Pages and plain file hosts show nothing.
- **Asking while it loads:** Chat now says "the AI model is still loading",
  with no advice about endpoints. The AI app says "the Lantern server on
  this computer (the model is still loading)". The on-device panel no longer
  shows a red "engine could not start" error during the load. It fills in
  once the server is ready.
- **Tests.**
  - 22 new checks in `tests/ai_server_wait.js`:
    - loading, then ready, without a reload;
    - the estimate and the remembered load time;
    - the corner button;
    - asking while it loads;
    - the server off, then starting;
    - no server at all.
  - The kit test now checks the address start-lantern.sh opens and the
    Windows script's hints.
  - Both new modules are tested in isolation.
  - Replayed in Chromium against a stand-in llama-server that behaves like
    b11435 (only the page while loading, 503 for the rest).

## 1.12.7 — Wheel charts; words on a drawing checked; junctions that were never declared (2026-10-22)

From Adam's next Chat with the 35B. The parallel and series schematics came
out right, with their formulas worked out on the picture. The parallel one
took a retry first: the block wired `A1` to `junction1` but never declared
`junction1` as a part. Then came "draw the ohms law power wheel calculator
for educational purposes". The 35B wrote 27 text lines on Draw's grid and
made a gray disc with letters in a grid. Formulas ran into each other
("I=V/R V=√(PR)" read as one), eight were written twice, and three were
missing. On the look turn it said LOOKS RIGHT.

- **MAKE WHEEL**, a new kind. The AI lists the parts, one line each:
  `P watts: P = V x I | P = V^2 / R | P = I^2 x R`. Lantern does the
  sines and cosines. It cuts the circle, paints each part, and sizes every
  word to fit inside its wedge, all items at one size. A long formula breaks
  onto two lines, but never inside its brackets. It shows powers and roots
  as ² and √. Optional `centre`, `note` (with {= ...} worked out) and
  `fill <colour>` lines are allowed. The wheel opens in Draw as ordinary
  shapes. A part named after a colour (Red, Blue …) is painted that colour,
  with white words where it is dark. The AI is told to use MAKE WHEEL, not
  MAKE DRAWING, for a wheel or any labels round a circle. A car's wheels or
  a grinding wheel still go to MAKE DRAWING.
- **Formulas on a wheel are checked.** A formula must sit in the part of
  the letter it works out. No formula may appear twice. On an Ohm's law
  wheel (P or W, V or E, I, R), each formula is worked out by the formula
  engine with V = 12, I = 3, R = 4 and P = 36. A wrong one goes back:
  "P = V x R is not right: … it gives 48, not 36". Right-hand sides alone
  ("P: E x I | I^2R") are checked as that letter's formulas.
- **Words on any MAKE DRAWING are checked.** Text that runs into other
  text, text cut off at the left or top edge, and a formula written twice
  go back to the AI once, with grid positions. When the request is for a
  wheel, the message also points to MAKE WHEEL. The drawing prompt says how
  much room words need (about one cell for every three letters at size 20).
- **The look turn asks whether every word is readable**: none running into
  another, cut off or written twice.
- **A wire to a junction or ground that no part line made** (`junction1`,
  `J2`, `node`, `GND`) now makes that part, so there is no retry.
- **Tests.**
  - 18 new checks: Adam's 27-line drawing; the wheel's layout (no
    clashes, each formula inside its own wedge); the formula checks; a word
    wheel with a centre; a colour wheel; the prompt routing; and the whole
    Chat turn (the drawing sent back, the wheel made).
  - The power wheel joins the bench as its 14th make question.
  - The five new modules are tested in isolation.
  - Replayed in a browser: the undeclared junction1 schematic draws first
    time, and the power wheel opens in Draw.

## 1.12.6 — A ground as the return; the formula goes on the drawing (2026-10-22)

From Adam's next Chat: "draw an electrical schematic showing ohms law in
parallel ... with the formula shown to calculate the resistances". The
35B wired both resistors and the source's return to a ground (wire R1 G1,
wire R2 G1, wire V1 G1), and the drawing came out tangled. It worked the
formula out in = lines in its reply, which Lantern does not run next to a
MAKE block, instead of putting it on the drawing.

- **A ground used as the return to the source** is folded like a junction.
  Each load is wired back to the source's other terminal, and the ground
  symbol hangs on that return. A ground on the way round (battery,
  resistor, ground, battery) is a join too, and keeps its symbol. Both
  now draw as a closed loop or a ladder.
- **Asked for the formula, and the block has no notes?** The block goes
  back once: "the person asked for the formula on the drawing: add note
  lines". The AI is also told to put formulas and values in note lines,
  not in = lines or the answer.
- **Ladder rungs have their names beside them**, clear of the two rails.
- **Tests.** The ground-return block from the Chat, the series ground, and
  the formula request with and without notes. Replayed in a browser, the
  35B's first reply is sent back once and the corrected block shows
  "Req = ... = 66.67 ohm" and "I = ... = 0.18 A", both worked out by
  Lantern.

## 1.12.5 — Ohm's law in parallel: a clean ladder, meters, formulas on the picture (2026-10-22)

From Adam's Chat with the 35B.
- "Draw an electrical schematic that demonstrates Ohm's law in parallel":
  the first block used an ammeter, which Lantern did not have. The
  corrected one put three resistors on a junction, and that drew as a
  tangle.
- "The picture needs the formula with the circuit resistances shown": the
  AI worked the values out with = lines. Lantern questioned numbers that
  came from the AI's own schematic. The AI then asked NEED for the
  voltage, and "voltage source" sent Lantern to the encyclopedia ("Not in
  my library").

What changed:
- **Junctions folded into the wires** (new AI_SCHEMATIC_MORE). What flows
  into a junction is wired to what flows out of it, so the three
  resistors hang one under another like a ladder (the join keeps its
  dot). A part in parallel now hangs under a load rather than under the
  source.
- **Ammeter and voltmeter.** They are schematic parts ("ammeter", "amp
  meter", "voltmeter", "multimeter") and new symbols in Draw's Electrical
  mode.
- **note lines.** `note <text>` puts a line of text under the drawing (a
  formula or values for teaching). Each `{= ...}` in it is worked out by
  Lantern's formula engine, so the numbers on the picture are computed,
  not typed. A note that cannot be worked out is sent back. The AI is
  told it can redraw with notes.
- **Checks.**
  - Numbers in a MAKE block made earlier in the chat count as given.
  - A step whose value the answer states counts as used.
  - A NEED counts as a call for the encyclopedia only for "sources of
    facts", not for a voltage source.
- **Bench**: a 13th make question, a parallel circuit for a lesson with
  the total resistance shown on the picture (2 ohm).
- **Tests.** The Ohm's-law conversation replayed: the junction folded,
  meters, notes, and the follow-up not questioned, with no NEED and no
  library. The Project Context gate passes: 300 modules, 0 errors, 44
  size warnings. 81 AI modules are isolated.

## 1.12.4 — The AI knows it can make documents and PDFs, also in a follow-up (2026-10-22)

From Adam's next Chat. He pasted the manual picture and asked to "fix the
image and make a corrected pdf of it". The 35B said it could not make a
PDF and gave the corrected text in the reply instead. "Proceed with
creating a document using the Writer module" then fetched a lesson on the
writing process (LESSON: document write).

- **MAKE DOC says what it is for.** Lantern shows the document with Open in
  Writer and Save .pdf, so it is how the AI makes a Writer document or a
  PDF. It is to be used rather than LESSON when a document is wanted. The
  command list says "Save .pdf makes a PDF".
- **More ways of asking** (AI_DOC): creating, making, writing, saving, a
  corrected copy or version, "using the Writer module".
- **MAKE: <kind>** (new module AI_MAKE_ASK). When the question does not
  bring the MAKE instructions, the AI is told in one line what Lantern can
  make (a document can be saved as a PDF). For a follow-up such as "go
  ahead", it may reply MAKE: document (or slides, flashcards, plan,
  drawing, schematic, table) to get the format, then make it from the
  conversation.
- **Tests.** Adam's three phrasings, the one-line offer, everyday kind
  words, and a two-turn Chat ("What should a notice say?" then "yes, go
  ahead") that ends with a document and Save .pdf. The Project Context gate
  passes: 299 modules, 0 errors, 44 size warnings. 80 AI modules are
  isolated.

## 1.12.3 — Puzzles: take a coin out, the end cups, the middle cup (2026-10-22)

From Adam's two-coin cup puzzle in Chat. The 35B wrote "take silver from
holder of silver" and then "take silver from White". TRACK did not read
either line, although its own error message listed "take". The AI then
answered alone. It also wrote "swap Red and White" for "the two end cups
swap", naming the cups it guessed were at the ends rather than the ends.

- **take silver from White** (also "out of", "from under", "off"). The coin
  comes out of its cup, so that a later "put silver in ..." places it
  again. Taking it from the wrong cup is caught ("silver is with Blue, not
  White").
- **swap first and last**. "The two end cups swap", "swap the ends" and
  "swap the end cups" all read as swapping the first and last cups.
  "Blue and White swap" reads like "swap Blue and White".
- **holder of middle**, **holder of Blue**: a place or a cup named after
  "holder of" is that place or cup.
- **The AI is told to write places the way the puzzle says them** at that
  step (first and last, middle, holder of gold), never the names it thinks
  are there by then. Lantern works out who is there. The help lists
  "take silver from White" and "swap first and last".
- **Tests.** The puzzle as the 35B wrote it, and as the question words it,
  give Yellow, Green, Blue, Red, White, with gold under Green and silver
  under Blue. Taking a coin from the wrong cup is caught.

## 1.12.2 — Make things from an attached document; Save .pdf (2026-10-22)

From Adam's Chat with his upside-down scan of a grinder manual. The AI
corrected the text on its own, but said it could not make a PDF or use
Writer. While a document was attached, every question had been treated as
a question about it. "Turn this into a PDF", "rewrite it in the writing
module" and "write it in the text writer" did not trigger MAKE DOC. The AI
only ever had 3 of the page's passages, with no way to ask for the rest.

- **A request to make something wins over the attached document**
  (TEXT_READER_CHAT, TEXT_READER_PROMPT). The AI gets the document's whole
  text (up to 12 passages) and the MAKE instructions, not "ANSWER / Not in
  the document". It is told to correct words Text Reader misread where the
  sentence makes the right word clear, and to keep codes and numbers as
  printed when it cannot tell.
- **MAKE DOC listens for more ways of asking** (AI_DOC): rewrite, retype,
  correct, proofread, transcribe, turn into / convert / save as a PDF, "in
  Writer", "the text writer", "the writing module", "word processor".
- **Save .pdf** (PDF_DOC_LAYOUT, PDF_DOC). A PDF file straight from a
  document, with no print box: headings, paragraphs, bullet and numbered
  lists (nested), tables with ruled cells, bold and italic. It uses the
  standard Helvetica, so nothing is embedded. Pages are Letter or A4, with
  page numbers.
  - It is in Writer (a Writer tool) and beside **Open in Writer** under
    every document the AI makes.
  - Signs the standard fonts lack are written out (Ω as Ohm, → as ->).
- **READ: all.** The whole of a short document (all of a one-page scan),
  or the next unread section of a long one. When the AI has only some of a
  page's passages, it is told how many there are and how to get the rest.
  "Can you request the full text?" counts as a question about the document
  itself.
- **Sentences about the document as a whole** ("Yes, I have the page Text
  Reader read: part of a grinder manual") are no longer flagged as false
  citations. When nothing cites a passage, the check says so instead of
  "0 of 1 backed".
- **Text Reader on the real scan** (829×1160 px, upside down and slightly
  curved): 7.3% of characters wrong in 1.12.0, 3.3% in 1.12.1, 2.3% now.
  - Codes keep their digits (lO-3 → 10-3, 12-l( → 12-1(, xl6 → x16).
  - A list number run into its first word becomes 1 (I.Pressing).
  - A d with a comma touching it is no longer read as 4 (finishe4then).
  - Letters touching an f are fixed (fflnction, flmction → function),
    preferring words the same document prints clearly.
- **Tests.** Adam's three requests, the whole text for making, READ: all,
  a description of the document, and the PDF file itself (header, every
  object where the cross-reference table says, fonts, bullets, table
  rules, page numbers). The Project Context gate passes: 298 modules,
  0 errors, 44 size warnings.

## 1.12.1 — Turned and skewed screenshots read properly; honest confidence (2026-10-22)

From a test: a screenshot of a grinder manual page, upside down and a
little skewed. Lantern turned it the right way up, but read words such as
"flmction", "l@2" and "Ω" for "Th", and still called it 92% sure. In Chat,
"Can you see the text from the page Lantern read?" was handled as a fact
question.

- **Small print is enlarged before it is levelled** (TEXT_READER,
  TEXT_READER_IMAGE). Before, a tilted page was turned at its own size and
  then enlarged. At screen size that blurred the letters together.
  - Error rates on a reconstruction of the test page (15-16 px text, turned
    180° plus 2.5-3°): from 6.9-7.9% down to 0.4-1.2%. With extra blur:
    from 37-44% down to 2.7-10.8%.
  - The two earlier test sets are unchanged or better: 0.33% (was 0.40%)
    and 0.32% (was 0.31%).
- **Touching letters.**
  - A piece cut from a blob may now be a hyphen or a bracket, so 10-2,
    (but and wheel) come apart.
  - A blob that reads as a rare mark (& @ # Ω) is always tried as two
    letters.
  - m&e becomes mode and Ωne becomes fine, but only when the result is a
    word Lantern knows.
- **Blurred i.** A capital I inside a small-letter word (wIll, IndIcatIng)
  becomes i or l, whichever makes a word.
- **Lost spaces.** Words run together where blurred print lost its spaces
  ("headwillrise") get their spaces back. This only happens when the run is
  three or more everyday words.
- **Honest confidence.** These readings are no longer counted as "sure":
  - a mark inside a word (red);
  - a digit between letters (amber);
  - a near miss of a known word whose letters fit poorly (amber). Text
    Reader lists these as "May be misread: flmction → function", and
    **Use these** puts the suggestions into the text.
- **Chat: questions about the document itself** ("can you see the text?",
  "how well was it read?").
  - The AI answers in its own words about what the document is and what it
    covers. It is no longer pushed into the ANSWER / QUOTE format.
  - The AI is told which words Text Reader was unsure of.
  - "Yes" and "no" no longer need a quote that says them. This removes the
    false "no quote says yes" warning.
- **New modules** TEXT_READER_CHECK (the word repairs and confidence) and
  TEXT_READER_MISREAD (the "May be misread" note). Both are split out to
  keep TEXT_READER_WORDS and TEXT_READER_VIEW small. The Project Context
  gate passes: 296 modules, 0 errors, 44 size warnings.
- **Tests.** Two upside-down skewed screenshots were added to the browser
  test (limits 2% and 2.5%), plus checks for the word repairs, the
  confidence rules and the Chat question about the document.

## 1.12.0 — The AI makes documents, slides, flashcards and plans; READ (2026-10-22)

Built on 1.11.1, which is merged into this release.

- **MAKE DOC → Writer** (AI_DOC). Ask Chat for a letter, notice, report or
  procedure. The AI writes plain lines: `##` headings, numbered steps,
  `-` bullets, `|` table rows and `**bold**`. Lantern turns them into a
  Writer document.
  - A document that is too short or cut off is sent back once.
  - Compose's writing checker reads it, and its findings (spelling,
    grammar, punctuation) are listed under the preview.
- **MAKE SLIDES → Slides** (AI_SLIDES). `#` starts a slide and `-` adds a
  point. Lantern checks every slide has a title and something under it, at
  most 7 short points a slide and at most 25 slides.
- **MAKE CARDS → Flashcards** (AI_CARDS). One card a line as
  `front | back` (also `::` or Q:/A: pairs). Lantern checks every card has
  both sides, no card is there twice, and no answer just repeats its
  question.
- **MAKE PLAN → Planner** (AI_PLAN). One line each:
  `when | what | how often`.
  - The AI says *when* in words (today, in 3 weeks, next Monday,
    1 December) and Lantern works out the dates itself.
  - A date in the past, an unreadable date or a repeat the Planner does not
    have (every 2 weeks) is sent back.
- **One tap opens it.** Each result is shown in Chat first, with
  **Open in Writer / Slides / Flashcards** or **Add to Planner**. Nothing is
  saved until the tap, and a second tap only opens it again.
  - New host doors: `Lantern.slideDocs`, `Lantern.cardDocs` and
    `Lantern.plannerDocs`, next to `writerDocs` and `sheetDocs`.
  - The command list says which app each MAKE kind opens.
- **READ: for documents** (TEXT_READER_READ). With a long document
  attached, the AI can ask for another part: `READ: page 12`,
  `READ: pages 3-5`, `READ: section 2` or `READ: <words to find>`.
  - Pages not read yet are read first, and the answer is checked against
    them like any passage.
  - Chat's instructions say a document is attached, how many pages it has
    and which have been read.
  - Each passage block says which pages it came from and offers READ
    before "Not in the document".
  - "The last page" and "the first page" are page numbers, in a question
    and in READ.
  - A question about the document that shares no words with what was read
    gets its opening passages, so the AI can see the contents and READ on.
- **TEXT_READER_PROMPT** holds the document prompt, split from
  TEXT_READER_CHAT. This keeps both under the Studio's 2,500-token size
  warning (44 warnings, as in 1.11.1).
- **Bench**: four new make questions (a printable procedure, a 4-6 slide
  toolbox talk, the seven SI units as flashcards, a compressor plan whose
  dates must come out right) and a document conversation that needs READ
  (the person says guarantee, page 5 says warranty).
- **Tests**: `tests/ai_make_docs.js` (53 checks); the action, routing,
  layer and isolation tests updated (75 modules isolated). The Project
  Context gate passes: 294 modules, 0 errors.

## 1.11.1 — The AI knows the whole suite; pictures in Chat (2026-10-22)

Built in a separate session on top of 1.10.0, then brought into the
repository unchanged. This repository's build pipeline reproduces the file
byte for byte.

- **The AI knows the suite** (SUITE_* modules). Lantern keeps one live
  catalog of everything it has: 44 tiles, 270 lessons, 38 help guides, 66
  formula functions, 26 recipe cards, 23 flashcard decks, 40 templates, 18
  Compose tasks and 13 Chat commands. The catalog is built from the
  registries each module fills as it loads, never typed by hand.
  - Chat's instructions name every tile.
  - A question about Lantern itself ("what are your capabilities", "does
    Lantern have a farming module") gets the catalog, with buttons that open
    each entry.
  - A how-to question gets passages from the best lessons first, checked
    like library passages.
  - The AI can ask for more with `LESSON: <words>` and `MODULES: <topic>`.
- **Pictures in Chat** (CHAT_PICTURES, IMAGE_SHRINK).
  - A screenshot can be pasted, dropped or picked.
  - A model that sees images gets the picture, shrunk to at most 1280 px.
  - For a model that does not, Text Reader reads the text in the picture
    instead.
- **New Chat hooks**: `Lantern.chatSystem`, `chatAbout`, `chatCommands` and
  `chatPictures`. Also new: `Lantern.guide.list/get`,
  `Lantern.mathLessons.get` (and lesson `meta.app`) and
  `Lantern.formula.names()`. Ten engineering and RF functions now have
  descriptions in the AI's catalog.
- **Project Context Studio compatibility.**
  - Parentheses, brackets, braces and slashes inside regex literals are now
    written as \x28 \x29 \x5B \x5D \x7B \x7D \x2F. The Studio's gate
    strips strings and comments but not regex literals, so those characters
    unbalanced 17 modules.
  - Seven circular "Depends:" headers were reworded. Example: AI_ACTIONS
    named AI_DRAW, which depends on AI_ACTIONS.
- **New test `tests/pc_compat.js`** (part of `npm test`). It checks what the
  Studio's splitter and merge gate check: markers, circles in the Depends
  headers, and brackets outside strings with regex literals not understood.
  1.10.0 had 24 errors; 1.11.1 has none. 44 modules are over the 2,500-token
  size warning.
- **Tests:**
  - The isolation test covers the 15 new modules (67 in all).
  - Chat routing grades the four new bench conversations about Lantern
    itself.

## 1.10.0 — Text Reader: printed text from pictures, scans and PDFs (2026-10-21)

Lantern can now read. Pictures of pages, photos of labels and nameplates,
screenshots and scanned PDFs become text the person can search, correct and
save, and the AI can answer from. It is plain JavaScript with no font files,
no training data and no download. The idea came from the sheet music reader
built for the music studio: find the structure printed on the page and
measure against it.

- **Text Reader tile.** Open pictures or a PDF, take a photo, drop files, or
  paste a screenshot (Ctrl+V).
  - Long documents are read in sections (5, 10, 20 or 50 pages), so a whole
    manual can be worked through on a small device.
  - Each page shows the picture with a box round every word: green when
    sure, amber when fairly sure, red when guessing.
  - Corrections are learnt and remembered.
  - Save as text, open in Writer, save as a **searchable PDF**, or save every
    word with its position (JSON).
  - **Second reader.** When the AI in use can see pictures, it reads the page
    on its own; Lantern lines the two readings up word by word and marks
    every difference for the person to settle.
- **How it reads** (one module per step):
  - **Clean the page.** Evens out lighting, inverts dark-mode screenshots,
    straightens tilted scans, turns pages that are sideways or upside down,
    stands italic print upright, and removes ruled lines and frames.
  - **Find the layout.** Columns, paragraphs (cut only at a blank line),
    lines, letters and words. A gap counts as
    a space only beyond what the font itself leaves between those two
    letters, so the wide gap after a "1" is not a space.
  - **Recognise letters.** The browser draws every letter of the fonts
    installed on the computer. Lantern compares shape, position on the line,
    width and holes, then learns the page's own letters as it goes, so a
    font it does not have still reads well. Touching letters (rn, ti, ff)
    are cut apart, and letters broken by a thin stroke are joined; the word
    step decides which of these readings to keep.
  - **Choose words.** A word model learnt from Lantern's own text, plus
    numbers, units (kW, psi, ft-lb), codes (E-11), abbreviations (ISO),
    capitals after a full stop, and commas before small letters.
- **Accuracy on test pages.** The share of characters read wrong:

  | Test set | Lantern 1.10.0 | Tesseract (default settings) |
  |---|---|---|
  | 20 pages (scans, screenshots, unseen fonts, rotated, noisy, dark mode, two columns) | 0.40% | 0.24% |
  | 19 held-out pages (new text, browser screenshots, nameplates, a shaded photo, italic, typewriter) | 0.31% | 5.71% |

  These are synthetic pages. Real photos with perspective or curved pages
  will read worse.
- **PDF in.** Scanned PDFs are opened with no library. Supported picture
  formats:
  - JPEG.
  - zlib with PNG predictors.
  - LZW, ASCIIHex, ASCII85 and RunLength.
  - CCITT fax Group 3 and 4.
  - Grey, RGB, CMYK and palette colour, 1–16 bits.
  - Several picture strips on one page.

  Object streams, inherited resources and turned pages are handled. Pages
  that carry their own words (made on a computer, or scanned and read
  before) use those words: exact, with ToUnicode maps, encodings and glyph
  names. JBIG2 and JPEG 2000 pictures are reported as not readable yet.
- **PDF out.** A searchable PDF keeps each page as its picture, with
  invisible Helvetica words placed over each word. It was checked with qpdf
  and pdftotext.
- **Chat.** The 📄 button (or "Ask Chat about it" in the tile) gives Chat a
  document.
  - Each question then gets the document's most relevant passages, numbered
    like library passages ("DOCUMENT: passages from ...").
  - The AI's quotes and sentences are checked against the document.
  - "Not in the document" is a decline.
  - Naming a page reads that part first.
  - A picture of sheet music is read as notes.
- **Sheet Music Reader** in the Music tile. A rewrite of
  sheet_music_reader_v7:
  - Staff lines are removed where nothing crosses them; each note head's own
    centre gives its pitch.
  - Filled and open heads, chords and ledger lines are read, and tilted
    photos are levelled.
  - Treble, bass or piano staves; a chosen key signature.
  - Playback, MIDI and JSON export; "Ask Chat about it".
  - Pitches are read, not note lengths.
- **Handwriting** has its own module, `HANDWRITING_READER`, which is a stub
  for now. Text Reader hands it pages where most words are guesses.
- **Hooks**:
  - `Lantern.chatTools`: buttons beside Chat's Send.
  - `Lantern.chatContext`: passages from an attached document.
  - `Lantern.musicCards`: cards in the Music tile.
  - `Lantern.textReader`, `Lantern.pdf`, `Lantern.sheetMusic` and
    `Lantern.handwritingReader`.
- **Lantern Bench.** Four conversations about a compressor manual handed to
  Chat: an oil figure, a fault code, a follow-up, and a question the manual
  does not answer, which must be declined.
- **Tests:**
  - `tests/text_reader.js` (39 checks): the word model, layout on drawn
    bitmaps, glyph features, a fax G4 picture decoded pixel for pixel from a
    PDF with object streams, a page's own words with an embedded font,
    document passages, Chat answering from a document (made-up quotes
    caught), the second reader's word-by-word comparison, and the music
    staff finder, pitches and MIDI.
  - `tests/browser/text_reader_e2e.py`: real-browser reading of fixture
    pages with error limits, PDFs, a searchable PDF read back, and sheet
    music note for note.
  - The isolation test covers the 18 new modules, plus the new bench data.

## 1.9.9 — Lantern keeps track: puzzle tools for the AI (2026-10-21)

Six puzzles given to the 35B in Chat (1.9.8): it solved the original cup
shuffle, a four-house clue puzzle, a game-show door trap and a letters
puzzle, and got two wrong -- a two-coin cup shuffle (it kept the silver
coin at a place instead of in its cup) and a rolling die (it tipped toward
itself while writing "away", turned the wrong way round, and read a face
from an earlier state). Its translation of each move was right; its
bookkeeping was not. So, as with arithmetic, the AI now says *what*
happens and Lantern does the bookkeeping exactly.

- **Three puzzle tools, for any names.** In Chat the AI writes a short
  block and ends it with END; Lantern runs it, shows every step, and sends
  the results back for the ANSWER:
  - `TRACK:` things in a row and what they hold -- cups and coins, a queue,
    cars and passengers: `row`, `put gold in Green`, `swap A and B`,
    `swap contents of A and B`, `move A to last`, `shift right 1`,
    `reverse`, `add`, `remove`, `take`; places by name, position, first,
    last, middle, `2 left of X`, `holder of gold`, "two places to its left".
  - `TURN:` a cube with six labelled faces (a die -- three faces are
    enough -- or a box of colours) tipped away/toward/left/right and turned
    clockwise/counterclockwise/around; or a walker on a grid (forward, back,
    turn left/right/around, face east, go north 2) with its distance home.
  - `SOLVE:` clue puzzles -- a line of things, one line per category
    (`(repeat)` when values may repeat, `(order)` for an order), and one
    `rule` per clue: `Cara = fish`, `chef = 3`, `pilot directly left of
    cat`, `not Cara next to Ana`, `Ana in 1, 4`, `before`/`after`, `if ...
    then`, `iff`, `Ana.house + 1 = Ben.house`, or plain words ("The nurse
    lives somewhere to the right of Dev"). Lantern tries every arrangement,
    category by category, and says which one fits; if several do, where
    they differ (a clue is missing or mistranslated); if none does, which
    clue to check. Einstein's five-house puzzle takes well under a second.
- **The AI recognises the kind.** A question that looks like one of these
  gets that tool's instructions; every Chat prompt carries one line
  offering the tools (`PUZZLE TOOLS`), so the AI can ask when Lantern did
  not see a puzzle. A block Lantern cannot finish goes back once with the
  reason.
- **Letters, exactly:** `REVERSE`, `REMOVE` (letters, any case), `LEN`,
  `COUNTCHARS`, `SUBSTITUTE`, `UPPER`, `LOWER`, `LEFT`, `RIGHT`, `MID`,
  `FIND`, `SORTLETTERS`, `WORDS` -- in = lines and in Sheets. Formulas may
  now give text, and `ANS` / `ANS1` carry text too.
- **Bench: a puzzle set.** Ten puzzles with the tools (the six above, a
  queue with a ball handed on, a robot walk, knights and liars, a race
  order) and the first six again *without* the tools, reported apart and
  not scored, so a run shows what the tools add. Every answer was worked
  out by a program. The 35B's real answers without the tools are a test
  fixture: the graders pass its four right answers and fail the coin and
  the die for the right reasons.

Tested: puzzles 42 (all three tools on the bench puzzles written the way
the questions say them, Einstein's puzzle, a missing clue, contradicting
clues, every error message; Chat running a block, a correction, the tools
on request; which questions are offered which tool; the bench), all 21
suites pass; Chat in Chromium with a scripted model.

## 1.9.8 — A drawing stuck in a loop (2026-10-21)

From a 35B Chat on 1.9.7: "draw a house on a hill at sunset". The model
began well -- a hill, a house, a window -- then wrote `rect 10 6 1 1 fill
blue`, `rect 11 6 1 1 ...` up to 119 until its reply was cut off; the
retry did the same up to 77. Lantern sent back all ~100 "off the grid"
complaints, built nothing because a drawing with any problem was never
built, and still said "Lantern made a drawing" -- with no picture and no
Open in Draw button.

- **A loop is found and left out.** A run of 8 or more lines of one shape
  where a single number steps the same way each line (or the same line
  again and again) counts as a loop when the block was cut off, most of it
  is off the grid, or it is over 30 lines. A row of fence posts does not.
  It becomes ONE problem: what repeated, how often, that it was cut off,
  and what to do instead (paint an area as one shape, 30 shapes or fewer).
- **The model does not see its loop again.** The looping lines are cut
  from the reply in the history it gets for the retry (a loop in front of a
  model tends to restart it), and from what Chat shows; Chat notes that
  the reply got stuck.
- **A drawing is drawn from the lines Lantern can read**, even when other
  lines have problems, so there is a picture and an Open in Draw button to
  finish it by hand. The problems still go back to the AI once.
- **Problems are listed compactly:** three or more lines with the same
  complaint become one entry ("16 lines, from ... to ..., are off the
  grid"), at most 8 entries.
- **Chat says plainly when nothing could be made** ("Lantern could not
  make a drawing ... Nothing was made"), and if the correction is worse
  than the first block, the first block's picture is kept.
- **The drawing instructions** say to paint an area with ONE big shape,
  never rows of small squares, 30 shapes or fewer; the example now has a
  sky and ground as single rects.
- **Bench:** an 8th thing to make, "Draw a house on a hill at sunset"
  (passes with a wide warm sky rect and a house; the looping reply fails).

Tested: AI actions 66 (both real looping replies from the transcript as
fixtures, through the build and through Chat: one short reason, the loop
cut from the history, 3 shapes drawn and opened in Draw; a loop then a good
block; nothing drawable; a worse correction), all suites pass.

## 1.9.7 — Run 7: two misses out of 82 (2026-10-21)

Bench run 7 (Qwen3.5 35B-A3B, English Wikipedia mini, 1.9.6) scored
**80 of 82 (98%)**: core 32/32, fresh 5/5, hard 9/10, library 19/20, things
made 7/7, conversations 8/8. Both misses were fixable on Lantern's side.

- **Power bill: `ANS1`, `ANS2` now work.** The model added two separate
  results as `=ANS1+ANS2`, then `=ANS3*30`, `=ANS4*0.15` -- the right
  working (3.6 dollars), rejected as "Unknown name ANS1", and written the
  same way on the retry. In Assist and Chat, `ANS1` is now the first line's
  result, `ANS2` the second's (`ANS` is still the line just before), and the
  prompts say so. A reference to a line not yet worked out, or to one that
  failed, says exactly that. In run 5 the same question failed as
  `=ANS+ANS`; the check that caught it now also knows that a line named by
  `ANSn` is used.
- **Everest: a decline with the answer in front of it gets one pointer.**
  The model said "Not in my library" with Everest's article as passage 1.
  When a quick fact is declined after reading, and one sentence (or infobox
  fact) in the passages holds the question's words beyond its subject --
  "height" or "elevation" for "how tall" -- and a number when the question
  asks for one, Lantern shows the AI that sentence once and lets it decide.
  Never for questions about the person's own situation ("my town", "next
  month"), which no encyclopedia answers, nor for explanations.
- **Reading prompt:** a number a passage states (a height, a year, a count)
  is a fact to write with [n]; = lines are only for a calculation. The
  Assist rules ("every number in the = lines must come from the question")
  may have made the model think it could not state a height.
- **Passages:** a word of the article's own title counts a quarter (nearly
  every sentence of "Mount Everest" says Everest), words that ask for a
  measure match the words articles use ("tall" -> height, elevation), and a
  sentence with a number gains when the question asks for one. The infobox
  fact closest to the question comes first.
- **One article, one passage.** "Mount Everest", "Season", "Sahara" and
  "Polio vaccine" each came back twice -- the same article under a second
  name (a redirect). It is now read once, leaving room for another article.
- A recipe's blanks left in (`=({ah}*{v})/{w}`, battery-hours' first reply)
  now say so: "put the question's numbers in their place".
- **Bench:** a failed library row keeps the passages the AI read, so a
  decline can be told apart from a passage without the answer; a pointer
  turn is recorded.

Tested: AI layer 125 (the run-7 power-bill reply runs in one round and
passes), library 87 (a realistic Everest lead and infobox, a redirect that
reproduces the duplicate, the pointer in Assist and Chat, and where it must
stay quiet); every real reply from runs 1-7 replayed through the checks --
only wrong answers flagged.

## 1.9.6 — Asking the library the right questions (2026-10-21)

From a 1.9.4 Chat on the 35B with English Wikipedia: the first, clear
question went well (read first, 7 of 7 sentences backed), and the
sentence check caught the model citing passages for things they don't say
four times. But six of ten turns got worse because of Lantern, not the
model: follow-ups were searched word for word ("Is this how you work?"
found a song and "Women's work"), questions about the AI itself or asked
"without regard to the library" were forced to "Not in my library", and a
quote from turn 1's passage was taken for an invented one, throwing a good
answer away. What changed:

- **The AI writes the search for a follow-up.** When a question leans on
  earlier turns ("How are they trained?", "Is it..."), Lantern first asks
  the AI for search words -- it knows what "they" means -- and reads the
  library with those. The search Chat used is shown.
- **Not every question is for the encyclopedia.** Questions about the AI,
  Lantern or the conversation ("Is this how you work?", "are you more or
  less capable", "what have we discussed", "your previous answer") are
  answered from the AI's own reasoning, with no reading, no search on a
  decline, and a note that the answer is its own. If it still says "Not in
  my library", it is told once that this is not a library question.
- **"Without regard to the library" is obeyed** (also "from your own
  knowledge", "don't use the library"): no reading, no search at all.
- **Quotes from passages read earlier in the chat count as real** and are
  checked against those passages, instead of setting off a new search.
- **The sentence check skips sentences that describe the passages**
  ("Passage [1] lists songs...", "the passages do not cover...") and reads
  "in passage [3]" as a reference, not a citation -- both were false flags.
- **Recipe hints only go with questions that have numbers.** A unit-
  conversion hint was attached to nearly every message and leaked into a
  35B answer about how it reasons.
- Chat's instructions say plainly that questions about the AI or the chat
  are answered from its reasoning, without "Not in my library".
- Chat's turn logic runs without the page (`Lantern.CHAT.turn`,
  `converse`), so conversations can be benched.

**Bench: eight conversations** from the transcript, each run turn by turn
the way Chat runs it and graded on the last turn: "Is this how you work?"
after an explanation; "How are they trained?" (searched with the subject);
"are you more or less capable"; a question "without regard to your
library"; "sum that up and quote the passage" (no new search); "what have
we discussed"; "how is reasoning possible" about the previous answer; and a
calculation follow-up ("how many amp-hours does it use", 15 Ah). Reported
as their own set; one is in the quick run.

Tested: 19 routing tests replaying the transcript with a scripted model, a
well-behaved model passing all 8 conversations, and checks that the
transcript's own behaviour would fail them; Chat in Chromium against real
kiwix-serve. This update also carries 1.9.5 (making schematics, drawings,
tables; vision) for a stick still on 1.9.4.

## 1.9.5 — The AI makes things: schematics, drawings, tables (2026-10-21)

Chat can now be asked to **draw a circuit** (or a hydraulic or pneumatic
diagram), **draw a picture**, or **make a table**. The AI does what small
models are good at -- saying *what* -- and Lantern does *where* and *how
much*, the way it already does arithmetic:

- **MAKE SCHEMATIC**: parts and wires only (`part B1 battery "12 V"`,
  `wire B1 S1`). Lantern takes each symbol from Draw's Electrical,
  Hydraulics or Pneumatics mode, lays a loop round a rectangle, hangs a
  part in parallel below its twin like a ladder rung, hangs ground, tanks
  and gauges under their terminal, runs square wires on Draw's 20 px grid,
  marks joins with dots, mirrors a battery or diode to match a named
  terminal (`B1+`), and labels everything. Checked first: unknown parts
  (it names the ones it has), loose parts, wires to missing parts, an open
  circuit (no loop through the battery or source), a pump not reaching
  its tank. Common names are understood (bulb, LED, earth, power supply).
- **MAKE DRAWING**: shapes on a 20 x 12 grid -- whole numbers a small
  model handles -- with fill and outline colours by name; scaled up by
  Lantern. Off-grid shapes, unknown colours and wrong number counts are
  sent back.
- **MAKE SHEET**: rows with `|` between cells and `=` formulas; the sheet
  engine works them out (the same engine the person uses). A formula that
  fails, loops, reads an empty cell (an off-by-one row) or reads text is
  sent back.
- One corrected block when Lantern finds a problem, as with formulas. The
  result shows in Chat with **Open in Draw** / **Open in Sheets**; Draw
  keeps the person's own drawing ("Restore previous drawing") and fits a
  wide drawing to a small screen. Only the actions a question is about are
  described to the model, and recipe hints are left out of such requests.
- **The AI can look at its drawing.** Qwen3.5 models see images with their
  vision part (mmproj). The kit now fetches it with each laptop model
  (4B, 9B, 35B: 0.7-0.9 GB; `setup-kit vision` for models already on the
  stick) and start-lantern loads it (`--mmproj`; `novision` to skip).
  Lantern reads llama-server's /props, shows "sees images" next to the
  model, and when it can, shows the AI the finished picture once: it
  replies LOOKS RIGHT or sends a corrected block. A picture is sent once,
  not with every later turn.
- **Bench:** seven "make" questions (a lamp circuit, two lamps in
  parallel, a hydraulic press, a house with a red roof, a sun above the
  sea, a shopping table totalling 6.99, Celsius to Fahrenheit), graded by
  structure and by the sheet's numbers, reported as their own set.

Tested: 49 action tests, the kit (sh and PowerShell: vision parts fetched
and loaded), and in Chromium against a stand-in llama-server that reports
vision: the picture Lantern sends is a real PNG of the schematic (checked by
eye), the look turn, and Open in Draw. Not tested here: a real vision model
looking at it -- that is the next bench run.

## 1.9.4 — Reading before reasoning, and the full Wikipedia (2026-10-21)

From a Chat transcript on the 4B: asked to explain in detail how language
models work, it answered from memory (with a real error: GPT-style models
are not trained by masked language modelling), and when pressed it wrote
"= LOOKUP("LLM", "architecture")" and two QUOTE lines with no library
behind them, then claimed Lantern had verified them. Chat showed that
without a warning. What changed:

- **Read first.** An explanation question in Chat ("explain", "in detail",
  "how does", "tell me about") is looked up before the model answers, so it
  reasons with the passages in front of it. The search uses the subject
  words, not "explain in detail".
- **Bigger reading allowance for detail:** whole paragraphs (the sentences
  around a fact), the lead first, then the paragraphs that share most
  words, each marked with its section; about 2,200 characters a passage
  instead of 1,000. Quick facts keep the short passages.
- **Sentence-by-sentence check.** Each sentence of a detailed answer that
  cites [n] must say what passage n says (its new words and numbers); if
  not, the AI gets one turn to fix it. Sentences with no source are listed
  as the AI's own reasoning, for the reader to weigh.
- **Infobox facts.** The mini Wikipedia holds each article's infobox too,
  and Lantern used to throw it away. Its rows are now read as facts
  ("Molar mass: 44.009 g·mol^-1", "Elevation: ...") and offered in
  passages, units' powers kept, catalogue numbers left out.
- **Two Wikipedias side by side.** Books of the same Kiwix family are one
  encyclopedia: quick facts search and read the small file, explanation
  questions the full one. No article is given twice.
- **Kit:** `setup-kit library-full` downloads the full English Wikipedia
  (every article, text without pictures; the size is read from the server,
  about 60 GB) next to the small one, with the free-space check counting a
  resumed download. Once the small one is there, start-lantern offers it --
  opt-in: only Y downloads; no answer means not now; never in unattended
  setups. `setup-kit check` says whether it fits.
- **Chat holes closed:** a "= LOOKUP(...)" line is a search request, not a
  failed formula; a NEED asking for encyclopedia data searches the library;
  QUOTE lines with no passages make Lantern search (or, with no library,
  are flagged as unchecked); a model that asks to look up what it already
  has is told to answer from it; passages from earlier questions are sent
  as a short note and the oldest turns dropped from long conversations, so
  requests stay inside the server's 8,192-token window.

Tested: AI layer 119, library 76, kit (sh and PowerShell) with the full
file, and end to end in Chromium against real kiwix-serve serving the real
mini test file next to a full-articles file of the same family.

## 1.9.3 — Run 6: the 4B with English Wikipedia (2026-10-21)

Adam ran the full bench on the 4B (Qwen3.5-4B-Q4_K_M) with English
Wikipedia on the same 32 GB laptop as the 35B: **61/67** on 1.9.2.
Earlier questions 32/32, fresh 5/5, hard 8/10, library facts 16/20,
unknown 3/3, safety 3/3 by rule; four replies fixed on the correction
turn; about 10 s a question (11.3 minutes for the whole bench).

The 1.9.2 search did its job: every fact question got the right article.
The six misses, and what changed:

- **A dropped request** (Things Fall Apart): one model request in about
  a hundred failed with Firefox's "NetworkError" (a kept-alive connection
  the server had just closed). A request that never got an answer is now
  sent once more; a stopped request or a server error is not.
- **Right quote, wrong number** (Moon landing, Mandela): the quote was
  copied word for word from passage 1 but labelled [2] or [3], so the
  check said it was not in that passage. Lantern now relabels a quote
  found in another passage (QUOTE line and the answer's [n]) before
  checking, so the link goes to the article it came from.
- **NEED that repeats the question** (gold symbol: "NEED: What is the
  chemical symbol for gold?"): a NEED that only echoes a question with no
  numbers is treated as a decline, so the library gets its look.
- **Conversion done backwards** (26 miles at 40 km/h): the model worked
  out CONVERT(26,"mile","km") and then divided 26 by 1.609344 by hand.
  The unused-step check now also covers a function applied to one of the
  question's own numbers whose result nothing uses.
- **Divide by 1** (battery nobody sized: "=60/1"): the times-one check
  covers /1 as well as *1.

One more check, for answers that passed but should not have: the natural
gas answer said "methane" and quoted a real sentence from the article that
does not mention methane -- an answer from memory with a citation
attached. **Support check:** the words an answer adds to the question
must be in a verified quote (a number the quote states counts as support).

Replayed over every recorded reply from the six runs (347 formula replies,
31 cited fact answers), the new checks question only wrong or unsupported
answers.

## 1.9.2 — Run 5: the 35B with English Wikipedia (2026-10-20)

Adam built a fresh stick on another laptop (one setup run: engine, 4B,
35B-A3B, English Wikipedia mini 2026-09) and ran the full bench: **57/67**.
Earlier questions 32/32, fresh 5/5, hard 7/10, library facts 13/20,
every computed or cited answer verified; two formulas fixed on the
correction turn; about 12 s a question (3.4 tokens/s on that laptop).

All 7 fact misses were "Not in my library" after the search handed the
model the wrong articles ("Mount" and two expeditions instead of "Mount
Everest"; "UNIT" for the ohm; "Moon (disambiguation)"; "Causality" for the
seasons). No wrong fact got through. Fixes:

- **Search:** exact titles are tried for runs of the query's words,
  longest first ("mount everest" before "mount"), singular forms too, and
  never for words too general to be a subject ("cause", "unit", "year");
  disambiguation pages are skipped.
- **Ranking by reading:** up to 10 candidate articles (from the model's
  words and the question's) are read and ranked by the sentence that holds
  most of the question's words, then exact titles and title words; the 3
  best become the passages.
- **Passages by sentence:** the first sentence, then the sentences sharing
  the question's words, then the rest of the lead while there is room
  (1000 characters), so the answering sentence survives a long lead.
- A safety-rule reply is no longer followed by a pointless library lookup.
- Bench: the polio question also accepts Koprowski (Wikipedia credits
  Koprowski 1950 and Salk 1955); library facts are reported as their own
  set instead of inside "earlier questions".

Three calculation slips ran and gave wrong numbers; three checks added:

- *Step lost*: "=60*5/1000", "=100*5/1000", "=ANS+ANS" (ANS is only the
  line just before, so the 0.3 is lost) -- the unused-step check now
  follows each step through the chain.
- *Repeated step*: "=420/ANS" written twice.
- *Extra time conversion*: "40 km/h ... how many hours" then "/24".
- Replayed over all 258 real replies from the five runs, the checks flag
  only wrong answers.
- Tests: AI layer 117 checks; library 51 (a second stand-in book
  reproducing run 5's misses and decoys).

## 1.9.1 — One setup run fills an empty stick, library included (2026-10-20)

Adam: "if I extract the most recent zip into an empty USB on a different
laptop and double click setup-kit.bat, will it download everything,
including the wiki?" Not quite, in 1.9.0:

- Setup asked about the encyclopedia only when it had not just fetched a
  bigger model, so on a 16 or 32 GB laptop the library came on a later
  start, in the background. Now one setup run asks both questions (yes
  after 30 s each) and downloads the engine, the 4B, the bigger model and
  the encyclopedia in one go; a model that did not download properly stops
  the run with a message instead of being asked for again.
- The 1.9.0 update zip held only the changed site files. A fresh stick
  needs the whole site folder (offline-install files and the phone AI
  engine), so the delivery is now a complete kit zip.
- Kiwix listings: links with a path in front of the file name are
  accepted (some mirrors list them that way); Windows kiwix-tools falls
  back to the 32-bit build when there is no 64-bit one.
- Test: one setup run on an empty kit (sh and PowerShell) ends with the
  engine, 4B, 35B-A3B and English Wikipedia in place.

## 1.9.0 — Offline library: the AI reads an encyclopedia (2026-10-20)

Pilot of the next step after the bench runs: facts the model would
otherwise have to remember (or decline) are read from an offline
encyclopedia, with citations Lantern checks.

- **Kit:** `setup-kit library` installs kiwix-serve (kiwix-tools, GPLv3,
  newest release found from the download listing) and the newest English
  Wikipedia "mini" file (the lead section of every article, about 12 GB;
  Simple English Wikipedia, about 2.5 GB, when the drive is small or
  FAT32). `setup-kit zim NAME` adds any Kiwix file. Files are checked
  against their published SHA-256; a damaged one is deleted.
  `start-lantern` starts kiwix-serve on port 8081 with every file in
  `library/` (also for phones in share mode), and once the kit has the right
  model it offers the encyclopedia once, like a bigger model.
- **LIBRARY_ENGINE** (`Lantern.library`): finds the library on this computer
  or local network (never probes from a public web address), lists its
  books, searches (exact-title articles first, then full-text results for
  the question's words and for the words minus one, re-ranked by title
  words), reads articles as clean paragraphs, and cuts a passage per article
  (the lead plus the paragraphs sharing most words with the question,
  under 900 characters).
- **The reading turn** (`Lantern.assist.solve`, Chat): when the model
  replies `LOOKUP: <words>` -- a new verb in the prompt when a library is
  attached -- or says "Not in my library", Lantern searches and gives it up
  to three numbered passages. It answers with [n] after each fact and
  `QUOTE [n]:` lines; a fact plus a calculation ("how tall is Everest in
  feet?") may add `=` lines using the passages' numbers, which the number
  checks accept as given. Calculations never touch the library; the safety
  rules still answer dose questions before any lookup.
- **LIBRARY_CHECKS:** every cited passage needs a QUOTE; each quote must
  really be in its passage (copied, allowing punctuation and a word or
  two); every number in the answer must be in a passage it cites. Failures
  get the one correction turn; what is still wrong is shown. Assist and
  Chat show the sources with links into the library and each quote marked
  found or not found.
- **AI app > Offline library:** status, books, address (to use a library on
  another computer), and a search box showing exactly which passages the AI
  would get.
- **Bench v3:** 20 fact questions (category `fact`, 2 in the quick run),
  run only when a library is attached. A fact passes only with the expected
  fact AND a verified quote: a right answer from memory does not count.
- Limits of the pilot: the check proves a quote is real and the numbers
  match, not that the quote supports every word of the answer; search
  quality decides what the model can read.
- Tests: new `tests/library.js` (41 checks, against a stand-in kiwix-serve
  built from real replies); kit test covers the library download and start;
  checked in real Chromium against a real kiwix-serve (cross-origin search
  and reading, Assist with a verified quote, the panel).

## 1.8.6 — Kit fix: the 35B-A3B was never offered (2026-10-20)

Adam: "it does not download the 35b model for some reason?"

- **Cause (most likely, reproduced):** before offering a model, the kit
  checked that it could reach the file with a HEAD request that followed
  Hugging Face's redirect. Large files are served from signed storage links
  that can refuse a HEAD request (they answer a real download only), so the
  check failed, the kit concluded it was offline, and it said nothing. A
  stand-in server that behaves that way reproduces the silence with 1.8.5
  (16 test failures) and passes with 1.8.6.
- The check now stops at the redirect (a 302 from huggingface.co is
  enough); the download itself still follows it, as before.
- **Never silent again:** when it cannot check, it says why (no connection,
  or the status the site gave); `setup-kit check` now ends with what the next
  start will offer, or why not (already has it, answered N before, not
  enough room, FAT32, cannot reach the site), and shows the kit folder.
- New test `tests/kit_offer.py` (in `npm test`): the offer and model choice
  end to end against that stand-in, for `setup-kit.sh`, `start-lantern.sh`,
  and `setup-kit.ps1` when PowerShell is installed.
- Windows PowerShell 5.1: curl.exe is called by `.Path` (not `.Source`).

## 1.8.5 — The kit picks and fetches the biggest model a computer can run; run 4 checks (2026-10-20)

**Kit: automatic model size.** Asked by Adam: "couldn't it look at the
system it is on and automatically download the bigger model if it can run
it? This laptop has 32 GB."

- `start-lantern` (Windows, Mac, Linux) now checks, before starting, what
  this computer can run: 28 GB of memory or more Qwen3.5 35B-A3B, 16 GB 9B,
  8 GB 4B, 5 GB 2B, else 0.8B. If that is better than anything in the
  kit, the drive has room, and there is internet, it says so and asks once
  (Y, or N = don't ask again; yes after 30 s). The download runs in its own
  window (Mac/Linux: in the background with a log) while Lantern starts with
  the model it has; the next start uses the new one. Downloads resume after
  an interruption, a second start never begins a second download of the
  same file, and with no internet it starts quietly.
- It will not try to put a file over 4 GB on a FAT32 stick, or a model on a
  drive without room for it plus 1 GB; it says why and offers the next
  model that fits.
- **New top tier: Qwen3.5 35B-A3B** (unsloth `UD-IQ4_XS`, 17.5 GB,
  Apache-2.0): a mixture-of-experts model with about 3B parameters active
  per token, so it should run near the 4B's speed on a CPU with far more
  knowledge. Not yet run in Lantern Bench: run it on the 32 GB laptop.
- `start-lantern 35b|9b|4b|2b|0.8b` picks a model by hand; `nodownload`
  skips the check; `setup-kit check` lists what fits and what the kit has;
  `setup-kit xl` fetches the 35B-A3B. On a small computer the smallest model
  in the kit is used, never the biggest. `LANTERN_AUTO_DOWNLOAD=0` turns the
  offer off, `=1` downloads without asking (unattended set-ups).
- Tested with PowerShell 7 and sh against a local mirror: memory tiers,
  FAT32, low space, offline, already downloading, answering N and Y with
  a keyboard, and no keyboard (then nothing is downloaded or remembered).
  Not run on Windows itself yet.

**Bench run 4** (1.8.4, Qwen3.5 4B): 44/47 again, but the earlier
failures were fixed (the second-height Hohmann question on Lantern's
questioning, the goats question now asks with NEED). Three new slips ran
and gave confident wrong numbers; three checks added to `AI_CHECKS`:

- *Unused step*: "=40*5" then "=2000/2000" (the 200 was meant as the
  divisor): a worked step the last line never uses.
- *Seconds to the wrong unit*: ORBITT and HOHMANNT give seconds; the
  question asked for hours but the formula divided by 60.
- *Times one*: "=60*1/1000" for a battery size nobody gave.
- Replayed over all 163 real replies from the four runs, the checks flag
  only answers that were wrong (8 replies), never a correct one.
- Tests: AI layer 112 checks.

## 1.8.4 — Third bench run: 44/47; formulas checked against the question (2026-10-20)

Adam's run on 1.8.3 (Qwen3.5 4B, full prompt): **44/47**. Earlier questions
32/32, fresh 5/5, hard 7/10. The new correction turn worked live: the
"400 km orbit" Hohmann question was rejected ("radius 400 km is inside the
Earth"), the model fixed it on its second turn, and it passed. The three
failures all ran and gave confident wrong numbers:

- Hohmann "from a 300 km orbit to a 35786 km orbit": Earth's radius added
  to the first height but not the second (35786 km is a valid radius, so
  the inside-the-Earth check could not catch it).
- "How much feed do my goats need for 30 days?": `FEEDKG(2,30,800)`, with
  2 goats invented and 800 g taken from the recipe's example.
- "How many hours will my battery run a 60 W light?": `=60*1/60`, a battery
  size invented.

Changes:

- **Formulas are checked against the question** (`AI_CHECKS`, hook
  `Lantern.assistChecks`). *Number not in the question*: every number in
  the formula must be in the question, a unit factor or constant, a recipe
  constant, or one simple step from the question's numbers (pre-computed
  products, plus Earth's radius). *Height used as a radius*: a height the
  question gives ("a 300 km orbit", "420 km altitude", "35786 km above")
  used in an orbit formula with no Earth radius added. Replayed over all
  115 real replies from the three runs, the checks flag exactly the two
  failures they target and nothing else; they also pass every bench
  ground-truth formula.
- A questioned formula goes back to the model for its one correction turn
  with Lantern's reason (`Lantern.assist.solve`, kind "questioned"), in
  Assist, the bench and now Chat. If the second reply is still
  questioned, the person sees "Lantern still questions this answer".
- Prompt: every number must come from the question; a missing one is
  asked for with NEED, never guessed or copied from a recipe example; a
  worked NEED example (filling a tank, not a bench question).
- Bench rows record `retry` (rejected / questioned) and `flags`; summary
  counts `stillQuestioned`.
- Tests: AI layer 109 checks, 17 AI modules isolated, 7 AI self-tests.

## 1.8.3 — Second bench run: 36/37, and a harder bench (2026-10-20)

Adam's re-run on the same laptop and model (Qwen3.5 4B, full prompt) with
1.8.2 scored **36/37**: the questions from before 1.8.2 went from 18/30 to
29/30 (31/32 with the two planet questions), the five fresh questions
5/5, every computed answer used `{result}` (no sentence disagreed), and
the mayor question now declines. One failure: the Hohmann transfer "from a
400 km orbit", where the model again used 400 km as the radius.

- **Lantern rejects an orbit inside the Earth.** ORBITT, ORBITV, ESCV,
  VISVIVA, HOHMANN and HOHMANNT, when using Earth's default GM, now refuse
  a radius below Earth's surface with the fix in the message ("radius 400
  km is inside the Earth: radii are from Earth's centre, so add 6371 km to
  an altitude") instead of returning a confident wrong number. Other
  bodies (GM given) are not checked against Earth.
- **One correction turn** (`Lantern.assist.solve`). When Lantern rejects
  a formula and nothing was computed, the model gets one more turn with
  Lantern's reason, the way Chat already works. Assist shows the rejected
  reply and the corrected one; the bench records `rounds`, `fixed` and the
  rejected line, and the summary counts fixes on the second turn.
- The Hohmann recipe cards spell out that "a 400 km orbit" is an altitude;
  the transfer-time card no longer matches every question containing
  "hours".
- **Harder bench (v2, 47 questions).** The 4B model now passes almost
  everything, so the bench gains ten **hard** questions with no recipe
  aimed at them: distractor numbers (a 12 V pump's amp-hours), two-step
  rates (days a tank lasts a family, fuel for a trip), unit traps (miles at
  km/h, an orbit period in hours), a second altitude-vs-radius Hohmann
  question, and a new **need** category: two questions that leave out a
  number, which pass only by asking for it. Earlier, fresh and hard
  questions are reported apart.
- Tests: AI layer 99 checks.

## 1.8.2 — Fixes from the first Lantern Bench run (2026-10-20)

Adam's full bench on the USB kit (Qwen3.5 4B, llama-server, full prompt)
scored 18/30: tool 13/17, multi-step 1/7, unknown 2/3, safety 2/3. Every
failure was read and traced; this release fixes the ones Lantern can fix.
Re-grading the same 30 replies with 1.8.2 gives 22/30 before the model
sees the new prompt; a re-run is needed to measure the rest.

- **The number a person reads is now Lantern's.** Five passing answers had
  sentences that contradicted the computed value (car energy "1.5 million"
  for 375,000 J, "33 plants" for 132, "15 kWh" for 1.5). The prompt now asks
  for `ANSWER: <sentence with {result}>` and Lantern fills `{result}` with
  its computed number. A sentence that states its own number is checked:
  Assist, Chat and the bench flag one that disagrees, one that matches only
  in another unit, and one with a number when nothing was computed.
- **Safety rules answer before the model** (`AI_GUARD`, hook
  `Lantern.aiGuards`). Medicine doses, mixing bleach with ammonia or acids,
  live mains work and weapons get a fixed, number-free reply every time;
  the model is never asked. The 4B model had answered a child's paracetamol
  question with "NEED: dosage instructions". Rules need two kinds of word
  together, so molar masses, chlorinating water and Ohm's law still reach
  the tools (tested both ways).
- **Lantern repairs what the model gets nearly right.** Braces left in a
  filled recipe (`=({100}*{12})/{60}`) now run. `CONVERT` understands the
  unit words models type: m^2, m^3, ha, litres, cubic metres, square
  metres, sq km, tonnes, kilograms, pounds, miles, hours, years and more.
- **Prompt contract rewritten from the failures**: SI unless a function
  says otherwise, CONVERT only to change units, the last `=` line in the
  unit asked for, plain arithmetic for money, counts and recipes, NEED only
  for a number a function needs (it had asked for exchange rates to
  multiply 65 by 35), "Not in my library" for facts and people. Two worked
  examples.
- **Everyday recipe cards** (`AI_RECIPES`): tank fill time, bags in a
  total, field area in hectares, total cost, recipe scaling, animal feed
  from grams per day, Hohmann time from an altitude. These target bench
  failures directly, so the bench gains five **fresh** questions (heater
  kWh, bus hours, jerrycans, eggs by the dozen, room volume) with no card
  aimed at them; the report and summary line keep earlier and fresh
  questions apart so gains that only come from the cards are visible.
- `FEEDKG` is in the AI tool list; the Earth escape question finds
  `PLANET("earth","escape")`; the escape recipe says ESCV needs a radius.
- Bench v1: rows record `by` (model or safety rule) and `sentence`
  (filled, agrees, disagrees, other unit, unchecked); summary counts them;
  CSV gains the columns.
- Tests: AI layer 91 checks, 16 AI modules isolated, 6 AI self-tests.

## 1.8.1 — Fixes from the first laptop test (2026-10-20)

From Adam's screenshot of Chat on the USB kit (Qwen3.5 4B):

- **Answers were cut off mid-sentence.** Chat now allows 1536 tokens per
  reply (was 512) and says when an answer was cut short ("send continue").
- **Raw markdown** (`**bold**`, backticks) showed as symbols. Chat now
  renders bold, inline code, headings and `=` lines, escaped first.
- **Planet data came from the model's memory** (it typed Mars's mass and
  radius). New `PLANET_DATA` module: `PLANET("Mars","escape")` and friends
  from NASA NSSDCA fact sheets (Sun, Mercury to Neptune, Moon, Pluto: mass,
  GM, radius, equatorial radius, gravity, escape velocity, distance,
  period), in the AI tool list with three recipe cards (escape velocity,
  weight on another body, orbit period around another body), two bench
  questions and a self-test.
- Tests: AI layer 46 checks, 14 AI modules isolated.

## 1.8.0 — On-device AI test build (2026-10-19)

Phase 1 of the Lantern Edge AI Plan (`docs/Lantern_Edge_AI_Plan.pdf`): a
small language model that uses Lantern's tools as its source of truth,
running on a phone inside the page, or on a laptop / USB stick through
llama.cpp. 13 new modules (220 to 232); every one removable on its own.

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
- **Short prompts for small devices** (`AI_PROMPT`, hook
  `Lantern.assistToolFilter`): on the device engine Assist lists only the
  functions the question needs (about 400 tokens instead of about 950);
  Automatic / Short / Full, recorded in every bench report. Repeated
  prompt prefixes are reused (prompt cache).
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
- **Tests:** `npm test` 15 checks: adds AI layer (42: routing, same-origin
  detection, Assist/Chat through the route, short prompts, app, bench
  grading with a perfect and a bad fake model) and isolation for the 13 AI
  modules.
  Verified for real against llama-server built from source with a GGUF
  model (kit, Assist, Chat, Bench, offline reopen), and the in-browser
  engine in Chromium (fast and Safari-compat builds, kept copy reloaded
  after restart, queued requests, multi-threading via the worker switch).

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
