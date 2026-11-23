// cases_a.js -- DRAW_LADDER's symbols (Lantern.ladderSym), drawn at (100, 100) and read as geometry.
// What is right (Adam, 2026-11-23, and the usual meaning of "normal" for a process switch: the state with the least
// stimulus -- an empty well, no pressure, cold): a float, pressure or temperature switch drawn normally open has its
// blade under the line and clear of the right terminal, its float, diaphragm or bulb under the blade, so a rising process
// pushes it closed; drawn normally closed, the blade rests on the right terminal from above, and a rising process lifts
// it off. Limit switches, selectors, contacts, buttons and the rest are drawn as on 1.24.34.
"use strict";
var lib = require("./lib.js");
var X = 100, Y = 100;
function S(V, sym, o) { return lib.flat(V.L.ladderSym[sym](X, Y, "#000", o || {}).g); }
// the blade: the 2-point line from the left terminal (x-11, y)
function blade(sh) { var b = sh.filter(function (s) { return s.t === "path" && s.pts.length === 2 && Math.abs(s.pts[0][0] - (X - 11)) < 0.5 && Math.abs(s.pts[0][1] - Y) < 0.5; }); return b.length === 1 ? b[0].pts : null; }
// the blade's height at x (linear)
function at(b, x) { return b[0][1] + (b[1][1] - b[0][1]) * (x - b[0][0]) / (b[1][0] - b[0][0]); }
// the stem: a vertical line at x, below or through the line
function stem(sh) { return sh.filter(function (s) { return s.t === "path" && s.pts.length === 2 && Math.abs(s.pts[0][0] - X) < 0.5 && Math.abs(s.pts[1][0] - X) < 0.5; })[0]; }
// the actuator's top: the float's circle (top), the diaphragm's flat line, the bulb's zigzag (its highest point)
function actuatorTop(sym, sh) {
  if (sym === "float") { var c = sh.filter(function (s) { return s.t === "circle" && Math.abs(s.cx - X) < 0.5 && s.cy > Y; })[0]; return c ? c.cy - c.r : null; }
  if (sym === "pressure") { var l = sh.filter(function (s) { return s.t === "path" && s.pts.length === 2 && Math.abs(s.pts[0][1] - s.pts[1][1]) < 0.1 && s.pts[0][1] > Y + 5; })[0]; return l ? l.pts[0][1] : null; }
  if (sym === "temp") { var z = sh.filter(function (s) { return s.t === "path" && s.pts.length > 3; })[0]; return z ? Math.min.apply(null, z.pts.map(function (p) { return p[1]; })) : null; }
  return null;
}
function bottom(sh) { return Math.max.apply(null, sh.map(function (s) { return lib.bbox(s)[3]; })); }
var cases = [];
function C(id, harm, input, right, run) { cases.push({ id: id, harm: harm, input: input, right: right, run: function () { return lib.boot().then(function (x) { return run(x); }); } }); }

