// recipe_fill.js -- the recipe with the question's numbers in it (1.24.7).
// On 1.24.5 the 2B answered "Not in my library" to eleven sums Lantern has a
// recipe for, with the recipe and its blanks in front of it, and the 0.8B
// wrote =WEIGHT(50,"kg"). Where Lantern can be sure which of the question's
// numbers goes in which blank, it now fills the recipe itself
// (AI_NO_FORMULA's filled, with the fillers of AI_RECIPE_FILL) and gives the
// line to copy: in the short prompt, in what goes back for a decline, for a
// NEED Lantern can answer, for a line that could not be run, and for a sum
// that gives another number.
//
// A line handed over "as it stands" must be right, so this file is mostly
// about when Lantern fills NOTHING:
//  - a number written as a word ("Two 12 V batteries"), or said twice;
//  - a card's own plain case (bleach for cloudy water, feed with no "a day");
//  - two numbers in one unit whose order matters; a unit to change first;
//  - a question that asks for a unit the recipe cannot be said in;
//  - a question not written the way a filler reads it (60 eggs a week from
//    12 hens is not eggs for each hen; days for workers go the other way);
//  - a question that asks another thing of the same numbers, or a step more.
// Each question has its truth as a formula written apart from the recipe.
// None of them is the bench's own wording; the bench's sums are replayed
// against the bench's own answers at the end.
//
// The last three kinds came from an independent review of the first 1.24.7:
// 160 of its 199 questions were filled, 86 of them wrongly ("How many
// teaspoons of bleach for 200 litres" got the recipe for drops). Its
// questions are in fixtures/fill_review_1247.json and are replayed here: a
// recipe is filled now only when a rule for its card says the question asks
// for what the recipe gives (AI_RECIPE_FILL's assistFillRules), and the
// filled line goes only to a model on the short prompt.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
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
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1600)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function seq(list, seen) {
  var i = 0;
  return function (msgs) { if (seen) seen.push(msgs.map(function (m) { return textOf(m.content); })); return Promise.resolve(list[Math.min(i++, list.length - 1)]); };
}
function lastOf(seen, k) { var s = seen[k]; return s ? s[s.length - 1] : ""; }

