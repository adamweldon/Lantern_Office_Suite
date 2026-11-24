// cases.js -- the second review of the library catalog and of SUITE_CHAT's keeps(q) (1.24.38, branch
// wip-2026-11-24-library at 43135ea). Written without seeing the first review's cases or the drafting; right inputs
// above all, which must stay right. Run with replay.js. Severity is what it costs a person when the case disagrees:
//   high    a wrong lesson handed on a safety matter (illness, a dead animal, a medicine, wild food, fire), a band that
//           does not hold, OPEN read outside the library prompt;
//   medium  a right answer read as OPEN, a wrong "on shelf" or "most likely" claim, a food question the change was
//           made for that still gets nothing;
//   low     an odd offer ("may be on shelf"), a narrow gap.
// part A: keeps(q) and what Chat hands the model; B: OPEN (the reader, what it sends, whole turns); C: the shelf the
// library prompt names or offers; D: questions.json, the 60 labelled questions, and the bands measured on them.
"use strict";
var Q = require("./questions.json");
var PERISH = ["food_safe", "food_cook"];                   // the 2-hour rule (1 hour above 32 C): cooked or fresh food left out
var KEEPDRY = ["food_preserve", "health_food", "food_ferment"];   // dried, salted, smoked, fermented food
var MILK = ["food_milk", "food_safe", "food_cook"];
var FOODKEEP = PERISH.concat(KEEPDRY, ["food_milk"]);
var cases = [];
function push(id, part, input, expect, severity, why) { cases.push({ id: id, part: part, input: input, expect: expect, severity: severity, why: why }); }

// ---------------------------------------------------------------------------------------------------------------------
// A. keeps(q): what Chat hands the model (guard, about, self, then chatContext in order), in auto mode unless named
function A(n, q, expect, severity, why, mode) { push("A" + (n < 10 ? "0" : "") + n, "A", { kind: "handed", q: q, mode: mode || "auto" }, expect, severity, why); }
// A1. food kept, as people ask: a Food lesson that says how long (right inputs that must stay right)
A(1, "How long can cooked rice be left out on the table before it is unsafe to eat?", { anyOf: PERISH }, "high", "the bench row this change was made for (set B, 1.24.36)");
A(2, "how long is leftover stew good for", { anyOf: PERISH }, "medium", "leftovers, lower case, no question mark");
A(3, "How long does cooked ugali keep?", { anyOf: PERISH }, "medium", "a staple by its own name");
A(4, "How long can cooked beans sit out at a market stall?", { anyOf: PERISH }, "medium", "food sold warm at a stall");
A(5, "how long can I keep cooked chicken", { anyOf: PERISH }, "medium", "cooked poultry");
A(6, "How long can raw meat be left out?", { anyOf: PERISH }, "medium", "raw meat spoils as cooked food does: 2 hours");
A(7, "How long can cooked cassava be left out?", { anyOf: PERISH }, "medium", "a food not in the rule's list, named with cooked");
A(8, "How long can a cooked meal be left in a hot car?", { anyOf: PERISH }, "medium", "heat: the 1-hour rule above 32 C");
A(9, "How long do leftovers last?", { anyOf: PERISH }, "medium", "the plainest form");
A(10, "How long can cooked lentils be kept?", { anyOf: PERISH }, "medium", "pulses");
A(11, "How long can a cooked chicken stand out at a party?", { anyOf: PERISH }, "medium", "stand out");
A(12, "How long does cooked cabbage last?", { anyOf: PERISH }, "medium", "vegetables cooked");
A(13, "How long does cooked porridge stay good for?", { anyOf: PERISH }, "medium", "stay good for");
A(14, "How long can cooked rice be kept warm on the stove?", { anyOf: PERISH }, "medium", "kept warm is where germs grow (4 to 60 C)");
A(15, "How long does cooked fish keep?", { anyOf: PERISH }, "medium", "fish cooked");
A(16, "How long is milk good for after milking?", { anyOf: MILK }, "medium", "fresh milk");
A(17, "How long can boiled milk be left out?", { anyOf: MILK }, "medium", "milk boiled, then left");
A(18, "how long do vegetables last in a root cellar", { anyOf: KEEPDRY }, "low", "cellar storage is in Preserving food");
A(19, "How long do vegetables need to be kept in salt water to ferment?", { anyOf: ["food_ferment"] }, "low", "fermenting time is in Fermenting");
A(20, "How long can pork be kept before cooking?", { anyOf: PERISH }, "medium", "raw pork");
A(21, "How long can I keep food in a cool box?", { anyOf: FOODKEEP }, "low", "a cool box");
A(22, "HOW LONG CAN COOKED RICE BE LEFT OUT?", { anyOf: PERISH }, "medium", "in capitals");
A(23, "How long can cooked meat be left out when it is very hot?", { anyOf: PERISH }, "medium", "the hot-weather hour");
A(24, "How long can fish be left out at the market?", { anyOf: PERISH }, "medium", "fish at a market");
A(25, "How long do cooked sweet potatoes keep?", { anyOf: PERISH }, "low", "a root cooked");
A(26, "How long can cooked rice be left out on the table before it is unsafe to eat?", { anyOf: PERISH }, "high", "the bench row, short prompt (every prompt mode)", "short");
A(27, "How long can cooked rice be left out on the table before it is unsafe to eat?", { anyOf: PERISH }, "high", "the bench row, full prompt", "full");
A(28, "How long can cooked rice be left out on the table before it is unsafe to eat?", { anyOf: PERISH }, "high", "the bench row, library prompt", "library");
A(29, "How long can cooked rice be kept in the fridge?", { onlyKeys: FOODKEEP }, "low", "no fridge time in the lessons; Food lessons only, nothing else");
// A2. food kept, but nothing handed: the change does not reach them
A(30, "How long do eggs keep without a fridge?", { anyOf: ["health_food", "food_preserve", "food_milk", "food_safe"] }, "medium",
  "Keeping food without a fridge (Health tile, shelf 6.2) comes first, so the Food-tile filter drops all of it -- the commonest case for people with no fridge");
