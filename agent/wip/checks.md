# What the two checkers reported (2026-11-06)

Each is a separate agent that had not seen the drafting. Their reports are kept as they wrote them.
[H] = sure of the figure or wording, [M] = sure of the substance only, NV = not verified against an opened page.

## Checker 2: the NEW Food lessons (opened no page; everything below is from memory)

FOOD LESSON FACT-CHECK: NOT COMPLETED AS ASKED. READ THIS FIRST.

No source was opened. WebSearch refused the first call ("budget used up": 200 searches per turn, shared by all agents). WebFetch refused every URL not already in the conversation (permission request unanswered, "do not retry"): the FSIS safe-temperature chart, FSIS danger-zone page, FSIS colour-of-meat page and the FDA Bad Bug Book PDF. I did not go round either block (no curl, no browser). The scratchpad and repo hold no saved sources.

So everything below is my recall of the named documents: [H] = confident of the figure or wording, [M] = confident of the substance only. All of it is NOT VERIFIED. A follow-up message from Adam resets the search budget. Until then the changelog should not say these lessons were checked against sources.

Checked locally: both drafts are already in the uncommitted working tree of lantern-1.24.5; the cross-referenced lesson titles exist. Nothing from the memory store was used.

A. PROBLEMS (most serious first)

1. food_fuel, "full boil for a few minutes ... leave it for some hours ... Bring it back to the boil".
- Kidney beans: FDA says about 80 C can make them up to five times more toxic than raw, and slow cookers (75 C) caused outbreaks [H]. A hay box sits in that range.
- "some hours" has no limit; WHO's rule is hot food above 60 C [H].
- Re-boiling does not destroy the heat-stable toxins of Staph. aureus or Bacillus cereus (USDA: reheating may not make food safe) [H].
- I know of no food-safety agency text on hay boxes: not verified.
- Fix: "Beans get their full hard boil first. Open the box while the pot is still too hot to hold; if it is only warm it has stood too long. Re-boil and eat at once."

2. food_staples, "soak them in water for several days, or ferment them, or dry them in the sun".
- Sun-drying alone removes the least cyanide and is the short cut tied to konzo outbreaks (Mozambique 1981, DR Congo) [H]. Quick boiling removes about half [M].
- The module header itself gives a sequence ("peel, soak or ferment, dry, cook"); the lesson turned "dry" into an alternative.
- Codex: bitter cassava is peeled, cut, rinsed and fully cooked, and the water discarded [M].
- Fix: "Bitter: peel; soak or ferment for several days; throw the water away; then dry or roast; then cook. Drying alone is not enough. Sweet: peel, boil well, discard the water. If unsure, or after drought, treat as bitter."

3. food_staples, "boil them hard in fresh water for at least 10 minutes" (and the header "boil 10 minutes").
- The current Bad Bug Book (2nd ed., 2012) says soak at least 5 hours, pour away, boil in fresh water at least 30 minutes. Ten minutes is the 1st-edition and UK figure [H].
- Fix: "at least 30 minutes"; correct the header.

4. food_cook, "Leftovers: reheated until steaming hot all through (74 C), and once only" (same in food_safe).
- Implies reheating makes kept food safe. USDA: food over 2 hours in the danger zone is discarded; some toxins survive cooking [H].
- Fix: add "Reheating does not rescue food that stood warm for hours, cooked rice above all."

5. food_cook, "no pink at the bone, and the juices run clear"; "no pink anywhere".
- USDA: colour and juices are unreliable; one burger in four browns before 71 C; safely cooked poultry can stay pink [H]. See B.

6. food_staples, "soaked and cooked in lime water or wood-ash water".
- "Lime" reads as the fruit. FAO's order is cook in about 1% lime, steep overnight, wash [M].
- Fix: "boiled with a little slaked lime (the white mineral, not the fruit) or sieved wood ash, left overnight, then washed well."
- The "or eaten with beans, groundnuts, eggs, fish or meat" clause matches WHO's pellagra document [M].

