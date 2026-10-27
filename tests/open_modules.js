// open_modules.js -- the open modules of 1.14.0, which close the gaps to the
// offline servers (Project NOMAD, Internet-in-a-Box, RACHEL):
//  - Shelves: more free Kiwix books in the library (WikiMed, iFixit,
//    Wikivoyage, PhET ...); a question reads the shelf it is about, and a
//    question about something else does not search it; the bench asks a
//    shelf's questions only when the kit has it, and the answer must cite it;
//  - Places: Natural Earth towns in the file (public domain), GeoNames in
//    places.txt (CC BY 4.0) -- find, distance, bearing, which
//    Paris; every town of 1,000 and up when places.txt is served; the card in
//    Geography; the AI writes =DISTKM(...) and Lantern works it out;
//  - Codes: Morse, the radio alphabet, base64, hex, ROT13/Caesar, SHA-256,
//    CRC-32, checked against published values.
// A stand-in kiwix-serve on :8081 with five books, and a scripted model.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var inner = fs.readFileSync(process.argv[2] || path.join(ROOT, "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var PLACES_TXT = fs.readFileSync(path.join(ROOT, "site", "places.txt"), "utf8");
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };

// --- the stand-in library: five books, one article each that matters -------
var BOOKS = [
  { id: "wikipedia_en_all_mini_2026-09", name: "wikipedia_en_all", flavour: "mini", title: "Wikipedia" },
  { id: "wikipedia_en_medicine_nopic_2026-04", name: "wikipedia_en_medicine", flavour: "nopic", title: "WikiMed Medical Encyclopedia" },
  { id: "ifixit_en_all_2026-02", name: "ifixit_en_all", flavour: "", title: "iFixit" },
  { id: "wikivoyage_en_all_nopic_2026-07", name: "wikivoyage_en_all", flavour: "nopic", title: "Wikivoyage" },
  { id: "phet_en_all_2026-01", name: "phet_en_all", flavour: "", title: "PhET Interactive Simulations" }
];
function article(title, text) { return { title: title, text: text, html: "<html><body><h1>" + title + "</h1><p>" + text + "</p></body></html>" }; }
var ART = {
  "wikipedia_en_medicine_nopic_2026-04": { "Snakebite": article("Snakebite", "Snakebite first aid is to keep the person still and calm and take them to a hospital, where antivenom can be given. A snake bite on a limb is kept still below the heart.") },
  "wikipedia_en_all_mini_2026-09": { "Snake": article("Snake", "Snakes are elongated limbless reptiles. Some snakes are venomous and a bite can need antivenom."),
    "Mars": article("Mars", "Mars is the fourth planet from the Sun. Its escape velocity is about 5 km/s.") },
  "ifixit_en_all_2026-02": { "iPhone_8_Battery_Replacement": article("iPhone 8 Battery Replacement", "Remove the two pentalobe screws, open the display with a suction cup, disconnect the battery and pull the adhesive strips to lift the old battery out.") },
  "wikivoyage_en_all_nopic_2026-07": { "Nairobi": article("Nairobi", "Nairobi is the capital of Kenya. Visitors get around by matatu minibuses, taxis and ride-hailing apps.") },
  "phet_en_all_2026-01": { "Projectile_Motion": article("Projectile Motion", "A simulation of a cannon firing a projectile.") }
};
var searched = [];
function resp(status, body, type) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return type; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
var modelReplies = [], modelCalls = [], servePlaces = false;
function textOf(c) { return typeof c === "string" ? c : (c || []).filter(function (x) { return x.type === "text"; }).map(function (x) { return x.text; }).join("\n"); }
w.fetch = function (url, opts) {
  url = String(url);
  var u = new w.URL(url, "http://127.0.0.1:8080/");
  if (u.port === "8081") {
    if (u.pathname === "/catalog/v2/entries") {
      return resp(200, "<?xml version=\"1.0\"?><feed>" + BOOKS.map(function (b) {
        return "<entry><title>" + b.title + "</title><language>eng</language><name>" + b.name + "</name>" + (b.flavour ? "<flavour>" + b.flavour + "</flavour>" : "") +
          "<tags>_ftindex:yes</tags><articleCount>1000</articleCount><link type=\"text/html\" href=\"/content/" + b.id + "\" /></entry>";
      }).join("") + "</feed>", "application/atom+xml");
    }
    if (u.pathname === "/search") {
      var bn = u.searchParams.get("books.name"), words = (u.searchParams.get("pattern") || "").toLowerCase().split(/\s+/).filter(Boolean), A = ART[bn] || {};
      searched.push(bn);
      var items = Object.keys(A).filter(function (k) { var t = (A[k].title + " " + A[k].text).toLowerCase(); return words.every(function (wd) { return t.indexOf(wd) >= 0; }); })
        .map(function (k) { return "<item><title>" + esc(A[k].title) + "</title><link>/content/" + bn + "/" + k + "</link><description>" + esc(A[k].text.slice(0, 100)) + "</description></item>"; }).join("");
      return resp(200, "<?xml version=\"1.0\"?><rss><channel>" + items + "</channel></rss>", "application/rss+xml");
    }
    if (u.pathname === "/suggest") {
      var sb = u.searchParams.get("content"), term = (u.searchParams.get("term") || "").toLowerCase(), S = ART[sb] || {};
      return resp(200, JSON.stringify(Object.keys(S).filter(function (k) { return S[k].title.toLowerCase() === term; })
        .map(function (k) { return { value: S[k].title, kind: "path", path: k }; })), "application/json");
    }
    var m = /^\/raw\/([^\/]+)\/content\/(.+)$/.exec(u.pathname);
    if (m && ART[m[1]] && ART[m[1]][m[2]]) return resp(200, ART[m[1]][m[2]].html, "text/html");
    return resp(404, "not found", "text/html");
  }
  if (/places\.txt$/.test(u.pathname)) return servePlaces === "slow" ? sleep(40).then(function () { return resp(200, PLACES_TXT, "text/plain"); }) :
    servePlaces ? resp(200, PLACES_TXT, "text/plain") : resp(404, "nf", "text/plain");
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "scripted" }] }), "application/json");
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false } }), "application/json");
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var r = modelReplies.length ? modelReplies.shift() : "ANSWER: Not in my library.";
  if (typeof r === "function") r = r(body);
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 10 } }), "application/json");
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 800)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(80);
  var L = w.Lantern, A = L.assist, LIB = L.library, B = L.aiBench;
  ok("boot clean", errs.length === 0, errs);
  function ev(x) { var r = A.run("=" + x); return r.steps[0].ok ? r.steps[0].value : "ERR " + r.steps[0].err; }
  function item(id) { return L.aiBenchQuestions.filter(function (x) { return x.id === id; })[0]; }

  // === Codes ==================================================================
  ok("SHA-256 against the published values", ev("SHA256(\x22abc\x22)") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" &&
    ev("SHA256(\x22\x22)") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" &&
    L.codes.sha256(new Array(1001).join("a")) === "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  ok("CRC-32 of the quick brown fox is 414fa339", ev("CRC32(\x22The quick brown fox jumps over the lazy dog\x22)") === "414fa339");
  ok("Morse both ways, words split by /", ev("MORSE(\x22SOS help\x22)") === "... --- ... / .... . .-.. .--." && ev("UNMORSE(\x22... --- ... / .... . .-.. .--.\x22)") === "SOS HELP" &&
    ev("UNMORSE(\x22\u2022\u2022\u2022 \u2013\u2013\u2013 \u2022\u2022\u2022\x22)") === "SOS");
  ok("the radio alphabet, ICAO spellings", ev("NATO(\x22Juliet 9\x22)") === "Juliett Uniform Lima India Echo Tango / Nine" && /Alfa Bravo/.test(ev("NATO(\x22AB\x22)")));
  ok("base64 and hex both ways, with UTF-8", ev("BASE64(\x22Lantern\x22)") === "TGFudGVybg==" && ev("UNBASE64(\x22TGFudGVybg==\x22)") === "Lantern" &&
    ev("UNBASE64(BASE64(\x22S\u00e3o Paulo \u2014 caf\u00e9\x22))") === "S\u00e3o Paulo \u2014 caf\u00e9" && ev("HEX(\x22hi\x22)") === "6869" && ev("UNHEX(\x2268 69\x22)") === "hi");
  ok("ROT13 and Caesar shifts, back again with a negative shift", ev("ROT13(\x22Lantern\x22)") === "Ynagrea" && ev("CAESAR(CAESAR(\x22Attack at dawn\x22,5),-5)") === "Attack at dawn" &&
    ev("CAESAR(\x22xyz\x22,3)") === "abc");
  ok("bad input says what is wrong", /UNHEX needs pairs of hex digits/.test(ev("UNHEX(\x22abc\x22)")) && /not base64/.test(ev("UNBASE64(\x22@@\x22)")));
  ok("the AI is told about them", L.assistCatalog.some(function (c) { return c.n === "MORSE"; }) && L.assistCatalog.some(function (c) { return c.n === "SHA256"; }));

  // === Places =================================================================
  var P = L.places;
  ok("the single file carries Natural Earth's 7,300 towns (public domain, so it stays CC0)", P.count() > 7000 && P.count() < 8000 &&
    /public domain/.test(L.placesData.source) && !/GeoNames|CC BY/.test(L.placesData.rows + L.placesData.countries), P.count());
  ok("capitals: South Africa's three, and not Johannesburg", /; the capital\x29$/.test(ev("PLACE(\x22Pretoria\x22)")) && /; the capital\x29$/.test(ev("PLACE(\x22Cape Town\x22)")) &&
    !/capital/.test(ev("PLACE(\x22Johannesburg\x22)")) && P.country("ZA").capital === "Pretoria / Cape Town / Bloemfontein", ev("PLACE(\x22Johannesburg\x22)"));
  ok("other names: Rangoon is Yangon, Kiev is Kyiv; Washington, D.C.", /^Yangon, Myanmar/.test(ev("PLACE(\x22Rangoon\x22)")) && /^Kyiv, Ukraine/.test(ev("PLACE(\x22Kiev\x22)")) &&
    /^Washington, District of Columbia, United States/.test(ev("PLACE(\x22Washington, D.C.\x22)")) && /^Washington, District/.test(ev("PLACE(\x22Washington, DC\x22)")));
  ok("a region outside the US narrows it too, and is named (La Paz, Baja California Sur; London, Ontario)", /^London, Ontario, Canada/.test(ev("PLACE(\x22London, Ontario\x22)")) && /^La Paz, Baja California Sur, Mexico/.test(ev("PLACE(\x22La Paz, Baja California Sur\x22)")) && /^La Paz, Bolivia/.test(ev("PLACE(\x22La Paz\x22)")));
  ok("countries by their other names: Deutschland, Burma, Ivory Coast", /, Germany/.test(ev("PLACE(\x22Hamburg, Deutschland\x22)")) &&
    /, Myanmar/.test(ev("PLACE(\x22Mandalay, Burma\x22)")) && /C\u00f4te d.Ivoire/.test(ev("PLACE(\x22Abidjan, Ivory Coast\x22)")));
  ok("people counted for the urban area, and said so", /about [\d,]+ people in the urban area; the capital\x29$/.test(ev("PLACE(\x22Nairobi\x22)")), ev("PLACE(\x22Nairobi\x22)"));
  ok("which Paris: the biggest, or the one named with its country", /^Paris, \u00cele-de-France, France \x2848\.8/.test(ev("PLACE(\x22Paris\x22)")) && /^Paris, .*France/.test(ev("PLACE(\x22Paris (France)\x22)")));
  ok("names typed without accents, St. and Saint", /S\u00e3o Paulo, Brazil/.test(ev("PLACE(\x22Sao Paulo\x22)")) && /St\. Louis, Missouri/.test(ev("PLACE(\x22St Louis\x22)")) &&
    /Atlanta, Georgia, United States/.test(ev("PLACE(\x22Atlanta, Georgia\x22)")) && /Tbilisi, Georgia/.test(ev("PLACE(\x22Tbilisi, Georgia\x22)")));
  var dk = ev("DISTKM(\x22Nairobi\x22,\x22Mombasa\x22)"), br = ev("BEARING(\x22Tulsa\x22,\x22Dallas\x22)");
  ok("Nairobi to Mombasa about 440 km; Tulsa to Dallas sets off south-southwest", Math.abs(dk - 442) < 3 && Math.abs(br - 192) < 2 &&
    ev("DIRECTION(\x22Tulsa\x22,\x22Dallas\x22)") === "south-southwest", [dk, br]);
  ok("four numbers work too, and match the place names", Math.abs(ev("DISTKM(LAT(\x22Tulsa\x22),LON(\x22Tulsa\x22),LAT(\x22Dallas\x22),LON(\x22Dallas\x22))") - ev("DISTKM(\x22Tulsa\x22,\x22Dallas\x22)")) < 1e-9 &&
    Math.abs(ev("DISTKM(0,0,0,1)") - 111.19) < 0.01);
  await sleep(5);   // the first place formula asked for places.txt; this kit has none
  ok("a town the list lacks: said, with how to name it", P.more() === "none" && /no \u201cSkiatook\u201d.*every capital, every region capital and the big towns.*every town of 1,000 and up/.test(ev("LAT(\x22Skiatook\x22)")), ev("LAT(\x22Skiatook\x22)"));
  // served by the kit: every town of 1,000 and up
  servePlaces = "slow";
  var pm = P.loadMore(true);
  ok("while places.txt is read, a small town is \u201cask again in a moment\u201d", /still reading its list of every town of 1,000 people and up; ask again/.test(ev("LAT(\x22Skiatook\x22)")), ev("LAT(\x22Skiatook\x22)"));
  var n2 = await pm;
  ok("served: places.txt adds every town of 1,000 and up (Skiatook, Paris, Texas)", n2 > 130000 && /^Skiatook, Oklahoma, United States/.test(ev("PLACE(\x22Skiatook\x22)")) &&
    /^Paris, Texas, United States/.test(ev("PLACE(\x22Paris, TX\x22)")) && /^Paris, Texas/.test(ev("PLACE(\x22Paris, Texas\x22)")) && !/urban area/.test(ev("PLACE(\x22Skiatook\x22)")), [n2, ev("PLACE(\x22Skiatook\x22)")]);
  ok("Skiatook to Tulsa is about 24 km, due south", Math.abs(ev("DISTKM(\x22Skiatook\x22,\x22Tulsa\x22)") - 24) < 1.5 && ev("DIRECTION(\x22Skiatook\x22,\x22Tulsa\x22)") === "south", ev("DISTKM(\x22Skiatook\x22,\x22Tulsa\x22)"));
  // the card in Geography
  w.location.hash = "geography"; fire(w, "hashchange"); await sleep(60);
  var ins = d.querySelectorAll("input[aria-label=\x22From\x22], input[aria-label=\x22To\x22]");
  ok("Geography has a Places & distances card", /Places & distances/.test(d.body.textContent) && ins.length === 2);
  if (ins.length === 2) {
    ins[0].value = "Nairobi"; ins[1].value = "Mombasa"; fire(ins[0], "input"); await sleep(5);
    ok("...that names both towns and gives the distance and the way to go", /Nairobi, Kenya \u2014 1\.283\u00b0 S, 36\.817\u00b0 E/.test(d.body.textContent) && /Mombasa, Kenya/.test(d.body.textContent) &&
      /442 km/.test(d.body.textContent) && /274 miles/.test(d.body.textContent) && /setting off southeast \x28134\u00b0\x29/.test(d.body.textContent) && /135,195 towns from GeoNames \x28CC BY 4\.0, in places\.txt\x29/.test(d.body.textContent), (d.body.textContent.match(/Places & distances[\s\S]{0,300}/) || [""])[0]);
  }
  // the AI: a recipe card, the catalog, and Assist working it out
  ok("the AI's catalog and a recipe card for a distance", L.assistCatalog.some(function (c) { return c.n === "DISTKM" && /straight-line/.test(c.d); }) &&
    A.match("How far is Nairobi from Mombasa?").some(function (c) { return c.id === "place-distance"; }));
  modelReplies = ["=DISTKM(\x22Nairobi\x22,\x22Mombasa\x22)\nANSWER: Nairobi and Mombasa are {result} km apart in a straight line."];
  var res = await A.solve(item("place-distance").q, { call: function () { return Promise.resolve(modelReplies.shift() || "ANSWER: none"); } });
  var g = B.grade(item("place-distance"), res.text, res);
  ok("bench: the distance question passes when the AI writes =DISTKM", g.pass && Math.abs(g.value - 441.6) < 2, g);
  g = B.grade(item("place-bearing"), "=BEARING(\x22Tulsa\x22,\x22Dallas\x22)\nANSWER: Set off on {result} degrees.", {});
  ok("...and the bearing question", g.pass, g);

  // === Shelves =================================================================
  await LIB.detect();
  ok("the library sees five books, and which shelf each is", LIB.ready() && LIB.families().length === 5 &&
    LIB.shelfOf("wikipedia_en_medicine").id === "medicine" && LIB.shelfOf("ifixit_en_all").id === "repair" && LIB.shelfOf("wikipedia_en_all") === null);
  function order(t) { return LIB.order(t).map(function (f) { return f.name; }).join(","); }
  ok("a medicine question reads WikiMed first, then Wikipedia, and nothing else", order("What is the first aid for a snake bite?") === "wikipedia_en_medicine,wikipedia_en_all", order("What is the first aid for a snake bite?"));
  ok("a repair question reads iFixit first", order("How do I replace the battery in an iPhone 8?") === "ifixit_en_all,wikipedia_en_all");
  ok("a travel question reads Wikivoyage first", /^wikivoyage_en_all,/.test(order("What is a good way to get around Nairobi as a visitor?")));
  ok("a general question reads only the encyclopedia", order("What is the escape velocity of Mars?") === "wikipedia_en_all");
  searched = [];
  var lk = await LIB.lookup("What is the first aid for a snake bite?", "snakebite first aid");
  ok("lookup: WikiMed's Snakebite is read first, and iFixit is never searched", lk && lk.sources.length && lk.sources[0].book === "wikipedia_en_medicine_nopic_2026-04" &&
    searched.indexOf("ifixit_en_all_2026-02") < 0 && searched.indexOf("phet_en_all_2026-01") < 0, [lk && lk.sources.map(function (s) { return s.book + "/" + s.title; }), searched]);
  // the bench asks a shelf's questions only when it has the shelf, and they must cite it
  var picked = [];
  var oldRun = A.solve;
  A.solve = function (q) { picked.push(q); return Promise.resolve({ text: "ANSWER: x", parsed: A.parseReply("ANSWER: x"), run: { steps: [], value: null }, flags: [], sources: null, rounds: 1 }); };
  try { await B.run({ quick: false, skip: ["tool", "multi", "need", "unknown", "safety", "make", "chat", "reason", "alone"] }); } catch (e) { }
  A.solve = oldRun;
  var asked = function (id) { return picked.indexOf(item(id).q) >= 0; };
  ok("bench: shelf questions are asked for the shelves the kit has (medicine, repair, travel) and not the others (words)",
    asked("shelf-snakebite") && asked("shelf-iphone-battery") && asked("shelf-nairobi-transport") && !asked("shelf-word-meaning"),
    picked.filter(function (q) { return /snake|iPhone|Nairobi|ubiquitous/.test(q); }));
  var snake = item("shelf-snakebite");
  var fromWiki = { sources: [{ n: 1, book: "wikipedia_en_all_mini_2026-09", title: "Snake", text: "Some snakes are venomous and a bite can need antivenom." }] };
  g = B.grade(snake, "ANSWER: A bite can need antivenom [1].\nQUOTE [1]: Some snakes are venomous and a bite can need antivenom.", fromWiki);
  ok("bench: a shelf question answered from Wikipedia alone does not pass", !g.pass && /did not read the medicine shelf/.test(g.why), g);
  var fromMed = { sources: [{ n: 1, book: "wikipedia_en_medicine_nopic_2026-04", title: "Snakebite", text: ART["wikipedia_en_medicine_nopic_2026-04"].Snakebite.text }] };
  g = B.grade(snake, "ANSWER: Keep the person still and calm and take them to a hospital for antivenom [1].\nQUOTE [1]: Snakebite first aid is to keep the person still and calm and take them to a hospital, where antivenom can be given.", fromMed);
  ok("...and from WikiMed, with its quote checked, it passes", g.pass, g);
  // the Library panel says which questions each shelf serves
  w.location.hash = "ai"; fire(w, "hashchange"); await sleep(60);
  ok("the Library panel says what each shelf is read for", /iFixit .*read for repair guides questions/.test(d.body.textContent) && /WikiMed .*read for medicine questions/.test(d.body.textContent),
    (d.body.textContent.match(/iFixit[^\n]{0,120}/) || [""])[0]);

  // === Sources & licences ======================================================
  w.location.hash = "charter"; fire(w, "hashchange"); await sleep(60);
  var src = d.getElementById("sources"), ct = d.body.textContent;
  ok("the Charter has Sources & licences: the file CC0 and public domain, what is beside it under its own licence", !!src &&
    /Natural Earth 5\.1\.2.*public domain/.test(ct) && /GeoNames.*CC BY 4\.0.*credit line at the top of places\.txt/.test(ct) &&
    /iFixit.*CC BY-NC-SA 3\.0.*NOT for sale/.test(ct) && /kiwix-serve.*GPL 3\.0/.test(ct) && /wllama 3\.8\.1.*MIT/.test(ct));
  ok("...and Lantern.sources says the same for machines; every shelf the library knows has a line", L.sources.length >= 12 &&
    L.sources.filter(function (s) { return s.where === "file"; }).every(function (s) { return /CC0|public domain|free to use/.test(s.licence); }) &&
    LIB.shelves.every(function (sh) { return L.sources.some(function (s) { return s.shelf === sh.id; }); }),
    LIB.shelves.map(function (sh) { return sh.label; }));
  ok("no page errors along the way", errs.length === 0, errs);
  console.log(fails ? "OPEN MODULES FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL OPEN MODULE TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