A(31, "how long does cooked rice keep without a fridge", { anyOf: PERISH.concat(KEEPDRY) }, "medium", "the bench question with \x27without a fridge\x27: Keeping food without a fridge comes first and nothing is given");
A(32, "How long does dried fish keep?", { anyOf: KEEPDRY }, "medium", "dried fish: both lessons say about two weeks for dried meat and fish; the Health-tile one comes first and nothing is given");
A(33, "how long does smoked meat last without a fridge", { anyOf: KEEPDRY }, "medium", "smoked meat: same, nothing given");
A(34, "How long can I keep fish in salt?", { anyOf: KEEPDRY }, "medium", "salted fish: same");
A(35, "How long does salted fish keep?", { anyOf: KEEPDRY }, "medium", "salted fish: same");
A(36, "How long does dried meat keep?", { anyOf: KEEPDRY }, "medium", "dried meat: same");
A(37, "How long does butter keep without a fridge?", { anyOf: KEEPDRY.concat(["food_milk"]) }, "low", "butter: same");
A(38, "how long will fresh fish last in the heat", { anyOf: PERISH }, "medium", "no sure passage; the 2-hour/1-hour rule answers it");
A(39, "How long can porridge be left out?", { anyOf: PERISH }, "medium", "no sure passage");
A(40, "How long can soup be kept in a pot overnight?", { anyOf: PERISH }, "medium", "no sure passage");
A(41, "How long before leftover rice goes off?", { anyOf: PERISH }, "medium", "the rice question again, other words: nothing given");
A(42, "How long can I leave cooked rice out?", { anyOf: PERISH }, "medium", "\x27leave ... out\x27 is not in KEEPS (only left out, be left)");
A(43, "how long can cooked rice stay out", { anyOf: PERISH }, "medium", "\x27stay out\x27 is not in KEEPS");
A(44, "How long is cooked rice safe at room temperature?", { anyOf: PERISH }, "medium", "\x27how long is ... safe\x27 is not in KEEPS");
A(45, "How long can rice be left out at 35 degrees?", { anyOf: PERISH }, "medium", "a digit stops keeps(), though the lesson has this very answer (1 hour above 32 C)");
A(46, "How long can cooked rice be kept for the next day?", { anyOf: PERISH }, "medium", "keeps() is true; no sure passage");
A(47, "How many days does cooked meat keep?", { anyOf: PERISH }, "low", "not \x27how long\x27");
A(48, "can I still eat rice from yesterday", { anyOf: PERISH }, "low", "not \x27how long\x27: the plainest way it is asked");
A(49, "Is it safe to eat chicken that was left out overnight?", { anyOf: PERISH }, "low", "safe to eat was left out on purpose (first review); the lesson answers it");
A(50, "How long does a stew keep if I boil it again every day?", { anyOf: PERISH }, "low", "reheating more than once is in Keeping food and water safe");
A(51, "How long can you keep meat that smells a bit?", { anyOf: PERISH }, "low", "meat that smells wrong is thrown away (Keeping food and water safe)");
A(52, "How long does goat milk keep without a fridge?", { anyOf: MILK.concat(KEEPDRY) }, "low", "Goats & milk comes first, so nothing is given");
A(53, "How long does fish keep once it is caught?", { anyOf: PERISH }, "low", "no sure passage");
A(54, "How long will cooked maize porridge keep?", { anyOf: PERISH }, "low", "no sure passage");
// A3. not food kept: no Food lesson (right inputs that must stay right)
A(60, "How long will a car battery last?", { noApp: ["food"] }, "medium", "a battery");
A(61, "How long does a tyre last?", { noApp: ["food"] }, "medium", "a tyre");
A(62, "How long do bean seeds keep for planting?", { noApp: ["food"] }, "medium", "seed, with a food word (beans would be, bean is not)");
A(63, "How long do seeds keep?", { noApp: ["food"] }, "medium", "seeds");
A(64, "How long can a person last without food?", { noApp: ["food"] }, "medium", "a person going without");
A(65, "How long can baby formula be left out?", { noApp: ["food"] }, "high", "a baby\x27s formula (left to the model, as the change intends)");
A(66, "How long can breast milk be kept?", { noApp: ["food"] }, "high", "breast milk");
A(67, "How long does ORS keep once mixed?", { noApp: ["food"] }, "high", "oral rehydration solution");
A(68, "How long can vaccines be kept out of the fridge?", { noApp: ["food"] }, "high", "vaccines");
A(69, "How long does insulin last outside the fridge?", { noApp: ["food"] }, "high", "a medicine");
A(70, "How long does diesel keep in a drum?", { noApp: ["food"] }, "medium", "fuel");
A(71, "How long does paint keep once opened?", { noApp: ["food"] }, "low", "paint");
A(72, "How long does cement keep in the bag?", { noApp: ["food"] }, "low", "cement");
A(73, "How long should chicken manure be stored before it goes on the garden?", { noApp: ["food"] }, "medium", "manure: keeps() is true (chicken, stored), nothing is handed today -- must stay so");
A(74, "How long can a chicken last without water?", { noApp: ["food"] }, "medium", "a live animal going without: keeps() is true, nothing handed today");
A(75, "How long can eggs be kept before setting them under a hen?", { noApp: ["food"] }, "medium", "hatching eggs: keeps() is true, nothing handed today");
A(76, "How long should bread dough be left to rise?", { noApp: ["food"] }, "medium", "proving dough: the 2-hour rule would be the wrong answer");
A(77, "How long can beans be left to soak?", { noApp: ["food"] }, "medium", "soaking overnight is normal: the 2-hour rule would be the wrong answer");
A(78, "How long do fruit trees last?", { noApp: ["food"] }, "low", "a tree\x27s life");
A(79, "How long can a chicken be kept in a small cage?", { noApp: ["food"] }, "medium", "a live bird");
A(80, "How long does a cow keep giving milk after calving?", { noApp: ["food"] }, "low", "lactation");
A(81, "How long does a rice cooker last?", { noApp: ["food"] }, "low", "a machine");
A(82, "How long should a calf be kept on milk?", { noApp: ["food"] }, "medium", "rearing a calf");
A(83, "How long should a meat chicken be kept before slaughter?", { noApp: ["food"] }, "medium", "rearing a bird");
A(84, "How long do I keep rice seedlings in the nursery?", { noApp: ["food"] }, "medium", "seedlings");
A(85, "How long does a hen keep laying eggs?", { noApp: ["food"] }, "low", "laying life");
A(86, "How long can a fish be kept alive in a bucket?", { noApp: ["food"] }, "low", "a live fish");
A(87, "How long does pork tapeworm last in the body?", { noApp: ["food"] }, "medium", "an illness");
A(88, "How long does chicken feed keep?", { noApp: ["food"] }, "low", "animal feed");
A(89, "My daughter has been vomiting since she ate old fish. How long will it last?", { noApp: ["food"] }, "high", "a sick child: never a Food lesson in place of Health");
A(90, "How long does diarrhoea from bad food last in a child?", { via: "health-need" }, "high", "HEALTH_CHAT unaffected: its lesson first");
A(91, "My baby has diarrhoea. How long can I keep giving breast milk?", { via: "health-need" }, "high", "HEALTH_CHAT unaffected");
A(92, "How long can I keep tablets once the packet is open?", { noApp: ["food"] }, "high", "a medicine with no medicine word in MEDW (tablets is)");
// A4. not food kept, but handed a Food lesson today
A(93, "How long does food poisoning last?", { noApp: ["food"] }, "high",
  "an illness: handed Keeping food and water safe and Preserving food (and in the library prompt \x27on shelf 6.2 food\x27, sure); the person needs Diarrhoea care at home and when to get help");