["float", "pressure", "temp"].forEach(function (k) {
  C("A-" + k + "-no-blade-under", "high", "ladderSym." + k + "(100, 100, c, {nc: false})",
    "normally open: the blade from the left terminal goes down, under the line, and its end is clear of the right terminal (rising pushes it up to close)",
    function (x) {
      var b = blade(S(x.N, k, { nc: false }));
      if (!b) return "no single blade from the left terminal";
      var endY = b[1][1], gap = Math.sqrt(Math.pow(b[1][0] - (X + 11), 2) + Math.pow(b[1][1] - Y, 2)), yAtT = at(b, X + 11);
      return lib.all([lib.want(endY > Y + 4, "the blade's end is at y " + endY + " (the line at " + Y + "): not under it"),
        lib.want(yAtT > Y + 3 + 1, "under the right terminal the blade is at y " + yAtT.toFixed(1) + ": it touches the terminal (radius 3)"),
        lib.want(gap > 4, "the blade's end is " + gap.toFixed(1) + " px from the right terminal's centre")]);
    });
  C("A-" + k + "-nc-blade-over", "high", "ladderSym." + k + "(100, 100, c, {nc: true})",
    "normally closed: the blade rests on the right terminal from above (passes over its top, y-3), its end beyond it (rising lifts it off)",
    function (x) {
      var b = blade(S(x.N, k, { nc: true }));
      if (!b) return "no single blade from the left terminal";
      var yAtT = at(b, X + 11);
      return lib.all([lib.want(b[1][0] > X + 11, "the blade ends at x " + b[1][0] + ", short of the right terminal"),
        lib.want(yAtT <= Y - 2 && yAtT >= Y - 4.5, "over the right terminal the blade is at y " + yAtT.toFixed(2) + " (its top is " + (Y - 3) + "): not resting on it from above"),
        lib.want(b[1][1] < Y, "the blade's end is at or under the line")]);
    });
  C("A-" + k + "-actuator-under-blade", "medium", "ladderSym." + k + " both ways",
    "the float, diaphragm or bulb is under the blade, joined to it by its stem (the stem meets the blade and reaches the actuator)",
    function (x) {
      var out = [];
      [false, true].forEach(function (nc) {
        var sh = S(x.N, k, { nc: nc }), b = blade(sh), st = stem(sh), top = actuatorTop(k, sh);
        if (!b || !st || top == null) { out.push((nc ? "nc" : "no") + ": blade " + !!b + ", stem " + !!st + ", actuator " + top); return; }
        var yb = at(b, X), y0 = Math.min(st.pts[0][1], st.pts[1][1]), y1 = Math.max(st.pts[0][1], st.pts[1][1]);
        if (Math.abs(y0 - yb) > 1) out.push((nc ? "nc" : "no") + ": the stem starts at y " + y0 + ", the blade is at y " + yb.toFixed(2) + " there");
        if (top < yb) out.push((nc ? "nc" : "no") + ": the actuator is above the blade");
        // the stem reaches the actuator (within 2.5 px: a 2 px stroke each)
        if (top - y1 > 2.5) out.push((nc ? "nc" : "no") + ": the stem ends at y " + y1 + " and the " + k + "'s top is at y " + top + " (a gap of " + (top - y1).toFixed(1) + ")");
      });
      return out.join("; ");
    });
  C("A-" + k + "-no-nc-tell-apart", "medium", "ladderSym." + k + " no and nc",
    "normally open and normally closed differ plainly: the blade's end at least 8 px apart up and down",
    function (x) { var a = blade(S(x.N, k, { nc: false })), b = blade(S(x.N, k, { nc: true })); return a && b ? lib.want(a[1][1] - b[1][1] >= 8, "ends " + a[1][1] + " and " + b[1][1]) : "no blade"; });
  C("A-" + k + "-fits-its-slot", "medium", "ladderSym." + k + " both ways",
    "the symbol stays within its 60 px (x-30..x+30) and above y+25, so the label under it (y+34, 11 px) and the tag above (y-34) are clear",
    function (x) {
      var out = [];
      [false, true].forEach(function (nc) {
        var sh = S(x.N, k, { nc: nc }), xs = sh.map(lib.bbox), mnx = Math.min.apply(null, xs.map(function (b) { return b[0]; })), mxx = Math.max.apply(null, xs.map(function (b) { return b[2]; })), mny = Math.min.apply(null, xs.map(function (b) { return b[1]; }));
        if (mnx < X - 30 || mxx > X + 30) out.push((nc ? "nc" : "no") + " spans x " + mnx + ".." + mxx);
        if (bottom(sh) > Y + 25) out.push((nc ? "nc" : "no") + " reaches y " + bottom(sh));
        if (mny < Y - 26) out.push((nc ? "nc" : "no") + " reaches up to y " + mny);
      });
      return out.join("; ");
    });
  C("A-" + k + "-ports", "high", "ladderSym." + k + " ports",
    "its ends are where they were (x-30 and x+30 on the line): AI_CONTROL's wires meet them",
    function (x) { var p = x.N.L.ladderSym[k](X, Y, "#000", {}).ports, q = x.O.L.ladderSym[k](X, Y, "#000", {}).ports; return lib.want(JSON.stringify(p) === JSON.stringify(q) && p.a[0] === X - 30 && p.b[0] === X + 30, JSON.stringify(p)); });
});
// what must not change
["contact", "button", "toggle", "limit", "overload", "coil", "lamp", "solenoid", "horn", "fuse"].forEach(function (k) {
  C("A-unchanged-" + k, "medium", "ladderSym." + k + " (no, nc, timed, mushroom, id, colour)",
    k + " is drawn exactly as on 1.24.34 (only the process switches change)",
    function (x) {
      var os = [{}, { nc: true }, { nc: false }, { timed: true }, { mushroom: true, nc: true }, { id: "CR1" }, { colour: "R" }], bad = [];
      os.forEach(function (o) { var a = JSON.stringify(x.N.L.ladderSym[k](X, Y, "#000", o)), b = JSON.stringify(x.O.L.ladderSym[k](X, Y, "#000", o)); if (a !== b) bad.push(JSON.stringify(o)); });
      return bad.length ? "differs for " + bad.join(", ") : "";
    });
});
C("A-limit-still-up", "medium", "ladderSym.limit no / nc",
  "a limit switch (worked by the machine, not the process) keeps the selector's blade: open, up and clear; closed, under the right terminal",
  function (x) { var a = blade(S(x.N, "limit", { nc: false })), b = blade(S(x.N, "limit", { nc: true })); return lib.want(a && b && a[1][1] < Y && b[1][1] > Y, JSON.stringify([a, b])); });
