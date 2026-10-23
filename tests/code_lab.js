// code_lab.js -- Code Lab (1.13.0): the languages and their install links,
// the highlighter, the editor, files, every language's checks (good and bad
// code), ladder parsing, ladder to Structured Text and the ladder drawing,
// JavaScript running in a sandbox (a stand-in Worker on node's vm, with a
// time limit), every tested example passing its own checks, the tile and the
// Turtle Code relabel, and the AI side: MAKE CODE (checked, one corrected
// block, shown, opened in Code Lab with its indents), EXAMPLE:, where the
// code came from, and code written straight into a reply. Scripted model.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path"), vm = require("vm");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; return function () {}; }, set: function (t, k, v) { t[k] = v; return true; } });
};
w.HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="; };
// A stand-in Web Worker: the sandbox's own boot script runs in a fresh vm
// context; a message that runs too long never answers (as a stuck worker).
var blobs = {}, downloads = [];
w.URL.createObjectURL = function (b) { var id = "blob:t" + Math.random(); blobs[id] = b; return id; };
w.URL.revokeObjectURL = function () {};
w.HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push(this.download); };
function blobText(b) {
  if (b.text) return b.text();
  return new Promise(function (ok) { var r = new w.FileReader(); r.onload = function () { ok(String(r.result)); }; r.readAsText(b); });
}
w.Worker = function (url) {
  var me = this, dead = false, ctx = { setTimeout: setTimeout, clearTimeout: clearTimeout, JSON: JSON };
  ctx.postMessage = function (m) { setTimeout(function () { if (!dead && me.onmessage) me.onmessage({ data: m }); }, 0); };
  ctx.self = ctx;
  var ready = blobText(blobs[url]).then(function (src) { vm.createContext(ctx); vm.runInContext(src, ctx); });
  this.postMessage = function (data) { ready.then(function () { ctx.__d = data; try { vm.runInContext("self.onmessage({data: __d})", ctx, { timeout: 300 }); } catch (e) { /* stuck: no answer */ } }); };
  this.terminate = function () { dead = true; };
};
var modelReplies = [], modelCalls = [];
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new TypeError("no library"));
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-4B-Q4_K_M.gguf" }] }));
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false, audio: false } }));
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var r = modelReplies.length ? modelReplies.shift() : "ANSWER: ok";
  if (typeof r === "function") r = r(body);
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }));
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; }).pop(); }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function msgs(list, re) { return list.some(function (p) { return re.test(p.msg); }); }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern;
  ok("boot clean", errs.length === 0, errs);

  // --- the tile, and Turtle Code for beginners ---
  ok("Code Lab is a tile, right after Turtle Code", L.apps.codelab && L.apps.codelab.name === "Code Lab" && L.order.indexOf("codelab") === L.order.indexOf("code") + 1, L.order.slice(0, 40));
  ok("the turtle tile is Turtle Code, for beginners and children", L.apps.code.name === "Turtle Code" && /beginners and children/.test(L.apps.code.desc));
  ok("both have help guides", L.guide.has("codelab") && L.guide.get("codelab").title === "Code Lab - Help & Tutorial" && L.guide.has("code"));
  var gtext = L.guide.get("codelab").sections.map(function (s) { return s[0] + " " + s[1]; }).join(" ");
  ["https://www.arduino.cc/en/software", "https://arduino.github.io/arduino-cli/", "https://facts-engineering.github.io/", "package_productivity-P1AM-boardmanagermodule_index.json",
    "https://www.python.org/downloads/", "https://thonny.org/", "https://www.raspberrypi.com/software/", "https://micropython.org/download/", "https://nodejs.org/en/download",
    "https://autonomylogic.com/", "https://beremiz.org/", "https://www.codesys.com/"].forEach(function (u) { ok("the guide links " + u, gtext.indexOf(u) >= 0); });
  ok("the guide has the ladder reference and library setup", /Ladder rung text: reference/.test(gtext) && /AccelStepper/.test(gtext) && /TMCStepper/.test(gtext) && /1-Wire/.test(gtext));
  ok("the Chat and Turtle guides point to Code Lab", L.guide.get("chat").sections.some(function (s) { return /Code Lab/.test(s[0]); }) &&
    L.guide.get("code").sections.some(function (s) { return /Code Lab/.test(s[1]); }));

  // --- languages ---
  var CL = L.codeLangs;
  ok("five languages", CL.list.map(function (l) { return l.id; }).join(",") === "arduino,python,javascript,st,ladder");
  ok("every language says where to get its tools", CL.list.every(function (l) { return l.install && l.install.length && l.install.some(function (t) { return /^https:\/\//.test(t.url) || l.id === "javascript"; }); }));
  ok("files by extension", CL.byExt("a.ino") === "arduino" && CL.byExt("b.PY") === "python" && CL.byExt("c.js") === "javascript" && CL.byExt("d.st") === "st" && CL.byExt("e.lad") === "ladder" && CL.byExt("f.txt") === null);
  ok("a language guessed from the code", CL.guess("void setup() {}\nvoid loop() {}") === "arduino" && CL.guess("import time\nprint(1)") === "python" &&
    CL.guess("PROGRAM M\nVAR\nA : BOOL;\nEND_VAR\nEND_PROGRAM") === "st" && CL.guess("XIC(A)OTE(B);") === "ladder" && CL.guess("console.log(1);") === "javascript");

  // --- the highlighter ---
  var hl = L.codeHighlight.html("// note <b>\nif (x < 3) { digitalWrite(13, HIGH); }\n", "arduino");
  ok("highlighting: comments, keywords, built-ins, numbers; < is escaped", /class="cl-c"[^>]*>\/\/ note &lt;b&gt;/.test(hl) && /class="cl-k"[^>]*>if</.test(hl) &&
    /class="cl-b"[^>]*>digitalWrite</.test(hl) && /class="cl-n"[^>]*>13</.test(hl) && !/<b>/.test(hl), hl);
  ok("ST is not case-sensitive, Python strings and comments", /cl-k[^>]*>if</i.test(L.codeHighlight.html("if A then", "st")) &&
    /cl-s/.test(L.codeHighlight.html("x = 'a # b'  # c", "python")) && /cl-c[^>]*># c/.test(L.codeHighlight.html("x = 'a # b'  # c", "python")));

  // --- checks, language by language ---
  var C = L.codeCheck;
  var good = { arduino: "void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  unsigned long now = millis();\n  digitalWrite(13, (now / 500) % 2);\n  Serial.println(now);\n}\n",
    python: "def main():\n    for i in range(3):\n        print(i)\n\n\nif __name__ == \"__main__\":\n    main()\n",
    javascript: "function f(a) {\n  return a * 2;\n}\nconsole.log(f(2));\n",
    st: "PROGRAM Main\nVAR\n    Start : BOOL;\n    Run : BOOL;\nEND_VAR\nIF Start THEN\n    Run := TRUE;\nEND_IF;\nEND_PROGRAM\n",
    ladder: "// seal-in\n[XIC(Start) ,XIC(Motor) ]XIO(Stop)OTE(Motor);\n" };
  Object.keys(good).forEach(function (k) { ok("good " + k + " passes", C.run(k, good[k]).length === 0, C.run(k, good[k])); });
  var a1 = C.run("arduino", "void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n}\n");
  ok("Arduino: a missing ; on its line", a1.length === 1 && a1[0].line === 2 && /missing a ;/.test(a1[0].msg), a1);
  var a2 = C.run("arduino", "void loop() {\n  digitalWrite(7, HIGH);\n  Serial.println(1);\n  analogWrite(7, 100);\n  int t = millis();\n}\n");
  ok("Arduino: no setup, Serial never started, no pinMode, no PWM on 7, millis in an int", msgs(a2, /no void setup/) && msgs(a2, /Serial\.begin/) && msgs(a2, /pinMode\(7, OUTPUT\)/) &&
    msgs(a2, /only pins 3, 5, 6, 9, 10 and 11/) && msgs(a2, /not an unsigned long/), a2);
  ok("Arduino: a library used without its #include", msgs(C.run("arduino", "AccelStepper m(1, 2, 3);\nvoid setup() {}\nvoid loop() { m.run(); }\n"), /#include <AccelStepper\.h>/));
  ok("Arduino: delay() where AccelStepper must keep running", msgs(C.run("arduino", "#include <AccelStepper.h>\nAccelStepper m(1, 2, 3);\nvoid setup() {}\nvoid loop() {\n  m.run();\n  delay(100);\n}\n"), /delay/));
  ok("Arduino: the P1AM used before P1.init()", msgs(C.run("arduino", "#include <P1AM.h>\nvoid setup() {}\nvoid loop() {\n  P1.writeDiscrete(HIGH, 1, 1);\n}\n"), /P1\.init/));
  var p1 = C.run("python", "for i in range(3)\n    print(i)\n");
  ok("Python: a missing colon", p1[0] && p1[0].line === 1 && /colon/.test(p1[0].msg), p1);
  var p2 = C.run("python", "def f():\n\tx = 1\n        return x\nprint \"hi\"\n");
  ok("Python: mixed tabs and Python 2 print", msgs(p2, /tabs and spaces/) && msgs(p2, /print needs brackets/), p2);
  ok("JavaScript: what stops it compiling", msgs(C.run("javascript", "function f( {\n}\n"), /JavaScript says/));
  var s1 = C.run("st", "PROGRAM Main\nVAR\n  A : BOOL;\nEND_VAR\nIF A THEN\n  A = FALSE;\nEND_PROGRAM\n");
  ok("ST: = used to assign, an IF never closed", msgs(s1, /assign with :=/) && msgs(s1, /needs END_IF/), s1);
  ok("ST: a reserved word as a name", msgs(C.run("st", "PROGRAM Main\nVAR\n  Step : INT;\nEND_VAR\nStep := 1;\nEND_PROGRAM\n"), /reserved word/));
  var l1 = C.run("ladder", "XIC(A)FOO(B);\n[XIC(A) , ]OTE(B);\nXIC(C)OTE(B);\n");
  ok("ladder: unknown instruction, empty leg, one coil in two rungs", msgs(l1, /FOO is not a ladder instruction/) && msgs(l1, /leg 2 of this branch is empty/) && msgs(l1, /driven by OTE in rungs 2 and 3/), l1);
  ok("ladder: wrong argument count, no ;", msgs(C.run("ladder", "XIC(A,B)OTE(C);"), /XIC takes 1 argument/) && msgs(C.run("ladder", "XIC(A)OTE(C)"), /does not end with ;/));

  // --- ladder: rungs, Structured Text, the drawing ---
  var pr = L.codeLadder.parse(good.ladder);
  ok("a rung with a branch, and its comment", pr.rungs.length === 1 && pr.rungs[0].items[0].op === "BRANCH" && pr.rungs[0].items[0].legs.length === 2 && pr.rungs[0].comment === "seal-in");
  var st = L.codeLadder.toST(pr.rungs, "Main");
  ok("ladder to Structured Text: the seal-in, declared, and it passes the ST checks", /Motor := \(+Start\) OR \(Motor\)+ AND NOT Stop;/.test(st) && /Start : BOOL;/.test(st) && C.run("st", st).length === 0, st);
  var st2 = L.codeLadder.toST(L.codeLadder.parse("XIC(Level)TON(Delay,5000,0);\nXIC(Delay.DN)OTE(Pump);\n").rungs, "Main");
  ok("ladder timers become TON calls, .DN becomes .Q", /Delay : TON;/.test(st2) && /Delay\(IN := .*PT := T#5000ms\);/.test(st2) && /Pump := .*Delay\.Q/.test(st2), st2);
  var svg = L.codeLadderView.svg(pr.rungs);
  ok("the ladder is drawn: contacts, a coil, the comment", svg && /svg/i.test(svg.tagName) && /Start/.test(svg.textContent) && /Motor/.test(svg.textContent) && /seal-in/.test(svg.textContent));

  // --- JavaScript in the sandbox ---
  var r1 = await L.codeRun.js("console.log('hi', 1 + 1); console.log({a: 1});");
  ok("JavaScript runs in the sandbox and its output comes back", !r1.error && r1.lines.map(function (x) { return x.text; }).join("|") === "hi 2|{\"a\":1}", r1);
  var r2 = await L.codeRun.js("null.x;");
  ok("an error is reported", /TypeError/.test(r2.error || ""), r2);
  var r3 = await L.codeRun.js("while (true) {}", { timeout: 600 });
  ok("a loop that never ends is stopped", r3.timedOut && /does a loop never end/.test(r3.error), r3);
  ok("the sandbox cannot see the page", /ReferenceError|undefined/.test(((await L.codeRun.js("console.log(typeof document, typeof localStorage)")).lines[0] || {}).text || "ReferenceError"));

  // --- every tested example passes its own checks ---
  var EX = L.codeExamples;
  ok("45 tested examples in every language", EX.length >= 45 && ["arduino", "python", "javascript", "st", "ladder"].every(function (k) { return EX.some(function (x) { return x.lang === k; }); }), EX.length);
  var bad = EX.filter(function (x) { return C.run(x.lang, x.text).length; }).map(function (x) { return x.id + ": " + JSON.stringify(C.run(x.lang, x.text)); });
  ok("every example passes Lantern's checks", !bad.length, bad);
  ok("example ids are unique", Object.keys(EX.reduce(function (o, x) { o[x.id] = 1; return o; }, {})).length === EX.length);

  // --- files ---
  var F = L.codeFiles, n0 = F.list().length;
  var f1 = F.add({ name: "pump.ino", lang: "arduino", text: good.arduino });
  var f2 = F.add({ name: "pump", lang: "arduino", text: "" });
  ok("files: added, names kept unique, the extension comes from the language", F.list().length === n0 + 2 && f2.name === "pump (2)" && F.fileName(f1) === "pump.ino");
  ok("a new file of a language starts from its template", F.add({ name: "x", lang: "st" }).text.indexOf("PROGRAM Main") === 0);
  F.download(f1);
  ok("Save to computer names the file", downloads.pop() === "pump.ino");

  // --- the Code Lab tile ---
  go("codelab"); await sleep(60);
  var ta = d.querySelector("textarea.cl-ta");
  ok("Code Lab opens with the editor and its buttons", ta && btn(d, "\u2713 Check") && btn(d, "Find / replace") && d.querySelector("select[aria-label=\"Examples\"]") && d.querySelector("select[aria-label=\"Language\"]"));
  var lab = d.querySelector("textarea.cl-ta").closest(".wrap"), langSel = lab.querySelector("select[aria-label=\"Language\"]");
  langSel.value = "arduino"; fire(langSel, "change"); await sleep(20);
  ta = d.querySelector("textarea.cl-ta");
  ta.value = "void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}\n"; fire(ta, "input");
  btn(lab, "\u2713 Check").click(); await sleep(20);
  ok("Check lists the problem with its line, and marks the margin", /line 2/.test(d.body.textContent) && /missing a ;/.test(d.body.textContent) && d.querySelector(".bad"));
  var exSel = d.querySelector("select[aria-label=\"Examples\"]"), nf = F.list().length;
  exSel.value = "ladder-start-stop"; fire(exSel, "change"); await sleep(40);
  ok("an example opens as a new file of its own", F.list().length === nf + 1 && F.current().lang === "ladder" && /OTE\(Motor\)/.test(d.querySelector("textarea.cl-ta").value));
  btn(d, "Ladder \u2192 Structured Text").click(); await sleep(40);
  ok("Ladder \u2192 Structured Text opens a new ST file", F.current().lang === "st" && /END_PROGRAM/.test(F.current().text));

  // --- the AI: MAKE CODE in Chat ---
  await L.ai.detect();
  go("chat"); await sleep(40);
  function chatAsk(text) { var cin = d.querySelector("input[aria-label=\"Message\"]"); cin.value = text; modelCalls = []; btn(d, "Send").click(); }
  function logText() { return d.querySelector("[aria-label=\"Conversation\"]").textContent; }
  var blinkBad = "MAKE CODE: Blink pin 13\nlanguage arduino\n```cpp\n// Blink: the built-in LED on and off\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH)\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}\n```\nEND";
  modelReplies = [blinkBad, function (body) { var last = body.messages[body.messages.length - 1].content; return /line 7: this line may be missing a ;/.test(last) ? blinkBad.replace("HIGH)\n", "HIGH);\n") : "?"; }];
  var before = logText().length;
  chatAsk("Write an Arduino sketch to blink the LED"); await sleep(250);
  var t = logText().slice(before);
  ok("Chat: the AI is told how to MAKE CODE, with the tested Blink example", modelCalls.length === 2 && /MAKE CODE: <title>/.test(modelCalls[0].messages[0].content) &&
    /LANTERN\u2019S TESTED EXAMPLE/.test(modelCalls[0].messages[0].content) && /EXAMPLE 1: Blink \(Arduino/.test(modelCalls[0].messages[0].content), modelCalls.length);
  ok("Chat: the missing ; goes back once, the fixed sketch is shown", /Lantern checked the MAKE CODE block: line 7: this line may be missing a ;/.test(t) &&
    /Lantern made a program: Blink pin 13/.test(t) && /no problems found/.test(t) && !/still questions/.test(t), t.slice(-700));
  ok("Chat: it says the sketch was adapted from the tested example", /adapted from Lantern\u2019s tested example \u201cBlink\u201d/.test(t), t.slice(-400));
  ok("lines every sketch has do not make a program \u201cadapted\u201d", L.aiCodeExamples.sent["arduino-blink"] &&
    L.aiCodeExamples.basedOn("void setup() {\n  Serial.begin(9600);\n  pinMode(LED_BUILTIN, OUTPUT);\n}\nvoid loop() {\n  Serial.println(\"hello\");\n  delay(1000);\n}\n", "arduino") === null);
  ok("Chat: the code is shown once, the replies point at it", (t.match(/delay\(1000\);/g) || []).length === 2 && /\u2193 Blink pin 13 \u2014 a program, checked below/.test(t), (t.match(/delay\(1000\);/g) || []).length);
  var rt = L.aiAct.build("Here you go:\n```\nMAKE CODE: T\nlanguage python\nprint(1)\nprint(2)\nprint(3)\nEND\n```\nSave it as t.py.", "a python script").replyText;
  ok("the reply around a code block is kept, the block and its fences are not", rt === "Here you go:\n\u2193 T \u2014 a program, checked below\nSave it as t.py.", rt);
  ok("Chat: the code is shown coloured", d.querySelector(".la-make pre .cl-b"));
  btn(d, "Open in Code Lab").click(); await sleep(60);
  var cur = F.current();
  ok("Open in Code Lab: a new file, with its indents, and no fences", w.location.hash === "#codelab" && cur.name === "Blink pin 13" && cur.lang === "arduino" &&
    /\n  pinMode\(LED_BUILTIN, OUTPUT\);\n/.test(cur.text) && /\n\nvoid loop/.test(cur.text) && !/```/.test(cur.text), cur);
  var nOpen = F.list().length;
  F.setCurrent(F.list()[F.list().length - 1].id);
  L.codeDocs.open({ name: "Blink pin 13", lang: "arduino", text: cur.text }); await sleep(40);
  ok("opening the same code again does not copy it, and Code Lab shows it", F.list().length === nOpen && F.current().id === cur.id &&
    d.querySelector("textarea.cl-ta").value === cur.text);

  // JavaScript from the AI runs right there
  go("chat"); await sleep(40);
  modelReplies = ["MAKE CODE: Ohm\nlanguage javascript\n// current from volts and ohms\nfunction amps(v, r) {\n  return v / r;\n}\nconsole.log(\"I =\", amps(12, 6), \"A\");\nEND"];
  before = logText().length;
  chatAsk("Write a JavaScript function for current from voltage and resistance"); await sleep(200);
  t = logText().slice(before);
  ok("JavaScript from the AI: made, from its own knowledge", /Lantern made a program: Ohm/.test(t) && /written by the AI from its own knowledge/.test(t), t.slice(-400));
  btn(d, "\u25b6 Run here").click(); await sleep(400);
  ok("Run here prints its output under it", /I = 2 A/.test(logText()), logText().slice(-200));

  // ladder from the AI is drawn; a problem left after the one retry is said
  modelReplies = ["MAKE CODE: Pump\nlanguage ladder\nXIC(Float)OTE(Pump);\nXIC(Manual)OTE(Pump);\nEND", "MAKE CODE: Pump\nlanguage ladder\nXIC(Float)OTE(Pump);\nXIC(Manual)OTE(Pump);\nEND"];
  before = logText().length;
  chatAsk("Ladder for a pump on a float switch or a manual switch"); await sleep(200);
  t = logText().slice(before);
  ok("ladder from the AI: the double coil goes back, is still questioned, and the rungs are drawn", /driven by OTE in rungs 1 and 2/.test(t) && /still questions this/.test(t) &&
    d.querySelectorAll(".la-make svg").length >= 1, t.slice(-500));

  // EXAMPLE: the AI reads tested examples, then adapts one
  var homing = EX.filter(function (x) { return x.id === "arduino-stepper-homing"; })[0];
  modelReplies = ["EXAMPLE: stepper homing limit switch", function (body) {
    var last = body.messages[body.messages.length - 1].content;
    return /LANTERN\u2019S TESTED EXAMPLES/.test(last) && last.indexOf(homing.text.split("\n")[3]) >= 0 ?
      "MAKE CODE: Home the axis\nlanguage arduino\n" + homing.text.replace("HOME_SPEED", "HOME_SPEED") + "END" : "?"; }];
  before = logText().length;
  chatAsk("I need code to home my stepper motor axis"); await sleep(250);
  t = logText().slice(before);
  ok("EXAMPLE: Lantern sends its tested examples, with buttons", /Lantern sent the AI its tested examples? \u201cStepper homing on a limit switch\u201d/.test(t) && btn(d, "Open in Code Lab"), t.slice(0, 400));
  ok("EXAMPLE: the program made from it says so", /Lantern made a program: Home the axis/.test(t) && /adapted from Lantern\u2019s tested example \u201cStepper homing on a limit switch\u201d/.test(t), t.slice(-500));
  ok("EXAMPLE is a command the AI is told about", (L.chatCommands || []).some(function (c) { return c.verb === "EXAMPLE" && /EXAMPLE: </.test(c.usage); }));
  var srch = L.aiCodeExamples.search("ladder pump alternation");
  ok("example search: the language named counts", srch[0].ex.id === "ladder-pump-alternation" && L.aiCodeExamples.search("raspberry pi temperature")[0].ex.id === "python-pi-ds18b20", srch.slice(0, 3).map(function (x) { return x.ex.id + " " + x.score; }));
  ok("no tested example: said plainly", /no tested example/.test((await L.chatCommands.filter(function (c) { return c.verb === "EXAMPLE"; })[0].run("quantum flux capacitor", "x")).prompt));

  // code written straight into a reply
  modelReplies = ["From my own knowledge: here is a loop.\n```python\nfor i in range(3)\n    print(i)\n    print(i * 2)\n```\nRun it with Python 3."];
  before = logText().length;
  chatAsk("How do I loop three times in Python?"); await sleep(200);
  t = logText().slice(before);
  ok("code in a reply is checked, with Open in Code Lab", /Code in this reply: Python, 3 lines/.test(t) && /needs a colon/.test(t) && btn(d, "Open in Code Lab"), t.slice(-400));
  modelReplies = ["The output:\n```text\nI = 2 A\nP = 24 W\nR = 6 ohm\n```"];
  before = logText().length;
  chatAsk("What does the Ohm program print?"); await sleep(200);
  ok("output in a fence is left alone", !/Code in this reply/.test(logText().slice(before)));
  ok("fenced blocks: a tag Code Lab knows, or code that looks like code", L.chatCode.blocks("```\nx = 1\ny = 2\nz = 3\n```").length === 0 &&
    L.chatCode.blocks("```\nimport time\nwhile True:\n    time.sleep(1)\n```")[0].lang === "python" && L.chatCode.blocks("```st\nA := 1;\nB := 2;\nC := 3;\n```")[0].lang === "st");

  // the MAKE CODE block itself
  var pb = L.aiCode.parse({ title: "t", raw: ["", "language structured text", "PROGRAM Main", "    A := 1;", "", "END_PROGRAM", ""] });
  ok("a block: its language line read, indents and blank lines kept", pb.lang === "st" && pb.text === "PROGRAM Main\n    A := 1;\n\nEND_PROGRAM\n", pb);
  ok("an unknown language is a problem; no language line is guessed", /not one Lantern knows/.test(L.aiCode.parse({ raw: ["language cobol", "x"] }).problems[0]) &&
    L.aiCode.parse({ raw: ["import os", "print(os.name)"] }).lang === "python");
  var fb = L.aiAct.find("MAKE CODE: x\nlanguage python\nif a:\n    b()\nEND_IF_NOT_A_THING = 1\n\nEND");
  ok("only a bare END ends a code block", fb.length === 1 && fb[0].raw.length === 5 && fb[0].closed, fb[0] && fb[0].raw);
  ok("the code action is only offered for code questions", L.aiAct.relevant("write a python script").some(function (a) { return a.id === "code"; }) &&
    !L.aiAct.relevant("what is the capital of France").some(function (a) { return a.id === "code"; }));

  var lp = L.suite.passages("how do I install the Arduino IDE and the P1AM board?", "install arduino P1AM board", { detail: true, max: 3 });
  ok("LESSON: Code Lab's guide is one of Lantern's own lessons", lp.some(function (x) { return /Code Lab/.test(x.title) && /boardmanager|Boards Manager/.test(x.text); }), lp.map(function (x) { return x.title; }));

  // --- Lantern Bench: programs ---
  var BQ = (L.aiBenchQuestions || []).filter(function (q) { return /^code-/.test(q.id); });
  function gradeCode(item, reply) { return L.aiBench.grade(item, reply, { made: L.aiAct.build(reply, item.q) }); }
  ok("seven program questions on the bench", BQ.length === 7 && BQ.every(function (q) { return q.cat === "make" && q.kind === "CODE"; }), BQ.length);
  var bf = BQ.filter(function (q) { return !gradeCode(q, q.ideal).pass; }).map(function (q) { return q.id + ": " + gradeCode(q, q.ideal).why; });
  ok("every program question passes with its ideal reply", !bf.length, bf);
  var bq1 = BQ.filter(function (q) { return q.id === "code-blink-millis"; })[0];
  ok("bench: a blink with delay() fails, and says why", gradeCode(bq1, "MAKE CODE: b\nlanguage arduino\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\nEND").why === "it uses delay()");
  var bq2 = BQ.filter(function (q) { return q.id === "code-ladder-start-stop"; })[0];
  ok("bench: ladder with no seal-in fails", /no seal-in/.test(gradeCode(bq2, "MAKE CODE: m\nlanguage ladder\nXIC(Start)XIC(Stop)OTE(Motor);\nEND").why));
  ok("bench: Python for an Arduino question is the wrong language", /written in python, not arduino/.test(gradeCode(bq1, "MAKE CODE: b\nlanguage python\nimport time\nprint(1)\nprint(2)\nEND").why));

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? fails + " CODE LAB FAILURES (" + passes + " passed)" : "ALL CODE LAB TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack || e); process.exit(1); });