A(94, "How long can a baby last without milk?", { noApp: ["food"] }, "medium", "a person going without (the change means to leave these out): a baby not feeding is a danger sign, not a keeping question");
A(95, "How long can my family last on the food we have left?", { noApp: ["food"] }, "medium", "people going without, said another way: handed Cooking food so it is safe");
A(96, "How long will our food stores last if we ration?", { noApp: ["food"] }, "medium", "rationing is a sum: handed Preserving food, whose \x27dried fruit keeps about a year\x27 a small model may copy");
A(97, "How long does a dog\x27s food last once the bag is open?", { noApp: ["food"] }, "low", "pet food");
A(98, "How long can I keep food for the pigs?", { noApp: ["food"] }, "low", "pig swill (it has its own rules)");
A(99, "How long does milk powder keep once opened?", { noneOf: ["food_children"] }, "low", "handed Feeding babies and children, which does not answer it");
A(100, "How long can a baby\x27s bottle of milk be left out?", { noApp: ["food"] }, "low", "formula or expressed milk in a bottle: MEDW leaves formula to the model, this way of saying it is not");
A(101, "How long does fruit keep?", { noneOf: ["food_preserve"] }, "low", "fresh fruit: handed only Preserving food, whose dried-fruit year may be copied for fresh");

// ---------------------------------------------------------------------------------------------------------------------
// B. OPEN. The reader (library prompt): what a 0.8B, 2B, 4B or 35B might write after the header
function B(n, reply, open, severity, why, mode) { push("B" + (n < 10 ? "0" : "") + n, "B", { kind: "openOf", reply: reply, mode: mode || "library" }, { open: open }, severity, why); }
B(1, "OPEN 6.2", "6.2", "high", "the command as taught");
B(2, "OPEN 6", "6", "medium", "a whole class");
B(3, "**OPEN 6.2**", "6.2", "medium", "bold");
B(4, "`OPEN 6.2`", "6.2", "medium", "backticks");
B(5, "OPEN 6.2.", "6.2", "medium", "a full stop");
B(6, "OPEN: 6.2", "6.2", "medium", "a colon");
B(7, "OPEN shelf 6.2", "6.2", "medium", "the word shelf");
B(8, "OPEN SHELF 6.2", "6.2", "medium", "SHELF in capitals");
B(9, "OPEN 6.2 food: cooking, keeping and eating well", "6.2", "medium", "the title copied");
B(10, "OPEN 6.2 (food)", "6.2", "medium", "a note in brackets");
B(11, "OPEN 6.2 - food", "6.2", "low", "a dash and a word");
B(12, "open 6.2", "6.2", "low", "lower case, the whole reply");
B(13, "ANSWER: OPEN 6.2", "6.2", "medium", "after ANSWER:");
B(14, "<think>The question is about food.</think>\nOPEN 6.2", "6.2", "medium", "a 4B\x27s thinking first");
B(15, "<think>\nfood\n</think>\n\n**OPEN 6.2**", "6.2", "medium", "thinking, then bold");
B(16, "OPEN 6,2", "6.2", "low", "a decimal comma");
B(17, "- OPEN 6.2", "6.2", "low", "a bullet");
B(18, "OPEN 6.2\n\nThis shelf holds the lessons on keeping food.", "6.2", "medium", "a short line after");
B(19, "I need the food lessons.\nOPEN 6.2", "6.2", "medium", "a short line before");
B(20, "OPEN 6.2 or 6.1", "6.2", "low", "two shelves: the first");
B(21, "OPEN 7.1\r\n", "7.1", "low", "a Windows line end");
B(22, "OPEN\u00a06.2", "6.2", "low", "a no-break space");
B(23, "\u201cOPEN 6.2\u201d", "6.2", "low", "curly quotes");
B(24, "OPEN CLASS 6", "6", "low", "the word class");
B(25, "Reply: OPEN 6.2", "6.2", "low", "Reply:");
B(26, "OPEN 6.2\nOPEN 6.2\nOPEN 6.2\nOPEN 6.2", "6.2", "medium", "a small model repeating the line");
B(27, "OPEN 6.2 Food: cooking, keeping and eating well.", "6.2", "low", "the title copied with a capital");
B(28, "Lantern has no lesson it is sure of for this question.\nOPEN 6", "6", "low", "the header\x27s line copied, then the command");
B(29, "OPEN 6.2\n\n(Then I will answer.)", "6.2", "low", "a bracketed line after");
B(30, "OPEN SHELF: 6.2", "6.2", "low", "SHELF:");
B(31, "**ANSWER:** OPEN 6.2", "6.2", "low", "bold ANSWER:");
B(32, "OPEN 9.1", "9.1", "medium", "music");
B(33, "OPEN 8.2 pumps, piping and pump stations", "8.2", "low", "title copied");
B(34, "OPEN 6.2. Otherwise answer from what is below.", "6.2", "low",
  "the header\x27s own line, \x27reply with only one line: OPEN 6.2. Otherwise answer from what is below.\x27, copied from OPEN on: read as nothing, the person is shown it as the answer");