// [question, the line Lantern fills ("" = it fills nothing), the truth as a formula written apart from the recipe]
var FILLS = [
  // --- each blank's unit names its number
  ["How much current does a 12 V supply push through 48 ohms?", "=AMPS(12,48)", "12/48"],
  ["How many watts does a 12 V lamp drawing 2.5 A use?", "=WATTS(12,2.5)", "12*2.5"],
  ["A 100 ohm and a 220 ohm resistor are in series. What is the total resistance?", "=RSERIES(100,220)", "100+220"],
  ["What is 220 ohm in parallel with 330 ohm?", "=RPARALLEL(220,330)", "220*330/(220+330)"],
  ["A 200 Ah 24 V battery bank runs a 480 W pump. How long will it last?", "=(200*24)/480", "10"],
  ["How long does a satellite at 800 km altitude take to go round the Earth?", "=ORBITT(CONVERT(800+6371,\"km\",\"m\"))/60", "2*PI*SQRT((7171000)^3/3.986004418e14)/60"],
  ["A bed is 6 m long and 1 m wide. How many cabbages fit at 40 cm spacing?", "=PLANTS(6,1,40)", "30"],
  ["How many seedlings do I need for a bed 4 m by 1.5 m, spaced 25 cm apart?", "=PLANTS(4,1.5,25)", "96"],
  ["What does a 12 kg gas bottle weigh, in newtons?", "=WEIGHT(12)", "12*9.80665"],
  ["How many newtons does a 50 kg sack weigh?", "=WEIGHT(50)", "50*9.80665"],
  ["What is the wavelength of a 7.1 MHz signal?", "=WAVELEN(7.1)", "299792458/7100000"],
  ["How many hectares is a field 250 m by 120 m?", "=250*120/10000", "3"],
  ["How many drops of bleach make 5 litres of clear water safe to drink?", "=2*5", "10"],
  // --- the one number left over (the animals), and a blank named by its word (days)
  ["How much feed do I need for 12 pigs for 14 days at 2500 g a day each?", "=FEEDKG(12,14,2500)", "12*14*2500/1000"],
  // --- a word of the question: a planet, a chemical formula
  ["What is the escape velocity of the Moon?", "=PLANET(\"Moon\",\"escape\")", "SQRT(2*4.9028e12/1737400)"],
  ["How much does a 5 kg mass weigh on Mars, in newtons?", "=WEIGHT(5,PLANET(\"Mars\",\"gravity\"))", "5*3.72"],
  ["How long is one orbit of Mars at 400 km altitude, in minutes?", "=ORBITT(PLANET(\"Mars\",\"radius\")+CONVERT(400,\"km\",\"m\"),PLANET(\"Mars\",\"gm\"))/60", "2*PI*SQRT((3389500+400000)^3/4.282837e13)/60"],
  ["What is the molar mass of CO2?", "=MOLARMASS(\"CO2\")", "12.011+2*15.999"],
  ["What is the molar mass of Ca(OH)2?", "=MOLARMASS(\"Ca(OH)2\")", "40.078+2*(15.999+1.008)"],
  ["How many moles are in 50 g of H2O?", "=MOLES(50,\"H2O\")", "50/18.015"],
  // --- the two orbits of a transfer, in either order; a height and a radius
  ["How many hours does a Hohmann transfer take from a 250 km orbit to a 20200 km orbit?", "=HOHMANNT(CONVERT(250+6371,\"km\",\"m\"),CONVERT(20200+6371,\"km\",\"m\"))/3600", "PI*SQRT(((6621000+26571000)/2)^3/3.986004418e14)/3600"],
  ["How many hours does a Hohmann transfer take from a 35786 km orbit down to a 300 km orbit?", "=HOHMANNT(CONVERT(35786+6371,\"km\",\"m\"),CONVERT(300+6371,\"km\",\"m\"))/3600", "PI*SQRT(((42157000+6671000)/2)^3/3.986004418e14)/3600"],
  ["How much delta-v does it take to go from a 400 km orbit to geostationary orbit, 42164 km from Earth's centre?", "=HOHMANN(CONVERT(400+6371,\"km\",\"m\"),CONVERT(42164,\"km\",\"m\"))", "HOHMANN(6771000,42164000)"],
  // --- a change of units, as the question names them
  ["Convert 5 miles to km.", "=CONVERT(5,\"miles\",\"km\")", "5*1.609344"],
  ["What is 72 degrees Fahrenheit in Celsius?", "=CONVERT(72,\"Fahrenheit\",\"Celsius\")", "(72-32)*5/9"],
  ["How many pounds is 12 kg?", "=CONVERT(12,\"kg\",\"pounds\")", "12/0.45359237"],
  ["How many km is 5 miles?", "=CONVERT(5,\"miles\",\"km\")", "5*1.609344"],
  ["Convert -40 degrees Celsius to Fahrenheit.", "=CONVERT(-40,\"Celsius\",\"Fahrenheit\")", "-40"],
  // --- bags, a tank, two places
  ["How many 25 kg sacks do I need for 1.5 tonnes of cement?", "=CEIL(1500/25)", "60"],
  ["How many 10 litre buckets fill a 200 litre drum?", "=CEIL(200/10)", "20"],
  ["How long does it take to fill a 200 litre drum from a tap that gives 8 litres a minute?", "=(200/8)/60", "25/60"],
  ["How far is it from Lagos to Accra?", "=DISTKM(\"Lagos\",\"Accra\")", "DISTKM(LAT(\"Lagos\"),LON(\"Lagos\"),LAT(\"Accra\"),LON(\"Accra\"))"],
  ["How far is it between Cairo and Khartoum?", "=DISTKM(\"Cairo\",\"Khartoum\")", "DISTKM(LAT(\"Cairo\"),LON(\"Cairo\"),LAT(\"Khartoum\"),LON(\"Khartoum\"))"],
  ["What is the bearing from London to Paris?", "=BEARING(\"London\",\"Paris\")", "BEARING(LAT(\"London\"),LON(\"London\"),LAT(\"Paris\"),LON(\"Paris\"))"],
  // --- a price for one and how many; so much for so many
  ["Petrol is 1.80 a litre. What do 40 litres cost?", "=1.80*40", "72"],
  ["A recipe for 4 people uses 300 g of flour. How much for 10 people?", "=300/4*10", "750"],
  ["My truck does 400 km on 50 litres of diesel. How much diesel for 1,000 km?", "=1000*50/400", "125"],
  ["A car uses 8 litres per 100 km. How many litres for 350 km?", "=350*8/100", "28"],
  ["My 30 hens lay 4 eggs each a week. How many eggs is that in a week?", "=EGGS(30,4)", "120"],
  // --- the unit the question asks for: the recipe inside a CONVERT
  ["A 12 V battery of 100 Ah runs a 60 W light. How many minutes will it last?", "=CONVERT((100*12)/60,\"hours\",\"minutes\")", "1200"],
  ["How many minutes does it take to fill a 200 litre drum at 8 litres per minute?", "=CONVERT((200/8)/60,\"hours\",\"minutes\")", "25"],
  ["What is the wavelength of 145 MHz in cm?", "=CONVERT(WAVELEN(145),\"metres\",\"cm\")", "29979245800/145000000"],
  ["How far is it from Nairobi to Mombasa in miles?", "=CONVERT(DISTKM(\"Nairobi\",\"Mombasa\"),\"km\",\"miles\")", "DISTKM(\"Nairobi\",\"Mombasa\")/1.609344"],
  ["What is the kinetic energy of a 1500 kg car at 30 m/s, in kJ?", "=CONVERT(KE(1500,30),\"joules\",\"kJ\")", "0.5*1500*30^2/1000"],
  // --- NOTHING: a number in words
  ["Two resistors of 100 ohm and 220 ohm are in series. What is the total resistance?", "", "320"],
  ["A 12 V battery of 100 Ah is half full. How many hours will it run a 60 W light?", "", "10"],
  ["How much do 3 dozen eggs cost at 12 shillings each?", "", "432"],
  // --- NOTHING: a unit to change first, or more numbers than blanks, or fewer
  ["What is the voltage across a 1000 ohm resistor carrying 3 mA?", "", "3"],
  ["What resistor do I need to drop 5 V at 20 mA?", "", "250"],
  ["What is the total resistance of 10 ohm, 20 ohm and 30 ohm resistors in parallel?", "", "1/(1/10+1/20+1/30)"],
  ["A 100 Ah 12 V battery runs a 60 W light for 5 hours. How many Ah are left?", "", "75"],
  ["How many hours will a 100 Ah battery at 12 V run a 60 W light and a 40 W fan?", "", "12"],
  ["How long does a satellite at 500 miles altitude take to orbit the Earth, in minutes?", "", "0"],
  ["A bed is 10 m long and 120 cm wide. How many plants at 30 cm spacing?", "", "0"],
  ["A field is 2 km long and 500 m wide. How many hectares?", "", "100"],
  ["What is the kinetic energy of a 2 tonne truck at 20 m/s?", "", "400000"],
  ["How many moles is 10 g of salt?", "", "0"],
  ["How many grams is 2 mol of NaCl?", "", "116.88"],
  ["Convert 3 hours 20 minutes to minutes.", "", "200"],
  // --- NOTHING: not the card's plain case
  ["How many drops of bleach do I need for 20 litres of cloudy water?", "", "80"],
  ["How much feed for 50 chickens for 7 days at 120 g each?", "", "42"],
  // --- NOTHING: a unit the recipe cannot be said in
  ["What is the escape velocity from Mars in km/s?", "", "5.03"],
  ["How many kg does a 50 kg sack weigh on the Moon?", "", "50"],
  // --- NOTHING: not written the way the filler reads it
  ["My 12 hens lay 60 eggs a week. How many eggs is that per hen?", "", "5"],
  ["I have 12 hens and each lays 1 egg a day. How many eggs a week?", "", "84"],
  ["A 25 kg sack of flour costs 900 pesos. What do 3 sacks cost?", "", "2700"],
  ["Fuel costs 65 pesos a litre. I have 1300 pesos. How many litres can I buy?", "", "20"],
  ["Maize sells for 30 shillings a kg. How much do I get for 2 tonnes?", "", "60000"],
  ["Rent is 300 dollars a month. How much is that for 2 years?", "", "7200"],
  ["A recipe uses 2 cups of rice for 4 people. How many people does 5 cups feed?", "", "10"],
  ["A car goes 150 km on 10 litres. How far does it go on 25 litres?", "", "375"],
  ["A car goes 300 miles on 10 gallons. How many gallons for 450 miles?", "", "15"],
  ["How much more would a 70 kg person weigh on Jupiter than on Earth?", "", "0"]
];

