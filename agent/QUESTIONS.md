# Questions for Adam

Only what he alone can answer. Newest first. Remove a question when he has
answered it, and write his answer into `CLAUDE.md` or `agent/QUEUE.md`.

1. **The library prompt: should the model see Lantern's surety as a word or a
   percentage?** (1.24.38) You see the percentage (Chat's note). The model sees
   "on shelf", "most likely", or no shelf, because a small model copies a
   number it is shown. Say if you want the number in front of the model too.
   Whether the library prompt becomes the default is also yours, once the
   bench has run it both ways.
2. **How far should the givens reach?** (1.24.36) Eight reviewers tried
   the control givens; each found 26 to 51 new ways to ask that Lantern
   fitted wrong, and each was mended by showing no given where Lantern is
   not sure. The last two found that a round's quick mends broke as much
   as they fixed, until the mends read less instead of more. So a given now shows only for plainly worded questions, and
   most other questions get the instructions as before. Two directions:
   keep the givens this narrow and let the small models' runs say whether
   they help; or widen them a little a round, each round reviewed. Which
   do you want?
3. **Should a bench run use the circuits you keep?** (1.24.36) "Keep as my
   given" stores a circuit; a later question asking for it is shown it to
   copy. A bench run leaves the kept circuits out, so a run after you keep
   one is the same run as before. Say if you would rather the bench used
   them (then a run measures your Lantern, not the release's).
4. **A PowerPoint file from Lantern: does PowerPoint open it without
   asking to repair, and how does it look?** (1.24.33) Slides has Save .pptx
   and Open .pptx. Every part of the files it saves is valid against the
   standard's schemas, and python-pptx and LibreOffice open them, but no
   copy of PowerPoint has opened one yet. Open any deck in Slides, Save
   .pptx, and open it in PowerPoint: does it open straight away? The deck's
   colours come with it (Night is light text on near-black, as Present
   shows it). Your ITW deck opened in Slides keeps each slide's title, text
   and notes, its pictures put together as they sat, and its four Visio
   menus, which Lantern now draws itself (no browser draws EMF): do they
   look right beside the original? One direction is yours: a Lantern slide
   is a title, text and one picture; should Slides also keep each slide as
   PowerPoint lays it out (every text box where it was), at the cost of a
   more complicated editor? (Asked 2026-11-21.)
5. **A colour wheel cut into one wedge a colour: how does it look?**
   (1.24.20) "Primary: Red | Yellow | Blue / Secondary: Orange | Green |
   Violet" is now drawn as six wedges round the wheel, each its own colour,
   with its group's name (primary, secondary) in a ring of a pale tint of
   that colour round it -- red's ring is pink. The fourth reviewer asked
   whether that reads right; it is yours to judge. Make one in the Draw
   tile, or ask Chat "Draw a colour wheel of the primary and secondary
   colours". (Asked 2026-11-15.)
6. **The one link: try it** (1.24.19; `main` was 1.24.21 from 2026-11-16,
   on your word "proceed", and is 1.24.25 since 2026-11-18). Merging published Get-Lantern.exe, the Mac zip
   and the Linux programs on the release, and made the website the same
   version: https://adamweldon.github.io/Lantern_Office_Suite/get.html works
   for anyone (Adam's screenshot, 2026-11-16 12:08: the page loads, finds
   Windows, and starts the 7 MB download by itself). Now the first real
   double-click is yours: on the laptop, open the link, run
   it, and say what Windows showed and how the corner button looked.
   (Asked 2026-11-13; updated 2026-11-16.)
7. **Signing the programs** -- answered for now (Adam, 2026-11-16): not
   signed. The fixed starter was quarantined too on his home laptop with
   Windows's own protection on (Trojan:Win32/Bearfoos.A!ml: it copied itself
   into the user folder and made Start-menu and desktop icons), so Windows
   keeps Lantern.zip and Install Lantern; signing in his own name puts his
   name before every user, and liability is his to weigh. Lantern is now
   CC0 or 0BSD (0BSD is OSI-approved, with a no-liability clause), which
   also opens SignPath's free signing (the certificate in SignPath
   Foundation's name) if he wants it later. Open: a lawyer's hour (the
   licences, an LLC or nonprofit as publisher, insurance), a trained reader
   for the Health lessons (11), and whether to try a starter that does not
   copy itself.
8. **Set B on GitHub too?** (1.24.16) The small models' run on GitHub
   asks set A only. Asking set B as well would show whether they carry
   over too, and would about double the run's time (the 4B took 147
   minutes on set A). Set A only, set B only, or both? (Asked 2026-11-12.)