B(35, "OPEN 6.2 food, cooking, keeping", "6.2", "low", "the title copied loosely");
B(36, "OPEN 6.2 because the question is about food", "6.2", "low", "the command with its reason on the same line");
// right answers that hold OPEN: never read as the command
B(40, "OPEN 24 HOURS", null, "medium", "a shop sign");
B(41, "OPEN 7 DAYS A WEEK", null, "medium", "a shop sign");
B(42, "CLOSE 1\nOPEN 2", null, "medium", "a valve sequence");
B(43, "Steps:\nOPEN 2", null, "medium", "after a line ending in a colon");
B(44, "OPEN 2\nWAIT 10 S\nCLOSE 2", null, "medium", "a valve sequence in capitals");
B(45, "OPEN 3 is the valve to the tank.", null, "medium", "a sentence");
B(46, "1. Close the outlet valve.\n2. OPEN 3\n3. Start the pump.", null, "medium", "a numbered list of steps");
B(47, "- OPEN 1\n- START PUMP\n- CHECK PRESSURE", null, "medium", "steps in capitals");
B(48, "```\nOPEN 1\nREAD A$\nCLOSE 1\n```", null, "medium", "BASIC file input");
B(49, "```python\nOPEN = 1\nCLOSED = 0\n```", null, "medium", "a constant in code");
B(50, "#define OPEN 1\n#define CLOSED 0", null, "medium", "C constants");
B(51, "OPEN 6 AM TO 6 PM", null, "medium", "opening hours");
B(52, "OPEN 2 TINS OF BEANS\nDRAIN THEM\nHEAT FOR 5 MINUTES", null, "medium", "a recipe in capitals");
B(53, "Open 2 tins of tomatoes and add them to the pot.", null, "medium", "a recipe step");
B(54, "OPEN 2 TURNS", null, "medium", "a valve opened two turns");
B(55, "OPEN 1/4 TURN", null, "medium", "a quarter turn");
B(56, "Do this:\nOPEN 2\nclose 1", null, "medium", "after a colon line");
B(57, "OPEN 2\nOPEN 3\nCLOSE 1", null, "medium", "valves");
B(58, "Turn the tap. OPEN 2 if the flow is weak.", null, "low", "mid-line");
B(59, "Open 2 more windows.", null, "low", "a sentence");
B(60, "OPEN 6.2\nThe passages will tell me how long rice keeps.\nThen I will answer.\nThanks.", null, "low", "three lines after: the reply is more than the command (as designed)");
B(61, "OPEN 1 (the inlet valve) first, then start the pump.", null, "medium",
  "a right answer to which valve to open first: \x27a note in brackets\x27 lets any words follow, and it is read as OPEN 1 (class 1, puzzles)");
B(62, "OPEN 1 (inlet) first.\nThen start the pump and watch the gauge.", null, "medium", "the same, on two lines");
B(63, "- OPEN 1\n- Start the pump\n- Check the pressure", null, "medium", "a list of steps (bullets): the step check looks only for verbs in capitals");
B(64, "OPEN 1\nStart the pump.\nCheck the pressure.", null, "medium", "steps, one a line");
B(65, "OPEN 2\nthen close valve 1", null, "medium", "a valve sequence in lower case after the first line");
B(66, "OPEN 2\nLet the water run for a minute.", null, "medium", "a step and what follows");
B(67, "OPEN 3 (the drain) for 10 seconds.", null, "medium", "a bracket, then more of the sentence");
B(68, "OPEN 4 - the bottom one", null, "low", "a dash and a few words: the answer \x27valve 4\x27");
B(69, "OPEN 2 (two) windows at night to let fresh air in.", null, "low", "a bracket then a sentence");
B(70, "OPEN 2 \u2014 then wait", null, "low", "a dash then an instruction");
B(71, "Open 2.", null, "low", "a terse answer (which of two windows): read as class 2 since it is the whole reply");
B(72, "OPEN 1 and 2.", null, "low", "valves 1 and 2: read as OPEN 1 (\x27a second shelf\x27)");
B(73, "OPEN 2 or 3", null, "low", "valves 2 or 3");
B(74, "OPEN 1.5", null, "low", "one and a half turns, as the whole reply: read as a shelf Lantern has not");
B(75, "open 2", null, "low", "lower case, the whole reply, a valve");
// not in the library prompt: OPEN is never read
B(76, "OPEN 6.2", null, "high", "auto prompt", "auto");
B(77, "OPEN 6.2", null, "high", "short prompt", "short");
B(78, "OPEN 6.2", null, "high", "full prompt", "full");
B(79, "**OPEN 6**", null, "high", "auto prompt, a class", "auto");

