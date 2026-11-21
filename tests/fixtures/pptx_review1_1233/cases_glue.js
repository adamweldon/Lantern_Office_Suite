// cases_glue.js -- review 1 of 1.24.33: PowerPoint files in Slides (Open .pptx, Save .pptx: Lantern.slidesPptx,
// Lantern.slideDeckTools) and in Chat (MAKE SLIDES' Save .pptx), as a person uses them.
"use strict";
var fs = require("fs"), path = require("path");
var cases = [];
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function G(id, harm, input, right, run) { cases.push({ id: id, harm: harm, input: input, right: right, run: function (x) { return Promise.resolve().then(function () { return run(x); }).catch(function (e) { return "threw: " + (e && e.message || e); }); } }); }
// open(x, buffer, name) -> {deck, dialog text, alerts}: Open .pptx as Slides calls it
function open(x, buf, name, api0) {
  var w = x.w, made = null, alerts = [], old = w.alert, puts = [], opened = [];
  w.alert = function (m) { alerts.push(String(m)); };
  var api = api0 || { newDeck: function (t, s) { made = { id: "d" + Date.now(), title: t, slides: s }; return made; }, col: { put: function (d) { puts.push(d); } }, open: function (id) { opened.push(id); } };
  Array.prototype.forEach.call(x.o.d.querySelectorAll(".guide-overlay"), function (e) { e.remove(); });
  x.L.slidesPptx.open(new w.File([buf], name), api);
  var t0 = Date.now();
  return (function wait() {
    return sleep(20).then(function () {
      var dlg = x.o.d.querySelector(".guide-overlay[aria-label=\x22PowerPoint file\x22]");
      if ((made && dlg) || alerts.length || Date.now() - t0 > 3000) {
        w.alert = old;
        var r = { deck: made, dialog: dlg ? dlg.textContent : null, items: dlg ? Array.prototype.map.call(dlg.querySelectorAll("li"), function (l) { return l.textContent; }) : [], alerts: alerts, puts: puts, opened: opened };
        if (dlg) dlg.remove();
        return r;
      }
      return wait();
    });
  })();
}
function deckFile(x, n) { return fs.readFileSync(path.join(x.DECKS, n)); }

