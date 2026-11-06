// health.js -- the Health tile after its audit (1.24.4).
//  - the tile: emergencies first, four groups, every topic opens a lesson, a
//    topic whose lesson module is not loaded is not shown (rule 11);
//  - the lessons: the figures a person will act on are the sourced ones (a
//    change to one must be a decision, not a slip), no medicine and no dose
//    anywhere, every emergency lesson sends the reader to trained help;
//  - the ORS mixer, the breath and pulse counter, bleach for water;
//  - Print on every lesson (Lantern.lessonTools);
//  - Chat: a health need said the way people say it gets the Health lesson
//    that fits, whole and in order, and nothing else does; the recipe cards;
//    the bench's health questions and what their checks catch.
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
  w.fetch = function () { return Promise.reject(new TypeError("no model in this test")); };
  w.printed = 0; w.print = function () { w.printed++; };
  w.eval(js);
  return { w: w, L: w.Lantern, d: w.document, errs: errs };
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
function plain(html) { return String(html).replace(/<[^>]*>/g, " ").replace(/&frac12;/g, "1/2").replace(/&deg;/g, " deg ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " "); }
function mount(o) {
  var ws = o.d.createElement("div");
  o.d.body.appendChild(ws);
  o.L.apps.health.mount(ws);
  return ws;
}
function all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

(async function () {
  var o = load(), w = o.w, L = o.L, d = o.d, ML = L.mathLessons, S = L.suite;
  var KEYS = ML.list().map(function (l) { return l.key; }).filter(function (k) { return /^health_/.test(k); });
  function lesson(k) { var g = ML.get(k); return g ? plain(g.html) : ""; }

  // --- the tile -------------------------------------------------------------------------------
  var ws = mount(o);
  var heads = all(ws, "h2").map(function (h) { return h.textContent; });
  ok("the tile's groups, emergencies first", heads.slice(0, 4).join("|") === "Emergencies|Sick children and adults|Mother and baby|Staying well", heads);
  var topics = all(ws, "button.tile");
  ok("42 topics, each one a lesson that is loaded", topics.length === 42 && KEYS.length === 42, [topics.length, KEYS.length]);
  var opened = 0, withPrint = 0;
  topics.forEach(function (b) {
    b.click();
    var ov = d.querySelector(".lesson-overlay");
    if (ov && ov.querySelector(".lesson-body").textContent.length > 250) opened++;
    if (ov && all(ov, ".guide-head button").map(function (x) { return x.textContent; }).join("|") === "Print|Close") withPrint++;
    if (ov) all(ov, ".guide-head button").pop().click();
  });
  ok("every topic opens its lesson, with Print and Close", opened === 42 && withPrint === 42 && !d.querySelector(".lesson-overlay"), [opened, withPrint]);
  ok("the first topics are what cannot wait", topics.slice(0, 4).map(function (b) { return b.textContent; }).join("|") === "First things first|Not breathing (CPR)|Choking|Unconscious: recovery position",
    topics.slice(0, 4).map(function (b) { return b.textContent; }));

  // --- the ORS mixer -----------------------------------------------------------------------------
  var orsOut = ws.querySelector(".physresult"), orsIn = ws.querySelector("input[aria-label='Litres of clean water']");
  function ors(v) { orsIn.value = v; orsIn.dispatchEvent(new w.Event("input")); return orsOut.textContent; }
  ok("the ORS mixer answers as the tile opens", /^For 1 L: 6 level tsp sugar \+ 0\.5 level tsp salt$/.test(orsOut.textContent), orsOut.textContent);
  ok("...scales", /^For 2\.5 L: 15 level tsp sugar \+ 1\.25 level tsp salt$/.test(ors("2.5")) && /^For 20 L: 120 level tsp sugar \+ 10 level tsp salt$/.test(ors("20")), [ors("2.5"), ors("20")]);
  ok("...under a litre: the numbers, and that a whole litre is safer", /^For 0\.5 L: 3 level tsp sugar \+ 0\.25 level tsp salt/.test(ors("0.5")) && /too much salt is harmful/.test(ors("0.5")) && /mix a whole litre/.test(ors("0.5")), ors("0.5"));
  ok("...a cupful or less: no numbers at all (it said 0 tsp + 0 tsp)", /too little to measure safely/.test(ors("0.1")) && !/\b0 (level )?tsp/.test(ors("0.001")) && /Mix a whole litre: 6 level tsp sugar \+ half a level tsp salt/.test(ors("0.001")), ors("0.001"));
  ok("...nothing, zero or less: a dash", ors("") === "—" && ors("0") === "—" && ors("-2") === "—");
  ok("Lantern.healthOrs gives the numbers", L.healthOrs(3).sugar === 18 && L.healthOrs(3).salt === 1.5 && !L.healthOrs("x").ok);

  // --- what the lessons say: the sourced figures ----------------------------------------------------
  var FACTS = [
    ["health_cpr", /5 to 6 cm/, "adult chest pushes 5 to 6 cm deep"],
    ["health_cpr", /100 to 120 times a minute/, "100 to 120 pushes a minute"],
    ["health_cpr", /every 30 pushes/, "breaths after every 30 pushes"],
    ["health_cpr", /5 breaths first/, "5 breaths first for a child, a baby, a drowned person"],
    ["health_emergency", /5 sharp blows between the shoulder blades/, "5 back blows"],
    ["health_emergency", /Never squeeze a baby.s belly/, "no abdominal thrusts on a baby"],
    ["health_bleeding", /keep pressing/, "direct pressure, kept up"],
    ["health_bleeding", /Write down the time/, "the time a tourniquet went on"],
    ["health_burns", /20 minutes/, "burns cooled 20 minutes"],
    ["health_fits", /more than 5 minutes/, "a fit over 5 minutes needs help"],
    ["health_fits", /Put nothing in the mouth/, "nothing in the mouth in a fit"],
    ["health_poison", /do not make them vomit/, "no vomiting after poison"],
    ["health_breathing", /under 2 months: 60 or more/, "fast breathing under 2 months"],
    ["health_breathing", /2 months up to 12 months: 50 or more/, "fast breathing 2 to 12 months"],
    ["health_breathing", /1 year up to 5 years: 40 or more/, "fast breathing 1 to 5 years"],
    ["health_breathing", /one full minute/, "breaths counted for a full minute"],
    ["health_danger", /cannot drink or breastfeed/, "the first general danger sign"],
    ["health_muac", /Less than 11\.5 cm/, "the severe arm measurement"],
    ["health_muac", /11\.5 cm up to 12\.5 cm/, "the moderate arm measurement"],
    ["health_ors", /6 level teaspoons of sugar/, "ORS sugar"],
    ["health_ors", /1\/2 level teaspoon of salt/, "ORS salt"],
    ["health_water", /2 drops per litre/, "bleach drops a litre"],
    ["health_water", /30 minutes/, "the wait after bleach"],
    ["health_water", /1 minute/, "the boil"],
    ["health_latrine", /30 metres/, "a latrine's distance from water"],
    ["health_latrine", /1\.5 metres above the groundwater/, "the pit above groundwater"],
    ["health_afterbirth", /Do not pull on the cord/, "the cord is never pulled"],
    ["health_newborn", /Breast milk only for the first six months/, "breast milk only for six months"],
    ["health_vitals", /38 deg C/, "fever at 38"],
    ["health_bites", /15 minutes/, "a bite washed 15 minutes"],
    ["health_water", /above about 1,500 m/, "3 minutes' boiling in the mountains (the lower of the CDC's and EPA's heights)"],
    ["health_water", /Weak bleach labelled 1%: 10 drops per litre/, "the CDC's figure for 1% bleach"],
    ["health_water", /add the same amount again and wait 15 minutes more/, "the second dose when no chlorine can be smelt"],
    ["health_diarrhoea", /under 2 years 50 to 100 ml/, "WHO's amount of fluid after each loose stool, under 2"],
    ["health_diarrhoea", /an older child 100 to 200 ml/, "WHO's amount of fluid after each loose stool, 2 and over"],
    ["health_diarrhoea", /wait ten minutes/, "the wait after vomiting"],
    ["health_muac", /Bend the child.s left arm at a right angle/, "the arm bent to find the midpoint"],
    ["health_mind", /Get more help at once/, "harm to self or others is not left for weeks"],
    ["health_homecare", /no urine for 8 hours/, "no urine for 8 hours"],
    ["health_vitals", /first month, 70 to 190/, "a newborn's pulse"],
    ["health_cpr", /press on the breastbone with both thumbs/, "a baby's chest pressed with two thumbs (2025: no longer two fingers)"],
    ["health_cpr", /head level, not tilted back/, "a baby's head level for breaths"],
    ["health_emergency", /with both thumbs on the middle of the breastbone/, "a choking baby's chest thrusts with two thumbs"],
    ["health_bleeding", /5 to 7 cm above the wound/, "where a tourniquet goes"],
    ["health_bleeding", /do not wait/, "a tourniquet is not left to the last"],
    ["health_poison", /at least 20 minutes/, "a chemical washed off for at least 20 minutes"],
    ["health_eyes", /still bleeding after 15 minutes/, "a nosebleed: help after 15 minutes"],
    ["health_eyes", /come round within a minute/, "a faint: awake within a minute"],
    ["health_head", /They may sleep/, "sleep is allowed after a blow to the head"],
    ["health_head", /were knocked out, even for a moment/, "who must be seen after a blow to the head"],
    ["health_fits", /do not sponge or bath/, "a child's fit with fever: no sponging"],
    ["health_electric", /at least 10 metres/, "the distance from a fallen power line"],
    ["health_electric", /30 minutes after the last thunder/, "shelter after thunder"],
    ["health_afterbirth", /act within the first minute/, "a baby not breathing: the first minute"],
    ["health_afterbirth", /do not press on the womb to bring it/, "the womb is not pressed to bring the afterbirth"],
    ["health_afterbirth", /soaked in less than 5 minutes/, "heavy bleeding after a birth, measured"],
    ["health_afterbirth", /two and five finger-widths/, "where the cord is tied"],
    ["health_birth", /boiled for 20 minutes/, "the blade boiled 20 minutes"],
    ["health_birth", /not flat on her back/, "not flat on her back in labour"],
    ["health_pregnancy", /not started within 6 hours/, "waters broken, no labour in 6 hours"],
    ["health_pregnancy", /more than 12 hours/, "labour over 12 hours"],
    ["health_latrine", /Never dig alone/, "nobody digs a pit alone"],
    ["health_waterstore", /15 litres a day/, "15 litres a person a day"],
    ["health_food", /Never seal moist meat, fish or vegetables airtight/, "the botulism warning"],
    ["health_food", /cook it before eating/, "dried meat is cooked before eating"],
    ["health_food", /smoke alone does not make food keep/, "smoke alone does not preserve"],
    ["health_food", /under their own brine/, "a ferment kept under its brine"],
    ["health_fever", /Do not sponge or bath a child to cool a fever/, "no sponging for fever"],
    ["health_bites", /Leave the wound open/, "a bite wound is not bound"],
    ["health_bites", /Never cut, suck, ice or tie off a snake bite/, "what is never done to a snake bite"],
    ["health_heatcold", /cool water up to the neck/, "the quickest cooling for heatstroke"],
    ["health_heatcold", /no rubbing, no alcohol/, "hypothermia: no rubbing, no alcohol"],
    ["health_teeth", /milk tooth is not put back/, "a milk tooth is not replanted"],
    ["health_burns", /stop, drop to the ground and roll/, "clothes on fire"],
    ["health_hygiene", /at least 30 m from any well or water source/, "a latrine's distance, in the hygiene lesson too"]
  ];
  var missing = FACTS.filter(function (f) { return !f[1].test(lesson(f[0])); }).map(function (f) { return f[0] + ": " + f[2]; });
  ok("the figures people will act on are in the lessons, as sourced (" + FACTS.length + ")", missing.length === 0, missing);
  // no medicine, no dose: the tile's own rule, and CLAUDE.md's
  var DRUG = /\b(paracetamol|acetaminophen|ibuprofen|aspirin|amoxicillin|penicillin|antibiotics? (dose|tablet)|zinc|chloroquine|artemether|morphine|codeine|adrenaline|epinephrine|oxytocin|misoprostol|chlorhexidine|iodine tablets?)\b/i;
  var DOSE = /\b\d+(\.\d+)?\s?(mg|mcg|micrograms?|milligrams?|tablets?|pills?|capsules?|units)\b/i;
  var dosed = KEYS.filter(function (k) { return DRUG.test(lesson(k)) || DOSE.test(lesson(k)); });
  ok("no health lesson names a medicine or gives a dose", dosed.length === 0, dosed.map(function (k) { return [k, (DRUG.exec(lesson(k)) || DOSE.exec(lesson(k)))[0]]; }));
  var URGENT = ["health_first", "health_cpr", "health_emergency", "health_recovery", "health_bleeding", "health_shock", "health_burns", "health_breaks", "health_head", "health_fits", "health_strokeheart",
    "health_poison", "health_drowning", "health_electric", "health_heatcold", "health_bites", "health_eyes", "health_infection", "health_moving", "health_danger", "health_breathing", "health_diarrhoea",
    "health_ors", "health_fever", "health_malaria", "health_muac", "health_pregnancy", "health_birth", "health_afterbirth", "health_newborn"];
  var unsent = URGENT.filter(function (k) { return !/trained help|health worker|midwife/i.test(lesson(k)); });
  ok("every emergency, sick-child and birth lesson sends the reader to trained help", unsent.length === 0, unsent);
  // the Food tile's preserving lesson said the same things as Health's old one: corrected with it
  var fp = plain(ML.get("food_preserve").html), ff = plain(ML.get("food_ferment").html);
  ok("the Food tile's preserving lesson: no oil over cooked food, no air to keep out, meat salted and cooked, the botulism warning",
    !/oil \(covering cooked food\)/.test(fp) && !/water, warmth and air/.test(fp) && /salted first/.test(fp) && /cooked before eating/.test(fp) && /botulism/.test(fp) &&
    /smoke alone does not make food keep/.test(fp) && /That was wrong/.test(fp) && /3 tablespoons to 2 kg/.test(ff), fp.slice(0, 400));
  ok("...and Health's own says it was wrong before", /Before version 1\.24\.4 this lesson said/.test(lesson("health_food")));
  ok("both spellings of diarrhoea find the lesson", /Diarrhoea \(diarrhea\)/.test(ML.get("health_diarrhoea").title));
  // advice the check against the 2025 guidelines took out
  var OUT = [["health_bleeding", /Raise the injured part/], ["health_cpr", /two fingers/], ["health_emergency", /two fingers/], ["health_head", /Wake them every few hours/], ["health_fits", /take off warm clothes/],
    ["health_afterbirth", /within half an hour/], ["health_strokeheart", /head and shoulders a little raised/], ["health_fever", /lukewarm sponge/], ["health_food", /or the air/],
    ["health_food", /dry in sun or airflow until brittle \(fruit, beans, fish, meat\)/], ["health_bites", /then cover/], ["health_bites", /below the heart/], ["health_infection", /warm clean-water soaks/]];
  var back = OUT.filter(function (x) { return x[1].test(lesson(x[0])); }).map(function (x) { return x[0] + ": " + x[1]; });
  ok("advice that current guidance has dropped stays out (raising a bleeding limb, two fingers on a baby, waking after a head injury, sponging a fever, sun-dried meat as it was, a covered bite ...)", back.length === 0 && !/raise the limb/.test(plain(ws.ownerDocument.body.innerHTML)), back);

  // --- the counter -------------------------------------------------------------------------------------
  var HC = L.healthCount, J = HC.judge;
  ok("fast breathing by age: the limit itself is fast, one under is not",
    J("breaths", "u2m", 60).fast && !J("breaths", "u2m", 59).fast && J("breaths", "2-12m", 50).fast && !J("breaths", "2-12m", 49).fast && J("breaths", "1-5y", 40).fast && !J("breaths", "1-5y", 39).fast);
  ok("...what it says: the limit, and what to do", /56 breaths a minute/.test(J("breaths", "2-12m", 56).text) && /50 or more is fast breathing/.test(J("breaths", "2-12m", 56).text) && /needs a health worker/.test(J("breaths", "2-12m", 56).text) &&
    /Count once more/.test(J("breaths", "u2m", 64).text) && /not fast breathing/.test(J("breaths", "1-5y", 30).text) && /Other danger signs still count/.test(J("breaths", "1-5y", 30).text), J("breaths", "2-12m", 56).text);
  ok("...an adult: 12 to 20 is usual, and no limit is made up", J("breaths", "older", 16).usual && !J("breaths", "older", 28).usual && J("breaths", "older", 28).fast === undefined && /12 to 20/.test(J("breaths", "older", 28).text));
  ok("pulse by age", J("pulse", "10+", 72).usual && J("pulse", "10+", 130).high && J("pulse", "10+", 44).low && J("pulse", "1-2", 125).usual && J("pulse", "u1", 170).high && J("pulse", "u1m", 170).usual && /60 to 100/.test(J("pulse", "10+", 72).text) && /warns of shock/.test(J("pulse", "10+", 130).text));
  ok("...no count, no words", J("breaths", "u2m", 0).text === "" && J("pulse", "10+", "x").text === "");
  var cbox = ws.querySelector(".health-tool[data-tool='count']");
  var cbtn = all(cbox, "button"), sel = all(cbox, "select");
  ok("the counter is in the tile: what to count, the age, start, tap, stop, or type a count", !!cbox && sel.length === 2 && cbtn.map(function (b) { return b.textContent; }).join("|") === "Start one minute|Tap at each breath|Stop|What does it mean?",
    cbtn.map(function (b) { return b.textContent; }));
  HC.seconds = 0.5;
  sel[1].value = "2-12m";
  cbtn[0].click();
  for (var i = 0; i < 7; i++) { cbtn[1].click(); await sleep(20); }
  await sleep(700);
  var cout = cbox.querySelector(".physresult").textContent;
  ok("...taps over the minute are counted and judged when it ends", /^7 breaths a minute/.test(cout) && /not fast breathing/.test(cout) && cbtn[1].style.display === "none" && cbtn[0].style.display === "", cout);
  cbtn[0].click(); cbtn[1].click(); cbtn[2].click();
  ok("...stopped early: nothing is counted, and it says a full minute is needed", /full minute is needed/.test(cbox.textContent) && cbox.querySelector(".physresult").textContent === "", cbox.querySelector(".physresult").textContent);
  HC.seconds = 60;
  cbox.querySelector("input[type='number']").value = "56";
  cbtn[3].click();
  ok("...a count typed in is judged the same way", /^56 breaths a minute/.test(cbox.querySelector(".physresult").textContent) && /needs a health worker/.test(cbox.querySelector(".physresult").textContent));
  sel[0].value = "pulse"; sel[0].dispatchEvent(new w.Event("change"));
  ok("...pulse: its own ages, and the tap button says beat", all(sel[1], "option").length === 7 && cbtn[1].textContent === "Tap at each beat");

  // --- bleach for water ----------------------------------------------------------------------------------
  var Bl = L.healthBleach;
  ok("bleach: 2 drops a litre, 4 if cloudy", Bl(1).drops === 2 && Bl(1, true).drops === 4 && Bl(20).drops === 40 && Bl(20, true).drops === 80 && Bl(0.5).drops === 1 && Bl(0.75).drops === 2);
  ok("...the CDC table's own rows: 5 US gallons (about 20 L) is 40 drops, 2.5 ml, half a teaspoon; of 1% bleach 200 drops, 12.5 ml, 2.5 teaspoons",
    /40 drops \(about 2\.5 ml, half a teaspoon\) of plain bleach labelled 5% to 9%/.test(Bl(20).text) && /200 drops \(about 12\.5 ml, 2\.5 teaspoons\) of plain bleach labelled 1%/.test(Bl(20, false, "1").text) &&
    Bl(1, false, "1").drops === 10 && Bl(1, true, "1").drops === 20, [Bl(20).text, Bl(20, false, "1").text]);
  ok("...a drum: 400 drops, about 25 ml, 5 teaspoons; a few litres: drops only", /400 drops \(about 25 ml, 5 teaspoons\)/.test(Bl(200).text) && !/\(/.test(Bl(5).text), [Bl(200).text, Bl(5).text]);
  ok("...it always says which bleach and how long to wait", /labelled 5% to 9%/.test(Bl(3).text) && /wait 30 minutes/.test(Bl(3).text) && !Bl(0).ok && !Bl("").ok);
  var bbox = ws.querySelector(".health-tool[data-tool='bleach']");
  ok("...in the tile, answering as it opens", !!bbox && /^For 20 L of clear water: 40 drops/.test(bbox.querySelector(".physresult").textContent) && /less than a year old/.test(bbox.textContent) && /wait 15 more minutes/.test(bbox.textContent) &&
    /does not kill every parasite/.test(bbox.textContent));
  var bst = bbox.querySelector("select"); bst.value = "1"; bst.dispatchEvent(new w.Event("change"));
  ok("...the strength on the label can be chosen: 1% bleach, five times the drops", /200 drops/.test(bbox.querySelector(".physresult").textContent) && /labelled 1%/.test(bbox.querySelector(".physresult").textContent));

  // --- Print on every lesson ---------------------------------------------------------------------------
  ML.open("health_cpr");
  var ov = d.querySelector(".lesson-overlay"), pb = ov.querySelector(".guide-head button");
  pb.click();
  ok("Print: the lesson is marked for the printer and the print dialog opens", w.printed === 1 && d.body.classList.contains("lesson-printing") && ov.classList.contains("lesson-print"));
  w.dispatchEvent(new w.Event("afterprint"));
  ok("...and unmarked afterwards", !d.body.classList.contains("lesson-printing") && !ov.classList.contains("lesson-print"));
  all(ov, ".guide-head button").pop().click();
  ML.open("farm_soil"); ML.open("ratio_intro");
  var anyLesson = d.querySelector(".lesson-overlay");
  ok("...a lesson of any tile has it", !!anyLesson && /Print/.test(anyLesson.querySelector(".guide-head").textContent));
  all(d, ".lesson-overlay").forEach(function (x) { all(x, ".guide-head button").pop().click(); });

  // --- Chat: the Health lesson for a health need ---------------------------------------------------------
  var WANT = [
    ["My son is choking on a piece of meat and cannot breathe!", "health_emergency"],
    ["He is not breathing", "health_cpr"],
    ["How do I do CPR?", "health_cpr"],
    ["She collapsed and is unconscious but still breathing", "health_recovery"],
    ["My brother is having a fit and shaking on the floor. What should I do?", "health_fits"],
    ["Someone is having a seizure", "health_fits"],
    ["My baby is 8 months old, has a cough and is breathing 56 times a minute. Is that too fast?", "health_breathing"],
    ["She has had diarrhoea for two days", "health_diarrhoea"],
    ["My child has diarrhea and is very weak", "health_diarrhoea"],
    ["How do I make river water safe to drink?", "health_water"],
    ["I cut my hand and it is bleeding badly", "health_bleeding"],
    ["How do I stop bleeding?", "health_bleeding"],
    ["He fell and hit his head and now he is vomiting", "health_head"],
    ["My wife is in labour and the midwife cannot come", "health_birth"],
    ["The baby has just been born. What do I do now?", "health_afterbirth"],
    ["How do I build a latrine?", "health_latrine"],
    ["My father had a stroke", "health_strokeheart"],
    ["He has chest pain going down his arm", "health_strokeheart"],
    ["My friend swallowed kerosene", "health_poison"],
    ["A child fell in the pond and drowned, we pulled him out", "health_drowning"],
    ["I burned my hand on the stove", "health_burns"],
    ["He got an electric shock from a wire", "health_electric"],
    ["Grandmother has a fever and is confused", "health_fever"],
    ["She was bitten by a snake", "health_bites"],
    ["How do I check someone's pulse?", "health_vitals"],
    ["Is my child too thin?", "health_muac"],
    ["How do I care for a newborn baby?", "health_newborn"],
    ["How do I prevent malaria?", "health_malaria"],
    ["My husband is pale, cold and sweaty after losing a lot of blood", "health_shock"],
    ["How do we carry an injured person?", "health_moving"],
    ["My nose is bleeding", "health_eyes"],
    ["She is pregnant and bleeding", "health_pregnancy"],
    ["How do I look after someone who is sick in bed?", "health_homecare"],
    ["My neighbour cannot sleep since the flood and cries all day", "health_mind"],
    ["How do we stop the sickness spreading through the village?", "health_spread"]
  ];
  var wrong = WANT.filter(function (x) { var p = L.healthLessons(x[0]); return !p.length || p[0].key !== x[1]; }).map(function (x) { return [x[0], L.healthLessons(x[0]).map(function (p) { return p.key; })]; });
  ok("a health need, said the way people say it, gets the lesson that fits (" + WANT.length + " questions)", wrong.length === 0, wrong);
  var NOT = ["My code is broken", "My engine coughs and dies", "How long will this candle burn?", "What causes malaria?", "Explain the two-stroke engine", "My goat has diarrhoea",
    "I broke my bicycle chain", "My hens have stopped laying eggs. What could be wrong?", "What is the capital of Kenya?", "He fits the description", "I am writing a story about a pale horse",
    "How do I grow tomatoes?", "How would I start a farm and raise goats?", "The pump is choking on mud"];
  var leaked = NOT.filter(function (q) { return L.healthLessons(q).length; });
  ok("...and a question that only shares a word with one does not", leaked.length === 0, leaked);
  ok("the need is a sign or injury in a person: both parts", L.healthNeed("He is choking") && !L.healthNeed("The pump is choking") && !L.healthNeed("He is late") && L.healthNeed("my daughter has a fever"));
  var rec = L.healthLessons("She collapsed and is unconscious but still breathing")[0];
  var steps = (rec.text.match(/•/g) || []).length;
  ok("the lesson is given whole and in order: all six steps of the recovery position", rec.key === "health_recovery" && steps === 6 && rec.text.indexOf("Kneel beside them") < rec.text.indexOf("Bring their far arm") &&
    rec.text.indexOf("Bring their far arm") < rec.text.indexOf("pull on the knee") && /Get trained help/.test(rec.text), [steps, rec.text.slice(0, 200)]);
  // the same rule for every tile's lessons when the AI asks for one (LESSON:): a list whole or not at all
  var partly = [];
  S.entries().filter(function (e) { return e.kind === "lesson"; }).forEach(function (e) {
    var p = S.passages("how do I " + e.title, e.title, { detail: true, max: 1 })[0];
    if (!p || p.key !== e.id) return;
    var allItems = e.text.filter(function (u) { return /^\u2022 /.test(u.t); }).length, gotItems = (p.text.match(/^\u2022 /gm) || []).length;
    if (gotItems > 0 && gotItems < allItems) partly.push(e.id + " " + gotItems + "/" + allItems);
  });
  ok("no lesson of any tile is handed to the AI with part of a list (17 were: the recovery position as steps 1, 2 and 6)", partly.length === 0, partly);
  var viaLesson = S.passages("How do I put someone in the recovery position?", "recovery position", { detail: true, max: 3 })[0];
  ok("...LESSON: recovery position reads all six steps", viaLesson.key === "health_recovery" && (viaLesson.text.match(/^\u2022 /gm) || []).length === 6, viaLesson.text.slice(0, 300));
  ok("...at most two lessons, each a Health one", WANT.every(function (x) { var p = L.healthLessons(x[0]); return p.length <= 2 && p.every(function (y) { return y.app === "health" && y.kind === "lesson"; }); }));
  var CTX = L.chatContext, hp = CTX.filter(function (c) { return c.id === "health-need"; })[0];
  var got = hp.provide("My son is choking on a piece of meat and cannot breathe!");
  ok("Chat's provider: lesson passages, the library left open, the short instruction", got && got.how === "lessons" && got.more === true && got.sources[0].key === "health_emergency" && /^LESSONS: passages/.test(got.prompt) &&
    /Give the steps to do now, in order, and say when to get a health worker/.test(got.prompt) && /QUESTION: My son is choking/.test(got.prompt), got && got.prompt.slice(-300));
  L.textReader.attached = { id: "x", title: "Manual", pages: [{ n: 1, text: "Oil every 500 hours.", done: true }] };
  ok("...a document the person handed over comes first", hp.provide("My son is choking on a piece of meat and cannot breathe!") === null);
  L.textReader.attached = null;
  ok("...a medicine dose still goes to the rule, not to a lesson", /Medicine doses depend/.test((L.ai.guard("How many paracetamol tablets can I give my 2 year old with a fever?") || {}).reply || ""));

  // the same through Chat, with a scripted model that answers from passage 1
  var seen = [];
  function model(msgs) {
    var last = textOf(msgs[msgs.length - 1].content);
    seen.push(last);
    if (/LESSONS: passages/.test(last)) {
      var body = last.split(/\n\[1\] [^\n]*\n/)[1] || "", line = body.split("\n").filter(function (l) { return /[.]$/.test(l) && l.length > 60; })[1] || "";
      var sent = line.split(". ")[0] + ".";
      return Promise.resolve(sent.replace(/\.$/, "") + " [1].\nQUOTE [1]: " + sent);
    }
    return Promise.resolve("ANSWER: Not in my library.");
  }
  function item(id) { return L.aiBenchQuestions.filter(function (q) { return q.id === id; })[0]; }
  var ids = ["health-choking", "health-fit", "health-baby-breathing", "health-river-water"], graded = [];
  for (i = 0; i < ids.length; i++) {
    var it = item(ids[i]), conv = await L.CHAT.converse(it.turns, { call: model }), t = conv.turns[0];
    graded.push([ids[i], t.searches.map(function (s) { return s.how; }).join(), (t.sources || []).map(function (s) { return s.key; }).join(), t.backed, t.final.slice(0, 80)]);
  }
  ok("in Chat each bench conversation is given its lesson before the model answers, and a sentence is backed", graded.every(function (g) { return g[1] === "lessons" && g[3] >= 1; }) &&
    /^health_emergency/.test(graded[0][2]) && /^health_fits/.test(graded[1][2]) && /^health_breathing/.test(graded[2][2]) && /^health_water/.test(graded[3][2]), graded);
  ok("...the model was asked once, with the lesson in front of it", seen.length === 4 && seen.every(function (x) { return /LESSONS: passages/.test(x); }), seen.length);

  // --- the bench's health questions ---------------------------------------------------------------------
  var ch = item("health-choking").check, good = { searches: [{ how: "lessons" }], sources: [{ key: "health_emergency" }], declined: false, backed: 1, final: "Give 5 back blows, then 5 abdominal thrusts [1]." };
  function turn(over) { var r = {}; Object.keys(good).forEach(function (k) { r[k] = good[k]; }); Object.keys(over || {}).forEach(function (k) { r[k] = over[k]; }); return [r]; }
  ok("the choking check passes a backed answer from the lesson", ch(turn()) === "");
  ok("...and names what is wrong otherwise", /did not give the AI/.test(ch(turn({ searches: [] }))) && /was not among the passages/.test(ch(turn({ sources: [{ key: "floorceil" }] }))) &&
    /Not in my library/.test(ch(turn({ declined: true }))) && /no sentence backed/.test(ch(turn({ backed: 0 }))) && /did not say to give back blows/.test(ch(turn({ final: "Take him to a doctor [1]." }))));
  ok("the six health questions are in the bench, four conversations and two sums", ids.every(function (x) { return item(x) && item(x).cat === "chat"; }) && item("ors-five-litres").cat === "tool" && item("bleach-jerrycan").cat === "tool" &&
    L.aiBench.expected(item("ors-five-litres")) === 30 && L.aiBench.expected(item("bleach-jerrycan")) === 40);
  var A = L.assist;
  ok("the recipe cards come up for those sums, first", A.match(item("ors-five-litres").q)[0].id === "ors-sugar" && A.match(item("bleach-jerrycan").q).some(function (c) { return c.id === "water-bleach"; }) &&
    A.match("How much salt for 3 litres of ORS?").some(function (c) { return c.id === "ors-salt"; }), A.match(item("bleach-jerrycan").q).map(function (c) { return c.id; }));
  ok("...and not for salt, sugar or water in general", !A.match("How many moles are in 100 grams of table salt, NaCl?").some(function (c) { return /^ors-|^water-bleach/.test(c.id); }) &&
    !A.match("How long does it take to fill a 200 litre water tank at 5 litres per minute?").some(function (c) { return /^ors-|^water-bleach/.test(c.id); }));
  var g1 = L.aiBench.grade(item("ors-five-litres"), "=6*5\nANSWER: {result} level teaspoons of sugar, and 2.5 of salt.", null);
  var g2 = L.aiBench.grade(item("bleach-jerrycan"), "=2*20\nANSWER: {result} drops; wait 30 minutes.", null);
  ok("the sums as a model would write them from the cards pass", g1.pass && g2.pass, [g1, g2]);
  ok("no page errors", o.errs.length === 0, o.errs);

  // --- rule 11: each new module can be dropped ----------------------------------------------------------
  var o2 = load(["HEALTH_LESSONS_BIRTH", "HEALTH_COUNT", "LESSON_PRINT", "HEALTH_CHAT", "HEALTH_RECIPES", "HEALTH_BENCH_DATA"]), ws2 = mount(o2);
  var heads2 = all(ws2, "h2").map(function (h) { return h.textContent; });
  ok("without the birth lessons the tile has no Mother and baby group; without the counter, none", heads2.indexOf("Mother and baby") < 0 && heads2.indexOf("Breath and pulse counter") < 0 && heads2.indexOf("Bleach for drinking water") > 0 &&
    all(ws2, "button.tile").length === 38, heads2);
  o2.L.mathLessons.open("health_cpr");
  ok("...without LESSON_PRINT a lesson has Close only; without HEALTH_CHAT no provider, and nothing breaks",
    all(o2.d.querySelector(".lesson-overlay"), ".guide-head button").map(function (x) { return x.textContent; }).join() === "Close" &&
    !(o2.L.chatContext || []).some(function (c) { return c.id === "health-need"; }) && !o2.L.healthLessons && !o2.L.aiBenchQuestions.some(function (q) { return /^health-/.test(q.id); }) && o2.errs.length === 0, o2.errs);
  var o3 = load(["HEALTH_LESSONS_FIRST", "HEALTH_LESSONS_SUDDEN", "HEALTH_LESSONS_INJURY", "HEALTH_LESSONS_CHILD", "HEALTH_LESSONS_CARE", "HEALTH_LESSONS_WASH", "HEALTH_BLEACH"]), ws3 = mount(o3);
  ok("without the other new lesson modules the tile shows what is left (the 14 lessons it had, and the 4 of birth)", all(ws3, "button.tile").length === 18 && o3.errs.length === 0 &&
    o3.L.healthLessons("My son is choking on a piece of meat and cannot breathe!")[0].key === "health_emergency", [all(ws3, "button.tile").length, o3.errs]);

  console.log(fails ? fails + " HEALTH FAILURES (" + passes + " passed)" : "ALL HEALTH TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack || e); process.exit(1); });
