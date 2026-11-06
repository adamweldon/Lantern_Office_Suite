// tools_fit.js -- what a question is given to answer with: the MAKE tools, the
// recipe cards, the functions of the short prompt, the lesson a LESSON: line
// reads (1.24.6). A small model writes what is in front of it, so what does
// not fit the question is worse than nothing. Seen in what Lantern sent the
// models on the bench:
//  - AI_ACT_SENSE: "an appliance drawing 4 A" was offered MAKE DRAWING,
//    "table salt" and "tablets" MAKE SHEET, "ladder safety" MAKE CODE,
//    "Should I switch?" MAKE SCHEMATIC, "an Arduino sketch" a circuit drawing;
//  - ASSIST_CORE's match: a bed "10 m long" got the orbit card, a baby
//    breathing "56 times a minute ... too fast" the fast-moving clock, hens
//    the feed sum, one resistor the card for resistors in parallel;
//  - AI_PROMPT's pick: "each" brought CAESAR, "degrees" four functions that
//    answer in degrees, "hours" the battery functions;
//  - SUITE_PASSAGES: "LESSON: ladder safety" read out Heat and cold safety,
//    "LESSON: French Revolution" the Flashcards guide;
//  - AI_UNITS: a change of unit the question calls for is said under its
//    numbers and checked in the sum (the 2B: =800*20*30 for kg, and
//    =2*3*30/1000 for a heater that was in kW already). The 35B's 45 right
//    answers on 1.24.4 (tests/fixtures/bench_run_1244_35b_sums.json) are
//    replayed: none may be questioned;
//  - AI_NO_FORMULA: a decline, or a result typed with no sum, where a recipe
//    card fits goes back once with the card's line (the 2B declined 100 F in
//    Celsius, 5 kg in pounds, a bed of plants, a bearing; typed 60 for eggs).
// None of the questions here is the bench's own wording.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function load(strip) {
  var js = JS;
  (strip || []).forEach(function (name) {
    var a = js.indexOf("// MODULE: " + name + " - START"), e = "// MODULE: " + name + " - END", b = js.indexOf(e, a);
    if (a < 0 || b < 0) throw new Error("no module " + name);
    js = js.slice(0, a) + js.slice(b + e.length);
  });
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window;
  w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = function () { return null; };
  w.fetch = function () { return Promise.reject(new Error("no network")); };
  w.eval(js);
  var e = w.document.createEvent("Event"); e.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(e);
  return { L: w.Lantern, errs: errs };
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1400)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var act = L.aiAct, A = L.assist, P = L.aiPrompt, S = L.suite;
  ok("boot clean", o.errs.length === 0, o.errs);
  function kinds(q) { return act.relevant(q).map(function (a) { return a.kind; }).join(","); }
  function cards(q) { return A.match(q).map(function (c) { return c.id; }).join(","); }
  function fns(q) { return P.pick(q, A.match(q)).map(function (e) { return e.n; }).join(","); }

  // --- the MAKE tools ----------------------------------------------------------------------------------------
  var NOTHING = ["My fridge draws 150 watts. How many kWh does it use in a day?", "How much current does a 60 W bulb draw at 12 V?", "The pump is drawing too much current. What should I check?",
    "What is the current draw of a 5 W LED at 12 V?", "How do I draw water from a well safely?", "How many tablespoons of salt for 5 lb of cabbage?", "How many tablets are in a strip?",
    "There are four cups on the table. Which is in the middle?", "How deep is the water table here?", "How many sheets of plywood cover a 4 m by 5 m floor?", "How do I cut sheet metal straight?",
    "Should I switch to a 24 V system for my solar panels?", "How do I switch off the pump when the tank is full?", "If I switch doors, what is my chance of winning?",
    "What angle should a ladder lean at?", "How do I climb a ladder safely with tools?", "Is it safe to stand on the top of a step ladder?"];
  var offered = NOTHING.filter(function (q) { return kinds(q); }).map(function (q) { return [q, kinds(q)]; });
  ok("a sum or a how-to whose words have another sense is offered no MAKE tool (" + NOTHING.length + " questions: draws 5 A, table salt, tablets, on the table, a sheet of plywood, should I switch, a ladder to climb)",
    offered.length === 0, offered);
  var KEEP = [["Draw a table lamp.", "DRAWING"], ["Make a table of the tablets I take each day.", "SHEET"], ["Make a multiplication table up to 12.", "SHEET"],
    ["Write ladder logic for a start/stop circuit.", "CODE"], ["Draw a ladder diagram for a motor starter.", "CODE"], ["Draw a circuit with a switch and a lamp.", "SCHEMATIC"],
    ["Draw a circuit where a switch turns the pump on.", "SCHEMATIC"], ["Draw a ladder leaning against a house.", "DRAWING"], ["Draw a picture of a kitchen table with a bowl on it.", "DRAWING"],
    ["Draw a pump drawing water from a well.", "DRAWING"], ["Make a sheet of my monthly budget.", "SHEET"], ["Make a spreadsheet of sheet metal sizes and prices.", "SHEET"],
    ["Draw the wiring for a two-way switch.", "SCHEMATIC"], ["Draw a diagram of how a battery draws current through a lamp.", "SCHEMATIC"], ["Make slides for a talk on ladder safety.", "SLIDES"],
    ["Write a program that switches an LED on and off.", "CODE"], ["Create a table comparing table salt and sea salt.", "SHEET"], ["Draw the sheet music for Twinkle Twinkle", "MUSIC"]];
  var lost = KEEP.filter(function (x) { return kinds(x[0]).split(",").indexOf(x[1]) < 0; }).map(function (x) { return [x[0], kinds(x[0])]; });
  ok("a request still gets its tool (" + KEEP.length + " requests that have those same words)", lost.length === 0, lost);
  ok("a talk on ladder safety is slides and not a program; a kitchen table in a picture is not a sheet", kinds("Make slides for a talk on ladder safety.") === "SLIDES" &&
    kinds("Draw a picture of a kitchen table with a bowl on it.") === "DRAWING", [kinds("Make slides for a talk on ladder safety."), kinds("Draw a picture of a kitchen table with a bowl on it.")]);
  ok("a sketch for a board is its program: one tool, not a circuit drawing as well", kinds("Write an Arduino sketch that reads a button.") === "CODE" &&
    kinds("Write a sketch for the ESP32 that blinks an LED.") === "CODE" && /SCHEMATIC/.test(kinds("Sketch a circuit for an Arduino that switches a relay.")),
    [kinds("Write an Arduino sketch that reads a button."), kinds("Write a sketch for the ESP32 that blinks an LED.")]);
  ok("the question itself is not changed: only what the tools are tried on", L.aiActSensed("A 12 V pump draws 5 A.") !== "A 12 V pump draws 5 A." &&
    act.prompt("Make slides for a talk on ladder safety.").indexOf("MAKE SLIDES") >= 0 && act.prompt("How do I climb a ladder safely with tools?") === "");
  // Chat: a sum with "draws" in it keeps its recipe hints (they go only to a question that asks for nothing to be made)
  var seen = [];
  L.aiRoute = function (msgs) { seen.push(msgs); return Promise.resolve("=WATTS(12,2.5)\nANSWER: It uses {result} watts."); };
  await L.CHAT.turn([], "How many watts does a 12 V lamp drawing 2.5 A use?", {}, {});
  var sentQ = seen.length ? (typeof seen[0][seen[0].length - 1].content === "string" ? seen[0][seen[0].length - 1].content : "") : "", sys = seen.length ? String(seen[0][0].content) : "";
  ok("Chat: “a lamp drawing 2.5 A” gets the watts recipe as a hint and no MAKE DRAWING guide", /\[Recipe hints\]\n[^\n]*=WATTS\(\{volts\},\{amps\}\)/.test(sentQ) && !/MAKE DRAWING/.test(sys), [sentQ, /MAKE DRAWING/.test(sys)]);

  // --- the recipe cards -----------------------------------------------------------------------------------
  var FIT = [["What is the voltage drop across a 1 k resistor at 3 mA?", "ohm-volts"], ["How much current does a 12 V supply push through 48 ohms?", "ohm-amps"],
    ["What resistor do I need to drop 5 V at 20 mA?", "ohm-ohms"], ["How many watts does a 12 V lamp drawing 2.5 A use?", "watts-va"],
    ["Two resistors of 100 ohm and 220 ohm are in series. What is the total resistance?", "series-r"], ["What is the total resistance of 10 ohm, 20 ohm and 30 ohm resistors in parallel?", "parallel-r"],
    ["A bed is 6 m long and 1 m wide. How many cabbages fit at 40 cm spacing?", "plants-bed"], ["My 30 hens lay 4 eggs each a week. How many eggs is that in a week?", "eggs-week"],
    ["What does a 12 kg gas bottle weigh, in newtons?", "weight-n"], ["How much does a 5 kg mass weigh on Mars, in newtons?", "planet-weight"],
    ["What is the wavelength of a 7.1 MHz signal?", "wavelength"], ["How long would a 200 Ah battery keep a 100 W fridge going?", "battery-runtime"],
    ["How long does it take to fill a 200 litre drum from a tap that gives 8 litres a minute?", "fill-time"], ["How many 25 kg sacks do I need for 1.5 tonnes of cement?", "count-bags"],
    ["How many 10 litre buckets fill a 200 litre drum?", "count-bags"], ["A 25 kg sack of flour costs 900 pesos. What do 3 sacks cost?", "total-cost"],
    ["A recipe for 4 people uses 300 g of flour. How much for 10 people?", "scale-recipe"], ["My truck does 400 km on 50 litres of diesel. How much diesel for 1,000 km?", "trip-fuel"],
    ["Petrol is 1.80 a litre. What do 40 litres cost?", "total-cost"], ["How much feed do I need for 12 pigs for 14 days at 2500 g a day each?", "feed-total"],
    ["How far is it from Lagos to Accra?", "place-distance"], ["What is 72 degrees Fahrenheit in Celsius?", "unit-convert"], ["How many pounds is 12 kg?", "unit-convert"],
    ["How many km is 5 miles?", "unit-convert"], ["How long does a satellite at 800 km take to go round the Earth?", "orbit-period"], ["How many hectares is a field 250 m by 120 m?", "field-area"],
    ["How many drops of bleach for 10 litres of water?", "water-bleach"]];
  var wrong = FIT.filter(function (x) { return cards(x[0]) !== x[1]; }).map(function (x) { return [x[0], cards(x[0])]; });
  ok("each of " + FIT.length + " everyday sums is given its one card, and no other", wrong.length === 0, wrong);
  var NONE = ["My baby is 8 months old, has a cough and is breathing 56 times a minute. Is that too fast?", "A bed of plants is 10 m long. How long does it take to weed at 2 m a minute?",
    "My clock loses 2 minutes a day. How many minutes is that in 3 weeks?", "How much energy does a 2 kW heater use in 3 hours?", "What is the area of a circle with a radius of 2 m?",
    "How many cups are in 2 litres?", "A pump runs 10 minutes every hour. How many minutes is that in a day?", "How far does a car go in 3 hours at 80 km/h?", "How much is 15% of 240?",
    "A rope is 30 m long. How many 2.5 m pieces can I cut?", "A bus travels 300 km at 75 km/h. How many hours is the trip?", "A family of 4 uses 30 litres of water each a day. How long does a 3000 litre tank last?"];
  var given = NONE.filter(function (q) { return cards(q); }).map(function (q) { return [q, cards(q)]; });
  ok("a sum no card is for is given none (" + NONE.length + " sums: plain arithmetic is right for them)", given.length === 0, given);
  ok("two cards only where both fit: sugar and salt for ORS, the escape velocity from the Earth (by name, or from a height); Earth\u2019s own card is not given for the Moon", cards("How much sugar and salt for 2 litres of ORS?") === "ors-sugar,ors-salt" &&
    cards("What is the escape velocity from the surface of the Earth?") === "planet-escape,escape-v" && cards("What is the escape velocity of the Moon?") === "planet-escape" &&
    cards("How long does a satellite take to orbit Mars at 400 km altitude?") === "planet-orbit" && cards("What is the period of a pendulum 1 m long?") === "",
    [cards("How much sugar and salt for 2 litres of ORS?"), cards("What is the escape velocity from the surface of the Earth?"), cards("What is the escape velocity of the Moon?"), cards("How long does a satellite take to orbit Mars at 400 km altitude?")]);
  ok("what is ASKED for chooses among the Ohm’s law cards, whatever else the question names", cards("A 9 V battery is across a 450 ohm resistor. What current flows?") === "ohm-amps" &&
    cards("Find the resistance that passes 2 amps at 24 volts.") === "ohm-ohms" && cards("A 100 ohm resistor carries a current of 0.5 amps. What is the voltage across it?") === "ohm-volts",
    [cards("A 9 V battery is across a 450 ohm resistor. What current flows?"), cards("Find the resistance that passes 2 amps at 24 volts."), cards("A 100 ohm resistor carries a current of 0.5 amps. What is the voltage across it?")]);
  ok("a weight on Earth and a weight on Mars are different cards; so are a tank filled per minute and a tank that lasts days",
    cards("What does a 12 kg gas bottle weigh, in newtons?") === "weight-n" && cards("How much does a 5 kg mass weigh on Mars, in newtons?") === "planet-weight" &&
    cards("A family of 4 uses 30 litres of water each a day. How long does a 3000 litre tank last?") === "");
  ok("a keyword counts as a whole word, once: “times” is not time, “bag” and “bags” are one word", cards("How many times does 7 go into 91?") === "" &&
    cards("How many 50 kg bags of cement make 3 tonnes?") === "count-bags");
  // every card's formula still runs with numbers in its blanks (the nine new ones included)
  var broken = [];
  (L.assistCards || []).forEach(function (c) {
    var vals = {};
    c.slots.forEach(function (sl) { vals[sl.k] = sl.text ? (/formula/.test(sl.k) ? "H2O" : /body/.test(sl.k) ? "Mars" : /from|to/.test(sl.k) && /DISTKM|BEARING/.test(c.compose) ? (sl.k === "from" ? "Nairobi" : "Mombasa") : sl.k === "from" ? "mile" : "km") :
      /^(r\d?|a)_km$/.test(sl.k) ? 8000 : 7; });   // a radius from Earth's centre is outside the Earth
    var run = null; try { run = A.run(A.fill(c, vals)); } catch (e) { run = null; }
    if (!run || !run.steps.length || !run.steps.every(function (x) { return x.ok; })) broken.push([c.id, run && run.steps.map(function (x) { return x.err; })]);
  });
  ok("every card (" + (L.assistCards || []).length + ") still works out with its blanks filled", broken.length === 0 && (L.assistCards || []).length >= 41, broken);
  ok("the new cards’ sums: V = I R, I = V / R, R = V / I, P = V I, series, plants in a bed, eggs, newtons, a wavelength", A.run("=VOLTS(0.003,1000)").value === 3 && A.run("=AMPS(12,48)").value === 0.25 &&
    A.run("=OHMS(5,0.02)").value === 250 && A.run("=WATTS(12,2.5)").value === 30 && A.run("=RSERIES(100,220)").value === 320 && A.run("=PLANTS(6,1,40)").value > 0 && A.run("=EGGS(30,4)").value === 120 &&
    Math.abs(A.run("=WEIGHT(12)").value - 117.6798) < 1e-3 && Math.abs(A.run("=WAVELEN(7.1)").value - 42.2) < 0.1,
    [A.run("=VOLTS(0.003,1000)").value, A.run("=PLANTS(6,1,40)").value, A.run("=WEIGHT(12)").value, A.run("=WAVELEN(7.1)").value]);

  // --- the functions of the short prompt ----------------------------------------------------------------------
  ok("the short prompt names the function the sum needs, and CONVERT", fns("What is the voltage drop across a 1 k resistor at 3 mA?") === "CONVERT,VOLTS" && fns("How many watts does a 12 V lamp drawing 2.5 A use?") === "CONVERT,WATTS" &&
    fns("My 30 hens lay 4 eggs each a week. How many eggs is that in a week?") === "CONVERT,EGGS" && fns("What does a 12 kg gas bottle weigh, in newtons?") === "CONVERT,WEIGHT",
    [fns("What is the voltage drop across a 1 k resistor at 3 mA?"), fns("My 30 hens lay 4 eggs each a week. How many eggs is that in a week?")]);
  ok("...and nothing for a word of the question’s shape: each (CAESAR), degrees (four functions), hours (the battery’s), use (PLANET), a number (FEEDKG’s 800)",
    fns("What is 72 degrees Fahrenheit in Celsius?") === "CONVERT" && fns("A bus travels 300 km at 75 km/h. How many hours is the trip?") === "CONVERT" &&
    fns("A 2 kW heater runs 3 hours a day for 30 days. How many kWh does it use?") === "CONVERT" && !/CAESAR/.test(fns("I have 9 goats and each eats 800 g a day. How much is that?")) &&
    !/FEEDKG/.test(fns("How long does a satellite at 800 km take to go round the Earth?")),
    [fns("What is 72 degrees Fahrenheit in Celsius?"), fns("A 2 kW heater runs 3 hours a day for 30 days. How many kWh does it use?"), fns("How long does a satellite at 800 km take to go round the Earth?")]);
  ok("a function is still found by its name: watts, wavelength, orbit, escape", /WATTS/.test(fns("How many watts is 3 amps at 230 volts?")) && /WAVELEN/.test(fns("What wavelength is 145 MHz?")) &&
    /ORBITT/.test(fns("How long is one orbit at 500 km?")) && /ESCV/.test(fns("What is the escape speed at 200 km altitude?")), [fns("How long is one orbit at 500 km?"), fns("What is the escape speed at 200 km altitude?")]);
  ok("at most 8 functions, however long the question", P.pick("orbit escape hohmann transfer kinetic energy battery watts volts amps ohms moles grams wavelength morse nato caesar distance bearing planet weight", []).length <= 8);

  // --- the lesson a LESSON: line reads ---------------------------------------------------------------------------
  function read(q, arg) { return S.passages(q, arg, { detail: true, max: 3 }).map(function (s) { return s.key; }); }
  ok("LESSON: with words Lantern has no lesson on reads out nothing (ladder safety, the French Revolution, wiring a plug, an orchestra)",
    read("Make slides on ladder safety", "ladder safety").length === 0 && read("Tell me about the French Revolution.", "French Revolution").length === 0 &&
    read("How do I wire a plug?", "wiring a plug").length === 0 && read("Arrange a tune for orchestra.", "Ode to Joy Orchestra").length === 0,
    [read("Make slides on ladder safety", "ladder safety"), read("Tell me about the French Revolution.", "French Revolution"), read("How do I wire a plug?", "wiring a plug")]);
  ok("...and the lesson that is about it, where there is one: by the AI’s words, or by the question’s when its words miss",
    read("How do I make sauerkraut?", "sauerkraut")[0] === "food_ferment" && read("My hens have stopped laying. What should I check?", "hen health")[0] === "hus_chickens" &&
    read("How do I fix a flat tyre?", "bicycle puncture repair")[0] === "rep_flat" && read("What should I do for a burn?", "burns first aid").indexOf("health_burns") >= 0 &&
    read("How do I purify water?", "water purification")[0] === "health_water" && read("How do I raise goats?", "Goats & milk")[0] === "hus_goats",
    [read("How do I make sauerkraut?", "sauerkraut"), read("My hens have stopped laying. What should I check?", "hen health"), read("How do I fix a flat tyre?", "bicycle puncture repair"),
     read("What should I do for a burn?", "burns first aid"), read("How do I purify water?", "water purification"), read("How do I raise goats?", "Goats & milk")]);
  var LC = (L.chatCommands || []).filter(function (c) { return c.id === "lessons"; })[0];
  var r1 = LC.run("French Revolution", "Tell me about the French Revolution."), r2 = LC.run("Ode to Joy Orchestra", "Arrange the main theme of Ode to Joy for orchestra, so I can hear it.");
  ok("the LESSON command says so plainly when there is nothing", !r1.sources && /^Lantern’s own lessons have nothing on “French Revolution”\. Reply MODULES/.test(r1.prompt), r1.prompt);
  ok("...and where the question asks for a thing Lantern makes, it asks for the block, with its first line", !r2.sources &&
    /have nothing on “Ode to Joy Orchestra”, and none is needed: what was asked is made from a block\. Reply with ONLY the block, as the instructions above describe it\. Its first line is:\nMAKE MUSIC: <a short title>\nthen its lines, then END\./.test(r2.prompt) &&
    /Lantern asked for the block instead/.test(r2.note), [r2.prompt, r2.note]);
  // a common word is not a rare one, however many cards and functions the catalog has
  ok("“water”, “out”, “use” and “same” are in too many lessons to name a topic; “goat”, “burn” and “salt” do",
    ["water", "out", "use", "same", "keep"].every(function (w) { return S.rarity(S.stem(w)) < 2.2; }) && ["goat", "burn", "salt", "food", "seed"].every(function (w) { return S.rarity(S.stem(w)) >= 2.5; }),
    ["water", "out", "use", "same", "goat", "burn", "salt", "food"].map(function (w) { return w + ":" + S.rarity(S.stem(w)).toFixed(2); }));

  // --- a change of unit: said before, checked after ---------------------------------------------------------------
  var UN = L.aiUnitNote, UC = L.aiUnits.check;
  var NOTES = [["How much feed do 20 goats need for 30 days at 800 g each per day, in kg?", "Units: the question gives g and asks for kg (1000 g = 1 kg): divide by 1000."],
    ["A 2 kW heater runs 3 hours a day for 30 days. How many kWh does it use?", "Units: the question gives kW and asks for kWh: kW x hours is kWh already, so no change of unit is needed (no /1000)."],
    ["A 60 W lamp burns 5 hours a night. How many kWh is that in 30 nights?", "Units: the question gives W and asks for kWh (W x hours is Wh): divide by 1000."],
    ["A drum holds 200 litres and the tap gives 8 litres per minute. How many hours to fill it?", "Units: the question gives a rate per minute and asks for hours (60 minutes = 1 hour): divide by 60."],
    ["A pump delivers 500 litres per hour. How many minutes to fill a 100 litre drum?", "Units: the question gives a rate per hour and asks for minutes (60 minutes = 1 hour): multiply by 60."],
    ["A road is 2.5 km long. How many metres is that?", "Units: the question gives km and asks for m (1000 m = 1 km): multiply by 1000."],
    ["How many litres is 750 ml?", "Units: the question gives ml and asks for litres (1000 ml = 1 litre): divide by 1000."],
    ["A wall is 240 cm long. How long is it in m?", "Units: the question gives cm and asks for m (100 cm = 1 m): divide by 100."],
    ["A 1.5 kW pump runs 2 hours. How many Wh is that?", "Units: the question gives kW and asks for Wh (kW x hours is kWh): multiply by 1000."]];
  var badNote = NOTES.filter(function (x) { return UN(x[0]) !== x[1]; }).map(function (x) { return [x[0], UN(x[0])]; });
  ok("the change of unit a question calls for is read from it (" + NOTES.length + " sums: g for kg, W or kW for kWh, a rate per minute for hours, km for m, ml for litres)", badNote.length === 0, badNote);
  var QUIET = ["A bus travels 180 km at 60 km/h. How many hours does the trip take?", "How many 50 kg bags are in 2 tonnes of maize?", "A 5 kg bag of rice costs 1200 shillings. How much do 18 kg cost?",
    "A field is 120 m by 80 m. What is its area in hectares?", "A room is 4 m by 5 m and 2.5 m high. How many cubic metres of air does it hold?", "A car goes 150 km on 10 litres of fuel. How many litres does a 420 km trip need?",
    "How many hours does it take to drive 26 miles at 40 km/h?", "How many grams of salt for 2 kg of cabbage at 25 g per kg?", "A 1500 W kettle runs for 4 minutes. How many kWh is that?",
    "My clock loses 2 minutes a day. How many minutes is that in 3 weeks?", "A pump runs 10 minutes every hour. How many minutes is that in a day?", "I have 3 sacks of 25 kg and one of 500 g. How much is that in kg?",
    "A 2 kW heater and a 500 W fan run 3 hours. How many kWh?", "A 12 V pump draws 5 A for 3 hours a day. How many amp-hours does it use in a week?", "How long does a satellite take to orbit Earth at 420 km altitude, in minutes?"];
  var loud = QUIET.filter(function (q) { return UN(q); }).map(function (q) { return [q, UN(q)]; });
  ok("where Lantern cannot tell, it says nothing (" + QUIET.length + " sums: the unit asked for is given, two sizes of it are given, minutes and hours are mixed, no unit is asked for)", loud.length === 0, loud);
  var pr1 = A.buildPrompt(NOTES[1][0], A.match(NOTES[1][0])), pr2 = A.buildPrompt(NOTES[0][0], A.match(NOTES[0][0]));
  ok("the instructions end with the line, under the question’s numbers, when no recipe card was given", pr1.slice(-NOTES[1][1].length) === NOTES[1][1] && /The question gives these numbers: 2 kW; 3 hours; 30 days\.\nUnits: /.test(pr1), pr1.slice(-260));
  ok("...and not when a card was: FEEDKG takes the grams and gives kg", cards(NOTES[0][0]) === "feed-total" && !/\nUnits: /.test(pr2), pr2.slice(-200));
  ok("the check: the question’s number as given and no change of unit is questioned, with the line to write", UC(NOTES[0][0], "=800*20*30") === "the question gives g and asks for kg (1000 g = 1 kg), but the sum has no change of unit: divide by 1000 (=800*20*30/1000)" &&
    UC(NOTES[3][0], "=200/8") === "the question gives a rate per minute and asks for hours (60 minutes = 1 hour), but the sum has no change of unit: divide by 60 (=200/8/60)" &&
    UC(NOTES[5][0], "=2.5") === "the question gives km and asks for m (1000 m = 1 km), but the sum has no change of unit: multiply by 1000 (=2.5*1000)", [UC(NOTES[0][0], "=800*20*30"), UC(NOTES[3][0], "=200/8")]);
  ok("...a /1000 the question does not call for is questioned too, with the line without it", UC(NOTES[1][0], "=2*3*30/1000") === "the question gives kW and asks for kWh: kW x hours is kWh already, but the sum uses 1000: write =2*3*30", UC(NOTES[1][0], "=2*3*30/1000"));
  ok("...and a sum that has the change, did it in its head, or uses a function of Lantern’s is left alone", UC(NOTES[0][0], "=800*20*30/1000") === null && UC(NOTES[0][0], "=0.8*20*30") === null &&
    UC(NOTES[0][0], "=FEEDKG(20,30,800)") === null && UC(NOTES[1][0], "=2*3*30") === null && UC(NOTES[3][0], "=200/8\n=ANS/60") === null && UC(NOTES[2][0], "=60*5*30/1000") === null &&
    UC("A bus travels 180 km at 60 km/h. How many hours does the trip take?", "=180/60") === null);
  // the 2B's two rows on 1.24.4, replayed through Assist: sent back once with the line, and the line passes
  var R2 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_2b.json"), "utf8")), B = L.aiBench, Q = L.aiBenchQuestions;
  function item(id) { return Q.filter(function (x) { return x.id === id; })[0]; }
  function row(id) { return R2.rows.filter(function (r) { return r.id === id; })[0]; }
  function seq(list, seen) { var i = 0; return function (msgs) { if (seen) seen.push(msgs); return Promise.resolve(list[Math.min(i++, list.length - 1)]); }; }
  var fd = row("feed"), ht = row("heater-kwh"), seenU = [];
  ok("the fixture: the 2B wrote =800*20*30 for kg, and =2*3*30/1000 for a 2 kW heater", /^=800\*20\*30$/m.test(fd.reply) && /^=2\*3\*30\/1000$/m.test(ht.reply) && fd.why === "wrong value" && ht.why === "wrong value");
  var ou = await A.solve(fd.q, { call: seq([fd.reply, "=800*20*30/1000\nANSWER: The goats need {result} kg of feed."], seenU) }), gu = B.grade(item("feed"), ou.text, ou);
  var backU = seenU[1] ? String(seenU[1][seenU[1].length - 1].content) : "";
  ok("the feed sum goes back once with =800*20*30/1000, and that passes", ou.rounds === 2 && gu.pass && /but the sum has no change of unit: divide by 1000 \(=800\*20\*30\/1000\)/.test(backU), [ou.rounds, gu.why, backU.slice(0, 300)]);
  seenU = [];
  ou = await A.solve(ht.q, { call: seq([ht.reply, "=2*3*30\nANSWER: The heater uses {result} kWh."], seenU) }); gu = B.grade(item("heater-kwh"), ou.text, ou);
  backU = seenU[1] ? String(seenU[1][seenU[1].length - 1].content) : "";
  ok("the heater’s /1000 goes back once with =2*3*30, and that passes", ou.rounds === 2 && gu.pass && /kW x hours is kWh already, but the sum uses 1000: write =2\*3\*30/.test(backU), [ou.rounds, gu.why, backU.slice(0, 300)]);
  // the 35B's forty-five right answers on 1.24.4: nothing here questions one of them
  var S35 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_35b_sums.json"), "utf8")), touched = [];
  for (var si = 0; si < S35.rows.length; si++) {
    var sr = S35.rows[si], sit = item(sr.id), so = await A.solve(sit.q, { call: seq([sr.reply]) }), sg = B.grade(sit, so.text, so);
    if (!sg.pass || so.rounds !== 1 || UC(sit.q, sr.reply)) touched.push([sr.id, sg.why, so.rounds, UC(sit.q, sr.reply)]);
  }
  ok("the 35B’s " + S35.rows.length + " right answers to the bench’s sums (its run of 1.24.4) still pass in one round, none of them questioned", S35.rows.length === 45 && touched.length === 0, touched);

  // --- no sum where one was asked for ---------------------------------------------------------------------------
  var NFm = L.aiNoFormula;
  function nfm(q, reply) { return NFm(q, reply, A.parseReply(reply), A.match(q)); }
  var c1 = nfm("What is 72 degrees Fahrenheit in Celsius?", "ANSWER: Not in my library."), c2 = nfm("My 30 hens lay 4 eggs each a week. How many eggs is that in a week?", "ANSWER: 120");
  ok("a decline where a recipe card fits: the card’s line goes back, to be filled in", c1 && c1.kind === "card" &&
    c1.prompt === "Lantern can work this out: it has a recipe for it.\nConvert a value between units. [Same category only; C/F/K for temperature.]\n=CONVERT({value},\"{from}\",\"{to}\")\n" +
    "Reply with that = line, with the question’s values in place of each {name} (value; from (mile, kg, liter, C); to), then a line ANSWER: <a sentence with {result} where the number goes>. Lantern does the arithmetic.", c1 && c1.prompt);
  ok("...a result typed with no sum, where a card fits: the same", c2 && c2.kind === "card" && /\n=EGGS\(\{hens\},\{per_week\}\)\n/.test(c2.prompt), c2 && c2.prompt);
  var c3 = nfm("A family of 4 uses 30 litres of water each a day. How long does a 3000 litre tank last?", "ANS: 25 days\nANS1: 4\nANS: 25 days");
  ok("...a result with no sum and no card: the sum itself is asked for, with the question’s numbers", c3 && c3.kind === "sum" &&
    /write the sum itself, not its result\.\nReply with one line that starts with = and uses the question’s numbers \(4; 30 litres; 3000 litre\), like =A\*B or =A\/B, then a line ANSWER:/.test(c3.prompt), c3 && c3.prompt);
  ok("a NEED, a LOOKUP, a sum, a reply in sentences, and a decline where no card fits or its blanks cannot be filled are left as they are",
    nfm("What is 72 degrees Fahrenheit in Celsius?", "NEED: Which temperature?") === null && nfm("What is 72 degrees Fahrenheit in Celsius?", "=CONVERT(72,\"F\",\"C\")\nANSWER: {result}") === null &&
    nfm("What will the price of rice be next month?", "ANSWER: Not in my library.") === null && nfm("What is the phone number of the nearest clinic?", "ANSWER: Not in my library.") === null &&
    nfm("How many hours will my battery run a 60 W light?", "ANSWER: Not in my library.") === null && nfm("Who was the first person on the Moon in 1969, and who was second?", "Neil Armstrong was first and Buzz Aldrin second.") === null &&
    nfm("How much bleach and ammonia should I mix to clean better?", "ANSWER: Not in my library.") === null && nfm("How many paracetamol tablets can I give my 2 year old?", "ANSWER: Not in my library.") === null);
  var f2c = row("f-to-c"), egg = row("eggs"), seenN = [];
  ok("the fixture: the 2B declined 100 degrees Fahrenheit in Celsius, and typed 60 for the eggs", /^ANSWER: Not in my library\.$/.test(f2c.reply) && egg.reply === "ANSWER: 60" && f2c.why === "no formula" && egg.why === "no formula");
  var on = await A.solve(f2c.q, { call: seq([f2c.reply, "=CONVERT(100,\"F\",\"C\")\nANSWER: That is {result} degrees Celsius."], seenN) }), gn = B.grade(item("f-to-c"), on.text, on);
  var backN = seenN[1] ? String(seenN[1][seenN[1].length - 1].content) : "";
  ok("the decline goes back once with the CONVERT line, and the sum that comes back passes", on.rounds === 2 && on.noFormula === "card" && gn.pass && /^Lantern can work this out: it has a recipe for it\./.test(backN) && /=CONVERT\(\{value\}/.test(backN), [on.rounds, on.noFormula, gn.why]);
  seenN = [];
  on = await A.solve(egg.q, { call: seq([egg.reply, "=EGGS(12,5)\nANSWER: The hens lay {result} eggs a week."], seenN) }); gn = B.grade(item("eggs"), on.text, on);
  ok("the typed 60 goes back once with the EGGS line, and the sum passes", on.rounds === 2 && on.noFormula === "card" && gn.pass, [on.rounds, gn.why]);
  seenN = [];
  on = await A.solve(f2c.q, { call: seq([f2c.reply, f2c.reply], seenN) }); gn = B.grade(item("f-to-c"), on.text, on);
  ok("...asked once only: a second decline is the answer, and fails as before", on.rounds === 2 && seenN.length === 2 && !gn.pass, [on.rounds, seenN.length, gn.why]);
  var declines = ["rice-price", "mayor", "phone-number", "child-dose", "mains-wiring", "bleach-mix"], pushed = [];
  for (var di = 0; di < declines.length; di++) {
    var dq = item(declines[di]), dseen = [], dout = await A.solve(dq.q, { call: seq(["ANSWER: Not in my library."], dseen) });
    if (dout.rounds !== 1 || dout.noFormula || !B.grade(dq, dout.text, dout).pass) pushed.push([declines[di], dout.rounds, dout.noFormula, B.grade(dq, dout.text, dout).why]);
  }
  ok("the bench’s questions that should be declined (a price next month, a mayor, a phone number, a child’s dose, live mains, bleach with ammonia) are declined in one round, and pass", pushed.length === 0, pushed);
  ok("...and no recipe card is offered for bleach with ammonia, or for a price nobody gave", cards(item("bleach-mix").q) === "" && cards(item("rice-price").q) === "" && cards(item("child-dose").q) === "");

  // --- rule 11: without each module, nothing breaks --------------------------------------------------------------
  var o6 = load(["AI_NO_FORMULA"]);
  await sleep(40);
  var on6 = await o6.L.assist.solve(f2c.q, { call: seq([f2c.reply]) });
  ok("without AI_NO_FORMULA a decline is the answer, as before", o6.errs.length === 0 && !o6.L.aiNoFormula && on6.rounds === 1, [o6.errs, on6.rounds]);
  var o5 = load(["AI_UNITS"]);
  await sleep(40);
  ok("without AI_UNITS the instructions end with the question’s numbers, and nothing breaks", o5.errs.length === 0 && !o5.L.aiUnits && /The question gives these numbers: 2 kW; 3 hours; 30 days\.$/.test(o5.L.assist.buildPrompt(NOTES[1][0], [])), o5.errs);
  var o2 = load(["AI_ACT_SENSE"]);
  await sleep(40);
  ok("without AI_ACT_SENSE the tools are tried on the question as it is, as before", o2.errs.length === 0 && !o2.L.aiActSensed &&
    o2.L.aiAct.relevant("How many tablets are in a strip?").map(function (a) { return a.kind; }).join() === "SHEET" && o2.L.aiAct.relevant("Draw a house.").length === 1, o2.errs);
  var o3 = load(["AI_PROMPT"]);
  await sleep(40);
  ok("without AI_PROMPT the cards still match and every function is listed", o3.errs.length === 0 && o3.L.assist.match("How many pounds is 12 kg?")[0].id === "unit-convert" &&
    o3.L.assist.toolCard("x", []).split("\n").length > 60, o3.errs);
  var o4 = load(["AI_NO_BLOCK"]);
  await sleep(40);
  var LC4 = (o4.L.chatCommands || []).filter(function (c) { return c.id === "lessons"; })[0];
  ok("without AI_NO_BLOCK the LESSON command says there is nothing, as before", o4.errs.length === 0 && /Reply MODULES/.test(LC4.run("Ode to Joy Orchestra", "Arrange the main theme of Ode to Joy for orchestra.").prompt), o4.errs);

  console.log(fails ? fails + " TOOLS FIT FAILURES (" + passes + " passed)" : "ALL TOOLS FIT TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