7. food_lack, "Each is cured by food".
- False, and it delays care. Vitamin A eye signs are an emergency; blindness, iodine damage to a baby and bent bones do not reverse; anaemia also comes from malaria, worms and bleeding (WHO) [H].
- Fix: "Food prevents them all and cures most if caught early; get trained help for eye signs, great pallor or breathlessness."

8. food_lack, "after months without fresh food".
- Signs begin after 1 to 3 months (WHO scurvy 1999; NIH) [M]. Fix: "after one to three months".

9. food_store, "a plastic bag inside another, filled to the top and tied tight".
- Purdue PICS is two 80-micron liners inside a woven sack, air pressed out, each tied separately [H]. Thin bags leak and borers pierce them.
- Grain must first be at about 13% moisture [M]. The header cites the salt test; the lesson omits it.
- Fix: name thick, unholed bags; add the salt-in-a-dry-bottle test (figures not verified).

10. food_milk, "comfortably warm to the inside of the wrist ... a spoonful ... 6 to 8 hours".
- Extension (NCHFP): 42 to 44 C, 4 to 7 hours, a quarter cup per quart [M]. Wrist-warm is cooler and sets slowly.
- "one that floats is old - throw it away": USDA says floating shows age, not safety [H]. Discarding is cautious; add that a fresh egg can still carry germs.
- Fix: "warmer than wrist-warm but bearable"; "throw away a batch that does not set or smells wrong".

11. food_cook, "1 hour in very hot weather".
- USDA: above 90 F (32 C) [H], which is ordinary tropical heat. Fix: "above about 32 C".
- "Whole cuts ... 63 C" does not cover wild game (CDC 71 C) [M] or minced poultry (74 C) [H].

12. food_children.
- "the diarrhoea that causes most child malnutrition": WHO attributes about half [M].
- "an animal food ... or beans": WHO 2023 says meat, fish or egg daily, with pulses besides [H].
- "as teeth come": PAHO says finger foods by 8 months, family food by 12 [H].
- Add "not even water" for the first six months [H].

13. food_safe.
- "a rolling boil for one minute": health_water says 3 minutes above 1,500 m; make them agree.
- "off smells are warnings": add that dangerous food can look and smell normal (USDA) [H].

14. food_staples, "stunts children": WHO calls it an association [M]. Add that the poison can be present with no visible mould.

B. DISAGREEMENTS
- Doneness without a thermometer: WHO Five Keys says "juices clear, not pink" [H]; USDA says colour misleads. Safest: "cut the thickest part: steaming, no pink, clear juices; if unsure, cook longer."
- Whole cuts: USDA 63 C plus 3 minutes; WHO 70 C for everything. With no thermometer or meat inspection: cook through.
- Beans: FDA 5 hours and 30 minutes; UK 12 hours and 10 minutes. Use overnight and 30 minutes.
- Reheating: UK says once; USDA sets no limit. Keep "once".
- Animal milk under 12 months: CDC says no; WHO 2023 allows it from 6 months when there is no breast milk.

C. OMISSIONS
1. Never butcher or eat an animal found dead or sick (anthrax; WHO).
2. Cassava leaves (pound, boil well, never raw), and konzo: sudden lasting leg paralysis (WHO, FAO).
3. Beriberi kills breastfed babies whose mothers live on polished rice (WHO thiamine 1999).
4. The child over 6 months with no breast milk: boiled animal milk and 4 to 5 meals (WHO 2005, 2023).
5. Grass pea (lathyrism), ergot in rye, lima beans (cyanide).
6. Charcoal or a fire in a closed room kills by carbon monoxide (CDC).

D. VERIFIED
Against a live page: nothing.