G("g-open-course", "high", "Open .pptx: d01_course.pptx chosen as \u201cForklift course.pptx\u201d", "A new deck of its 11 slides with their titles, points, notes and the captioned photo.", function (x) {
  return open(x, deckFile(x, "d01_course.pptx"), "Forklift course.pptx").then(function (r) {
    if (!r.deck) return "no deck made" + (r.alerts.length ? ": " + r.alerts[0] : "");
    var s = r.deck.slides;
    return s.length === 11 && s[1].h === "Daily checks" && /Tyres and forks/.test(s[1].body) && s[1].notes && s[8].img ? "" : JSON.stringify(s.map(function (z) { return z.h; }));
  });
});
G("g-open-dialog", "medium", "Open .pptx: d06_pictures.pptx (a logo beside a photo, a TIFF, a linked picture)", "A note names the file and the slide count, and lists what was not kept, each with its slide.", function (x) {
  return open(x, deckFile(x, "d06_pictures.pptx"), "Pictures.pptx").then(function (r) {
    if (!r.dialog) return "no note shown";
    var t = r.items.join(" | ");
    return /Pictures\.pptx/.test(r.dialog) && /13 slides/.test(r.dialog) && /slide 3/.test(t) && /TIFF.*slide 6/.test(t) && /slide 8/.test(t) ? "" : r.dialog.slice(0, 400);
  });
});
G("g-open-word", "high", "Open .pptx: a Word file (letter.docx)", "Refused in plain words (it is a Word document; Writer opens it); no deck made.", function (x) {
  return open(x, fs.readFileSync(path.join(x.HERE, "..", "docx", "word_plain.docx")), "letter.docx").then(function (r) { return !r.deck && r.alerts.length && /Word document/.test(r.alerts[0]) ? "" : JSON.stringify(r.alerts); });
});
G("g-open-ppt", "medium", "Open .pptx: an old PowerPoint 97-2003 file (talk.ppt)", "Refused, saying it is an older PowerPoint file to save as .pptx (in PowerPoint or LibreOffice) first.", function (x) {
  return open(x, deckFile(x, "w_old.ppt"), "talk.ppt").then(function (r) { return !r.deck && r.alerts.length && /\.ppt\b/.test(r.alerts[0]) && /save|\.pptx/i.test(r.alerts[0]) ? "" : JSON.stringify(r.alerts); });
});
G("g-open-truncated", "medium", "Open .pptx: a deck cut short by a broken download", "Refused with a message that says the file is damaged; no half deck made.", function (x) {
  return open(x, deckFile(x, "d18_truncated.pptx"), "course.pptx").then(function (r) { return !r.deck && r.alerts.length && /damaged|cut short/.test(r.alerts[0]) ? "" : JSON.stringify([!!r.deck, r.alerts]); });
});
G("g-open-full-store", "medium", "Open .pptx when the browser's storage is full (Lantern.store.ok() false)", "The deck is made without its pictures, and the note says the pictures did not fit.", function (x) {
  var st = x.L.store, old = st && st.ok;
  if (!st) return "SKIP no Lantern.store";
  st.ok = function () { return false; };
  return open(x, deckFile(x, "d01_course.pptx"), "course.pptx").then(function (r) {
    st.ok = old;
    if (!r.deck) return "no deck";
    return !r.deck.slides.some(function (s) { return s.img; }) && r.puts.length && /pictures/.test(r.items.join(" ")) ? "" : JSON.stringify(r.items);
  }, function (e) { st.ok = old; throw e; });
});
G("g-open-accept", "low", "Open .pptx's file chooser", "It lets a person pick a PowerPoint Show (.ppsx) or template (.potx) too, which Lantern reads; a chooser that greys them out hides the trainer's show file.", function (x) {
  var t = (x.L.slideLibTools || []).filter(function (z) { return z.label === "Open .pptx"; })[0], d = x.o.d, orig = d.createElement, inp = null;
  if (!t) return "no Open .pptx tool";
  d.createElement = function (n) { var e = orig.call(d, n); if (String(n).toLowerCase() === "input") { inp = e; e.click = function () {}; } return e; };
  try { t.run({ newDeck: function () {}, col: { put: function () {} } }); } finally { d.createElement = orig; }
  if (inp && inp.parentNode) inp.parentNode.removeChild(inp);
  return inp && /\.ppsx/.test(inp.accept) && /\.potx/.test(inp.accept) ? "" : "accept=" + (inp && inp.accept);
});
function saveTool(x) { return (x.L.slideDeckTools || []).filter(function (t) { return t.label === "Save .pptx"; })[0]; }
function withDownload(x, f) { var old = x.L.download, got = []; x.L.download = function (n, d, m) { got.push({ name: n, data: d, mime: m }); }; try { f(); } finally { x.L.download = old; } return got; }
G("g-save-name", "low", "Save .pptx on a deck titled \u201cQ3: plan/draft?\u201d", "Downloads \u201cQ3 plan draft.pptx\u201d (no characters Windows refuses in a file name).", function (x) {
  var got = withDownload(x, function () { saveTool(x).run({ doc: { title: "Q3: plan/draft?", slides: [{ h: "A", body: "<p>x</p>" }] }, save: function () {} }); });
  Array.prototype.forEach.call(x.o.d.querySelectorAll(".guide-overlay"), function (e) { e.remove(); });
  return got.length === 1 && got[0].name === "Q3 plan draft.pptx" && /presentationml\.presentation$/.test(got[0].mime) ? "" : JSON.stringify(got.map(function (g) { return g.name; }));
});
G("g-save-said", "medium", "Save .pptx on a deck whose picture is an SVG", "The file is saved, and a note says the SVG picture (slide 1) was not.", function (x) {
  var got = withDownload(x, function () { saveTool(x).run({ doc: { title: "Icons", slides: [{ h: "Icon", body: "<p>x</p>", img: "data:image\x2Fsvg+xml;base64,PHN2Zy8+" }] }, save: function () {} }); });
  var dlg = x.o.d.querySelector(".guide-overlay[aria-label=\x22PowerPoint file\x22]"), t = dlg ? dlg.textContent : "";
  if (dlg) dlg.remove();
  return got.length === 1 && /SVG/.test(t) && /slide 1/.test(t) ? "" : "dialog: " + t;
});
G("g-save-first", "low", "Save .pptx while the deck's last typing is not yet stored", "The deck is stored first (api.save), then downloaded.", function (x) {
  var order = [];
  withDownload(x, function () { var old = x.L.download; x.L.download = function () { order.push("download"); }; saveTool(x).run({ doc: { title: "S", slides: [{ h: "A", body: "" }] }, save: function () { order.push("save"); } }); x.L.download = old; });
  return order.join(",") === "save,download" ? "" : order.join(",");
});
G("g-roundtrip-google", "high", "Open .pptx on the Google Slides export (d11), then Save .pptx at once", "The saved file reads back with the same titles, points (levels, bold, link) and notes.", function (x) {
  return open(x, deckFile(x, "d11_google.pptx"), "Induction.pptx").then(function (r) {
    if (!r.deck) return "no deck";
    var got = withDownload(x, function () { saveTool(x).run({ doc: r.deck, save: function () {} }); });
    Array.prototype.forEach.call(x.o.d.querySelectorAll(".guide-overlay"), function (e) { e.remove(); });
    if (!got.length) return "nothing downloaded";
    var b = x.L.pptx.read(got[0].data, "x.pptx"), out = [];
    r.deck.slides.forEach(function (s, i) { var t = b.slides[i] || {}; if (t.h !== s.h || x.plain(t.body) !== x.plain(s.body) || (t.notes || "") !== (s.notes || "")) out.push(i + 1); });
    var b2 = b.slides[1] && b.slides[1].body;
    if (!/<b>office<\x2Fb>/.test(b2) || !/site-map/.test(b2) || !/<ul><li>Even/.test(b2)) out.push("slide 2's looks: " + b2);
    return out.length ? "differs: " + out.join(", ") : "";
  });
});
// Chat: MAKE SLIDES -> Save .pptx
function make(x, reply, q) { return x.L.aiAct.build(reply, q); }
function chatSave(x, view) { var ex = view && (view.extra || []).filter(function (e) { return e.label === "Save .pptx"; })[0]; if (!ex) return null; return withDownload(x, function () { ex.run(); }); }
G("g-chat-save", "high", "Chat: MAKE SLIDES of a three-slide lockout talk, then Save .pptx", "A PowerPoint file named for the deck, each slide's title and points as the preview shows them.", function (x) {
  var v = make(x, "MAKE SLIDES: Lockout\n# Lockout in three steps\nA two-minute talk.\n# 1. Isolate\n- Switch off the main breaker\n- Lock it and hang your tag\n# 2. Prove zero energy\n- Try the start button\nEND", "Make a presentation on lockout");
  var got = chatSave(x, v);
  if (!got) return "no Save .pptx";
  if (got.length !== 1) return got.length + " downloads";
  var b = x.L.pptx.read(got[0].data, "x.pptx"), plan = v.plan.slides;
  if (got[0].name !== "Lockout.pptx") return "named " + got[0].name;
  for (var i = 0; i < plan.length; i++) if (b.slides[i].h !== plan[i].h || b.slides[i].body !== plan[i].body) return "slide " + (i + 1) + ": " + JSON.stringify([b.slides[i].h, b.slides[i].body, plan[i].body]);
  return b.slides.length === plan.length ? "" : b.slides.length + " slides";
});
G("g-chat-numbered", "medium", "Chat: MAKE SLIDES with numbered points (1. 2. 3.) and a bold word", "Saved as the preview shows: a numbered list, the bold word bold.", function (x) {
  var v = make(x, "MAKE SLIDES: Pump start\n# Starting the pump\n1. Open the suction valve\n2. Prime the casing\n3. Start, then open the **delivery** valve slowly\nEND", "Make slides on starting a pump");
  var got = chatSave(x, v);
  if (!got || !got.length) return "no Save .pptx";
  var b = x.L.pptx.read(got[0].data, "x.pptx"), want = v.plan.slides[0].body;
  return b.slides[0].body === want ? "" : "saved " + b.slides[0].body + " for " + want;
});
G("g-chat-valid", "high", "Chat: MAKE SLIDES' saved file", "Valid against the schemas and opened by python-pptx with each title (checked with the write batch's tools).", function (x) {
  var v = make(x, "MAKE SLIDES: Ladder safety\n# Ladder safety\nA short talk.\n# Before you climb\n- Check the feet\n- Three points of contact\nEND", "Make a short presentation on ladder safety");
  var got = chatSave(x, v);
  if (!got || !got.length) return "no Save .pptx";
  if (!x.which("python3")) return "SKIP python3 missing";
  var os = require("os"), dir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx_rv1_chat_"));
  fs.writeFileSync(path.join(dir, "chat.pptx"), Buffer.from(got[0].data));
  var c = JSON.parse(x.py("check_saved.py", [dir])), f = c.files["chat.pptx"];
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  if (!c.have.schemas || !c.have.pptx) return "SKIP schemas or python-pptx missing";
  return !f.schema.length && JSON.stringify(f.titles) === JSON.stringify(["Ladder safety", "Before you climb"]) ? "" : JSON.stringify(f);
});
G("g-chat-title-chars", "low", "Chat: MAKE SLIDES titled \u201cCOSHH: paints/solvents\u201d", "Downloads \u201cCOSHH paints solvents.pptx\u201d.", function (x) {
  var got = chatSave(x, make(x, "MAKE SLIDES: COSHH: paints/solvents\n# COSHH\n- Read the data sheet\nEND", "Make slides on COSHH for paints and solvents"));
  return got && got.length && got[0].name === "COSHH paints solvents.pptx" ? "" : JSON.stringify(got && got.map(function (g) { return g.name; }));
});
G("g-errors", "medium", "every case above", "No script errors on the page.", function (x) { return x.o.errs.length ? x.o.errs.slice(0, 3).join(" | ") : ""; });

module.exports = cases;