// B. what OPEN sends (Lantern.catalog.open), and the path from the header's own offer
function BO(n, shelf, q, expect, severity, why) { push("B" + n, "B", { kind: "open", shelf: shelf, q: q }, expect, severity, why); }
BO(80, "6.1", "How long does insulin keep outside a fridge?", { noLessons: true }, "high", "a medicine: sends The newborn baby and Poisoning as passages to answer from (the first review\x27s insulin case, mended for other lessons, comes back with these)");
BO(81, "6.2", "How long does insulin keep outside a fridge?", { noLessons: true }, "high", "a medicine: sends Keeping food without a fridge and Preserving food");
BO(82, "6.2", "How should I keep my medicines in the heat?", { noLessons: true }, "high", "medicines: sends Cooking food so it is safe and Milk and eggs");
BO(83, "6.2", "How long does ORS keep once mixed?", { noLessons: true }, "medium", "ORS on the food shelf: sends Fermenting");
BO(84, "6.1", "How long does ORS keep once mixed?", { anyOf: ["health_ors"] }, "medium", "ORS on the health shelf: its lesson (right input)");
BO(85, "6.2", "Is it safe to eat wild mushrooms?", { noneOf: ["food_cook", "food_safe"] }, "high", "the first review\x27s mushroom case: Cooking food so it is safe, by way of OPEN 6.2");
BO(86, "6.1", "Is it safe to eat wild mushrooms?", { noLessons: true }, "medium", "sends Fear, grief and a troubled mind and Hygiene");
BO(87, "6.4", "Is meat from a cow that died of sickness safe to eat?", { anyOf: ["hus_illness"] }, "high", "\x27Never eat an animal that died of an unknown illness\x27 (right input)");
BO(88, "6.4", "Can I eat a chicken that died by itself?", { anyOf: ["hus_illness"] }, "high", "the same lesson (right input)");
BO(89, "6.2", "Can I give honey to my 6 month old baby?", { anyOf: ["food_children"] }, "medium", "Feeding babies and children says not before 12 months (right input)");
BO(90, "6.2", "How long do eggs keep without a fridge?", { anyOf: ["health_food", "food_preserve"] }, "medium", "right input");
BO(91, "7.1", "How long will my solar lantern run?", { anyOf: ["eng_battery"] }, "medium", "right input");
BO(92, "3", "Write a letter to my landlord.", { promptHas: "^CLASS 3 " }, "low", "a class lists its shelves");
BO(93, "6.4", "How long does goat milk keep without a fridge?", { noneOf: ["farm_pest"] }, "low", "sends Natural pest control beside Goats & milk");
BO(94, "6.2", "What can I feed my dog?", { noneOf: ["food_children"] }, "low", "a dog on the food shelf: Feeding babies and children");
function BF(n, q, expect, severity, why) { push("B" + n, "B", { kind: "offerOpen", q: q }, expect, severity, why); }
BF(95, "Is it safe to eat wild mushrooms?", { noneOf: ["food_cook", "food_safe"] }, "high", "the header offers OPEN 6.2 itself; a model that copies it is handed Cooking food so it is safe for wild mushrooms");
BF(96, "Which wild berries are safe to eat?", { noneOf: ["food_cook", "food_safe"] }, "high", "the same for wild berries");
BF(97, "Is meat from a cow that died of sickness safe to eat?", { noneOf: ["food_cook", "food_safe"] }, "high",
  "the header offers 6.2, and OPEN 6.2 sends Cooking food so it is safe (\x27Heat kills the germs in food\x27, temperatures for beef); the lesson that says never eat it is on 6.4");
BF(98, "How long can vaccines be kept out of the fridge?", { noneOf: ["health_food", "food_preserve", "food_safe", "food_cook"] }, "high", "the header offers 6.2; OPEN 6.2 sends Keeping food without a fridge for vaccines");
BF(99, "Can I eat a chicken that died by itself?", { anyOf: ["hus_illness"] }, "high", "the header offers 6.4 and OPEN 6.4 sends Illness: signs & action (right input)");
// B. whole turns with a stand-in model
function BT(n, q, replies, expect, severity, why, mode) { push("B" + n, "B", { kind: "turn", q: q, replies: replies, mode: mode || "library" }, expect, severity, why); }
BT(100, "Is meat from a cow that died of sickness safe to eat?", ["OPEN 6.2", "Not in my library."], { commands: ["OPEN 6.2"], noneOf: ["food_cook", "food_safe"] }, "high", "the whole turn: the model copies the header\x27s OPEN 6.2");
BT(101, "Which valve do I open first, the inlet (1) or the outlet (2), when I start the pump?", ["- OPEN 1\n- Start the pump\n- Check the pressure", "Open valve 1 first."],
  { commands: [] }, "medium", "a right answer in steps is read as OPEN 1 and sent back");
BT(102, "How long can cooked rice be left out on the table before it is unsafe to eat?", ["OPEN 6.2", "ANSWER: 2 hours [1]"], { commands: [] }, "high", "auto prompt: OPEN is not a command, the reply is the answer", "auto");
BT(103, "How long can cooked rice be left out on the table before it is unsafe to eat?", ["Cooked rice should not stand out for more than 2 hours, 1 hour when it is hotter than 32 \u00b0C [1].\nQUOTE [1]: Never leave food that spoils out for more than 2 hours - 1 hour when it is hotter than 32 \u00b0C."],
  { commands: [], anyOf: PERISH }, "high", "the bench row in the library prompt: lessons given, answer kept");