Agreeing with my recall, to be opened next:
- 74/71/63 C plus 3 minutes, fish 63 C, 2 hours, 60 C: fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart and .../danger-zone-40f-140f (both blocked)
- Colour: .../color-meat-and-poultry (blocked)
- Beans: fda.gov/media/83271/download (blocked)
- Five keys, 5 C, 70 C: who.int/publications/i/item/9789241594639
- Aflatoxin "mouldy, discoloured or shrivelled", milk: who.int/news-room/fact-sheets/detail/mycotoxins
- Meal frequencies, two years or beyond: who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding; guideline who.int/publications/i/item/9789240081864
- "Thick enough to stay on the spoon"; extra meal for at least two weeks: PAHO/WHO Guiding Principles 2003; WHO diarrhoea manual 2005
- Honey: cdc.gov/botulism/prevention
- Smoke: who.int/news-room/fact-sheets/detail/household-air-pollution-and-health
- Green potatoes (cut generously, bitter, peel, discard water): BfR opinion 010/2018
- Bread: 3:2 is 67% hydration, normal; nothing unsafe. Add "cover loosely; discard a pink or mouldy starter; the rise takes many hours."

## Checker 1: the Food tile as it was in 1.24.4 (opened CDC and NCHFP pages)

FOOD TILE FACT-CHECK (no files edited)

LIMITS. No web search ran: the turn's search budget was already spent. WebFetch opened only cdc.gov and nchfp.uga.edu (which hosts the USDA Complete Guide to Home Canning); every other host needed an approval nobody answered. Blocked, NOT opened: fsis.usda.gov (safe-temperature-chart, color-meat-and-poultry, jerky), ask.usda.gov, foodsafety.gov, fda.gov (egg safety), who.int (healthy-diet), pubmed 2305711 (Mifflin), ods.od.nih.gov, cdn.realfood.gov/DGA.pdf, fieldreport.caes.uga.edu C1334, uaf.edu. "NV" = not verified, from memory only. Tags are keyed in D. Nothing from user memory was used.

