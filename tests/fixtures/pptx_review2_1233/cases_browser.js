// cases_browser.js -- the second review's cases in a real browser (browser.py: Chromium through Playwright): EMF pictures
// drawn by Lantern.emf.draw, judged at points whose colour the records fix (emf/probes.json), and LibreOffice's own EMFs
// judged against the SVG drawings they were made from; decks opened through Slides' Open .pptx. browser.py runs once;
// when Python's Playwright or its Chromium is missing every case says SKIP.
"use strict";
var H = require("./h.js"), cp = require("child_process"), os = require("os");
var res = null;
function run() {
  if (res) return res;
  var out = H.path.join(H.fs.mkdtempSync(H.path.join(os.tmpdir(), "pptx_r2b_")), "browser.json");
  try { cp.execFileSync("python3", ["-c", "import playwright"], { stdio: "ignore" }); } catch (e) { return (res = { skip: "Python's Playwright is not installed" }); }
  try { cp.execFileSync("python3", [H.path.join(H.HERE, "browser.py"), H.SRC, out, process.env.PPTX_R2_SHOTS || ""].filter(String), { stdio: "ignore", timeout: 900000 }); } catch (e) { if (!H.fs.existsSync(out)) return (res = { skip: "the browser did not run (" + String(e.message).slice(0, 120) + ")" }); }
  res = JSON.parse(H.fs.readFileSync(out, "utf8"));
  if (res.errors && res.errors.some(function (x) { return /Executable doesn.t exist|browserType\.launch/.test(x); })) res = { skip: "Chromium for Playwright is not installed" };
  return res;
}
function C(id, harm, input, right, f) {
  return { id: id, harm: harm, input: input, right: right, run: function () { return new Promise(function (ok) { var r = run(); if (r.skip) return ok("SKIP: " + r.skip); var g; try { g = f(r); } catch (e) { g = "threw: " + String(e && e.message || e).slice(0, 300); } ok(g || ""); }); } };
}
function emf(id, harm, name, input, right) {
  return C(id, harm, "emf/" + name + ".emf: " + input, right, function (r) {
    var e = r.emf[name];
    if (!e) return "not tried";
    if (!e.drawn) return "not drawn (Lantern.emf.draw gave nothing" + (e.err ? ": " + e.err : "") + ")" + (/^e\d/.test(name) ? loSays(name) : "");
    var bad = (e.bad || []).slice();
    if (e.cmp && e.cmp.tried && e.cmp.off > Math.max(2, e.cmp.tried * 0.05)) bad.push(e.cmp.off + " of " + e.cmp.tried + " points differ from the SVG it was made from, e.g. " + JSON.stringify(e.cmp.first[0]));
    return bad.length ? bad.join("; ") + (/^e\d/.test(name) ? loSays(name) : "") : "";
  });
}
function op(r, f) { return r.open[f] || {}; }
// LibreOffice's own drawing of the same EMF, judged at the same probes (lo_emf.py), to say beside a finding
var lo = null;
function loSays(name) {
  if (!lo) { var out = H.path.join(H.fs.mkdtempSync(H.path.join(os.tmpdir(), "pptx_r2l_")), "lo.json"); try { cp.execFileSync("python3", [H.path.join(H.HERE, "lo_emf.py"), out], { stdio: "ignore", timeout: 600000 }); lo = JSON.parse(H.fs.readFileSync(out, "utf8")); } catch (e) { lo = { missing: "lo_emf.py failed" }; } }
  if (lo.missing || !(name in lo)) return "";
  var v = lo[name]; return v === "not drawn" ? " (LibreOffice draws nothing either)" : v.length ? " (LibreOffice also: " + v.join("; ") + ")" : " (LibreOffice draws it as the records say)";
}
var cases = [
  emf("emf-shapes", "medium", "e01_shapes", "a red rectangle with a black pen, a green ellipse, a blue rounded rectangle", "each in its place and colour"),
  emf("emf-polys", "medium", "e02_polys", "a yellow triangle (POLYGON16) and a thick blue L-shaped line (POLYLINE16)", "the triangle filled, the line drawn"),
  emf("emf-text", "medium", "e03_text", "“PUMP 1” bold red at the top left, “Wet well” centred on its point", "both words where they are written"),
  emf("emf-aniso", "medium", "e04_aniso", "MM_ANISOTROPIC: a 1000 by 1000 window on a 400 by 300 viewport, red top-left quarter, blue bottom-right", "the quarters stretched to the picture"),
  emf("emf-lometric", "medium", "e05_lometric", "MM_LOMETRIC (y up, tenths of a millimetre), the origin at the bottom left, a green square 50 mm", "the square at the bottom left"),
  emf("emf-world", "medium", "e06_world", "a horizontal bar turned 90 degrees by SETWORLDTRANSFORM", "a vertical bar"),
  emf("emf-savedc", "medium", "e07_savedc", "a red brush, SAVEDC, a green brush and a square, RESTOREDC, a square", "the first square green, the second red"),
  emf("emf-clip", "medium", "e08_clip", "an ellipse drawn through a clip rectangle on its left half", "only the left half drawn"),
  emf("emf-path-curve", "medium", "e09_path", "a path: MoveTo, LineTo up, a bezier over the top, LineTo down, CloseFigure, StrokeAndFillPath (an arch)", "the whole arch filled yellow, its outline closed along the bottom"),
  emf("emf-path-lines", "high", "e23_path_lines", "a triangle drawn as a path of lines: MoveTo, LineTo, LineTo, CloseFigure, FillPath", "a filled red triangle"),
  emf("emf-dib", "medium", "e10_dib", "a 24-bit 2 by 2 bitmap and an 8-bit bitmap with a palette, stretched (STRETCHDIBITS)", "each pixel's colour in its place"),
  emf("emf-dib-sharp", "low", "e24_dib_sharp", "a 2 by 1 bitmap (red, blue) stretched to 400 by 200 with the default stretch mode", "two sharp halves, as Windows draws it (no blending at 40% and 60% across)"),
  emf("emf-hatch", "low", "e11_hatch", "a rectangle filled with a hatched brush (BS_HATCHED, HS_CROSS, black)", "thin crossed black lines on white, as Windows draws it (LibreOffice 24.2 also fills it solid)"),
  emf("emf-gradient", "low", "e12_gradient", "a rectangle filled red to blue (EMR_GRADIENTFILL), as Office writes a gradient", "red at the left, blue at the right (LibreOffice 24.2 draws nothing either)"),
  emf("emf-pie", "low", "e13_pie", "a pie slice (EMR_PIE), the top-right quarter of a circle", "a green quarter at the top right"),
  emf("emf-donut", "medium", "e14_donut", "two rings in one POLYPOLYGON16, filled alternate", "a blue square ring, its hole white"),
  emf("emf-offset", "medium", "e15_offset", "a picture whose frame starts at 500, 300 (as Visio's pages do)", "the drawing in the picture, not off its edge"),
  emf("emf-dash", "low", "e16_dash", "a line drawn with an 8 px dashed geometric pen (EXTCREATEPEN)", "dashes with gaps"),
  emf("emf-xor-twice", "low", "e17_xor_twice", "the same red rectangle drawn twice with R2_XORPEN", "nothing (XOR twice is no change), as Windows draws it"),
  emf("emf-mono", "low", "e18_mono", "a 1-bit black and white checker bitmap", "black and white quarters"),
  emf("emf-dual", "medium", "e19_dual", "an EMF+ comment, then the plain records (a green square)", "the plain records drawn"),
  emf("emf-vertical-text", "low", "e20_vtext", "“LEVEL” in a font with escapement 900", "the word reading upwards"),
  emf("emf-patcopy", "low", "e21_patcopy", "a BITBLT with no bitmap, PATCOPY with a green brush", "the area green"),
  emf("emf-iso", "medium", "e22_iso", "MM_ISOTROPIC: a 100 by 100 window on a 200 by 200 viewport in a 400 by 200 picture", "a red square at the left, not stretched"),
  emf("emf-lo-shapes", "medium", "lo_shapes", "LibreOffice's EMF of an SVG: a red box with a border, a green circle, a yellow triangle", "as the SVG"),
  emf("emf-lo-text", "medium", "lo_text", "LibreOffice's EMF of a white label on a blue band and a centred serif line", "as the SVG"),
  emf("emf-lo-gradient", "low", "lo_gradient", "LibreOffice's EMF of a red to blue gradient (LibreOffice writes it as bands)", "as the SVG"),
  emf("emf-lo-dashes", "medium", "lo_dashes", "LibreOffice's EMF of a thick green curve (written as a filled path of lines and curves) and a dashed line", "as the SVG"),
  emf("emf-lo-clip", "medium", "lo_clip", "LibreOffice's EMF of an ellipse clipped to its left half", "as the SVG"),
  emf("emf-lo-image", "low", "lo_image", "LibreOffice's EMF of a 4 by 2 bitmap stretched to 400 by 200, red left, blue right", "as the SVG drawn without smoothing (each pixel a sharp block)"),
  // ---- Open .pptx in Slides ----------------------------------------------------------------------------------------------
  C("open-six-photos", "medium", "r06 slide 1 opened in Slides: six photos in a grid", "one picture, each photo's colour where it sat (red, green, blue over yellow, cyan, magenta)",
    function (r) { var s = (op(r, "r06_pictures.pptx").slides || [])[0]; if (!s || !s.grid) return "no picture"; var want = [[200, 30, 30], [30, 160, 30], [30, 30, 200], [220, 200, 20], [20, 200, 200], [200, 20, 200]], bad = [];
      [0, 2, 4, 12, 14, 16].forEach(function (gi, k) { var g = s.grid[gi]; if (!g || Math.abs(g[0] - want[k][0]) > 40 || Math.abs(g[1] - want[k][1]) > 40 || Math.abs(g[2] - want[k][2]) > 40) bad.push("photo " + (k + 1) + " shows " + g); }); return bad.join("; "); }),
  C("open-cropped", "low", "r06 slide 2: a picture cropped to its red top-left quarter", "only red", function (r) { var s = (op(r, "r06_pictures.pptx").slides || [])[1]; return s && s.grid && s.grid.every(function (g) { return g[0] > 180 && g[1] < 60; }) ? "" : "shows " + JSON.stringify(s && s.grid && s.grid.slice(0, 6)); }),
  C("open-turned-flipped", "low", "r06 slide 3: a picture red on its left, blue on its right, flipped and turned 90 degrees clockwise", "upright as PowerPoint shows it: tall, blue at the top, red at the bottom",
    function (r) { var s = (op(r, "r06_pictures.pptx").slides || [])[2]; if (!s || !s.grid) return "no picture"; return s.hgt > s.w && s.grid[0][2] > 180 && s.grid[23][0] > 180 ? "" : s.w + " by " + s.hgt + ", top " + s.grid[0] + ", bottom " + s.grid[23]; }),
  C("open-gif-bmp", "low", "r06 slides 4 and 5: a GIF and a BMP", "both shown, as JPEGs as Slides stores pictures", function (r) { var s = op(r, "r06_pictures.pptx").slides || []; return s[3] && s[4] && s[3].img === "data:image/jpeg;base64," && s[4].img === "data:image/jpeg;base64," && s[3].grid[0][0] > 200 && s[4].grid[0][2] > 200 ? "" : JSON.stringify([s[3], s[4]]).slice(0, 300); }),
  C("open-said", "low", "r06 opened: what is said", "the TIFF said; the photos said put together; nothing said of turned or cropped pictures (shown as PowerPoint shows them)",
    function (r) { var t = (op(r, "r06_pictures.pptx").said || []).join(" | "); var bad = []; if (!/TIFF/.test(t)) bad.push("TIFF not said"); if (!/put together/.test(t)) bad.push("putting together not said"); if (/turned, flipped or cropped/.test(t)) bad.push("turned said"); if (/more picture/.test(t)) bad.push("“more pictures” said"); return bad.join("; ") + (bad.length ? " -- " + t.slice(0, 300) : ""); }),
  C("open-picture-placeholder", "low", "r01 slide 6: a photo in a picture placeholder (python-pptx crops it to the placeholder's shape)", "shown, and nothing said about cropping", function (r) { var d = op(r, "r01_toolbox.pptx"), s = (d.slides || [])[5]; return s && s.img && !/turned/.test((d.said || []).join(" ")) ? "" : JSON.stringify(d).slice(0, 300); }),
  C("open-broken-slide", "medium", "w04 opened: slide 2 unreadable", "five slides, and the dialog says slide 2 was left out", function (r) { var d = op(r, "w04_broken_slide.pptx"); return d.n === 5 && /slide 2/.test((d.said || []).join(" ")) ? "" : JSON.stringify(d).slice(0, 300); }),
  C("open-charts", "low", "r03 opened: a table and seven charts", "eight slides with tables, the charts said", function (r) { var d = op(r, "r03_tables_charts.pptx"); return d.n === 8 && (d.slides || []).every(function (s) { return /<table>/.test(s.body); }) && /7 charts/.test((d.said || []).join(" ")) ? "" : JSON.stringify(d).slice(0, 300); }),
  C("open-emf", "medium", "r17 opened in Slides: an EMF picture (red box, green ellipse, blue rounded box) on slide 1, the same as EMZ on slide 2", "both drawn by Lantern, each colour where it is, and said",
    function (r) { var d = op(r, "r17_emf.pptx"), s = d.slides || [], bad = [];
      [0, 1].forEach(function (i) { var g = s[i] && s[i].grid; if (!g) return bad.push("slide " + (i + 1) + ": no picture"); if (!(g[0][0] > 180 && g[0][1] < 80)) bad.push("slide " + (i + 1) + " top left " + g[0]); if (!(g[4][1] > 120 && g[4][0] < 80)) bad.push("slide " + (i + 1) + " ellipse " + g[4]); if (!(g[14][2] > 160 && g[14][0] < 80)) bad.push("slide " + (i + 1) + " bottom " + g[14]); });
      if (!/pictures in EMF drawn by Lantern/.test((d.said || []).join(" "))) bad.push("not said: " + (d.said || []).join(" | ").slice(0, 200)); return bad.join("; "); }),
  C("open-emf-path", "high", "r17 slide 3: an EMF of a red triangle drawn as a path of lines (MoveTo, LineTo, LineTo, CloseFigure, FillPath)", "the red triangle on the slide",
    function (r) { var s = (op(r, "r17_emf.pptx").slides || [])[2]; if (!s || !s.grid) return "no picture"; var g = s.grid[20]; return g[0] > 180 && g[1] < 80 ? "" : "the triangle's middle shows " + g + " (white: nothing drawn)"; }),
  C("open-hostile", "high", "r18 opened in Slides and its slides shown: markup meant to run a script in its title, text, links, chart, table and notes", "nothing runs (no alert)",
    function (r) { var d = op(r, "r18_hostile.pptx"); return d.n ? ((d.alerts || []).length ? "a script ran: " + d.alerts.join("; ") : "") : "not opened: " + JSON.stringify(d).slice(0, 200); }),
  C("open-alert-ppt", "medium", "w14 (an old .ppt) through Open .pptx", "a plain message: save it as .pptx", function (r) { return /old PowerPoint file \(\.ppt\)/.test((r.open["alert:w14_old_ppt.pptx"] || []).join(" ")) ? "" : JSON.stringify(r.open["alert:w14_old_ppt.pptx"]); }),
  C("open-alert-locked", "medium", "w17 (locked with a password) through Open .pptx", "a plain message: take the password off", function (r) { return /password/.test((r.open["alert:w17_locked.pptx"] || []).join(" ")) ? "" : JSON.stringify(r.open["alert:w17_locked.pptx"]); }),
  C("open-chooser-closed", "low", "Open .pptx clicked, then the file chooser closed with no file", "nothing left showing on the page (as Insert picture hides its chooser)",
    function (r) { var c = r.open.cancelled || []; var shown = c.filter(function (x) { return x.shown; }); return shown.length ? shown.length + " file box(es) left showing on the page (" + shown[0].w + " by " + shown[0].h + " px): the line that hides it is inside a comment in SLIDES_PPTX" : ""; }),
  C("open-no-page-errors", "medium", "every deck and picture above, in the page", "no script errors", function (r) { return (r.errors || []).length ? r.errors.slice(0, 3).join("; ") : ""; })
];
module.exports = cases;
