# Questions for Adam

Only what he alone can answer. Newest first. Remove a question when he has
answered it, and write his answer into `CLAUDE.md` or `agent/QUEUE.md`.

1. **Should a repair guide's readers' comments come back into what the AI
   reads?** (asked 2026-11-08, for 1.24.8) Your run of the 35B said "Not in
   my library" for the iPhone 8 battery because iFixit's offline file keeps
   readers' comments inside each step, and Lantern read them as the step.
   1.24.8 leaves the comments out: the steps read cleanly. Five reviewers
   tried it; in their guides some warnings were only in a comment (a fan
   capacitor or a power supply can hold a charge; a punctured battery can
   catch fire), and so was some bad advice (a lithium battery in the
   freezer). Say "comments out" (as it is), or "comments after the steps"
   (marked as readers' comments, after the guide's own steps).
2. **Should Lantern mend a clashing note itself?** (asked 2026-11-07)
   When a long melody note is a half step from its chord, Lantern sends the
   song back with the chord to write. Three times now the 35B sent back the
   same chord (your waltz run on 1.24.6: A over E in bar 7; a waltz on
   1.24.0; a tune on 1.24.6 ending on C over G), and the song failed. It is
   written, not switched on: Lantern would play the chord of the key that
   holds the note in that bar (D under the A, chosen the way it chooses
   chords when none are written), or end the song on the nearest note of
   its home chord (B instead of C), and say so under the song. Where a bar
   has two chords it would still ask. It changes what the AI wrote, and how
   it sounds is yours. Say "mend it", "keep asking", or "mend the chord,
   not the notes".
3. **Your two pictures, and which way to go on with drawing**
   (pictures sent 2026-11-06).
   - Lantern stands a mountain on the horizon when its base is in the sky,
     puts the sun behind the land, and draws a road narrowing to the
     horizon when the AI wrote it as lines side by side; it says under the
     picture what it changed. It now does this only for a plain landscape
     asked in plain words: three reviewers drew pictures to break it, and
     a rule that guessed spoiled more right pictures (a lamp moved behind a
     hill, an umbrella stood on the horizon) than it mended. A tent by the
     lake stays as the AI drew it. Do your two pictures look right now?
   - For the bigger pictures made of pieces, there are two ways, and they
     can come one after the other:
     (a) **words for things**: the AI writes "mountain", "road", "tree
     near the left", and Lantern draws each one, on the ground, in the
     right order, bigger when nearer. Fewer numbers for a small model to
     get wrong; Lantern has to know how to draw each thing;
     (b) **pieces the AI draws itself**: each piece (a tree, a boat) on a
     small grid of its own, as it draws now, and a last block that says
     where each piece stands. Lantern sizes it by its distance and puts
     the far ones behind. Anything can be a piece; the AI still has to
     draw each one well.
     Say "words", "pieces", or "both, words first".
   (Asked 2026-11-06.)
4. **Three things to look at in 1.24.6** (pictures were sent in the chat on
   2026-11-06). How a page looks is yours to judge:
   - when the AI's answer uses nothing of the lesson Lantern gave it, the
     lesson's own words are now shown in a box under the answer, with a
     button to open it;
   - the drawing guide's example is now a hut by a tree with a roof and a
     door (it was a tree on a hill);
   - when a circuit of resistors is drawn and the total is asked for,
     Lantern adds the line with the total under the drawing and says, in
     small grey print, that it added it.
   Say if any of them should look different, or go.
   (Asked 2026-11-06.)
5. **Five Food lessons wait for pages I could not open.** Cassava and
   kidney beans (which poison when prepared wrongly), storing grain, the
   illnesses of a narrow diet, bread, and cooking with less fuel are
   drafted. To check them I need the pages of WHO, FAO, the US FDA and
   USDA's food safety service. The app let me open only `cdc.gov` and the
   US home-preserving centre without asking you, and you were not there to
   be asked; my web searches for the session were spent as well. When you
   are at the app, say "finish the Food lessons" and approve the pages it
   asks about. They are on the branch `wip-2026-11-06`, not in Lantern.
   (Asked 2026-11-06.)