A. PROBLEMS, most serious first
1. Table Preserving, "Oil covering | seals out air | cooked vegetables, cheese, herbs". Unsafe. NCHFP: "Herbs and oils are both low-acid and together could support the growth of ... Clostridium botulinum"; fresh use only, refrigerated, 2-3 days [N1]. CDC: refrigerate, discard after 4 days [C3]. USDA: toxin within 3-4 days in moist low-acid food, 40-120 F, under 2% oxygen [N2]. Fix: delete; add "Never: vegetables, garlic, herbs, cheese, meat or fish under oil or sealed airtight".
2. Table note, "water, warmth, or air". CDC: botulinum grows in low oxygen, low acid, low sugar, low salt [C4]. Fix: "...by taking away water (drying, salt, sugar), making food sour, or cold. Shutting out air does not preserve moist food; botulism needs exactly that." The lesson's "Never ... sealed in a jar" then needs its exceptions (boiled jam, salted ferment).
3. Table Drying, "meat (jerky) ... fish". NCHFP: meats "are not recommended for out-of-doors drying" [N3]; heat to 160 F (71 C) before or after drying; pork and game carry trichina; keeps 2 weeks at room temperature [N4]. CDC lists "Dried, unsalted fish" as a botulism source [C5]. Fix: row = grains, beans, fruit, herbs; separate row "Meat, fish: salted, thin, heated through, cooked before eating; weeks, not months". The corrected lesson's "dried hard in dry weather" and "keeps for months" overreach the same sources.
4. food_ferment, "trust your senses". CDC: "You cannot see, smell, or taste the toxin" [C3]; "Never taste food to know if it is safe" [C6]; fermented fish and sea mammal, and ferments in sealed plastic or glass, cause botulism [C5]. Fix: "Bad smell, slime or mould: throw out. A good smell is not proof. Salted vegetables only; never fish or meat."
5. Table Cook, "juices run clear, no pink at the bone", "no pink throughout". CDC: "The only way to tell if food is safely cooked is to use a food thermometer. You can't tell ... by checking its color and texture (except for seafood)" [C1]. 74/71/63 C are right; "a few minutes" should be 3. Fix: temperature first; signs as a fallback that can mislead (see B).
6. food_thrift "Cook in batches to save fuel"; table "Reheated leftovers"; note "When in doubt, cook longer". CDC: perishable food out at most 2 hours (1 hour above 90 F/32 C) [C1]; with no cold, leftovers go after 4 hours; "When in doubt, throw it out" [C6]. Fix: "No fridge: cook what will be eaten at that meal. Cooking longer does not rescue food that sat out." (Heat-stable toxins: NV.)
7. Calculator accepts children. A 6 kg baby is shown 0.21 L water; CDC: breast milk only for about 6 months, then 4-8 oz (120-240 ml) water a day to 12 months [C9]. A 10 kg child gets 350 ml against about 1 L paediatric maintenance (NV). Energy about 10-25% low for children and teenagers (my arithmetic against FAO 2001, NV); protein 0.9 is under WHO's 1.14 g/kg at age 1 (NV). Fix: under 18 show no numbers and say why; under 6 months "breast milk, no water".
8. Table Eggs, "firm for the vulnerable". CDC lists runny eggs as riskier for everyone; safer is "cooked until the yolks and whites are firm"; egg dishes 160 F (71 C) [C2]. Fix: "firm; matters most for children, pregnant, old, ill".
9. food_ferment, "3 tablespoons to 2 kg", "days to weeks in a cool place". USDA: 3 tablespoons canning salt per 5 lb (2.27 kg); keep 1-2 inches under brine; 70-75 F (21-24 C) 3-4 weeks, 60-65 F 5-6 weeks, below 60 F (16 C) "may not ferment"; never cut the salt; flake salt "varies in density" [N5][N6][N7]. The spoon ratio errs safe; roughly 20-25 g per kg (spoon weight NV). Fix: grams per kg; "3-6 weeks at room temperature, then store cool".
10. Table "Sugar / honey ... fruit (jam)". NCHFP: sugar is the preservative, never reduce it; honey replaces "part, but not all"; fill hot into sterile jars, process 5 minutes in boiling water; mouldy jam is discarded whole; once opened about 1 month refrigerated [N8][N9][N10]. No tested method for fruit kept in honey was found. Fix: "Sugar (boiled jam, tested recipe)"; drop honey.
11. Table Smoking, "preserving compounds in smoke", "(often after salting)". NCHFP calls smoke "an additional preservative" only for meat already cured [N11]; USDA: lightly smoked fish "has not yet been cooked" [N12]; CDC lists refrigerated smoked seafood as risky [C14]. Fix: "helps dry salted meat or fish; alone it neither cooks nor keeps; always after salting".
12. food_micro "sprouted foods"; food_ferment yoghurt. CDC: raw sprouts riskier, eat "cooked ... until steaming hot" [C2]; raw milk carries Campylobacter, E. coli, Listeria, Brucella, Salmonella [C10]. Fix: "cook sprouts"; "boil the milk first".
13. food_balance "as good as meat". CDC: iron in beans and greens is "less easily absorbed"; vitamin C helps [C8]. B12 only in animal foods: NV. Fix: "complete protein; eat with vitamin-C foods, and some egg, milk, fish or meat when possible".

B. DISAGREEMENTS
- Doneness by eye: CDC says thermometer only [C1]; WHO Five Keys accepts clear juices and boiling stews (NV). Wording: "Thermometer if you have one. Without: cut small, boil or stew, or cook until the middle steams, no pink, juices clear, then longer. These signs can mislead."
- Herb oil: 2-3 days [N1] against 4 [C3], both refrigerated. No fridge: same day only.
- Protein: WHO 0.83 g/kg against the US 2025-2030 guidelines' 1.2-1.6 (both NV). Call 0.8-1 a minimum.
- Water: 35 ml/kg (2.45 L at 70 kg) sits between EFSA 2.0/2.5 L and US 2.7/3.7 L total water, food included (NV). CDC gives no figure, says more in heat, work, fever, diarrhoea [C13]. Fine for adults.
- Plate: matches Harvard/MyPlate; the UK guide gives staples over a third (NV). Add "more staple for hard work or the underweight".
- Activity: the four factors are the popular set, not from Mifflin's paper; FAO rates heavy work 2.0-2.4 (NV), so 1.725 is low for hand labour. The equation's constants match Mifflin-St Jeor, adults only (NV).

