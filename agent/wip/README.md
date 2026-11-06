# Unfinished: five Food lessons, drafted and NOT checked against sources

Branch `wip-2026-11-06`, made from `lantern-1.24.5`. Nothing here is in
Lantern. A session that starts should finish this or drop it before other
tile work (CLAUDE.md, "A session with nobody watching").

## What is here

- `food_lessons_draft_unverified.js`: seven lessons as first drafted. Two of
  them (`food_cook`, `food_milk`) went into 1.24.5 in a shorter form, with
  only what the CDC's and the US National Center for Home Food
  Preservation's pages say. **Five are held back**:
  - `food_staples`: foods that must be prepared the right way (cassava,
    kidney beans, green potatoes, mouldy grain and groundnuts, maize and
    pellagra, polished rice and beriberi, wild mushrooms, honey);
  - `food_store`: storing grain, beans and roots;
  - `food_lack`: illnesses that come from a narrow diet;
  - `food_bread`: porridge, flatbread and bread from grain;
  - `food_fuel`: cooking with less fuel and less smoke (the hay box).
- `food_edits_draft_unverified.js`: the first drafts of `food_safe` and
  `food_children` (WHO's meal frequencies). 1.24.5 has other texts for both,
  from the CDC's pages.
- `checks.md`: what the two checkers reported.

## Why they wait

The session that wrote them (2026-11-05/06) had used its web searches, and
its page fetches were allowed for two sites only: `cdc.gov` and
`nchfp.uga.edu`. Every other site needed an approval that nobody was there
to give: `who.int`, `fao.org`, `fda.gov`, `fsis.usda.gov`, `foodsafety.gov`,
`ods.od.nih.gov`. So the checker of these drafts opened **no page at all**
and reported from memory, marking each point [H] (sure of the figure) or [M]
(sure of the substance only). Its recollection differs from the drafts in
places that matter, so the drafts must not go in as they are:

1. **Kidney beans.** The draft says soak 5 hours, boil hard 10 minutes. The
   checker recalls the current US FDA Bad Bug Book (2nd edition, 2012) as:
   soak at least 5 hours, pour the water away, boil in fresh water at least
   **30 minutes**; 10 minutes is the first edition's and the UK's figure.
   Use the longer one, once it has been read on the page.
2. **Bitter cassava.** The draft offers soaking, fermenting or sun-drying as
   alternatives. Sun-drying alone removes the least cyanide and is the short
   cut tied to konzo outbreaks. The steps are a sequence: peel; soak or
   ferment for several days; throw the water away; then dry or roast; then
   cook. Sweet cassava: peel, boil well, discard the water. If unsure, or
   after drought, treat as bitter.
3. **The hay box.** A pot kept warm for "some hours" sits in the range where
   germs grow; beans kept at about 80 C can be more toxic than raw; boiling
   again does not destroy every toxin. No food-safety body's text on hay
   boxes was found. Either a source, or the hay box comes out.
4. **"Each is cured by food"** (`food_lack`) is false and delays care: the
   eye signs of vitamin A lack are an emergency; blindness, damage to a
   baby from iodine lack and bent bones do not reverse; anaemia has other
   causes. Say: food prevents them all and cures most if caught early; get
   trained help for eye signs, great pallor or breathlessness.
5. **Lime for maize** reads as the fruit: say slaked lime (the white
   mineral) or sieved wood ash, boiled with the maize, left overnight,
   washed well.
6. **Airtight storage of dry grain**: two thick liners inside a woven sack,
   the air pressed out, each tied separately (Purdue's bags), and the grain
   first dry enough (the salt-in-a-dry-bottle test). Thin bags leak.
7. **Yoghurt**: warmer than wrist-warm (the extension figure recalled is 42
   to 44 C for 4 to 7 hours); throw away a batch that does not set or smells
   wrong. A floating egg is old, not proven unsafe; a fresh one can still
   carry germs.

The full list is in `checks.md`.

## To finish

1. Open the sources (with Adam at the app to approve the pages, or from a
   session whose fetches are allowed):
   - US FDA, Bad Bug Book, 2nd edition, the chapter on phytohaemagglutinin
     (kidney beans);
   - FAO and WHO on cassava and cyanide (Codex standard for bitter cassava;
     WHO on konzo);
   - WHO fact sheet on mycotoxins (aflatoxin);
   - FAO, "Maize in human nutrition" (lime treatment, pellagra);
   - WHO on vitamin A, iron, iodine, thiamine (beriberi), niacin (pellagra),
     vitamin C (scurvy) deficiencies;
   - FAO post-harvest guidance on drying and storing grain; Purdue's PICS
     bags;
   - WHO fact sheet on household air pollution; CDC on carbon monoxide;
   - USDA FSIS: the safe temperature chart, the danger zone, the colour of
     meat and poultry, shell eggs (to confirm what 1.24.5 took from the
     CDC, and for the egg test);
   - WHO, Five keys to safer food (doneness with no thermometer; 5 and
     60 C; 70 C);
   - WHO, Guideline for complementary feeding of infants and young children
     6 to 23 months (2023), for the child with no breast milk.
2. Correct each draft to what the page says, in Lantern's own words; have a
   checker that has not seen the drafting read them against the same pages.
3. Add them to `FOOD_LESSONS_SAFE` (or a new `FOOD_LESSONS_KEEP`), to the
   Food tile's groups (a group "In the kitchen" for bread and fuel), to
   `LESSON_WORDS`, to `GUIDE_FOOD`, and pin their figures in `tests/food.js`.
4. Add the beans row to the tile's cooking table.
