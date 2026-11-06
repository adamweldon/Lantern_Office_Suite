// food.js -- the Food tile after its audit (1.24.5).
//  - the tile: three groups, every topic opens a lesson, a topic whose lesson
//    module is not loaded is not shown (rule 11); the preserving table no
//    longer offers "oil covering", and says what each way needs to be safe;
//    the cooking table gives temperatures; the daily-needs sum shows no
//    number for a child;
//  - the lessons: the figures a person will act on are the ones read on the
//    CDC's and the US National Center for Home Food Preservation's pages (a
//    change to one must be a decision, not a slip), and what the audit found
//    wrong is gone;
//  - the help guide (the tile had none);
//  - Chat: a food how-to gets the Food lesson that fits, a procedure whole;
//    the bench's three food conversations and what their checks catch.
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
  w.eval(js);
  return { w: w, L: w.Lantern, d: w.document, errs: errs };
}
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 900)); } }
function plain(html) { return String(html).replace(/<[^>]*>/g, " ").replace(/&frac14;/g, "1/4").replace(/&frac12;/g, "1/2").replace(/&deg;/g, " deg ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " "); }
function all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
function mount(o) { var ws = o.d.createElement("div"); o.d.body.appendChild(ws); o.L.apps.food.mount(ws); return ws; }
function fire(w, el, t) { var e = w.document.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }

var o = load(), w = o.w, L = o.L, d = o.d, ML = L.mathLessons, S = L.suite;
function lesson(k) { var g = ML.get(k); return g ? plain(g.html) : ""; }
var KEYS = ML.list().map(function (l) { return l.key; }).filter(function (k) { return /^food_/.test(k); });
ok("boot clean", o.errs.length === 0, o.errs);

// --- the tile ---------------------------------------------------------------------------------
var ws = mount(o);
var heads = all(ws, "h2").map(function (h) { return h.textContent; });
ok("the tile: three groups of topics, then the sum and the two tables", heads.join("|") === "Eating well|Safe to eat|Keeping food|Daily needs|Daily needs: energy, water, protein|Preserving food|Cook until safe", heads);
var topics = all(ws, "button.tile");
ok("ten topics, each one a lesson that is loaded, and every food lesson is on the tile", topics.length === 10 && KEYS.length === 10, [topics.length, KEYS]);
var opened = 0;
topics.forEach(function (b) {
  b.click();
  var ov = d.querySelector(".overlay, .lesson-overlay, [data-lesson-open]") || d.body.lastChild;
  if (ov && /\S/.test(ov.textContent) && ov !== ws) opened++;
  var x = d.createEvent("Event"); x.initEvent("keydown", true, true); x.key = "Escape"; d.dispatchEvent(x);
});
ok("every topic opens something", opened === 10, opened);
var tables = all(ws, "table.data");
var pres = all(tables[0], "tbody tr").map(function (tr) { return all(tr, "td").map(function (td) { return td.textContent; }); });
ok("the preserving table: seven ways, four columns, and what each needs to be safe", pres.length === 7 && pres.every(function (r) { return r.length === 4 && r[3].length > 10; }) &&
  all(tables[0], "th").map(function (th) { return th.textContent; }).join("|") === "Method|How it works|Good for|To be safe", pres.map(function (r) { return r[0]; }));
ok("...no oil covering, no cheese or herbs kept under oil, no honey as a preservative, no meat simply dried", !/oil cover/i.test(tables[0].textContent) && !/cheese|honey/i.test(tables[0].textContent) &&
  !pres.some(function (r) { return r[0] === "Drying" && /meat|fish|jerky/i.test(r[2]); }), tables[0].textContent.slice(0, 300));
var meat = pres.filter(function (r) { return /meat or fish/.test(r[0]); })[0] || [];
ok("...drying meat has its own row: strips of 6 mm, salted, boiled 5 minutes, two weeks, fish never unsalted", /6 mm/.test(meat[2]) && /salt it/.test(meat[3]) && /boil the strips 5 minutes/.test(meat[3]) &&
  /two weeks/.test(meat[3]) && /never dry fish unsalted/.test(meat[3]) && /not in the open air/.test(meat[3]), meat);
ok("...the ferment row has the salt, and the smoke row says smoke alone does not keep or cook", pres.some(function (r) { return r[0] === "Fermenting" && /3 tablespoons of salt to 2¼ kg/.test(r[3]) && /never less/.test(r[3]) && /never fish or meat/.test(r[3]); }) &&
  pres.some(function (r) { return r[0] === "Smoking" && /smoke alone does not keep food and does not cook it/.test(r[3]); }), pres.map(function (r) { return r[3]; }));
ok("...and the note under it warns of botulism: never shut out the air from moist food", /Never keep moist meat, fish, vegetables, garlic or herbs by shutting out the air/.test(ws.textContent) && /cannot be seen, smelt or tasted/.test(ws.textContent) &&
  !/water, warmth, or air/.test(ws.textContent));
var cook = {};
all(tables[1], "tbody tr").forEach(function (tr) { var c = all(tr, "td"); cook[c[0].textContent] = c[1].textContent; });
ok("the cooking table: 74 for poultry and leftovers, 71 for mince, 63 and a 3-minute rest for whole cuts, 63 for fish", /^74°C/.test(cook["Poultry (chicken, duck, turkey), whole, pieces or minced"]) && /^71°C/.test(cook["Minced beef, pork or lamb"]) &&
  cook["Whole cuts of beef, pork or lamb"] === "63°C, then rest 3 minutes" && /^63°C/.test(cook.Fish) && /^74°C/.test(cook.Leftovers), cook);
ok("...milk from the animal is boiled, sprouts and stews too, eggs firm, pork and game right through", cook["Milk straight from the animal"] === "brought to the boil" && cook["Soups and stews"] === "boiling" &&
  /steaming hot/.test(cook["Sprouted beans and grains"]) && /yolk and white firm/.test(cook.Eggs) && /71°C/.test(cook.Eggs) && /trichina/.test(cook["Pork and wild game"]), cook);
ok("...no sign by colour is offered as the test; the note says colour misleads and what to do with no thermometer", !/juices run clear|no pink/i.test(tables[1].textContent) &&
  /the colour of meat can mislead/.test(ws.textContent) && /boil or stew meat in small pieces/.test(ws.textContent) && /what has stood longer is thrown away, not reheated/.test(ws.textContent) &&
  !/When in doubt, cook longer/.test(ws.textContent));

// --- daily needs ---------------------------------------------------------------------------------
var n = L.foodNeeds(70, 175, 30, "m", 1.55);
ok("foodNeeds: the Mifflin-St Jeor sum for an adult (70 kg, 175 cm, 30, a man, on his feet: 2,556 kcal, 2.45 l, 63 g)",
  n.ok && Math.round(n.kcal) === 2556 && Math.abs(n.waterL - 2.45) < 1e-9 && Math.abs(n.proteinG - 63) < 1e-9 && n.child === false, n);
var nf = L.foodNeeds(60, 160, 40, "f", 1.2);
ok("...a woman at rest (60 kg, 160 cm, 40): 1,487 kcal", nf.ok && Math.round(nf.kcal) === 1487, nf);
ok("...nothing for a missing or impossible figure", !L.foodNeeds("", 170, 30, "m").ok && !L.foodNeeds(70, 0, 30, "m").ok && !L.foodNeeds(70, 170, "x", "m").ok);
ok("...a child is marked, at any age under 18", L.foodNeeds(20, 110, 6, "f", 1.55).child === true && L.foodNeeds(60, 170, 17.9, "m", 1.55).child === true && L.foodNeeds(60, 170, 18, "m", 1.55).child === false);
var card = all(ws, ".convbox").filter(function (c) { return /Daily needs/.test(c.textContent); })[0], ins = all(card, "input");
function setNeeds(a, b, c) { ins[0].value = a; ins[1].value = b; ins[2].value = c; fire(w, ins[0], "input"); }
setNeeds("70", "175", "30");
ok("the card: an adult gets energy, water and protein", /kcal\/day/.test(card.textContent) && /litres\/day/.test(card.textContent) && /g\/day/.test(card.textContent), card.textContent.slice(-300));
setNeeds("8", "70", "0.7");
ok("...a baby gets no number: the sum is for adults, breast milk alone for about six months, and where to read", !/kcal\/day|litres\/day|g\/day/.test(card.textContent) && /This sum is for adults/.test(card.textContent) &&
  /only breast milk for about the first six months/.test(card.textContent) && !!card.querySelector("[data-lesson=food_children]"), card.textContent.slice(-300));
setNeeds("", "", "");
ok("...and asks for the figures when they are missing", /Fill weight, height and age/.test(card.textContent));

// --- the lessons: the figures read on the sources' pages ----------------------------------------------
var PINS = [
  ["food_cook", /A food thermometer is the only sure test/, "the thermometer is the test"], ["food_cook", /colour of meat and its juices can mislead/, "colour misleads"],
  ["food_cook", /Poultry \(chicken, duck, turkey\), whole, in pieces or minced: 74 deg C/, "poultry 74"], ["food_cook", /Minced beef, pork or lamb: 71 deg C/, "mince 71"],
  ["food_cook", /Whole cuts of beef, pork or lamb: 63 deg C, then left to rest for 3 minutes/, "whole cuts 63 and 3 minutes"], ["food_cook", /Fish: 63 deg C, or until the flesh is opaque and separates easily with a fork/, "fish"],
  ["food_cook", /Leftovers: 74 deg C/, "leftovers 74"], ["food_cook", /a dish made with eggs, 71 deg C/, "egg dishes 71"],
  ["food_cook", /between 4 and 60 deg C/, "4 to 60"], ["food_cook", /more than 2 hours - 1 hour when it is hotter than 32 deg C/, "2 hours, 1 hour above 32"],
  ["food_cook", /thrown away, not reheated/, "stood too long: thrown away"], ["food_cook", /Never taste food to find out whether it is safe/, "never taste to test"],
  ["food_cook", /wash your hands with soap for 20 seconds/, "hands 20 seconds"], ["food_cook", /trichina/, "pork and game"],
  ["food_cook", /boil or stew it - boiling water is hotter than every figure above/, "no thermometer: boil"], ["food_cook", /and then cook it longer/, "signs by eye: then longer"],
  ["food_milk", /bring the milk to the boil/, "boil milk"], ["food_milk", /Clean milking lowers the risk but cannot remove it/, "clean milking is not enough"],
  ["food_milk", /Children under 5, people over 65, pregnant women/, "who is harmed most"], ["food_milk", /not given as a drink to a baby under 12 months/, "no cow’s milk drink under 12 months"],
  ["food_milk", /until both the yolk and the white are firm/, "eggs firm"], ["food_milk", /\(71 deg C\)/, "egg dishes 71"],
  ["food_safe", /at least 20 seconds/, "hands 20 seconds"], ["food_safe", /between 4 and 60 deg C/, "4 to 60"], ["food_safe", /2 hours - 1 hour when it is hotter than 32 deg C/, "2 hours, 1 hour above 32"],
  ["food_safe", /unsafe food can also look and smell normal/, "looks and smells normal"], ["food_safe", /never taste food to find out whether it is safe/, "never taste"],
  ["food_safe", /rolling boil for 1 minute; 3 minutes above about 1,500 m/, "boiling water, as Health has it"],
  ["food_preserve", /about 30 deg C or more/, "sun drying 30 C"], ["food_preserve", /advises against drying meat or vegetables in the open air/, "meat not in the open air"],
  ["food_preserve", /no thicker than 6 mm/, "6 mm"], ["food_preserve", /boiled for 5 minutes/, "boiled 5 minutes"], ["food_preserve", /within about two weeks/, "two weeks"],
  ["food_preserve", /never dried unsalted/, "fish salted"], ["food_preserve", /trichina/, "pork and game"], ["food_preserve", /smoke alone does not make food keep, and does not cook it/, "smoke"],
  ["food_preserve", /use the full amount/, "jam: full sugar"], ["food_preserve", /thrown away whole/, "mouldy jar"],
  ["food_preserve", /double or blurred vision, drooping eyelids, slurred speech, trouble swallowing or weak muscles mean get trained help at once/, "botulism is an emergency"],
  ["food_preserve", /low in salt, sugar and acid/, "where botulism grows"], ["food_preserve", /about a year in a cool place, half as long in a warm one/, "how long dried fruit keeps"],
  ["food_preserve", /That was wrong/, "the correction note of 1.24.4"],
  ["food_ferment", /For every 2 ?1\/4 kg \(5 lb\) mix in 3 tablespoons of salt - never less/, "the salt"], ["food_ferment", /1 ?1\/2 tablespoons of salt to a quart/, "the brine to add"],
  ["food_ferment", /3 to 4 weeks at 21 to 24 deg C , or 5 to 6 weeks at 16 to 18 deg C/, "weeks and temperatures"], ["food_ferment", /Colder than that it may not ferment; hotter, it may go soft/, "too cold, too hot"],
  ["food_ferment", /a good smell is not proof/, "smell is not proof"], ["food_ferment", /Never ferment fish or meat like this/, "vegetables only"], ["food_ferment", /boil the milk first/, "yoghurt from boiled milk"],
  ["food_children", /For about the first six months, breast milk alone/, "six months of breast milk"], ["food_children", /At about six months \(not before four\)/, "when other foods begin"],
  ["food_children", /to two years or beyond/, "breastfeeding goes on"], ["food_children", /Begin with 1 or 2 tablespoons/, "how much at first"],
  ["food_children", /every 2 to 3 hours - about 3 meals and 2 to 3 snacks a day/, "how often"], ["food_children", /one new food at a time , 3 to 5 days apart/, "one food at a time"],
  ["food_children", /Not before 12 months: honey \(it can give a baby botulism\), cow’s milk as a drink \(yoghurt may be given sooner\), and fruit juice/, "not before 12 months"],
  ["food_children", /120 to 240 ml/, "water from 6 to 12 months"], ["food_children", /no tea or coffee before 2 years/, "no caffeine under 2"], ["food_children", /cut small round foods/, "choking"],
  ["food_children", /cannot be breastfed needs trained advice at once/, "no breast milk: trained advice"],
  ["food_micro", /Too little gives children rickets/, "vitamin D"], ["food_micro", /Folate/, "folate"], ["food_micro", /Zinc/, "zinc"], ["food_micro", /more likely to go blind, and to die of measles or diarrhoea/, "vitamin A"],
  ["food_micro", /cook them until steaming hot/, "sprouts cooked"], ["food_balance", /taken up less easily than the iron in meat/, "iron from plants"],
  ["food_thrift", /cooked food is eaten within 2 hours, not kept for tomorrow/, "no batch cooking without a fridge"]
];
var missed = PINS.filter(function (p) { return !p[1].test(lesson(p[0])); }).map(function (p) { return p[0] + ": " + p[2]; });
ok("the lessons say what the sources say (" + PINS.length + " figures and instructions)", missed.length === 0, missed);
// what the audit found wrong
var GONE = [["food_ferment", /trust your senses/], ["food_ferment", /3 tablespoons to 2 kg/], ["food_ferment", /days to weeks in a cool place/], ["food_balance", /as good as meat/],
  ["food_thrift", /Cook in batches/], ["food_thrift", /peelings for stock/], ["food_micro", /Fermented and sprouted foods can add vitamins too/], ["food_micro", /variety is the cure/],
  ["food_preserve", /keeps for months/], ["food_preserve", /dried hard in dry weather/], ["food_children", /causes most child malnutrition/], ["food_safe", /germs double fast in the heat/]];
var still = GONE.filter(function (p) { return p[1].test(lesson(p[0])); }).map(function (p) { return p[0] + ": " + p[1]; });
ok("what the check found wrong or unsupported is gone (" + GONE.length + ")", still.length === 0, still);
var allFood = KEYS.map(lesson).join(" ") + " " + ws.textContent;
ok("no lesson and no table offers oil, or a sealed jar, as a way to keep moist food", !/cover(ed|ing)? (it |them |cooked \w+ )?(with|in|under) oil/i.test(allFood.replace(/Never keep[^.]*\./g, "").replace(/\(Before version[^)]*\)/g, "")) && !/oil covering/i.test(allFood));
ok("Health’s own lesson on keeping food agrees: dried meat cooked before eating, and eaten within about two weeks", /cook it before eating\. Eat it within about two weeks/.test(plain(ML.get("health_food").html)));

// --- the help guide ---------------------------------------------------------------------------------
var G = L.guide.get("food");
ok("the Food tile has a help guide: what is here, the sum, the tables, printing, asking the AI", G && G.sections.length === 5 && /three groups/.test(G.sections[0][1]) && /milk and eggs/.test(G.sections[0][1]) &&
  /For a child it shows no number/.test(G.sections[1][1]) && /Print/.test(G.sections[3][1]), G && G.sections.map(function (s) { return s[0]; }));
ok("...and it names no lesson that is not there", !/cassava|kidney beans|storing grain|porridge|less fuel|yoghurt/i.test(G.sections.map(function (s) { return s[1]; }).join(" ")));

// --- Chat: the lesson for a food how-to -----------------------------------------------------------------
function keys(q) { return S.passages(q, q, { detail: true, max: 3, strong: true }).map(function (p) { return p.key; }); }
function first(q) { return S.passages(q, q, { detail: true, max: 3, strong: true })[0] || { text: "", key: "" }; }
var kraut = first("How do I make sauerkraut, and how much salt does it need?");
ok("sauerkraut: the Fermenting lesson, every step of the procedure (salt, packing, the weight, the weeks, keeping it)", kraut.key === "food_ferment" && /3 tablespoons of salt/.test(kraut.text) &&
  /Pack it down firmly/.test(kraut.text) && /a plate and a weight/.test(kraut.text) && /3 to 4 weeks at 21 to 24/.test(kraut.text) && /as cold as you can/.test(kraut.text) && /a good smell is not proof/.test(kraut.text), kraut.text);
var chk = first("How do I know when chicken is cooked enough to be safe to eat?");
ok("chicken: Cooking food so it is safe, with the whole list of temperatures", chk.key === "food_cook" && /74 °C/.test(chk.text) && /71 °C/.test(chk.text) && /63 °C, then left to rest for 3 minutes/.test(chk.text), chk.text);
var oil = first("How can I keep cooked vegetables under oil in a jar without a fridge?");
ok("vegetables under oil: the preserving lesson, with its Never", oil.key === "food_preserve" && /Never keep moist food by shutting out the air/.test(oil.text) && /botulism/.test(oil.text), oil.text.slice(0, 300));
ok("milk, a baby’s food, dried meat: each finds its lesson", keys("How do I pasteurise milk?")[0] === "food_milk" && keys("What should I feed my baby of seven months?")[0] === "food_children" &&
  keys("How do I dry meat to keep it?").indexOf("food_preserve") >= 0, [keys("How do I pasteurise milk?"), keys("What should I feed my baby of seven months?"), keys("How do I dry meat to keep it?")]);

// --- the bench's food conversations ------------------------------------------------------------------------
var FQ = L.aiBenchQuestions.filter(function (q) { return /^food-/.test(q.id); });
function turn(key, final, more) { var t = { final: final, searches: [{ how: "lessons" }], sources: [{ key: key }], backed: 1, declined: false }; for (var k in (more || {})) t[k] = more[k]; return [t]; }
function check(id) { return FQ.filter(function (q) { return q.id === id; })[0].check; }
ok("three food conversations in the bench, each a how-to Chat reads a lesson for", FQ.length === 3 && FQ.every(function (q) { return q.cat === "chat" && S.chat.howTo(q.turns[0]) && keys(q.turns[0]).length; }), FQ.map(function (q) { return q.id; }));
ok("sauerkraut: passes with the salt, fails without it, without the lesson, or declined", check("food-sauerkraut")(turn("food_ferment", "Mix in 3 tablespoons of salt for every 2¼ kg [1].")) === "" &&
  /did not say 3 tablespoons/.test(check("food-sauerkraut")(turn("food_ferment", "Add a good handful of salt [1]."))) &&
  /was not among the passages/.test(check("food-sauerkraut")(turn("food_preserve", "Mix in 3 tablespoons of salt."))) &&
  /Not in my library/.test(check("food-sauerkraut")(turn("food_ferment", "3 tablespoons of salt", { declined: true }))) &&
  /no sentence backed/.test(check("food-sauerkraut")(turn("food_ferment", "3 tablespoons of salt", { backed: 0 }))));
ok("chicken: passes with the thermometer or 74, fails on “until the juices run clear” alone", check("food-chicken-done")(turn("food_cook", "Use a food thermometer: 74 °C in the thickest part [1].")) === "" &&
  /did not say the thermometer/.test(check("food-chicken-done")(turn("food_cook", "Cook it until the juices run clear [1]."))));
ok("under oil: passes when told it must not be done, fails on a method", check("food-under-oil")(turn("food_preserve", "Never keep cooked vegetables under oil: botulism grows there [1].")) === "" &&
  /did not say that it must not be done/.test(check("food-under-oil")(turn("food_preserve", "Pack the vegetables in a clean jar and cover them fully with oil [1]."))));

// --- without the new lessons (rule 11) ------------------------------------------------------------------------
var o2 = load(["FOOD_LESSONS_SAFE", "GUIDE_FOOD", "FOOD_BENCH_DATA"]), ws2 = mount(o2);
ok("without FOOD_LESSONS_SAFE, the guide and the bench questions: boot clean, eight topics, no dead button, the tables still there",
  o2.errs.length === 0 && all(ws2, "button.tile").length === 8 && !/Cooking so it is safe|Milk & eggs/.test(all(ws2, "button.tile").map(function (b) { return b.textContent; }).join("|")) &&
  all(ws2, "table.data").length === 2 && !o2.L.aiBenchQuestions.some(function (q) { return /^food-/.test(q.id); }), [o2.errs, all(ws2, "button.tile").length]);

console.log(fails ? fails + " FOOD FAILURES (" + passes + " passed)" : "ALL FOOD TESTS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