C("A-process-was-wrong-before", "low", "ladderSym.float no on 1.24.34",
  "(the finding the change mends) 1.24.34 drew a normally open float with its blade up and clear and the float under it: a rising float would push it further open",
  function (x) { var b = blade(S(x.O, "float", { nc: false })); return lib.want(b && b[1][1] < Y, "1.24.34's blade " + JSON.stringify(b)); });
// Draw's Electrical palette
C("A-palette-limit-as-before", "low", "Draw's Electrical palette: Limit switch NO / NC",
  "the palette's limit switches draw as on 1.24.34",
  function (x) {
    function pal(V) { var m = (V.L.drawModes || []).filter(function (d) { return d.id === "electrical"; })[0]; return m ? m.symbols : []; }
    var bad = [];
    ["Limit switch NO", "Limit switch NC", "Selector switch", "Contact NO", "Contact NC"].forEach(function (lb) {
      var a = pal(x.N).filter(function (s) { return s.label === lb; })[0], b = pal(x.O).filter(function (s) { return s.label === lb; })[0];
      if (!a || !b) { bad.push(lb + " missing"); return; }
      if (JSON.stringify(a.make(X, Y, "#000")) !== JSON.stringify(b.make(X, Y, "#000"))) bad.push(lb + " differs");
    });
    return bad.join("; ");
  });
C("A-palette-has-float", "low", "Draw's Electrical palette",
  "a person drawing a lift station's ladder by hand in Draw can place a float switch (and a pressure and a temperature switch), normally open and closed -- the symbols AI_CONTROL draws",
  function (x) {
    var m = (x.N.L.drawModes || []).filter(function (d) { return d.id === "electrical"; })[0], labs = m ? m.symbols.map(function (s) { return s.label; }) : [];
    var miss = ["float", "pressure", "temperature"].filter(function (w) { return !labs.some(function (l) { return new RegExp(w, "i").test(l); }); });
    return miss.length ? "the palette has no " + miss.join(", ") + " switch (it has: " + labs.filter(function (l) { return /switch|contact|button|stop/i.test(l); }).join(", ") + ")" : "";
  });
module.exports = cases;
