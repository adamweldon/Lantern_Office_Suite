// cases_pick.js -- which practice a question is checked to (Lantern.codeChecks.pick: a code named, then a place, then a
// voltage or frequency, then the user's saved choice, then US), and what the user sees under a made drawing.
"use strict";
function P(id, q, expect, saved, o) { o = o || {}; o.id = id; o.kind = "pick"; o.q = q; o.expect = expect; o.saved = saved || ""; return o; }
function text(el) { return el ? el.textContent : ""; }
function btn(el, re) { var bs = el ? el.querySelectorAll("button") : []; for (var i = 0; i < bs.length; i++) if (re.test(bs[i].textContent)) return bs[i]; return null; }
var STARTER = "MAKE CONTROL: Starter\nestop ES1\nstop PB1 M1\nstart PB2 M1\ncoil M1 \x22motor starter\x22\noverload OL1 M1\nEND";
module.exports = [
  P("p-default", "Draw a motor starter with start and stop buttons", "US"),
  P("p-saved-iec", "Draw a motor starter with start and stop buttons", "IEC", "IEC"),
  P("p-saved-us", "Draw a motor starter with start and stop buttons", "US", "US"),
  P("p-saved-bad", "Draw a motor starter with start and stop buttons", "US", "iec"),
  P("p-iec-named", "Draw a motor starter to IEC 60204-1", "IEC", "US"),
  P("p-nec-named", "Draw a motor starter per the NEC", "US", "IEC"),
  P("p-nfpa79", "Draw the control circuit to NFPA 79 for a machine", "US", "IEC"),
  P("p-bs7671", "Draw a contactor circuit to BS 7671", "IEC"),
  P("p-asnzs", "Draw a DOL starter to AS/NZS 3000", "IEC"),
  P("p-germany", "Draw a motor starter for a plant in Germany", "IEC"),
  P("p-uk", "Draw a motor starter for a farm in the UK", "IEC"),
  P("p-uk-bare", "UK pump starter wiring please", "IEC"),
  P("p-nsw", "Draw a starter for a customer in New South Wales", "IEC"),
  P("p-ireland", "Draw a starter for a dairy farm in Ireland", "IEC"),
  P("p-n-ireland", "Draw a starter for a farm in Northern Ireland", "IEC", "", { harm: "low" }),
  P("p-brazil", "Draw a pump starter for a mine in Brazil", "IEC"),
  P("p-european-customer", "Draw a motor starter for a European customer", "IEC"),
  P("p-south-american-mine", "Draw a conveyor starter for a South American mine", "IEC"),
  P("p-texas", "Draw a motor starter for a shop in Texas", "US", "IEC"),
  P("p-south-carolina", "Draw a pump starter for a plant in South Carolina", "US", "IEC"),
  P("p-washington", "Draw a starter for a sawmill in Washington state", "US", "IEC"),
  P("p-new-england", "Draw a starter for a mill in New England", "US", "IEC"),
  P("p-indiana", "Draw a pump starter for a farm in Indiana", "US", "IEC"),
  P("p-india-street", "Draw a pump starter for the shop on India Street", "IEC", "IEC"),
  P("p-french-drain", "Draw the control for a French drain pump", "US"),
  P("p-german-shepherd", "Draw a fan starter for the German shepherd kennel", "US"),
  P("p-us-abbrev", "Draw a starter for our plant in the US", "US", "IEC"),
  P("p-show-us-lower", "Show us a motor starter circuit", "IEC", "IEC"),
  P("p-show-us-caps", "SHOW US A MOTOR STARTER CIRCUIT PLEASE", "IEC", "IEC"),
  P("p-ontario-csa", "Draw a starter to CSA rules for a plant in Ontario", "US", "IEC"),
  P("p-400v-50hz", "Draw a starter for a 400 V 50 Hz motor", "IEC"),
  P("p-480v-60hz", "Draw a starter for a 480 V 60 Hz motor", "US", "IEC"),
  P("p-50hz-word", "Draw a pump starter, supply 230/400V 50Hz", "IEC"),
  P("p-both-volts", "Draw a starter with 120 V control for a 400 V motor", "IEC", "IEC"),
  P("p-code-beats-place", "Draw a motor starter for a plant in Germany, to the NEC", "US"),
  P("p-ul-europe", "Draw a UL listed starter panel for export to Europe", "US"),
  P("p-ce-texas", "Draw a CE marked machine starter for a plant in Texas", "IEC"),
  P("p-redraw-to-iec", "Redraw this NEC starter to IEC", "IEC"),
  P("p-convert-to-nec", "Convert this IEC drawing to NEC", "US"),
  P("p-not-iec", "Not to IEC: draw the starter per NEC please", "US", "", { harm: "low" }),
  P("p-american-in-germany", "Draw a starter for an American company’s plant in Germany", "IEC", "", { harm: "low" }),
  // what the user sees, and the button that switches the practice
  { id: "p-view-switch", kind: "fn", harm: "medium", run: async function (env) {
    var o = await env.fresh(), L = o.L, m = L.aiAct.build(STARTER, "Draw a motor starter with an e-stop");
    if (!m || !m.ok || !m.codes) return "the starter did not build with its codes";
    var el = L.codeChecks.view(m), t = text(el);
    if (!/^Checked to US practice \(NEC and NFPA 79\): /.test(t) || !/NEC Article 430, Part III/.test(t) || !/NFPA 79, 10\.7/.test(t) || /IEC 60204/.test(t)) return "the US line is wrong: " + t;
    var b = btn(el, /Use IEC practice/);
    if (!b) return "no button to switch to IEC";
    b.click();
    t = text(el);
    if (!/^Checked to IEC practice \(IEC 60204-1\): /.test(t) || !/IEC 60204-1:2016, 7\.3/.test(t) || !/IEC 60204-1:2016, 10\.7/.test(t) || /NEC Article|NFPA/.test(t)) return "the IEC line after the switch is wrong: " + t;
    if (L.store.get("codes.practice", "") !== "IEC") return "the choice is not kept";
    if (L.codeChecks.pick("Draw a pump starter") !== "IEC") return "a question naming neither code is not checked to the kept choice";
    var back = L.aiAct.build("MAKE CONTROL: S\nstop PB1 M1 no\nstart PB2 M1\ncoil M1 \x22pump starter\x22\nEND", "Draw a pump starter");
    if (!back || !back.problems || !back.problems.some(function (p) { return /IEC practice: IEC 60204-1:2016, 9\.4/.test(p); }) || back.problems.some(function (p) { return /US practice|NFPA/.test(p); })) return "what goes back after the switch names the wrong practice: " + JSON.stringify(back && back.problems);
    if (L.codeChecks.pick("Draw a pump starter for a shop in Texas") !== "US") return "a US place does not win over the kept choice";
    b = btn(el, /Use US practice/);
    if (!b) return "no button back to US";
    b.click();
    return L.store.get("codes.practice", "") === "US" && /^Checked to US practice/.test(text(el)) ? "" : "switching back does not keep US";
  } },
  { id: "p-view-none", kind: "fn", harm: "low", run: async function (env) {
    var L = env.L, m = L.aiAct.build("MAKE CONTROL: Lamp\nswitch SS1 LT1\nlamp LT1 \x22on\x22 white\nEND", "Draw a switch and a lamp control circuit");
    if (!m || !m.ok) return "did not build: " + JSON.stringify(m && m.problems);
    return L.codeChecks.view(m) ? "a line shown where nothing was checked: " + text(L.codeChecks.view(m)) : "";
  } },
  { id: "p-view-in-aiact", kind: "fn", harm: "medium", run: async function (env) {
    var o = await env.fresh(), L = o.L, m = L.aiAct.build(STARTER, "Draw a motor starter with an e-stop"), v = L.aiAct.view(m), t = text(v);
    return /Checked to US practice/.test(t) && btn(v, /Use IEC practice/) && btn(v, /Keep as my given/) ? "" : "the made drawing’s view lacks the codes line or the buttons: " + t.slice(0, 300);
  } },
  { id: "p-view-not-control", kind: "fn", harm: "medium", run: async function (env) {
    var L = env.L, m = L.aiAct.build("MAKE DRAWING: Sun\ncircle 10 6 3 fill yellow\nEND", "Draw a sun"), v = m ? L.aiAct.view(m) : null, t = text(v);
    return /Checked to|Keep as my given/.test(t) ? "a drawing shows the code checks or the keep button: " + t.slice(0, 200) : "";
  } },
  { id: "p-back-one-practice", kind: "fn", harm: "medium", run: async function (env) {
    var L = env.L, qs = ["Draw an air compressor circuit for a plant in Germany", "Draw an air compressor circuit for a plant in Ohio"], out = [];
    qs.forEach(function (q, i) {
      var r = L.aiAct.build("MAKE CONTROL: C\npressure PS1 M1 \x22cut-out 120 psi\x22\nstop PB1 M1 no\nstart PB2 M1\ncoil M1 \x22compressor starter\x22\noverload OL1 M1\nEND", q), ps = (r && r.problems) || [];
      var other = i === 0 ? /US practice|NFPA|NEC/ : /IEC/;
      if (ps.length !== 2) out.push(q + ": " + ps.length + " went back, not 2");
      if (ps.some(function (p) { return other.test(p); })) out.push(q + ": names the other practice: " + ps.join(" | "));
    });
    return out.join("; ");
  } }
];
