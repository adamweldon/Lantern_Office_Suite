// replay_convert.js -- the third reviewer's CONVERT cases (rule B), replayed in jsdom on src/lantern.inner.html.
// Each case: a sheet (Lantern.sheetDocs.compute) and Chat (Lantern.formula.evaluate) must give the answer worked out
// from the exact definitions in convert_cases.js; Save .xlsx (Lantern.xlsx.write) must write Excel's names, or save
// the value with a note. Prints AGREE <id> / DISAGREE <id> <detail> [harm] per case, then the count.
// Usage: node tests/fixtures/round3_1269/replay_convert.js [inner.html]
"use strict";
var load = require("./load.js").load, K = require("./convert_cases.js");
var agree = 0, dis = 0, out = [];
function say(ok, id, detail, harm) {
  if (ok) { agree++; out.push("AGREE " + id); }
  else { dis++; out.push("DISAGREE " + id + " " + detail + (harm ? " [" + harm + "]" : "")); }
}
function close(a, b) { return typeof a === "number" && isFinite(a) && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)); }
function show(v) { return typeof v === "number" ? String(Number(v.toPrecision(15))) : JSON.stringify(v); }
load(function (o) {
  var L = o.L;
  K.cases.forEach(function (c) {
    var sheet, chat, chatErr = null;
    try { sheet = L.sheetDocs.compute({ A1: "=" + c.f }).A1; } catch (e) { sheet = "threw " + e.message; }
    try { chat = L.formula.evaluate(c.f); } catch (e) { chatErr = String(e.message || e); }
    if (c.err) {
      var sOk = typeof sheet === "string" && /^#(N\/A|VALUE!)/.test(sheet), cOk = chatErr !== null;
      say(sOk && cOk, c.id, "want an error in both; sheet " + show(sheet) + ", Chat " + (chatErr !== null ? "error" : show(chat)), "a number where none can be given");
      return;
    }
    var sOk2 = close(sheet, c.want), cOk2 = chatErr === null && close(chat, c.want);
    var what = [];
    if (!sOk2) what.push("sheet " + show(sheet));
    if (!cOk2) what.push("Chat " + (chatErr !== null ? "error: " + chatErr.slice(0, 120) : show(chat)));
    say(sOk2 && cOk2, c.id, "=" + c.f + " want " + show(c.want) + "; " + what.join(", "),
      typeof sheet === "number" || chatErr === null ? "a wrong number shown as the answer" : "no answer where Excel gives one");
  });
  K.sheets.forEach(function (c) {
    var cells = {}, k, v;
    for (k in c.sheet) cells[k] = c.sheet[k];
    try { v = L.sheetDocs.compute(cells)[c.at]; } catch (e) { v = "threw " + e.message; }
    if (c.err) say(typeof v === "string" && /^#/.test(v), c.id, c.at + " want an error, got " + show(v), "a number where Excel shows an error");
    else say(close(v, c.want), c.id, c.at + " want " + show(c.want) + ", got " + show(v), typeof v === "number" ? "a wrong number" : "an error where Excel gives a number");
  });
  K.saves.forEach(function (c) {
    var cells = {}, k;
    for (k in c.save) cells[k] = c.save[k];
    var values = L.sheetDocs.compute(cells), w, xml, notes;
    try { w = L.xlsx.write({ title: "check", cells: cells }, values); } catch (e) { say(false, c.id, "Save .xlsx threw " + e.message, "no file"); return; }
    xml = L.zip.read(w.bytes).text("xl/worksheets/sheet1.xml");
    notes = (w.notes || []).join(" | ");
    var m = new RegExp("<c r=\"" + c.at + "\"[^>]*?(?:/>|>([\\s\\S]*?)</c>)").exec(xml), body = m ? m[1] || "" : "";
    var fm = /<f[^>]*>([\s\S]*?)<\/f>/.exec(body), f = fm ? fm[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : null;
    if (c.wantF || c.wantFre) {
      var okF = c.wantF ? f === c.wantF : !!f && c.wantFre.test(f);
      say(okF, c.id, c.at + " written as " + JSON.stringify(f) + ", want " + JSON.stringify(c.wantF || String(c.wantFre)) + (notes ? "; notes: " + notes.slice(0, 200) : ""),
        f === null ? "the formula lost in the file" : "Excel shows #N/A or another number");
    } else {
      var hasAll = c.note.every(function (s) { return notes.indexOf(s) >= 0; });
      var noteFor = notes.indexOf(c.at) >= 0, vm = /<v>([^<]*)<\/v>/.exec(body), want = values[c.at];
      var valOk = f !== null || (vm && typeof want === "number" && close(+vm[1], want));
      var okN = f === null && hasAll && noteFor && valOk;
      say(okN, c.id, c.at + (f !== null ? " saved as the formula " + JSON.stringify(f) + " (Excel would show #N/A)" : " saved as its value" + (valOk ? "" : " but the value is " + (vm ? vm[1] : "missing") + ", not " + show(want))) +
        (hasAll && noteFor ? "" : "; the note should name " + JSON.stringify([c.at].concat(c.note)) + ", notes: " + JSON.stringify(notes.slice(0, 300))),
        f !== null ? "Excel shows #N/A where Lantern showed a number, unsaid" : "the person is not told what to write");
    }
  });
  out.forEach(function (l) { console.log(l); });
  if (o.errs.length) console.log("page errors: " + o.errs.join(" | "));
  console.log((agree + dis) + " cases: " + agree + " AGREE, " + dis + " DISAGREE");
}, process.argv[2]);
