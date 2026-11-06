# Questions for Adam

Only what he alone can answer. Newest first. Remove a question when he has
answered it, and write his answer into `CLAUDE.md` or `agent/QUEUE.md`.

1. **Three things to look at in 1.24.6** (pictures were sent in the chat on
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
2. **Five Food lessons wait for pages I could not open.** Cassava and
   kidney beans (which poison when prepared wrongly), storing grain, the
   illnesses of a narrow diet, bread, and cooking with less fuel are
   drafted. To check them I need the pages of WHO, FAO, the US FDA and
   USDA's food safety service. The app let me open only `cdc.gov` and the
   US home-preserving centre without asking you, and you were not there to
   be asked; my web searches for the session were spent as well. When you
   are at the app, say "finish the Food lessons" and approve the pages it
   asks about. They are on the branch `wip-2026-11-06`, not in Lantern.
   (Asked 2026-11-06.)
3. **Should the kit give the small models more than 8,192 tokens?** Every
   model is started with that much room. Five of the 2B's conversations
   outgrew it and ended in an error. Lantern now shortens such a request
   and sends it again, and gives small models shorter instructions, so it
   should be rare. Doubling it (16,384) would make it rarer still and costs
   memory on the smallest computers; I have not measured how much. Say
   "measure it" or "leave it".
   (Asked 2026-11-06.)
4. **A nightly run.** Claude could not create the scheduled task itself: the
   app refused it (2026-11-05). The instruction for it is written and kept in
   `agent/NIGHTLY.md`. Either say "set up the nightly run" in a chat and
   approve it when the app asks, or make a scheduled task yourself with that
   text (each night, about 01:20 your time, new session each run). Until
   then the work moves only when a chat is open.
   (Asked 2026-11-05.)
5. **Somebody trained should read the Health lessons before `main`.** They
   were checked line by line against WHO, CDC, NHS and the 2025
   resuscitation guidelines, by checkers that had not seen the drafting, and
   corrected. That is not the same as a nurse, a midwife or a first-aid
   instructor reading them. The birth lessons most of all. Is there someone?
   (Asked 2026-11-05.)
6. **Medicines in the Health tile: none, unless you say.** The tile's rule is
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
7. **WHO's amounts of ORS are in the Diarrhoea lesson** (after each loose
   stool: 50 to 100 ml under 2 years, 100 to 200 ml for an older child). I
   read them as fluid, not as a medicine dose. Say if you want them out.
   (Asked 2026-11-05.)
8. **The Health tile now opens on Emergencies**, then sick children and
   adults, mother and baby, staying well. It was staying well first. An
   emergency cannot wait for scrolling; but how a page looks is yours. Say if
   you want the old order.
   (Asked 2026-11-05.)
9. **Publishing.** `main` is at 1.14.3; the work is on branches up to
   1.24.6. The download on GitHub (`Lantern.zip`) is what `main` has, and
   it still carries what the two audits found wrong: in Health, meat and
   fish dried in the sun as they are; in Food, "oil covering" for cooked
   vegetables and herbs (how botulism is made) and a sum that tells a baby
   how much water to drink. Say "merge" when a version should become the
   public one. The 35B scored 103 of 103 on 1.24.2, 107 of 109 on
   1.24.4, and 111 of 112 on 1.24.5 and on 1.24.6 (the one miss both times
   a tune of its own, 8 bars long; it passed when asked again on the build
   that was pushed).
   (Asked 2026-11-05; updated 2026-11-06.)
10. **The encyclopedia questions need your Chrome.** The library on the laptop
   is fine: `http://127.0.0.1:8081` answers "Welcome to Kiwix Server". What
   fails is the Claude app's own browser pane, which does not let Lantern's
   page (port 8080) talk to another port, so every run I make there leaves
   out the 25 encyclopedia questions. In your own browser they work. If you
   connect the Claude extension in Chrome on the laptop, I can run the bench
   there, library included. Say if you want that.
   (Asked 2026-11-05; found the same day.)
11. **How the songs sound.** The songbook's nine tunes and the new bar
   readings are checked by their notes, lengths and bars, not by ear. If one
   sounds wrong, say which.
   (Asked 2026-11-05.)
