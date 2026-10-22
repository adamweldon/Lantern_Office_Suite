// ai_actions.js -- the AI making things in Lantern's apps (AI_ACTIONS,
// AI_DRAW, AI_SHEET, AI_MAKE_BENCH_DATA): MAKE blocks parsed and checked,
// schematic layout and circuit checks, pictures on the grid, tables computed
// by the sheet engine, the Chat flow (one corrected block, preview, Open in
// Draw / Sheets, the person's drawing kept), the look turn when the model
// can see (llama-server /props), and bench grading. Scripted model.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
// A canvas that records drawing calls and hands back a small PNG.
var painted = 0;
w.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; return function () { painted++; }; }, set: function (t, k, v) { t[k] = v; return true; } });
};
w.HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="; };
var vision = false, modelReplies = [], modelCalls = [];
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new TypeError("no library"));
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-4B-Q4_K_M.gguf" }] }));
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: vision, audio: false } }));
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var r = modelReplies.length ? modelReplies.shift() : "ANSWER: ok";
  if (typeof r === "function") r = r(body);
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }));
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function blk(kind, title, lines) { return "MAKE " + kind + ": " + title + "\n" + lines.join("\n") + "\nEND"; }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, act = L.aiAct;
  ok("boot clean", errs.length === 0, errs);
  ok("eight actions registered (1.12: a document, slides, flashcards and a plan; 1.12.7: a wheel chart)", L.aiActions.map(function (a) { return a.id; }).join(",") === "schematic,drawing,wheel,sheet,doc,slides,cards,plan", L.aiActions.map(function (a) { return a.id; }));

  // --- finding blocks, and the prompt ---
  var fb = act.find("Here it is:\n```\nMAKE SCHEMATIC: Lamp\npart B1 battery\nwire B1 L1\nEND\n```\nDone.");
  ok("a MAKE block is found (code fences ignored, ends at END)", fb.length === 1 && fb[0].kind === "SCHEMATIC" && fb[0].title === "Lamp" && fb[0].lines.length === 2, fb);
  var unk = act.build("MAKE VIDEO: cats\nframe 1\nEND", "");
  ok("an unknown kind says what Lantern can make", unk && !unk.ok && /can make: schematic, drawing, wheel, sheet/.test(unk.problems[0]), unk && unk.problems);
  ok("Chat lists only the actions the question is about", /MAKE SCHEMATIC/.test(L.CHAT.buildSystem("Draw a circuit with a battery and a lamp")) &&
    !/MAKE SHEET/.test(L.CHAT.buildSystem("Draw a circuit with a battery and a lamp")) && !/MAKE [A-Z]+:/.test(L.CHAT.buildSystem("What is the capital of Kenya?")) &&
    /MAKE SHEET/.test(L.CHAT.buildSystem("Make a table of my shopping with a total")) && /MAKE DRAWING/.test(L.CHAT.buildSystem("Draw a house")));

  // --- schematics ---
  var lamp = act.build(blk("SCHEMATIC", "Lamp circuit", ["mode electrical", "part B1 battery \"12 V\"", "part S1 switch", "part L1 bulb \"60 W\"",
    "wire B1+ S1", "wire S1 L1", "wire L1 B1-"]), "q");
  ok("a battery, switch and bulb in a loop: built, a closed loop", lamp.ok && lamp.plan.loop && lamp.plan.parts.map(function (p) { return p.type; }).join() === "battery,switch,lamp" &&
    /3 parts, 3 connections, a closed loop/.test(lamp.summary), { p: lamp.problems, s: lamp.summary });
  var groups = lamp.shapes.filter(function (s) { return s.t === "group"; }), paths = lamp.shapes.filter(function (s) { return s.t === "path"; });
  ok("three symbols, three square wires, labels with values", groups.length === 3 && paths.length === 3 &&
    paths.every(function (p) { return p.pts.every(function (q, i) { return !i || q[0] === p.pts[i - 1][0] || q[1] === p.pts[i - 1][1]; }); }) &&
    lamp.shapes.some(function (s) { return s.t === "text" && s.s === "B1 (12 V)"; }) && lamp.shapes.some(function (s) { return s.t === "text" && s.s === "Lamp circuit"; }));
  // every wire ends on a terminal of the parts it names
  var term = function (x, y) { return groups.some(function (g) { var b = L.drawShapes.bbox(g); return y > b[1] && y < b[3] && (Math.abs(x - b[0] - 1.5) < 3 || Math.abs(x - b[2] + 1.5) < 3); }); };
  ok("wires start and end on symbol terminals", paths.every(function (p) { var a = p.pts[0], z = p.pts[p.pts.length - 1]; return term(a[0], a[1]) && term(z[0], z[1]); }),
    paths.map(function (p) { return [p.pts[0], p.pts[p.pts.length - 1]]; }));
  function probs(lines) { var r = act.build(blk("SCHEMATIC", "t", lines), ""); return r.problems.join(" | "); }
  ok("check: an open circuit", /not closed: there is no path from B1/.test(probs(["part B1 battery", "part L1 lamp", "part S1 switch", "wire B1 S1", "wire S1 L1"])));
  ok("check: a part that is not connected", /L2 is not connected/.test(probs(["part B1 battery", "part L1 lamp", "part L2 lamp", "wire B1 L1", "wire L1 B1"])));
  ok("check: an unknown part names the ones there are", /no electrical part called .warp drive. \(electrical parts: battery, source, resistor/.test(probs(["part B1 battery", "part X1 warp drive", "wire B1 X1", "wire X1 B1"])),
    probs(["part B1 battery", "part X1 warp drive", "wire B1 X1", "wire X1 B1"]));
  ok("check: a wire to a part that does not exist", /there is no part L9/.test(probs(["part B1 battery", "part L1 lamp", "wire B1 L9", "wire L1 B1"])));
  ok("names people use: bulb, LED, earth, power supply", L.aiSchematic.norm("bulb") === "lamp" && L.aiSchematic.norm("LED") === "diode" && L.aiSchematic.norm("earth") === "ground" &&
    L.aiSchematic.norm("power supply") === "source" && L.aiSchematic.norm("lamps") === "lamp" && L.aiSchematic.norm("pressure gauge") === "gauge");
  var par = act.build(blk("SCHEMATIC", "Two lamps", ["part B1 battery", "part L1 lamp", "part L2 lamp", "wire B1 L1", "wire L1 B1", "wire B1 L2", "wire L2 B1"]), "");
  ok("two lamps in parallel: built, joins marked with dots", par.ok && par.shapes.filter(function (s) { return s.t === "circle" && s.f; }).length >= 2, par.problems);
  var gnd = act.build(blk("SCHEMATIC", "Grounded", ["part V1 source", "part R1 resistor", "part G1 ground", "wire V1 R1", "wire R1 V1", "wire R1 G1"]), "");
  var gp = gnd.shapes.filter(function (s) { return s.t === "path"; });
  ok("a one-terminal part (ground) hangs straight below its terminal", gnd.ok && gp.some(function (p) { return p.pts.length === 2 && p.pts[0][0] === p.pts[1][0]; }), gnd.problems);
  var hyd = act.build(blk("SCHEMATIC", "Press", ["part P1 pump", "part V1 valve", "part C1 cylinder", "part T1 tank", "wire T1 P1", "wire P1 V1", "wire V1 C1", "wire V1 T1"]), "");
  ok("hydraulics: mode found from the parts, built", hyd.ok && hyd.plan.mode === "hydraulic", hyd.problems);
  ok("pneumatics: a compressor makes it pneumatic", act.build(blk("SCHEMATIC", "Air", ["part K1 compressor", "part V1 valve", "part C1 cylinder", "wire K1 V1", "wire V1 C1"]), "").plan.mode === "pneumatic");
  function plusRight(lines) {   // is the battery's long (+) plate on its right?
    var r = act.build(blk("SCHEMATIC", "Polarity", lines), ""), g = r.shapes.filter(function (s) { return s.t === "group"; })[0];
    var plates = g.shapes.filter(function (s) { return s.pts && s.pts[0][0] === s.pts[1][0]; });
    var tall = plates.filter(function (s) { return Math.abs(s.pts[0][1] - s.pts[1][1]) > 20; })[0], short = plates.filter(function (s) { return Math.abs(s.pts[0][1] - s.pts[1][1]) < 20; })[0];
    return tall.pts[0][0] > short.pts[0][0];
  }
  ok("polarity: + on the side the wire from B1+ leaves (mirrored when needed)", plusRight(["part B1 battery", "part L1 lamp", "wire B1+ L1", "wire L1 B1-"]) &&
    !plusRight(["part B1 battery", "part L1 lamp", "wire B1- L1", "wire L1 B1+"]));

  // --- pictures ---
  var house = act.build(blk("DRAWING", "House", ["rect 5 6 10 6 fill tan color black", "tri 4 6 10 2 16 6 fill red", "rect 9 9 2 3 fill brown", "circle 17 2 1.5 fill yellow", "text 10 11.5 \"Home\""]), "");
  ok("a picture: shapes on the grid, scaled up, fill and outline", house.ok && house.plan.shapes.length === 5 &&
    house.shapes.some(function (s) { return s.t === "rect" && s.f && s.c === "#d6b38a" && s.x === 180 && s.rw === 360; }) &&
    house.shapes.some(function (s) { return s.t === "rect" && !s.f && s.c === "#111827"; }) && house.shapes.some(function (s) { return s.t === "tri" && s.c === "#dc2626"; }) &&
    house.shapes.some(function (s) { return s.t === "text" && s.s === "Home"; }), house.problems);
  function pprobs(lines) { return act.build(blk("DRAWING", "t", lines), "").problems.join(" | "); }
  ok("picture checks: off the grid, unknown colour, wrong numbers, unknown shape", /off the grid/.test(pprobs(["circle 40 5 2"])) &&
    /unknown colour .chartreuse/.test(pprobs(["rect 1 1 2 2 fill chartreuse"])) && /a tri needs 6 numbers/.test(pprobs(["tri 1 1 2 2"])) &&
    /shapes are rect, circle/.test(pprobs(["star 5 5 3"])) && /text needs its words in quotes/.test(pprobs(["text 5 5 hello"])));
  ok("picture: 4,6 and 12x5 are read as numbers too", act.build(blk("DRAWING", "t", ["rect 4,6 12x5 fill blue"]), "").plan.shapes[0].nums.join() === "4,6,12,5");
  var oval = act.build(blk("DRAWING", "t", ["oval 2 2 6 3 fill sky"]), "");
  ok("a filled oval is one shape group (erasable as one)", oval.ok && oval.shapes[0].t === "group" && oval.shapes[0].shapes.length > 30);

  // --- 1.9.8: a reply stuck in a loop (a real 35B Chat, fixtures/chat_runaway) ---
  var RA = path.join(__dirname, "fixtures", "chat_runaway");
  var ra1 = fs.readFileSync(path.join(RA, "reply1.txt"), "utf8"), ra2 = fs.readFileSync(path.join(RA, "reply2.txt"), "utf8");
  var m1 = act.build(ra1, "draw a house on a hill at sunset");
  ok("a loop is found and reported as ONE problem", m1 && !m1.ok && m1.runaway && m1.runaway.n === 110 && m1.runaway.cut && m1.problems.length === 1 &&
    /^the reply ran away: \u201crect 10 6 1 1 fill blue\u201d was written 110 times, its numbers changing up to \u201crect 119 6 1 1 fill brown\u201d, 98 of them off the grid, until the reply was cut off/.test(m1.problems[0]) &&
    /ONE shape -- rect 0 0 20 7 fill orange/.test(m1.problems[0]), m1 && m1.problems);
  ok("what can be drawn is drawn: the hill, the house, its window", m1.plan && m1.plan.shapes.length === 3 && m1.preview && m1.open &&
    m1.plan.shapes.map(function (x) { return x.kind; }).join() === "curve,rect,rect" && /3 shapes; 111 lines left out/.test(m1.summary), m1.summary);
  ok("the loop is cut from what the model sees again", /^Here is a drawing/.test(m1.trimmed) && !/rect 10 6 1 1/.test(m1.trimmed) && !/rect 12$/m.test(m1.trimmed) &&
    /rect 9 6 2 2 fill white\nEND$/.test(m1.trimmed), m1.trimmed);
  var m2 = act.build(ra2, "draw a house on a hill at sunset");
  ok("the retry's loop too (68 lines, cut off mid-line)", m2.runaway && m2.runaway.n === 68 && m2.problems.length === 1 && m2.plan.shapes.length === 3, m2.problems);
  var fence = act.build(blk("DRAWING", "Fence", [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map(function (x) { return "rect " + x + " 8 0.5 3 fill brown"; })), "");
  ok("a row of fence posts is not a loop", fence.ok && !fence.runaway && fence.plan.shapes.length === 10, fence.problems);
  var dots = act.build(blk("DRAWING", "Dots", [], 0).replace("\nEND", "") + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
    .map(function (x) { return "circle " + x + " 5 0.3 fill red"; }).join("\n") + "\nEND", "");
  ok("a few lines off the grid: drawn without them, listed as one problem", !dots.runaway && dots.plan && dots.plan.shapes.length === 22 && dots.problems.length === 1 &&
    /^4 lines, from \u201ccircle 22 5 0\.3 fill red\u201d to \u201ccircle 25 5 0\.3 fill red\u201d, are off the grid/.test(dots.problems[0]), dots.problems);
  ok("many problems are listed as at most 8", act.compact(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]).length === 8 &&
    /^and 3 more problems/.test(act.compact(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"])[7]) &&
    /^3 lines, from \u201cx 1\u201d to \u201cx 3\u201d: a rect needs 4 numbers$/.test(act.compact(["\u201cx 1\u201d: a rect needs 4 numbers", "\u201cx 2\u201d: a rect needs 4 numbers", "\u201cx 3\u201d: a rect needs 4 numbers"])[0]));
  ok("nothing drawable: no picture", !act.build(blk("DRAWING", "t", ["star 1 1 1", "moon 2 2 2"]), "").plan);
  ok("the drawing prompt asks for one big shape per area", /Paint an area \(a sky, the ground, a wall\)/.test(L.CHAT.buildSystem("Draw a house at sunset")) &&
    /with ONE big shape, never rows of small squares; 30 shapes or fewer/.test(L.CHAT.buildSystem("Draw a house at sunset")) && /rect 0 0 20 12 fill sky/.test(L.CHAT.buildSystem("Draw a house at sunset")));

  // --- tables ---
  var shop = act.build(blk("SHEET", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Milk | 1 | $0.99 | =B3*C3", "Eggs | 12 | 0.25 | =B4*C4", "Total | | | =SUM(D2:D4)"]), "");
  ok("a table: the sheet engine works out the formulas", shop.ok && shop.plan.values.D2 === 3 && Math.abs(shop.plan.values.D5 - 6.99) < 1e-9 && shop.plan.cells.C3 === "0.99" && shop.plan.formulas === 4,
    { p: shop.problems, v: shop.plan && shop.plan.values });
  function sprobs(lines) { return act.build(blk("SHEET", "t", lines), "").problems.join(" | "); }
  ok("table check: a formula that reads an empty cell (off by one row)", /D3 \(=B4\*C4\) uses B4, which is empty/.test(sprobs(["A | B | C | D", "x | 2 | 3 | =B2*C2", "y | 4 | 5 | =B4*C4"])),
    sprobs(["A | B | C | D", "x | 2 | 3 | =B2*C2", "y | 4 | 5 | =B4*C4"]));
  ok("table check: a formula on text, and one that fails", /uses C2, which is text/.test(sprobs(["A | B | C | D", "x | 2 | lots | =B2*C2"])) &&
    /gives an error/.test(sprobs(["A | B", "x | =NOSUCH(1)"])));
  ok("a markdown table is read too", act.build(blk("SHEET", "t", ["| A | B |", "|---|---|", "| 1 | =A2*2 |"]), "").plan.values.B2 === 2);

  // --- Chat: a block with a problem goes back once; the fix is shown ---
  await L.ai.detect();
  go("chat"); await sleep(40);
  var cin = d.querySelector("input[aria-label=\"Message\"]");
  function chatAsk(text) { cin = d.querySelector("input[aria-label=\"Message\"]"); cin.value = text; modelCalls = []; btn(d, "Send").click(); }
  function logText() { return d.querySelector("[aria-label=\"Conversation\"]").textContent; }
  modelReplies = [blk("SCHEMATIC", "Lamp circuit", ["part B1 battery \"12 V\"", "part S1 switch", "part L1 lamp", "wire B1 S1", "wire S1 L1"]),
    function (body) { var last = body.messages[body.messages.length - 1].content;
      return /not closed/.test(last) ? blk("SCHEMATIC", "Lamp circuit", ["part B1 battery \"12 V\"", "part S1 switch", "part L1 lamp", "wire B1 S1", "wire S1 L1", "wire L1 B1"]) : "?"; }];
  var before = logText().length;
  chatAsk("Draw a circuit with a 12 V battery, a switch and a lamp in series"); await sleep(200);
  var t = logText().slice(before);
  ok("Chat: the AI is told how to MAKE a schematic", modelCalls.length === 2 && /MAKE SCHEMATIC: <title>/.test(modelCalls[0].messages[0].content), modelCalls.length);
  ok("Chat: an open circuit goes back once, the fixed one is shown", /Lantern checked the MAKE SCHEMATIC block: the circuit is not closed/.test(t) &&
    /Lantern made a schematic: Lamp circuit/.test(t) && /a closed loop/.test(t) && !/still questions/.test(t), t.slice(-600));
  var prev = [{ t: "rect", c: "#000", w: 3, x: 1, y: 1, rw: 5, rh: 5 }];
  L.store.set("draw.scene", prev);
  btn(d, "Open in Draw").click(); await sleep(80);
  var scene = L.store.get("draw.scene", []);
  ok("Open in Draw: the schematic is the drawing, the person's own one is kept", w.location.hash === "#draw" && scene.length > 6 &&
    JSON.stringify(L.store.get("draw.scene.prev", [])) === JSON.stringify(prev) && /Made for you: Lamp circuit/.test(d.body.textContent), { hash: w.location.hash, n: scene.length });
  btn(d, "Restore previous drawing").click(); await sleep(20);
  ok("Restore previous drawing swaps back (and keeps the AI's)", JSON.stringify(L.store.get("draw.scene", [])) === JSON.stringify(prev) && L.store.get("draw.scene.prev", []).length > 6);

  // --- Chat: a table, opened in Sheets ---
  go("chat"); await sleep(40);
  modelReplies = ["Here is your table.\n" + blk("SHEET", "Shopping", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Total | | | =SUM(D2:D2)"])];
  before = logText().length;
  chatAsk("Make a table of my shopping with a total"); await sleep(200);
  t = logText().slice(before);
  ok("Chat: a table is shown with the sheet's numbers", /Lantern made a table: Shopping/.test(t) && /worked out by the sheet/.test(t) && d.querySelector(".la-make table"), t.slice(-400));
  var nSheets = L.sheetDocs.list().length;
  btn(d, "Open in Sheets").click(); await sleep(80);
  ok("Open in Sheets: a new sheet, opened", L.sheetDocs.list().length === nSheets + 1 && w.location.hash === "#sheet" &&
    L.sheetDocs.values(L.sheetDocs.list().filter(function (s) { return s.title === "Shopping"; })[0].id).D3 === 3);

  // --- the look turn: only when the model can see ---
  go("chat"); await sleep(40);
  modelReplies = [blk("DRAWING", "Sun", ["rect 0 8 20 4 fill blue", "circle 10 4 2 fill yellow"])];
  before = logText().length;
  chatAsk("Draw a yellow sun over a blue sea"); await sleep(200);
  ok("a model that cannot see is not shown the picture", modelCalls.length === 1 && !/showed the AI/.test(logText().slice(before)));
  vision = true; await L.ai.detect();
  ok("vision found from llama-server's /props", L.ai.server.vision === true && L.ai.canSee() && /sees images/.test(L.ai.describe()));
  modelReplies = [blk("DRAWING", "Sun", ["rect 0 8 20 4 fill blue", "circle 10 4 2 fill yellow"]),
    function (body) { var last = body.messages[body.messages.length - 1].content;
      return Array.isArray(last) && last[1].type === "image_url" && /^data:image\/png;base64,/.test(last[1].image_url.url) && /LOOKS RIGHT/.test(last[0].text) ?
        "LOOKS RIGHT. A yellow sun sits above a blue band of sea." : "?"; }];
  before = logText().length;
  chatAsk("Draw a yellow sun over a blue sea"); await sleep(250);
  t = logText().slice(before);
  ok("a model that can see is shown the picture once, and says what it sees", modelCalls.length === 2 && /showed the AI the picture/.test(t) &&
    /The AI looked at the picture and says it shows what was asked/.test(t), t.slice(-400));
  modelReplies = [blk("DRAWING", "Sun", ["rect 0 8 20 4 fill blue", "circle 10 4 2 fill yellow"]),
    function () { return blk("DRAWING", "Sun", ["rect 0 8 20 4 fill blue", "circle 10 3 2 fill yellow", "line 7 7 13 7 color orange"]); }];
  before = logText().length;
  chatAsk("Draw a yellow sun over a blue sea, with a horizon"); await sleep(250);
  t = logText().slice(before);
  ok("after looking it may send a corrected block: shown, and not looked at again", modelCalls.length === 2 && (t.match(/Lantern made a drawing/g) || []).length === 2, t.slice(-300));
  var tr = L.CHAT.trimHistory([{ role: "user", content: [{ type: "text", text: "look" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] },
    { role: "assistant", content: "LOOKS RIGHT" }, { role: "user", content: "next" }]);
  ok("a picture is sent once: later turns carry a note instead", typeof tr[0].content === "string" && /not sent again/.test(tr[0].content));
  vision = false; await L.ai.detect();

  // --- 1.9.8: Chat with the real looping replies ---
  go("chat"); await sleep(40);
  modelReplies = [ra1, ra2];
  before = logText().length;
  chatAsk("draw a house on a hill at sunset"); await sleep(300);
  t = logText().slice(before);
  var retryMsg = modelCalls[1] && modelCalls[1].messages[modelCalls[1].messages.length - 1].content, seenReply = modelCalls[1] && modelCalls[1].messages[modelCalls[1].messages.length - 2].content;
  ok("Chat: the retry gets one short reason, and the model does not see its loop again", modelCalls.length === 2 && retryMsg.length < 700 &&
    /the reply ran away/.test(retryMsg) && !/rect 10 6 1 1/.test(seenReply) && /rect 9 6 2 2 fill white/.test(seenReply), { len: retryMsg && retryMsg.length, seen: seenReply });
  ok("Chat: says the reply got stuck, and shows it without the repeats", /got stuck repeating one line \(110 times, until it was cut off\)/.test(t) &&
    /got stuck repeating one line \(68 times/.test(t) && !/rect 30 6 1 1/.test(t) && (t.match(/off the grid/g) || []).length <= 4, t.slice(0, 800));
  ok("Chat: the parts it could draw are shown, with Open in Draw", /Lantern made a drawing: House on a hill at sunset \u2014 3 shapes/.test(t) && /still questions this: the reply ran away/.test(t) &&
    btn(d, "Open in Draw"), t.slice(-700));
  btn(d, "Open in Draw").click(); await sleep(80);
  ok("Open in Draw: the hill and the house, ready to finish by hand", w.location.hash === "#draw" && L.store.get("draw.scene", []).length >= 3 &&
    /Made for you: House on a hill at sunset/.test(d.body.textContent));
  go("chat"); await sleep(40);
  modelReplies = [ra1, blk("DRAWING", "House on a hill at sunset", ["rect 0 0 20 7 fill orange", "circle 16 5 2 fill yellow", "rect 0 7 20 5 fill green", "rect 8 5 4 3 fill brown", "tri 7 5 10 3 13 5 fill red"])];
  before = logText().length;
  chatAsk("draw a house on a hill at sunset"); await sleep(300);
  t = logText().slice(before);
  ok("Chat: a loop, then a good block: the good one, unquestioned", modelCalls.length === 2 && /Lantern made a drawing: House on a hill at sunset \u2014 5 shapes/.test(t) &&
    !/still questions/.test(t.slice(t.lastIndexOf("Lantern made a drawing"))), t.slice(-500));
  modelReplies = [blk("DRAWING", "Sky", ["star 1 1 1", "moon 2 2 2"]), blk("DRAWING", "Sky", ["star 1 1 1"])];
  before = logText().length;
  chatAsk("draw the night sky"); await sleep(300);
  t = logText().slice(before);
  ok("Chat: when nothing can be drawn it says so -- not \u201cmade\u201d, no button", /Lantern could not make a drawing: Sky/.test(t) && /Nothing was made:/.test(t) &&
    !/Lantern made a drawing/.test(t) && !Array.prototype.some.call(d.querySelectorAll(".la-make"), function (x) { return /could not make/.test(x.textContent) && x.querySelector("button"); }), t.slice(-500));
  modelReplies = [ra1, blk("DRAWING", "House", ["star 1 1 1"])];
  before = logText().length;
  chatAsk("draw a house on a hill at sunset"); await sleep(300);
  t = logText().slice(before);
  ok("Chat: a worse correction keeps the first block's picture", /could not be made either; here is what Lantern could make of the first one/.test(t) &&
    /Lantern made a drawing: House on a hill at sunset \u2014 3 shapes/.test(t), t.slice(-600));

  // --- the bench: make questions ---
  var Q = L.aiBenchQuestions.filter(function (q) { return q.cat === "make"; });
  ok("fourteen make questions (1.12.7: the power wheel), three quick", Q.length === 14 && Q.filter(function (q) { return q.quick; }).length === 3);
  function gradeWith(id, reply) {
    var item = Q.filter(function (q) { return q.id === id; })[0];
    return L.aiBench.grade(item, reply, { made: act.build(reply, item.q) });
  }
  ok("bench: a sunset sky as one wide rect passes; the run-away reply fails", gradeWith("make-sunset-house", Q.filter(function (q) { return q.id === "make-sunset-house"; })[0].ideal).pass &&
    !gradeWith("make-sunset-house", ra1).pass && /no sunset sky/.test(gradeWith("make-sunset-house", blk("DRAWING", "h", ["rect 0 8 20 4 fill green", "rect 7 5 5 4 fill tan", "tri 6 5 9.5 2 13 5 fill red"])).why));
  ok("bench: a closed lamp circuit passes", gradeWith("make-lamp-circuit", blk("SCHEMATIC", "c", ["part B1 battery", "part S1 switch", "part L1 lamp", "wire B1 S1", "wire S1 L1", "wire L1 B1"])).pass);
  ok("bench: lamps wired to each other are not parallel", /series/.test(gradeWith("make-parallel-lamps", blk("SCHEMATIC", "c", ["part B1 battery", "part L1 lamp", "part L2 lamp", "wire B1 L1", "wire L1 L2", "wire L2 B1"])).why));
  ok("bench: two lamps in parallel pass", gradeWith("make-parallel-lamps", blk("SCHEMATIC", "c", ["part B1 battery", "part L1 lamp", "part L2 lamp", "wire B1 L1", "wire L1 B1", "wire B1 L2", "wire L2 B1"])).pass);
  ok("bench: a drawing where a schematic was asked fails", /made a drawing, not schematic/.test(gradeWith("make-lamp-circuit", blk("DRAWING", "c", ["rect 1 1 2 2"])).why));
  ok("bench: house with a red roof passes, without one fails", gradeWith("make-house", blk("DRAWING", "h", ["rect 5 6 10 6 fill tan", "tri 4 6 10 2 16 6 fill red", "rect 9 9 2 3 fill brown"])).pass &&
    /red roof/.test(gradeWith("make-house", blk("DRAWING", "h", ["rect 5 6 10 6 fill tan", "tri 4 6 10 2 16 6 fill green", "rect 9 9 2 3"])).why));
  ok("bench: the sun must be above the sea", gradeWith("make-sun-sea", blk("DRAWING", "s", ["rect 0 8 20 4 fill blue", "circle 10 4 2 fill yellow"])).pass &&
    /not above/.test(gradeWith("make-sun-sea", blk("DRAWING", "s", ["rect 0 2 20 4 fill blue", "circle 10 10 1 fill yellow"])).why));
  ok("bench: the shopping table needs the sheet to find 6.99", gradeWith("make-shopping", blk("SHEET", "s", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2",
    "Milk | 1 | 0.99 | =B3*C3", "Eggs | 12 | 0.25 | =B4*C4", "Total | | | =SUM(D2:D4)"])).pass &&
    /no formulas/.test(gradeWith("make-shopping", blk("SHEET", "s", ["Item | Cost", "Bread | 3", "Milk | 0.99", "Eggs | 3", "Total | 6.99"])).why));
  ok("bench: Celsius to Fahrenheit by formula passes", gradeWith("make-temperatures", blk("SHEET", "t", ["C | F", "0 | =A2*9/5+32", "10 | =A3*9/5+32", "20 | =A4*9/5+32", "30 | =A5*9/5+32", "40 | =A6*9/5+32"])).pass);
  // a whole bench row through the same path as Chat
  modelReplies = [blk("SHEET", "s", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Milk | 1 | 0.99 | =B3*C3", "Eggs | 12 | 0.25 | =B5*C4", "Total | | | =SUM(D2:D4)"]),
    function (body) { var last = body.messages[body.messages.length - 1].content;
      return /uses B5, which is empty/.test(last) ? blk("SHEET", "s", ["Item | Qty | Price | Cost", "Bread | 2 | 1.50 | =B2*C2", "Milk | 1 | 0.99 | =B3*C3", "Eggs | 12 | 0.25 | =B4*C4", "Total | | | =SUM(D2:D4)"]) : "?"; }];
  var item = Q.filter(function (q) { return q.id === "make-shopping"; })[0];
  var res = await act.solve(item.q, function (m) { return L.ai.complete(m, { temperature: 0 }); });
  var g = L.aiBench.grade(item, res.text, res);
  ok("bench path: a slip goes back once, the fix passes", res.rounds === 2 && res.kind === "questioned" && res.fixed && g.pass, { rounds: res.rounds, why: g.why });
  var sm = L.aiBench.summary([{ cat: "make", pass: true, ms: 1 }, { cat: "make", pass: false, ms: 1 }, { cat: "tool", pass: true, ms: 1 }]);
  ok("bench summary keeps things made apart", sm.make.n === 2 && sm.make.pass === 1 && sm.core.n === 1);
  // --- 1.12.5: Ohm's law in parallel, from Adam's Chat with a 35B ---
  var par = blk("SCHEMATIC", "Ohm's Law Parallel Circuit", ["mode electrical", "part V1 source \"12 V\"", "part R1 resistor \"4 ohm\"", "part R2 resistor \"6 ohm\"",
    "part R3 resistor \"12 ohm\"", "part J1 junction \"\"", "wire V1 J1", "wire J1 R1", "wire J1 R2", "wire J1 R3", "wire R1 V1", "wire R2 V1", "wire R3 V1"]);
  var pr = act.build(par, "");
  ok("a junction is folded into the wires: three resistors across the source, one under another like a ladder", pr.ok && pr.plan.parts.length === 4 &&
    !pr.plan.parts.some(function (x) { return x.type === "junction"; }) && pr.plan.wires.length === 6 && /4 parts, 6 connections, a closed loop/.test(pr.summary), pr.problems || pr.summary);
  var met = act.build(blk("SCHEMATIC", "Meters", ["part V1 battery \"12 V\"", "part A1 ammeter", "part R1 resistor \"6 ohm\"", "part M1 volt meter",
    "wire V1 A1", "wire A1 R1", "wire R1 V1", "wire R1 M1", "wire M1 R1",
    "note I = V / R = 12 / 6 = {=12/6} A", "note Rt = {=1/(1/4+1/6+1/12)} ohm"]), "");
  ok("an ammeter and a voltmeter; notes with {= ...} worked out by Lantern", met.ok && met.plan.parts.map(function (x) { return x.type; }).join() === "battery,ammeter,resistor,voltmeter" &&
    met.plan.notes.join(" | ") === "I = V / R = 12 / 6 = 2 A | Rt = 2 ohm", met.problems || met.plan && met.plan.notes);
  ok("a note that cannot be worked out is sent back", /could not be worked out/.test(act.build(blk("SCHEMATIC", "x", ["part V1 battery", "part R1 resistor", "wire V1 R1", "wire R1 V1", "note R = {=12/}"]), "").problems.join()));
  ok("Draw's Electrical symbols have the meters too", (L.drawModes.filter(function (m) { return m.id === "electrical"; })[0].symbols || []).filter(function (x) { return /^(Ammeter|Voltmeter)$/.test(x.label); }).length === 2);
  ok("the AI is told about notes, meters and redrawing", /note <text>/.test(act.prompt("draw a circuit with a battery")) && /ammeter, voltmeter/.test(act.prompt("draw a circuit with a battery")) &&
    /reply with the whole MAKE SCHEMATIC block again/.test(act.prompt("draw a circuit with a battery")));
  // the follow-up: "The picture needs the formula ..." -- the 35B worked the
  // numbers out with = lines; they come from its own schematic above, and
  // each branch current is in its answer, so nothing is questioned now
  var said3 = [], conv3 = await L.CHAT.converse(["draw an electrical schematic that demonstrates ohm's law in parallel",
    "The picture needs the formula with the circuit resistances shown for education"], { call: function (m) {
    var last = String(m[m.length - 1].content); said3.push(last);
    if (/ohm\x27s law in parallel/i.test(last)) return Promise.resolve(par);
    return Promise.resolve("To add the formula:\n=12 / 4\n=12 / 6\n=12 / 12\n=1 / 4 + 1 / 6 + 1 / 12\n=1 / ANS\n=12 * ANS\n" +
      "ANSWER: The total resistance is 2 ohms, with branch currents of 3 A, 2 A, and 1 A respectively.");
  } });
  var tq = conv3.turns[1];
  ok("the follow-up's numbers come from the schematic made earlier: not questioned, no NEED, no library", said3.length === 2 && !tq.stillDoubt && !(tq.searches || []).length &&
    /2 ohms/.test(tq.final), { n: said3.length, doubt: tq.stillDoubt, searches: tq.searches, final: tq.final });
  ok("a NEED about a voltage source is not a call for the encyclopedia", !L.assist.needLibrary("What voltage source and resistor values should be used for the parallel circuit demonstration?") &&
    L.assist.needLibrary("I need factual data from the offline encyclopedia") && L.assist.needLibrary("Which reliable sources give the figure?"));
  // --- 1.12.6: a ground used as the return to the source (Adam's next Chat) ---
  var gnd2 = act.build(blk("SCHEMATIC", "Ohms Law Parallel Circuit", ["mode electrical", "part V1 source \"12 V\"", "part R1 resistor \"100 ohm\"",
    "part R2 resistor \"200 ohm\"", "part G1 ground", "wire V1 R1", "wire V1 R2", "wire R1 G1", "wire R2 G1", "wire V1 G1",
    "note Rt = R1 x R2 / (R1 + R2) = {=100*200/(100+200)} ohm"]), "draw an electrical schematic showing ohms law in parallel with the formula shown to calculate the resistances");
  var gw = gnd2.plan ? gnd2.plan.wires.map(function (w) { return w.join("-"); }) : [];
  ok("a ground used as the return is the source's other terminal: both resistors back to the source, the ground on that return", gnd2.ok &&
    gw.indexOf("R1-V1") >= 0 && gw.indexOf("R2-V1") >= 0 && gw.indexOf("G1-V1") >= 0 && gw.indexOf("R1-G1") < 0 && gnd2.plan.notes[0] === "Rt = R1 x R2 / (R1 + R2) = 66.67 ohm", gnd2.problems || gw);
  var ser = act.build(blk("SCHEMATIC", "Series with ground", ["part V1 battery \"9 V\"", "part R1 resistor \"1 k\"", "part G1 ground", "wire V1 R1", "wire R1 G1", "wire G1 V1"]), "");
  ok("a ground on the way round is a join, its symbol kept", ser.ok && ser.plan.wires.map(function (w) { return w.join("-"); }).join() === "V1-R1,R1-V1,G1-V1", ser.plan && ser.plan.wires);
  var noNotes = act.build(blk("SCHEMATIC", "P", ["part V1 source \"12 V\"", "part R1 resistor \"100 ohm\"", "part R2 resistor \"200 ohm\"", "wire V1 R1", "wire R1 V1", "wire V1 R2", "wire R2 V1"]),
    "draw a schematic in parallel with the formula shown to calculate the resistances");
  ok("asked for the formula and the block has no notes: sent back once to add them", !noNotes.ok && /asked for the formula on the drawing: add note lines/.test(noNotes.problems.join()) &&
    act.build(blk("SCHEMATIC", "P", ["part V1 source", "part R1 resistor", "wire V1 R1", "wire R1 V1"]), "draw a lamp circuit").ok, noNotes.problems);
  ok("the AI is told to put formulas in note lines, not = lines", /put them in note lines in the block -- not in = lines/.test(act.prompt("draw a circuit with a battery")));
  // --- 1.12.7: a junction no part line made; the power wheel (Adam's Chat) ---
  var jn = act.build(blk("SCHEMATIC", "Ohm's Law Parallel", ["part V1 source \"12 V\"", "part A1 ammeter", "part R1 resistor \"4 ohm\"", "part R2 resistor \"6 ohm\"",
    "wire V1 A1", "wire A1 junction1", "wire junction1 R1", "wire junction1 R2", "wire R1 V1", "wire R2 GND"]), "");
  ok("a wire to junction1 or GND that no part line made: Lantern makes the junction and the ground, no retry", jn.ok &&
    !jn.plan.parts.some(function (x) { return x.type === "junction"; }) && /closed loop/.test(jn.summary), jn.problems || jn.summary);
  ok("an undeclared part that is not a junction is still a problem", /there is no part LAMP1/.test(probs(["part B1 battery", "wire B1 LAMP1", "wire LAMP1 B1"])));
  var WL = ["rect 0 0 20 12 fill white", "circle 10 6 4 fill gray", "text 10 6 \"P\" color black width 2", "text 10 4 \"V\" color black width 2",
    "text 10 8 \"I\" color black width 2", "text 8 6 \"R\" color black width 2", "text 12 6 \"R\" color black width 2", "text 8 4 \"V\" color black width 2",
    "text 12 4 \"I\" color black width 2", "text 8 8 \"I\" color black width 2", "text 12 8 \"V\" color black width 2", "text 10 2 \"P=VI\" color black width 1",
    "text 10 10 \"P=I²R\" color black width 1", "text 6 6 \"P=V²/R\" color black width 1", "text 14 6 \"I=P/V\" color black width 1", "text 14 4 \"V=IR\" color black width 1",
    "text 14 8 \"I=V/R\" color black width 1", "text 6 4 \"V=√(PR)\" color black width 1", "text 6 8 \"V=IR\" color black width 1", "text 12 2 \"V=√(PR)\" color black width 1",
    "text 12 10 \"R=V/I\" color black width 1", "text 4 6 \"R=V²/P\" color black width 1", "text 16 6 \"R=V/I\" color black width 1", "text 4 4 \"I=V/R\" color black width 1",
    "text 4 8 \"I=√(P/R)\" color black width 1", "text 16 4 \"I=P/V\" color black width 1", "text 16 8 \"I=√(P/R)\" color black width 1", "text 10 1 \"P=V²/R\" color black width 1",
    "text 10 11 \"P=I²R\" color black width 1"];
  var wq = "draw the ohms law power wheel calculator for educational purposes", wd = act.build(blk("DRAWING", "Ohm's Law Power Wheel", WL), wq);
  var wdp = (wd.problems || []).join(" | ");
  ok("the 35B's power-wheel drawing: still drawn, but the words that run together and the formulas written twice go back", wd.plan && !wd.ok &&
    /“V=√\(PR\)” \(at 6 4\) runs into “I=V\/R” \(at 4 4\)/.test(wdp) && /written twice/.test(wdp) && /“V=IR”/.test(wdp) && /MAKE WHEEL/.test(wdp), wdp);
  ok("a drawing with its words apart passes; text cut off at the left edge does not", act.build(blk("DRAWING", "House", ["rect 5 6 10 5 fill tan", "tri 4 6 10 2 16 6 fill red",
    "text 10 1 \"My house\"", "text 3 11 \"Garden\"", "text 17 11 \"Path\""]), "Draw a house").ok &&
    /cut off at the left edge/.test(act.build(blk("DRAWING", "x", ["text 0 2 \"A long label at the edge\""]), "").problems.join()));
  ok("the drawing prompt says how much room words need", /a word needs about 1 cell for every 3 letters/.test(act.prompt("draw a house")));
  var OW = ["P watts: P = V x I | P = V^2 / R | P = I^2 x R", "V volts: V = I x R | V = P / I | V = sqrt(P x R)", "I amps: I = V / R | I = P / V | I = sqrt(P / R)",
    "R ohms: R = V / I | R = V^2 / P | R = P / I^2", "note P = power (watts), V = voltage (volts), I = current (amps), R = resistance (ohms)",
    "note With V = 12 V and R = 4 ohm, I = {=12/4} A and P = {=12*12/4} W"];
  var ow = act.build(blk("WHEEL", "Ohm's law power wheel", OW), wq), owT = ow.shapes ? L.aiDrawCheck.boxes(ow.shapes) : [];
  ok("MAKE WHEEL: four parts, twelve formulas, the notes worked out", ow.ok && /4 parts, 12 items/.test(ow.summary) && ow.plan.notes[1] === "With V = 12 V and R = 4 ohm, I = 3 A and P = 36 W", ow.problems || ow.summary);
  ok("every word placed by Lantern: none runs into another, none cut off, the formulas big enough to read", owT.length >= 20 && L.aiDrawCheck.clashes(ow.shapes).length === 0 &&
    owT.every(function (b) { return b.x0 > 0 && b.y0 > 0; }) && ow.plan.size >= 16 && owT.some(function (b) { return b.s === "P = V × I"; }) &&
    owT.some(function (b) { return b.s === "P = I² × R"; }), { size: ow.plan && ow.plan.size, clash: ow.shapes && L.aiDrawCheck.clashes(ow.shapes).map(function (c) { return c[0].s + "/" + c[1].s; }) });
  ok("each formula inside its own wedge: P's three round P", (function () {
    var P = owT.filter(function (b) { return /^P = /.test(b.s) && b.y < L.aiWheelLayout.CY + L.aiWheelLayout.R; }), lab = owT.filter(function (b) { return b.s === "P"; })[0], C = L.aiWheelLayout;
    if (!lab || P.length !== 3) return false;
    var ang = function (b) { return Math.atan2(b.x - C.CX, -(b.y - C.CY)); }, a0 = ang(lab);
    return P.every(function (b) { return Math.abs(Math.atan2(Math.sin(ang(b) - a0), Math.cos(ang(b) - a0))) < Math.PI / 4 + 0.01; });
  })(), owT.map(function (b) { return b.s + "@" + Math.round(b.x) + "," + Math.round(b.y); }));
  var bw = act.build(blk("WHEEL", "Power wheel", ["P: P = V x R | P = V^2 / R | I = P / V", "V: V = I x R | V = I x R | V = sqrt(P x R)", "I: I = V / R | I = sqrt(P / R)",
    "R: R = V / I | R = V^2 / P | R = P / I^2"]), wq), bwp = bw.problems.join(" | ");
  ok("the formulas are checked: a wrong one (worked out with V = 12, I = 3, R = 4, P = 36), one in the wrong part, one twice", !bw.ok &&
    /“P = V x R” is not right: with P = 36, V = 12, I = 3, R = 4 it gives 48, not 36/.test(bwp) && /“I = P \/ V” is in the P part, but it works out I: put it in the I part/.test(bwp) &&
    /“V = I x R” is on the wheel twice/.test(bwp) && bw.plan, bwp);
  var rw = act.build(blk("WHEEL", "E wheel", ["P: E x I | E^2/R | I^2R", "E: IR | P/I | sqrt(PR)", "I: E/R | P/E | sqrt(P/R)", "R: E/I | E^2/P | P/I^2 fill pink"]), "");
  ok("a wheel of right-hand sides only, E for volts, IR and I^2R written short: all right", rw.ok, rw.problems);
  ok("a wrong right-hand side in a letter's part is caught", /“E x R” is not right/.test(act.build(blk("WHEEL", "x", ["P: E x R | E x I", "E: IR", "I: E/R", "R: E/I"]), "").problems.join()));
  var yr = act.build(blk("WHEEL", "The year", ["Spring: March | April | May fill green", "Summer: June | July | August fill yellow", "Autumn: September | October | November fill orange",
    "Winter: December | January | February fill blue", "centre Seasons"]), "");
  ok("a wheel of words (no formulas) with a centre: built, nothing questioned", yr.ok && yr.plan.hub === "Seasons" && L.aiDrawCheck.clashes(yr.shapes).length === 0 &&
    L.aiDrawCheck.boxes(yr.shapes).some(function (b) { return b.s === "Seasons"; }), yr.problems);
  var cw = act.build(blk("WHEEL", "Colour wheel", ["Red:", "Orange:", "Yellow:", "Green:", "Blue:", "Purple:"]), "");
  var fills = []; (function walk(l) { l.forEach(function (s) { if (s.t === "group") walk(s.shapes); else if (s.t === "tri") fills.push(s.c); }); })(cw.shapes || []);
  ok("a colour wheel: each part painted its own colour, white words on the dark ones", cw.ok && fills.indexOf("#ef4444") >= 0 && fills.indexOf("#3b82f6") >= 0 &&
    cw.shapes.some(function (s) { return s.t === "text" && s.s === "Red" && s.c === "#ffffff"; }), cw.problems);
  ok("a wheel needs two parts; a part line needs its colon", /2 or more parts/.test(act.build(blk("WHEEL", "x", ["Only: one"]), "").problems.join()) &&
    /a part line is <name>: <item>/.test(act.build(blk("WHEEL", "x", ["A: 1", "B: 2", "just words"]), "").problems.join()));
  ok("Chat offers MAKE WHEEL for a power wheel, and says to use it, not MAKE DRAWING; not for a car's wheels", /MAKE WHEEL/.test(L.CHAT.buildSystem(wq)) &&
    /use MAKE WHEEL, not MAKE DRAWING/.test(L.CHAT.buildSystem(wq)) && !/MAKE WHEEL/.test(L.CHAT.buildSystem("draw a car with four wheels")) &&
    !/MAKE WHEEL/.test(L.CHAT.buildSystem("draw a grinding wheel guard")));
  // the whole Chat turn: the 35B's drawing goes back once with its problems,
  // and the corrected block is a MAKE WHEEL
  var said4 = [], conv4 = await L.CHAT.converse([wq], { call: function (m) {
    var last = String(m[m.length - 1].content); said4.push(last);
    if (/Lantern checked your MAKE DRAWING block/.test(last)) return Promise.resolve(blk("WHEEL", "Ohm's law power wheel", OW));
    return Promise.resolve(blk("DRAWING", "Ohm's Law Power Wheel", WL));
  } });
  var t4 = conv4.turns[0];
  ok("Chat: the drawing's problems go back once, and the corrected block is a wheel Lantern lays out", said4.length === 2 && /runs into/.test(said4[1]) &&
    t4.made && t4.made.ok && t4.made.block.kind === "WHEEL", { n: said4.length, made: t4.made && t4.made.block && t4.made.block.kind, p: t4.made && t4.made.problems });
  ok("the look turn asks whether every word is readable", /none running into another, cut off or written twice/.test(act.lookText({ block: { kind: "WHEEL" } }, "q")));
  ok("bench: the power wheel question passes with its ideal reply", gradeWith("make-power-wheel", Q.filter(function (q) { return q.id === "make-power-wheel"; })[0].ideal).pass);
  ok("no errors after all that", errs.length === 0, errs);

  console.log(fails ? fails + " AI ACTION FAILURES (" + passes + " passed)" : "ALL AI ACTION TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("FAIL crashed", e && e.stack); process.exit(1); });
