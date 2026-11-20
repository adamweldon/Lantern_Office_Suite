// replay.js -- replays the review of draft 1.24.29 (excelnames_1269): GAMMA as Excel's gamma function, LORE for the
// Lorentz factor, CONVERT in a sheet as Excel's, Save .xlsx writing Excel's unit names, and an audit of every
// function name Lantern shares with Excel. The cases (cases.json, made by make_cases.py) were written by a reviewer
// that had not seen the change, from Microsoft's documentation and the exact unit definitions.
//
//   node tests/fixtures/excelnames_1269/replay.js [path/to/lantern.inner.html] [--only <id-prefix>] [--save <dir>]
//
// Prints AGREE <id> or DISAGREE <id> <detail> [harm] per case, then "<n> cases: <a> AGREE, <d> DISAGREE".
// --save <dir> writes each xlsx case's workbook as <dir>/<id>.xlsx (and expect.json) for lo_recalc.py.
"use strict";
var fs = require("fs"), path = require("path");
var HERE = __dirname, ROOT = path.join(HERE, "..", "..", "..");
var args = process.argv.slice(2), srcPath = null, only = null, saveDir = null;
for (var i = 0; i < args.length; i++) {
  if (args[i] === "--only") only = args[++i];
  else if (args[i] === "--save") saveDir = args[++i];
  else srcPath = args[i];
}
srcPath = srcPath || path.join(ROOT, "src", "lantern.inner.html");
var jsdom;
try { jsdom = require("jsdom"); } catch (e) { jsdom = require(path.join(ROOT, "node_modules", "jsdom")); }
var inner = fs.readFileSync(srcPath, "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new jsdom.VirtualConsole();
var dom = new jsdom.JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "https://example.org/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.HTMLCanvasElement.prototype.getContext = function () { return null; };
w.fetch = function () { return Promise.reject(new Error("offline")); };
w.eval(js);
var L = w.Lantern;

var cases = JSON.parse(fs.readFileSync(path.join(HERE, "cases.json"), "utf8"));
var EU = JSON.parse(fs.readFileSync(path.join(HERE, "excel_units.json"), "utf8"));

// --- the reviewer's reading of Excel's CONVERT (same table as excel_ref.py), for a formula Lantern saved ---
function look(name) {
  if (EU.temp[name]) return { g: "temp", t: EU.temp[name], m: 1 };
  if (EU.units[name]) { var u = EU.units[name]; return { g: u[0], f: u[1] }; }
  var i, p, rest, u2;
  for (i = 0; i < EU.binary.length; i++) {
    p = EU.binary[i][0]; rest = name.slice(p.length);
    if (name.indexOf(p) === 0 && EU.units[rest] && EU.units[rest][3]) { u2 = EU.units[rest]; return { g: u2[0], f: u2[1] * Math.pow(2, EU.binary[i][1]) }; }
  }
  for (i = 0; i < EU.prefix.length; i++) {
    p = EU.prefix[i][0]; rest = name.slice(p.length);
    if (name.indexOf(p) === 0 && rest) {
      if (EU.tempPre.indexOf(rest) >= 0) return { g: "temp", t: "K", m: EU.prefix[i][1] };
      if (EU.units[rest] && EU.units[rest][2]) { u2 = EU.units[rest]; return { g: u2[0], f: u2[1] * Math.pow(EU.prefix[i][1], u2[4]) }; }
    }
  }
  return null;
}
function toK(x, a) { return a.t === "C" ? x + 273.15 : a.t === "F" ? (x - 32) * 5 / 9 + 273.15 : a.t === "K" ? x * a.m : a.t === "Rank" ? x * 5 / 9 : x * 1.25 + 273.15; }
function fromK(k, b) { return b.t === "C" ? k - 273.15 : b.t === "F" ? (k - 273.15) * 9 / 5 + 32 : b.t === "K" ? k / b.m : b.t === "Rank" ? k * 9 / 5 : (k - 273.15) * 0.8; }
function excelConvert(x, a, b) {
  var A = look(a), B = look(b);
  if (!A || !B || A.g !== B.g) return "#N/A";
  if (A.g === "temp") return fromK(toK(x, A), B);
  return x * A.f / B.f;
}

// --- judging ---
function close(v, want, tol) {
  if (typeof v !== "number" || !isFinite(v)) return false;
  if (want === 0) return Math.abs(v) <= 1e-15;
  return Math.abs(v - want) <= tol * Math.abs(want);
}
function show(v) { return typeof v === "number" ? String(v) : JSON.stringify(v); }
function judge(v, e, ctx) {
  if (e.any) { for (var i = 0; i < e.any.length; i++) if (judge(v, e.any[i], ctx)) return true; return false; }
  if ("num" in e) return close(v, e.num, e.tol || 1e-14);
  if ("err" in e) {
    if (e.err === "error") return typeof v === "string" && v.charAt(0) === "#";
    return v === e.err;
  }
  if ("text" in e) return v === e.text;
  if ("bool" in e) {
    if (v === e.bool) return true;
    return v === (e.bool ? 1 : 0) && !!(ctx && ctx.logical);
  }
  return false;
}
function wantText(e) {
  if (e.any) return e.any.map(wantText).join(" or ");
  if ("num" in e) return String(e.num);
  if ("err" in e) return e.err === "error" ? "an error" : e.err;
  if ("text" in e) return JSON.stringify(e.text);
  if ("bool" in e) return e.bool ? "TRUE" : "FALSE";
  return "?";
}

function runSheet(c) {
  var cells = c.input.cells, ref = c.input.ref || "A1";
  var vals = L.sheetDocs.compute(cells);
  var v = vals[ref];
  var logical = false;
  try { logical = !!L.sheetDocs.logical(cells[ref], cells); } catch (e) {}
  if (judge(v, c.expect, { logical: logical })) return null;
  // an error where Excel's #N/A (or a right reading) was wanted: the error type alone is wrong
  if (c.errharm && typeof v === "string" && v.charAt(0) === "#") c.harm = c.errharm;
  return "Excel " + wantText(c.expect) + ", Lantern " + (logical && (v === 1 || v === 0) ? (v ? "TRUE" : "FALSE") : show(v));
}

function runChat(c) {
  var v, code = null, msg = "";
  try { v = L.formula.evaluate(c.input.expr, {}); }
  catch (e) { code = (e && e.code) || "#ERR"; msg = String((e && e.message) || e); v = String(code).charAt(0) === "#" ? code : "#" + code; }
  var e = c.expect;
  if (e.msg && !(code && new RegExp(e.msg).test(msg))) return "wanted an error naming " + e.msg + "; got " + (code ? code + " “" + msg + "”" : show(v));
  if (code && e.err === "error") return null;
  if (code && e.any && e.any.some(function (x) { return x.err === "error"; })) return null;
  if (judge(v, e, null)) return null;
  return "wanted " + wantText(e) + ", calculator " + (code ? (code + " “" + msg.slice(0, 120) + "”") : show(v));
}

function unxml(s) { return s.replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }
var saved = {};
function runXlsx(c) {
  var cells = c.input.cells, ref = c.input.ref;
  var vals = L.sheetDocs.compute(cells);
  var shown = vals[ref];
  var out = L.xlsx.write({ title: "t", cells: cells }, vals);
  if (saveDir) { fs.writeFileSync(path.join(saveDir, c.id + ".xlsx"), Buffer.from(out.bytes)); saved[c.id] = { ref: ref, shown: shown }; }
  var xml = L.zip.read(out.bytes).text("xl/worksheets/sheet1.xml");
  var m = xml.match(new RegExp("<c r=\"" + ref + "\"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)"));
  if (!m) return "the cell " + ref + " is not in the saved sheet";
  var attrs = m[1] || "", body = m[2] || "";
  var fm = body.match(/<f[^>]*>([\s\S]*?)<\/f>/), vm = body.match(/<v>([\s\S]*?)<\/v>/);
  var f = fm ? unxml(fm[1]) : null, cached = vm ? unxml(vm[1]) : null;
  var isErr = /t="e"/.test(attrs);
  var e = c.expect, want = (typeof shown === "number" || e.value === null) ? shown : e.value;
  var notes = (out.notes || []).join(" | ");
  var problems = [];
  // what Excel shows for the saved cell
  var excelShows;
  if (f === null) {
    excelShows = isErr ? cached : (cached === null ? null : (/t="(s|str|inlineStr)"/.test(attrs) ? cached : Number(cached)));
    if (e.mode.indexOf("value") < 0) problems.push("saved as its value (" + cached + "), not as the formula");
  } else {
    var okMode = false, why = "";
    for (var i = 0; i < e.mode.length; i++) {
      var md = e.mode[i];
      if (md === "value") continue;
      if (md === "convert") {
        var cm = f.match(/^CONVERT\(([^,]+),"([^"]*)","([^"]*)"\)$/), cm2 = f.match(/^CONVERT\(([A-Z]+[0-9]+),([A-Z]+[0-9]+),([A-Z]+[0-9]+)\)$/);
        var x, a, b;
        if (cm) { x = Number(cm[1]); if (isNaN(x) && cells[cm[1]] != null) x = Number(cells[cm[1]]); a = cm[2]; b = cm[3]; }
        else if (cm2) {
          var back = L.xlsx.read(out.bytes, "t.xlsx").sheets[0].cells;
          x = Number(back[cm2[1]]); a = String(back[cm2[2]]); b = String(back[cm2[3]]);
        }
        if (cm || cm2) {
          var ex = excelConvert(x, a, b);
          if (ex === "#N/A" ? (typeof want === "string" && want.charAt(0) === "#") : (typeof want === "number" && close(ex, want, 1e-12))) { okMode = true; excelShows = ex; break; }
          why = "Excel works out " + f + (cm2 ? " (units " + a + ", " + b + ")" : "") + " to " + (typeof ex === "number" ? ex : ex);
          excelShows = ex;
        } else why = "the saved formula is " + f;
      } else if (new RegExp(md).test(f)) {
        okMode = true; excelShows = isErr ? cached : Number(cached); break;
      } else why = why || "the saved formula is " + f;
    }
    if (!okMode) problems.push(why + (typeof want === "number" ? "; Lantern shows " + want : ""));
  }
  // the value saved beside it (what a program that does not recalculate shows)
  if (want !== "#N/A" && typeof want === "number" && cached !== null && !isErr && !close(Number(cached), want, 1e-12))
    problems.push("the value saved beside it is " + cached + ", Lantern shows " + want);
  if (typeof e.value === "number" && !close(shown, e.value, 1e-9)) problems.push("Lantern's sheet shows " + show(shown) + " (want " + e.value + ")");
  if (e.note && !new RegExp(e.note).test(notes)) problems.push("no note naming " + e.note + " (notes: " + (notes || "none") + ")");
  return problems.length ? problems.join("; ") : null;
}

var n = 0, a = 0, d = 0, byHarm = { high: 0, medium: 0, low: 0 };
if (saveDir) fs.mkdirSync(saveDir, { recursive: true });
cases.forEach(function (c) {
  if (only && c.id.indexOf(only) !== 0) return;
  n++;
  var res;
  try {
    res = c.kind === "sheet" ? runSheet(c) : c.kind === "chat" ? runChat(c) : runXlsx(c);
  } catch (e) { res = "threw " + String((e && e.message) || e).slice(0, 200); }
  if (res === null) { a++; console.log("AGREE " + c.id); }
  else {
    d++; byHarm[c.harm]++;
    var inp = c.kind === "chat" ? c.input.expr : (c.input.cells[c.input.ref || "A1"]);
    console.log("DISAGREE " + c.id + " " + inp + " :: " + res + (c.unjudged ? " (unjudged)" : "") + (c.design ? " (draft's stated design)" : "") + " [" + c.harm + "]");
  }
});
if (saveDir) fs.writeFileSync(path.join(saveDir, "expect.json"), JSON.stringify({ cases: cases.filter(function (c) { return c.kind === "xlsx"; }), shown: saved }, null, 1));
console.log("DISAGREE by harm: high " + byHarm.high + ", medium " + byHarm.medium + ", low " + byHarm.low);
console.log(n + " cases: " + a + " AGREE, " + d + " DISAGREE");