6. **Should the kit give the small models more than 8,192 tokens?** Every
   model is started with that much room. Five of the 2B's conversations
   outgrew it and ended in an error. Lantern now shortens such a request
   and sends it again, and gives small models shorter instructions, so it
   should be rare. Doubling it (16,384) would make it rarer still and costs
   memory on the smallest computers; I have not measured how much. Say
   "measure it" or "leave it".
   (Asked 2026-11-06.)
7. **A nightly run.** Claude could not create the scheduled task itself: the
   app refused it (2026-11-05). The instruction for it is written and kept in
   `agent/NIGHTLY.md`. Either say "set up the nightly run" in a chat and
   approve it when the app asks, or make a scheduled task yourself with that
   text (each night, about 01:20 your time, new session each run). Until
   then the work moves only when a chat is open.
   (Asked 2026-11-05.)
8. **Somebody trained should read the Health lessons before `main`.** They
   were checked line by line against WHO, CDC, NHS and the 2025
   resuscitation guidelines, by checkers that had not seen the drafting, and
   corrected. That is not the same as a nurse, a midwife or a first-aid
   instructor reading them. The birth lessons most of all. Is there someone?
   (Asked 2026-11-05.)
9. **Medicines in the Health tile: none, unless you say.** The tile's rule is
   no medicine and no dose, and a test now holds it. The sources the lessons
   come from also give these, each of which saves lives where there is no
   clinic. Say which, if any, should go in, with the source's own figure:
   - zinc for a child with diarrhoea, with ORS (WHO: 10 mg a day under 6
     months, 20 mg a day from 6 months, for 10 to 14 days);
   - aspirin, chewed, for a suspected heart attack (Resuscitation Council UK
     2025: 300 mg; American Heart Association 2024: 162 to 325 mg), not for
     anyone allergic to it or bleeding;
   - chlorhexidine on the cord stump after a home birth where many newborns
     die (WHO 2017), instead of "nothing on the stump";
   - paracetamol for fever and pain by the label (now the AI's rule says
     "follow the dose on the package label" and stops there).
   (Asked 2026-11-05.)
10. **WHO's amounts of ORS are in the Diarrhoea lesson** (after each loose
   stool: 50 to 100 ml under 2 years, 100 to 200 ml for an older child). I
   read them as fluid, not as a medicine dose. Say if you want them out.
   (Asked 2026-11-05.)
11. **The Health tile now opens on Emergencies**, then sick children and
   adults, mother and baby, staying well. It was staying well first. An
   emergency cannot wait for scrolling; but how a page looks is yours. Say if
   you want the old order.
   (Asked 2026-11-05.)
12. **Publishing.** `main` is at 1.14.3; the work is on branches up to
   1.24.7. The download on GitHub (`Lantern.zip`) is what `main` has, and
   it still carries what the two audits found wrong: in Health, meat and
   fish dried in the sun as they are; in Food, "oil covering" for cooked
   vegetables and herbs (how botulism is made) and a sum that tells a baby
   how much water to drink. Say "merge" when a version should become the
   public one. The 35B scored 103 of 103 on 1.24.2, 107 of 109 on
   1.24.4, and 111 of 112 on 1.24.5 and on 1.24.6 (the one miss both times
   a tune of its own, 8 bars long; it passed when asked again on the build
   that was pushed); with the encyclopedia, in your own run on 1.24.6,
   134 of 138.
   (Asked 2026-11-05; updated 2026-11-07.)
13. **How the songs sound.** The songbook's nine tunes and the new bar
   readings are checked by their notes, lengths and bars, not by ear. If one
   sounds wrong, say which.
   (Asked 2026-11-05.)