(async function () {
  var o = load(), L = o.L;
  await sleep(60);
  var A = L.assist, P = L.aiPrompt, NF = L.aiNoFormula, FL = NF.filled, B = L.aiBench, Q = L.aiBenchQuestions;
  function ev(e) { try { return L.formula.evaluate(e, { deg: false, ans: 0 }); } catch (x) { return null; } }
  function fill(q) { var cs = A.match(q); return cs.length === 1 ? FL(cs[0], q) : ""; }
  ok("boot clean", o.errs.length === 0, o.errs);

  // --- every line Lantern fills is the one expected, and is right; where it should fill nothing, it does ---
  var wrongLine = [], wrongValue = [];
  FILLS.forEach(function (f) {
    var line = fill(f[0]);
    if (line !== f[1]) wrongLine.push([f[0], line]);
    if (line) { var v = A.run(line).value, t = ev(f[2]); if (typeof t !== "number" || Math.abs(v - t) > Math.abs(t) * 0.005 + 1e-9) wrongValue.push([f[0], line, v, t]); }
  });
  var nFilled = FILLS.filter(function (f) { return f[1]; }).length;
  ok("of " + FILLS.length + " questions (none the bench\u2019s wording), Lantern fills the recipe for " + nFilled + " and for no other", FILLS.length === 73 && nFilled === 44 && wrongLine.length === 0, wrongLine);
  ok("...and every line it fills gives the question\u2019s answer (the truth written apart from the recipe, to 1 in 200)", wrongValue.length === 0, wrongValue);

  // --- what the line gives is said with it ---
  var qm = "A 12 V battery of 100 Ah runs a 60 W light. How many minutes will it last?", cm = A.match(qm)[0];
  ok("the unit the question asks for: the recipe gives hours, the question asks minutes, and the line is the recipe inside a CONVERT; what it gives is said",
    FL(cm, qm) === "=CONVERT((100*12)/60,\"hours\",\"minutes\")" && FL.out(cm, qm) === "minutes, as the question asks" && FL.out(A.match("What is 220 ohm in parallel with 330 ohm?")[0], "What is 220 ohm in parallel with 330 ohm?") === "ohms", [FL(cm, qm), FL.out(cm, qm)]);
  ok("HOHMANN and HOHMANNT give the same for the two orbits in either order (the cards\u2019 sym)", ev("HOHMANN(7000000,42164000)") === ev("HOHMANN(42164000,7000000)") && ev("HOHMANNT(7000000,42164000)") === ev("HOHMANNT(42164000,7000000)"));
  ok("a number that closes a chemical formula is not one of the question\u2019s numbers (Ca(OH)2), and H2O\u2019s 2 is not either", L.aiQuestionNumbers("What is the molar mass of Ca(OH)2?").length === 0 && L.aiQuestionNumbers("How many moles are in 50 g of H2O?").join() === "50 g");
  ok("the molar mass card is not offered for \u201chow many moles\u201d (the question had two recipes, and Lantern fills none of two)",
    A.match("How many moles are in 50 g of H2O?").map(function (c) { return c.id; }).join() === "grams-moles" && A.match("What is the molar mass of CO2?").map(function (c) { return c.id; }).join() === "molar-mass");

  // --- the short prompt: the filled line alone, to copy as it stands ---
  var pm = P.assist(qm, A.match(qm)), qe = "How much do 3 dozen eggs cost at 12 shillings each?", pe = P.assist(qe, A.match(qe));
  ok("the short prompt for a recipe Lantern fills: the line with the numbers in it and what it gives, no blanks and nothing to fill in",
    /- The recipe below has this question's numbers in it already\. If it is what the question asks, copy its = line as it stands\./.test(pm) &&
    /\nRECIPE\n- How long will a battery run a load\?[^\n]*\n  gives: minutes, as the question asks\n  =CONVERT\(\(100\*12\)\/60,"hours","minutes"\)\n/.test(pm) && !/\{ah\}/.test(pm) && !/needs:/.test(pm), pm.slice(-500));
  ok("...and for one it does not fill (3 dozen): the recipe with its blanks, as before", /- A recipe below fits: copy its = line and put the question's value in place of each \{name\}\./.test(pe) && /\n  needs: price; qty\n  gives: total, same currency\n  =\{price\}\*\{qty\}\n/.test(pe), pe.slice(-400));

  // --- what goes back: a decline, with the filled line; the reply that copies it passes ---
  // (the filled line is for the model that was given the short prompt; a model given the whole instructions gets
  // the recipe with its blanks, as on 1.24.6)
  var qd = "How far is it from Nairobi to Mombasa in miles?", seenD = [], seenDF = [], modeWas = P.mode();
  var odf = await A.solve(qd, { call: seq(["ANSWER: Not in my library.", "=CONVERT(DISTKM(\"Nairobi\",\"Mombasa\"),\"km\",\"miles\")\nANSWER: It is about {result} miles."], seenDF) });
  P.setMode("short");
  var od = await A.solve(qd, { call: seq(["ANSWER: Not in my library.", "=CONVERT(DISTKM(\"Nairobi\",\"Mombasa\"),\"km\",\"miles\")\nANSWER: It is about {result} miles."], seenD) });
  ok("a decline where Lantern fills the recipe (a small model, on the short prompt): the line goes back with the towns and the miles in it, and the reply that copies it is read",
    od.rounds === 2 && od.noFormula === "card" && /\n=CONVERT\(DISTKM\("Nairobi","Mombasa"\),"km","miles"\)\nThat is the recipe with the question\u2019s numbers in it\. If it is what the question asks, reply with that = line as it stands/.test(lastOf(seenD, 1)) &&
    Math.abs(od.run.value - 274.95) < 0.1, [od.rounds, od.noFormula, od.run && od.run.value, lastOf(seenD, 1)]);
  ok("...a model given the whole instructions gets the recipe with its blanks", odf.rounds === 2 && odf.noFormula === "card" && /\n=DISTKM\("\{from\}","\{to\}"\)\nReply with that = line, with the question\u2019s values in place of each \{name\}/.test(lastOf(seenDF, 1)), lastOf(seenDF, 1));

  // --- a sum that gives another number than the recipe ---
  var RD = L.assistChecks.filter(function (c) { return c.id === "recipe-differs"; })[0];
  function rd(q, expr) { return RD(q, expr, A.run(expr), {}); }
  function all(q, expr) { var run = A.run(expr); return L.assistChecks.map(function (c) { var r = null; try { r = c(q, expr, run, {}); } catch (e) { r = null; } return r; }).filter(Boolean); }
  ok("the question says the unit (minutes): a sum in hours is questioned with the line in minutes; the right sum, however it is written, is not",
    /^Lantern\u2019s recipe for this question gives 1200 \(minutes, as the question asks\), and this sum gives 20: write =CONVERT\(\(100\*12\)\/60,"hours","minutes"\)$/.test(rd(qm, "=(100*12)/60")) &&
    rd(qm, "=100*12/60*60") === null && rd(qm, "=(100*12)/60\n=ANS*60") === null, [rd(qm, "=(100*12)/60"), rd(qm, "=100*12/60*60")]);
  var qh = "A 200 Ah 24 V battery bank runs a 480 W pump. How long will it last?";
  ok("the question says no unit, and the recipe is plain arithmetic: a sum in another unit (minutes) is not a wrong sum, and is left alone", fill(qh) === "=(200*24)/480" && rd(qh, "=(200*24)/480*60") === null && rd(qh, "=200*24/480") === null);
  var qw = "What is the wavelength of a 7.1 MHz signal?";
  ok("...the recipe is a function of Lantern\u2019s: a sum that does not use it and gives another number is questioned (frequency over the speed of light), one that uses it is not (WAVELEN, then x 100 for cm)",
    /gives 42\.224 \(metres\), and this sum gives 0\.023683: write =WAVELEN\(7\.1\)$/.test(rd(qw, "=7.1*10^6/299792458")) && rd(qw, "=WAVELEN(7.1)*100") === null && rd(qw, "=299792458/7100000") === null, rd(qw, "=7.1*10^6/299792458"));
  var qf = "How many kg of feed do 15 goats need for 20 days at 900 g each per day?", af = all(qf, "=900*15*20");
  ok("one line to write: where another check has written a line that gives the recipe\u2019s number (grams asked in kg: divide by 1000), the recipe check says nothing; where that line would still be wrong, it gives the recipe",
    fill(qf) === "=FEEDKG(15,20,900)" && af.length === 1 && /divide by 1000 \(=900\*15\*20\/1000\)$/.test(af[0]) && rd(qf, "=900*15*20") === null && /write =FEEDKG\(15,20,900\)$/.test(rd(qf, "=900*15")), af);
  var qt = "How many hours does a Hohmann transfer take from a 250 km orbit to a 20200 km orbit?", at = all(qt, "=HOHMANNT(CONVERT(250,\"km\",\"m\")+6371000,CONVERT(20200,\"km\",\"m\"))/3600");
  ok("...and where a height was left as a radius: the heights check writes the line, once", at.join("; ").split("write =").length === 2 && /20200 km is a height/.test(at.join("; ")), at);
  P.setMode("full");
  ok("a model given the whole instructions wrote its own sum: the recipe check says nothing to it (the review: =MOMENTUM(1500,30), a right sum, was told to be the recipe\u2019s =KE(1500,30))",
    rd(qm, "=(100*12)/60") === null && rd(qw, "=7.1*10^6/299792458") === null && rd(qf, "=900*15") === null);
  P.setMode(modeWas);

  // --- the bench's own sums: what Lantern fills is the bench's answer ---
  var bRight = 0, bWrong = [], bOne = 0;
  Q.forEach(function (it) {
    if (!it.x) return;
    var cs = A.match(it.q);
    if (cs.length !== 1) return;
    bOne++;
    var line = FL(cs[0], it.q);
    if (!line) return;
    var v = A.run(line).value, t = ev(it.x);
    if (typeof t === "number" && Math.abs(v - t) <= Math.abs(t) * (it.tol || 0.02) + 1e-9) bRight++; else bWrong.push([it.id, line, v, t]);
  });
  ok("the bench\u2019s sums with one recipe (" + bOne + "): Lantern fills 31 of them, and each is the bench\u2019s own answer; it fills none wrongly", bOne === 35 && bRight === 31 && bWrong.length === 0, [bOne, bRight, bWrong]);
  var S35 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1244_35b_sums.json"), "utf8")), touched = [];
  P.setMode("short");
  S35.rows.forEach(function (r) { var p = A.parseReply(r.reply), why = RD(r.q, p.exprText, A.run(p.exprText), {}); if (why) touched.push([r.id, why]); });
  P.setMode(modeWas);
  ok("the 35B\u2019s 45 right sums of 1.24.4: the recipe check questions none of them, even as it runs for a small model", S35.rows.length === 45 && touched.length === 0, touched);

  // --- the review's questions ---
  var RV = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "fill_review_1247.json"), "utf8")), rvWrong = [], rvMoved = [], rvN = { filled: 0, none: 0, many: 0 };
  RV.rows.forEach(function (r) {
    var cs = A.match(r.q), line = cs.length === 1 ? FL(cs[0], r.q) : "", now = cs.length !== 1 ? (cs.length ? "more than one recipe" : "no recipe") : line ? "filled" : "not filled";
    if (cs.length !== 1) rvN.many++; else if (line) rvN.filled++; else rvN.none++;
    if (now !== r.now || (line && line !== r.line)) rvMoved.push([r.q, now, line]);
    if (line && !r.table) { var v = A.run(line).value; if (typeof r.truth !== "number" || Math.abs(v - r.truth) > Math.abs(r.truth) * 0.01 + 1e-9) rvWrong.push([r.q, line, v, r.truth]); }
  });
  ok("the review\u2019s 199 questions (the first 1.24.7 filled 160 of them, 86 wrongly): Lantern fills 95 now, and every line it fills gives the reviewer\u2019s answer (two of Jupiter by Lantern\u2019s own table); 78 it leaves to the model; 26 have two recipes",
    RV.rows.length === 199 && rvN.filled === 95 && rvN.none === 78 && rvN.many === 26 && rvWrong.length === 0 && rvMoved.length === 0 && RV.rows.filter(function (r) { return r.table; }).length === 2, [rvN, rvWrong, rvMoved]);
  function none(qs) { return qs.filter(function (q) { return fill(q) !== ""; }); }
  ok("...the answer asked in a unit the recipe is not in: nothing, unless CONVERT can change it (mA, millivolts, kilohms, km/s, kg/mol, nautical miles, dollars for cents, nights; teaspoons, capfuls or ml of bleach)",
    none(["How many milliamps flow through a 1000 ohm resistor at 5 V?", "What is the current, in mA, through a 1000 ohm resistor at 5 V?", "What is the voltage across a 470 ohm resistor carrying 0.02 A, in millivolts?",
      "How many kilohms is 2200 ohm in series with 3300 ohm?", "How many km/s is the escape velocity of the Moon?", "What is the molar mass of NaCl, in kg/mol?", "How far is it from Lagos to Accra in nautical miles?",
      "Electricity costs 25 cents per kWh. What does 12 kWh cost in dollars?", "How many nights will a 100 Ah 12 V battery run a 60 W light?", "How many teaspoons of bleach for 200 litres of water?",
      "How many capfuls of bleach for 200 litres of water?", "How many ml of bleach for 1000 litres of water?"]).length === 0 &&
    fill("How long in minutes will a 100 Ah 12 V battery run a 60 W lamp?") === "=CONVERT((100*12)/60,\"hours\",\"minutes\")" && fill("What is the power in kilowatts of a 230 V heater drawing 10 A?") === "=CONVERT(WATTS(230,10),\"watts\",\"kilowatts\")" &&
    fill("What is the distance in miles between London and Paris?") === "=CONVERT(DISTKM(\"London\",\"Paris\"),\"km\",\"miles\")" && fill("In minutes, how long will a 12 V 7 Ah battery run a 60 W lamp?") === "=CONVERT((7*12)/60,\"hours\",\"minutes\")");
  ok("...another thing asked of the same numbers: nothing (the other resistor, the current a lamp draws, the amp-hours used in an hour, orbits in a day, how fast, a signal\u2019s delay, moles of atoms, what burning gives, momentum, a dipole, a triangle, a perimeter, rows, one hen)",
    none(["What resistance in parallel with 100 ohm gives 50 ohm?", "What resistance must be added in series to 100 ohm to make 250 ohm?", "A 12 V battery of 100 Ah runs a 60 W light. What current does the light draw?",
      "A 100 Ah battery at 12 V powers a 60 W lamp. How many Ah are used per hour?", "How many orbits a day does a satellite at 400 km altitude make?", "How many times a day does the ISS go round at 420 km?",
      "How fast does a satellite orbit the Moon at 100 km altitude?", "How long does a radio signal take to reach a satellite at 35786 km altitude?", "How many moles of hydrogen atoms are in 36 g of H2O?",
      "How many moles of CO2 are produced by burning 12 g of carbon?", "What is the momentum of a 1500 kg car moving at 30 m/s?", "How long should a dipole antenna be for 14.2 MHz?",
      "How many hectares is a triangular field with a base of 250 m and a height of 120 m?", "How many hectares is a field with a perimeter of 740 m and a width of 120 m?",
      "A bed is 6 m long and 1 m wide. How many rows 40 cm apart fit across it?", "My 30 hens lay 4 eggs each a week. How many eggs does one hen lay in a week?", "What is the molar mass of CuSO4.5H2O?"]).length === 0);
  ok("...a step more than the recipe: nothing (a round trip, then on to a third town, by road, the back bearing, each way, there and back, a week of days, a year of weeks, how much more, between them, in total)",
    none(["How far is a round trip from Lagos to Accra?", "How far is it from Cairo to Khartoum, then on to Nairobi?", "How far is it from Nairobi to Mombasa by road?", "What is the back bearing from London to Paris?",
      "It costs 2 dollars per km to hire a truck. What does a trip of 150 km each way cost?", "My car uses 8 litres per 100 km. How much petrol to drive 350 km there and back?",
      "Milk is 50 shillings a litre. A family drinks 2 litres a day. What does a week cost?", "Petrol is 1.80 a litre and I use 40 litres a week. What do I spend in a year?",
      "A recipe for 4 people uses 300 g of flour. How much more flour do I need for 10 people?", "The 12 pigs eat 2500 g a day between them. How much feed for 14 days?", "How much feed for 12 pigs for 14 days at 2500 g a day in total?"]).length === 0);
  ok("...a number in words, a fraction sign, a number said twice, a second battery: nothing",
    none(["A 12 V battery of 100 Ah runs fifteen 4 W LED lamps. How long will it last?", "Sixteen 2 W lamps run from a 12 V 50 Ah battery. How many hours?", "A 12 V 100 Ah battery runs thirteen 5 W bulbs. How many hours?",
      "A 12 V 100 Ah battery that is \u00bd full runs a 60 W light. How long?", "What is the total resistance of a 100 ohm, a 100 ohm and a 50 ohm resistor in series?",
      "A 100 Ah 12 V battery and a second 100 Ah 12 V battery run a 60 W lamp. How long?"]).length === 0);
  ok("...a radius where the recipe takes a height, and a height taken for a radius: nothing; two heights said as heights are filled as heights (a geostationary orbit, an orbit at so many km, an altitude)",
    none(["How long does a satellite take to orbit Earth at a radius of 7000 km?", "A satellite orbits 26571 km from Earth\u2019s centre. How long does one orbit take?", "What is the escape velocity at a radius of 7000 km?",
      "How long does Phobos take to orbit Mars at a radius of 9376 km?", "How many hours does a Hohmann transfer take from a 250 km orbit to one at 20200 km?"]).length === 0 &&
    fill("How long does a Hohmann transfer take from a 300 km orbit to a 35786 km geostationary orbit?") === "=HOHMANNT(CONVERT(300+6371,\"km\",\"m\"),CONVERT(35786+6371,\"km\",\"m\"))/3600" &&
    fill("How long does a Hohmann transfer take from low Earth orbit at 300 km to geostationary orbit at 35786 km?") === "=HOHMANNT(CONVERT(300+6371,\"km\",\"m\"),CONVERT(35786+6371,\"km\",\"m\"))/3600" &&
    fill("How long does a Hohmann transfer take from a 400 km orbit to GPS altitude, 20200 km?") === "=HOHMANNT(CONVERT(400+6371,\"km\",\"m\"),CONVERT(20200+6371,\"km\",\"m\"))/3600");
  var qj = "How many 20 litre jerrycans can be filled from a 250 litre tank?", cj = A.match(qj)[0];
  ok("...containers: the size is the one said after \u201chow many\u201d; bags that must hold an amount are rounded up, cans filled from a tank and boxes that fit on a shelf are whole ones, rounded down -- and said so",
    fill(qj) === "=FLOOR(250/20)" && FL.out(cj, qj) === "whole ones (rounded down)" && fill("How many 750 ml bottles can I fill from a 20 litre bucket?") === "=FLOOR(20/0.75)" &&
    fill("How many 40 cm boxes fit on a 2.5 m shelf?") === "=FLOOR(2.5/0.4)" && fill("How many 50 kg bags can a 1.02 tonne trailer carry?") === "=FLOOR(1020/50)" &&
    fill("How many 20 litre jerrycans do I need to carry 15 litres of water?") === "=CEIL(15/20)" && fill("How many 1.5 litre bottles make 20 litres?") === "=CEIL(20/1.5)" &&
    fill("How many 25 kg sacks do I need for 1.5 tonnes of cement?") === "=CEIL(1500/25)" && fill("How many 20 litre jerrycans for a 250 litre tank?") === "", [fill(qj), FL.out(cj, qj), fill("How many 20 litre jerrycans do I need to carry 15 litres of water?")]);
  ok("...bleach: drops for clear water to drink, and nothing for any other measure, use or water (to mop a floor, the time to wait, river or pond water, water that is not clear)",
    fill("How many drops of bleach make 5 litres of clear water safe to drink?") === "=2*5" &&
    none(["How much bleach do I add to 5 litres of water to mop the floor?", "How long must I wait after adding bleach to 20 litres of water?", "How many drops of bleach do I need to disinfect 20 litres of river water?",
      "How many drops of bleach for 20 litres of water that is not clear?", "How many drops of bleach for 20 litres of hazy pond water?", "How many drops of bleach do I need for 20 litres of cloudy water?"]).length === 0);
  ok("...the number left over is a count, never an amount: \u201cif a bag is 50 kg\u201d does not make 50 pigs", fill("How much feed do my pigs need for 14 days at 2500 g a day each if a bag is 50 kg?") === "");
  ok("a card with no rule is not filled", !L.assistFillRules["ors-sugar"] && !L.assistFillRules["geo-altitude"] && Object.keys(L.assistFillRules).length >= 35);

  // --- rule 11 ---
  var o2 = load(["AI_RECIPE_FILL"]);
  await sleep(40);
  var A2 = o2.L.assist, F2 = o2.L.aiNoFormula.filled;
  function fill2(q) { var cs = A2.match(q); return cs.length === 1 ? F2(cs[0], q) : ""; }
  var pm2 = o2.L.aiPrompt.assist(qm, A2.match(qm));
  ok("without AI_RECIPE_FILL: no card has a rule, so nothing is filled; the recipes go to the model with their blanks, as on 1.24.6",
    o2.errs.length === 0 && !o2.L.assistFillRules && fill2("How much current does a 12 V supply push through 48 ohms?") === "" && fill2(qm) === "" &&
    fill2("What is the molar mass of CO2?") === "" && fill2("Convert 5 miles to km.") === "" && fill2("Petrol is 1.80 a litre. What do 40 litres cost?") === "" &&
    /- A recipe below fits: copy its = line/.test(pm2) && /  gives: hours\n  =\(\{ah\}\*\{v\}\)\/\{w\}\n/.test(pm2), o2.errs);
  var o3 = load(["AI_NO_FORMULA"]);
  await sleep(40);
  var p3 = o3.L.aiPrompt.assist(qm, o3.L.assist.match(qm));
  ok("without AI_NO_FORMULA: the short prompt gives the recipe with its blanks, as before", o3.errs.length === 0 && /- A recipe below fits: copy its = line/.test(p3) && /  gives: hours\n  =\(\{ah\}\*\{v\}\)\/\{w\}\n/.test(p3), o3.errs);

  console.log(fails ? fails + " RECIPE FILL FAILURES (" + passes + " passed)" : "ALL RECIPE FILL TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
