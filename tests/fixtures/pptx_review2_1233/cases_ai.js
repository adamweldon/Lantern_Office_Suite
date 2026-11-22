// cases_ai.js -- the stop rule of 1.24.33 (AI_ACTIONS' build, AI_ENGINE's callServer): a block the model ended itself
// (the server's finish "stop") without END is read as ended; one cut off ("length"), another reply than the server's
// last, or no finish, as before. Each case has a scripted server reply and finish, goes through Lantern.ai.complete (as
// Chat's turns do: the reply cleaned of <think>, read by AI_READ) and Lantern.aiAct.build, and is judged by what the
// person gets: a whole block built without a question, a cut one questioned, and nothing that is not the block in it.
"use strict";
var H = require("./h.js");
var qS = "Make a short slide deck on changing a tyre", qT = "Make a shopping list table with prices", qC = "Write an Arduino program to blink an LED on pin 13", qD = "Write a short document on checking tyre pressure";
async function ask(content, finish, q) {
  var o = H.get(), L = o.L;
  o.next = { content: content, finish: finish };
  return L.ai.complete([{ role: "user", content: q }], { question: q });
}
function cut(r) { return (r && r.problems || []).some(function (p) { return /cut off before END/.test(p); }); }
function C(id, harm, input, right, f) {
  return { id: id, harm: harm, input: input, right: right, run: function () { return Promise.resolve().then(f).then(function (r) { return r || ""; }, function (e) { return "threw: " + String(e && e.message || e).slice(0, 300); }); } };
}
var TYRE = "MAKE SLIDES: Changing a tyre\n# Changing a tyre\n- Park on flat ground\n- Loosen the nuts\n- Jack it up";
var TYRE_LONG = "MAKE SLIDES: Changing a tyre\n# Before you start\n- Park on flat, firm ground away from traffic\n- Put the hazard lights on and the handbrake\n# Loosen and lift\n- Loosen each wheel nut half a turn while the wheel is on the ground\n- Jack under the sill mark until the tyre clears\n# Swap and tighten\n- Fit the spare and tighten the nuts in a star pattern";
var BLINK = "MAKE CODE: Blink\nlanguage arduino\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}";
function lines(r) { return r && r.block ? r.block.lines : []; }
var cases = [
  C("ai-stop-whole", "high", "a deck block with no END, the server's finish “stop”", "built, nothing questioned as cut off",
    async function () { var t = await ask(TYRE, "stop", qS), r = H.L().aiAct.build(t, qS); return r && r.ok && !cut(r) ? "" : "problems " + JSON.stringify(r && r.problems); }),
  C("ai-length-cut", "high", "the same block, finish “length” (out of tokens)", "questioned as cut off before END",
    async function () { var t = await ask(TYRE, "length", qS), r = H.L().aiAct.build(t, qS); return cut(r) ? "" : "not questioned: " + JSON.stringify(r && r.problems); }),
  C("ai-no-finish", "medium", "the same block from a server that gives no finish (Ollama's own reply shape, an old server)", "as before: questioned as cut off",
    async function () { var t = await ask(TYRE, undefined, qS), r = H.L().aiAct.build(t, qS); return cut(r) ? "" : "not questioned: " + JSON.stringify(r && r.problems); }),
  C("ai-null-finish", "medium", "finish null", "as before", async function () { var t = await ask(TYRE, null, qS), r = H.L().aiAct.build(t, qS); return cut(r) ? "" : "not questioned"; }),
  C("ai-end-written", "medium", "a block with END, finish “stop”", "built (END is END)", async function () { var t = await ask(TYRE + "\nEND", "stop", qS), r = H.L().aiAct.build(t, qS); return r && r.ok ? "" : JSON.stringify(r && r.problems); }),
  C("ai-trailing-space", "medium", "a whole block ending in spaces and blank lines, finish “stop”", "built", async function () { var t = await ask(TYRE + "   \n\n  ", "stop", qS), r = H.L().aiAct.build(t, qS); return r && r.ok ? "" : JSON.stringify(r && r.problems); }),
  C("ai-think-long", "medium", "a <think> part, then a long whole block (over 200 characters), finish “stop”", "built", async function () { var t = await ask("<think>\nThe user wants slides.\n</think>\n" + TYRE_LONG, "stop", qS), r = H.L().aiAct.build(t, qS); return r && !cut(r) ? "" : JSON.stringify(r && r.problems); }),
  C("ai-think-short", "medium", "a <think> part, then a short whole block (three points, under 200 characters), finish “stop”", "built: the model ended it (the <think> part Lantern takes off is not the block's)",
    async function () { var t = await ask("<think>\nShort deck.\n</think>\n" + TYRE, "stop", qS), r = H.L().aiAct.build(t, qS); return r && !cut(r) ? "" : "questioned: " + JSON.stringify(r.problems); }),
  C("ai-read-head-short", "medium", "“= MAKE SLIDES: Tyre” (the = of a formula line, as the 0.8B and the 2B write it; AI_READ reads it as MAKE SLIDES) and three points, finish “stop”", "built: the model ended it",
    async function () { var t = await ask("= MAKE SLIDES: Tyre\n# Tyre\n- Park on flat ground\n- Jack it up", "stop", qS), r = H.L().aiAct.build(t, qS); return r && !cut(r) ? "" : "questioned: " + JSON.stringify(r.problems); }),
  C("ai-mid-line", "low", "a table whose last line stops mid-number (“Milk | 1 | 0.”), finish “stop”", "built as written (the model chose to stop; Lantern cannot know more)",
    async function () { var t = await ask("MAKE SHEET: Shopping\nItem | Qty | Price\nBread | 2 | 1.50\nMilk | 1 | 0.", "stop", qT), r = H.L().aiAct.build(t, qT); return r && !cut(r) ? "" : JSON.stringify(r && r.problems); }),
  C("ai-prose-after-slides", "high", "a deck block with no END, then a blank line and “I hope this helps with your talk!”, finish “stop”", "the sentence not put on a slide: the block ends where the deck's lines end (or it is questioned, as before)",
    async function () { var t = await ask(TYRE + "\n\nI hope this helps with your talk!", "stop", qS), r = H.L().aiAct.build(t, qS); var put = JSON.stringify(r && r.plan || "").indexOf("I hope this helps") >= 0; return put && r.ok ? "built with the sentence on the slide, nothing questioned: " + JSON.stringify((r.plan.slides || r.plan)[0]).slice(0, 200) : ""; }),
  C("ai-prose-after-sheet", "high", "a table block with no END, then “Let me know if you need more items.”, finish “stop”", "the sentence not made a row of the table",
    async function () { var t = await ask("MAKE SHEET: Shopping\nItem | Qty | Price\nBread | 2 | 1.50\nMilk | 1 | 0.90\n\nLet me know if you need more items.", "stop", qT), r = H.L().aiAct.build(t, qT); var put = lines(r).some(function (l) { return /Let me know/.test(l); }); return put && r.ok ? "built with the sentence as a row, nothing questioned (" + lines(r).length + " lines)" : ""; }),
  C("ai-prose-after-code", "high", "a CODE block (Arduino) with no END, then “This blinks the LED once a second.”, finish “stop”", "the sentence not made a line of the program (it would not compile)",
    async function () { var t = await ask(BLINK + "\n\nThis blinks the LED once a second.", "stop", qC), r = H.L().aiAct.build(t, qC); var code = r && r.plan && r.plan.text || ""; return /This blinks the LED/.test(code) && r.ok ? "the sentence is the program's last line, and nothing is questioned" : ""; }),
  C("ai-code-end-dot", "medium", "a CODE block ending “END.” (not a bare END), finish “stop”", "“END.” not a line of the program",
    async function () { var t = await ask(BLINK + "\nEND.", "stop", qC), r = H.L().aiAct.build(t, qC); var code = r && r.plan && r.plan.text || ""; return /^END\.$/m.test(code) && r.ok ? "“END.” kept as the program's last line, nothing questioned" : ""; }),
  C("ai-code-whole", "medium", "a whole CODE block with no END, finish “stop”", "built", async function () { var t = await ask(BLINK, "stop", qC), r = H.L().aiAct.build(t, qC); return r && r.ok ? "" : JSON.stringify(r && r.problems); }),
  C("ai-code-blank-lines", "medium", "a whole CODE block whose code has blank lines and ends with a blank line, finish “stop”", "built, the blank lines kept",
    async function () { var t = await ask(BLINK.replace("}\nvoid loop", "}\n\nvoid loop") + "\n\n", "stop", qC), r = H.L().aiAct.build(t, qC); return r && r.ok && /\}\n\nvoid loop/.test(r.plan.text) ? "" : JSON.stringify(r && r.problems); }),
  C("ai-two-blocks-last-open", "medium", "two deck blocks, the first with END, the second without, finish “stop”", "built; no cut-off question",
    async function () { var t = await ask("MAKE SLIDES: Tyre\n# Before\n- Park\nEND\nMAKE SLIDES: Tyre 2\n# After\n- Check the pressure", "stop", qS), r = H.L().aiAct.build(t, qS); return r && !cut(r) ? "" : "questioned: " + JSON.stringify(r && r.problems); }),
  C("ai-two-blocks-first-open", "low", "a document block with no END followed straight by a deck block with END, finish “stop” (the first block was ended by the second)", "the document not questioned as cut off (the model went on to the next block)",
    async function () { var t = await ask("MAKE DOC: Tyre pressure\n# Tyre pressure\nCheck the pressure when the tyres are cold, once a month and before a long trip. The right pressure is on a label inside the driver's door.\nMAKE SLIDES: Tyre\n# Tyre\n- Check it cold\nEND", "stop", qD), r = H.L().aiAct.build(t, qD); return r && !cut(r) ? "" : "questioned as cut off: " + JSON.stringify(r && r.problems); }),
  C("ai-older-reply", "high", "a block cut off (“length”), then another call that ended “stop”, then the first reply built again", "the first still questioned as cut off",
    async function () { var t1 = await ask(TYRE, "length", qS); await ask("ANSWER: Tyres need 32 psi.", "stop", "What pressure for my tyres?"); var r = H.L().aiAct.build(t1, qS); return cut(r) ? "" : "not questioned: " + JSON.stringify(r && r.problems); }),
  C("ai-older-whole", "medium", "a whole block (“stop”), then another call, then the first reply built again", "as before 1.24.33: questioned (the rule is for the server's last reply only)", async function () { var t1 = await ask(TYRE, "stop", qS); await ask("ANSWER: ok", "stop", "Thanks"); var r = H.L().aiAct.build(t1, qS); return cut(r) ? "" : "not questioned"; }),
  C("ai-runaway-stop", "medium", "a drawing block that repeats one line, counting up, 40 times, then stops (“stop”)", "the run still found and left out",
    async function () { var q = "Draw a picture of a fence"; var ls = ["MAKE DRAWING: Fence", "grid 120 60"]; for (var i = 0; i < 40; i++) ls.push("rect " + (2 + i) + " 30 1 10 fill brown"); var t = await ask(ls.join("\n"), "stop", q), r = H.L().aiAct.build(t, q); return r && r.runaway ? "" : "no run found: " + JSON.stringify(r && r.problems).slice(0, 200); }),
  C("ai-lastreply-kept", "low", "any server reply", "Lantern.ai.lastReply is the reply as the server sent it, lastFinish its finish",
    async function () { await ask("<think>x</think>\nANSWER: 4", "stop", "2+2?"); var A = H.L().ai; return A.lastReply === "<think>x</think>\nANSWER: 4" && A.lastFinish === "stop" ? "" : JSON.stringify([A.lastReply, A.lastFinish]); })
];
module.exports = cases;