C. OMISSIONS
1. Botulism is an emergency [C4]; boil doubtful home-preserved low-acid food 10 minutes [C3][C11].
2. No honey before 12 months [C3].
3. Vitamin D (rickets), folate, zinc are missing from food_micro [C7].
4. Pork and game carry trichina [N4].
5. Kidney beans, cassava, green potato peel (bears on "peelings for stock"), mouldy grain: all NV; already on the main session's list.
6. Pregnancy and nursing additions in the calculator (NV).

D. VERIFIED (pages opened)
[C1] 145 F + 3 min, 160, 165, fish 145 or opaque and flaking, leftovers 165, 2-hour rule: https://www.cdc.gov/food-safety/prevention/index.html
[C2] eggs, sprouts: https://www.cdc.gov/food-safety/foods/safer-food-choices.html
[C3] https://www.cdc.gov/botulism/prevention/index.html
[C4] https://www.cdc.gov/botulism/about/index.html
[C5] https://www.cdc.gov/botulism/prevention/alaska-native-foods.html
[C6] https://www.cdc.gov/food-safety/foods/keep-food-safe-after-emergency.html
[C7] vitamin A, iron, iodine, D, folate, zinc: https://www.cdc.gov/nutrition/features/micronutrient-facts.html
[C8] https://www.cdc.gov/infant-toddler-nutrition/vitamins-minerals/iron.html
[C9] https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-encourage.html and https://www.cdc.gov/infant-toddler-nutrition/breastfeeding/index.html
[C10] https://www.cdc.gov/food-safety/foods/raw-milk.html
[C11] https://www.cdc.gov/botulism/prevention/home-canned-foods.html
[C13] https://www.cdc.gov/healthy-weight-growth/water-healthy-drinks/index.html
[C14] https://www.cdc.gov/food-safety/foods/pregnant-women.html
[N1] https://nchfp.uga.edu/faqs/miscellaneous-questions/category/faq-canning
[N2] https://nchfp.uga.edu/papers/guide/GUIDE01_HomeCan_rev0715.pdf
[N3] https://nchfp.uga.edu/how/dry/drying-general/sun-drying/
[N4] https://nchfp.uga.edu/how/dry/recipes/jerky/
[N5] https://nchfp.uga.edu/how/ferment/recipes/sauerkraut/ and https://nchfp.uga.edu/papers/guide/GUIDE06_HomeCan_rev0715.pdf
[N6] https://nchfp.uga.edu/how/ferment/general-information-on-fermenting/general-information-on-fermenting/
[N7] https://nchfp.uga.edu/how/ferment/general-information-on-fermenting/suitable-containers-covers-and-weights-for-fermenting-food/
[N8] https://nchfp.uga.edu/how/make-jam-jelly/jams-jellies-general-information/jellied-product-ingredients/
[N9] https://nchfp.uga.edu/how/make-jam-jelly/jams-jellies-general-information/general-information-on-canning-jams-jellies-and-marmalades/
[N10] https://nchfp.uga.edu/how/make-jam-jelly/jams-jellies-general-information/storing-home-canned-jams-and-jellies/
[N11] https://nchfp.uga.edu/how/cure-smoke
[N12] https://nchfp.uga.edu/papers/guide/GUIDE05_HomeCan_rev0715.pdf
Dried food kept cool, dry, dark, checked, mouldy discarded: https://nchfp.uga.edu/how/dry/drying-general/packaging-and-storing-dried-foods/

No fault found but NV: 2000-2500 kcal; 0.8-1 g/kg; "cannot store it well"; vitamin C and scurvy; calcium sources; "use the cooking water"; cellar row.
