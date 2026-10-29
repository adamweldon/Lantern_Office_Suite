// codelab_audit.js -- Code Lab after the app audit (1.16.0): Find keeps the
// cursor in its box (a second Enter typed a line break over the match);
// Replace all, Tab and Ctrl+/ on hundreds of lines change only those lines
// and are quick; Ctrl+Z takes back a word, not a letter; Ctrl+/ takes off one
// marker; red line numbers move with their lines; a typed extension picks
// the language; NOT saved when the store is full; opening a file does not
// date it; the last keys are saved on close; JavaScript errors have a line;
// Python one-line blocks and the last item of an Arduino enum are not
// mistakes; a ladder rung whose ; was left out stays a rung of its own; tags
// ignore case; Ladder -> Structured Text for TOF, RTO, RES, CTU with CTD,
// CTD alone, presets written by MOV, LIM outside a band, Logix tag names,
// OSR; not from ladder with mistakes; Run prints NaN, Map, errors ..., waits
// for its timers and says when output was cut; wide and long-tagged ladder.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path"), vm = require("vm");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document, prompts = [];
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.prompt = function () { return prompts.length ? prompts.shift() : null; };
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
// the sandbox's boot script in a fresh vm context, as in code_lab.js
var blobs = {};
w.URL.createObjectURL = function (b) { var id = "blob:t" + Math.random(); blobs[id] = b; return id; };
w.URL.revokeObjectURL = function () {};
function blobText(b) {
  if (b.text) return b.text();
  return new Promise(function (ok) { var r = new w.FileReader(); r.onload = function () { ok(String(r.result)); }; r.readAsText(b); });
}
w.Worker = function (url) {
  var me = this, dead = false, ctx = { setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval, JSON: JSON };
  ctx.postMessage = function (m) { setTimeout(function () { if (!dead && me.onmessage) me.onmessage({ data: m }); }, 0); };
  ctx.self = ctx;
  var ready = blobText(blobs[url]).then(function (src) { vm.createContext(ctx); vm.runInContext(src, ctx); });
  this.postMessage = function (data) { ready.then(function () { ctx.__d = data; try { vm.runInContext("self.onmessage({data: __d})", ctx, { timeout: 300 }); } catch (e) { /* stuck */ } }); };
  this.terminate = function () { dead = true; };
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fire(el, t) { var e = d.createEvent("Event"); e.initEvent(t, true, true); el.dispatchEvent(e); }
function btn(re) { return Array.prototype.filter.call(d.querySelectorAll("button"), function (b) { return re.test(b.textContent); })[0]; }
function key(el, k, o) { var opts = { key: k, bubbles: true, cancelable: true }; Object.keys(o || {}).forEach(function (x) { opts[x] = o[x]; }); var e = new w.KeyboardEvent("keydown", opts); el.dispatchEvent(e); return e; }
function msgs(list, re) { return list.some(function (p) { return re.test(p.msg); }); }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, F = L.codeFiles, C = L.codeCheck;
  w.location.hash = "codelab"; fire(w, "hashchange"); await sleep(60);
  var ta = d.querySelector("textarea.cl-ta");
  function edit(text) { ta.value = text; fire(ta, "input"); }
  function typeText(s) { for (var i = 0; i < s.length; i++) { var p = ta.selectionEnd; ta.setRangeText(s.charAt(i), p, p, "end"); fire(ta, "input"); } }

  // --- Find keeps the focus; the match is marked ---------------------------------------------------
  edit("led = 1;\nled = 2;\nled = 3;\n");
  btn(/Find \/ replace/).click();
  var find = d.querySelector("input[aria-label='Find']");
  find.focus(); find.value = "led";
  key(find, "Enter"); key(find, "Enter");
  ok("Find, Enter, Enter: the second match is selected, the code unchanged, the cursor still in Find",
    ta.value === "led = 1;\nled = 2;\nled = 3;\n" && ta.selectionStart === 9 && d.activeElement === find, [ta.selectionStart, d.activeElement && d.activeElement.getAttribute("aria-label")]);
  ok("...and the match is marked in the code", (d.querySelector(".cl-fd mark") || {}).textContent === "led");
  key(find, "Escape");
  ok("Esc in Find goes back to the code", d.activeElement === ta && d.querySelector(".cl-fd").style.display !== "x" && !d.querySelector(".cl-fd mark"));

  // --- big edits: quick, and one undo ---------------------------------------------------------------
  var big = []; for (var i = 1; i <= 600; i++) big.push("  digitalWrite(" + (i % 14) + ", HIGH); // led " + i);
  edit(big.join("\n"));
  var ed = null;
  find.value = "HIGH"; d.querySelector("input[aria-label='Replace with']").value = "LOW";
  var t0 = Date.now(); btn(/Replace all/).click(); var ms = Date.now() - t0;
  ok("Replace all on 600 lines: done quickly (" + ms + " ms) and right", ms < 1500 && ta.value.indexOf("HIGH") < 0 && (ta.value.match(/LOW/g) || []).length === 600, ms);
  key(ta, "z", { ctrlKey: true });
  ok("...and one Ctrl+Z puts every HIGH back", (ta.value.match(/HIGH/g) || []).length === 600 && ta.value.indexOf("LOW") < 0);
  key(ta, "y", { ctrlKey: true });
  ok("...Ctrl+Y does it again", (ta.value.match(/LOW/g) || []).length === 600);
  ta.setSelectionRange(0, ta.value.length);
  t0 = Date.now(); key(ta, "Tab"); ms = Date.now() - t0;
  ok("Tab on 600 selected lines indents them all, quickly", ms < 1500 && ta.value.split("\n").every(function (l) { return /^    digitalWrite/.test(l); }), ms);
  key(ta, "z", { ctrlKey: true });
  ok("...one Ctrl+Z takes the indent back", ta.value.split("\n").every(function (l) { return /^  digitalWrite/.test(l); }));

  // --- undo a word at a time -----------------------------------------------------------------------------
  edit(""); await sleep(5);
  ta.setSelectionRange(0, 0);
  var lastStep = Date.now();
  typeText("int a = 1;");
  key(ta, "z", { ctrlKey: true });
  ok("typing, then Ctrl+Z: the last word goes (not one letter)", ta.value === "int a =", JSON.stringify(ta.value));
  key(ta, "z", { ctrlKey: true });
  ok("...again: the word before it", ta.value === "int a", JSON.stringify(ta.value));
  key(ta, "z", { ctrlKey: true, shiftKey: true });
  ok("...Ctrl+Shift+Z brings it back", ta.value === "int a =", JSON.stringify(ta.value));

  // --- Ctrl+/ takes off one marker ------------------------------------------------------------------------
  edit("void loop() {\n  // // LED on\n}\n");
  ta.setSelectionRange(16, 16);
  key(ta, "/", { ctrlKey: true });
  ok("Ctrl+/ on “// // LED on” leaves “// LED on” (it took both off and made it code)", ta.value.split("\n")[1] === "  // LED on", ta.value.split("\n")[1]);

  // --- red numbers move with their lines ---------------------------------------------------------------------
  edit("void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}\n");
  btn(/Check$/).click(); await sleep(10);
  ok("(line 2 is marked)", d.querySelector(".cl-gut .bad") && d.querySelector(".cl-gut .bad").textContent === "2");
  ta.setSelectionRange(0, 0); typeText("\n");
  ok("a line added above: the red number moves to line 3", d.querySelector(".cl-gut .bad") && d.querySelector(".cl-gut .bad").textContent === "3", (d.querySelector(".cl-gut .bad") || {}).textContent);
  ok("problem rows open with Enter too", Array.prototype.every.call(d.querySelectorAll(".convbox [role=button]"), function (r) { return typeof r.onkeydown === "function"; }));

  // --- files: extension, saved, dates, close -------------------------------------------------------------------
  var lab = ta.closest(".wrap"), lang = lab.querySelector("select[aria-label='Language']");
  lang.value = "arduino"; fire(lang, "change"); await sleep(10);
  prompts.push("blink.py"); btn(/^New$/).click(); await sleep(20);
  ok("New “blink.py” while in Arduino: a Python file named blink", F.current().lang === "python" && F.current().name === "blink" && lang.value === "python", F.current());
  prompts.push("blink.st"); btn(/^Rename$/).click(); await sleep(20);
  ok("Rename to “blink.st”: now Structured Text", F.current().lang === "st" && F.current().name === "blink" && lang.value === "st", F.current());
  prompts.push("Motor v1.2"); btn(/^Rename$/).click(); await sleep(20);
  ok("“Motor v1.2” keeps its .2 (only a known extension comes off)", F.current().name === "Motor v1.2", F.current().name);
  var cur = F.current(), stamp = cur.updated;
  await sleep(15);
  var fsel = lab.querySelector("select[aria-label='File']");
  fsel.value = F.list()[1].id; fire(fsel, "change"); await sleep(10);
  fsel.value = cur.id; fire(fsel, "change"); await sleep(10);
  ok("opening a file and leaving it does not give it a new date", F.get(cur.id).updated === stamp);
  ta = d.querySelector("textarea.cl-ta");
  edit(ta.value + "\n(* last keys *)");
  fire(w, "pagehide");
  ok("the last keys are saved when the page closes (they waited 0.6 s and were lost)", /last keys/.test(F.get(cur.id).text));
  var realSet = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function (k) { if (/codelab\.files/.test(k)) { var e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } return realSet.apply(this, arguments); };
  edit(ta.value + "\n(* more *)"); await sleep(700);
  var status = Array.prototype.filter.call(d.querySelectorAll("span.muted"), function (s) { return /saved/i.test(s.textContent); })[0];
  ok("storage full: Code Lab says NOT saved (it said “saved on this device”)", status && /NOT saved/.test(status.textContent), status && status.textContent);
  w.Storage.prototype.setItem = realSet;
  edit(ta.value + "\n(* again *)"); await sleep(700);
  ok("...and saved again when there is room", status && status.textContent === "saved on this device");
  ok("the Examples and File menus fit a phone", /max-width:\s*100%/.test(lab.querySelector("select[aria-label='Examples']").getAttribute("style")) && /max-width/.test(fsel.getAttribute("style")));

  // --- checks ----------------------------------------------------------------------------------------------------
  function jsErr(list) { return list.filter(function (p) { return /JavaScript says/.test(p.msg); })[0] || {}; }
  var j1 = C.run("javascript", "function f() {\n  return 1;\n}\nvar x = (2;\nconsole.log(x);\n");
  ok("a JavaScript mistake says its line (it had none)", jsErr(j1).line === 4, j1);
  var j2 = C.run("javascript", "var a = 1\nvar b = {c: 1 d: 2};\n");
  ok("...an object missing a comma: line 2", jsErr(j2).line === 2, j2);
  var j3 = C.run("javascript", "function f(a) {\n  if (a) {\n    return 1;\n  }\n  retrun 2;\n}\n");
  ok("...a misspelt keyword on line 5", jsErr(j3).line === 5, j3);
  var py = "import sys\nfor line in sys.stdin:\n    if not line: continue\n    while True: break\ntry: import serial\nexcept ImportError: serial = None\nclass A: pass\n";
  ok("Python one-line blocks are not missing a colon", C.run("python", py).length === 0, C.run("python", py));
  ok("...a real missing colon still is", msgs(C.run("python", "if x\n    y = 1\n"), /needs a colon/));
  var en = "enum State {\n  IDLE,\n  RUNNING,\n  DONE\n};\nint pins[] = {\n  2,\n  3\n};\nvoid setup() {\n  int x = 1;\n}\nvoid loop() {}\n";
  ok("Arduino: the last item of an enum or a { } list is not missing a ;", C.run("arduino", en).length === 0, C.run("arduino", en));
  ok("...a statement before } still is", msgs(C.run("arduino", "void setup() {\n  int x = 1\n}\nvoid loop() {}\n"), /missing a ;/));

  // --- ladder ---------------------------------------------------------------------------------------------------
  var P = L.codeLadder.parse("XIC(A)OTE(B)\nXIC(C)OTE(D);\n");
  ok("a ; left out between two lines: said, and two rungs (they were joined into one)", P.rungs.length === 2 && msgs(P.problems, /does not end with ;/) && P.problems[0].line === 1, P);
  P = L.codeLadder.parse("// first\nXIC(A)OTE(B); // motor on\nXIC(C)OTE(D); // pump on\n");
  ok("a comment after a rung's ; is that rung's; the last one is kept", P.rungs[0].comment === "first motor on" && P.rungs[1].comment === "pump on", P.rungs.map(function (r) { return r.comment; }));
  ok("tags ignore case: OTE(Motor) and OTE(motor) are one coil in two rungs", msgs(L.codeLadder.parse("XIC(A)OTE(Motor);\nXIC(B)OTE(motor);\n").problems, /Motor is driven by OTE in rungs 1 and 2/));
  ok("one coil twice in one rung says so (not “rungs 1 and 1”)", msgs(L.codeLadder.parse("[XIC(A)OTE(M) ,XIC(B)OTE(M) ];\n").problems, /twice in rung 1/));
  ok("OSR and OSF are instructions", L.codeLadder.parse("XIC(A)OSR(Store,Pulse);\nXIC(Pulse)OTE(Light);\n").problems.length === 0, L.codeLadder.parse("XIC(A)OSR(Store,Pulse);\n").problems);

  function st(lad) { return L.codeLadder.toST(L.codeLadder.parse(lad).rungs, "Main"); }
  function stOk(s) { return C.run("st", s).filter(function (p) { return p.level === "error" || /not declared/.test(p.msg); }); }
  var s1 = st("XIC(Run)TOF(Fan,5000,0);\nXIC(Fan.TT)OTE(Cooling);\n");
  ok("TOF .TT is “timing after the rung went false”: NOT IN AND Q (it was always FALSE)", /Cooling := \(NOT Fan\.IN AND Fan\.Q\);/.test(s1) && !stOk(s1).length, s1);
  var s2 = st("XIC(Fast)MOV(2000,T1.PRE);\nXIC(Go)TON(T1,5000,0);\nXIC(T1.DN)OTE(Done);\n");
  ok("MOV(2000,T1.PRE): a preset variable, T#2000ms, used by the TON (it wrote TIME_TO_DINT(T1.PT) := 2000)",
    /T1_PRE : TIME := T#5000ms;/.test(s2) && /IF Fast THEN T1_PRE := T#2000ms; END_IF;/.test(s2) && /T1\(IN := Go, PT := T1_PRE\);/.test(s2) && !/TIME_TO_DINT\(T1\.PT\) :=/.test(s2) && !stOk(s2).length, [s2, stOk(s2)]);
  var s3 = st("XIC(Running)RTO(Hours,3600000,0);\nXIC(Hours.DN)OTE(Service);\nXIC(Serviced)RES(Hours);\n");
  ok("RTO keeps its time until RES, and RES resets it (it was dropped, and Service read an undeclared Hours.DN)",
    /Hours : TON;/.test(s3) && /Hours_ACC := Hours_ACC \+ Hours\.ET/.test(s3) && /Service := Hours_DN;/.test(s3) && /IF Serviced THEN Hours_ACC := T#0ms; Hours_DN := FALSE; Hours\(IN := FALSE\); END_IF;/.test(s3) && !stOk(s3).length, [s3, stOk(s3)]);
  var s4 = st("XIC(In)CTU(Count,10,0);\nXIC(Out)CTD(Count,10,0);\nXIC(Count.DN)OTE(Full);\nXIC(Clear)RES(Count);\n");
  ok("CTU and CTD on one tag: one CTUD (it declared a CTD and called it with CU)", /Count : CTUD;/.test(s4) && /Count\(CU := In, PV := 10\);/.test(s4) && /Count\(CD := Out, PV := 10\);/.test(s4) &&
    /Full := Count\.QU;/.test(s4) && /IF Clear THEN Count\(R := TRUE\); Count\(R := FALSE\); END_IF;/.test(s4) && !stOk(s4).length, [s4, stOk(s4)]);
  var s5 = st("XIC(Box)CTD(Left,0,0);\nXIC(Left.DN)OTE(Ok);\n");
  ok("CTD alone counts down as Logix does (a CTUD, done = count at or past the preset)", /Left : CTUD;/.test(s5) && /Ok := Left\.QU;/.test(s5), s5);
  var s6 = st("LIM(90,Temp,10)OTE(Alarm);\nLIM(Lo,Temp,Hi)OTE(InBand);\n");
  ok("LIM with low > high is outside the band (it was always FALSE); with tags, both cases", /Alarm := \(Temp >= 90 OR Temp <= 10\);/.test(s6) && /Lo > Hi/.test(s6) && !stOk(s6).length, s6);
  var s7 = st("XIC(Local:1:I.Data.0)XIC(Pump1.Ready)XIC(Bits[3])TON(Wait,Delay,0);\nXIC(Wait.DN)OTE(Go);\n");
  ok("Logix tag names become ST names, with the Logix name beside them; a preset tag times in ms", /Local_1_I_Data_0 : BOOL; \(\* Local:1:I\.Data\.0 \*\)/.test(s7) && /Pump1_Ready : BOOL;/.test(s7) &&
    /Bits_3 : BOOL;/.test(s7) && /PT := T#1ms \* Delay\)/.test(s7) && !stOk(s7).length, [s7, stOk(s7)]);
  var s8 = st("XIC(A)OTE(Motor);\nXIC(Motor)XIO(motor)OTE(B);\n");
  ok("Motor and motor are declared once", (s8.match(/Motor : BOOL/gi) || []).length === 1 && !/motor/.test(s8), s8);
  var s9 = st("XIC(Btn)OSR(Mem,Pulse);\n");
  ok("OSR: one scan on the rising edge", /Pulse := \(Btn\) AND NOT Mem;/.test(s9) && /Mem := Btn;/.test(s9) && !stOk(s9).length, s9);
  // every ladder example still converts to ST that passes the checks
  var exBad = L.codeExamples.filter(function (x) { return x.lang === "ladder"; }).map(function (x) { var s = st(x.text); return [x.id, stOk(s)]; }).filter(function (r) { return r[1].length; });
  ok("every ladder example becomes Structured Text that passes Check", !exBad.length, exBad);

  lang.value = "ladder"; fire(lang, "change"); await sleep(10);
  ta = d.querySelector("textarea.cl-ta");
  edit("XIC(A)XYZ(B)OTE(C);\n"); var nFiles = F.list().length;
  btn(/Ladder → Structured Text/).click(); await sleep(20);
  ok("Ladder → Structured Text with a mistake in it: the mistake is shown, no new file", F.list().length === nFiles && /Fix the mistakes/.test(d.body.textContent) && /XYZ is not a ladder instruction/.test(d.body.textContent));

  // --- the drawing ---------------------------------------------------------------------------------------------------
  var wide = []; for (i = 0; i < 20; i++) wide.push("XIC(I" + i + ")");
  var svg = L.codeLadderView.svg(L.codeLadder.parse(wide.join("") + "OTE(Q);\nXIC(A_very_long_tag_name_for_a_pump)OTE(B);\n").rungs);
  var vw = +svg.getAttribute("width");
  ok("a rung of 21 cells fits between the rails (it ran past the right one)", vw >= 21 * 104, vw);
  ok("it shrinks to fit no smaller than 3/4 size", svg.style.minWidth === Math.round(vw * 0.75) + "px", svg.style.minWidth);
  var tx = Array.prototype.map.call(svg.querySelectorAll("text"), function (t) { return t.firstChild.nodeValue; });
  ok("a long tag goes on two lines, split at a _ near the middle (16 letters ran into the next cell)", tx.indexOf("A_very_long_tag_") >= 0 && tx.indexOf("name_for_a_pump") >= 0, tx.slice(-6));
  var cut = L.codeLadderView.svg(L.codeLadder.parse("XIC(This_is_a_tag_name_that_is_far_too_long_to_show_whole_on_two_lines)OTE(B);\n").rungs);
  var lt = Array.prototype.filter.call(cut.querySelectorAll("text"), function (t) { return /\u2026/.test(t.firstChild.nodeValue); })[0];
  ok("...one too long even for two lines is cut with \u2026 and shown whole on hover", lt && /far_too_long/.test(lt.querySelector("title").textContent), lt && lt.textContent);

  // --- Run ---------------------------------------------------------------------------------------------------------------
  var R = L.codeRun;
  var r1 = await R.js("console.log(NaN, Infinity, undefined, null); console.log([1, NaN], {a: undefined}); console.log(new Error('bad'), new Map([['k', 1]]), new Set([1, 2]));");
  var txt = r1.lines.map(function (x) { return x.text; });
  ok("Run prints NaN, Infinity, undefined, errors, Map and Set as they are (JSON made them null and {})",
    txt[0] === "NaN Infinity undefined null" && txt[1] === "[1,NaN] {\"a\":undefined}" && txt[2] === "Error: bad Map(1) {\"k\" => 1} Set(2) {1, 2}", txt);
  var r2 = await R.js("console.log('start'); setTimeout(function () { console.log('later'); }, 400);");
  ok("a 400 ms timer fires before Run says finished (it waited only 250 ms)", r2.lines.map(function (x) { return x.text; }).join("|") === "start|later" && !r2.error, r2);
  var r3 = await R.js("var n = 0, id = setInterval(function () { console.log(++n); if (n === 3) clearInterval(id); }, 50);");
  ok("setInterval runs until it is cleared", r3.lines.length === 3 && !r3.error, r3);
  var r4 = await R.js("for (var i = 0; i < 700; i++) console.log(i);");
  ok("more than 500 lines: the run says the rest is not shown", r4.lines.length === 501 && r4.cut && /only the first 500/.test(r4.lines[500].text), r4.lines.length);
  var r5 = await R.js("setTimeout(function () { null.x; }, 20);");
  ok("an error inside a timer is reported", /TypeError/.test(r5.error || ""), r5);

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? "CODELAB AUDIT FAILED (" + fails + " of " + (fails + passes) + ")" : "ALL CODELAB AUDIT TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.log("CRASH", e && e.stack); process.exit(1); });
