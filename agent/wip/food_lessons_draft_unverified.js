// MODULE: FOOD_LESSONS_SAFE - START
// Depends: MATH_LESSONS
// Exports: (none) -- registers food-safety lessons (food_*): cooking so it is safe, foods that must be prepared the right way, milk and eggs
// ===========================================================================
// The Food audit (1.24.5). What makes food safe to eat where there is no
// fridge and nobody to ask. The figures, in Lantern's own words, are from:
// the US Department of Agriculture's Food Safety and Inspection Service
// (safe minimum internal temperatures, the 2-hour rule); the World Health
// Organization's Five Keys to Safer Food (5 and 60 degrees C, 2 hours, safe
// water and raw materials); the US Food and Drug Administration's Bad Bug
// Book (kidney beans: soak 5 hours, boil 10 minutes in fresh water); FAO and
// WHO on cassava (cyanide; peel, soak or ferment, dry, cook), on aflatoxin
// in mouldy grain and groundnuts, and on maize, lime and pellagra; US CDC
// (no honey under one year; raw milk).
(function () {
  var L = Lantern.mathLessons;

  L.add("food_cook", "Cooking food so it is safe", "<p>Heat kills the germs in food. Cook meat, poultry, eggs and fish <b>all the way through</b>, and bring soups and stews to the <b>boil</b>.</p>" +
    "<ul><li><b>Poultry:</b> no pink at the bone, and the juices run clear (74 &deg;C inside).</li>" +
    "<li><b>Minced meat and sausages:</b> no pink anywhere (71 &deg;C).</li>" +
    "<li><b>Whole cuts of beef, pork or lamb:</b> at least 63 &deg;C inside, then left to rest three minutes.</li>" +
    "<li><b>Fish:</b> the flesh turns opaque and flakes with a fork (63 &deg;C).</li>" +
    "<li><b>Eggs:</b> until the white and the yolk are firm.</li>" +
    "<li><b>Leftovers:</b> reheated until steaming hot all through (74 &deg;C), and once only.</li></ul>" +
    "<p><b>Cooked food left warm is where germs grow fastest.</b> Eat it within <b>2 hours</b> of cooking (1 hour in very hot weather), or keep it hot (above 60 &deg;C), or cool it quickly and keep it cold (below 5 &deg;C). With no fridge, cook what will be eaten at that meal.</p>" +
    "<p>Keep raw meat, and the knife and board it touched, away from food that is ready to eat, and wash hands, knife and board with soap after it. Wash fruit and vegetables in safe water; if the water is doubtful, peel them or cook them.</p>");

  L.add("food_staples", "Foods that must be prepared the right way", "<p>Some good foods are harmful unless they are prepared the way people have long known to prepare them. Do not skip these steps when food is short.</p>" +
    "<ul><li><b>Cassava (manioc):</b> the roots, above all the bitter kinds, hold a poison (cyanide). Peel them; then grate or slice them and soak them in water for several days, or ferment them, or dry them in the sun; then cook them well. Never eat bitter cassava raw or only quickly boiled.</li>" +
    "<li><b>Red kidney beans, and other dry beans:</b> raw or half-cooked they cause violent vomiting. Soak them for at least 5 hours, throw that water away, and <b>boil them hard in fresh water for at least 10 minutes</b> before simmering them soft. A slow simmer that never boils is not enough.</li>" +
    "<li><b>Potatoes turned green or sprouting:</b> cut the green parts and the sprouts away deeply, and throw away a potato that is green all through or tastes bitter. Cooking does not destroy the poison.</li>" +
    "<li><b>Mouldy maize, grain, groundnuts (peanuts) or dried cassava:</b> the mould leaves a poison (aflatoxin) that cooking does not destroy; it harms the liver and stunts children. Do not eat mouldy, discoloured or shrivelled kernels or nuts, and do not feed them to animals whose milk you drink. Dry crops fast and fully, off the bare ground, and store them dry.</li>" +
    "<li><b>Maize as almost the only food</b> brings pellagra (rough dark skin where the sun reaches, diarrhoea, a troubled mind) unless the maize is first soaked and cooked in lime water or wood-ash water, as in Mexico and Central America, or eaten with beans, groundnuts, eggs, fish or meat.</li>" +
    "<li><b>Polished white rice as almost the only food</b> brings beriberi (weak, numb legs; swelling; a failing heart). Parboiled or brown rice, and beans, prevent it.</li>" +
    "<li><b>Wild mushrooms and plants:</b> eat only what local people know well. No test - a silver spoon, a change of colour, an animal eating it - shows that a mushroom is safe.</li>" +
    "<li><b>Honey</b> is not given to a baby under one year.</li></ul>");

  L.add("food_milk", "Milk, yoghurt and eggs", "<p><b>Milk straight from the animal</b> can carry tuberculosis, brucellosis (a fever that keeps returning) and the germs of diarrhoea. <b>Bring it to the boil</b> before drinking it or giving it to children, and keep the pot covered as it cools. Milk with a clean udder, clean hands and a clean, scalded pail keeps longer.</p>" +
    "<p><b>Yoghurt</b> keeps milk for days where fresh milk sours in hours. Boil the milk and let it cool until it is comfortably warm to the inside of the wrist. Stir a spoonful of live yoghurt into each litre, cover the pot, wrap it to keep it warm, and leave it for 6 to 8 hours until it has set. Keep a spoonful to start the next batch.</p>" +
    "<p><b>Eggs:</b> store them cool. An egg that sinks and lies flat in a bowl of water is fresh; one that floats is old - throw it away. Cook eggs until white and yolk are firm, above all for small children, the old, the sick and pregnant women. Wash hands after handling raw eggs or hens.</p>");
})();
// ===========================================================================
// MODULE: FOOD_LESSONS_SAFE - END
// ===========================================================================
// ===========================================================================
// MODULE: FOOD_LESSONS_KEEP - START
// Depends: MATH_LESSONS
// Exports: (none) -- registers lessons (food_*): storing grain, beans and roots; illnesses of a narrow diet; porridge and bread; cooking with less fuel and smoke
// ===========================================================================
// The Food audit (1.24.5). In Lantern's own words, from: FAO's post-harvest
// guidance (drying, the bite and salt tests, platforms and rat guards,
// airtight storage of DRY grain); Purdue University's work on airtight bags;
// WHO and FAO on vitamin and mineral deficiencies (vitamin A, iron, iodine,
// vitamin C, niacin, thiamine, vitamin D); WHO on household air pollution
// from cooking fires.
(function () {
  var L = Lantern.mathLessons;

  L.add("food_store", "Storing grain, beans and roots", "<p>More of a harvest is lost to damp, insects and rats than to anything else.</p>" +
    "<ul><li><b>Dry it first.</b> Dry grain and beans in the sun on a mat, a sheet or a clean platform - not on bare ground - turning them, until a kernel is hard and cracks between the teeth instead of denting. Damp grain goes mouldy, and the mould leaves a poison.</li>" +
    "<li><b>Clean it:</b> winnow out chaff, broken and mouldy kernels, and insects.</li>" +
    "<li><b>Keep it dry and off the ground:</b> in sacks on a raised platform away from the walls, or in a granary on legs with a collar of tin round each leg to stop rats.</li>" +
    "<li><b>Airtight, for dry grain only:</b> grain that is truly dry keeps best shut in with as little air as possible - a drum, a jerrycan, or a plastic bag inside another, filled to the top and tied tight. The insects inside die for want of air. Moist food is never sealed this way.</li>" +
    "<li><b>Roots and tubers</b> want it cool, dark and airy, never wet: a shaded pit or a heap covered with dry grass. Handle them gently, since a bruise rots; keep potatoes from the light, which turns them green. Cassava roots spoil within days of being dug: leave them in the ground until they are needed, or dry them.</li>" +
    "<li>Use the oldest first, and look at the store every week or two for damp, warmth, insects and droppings.</li></ul>");

  L.add("food_lack", "Illnesses that come from a narrow diet", "<p>When people eat almost one food for months, these appear. Each is cured by food, and variety prevents them all.</p>" +
    "<ul><li><b>Cannot see at dusk (night blindness); dry eyes</b> (too little vitamin A): later the eye clouds and goes blind, and measles and diarrhoea kill more easily. Orange and dark green vegetables and fruit (carrot, pumpkin, orange sweet potato, mango, papaya, dark leaves), egg, liver, milk, red palm oil.</li>" +
    "<li><b>Pale and always tired</b> (anaemia, too little iron): pale inside the lower eyelid and on the palms, breathless. Commonest in women and small children. Meat, liver, fish, beans and dark leaves, eaten with fruit, which helps the body take up the iron.</li>" +
    "<li><b>A swelling in the front of the neck</b> (goitre, too little iodine); babies of mothers who lack iodine can be slow in mind and growth. Iodised salt, sea fish.</li>" +
    "<li><b>Bleeding, swollen gums and wounds that will not heal</b> (scurvy, too little vitamin C), after months without fresh food. Fresh fruit, vegetables and leaves, potatoes, sprouted beans and grain. Long cooking and drying destroy it.</li>" +
    "<li><b>Rough dark skin where the sun reaches, diarrhoea, a troubled mind</b> (pellagra) on a maize diet; <b>weak, numb legs and swelling</b> (beriberi) on a polished-rice diet: see Foods that must be prepared the right way.</li>" +
    "<li><b>Bowed legs and soft bones in a child</b> (rickets): sunlight on the skin each day, milk, eggs, small fish eaten bones and all.</li>" +
    "<li><b>A very thin child, or swelling of both feet:</b> too little food altogether - see the Health tile, Is this child dangerously thin?</li></ul>");

  L.add("food_bread", "Porridge, flatbread and bread from grain", "<p>Grain becomes food by grinding and cooking. Pick out stones and mouldy kernels first.</p>" +
    "<p><b>Porridge:</b> stir meal or flour into cold water, bring it to the boil stirring, and cook until thick - a few minutes for fine flour, longer for coarse meal. For a small child make it thick enough to stay on the spoon, and stir in oil, milk, egg, mashed beans or groundnut paste.</p>" +
    "<p><b>Flatbread:</b> flour, a pinch of salt, and enough water to make a soft dough that does not stick. Knead it for some minutes, rest it, press or roll it thin, and cook it on a hot dry pan or stone, turning it, until it is spotted brown on both sides.</p>" +
    "<p><b>Raised bread without bought yeast:</b> mix a little flour and water to a batter in a jar and keep it warm, adding a spoonful of flour and water each day; in about a week it bubbles and smells sour - a <b>starter</b>. Mix a few spoonfuls into dough made of about 3 parts flour to 2 parts water by weight with a little salt, and keep some starter back for next time. Let the dough rise in a warm place until it has doubled, then bake it in a hot oven or a covered pot in the embers until the loaf sounds hollow when tapped underneath.</p>");

  L.add("food_fuel", "Cooking with less fuel and less smoke", "<p><b>Less fuel:</b> put a lid on the pot. Soak beans overnight and cut food small, so it cooks sooner. Use dry wood, split small, and shield the fire from the wind. A stove that encloses the fire and holds the pot close above it uses far less wood than three stones.</p>" +
    "<p><b>A hay box</b> finishes the cooking with no fuel: bring the pot to a full boil for a few minutes with its lid on, then set it at once in a box or basket packed tightly all round, under and over with dry grass, straw or old blankets, and leave it for some hours. <b>Bring it back to the boil before eating.</b></p>" +
    "<p><b>Less smoke:</b> smoke from cooking fires indoors causes pneumonia in small children and lung disease in the women who cook. Cook outside or under an open shelter when you can; indoors, give the smoke a way out - a chimney, a hood, a gap under the roof on two sides - and keep babies away from the fire.</p>");
})();
// ===========================================================================
// MODULE: FOOD_LESSONS_KEEP - END