// ---------------------------------------------------------------------------------------------------------------------
// C. the shelf the library prompt names (claim) or offers. right: the shelves a librarian would rightly send it to
// ("none": Lantern has nothing; the encyclopedia, 0.2, is then right too)
var CQ = [
  ["How do I open the drawing tile and save my picture?", ["0.1"], "medium", "using a tile"],
  ["Can Lantern read a PDF out loud?", ["0.1"], "medium", "what Lantern can do"],
  ["Who was Nelson Mandela?", ["0.2", "none"], "medium", "encyclopedia"],
  ["When did the Second World War end?", ["0.2", "none"], "medium", "history"],
  ["What is the capital of Peru?", ["0.2", "9.3", "none"], "medium", "a fact about a place"],
  ["Write a Python program that counts the words in a file.", ["0.3"], "medium", "code"],
  ["Write an Arduino sketch that blinks an LED every second.", ["0.3", "7.2"], "medium", "code"],
  ["Three friends, Ana, Ben and Chi, each own one pet: a cat, a dog, a fish. Ana does not own the dog. Chi owns the fish. Who owns the cat?", ["1.1"], "medium", "logic puzzle"],
  ["A frog is at the bottom of a 10 m well. Each day it climbs 3 m and slips back 2 m. On which day does it get out?", ["1.1", "4.1"], "medium", "puzzle"],
  ["Is it a good idea to buy a lottery ticket every week?", ["1.2", "2.1"], "medium", "chance: read as a MAKE plan (\x27every week\x27) and named \x27on shelf 2.2 plans\x27, sure"],
  ["My neighbour says the moon makes people mad. How can I tell if that is true?", ["1.2"], "medium", "evidence"],
  ["I sell 40 loaves a day at 1.50 each. What do I take in a week of 6 days?", ["2.1", "4.1"], "medium", "money sum"],
  ["Our village collected 3,600 shillings for a new well pump that costs 5,000. How much more do we need?", ["2.1", "4.1"], "medium", "money sum"],
  ["Make me a weekly schedule for planting, weeding and market days.", ["2.2", "6.4"], "medium", "schedule"],
  ["How do we run a fair village meeting when two families are arguing?", ["2.3"], "medium", "community"],
  ["What rights does a worker have if the boss does not pay wages?", ["2.3"], "medium", "rights"],
  ["How do I teach my daughter to read?", ["3.1"], "medium", "literacy"],
  ["Help me write a letter to the district office asking for a new school roof.", ["3.1", "3.2", "2.3"], "medium", "writing (the document maker, 3.2, makes a letter)"],
  ["Make a table of my hens and the eggs each laid this week.", ["3.2", "6.4"], "medium", "table"],
  ["Make flashcards for the times tables.", ["3.2", "4.1"], "medium", "flashcards"],
  ["Write the word WATER in Morse code.", ["3.3"], "medium", "codes"],
  ["How many letters are in the word ENCYCLOPEDIA?", ["3.3"], "medium", "letters"],
  ["What is 15% of 240?", ["4.1"], "medium", "percent"],
  ["Solve 3x + 7 = 22.", ["4.1"], "medium", "algebra"],
  ["What is the area of a circle with a radius of 4 m?", ["4.1"], "medium", "shapes"],
  ["How many square metres is a field 45 m by 30 m?", ["4.1", "6.4"], "medium", "area"],
  ["Convert 5 gallons to litres.", ["4.2"], "medium", "units"],
  ["How many feet are in 3 metres?", ["4.2"], "medium", "units"],
  ["What is 30 degrees Celsius in Fahrenheit?", ["4.2"], "medium", "units"],
  ["How much force does it take to accelerate a 1000 kg car at 2 m/s2?", ["5.1"], "medium", "forces"],
  ["How much energy does it take to lift a 20 kg sack 1.5 m onto a shelf?", ["5.1"], "medium", "energy"],
  ["Why does a ball fall back to the ground?", ["5.1"], "medium", "forces in words"],
  ["How long is a year on Mars?", ["5.2"], "medium", "planets"],
  ["Why does the moon change shape through the month?", ["5.2"], "medium", "the sky in words"],
  ["What is the molar mass of carbon dioxide?", ["5.3"], "medium", "chemistry sum"],
  ["Why does iron rust?", ["5.3"], "medium", "chemistry in words"],
  ["Why does it rain more in some months than others?", ["5.4"], "medium", "weather"],
  ["What causes earthquakes?", ["5.4"], "medium", "the earth"],
  ["How do plants make their food?", ["5.5", "6.4"], "medium", "living things"],
  ["How does the heart pump blood?", ["5.5", "6.1"], "medium", "living things"],
  ["Why do waves in the sea come in sets?", ["5.6", "5.4"], "medium", "patterns"],
  ["My child has a fever and is very sleepy. What should I do?", ["6.1"], "medium", "health need"],
  ["How do I clean a cut on my leg?", ["6.1"], "medium", "first aid"],
  ["How do I make oral rehydration solution with sugar and salt?", ["6.1"], "medium", "ORS"],
  ["How long can cooked beans be left out before they spoil?", ["6.2"], "medium", "food kept"],
  ["What should a pregnant woman eat to stay strong?", ["6.2", "6.1"], "medium", "food and health"],
  ["How do I make sauerkraut?", ["6.2"], "medium", "fermenting"],
  ["How much bleach do I add to 20 litres of water to make it safe to drink?", ["6.3"], "medium", "water sum"],
  ["How do I make water from the stream safe for my children to drink?", ["6.3"], "medium", "safe water"],
  ["How do I build a latrine?", ["6.3", "6.1"], "medium", "latrine"],
  ["How many plants fit in a bed 6 m by 1 m at 25 cm spacing?", ["6.4"], "medium", "farming sum"],
  ["How do I stop aphids on my beans without chemicals?", ["6.4"], "medium", "farming"],
  ["How do I keep my goats from getting sick?", ["6.4"], "medium", "animals"],
  ["How much feed do 20 hens eat in a month if each eats 120 g a day?", ["6.4", "4.1"], "medium", "feed sum"],
  ["What current flows through a 220 ohm resistor on 9 V?", ["7.1"], "medium", "electrical sum"],
  ["How many watts does a 12 V pump drawing 5 A use?", ["7.1"], "medium", "electrical sum"],
  ["How long will a 200 Ah 12 V battery run a 100 W fridge?", ["7.1"], "medium", "battery sum"],
  ["Draw a circuit with a battery, a switch and two lamps in parallel.", ["7.2"], "medium", "circuit drawing"],
  ["Draw a ladder diagram for a motor start-stop circuit with a seal-in contact.", ["7.2"], "medium", "control drawing"],
  ["How long should a half-wave dipole be for 7.1 MHz?", ["7.3"], "medium", "antenna sum"],
  ["What is the wavelength of a 145 MHz radio signal?", ["7.3"], "medium", "radio sum"],
  ["Draw a hydraulic circuit with a pump, a relief valve and a double-acting cylinder.", ["8.1"], "medium", "hydraulic drawing"],
  ["Draw a pneumatic circuit where a push button extends a single-acting cylinder.", ["8.1"], "medium", "pneumatic drawing"],
  ["Lay out the piping for a pump that lifts water from a well to a tank on a tower.", ["8.2"], "medium", "piping"],
  ["What gear ratio do I get with a 12-tooth gear driving a 36-tooth gear?", ["8.3"], "medium", "gears"],
  ["How much torque does a 50 N force give on a 0.3 m spanner?", ["8.3", "5.1"], "medium", "torque"],
  ["How do I fix a puncture on my bicycle?", ["8.4"], "medium", "repair"],
  ["Why won\x27t my motorbike engine start?", ["8.4"], "medium", "repair trouble"],
  ["How do I change the oil in a small engine?", ["8.4"], "medium", "engine care"],
  ["Write a simple tune in C major for a recorder.", ["9.1"], "medium", "music"],
  ["What notes are in a G major chord?", ["9.1"], "medium", "music"],
  ["Draw a picture of a house with a tree beside it.", ["9.2"], "medium", "drawing"],
  ["Make a bar chart of rainfall: Jan 120 mm, Feb 90 mm, Mar 60 mm.", ["9.2", "3.2"], "medium", "chart"],
  ["How far is Nairobi from Mombasa?", ["9.3"], "medium", "distance"],
  ["Which way is north if the sun is setting on my left?", ["9.3", "5.2"], "medium", "directions"],
  ["How do I read a map with contour lines?", ["9.3"], "medium", "maps"],
  ["How many kilometres is 26.2 miles?", ["4.2"], "medium", "units"],
  ["A rectangle is 8 cm by 5 cm. What is its perimeter?", ["4.1"], "medium", "shape sum"],
  ["If 3 workers dig a ditch in 6 days, how long do 2 workers take?", ["4.1", "1.1"], "medium", "work sum"],
  ["What is the boiling point of water at the top of Kilimanjaro?", ["5.3", "5.4", "5.1"], "medium", "science fact"],
  ["How do I keep a solar battery healthy?", ["7.1", "8.4"], "medium", "battery care"],
  ["How do I wire a light switch safely?", ["7.2", "7.1"], "medium", "wiring: named \x27most likely on shelf 8.3 machines\x27 from Working safely (lesson-howto@8.3 rests on one question)"],
  ["What size fuse do I need for a 2000 W kettle on 230 V?", ["7.1"], "medium", "fuse sum"],
  ["How do I tell if my chicken has a disease?", ["6.4"], "medium", "animal health"],
  ["How much water does a cow drink in a day?", ["6.4"], "medium", "animals fact"],
  ["What is a good crop to plant after maize?", ["6.4"], "medium", "rotation"],
  ["How can my family save money on food?", ["6.2", "2.1"], "medium", "food on little money"],
  ["How do I make a budget for my small shop?", ["2.1", "2.2", "3.2"], "medium", "budget (the sheet maker, 3.2, makes one)"],
  ["Draw a map of my farm with the house, the well and the fields.", ["9.2", "9.3"], "medium", "a map drawn"],
  ["How deep should a well be?", ["8.2", "6.3", "none"], "medium", "well"],
  ["How do I sharpen a machete?", ["8.4", "8.3"], "medium", "tools"],
  ["How do I know if a ladder is safe to climb?", ["8.3", "8.4", "none"], "medium", "safety"],
  ["How do I calm down when I panic?", ["6.1", "1.2"], "medium", "mind"],
  ["What is the speed of sound in air?", ["5.6", "5.1"], "medium", "science fact"],
  ["How many days until the next full moon?", ["5.2"], "medium", "sky"],
  ["Which planets can I see tonight?", ["5.2"], "medium", "sky"],
  ["How do I make soap from ash and fat?", ["5.3", "none"], "medium", "soap: named \x27most likely on shelf 6.3 safe water\x27 from the latrine lesson"],
  ["Write a short poem about rain.", ["3.1"], "medium", "writing"],
  // more how-to questions, as people ask them, some on things Lantern has no lesson for
  ["How do I make a fire without matches?", ["none", "5.3"], "medium", "fire making: named \x27most likely on shelf 6.2 food\x27 from a Health lesson"],
  ["How do I find water when digging a well?", ["8.2", "5.4", "6.3", "none"], "medium", "finding water (6.3 allowed)"],
  ["How do I patch a hole in a plastic water tank?", ["8.4", "none"], "medium", "repair"],
  ["How do I keep rats out of my grain store?", ["6.4", "6.2"], "medium", "pests in store"],
  ["How do I build a chicken coop?", ["6.4"], "medium", "coop"],
  ["How do I graft a fruit tree?", ["6.4"], "medium", "grafting"],
  ["How do I make yoghurt?", ["6.2"], "medium", "yoghurt"],
  ["How do I dry mangoes?", ["6.2"], "medium", "drying fruit"],
  ["How do I treat a snake bite?", ["6.1"], "medium", "first aid"],
  ["How do I take someone\x27s pulse?", ["6.1"], "medium", "vitals"],
  ["How do I care for a newborn calf?", ["6.4"], "medium", "a calf: named \x27most likely on shelf 6.1 health\x27, and handed The newborn baby (a person\x27s), by HEALTH_CHAT"],
  ["How do I sharpen a kitchen knife?", ["8.4", "none"], "medium", "tools"],
  ["How do I keep my bicycle brakes working?", ["8.4"], "medium", "bicycle"],
  ["How do I clean a spark plug?", ["8.4"], "medium", "engine"],
  ["How do I check the oil in a generator?", ["8.4"], "medium", "engine care"],
  ["How do I lift a heavy log by myself?", ["8.3", "5.1"], "medium", "levers"],
  ["How do I tell how old a tree is?", ["5.5", "none"], "medium", "trees"],
  ["How do I teach my class about the water cycle?", ["5.4", "3.1"], "medium", "weather and teaching"],
  ["How do I write a good story?", ["3.1"], "medium", "writing"],
  ["How do I spell difficult words?", ["3.1", "3.3"], "medium", "spelling"],
  ["How do I run a meeting where everyone gets to speak?", ["2.3"], "medium", "meetings"],
  ["How do I share the water fairly between farms?", ["2.3", "6.3"], "medium", "disputes and water"],
  ["How do I keep records of my sales?", ["2.2", "2.1", "3.2"], "medium", "sales records: named \x27on shelf 6.4 farming\x27 (sure) from the animals\x27 Record-keeping lesson"],
  ["How do I save money every month?", ["2.1", "2.2"], "medium", "money (a savings plan, 2.2, allowed)"],
  ["How do I make a solar panel charge a battery?", ["7.1", "7.2"], "medium", "solar"],
  ["How do I tell if a wire is live?", ["7.1", "7.2"], "medium", "live wire"],
  ["How do I build a radio antenna from wire?", ["7.3"], "medium", "antenna"],
  ["How do I play a C chord on guitar?", ["9.1"], "medium", "music"],
  ["How do I draw a straight line without a ruler?", ["9.2", "8.3", "4.1"], "medium", "drawing"],
  ["How do I find my way using a map and compass?", ["9.3"], "medium", "maps"],
  ["How do I stop my goat from eating the fence?", ["6.4"], "medium", "goats"],
  ["How do I get rid of lice?", ["6.1"], "medium", "health"],
  ["How do I clean my teeth without toothpaste?", ["6.1"], "medium", "teeth"],
  ["How do I know if my dog has rabies?", ["6.4", "6.1"], "medium", "animal and health"],
  ["How do I stop soil washing away on a slope?", ["6.4"], "medium", "soil: named \x27most likely on shelf 6.3 safe water\x27"],
  ["How do I make a lamp from a battery and a bulb?", ["7.2", "7.1"], "medium", "circuit"],
  ["How do I grow tomatoes in a dry place?", ["6.4"], "medium", "growing: named \x27on shelf 6.2 food\x27 (sure) from a lesson on drying"],
  ["How do I cook beans so they are soft?", ["6.2"], "medium", "cooking"],
  ["How do I keep milk from going sour?", ["6.2"], "medium", "milk"],
  ["How do I mend a torn fishing net?", ["none"], "medium", "nets: named \x27most likely on shelf 6.1 health\x27"],
  // a lantern that is a lamp, and questions with Lantern\x27s nouns in them
  ["My solar lantern does not charge any more. What could be wrong?", ["7.1", "8.4"], "medium", "a solar lamp: named \x27most likely on shelf 0.1 Lantern\u2019s own tiles\x27, \x27Lantern has opened it below\x27, and nothing is opened"],
  ["Will my lantern work with kerosene instead of paraffin?", ["none", "8.4"], "medium", "a paraffin lamp: named 0.1"],
  ["Does the lantern have a spare wick?", ["none"], "medium", "a lamp: named 0.1"],
  ["Can the lantern work in the rain?", ["none", "7.1"], "medium", "a lamp: named 0.1"],
  ["Is there a tool to cut glass?", ["none", "8.4"], "low", "a glass cutter: \x27about Lantern itself\x27 (SUITE_CHAT\x27s about(), old; the header now says it flatly)"],
  ["Are there any tools for fixing a bike puncture?", ["8.4", "0.1"], "low", "may be about Lantern"],
  ["Is there a lesson on keeping bees?", ["0.1"], "low", "about Lantern"],
  ["How do I light a paraffin lantern safely?", ["none", "8.4"], "medium", "a lamp: no shelf named today (right)"],
  ["How long does food poisoning last?", ["6.1"], "high", "an illness: \x27on shelf 6.2 food\x27, sure, with keeping-food lessons (keeps)"],
  ["How long can a baby last without milk?", ["6.1", "6.2"], "medium", "a baby not feeding"]
];
CQ.forEach(function (r, i) { push("C" + (i < 9 ? "00" : i < 99 ? "0" : "") + (i + 1), "C", { kind: "header", q: r[0], check: "claim" }, { right: r[1] }, r[2], r[3]); });
// offers: "may be on shelf X ... OPEN X" -- sensible or not
var CO = [
  ["How do plants make their food?", ["5.5", "6.4"], "offered the food shelf"],
  ["How much water does a cow drink in a day?", ["6.4"], "offered the food shelf"],
  ["How deep should a well be?", ["8.2", "6.3", "none"], "offered health"],
  ["What is the speed of sound in air?", ["5.6", "5.1"], "offered music"],
  ["Why does the moon change shape through the month?", ["5.2"], "right offer"],
  ["What is a good crop to plant after maize?", ["6.4"], "right offer"],
  ["Is it safe to eat wild mushrooms?", ["none", "6.1"], "offered the food shelf for wild food (see B95)"],
  ["Is meat from a cow that died of sickness safe to eat?", ["6.4", "6.1"], "offered the food shelf; the lesson that answers it is on 6.4 (see B97)"],
  ["How long can vaccines be kept out of the fridge?", ["6.1", "none"], "offered the food shelf (see B98)"],
  ["How long does mutton keep in cold weather?", ["6.2"], "offered the earth and the weather"],
  ["How long should meat be kept boiling to kill germs?", ["6.2"], "offered safe water"],
  ["How long does it take for milk to go bad?", ["6.2"], "offered health"],
  ["How long do fruit trees last?", ["6.4", "none"], "offered the food shelf"],
  ["How long does bread stay good for?", ["6.2"], "offered living things"],
  ["How long does a meal of beans keep you full?", ["6.2"], "offered health"],
  ["How long does chicken soup last?", ["6.2"], "offered farming and animals"]
];
CO.forEach(function (r, i) { push("C" + (201 + i), "C", { kind: "header", q: r[0], check: "offer" }, { right: r[1] }, /\(see B/.test(r[2]) ? "medium" : "low", r[2]); });

// ---------------------------------------------------------------------------------------------------------------------
// D. the 60 labelled questions (questions.json): each claim judged, then the bands measured on them
Q.forEach(function (x, i) {
  var sev = /fire in a cooking pot/.test(x.q) ? "high" : "medium";
  push("D" + (i < 9 ? "0" : "") + (i + 1), "D", { kind: "header", q: x.q, check: "claim" }, { right: x.shelf }, sev, x.why);
});
push("D-sure-all", "D", { kind: "band", band: "sure", ev: "all", min: 0.9 }, { min: 0.9 }, "medium", "of the \x27on shelf\x27 claims on the 60, at least 9 in 10 right");
push("D-likely-all", "D", { kind: "band", band: "likely", ev: "all", min: 0.8 }, { min: 0.8 }, "medium", "of the \x27most likely\x27 claims on the 60, at least 8 in 10 right");
push("D-sure-lessons", "D", { kind: "band", band: "sure", ev: "lessons", min: 0.9 }, { min: 0.9 }, "high", "the same, for claims from lessons (lesson-howto, lesson-other, health)");
push("D-likely-lessons", "D", { kind: "band", band: "likely", ev: "lessons", min: 0.8 }, { min: 0.8 }, "high", "the same, for claims from lessons");
push("D-sure-tools", "D", { kind: "band", band: "sure", ev: "tools", min: 0.9 }, { min: 0.9 }, "medium", "claims from recipe cards, MAKE, puzzles, letters");
push("D-likely-tools", "D", { kind: "band", band: "likely", ev: "tools", min: 0.8 }, { min: 0.8 }, "medium", "the same, most likely");

module.exports = cases;