9. **Your three pictures of 1.24.14, as 1.24.15 draws them** (sheet sent
   2026-11-12). The door now stands on its wall, shortened to fit (the 35B
   drew it 4 wide and 2 high on a wall 2 high, so on the wall it is 1.5 high
   and may read as a low window); the tree stands 2.5 cells to the right,
   clear of the roof; the road is a plain gray triangle from the bottom edge
   to the horizon, in front of the 35B's gray "mountain". Do they look right
   to you? (Asked 2026-11-12.)
10. **Your two pictures, and which way to go on with drawing**
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
11. **Three things to look at in 1.24.6** (pictures were sent in the chat on
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
12. **Five Food lessons wait for pages I could not open.** Cassava and
   kidney beans (which poison when prepared wrongly), storing grain, the
   illnesses of a narrow diet, bread, and cooking with less fuel are
   drafted. To check them I need the pages of WHO, FAO, the US FDA and
   USDA's food safety service. The app let me open only `cdc.gov` and the
   US home-preserving centre without asking you, and you were not there to
   be asked; my web searches for the session were spent as well. When you
   are at the app, say "finish the Food lessons" and approve the pages it
   asks about. They are on the branch `wip-2026-11-06`, not in Lantern.
   (Asked 2026-11-06.)
13. **Should the kit give the small models more than 8,192 tokens?** Every
   model is started with that much room. Five of the 2B's conversations
   outgrew it and ended in an error. Lantern now shortens such a request
   and sends it again, and gives small models shorter instructions, so it
   should be rare. Doubling it (16,384) would make it rarer still and costs
   memory on the smallest computers; I have not measured how much. Say
   "measure it" or "leave it".
   (Asked 2026-11-06.)
14. **A nightly run.** Claude could not create the scheduled task itself: the
   app refused it (2026-11-05). The instruction for it is written and kept in
   `agent/NIGHTLY.md`. Either say "set up the nightly run" in a chat and
   approve it when the app asks, or make a scheduled task yourself with that
   text (each night, about 01:20 your time, new session each run). Until
   then the work moves only when a chat is open.
   (Asked 2026-11-05.)
15. **Somebody trained should read the Health lessons** (they are public
   since 2026-11-16; `main` is 1.24.25 since 2026-11-18). They
   were checked line by line against WHO, CDC, NHS and the 2025
   resuscitation guidelines, by checkers that had not seen the drafting, and
   corrected. That is not the same as a nurse, a midwife or a first-aid
   instructor reading them. The birth lessons most of all. Is there someone?
   (Asked 2026-11-05.) Adam, 2026-11-16: the published guidelines should be
   the authority, not someone he happens to know. Offered: each lesson to
   show its source and the date it was checked (now only in the code's
   comments), public-domain US government wording (CDC, FEMA) where it
   fits, and a reader who teaches first aid to lay people (anywhere, not a
   local licence) only to flag what is missing or misleading, every change
   still from a published guideline. Adam, 2026-11-17: show the sources
   ("I see no negatives to stating the source"). Done in 1.24.22: every
   lesson names its guidelines, checked again in November 2026, and where a
   guideline said otherwise the lesson now says what it says (the list is
   in the 1.24.22 changelog). Still open: the trained reader, if you want
   one.
16. **Medicines in the Health tile: none, unless you say.** The tile's rule is
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
     "follow the dose on the package label" and stops there);
   - (1.24.22) helping someone with severe allergy use their own adrenaline
     pen (auto-injector), which they carry because a doctor gave it to them.
     Allergy UK, which the Bites and stings lesson now names, puts it first
     ("Call emergency services immediately after using your first dose of
     adrenaline"). The lesson says only to lay them flat and get help.
   (Asked 2026-11-05; updated 2026-11-17.)
17. **WHO's amounts of ORS are in the Diarrhoea lesson** (after each loose
   stool: 50 to 100 ml under 2 years, 100 to 200 ml for an older child). I
   read them as fluid, not as a medicine dose. Say if you want them out.
   (Asked 2026-11-05.)
18. **The Health tile now opens on Emergencies**, then sick children and
   adults, mother and baby, staying well. It was staying well first. An
   emergency cannot wait for scrolling; but how a page looks is yours. Say if
   you want the old order.
   (Asked 2026-11-05.)
19. **How the songs sound.** The songbook's nine tunes and the new bar
   readings are checked by their notes, lengths and bars, not by ear. If one
   sounds wrong, say which.
   (Asked 2026-11-05.)
