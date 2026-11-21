// make_grammar.js -- the third review's grammar cases: each kind's grammar as Lantern writes it now (grammarFor), with
// the blocks the reviewer judges right (want true) and the replies that are not a block (want false). Run from the
// repository root:
//   node tests/fixtures/station_review3_1231/make_grammar.js > tests/fixtures/station_review3_1231/grammar_cases.json
//   python3 tools/gbnf_check.py --lib <llama.cpp release>/libllama.so --vocab ggml-vocab-qwen2.gguf \
//     tests/fixtures/station_review3_1231/grammar_cases.json --out tests/fixtures/station_review3_1231/grammar_results.json
// The right blocks include the ones Lantern itself writes for a station (plan.blocks: its MAKE CONTROL, PIPING and
// LEVELS) and the lines Lantern's own parsers read; the replies held out are prose, a preface, a code fence, text after
// END. cases_f.js judges the results (and checks the grammars there are still Lantern's).
"use strict";
var H = require("./lib.js");
H.boot().then(function () {
  var L = H.L(), G = L.aiAct.grammarFor, cases = [];
  function add(name, kind, yes, no) { cases.push({ name: name, kind: kind, grammar: G(kind), samples: yes.map(function (t) { return { text: t, want: true }; }).concat(no.map(function (t) { return { text: t, want: false }; })) }); }
  var Q = "Design a lift station: the control circuit, the piping and the float levels";
  // Lantern's own blocks for a range of stations: each must pass the grammar of its own kind
  var specs = [["pumps 2"], ["pumps 1", "floats off lead alarm", "horn"], ["pumps 2", "floats low level alarm, off, lead, lag, high level alarm"],
    ["pumps 2", "floats off, lag off, lead, lag, high level alarm, high high alarm", "horn"], ["pumps 2", "floats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft", "well \x22wet well\x22 10 ft", "inlet \x228 in gravity sewer\x22 6.5 ft", "main \x224 in force main\x22", "valves plug", "supply \x2224 V DC\x22"],
    ["pumps 3"], ["pumps 2", "lights none", "valves eccentric plug"], ["pumps 2", "floats off 600 mm, lead 900 mm, lag 1200 mm, alarm 1500 mm", "well \x22wet well\x22 3 m"]];
  var own = { CONTROL: [], PIPING: [], LEVELS: [] };
  specs.forEach(function (ls) {
    var r = L.aiAct.build(H.st(ls), Q);
    if (!r || !r.plan) return;
    Object.keys(r.plan.blocks).forEach(function (v) { own[v.toUpperCase()].push(r.plan.blocks[v]); });
  });
  add("own CONTROL blocks", "CONTROL", own.CONTROL, []);
  add("own PIPING blocks", "PIPING", own.PIPING, []);
  add("own LEVELS blocks", "LEVELS", own.LEVELS, []);
  // MAKE STATION: right blocks, written the ways the parser reads
  add("STATION right", "STATION", [
    "MAKE STATION: Duplex lift station\npumps 2\nfloats off lead lag alarm\nEND",
    "MAKE STATION: Storm water station\npumps 2\nfloats off 2 ft, lead 3 ft, lag 4 ft, alarm 5 ft\nwell \x22wet well\x22 12 ft\nEND",
    "MAKE STATION: Station\nPumps: 2\nFloats: off, lead, lag, high level alarm\nWet well: 10 ft deep\nForce main: 4 in\nControl voltage: 120 V AC\nEND",
    "MAKE STATION: Station\n  pumps 2\n  floats off lead lag alarm\nEND",
    "MAKE STATION: Station\n* pumps 2\n* floats off lead lag alarm\nEND",
    "MAKE STATION: Station\n2) pumps 2\n3) floats off lead lag alarm\nEND",
    "MAKE STATION: Station\nfloat FS1 “off” 2 ft\nfloat FS2 “lead on” 3 ft\nEND",
    "MAKE STATION: Station\nFS1 off 2 ft\nFS2 lead on 3 ft\nFS3 lag on 4 ft\nLSHH1 high high alarm 6 ft\nEND",
    "MAKE STATION: Station\nduplex\nhigh level alarm float 5 ft\nlow level alarm float 1 ft\nEND",
    "MAKE STATION: Station\nswing check valves\ngate valves\nalarm horn\nrun lights\nshow control piping\nEND",
    "MAKE STATION: Station\nsimplex\nfloats off, pump on, alarm\nnote \x22set the floats as the pump maker says\x22\nEND",
    "MAKE STATION: Station\npumps 2\nfloats off 24\x22, lead 36\x22, lag 48\x22, alarm 60\x22\nEND",
    "MAKE STATION: Station\nPUMPS 2\nFLOATS OFF LEAD LAG ALARM\nEND",
    "MAKE STATION: Station\nshut-off valves: plug\nrising main \x22100 mm\x22\nEND",
    "MAKE STATION: Station\npumps 2\n\nfloats off lead lag alarm\nEND"
  ], [
    "Here is the station.\nMAKE STATION: Lift station\npumps 2\nEND",
    "```\nMAKE STATION: Lift station\npumps 2\nEND\n```",
    "MAKE STATION: Lift station\n```\npumps 2\n```\nEND",
    "MAKE STATION: Lift station\n**pumps** 2\nEND",
    "MAKE STATION: Lift station\nI chose two pumps.\nEND",
    "MAKE STATION: Lift station\nThis is a duplex station with four floats.\nEND",
    "MAKE STATION: Lift station\npumps 2\nEND\n\nThe station above has two pumps.",
    "MAKE STATION:\npumps 2\nEND",
    "MAKE STATION: Lift station\npumps 2\nEND\nMAKE PIPING: Lift station\npump P1\nEND",
    "MAKE STATION: Lift station\nWire L1 to FS1, then to CR1.\nEND"
  ]);
  // MAKE STATION: right lines the parser reads that the grammar's first words do not take (judged in cases_f)
  add("STATION read but held", "STATION", ["MAKE STATION: Station\n2 pumps\nEND", "MAKE STATION: Station\nTwo submersible pumps\nEND"], []);
  // MAKE STATION: prose that begins with a word the grammar takes (judged in cases_f)
  add("STATION prose on a role word", "STATION", [], ["MAKE STATION: Station\nPump 1 and pump 2 take turns, so they wear evenly.\nEND", "MAKE STATION: Station\nFloats are set by the design engineer.\nEND"]);
  // the station's other names
  add("LIFT STATION", "LIFT STATION", ["MAKE LIFT STATION: North\npumps 2\nEND"], ["MAKE STATION: North\npumps 2\nEND"]);
  // the drawings' blocks a correction is held to
  add("CONTROL right", "CONTROL", [
    "MAKE CONTROL: Duplex\nsupply \x22120 V AC\x22\nfloat FS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nfloat FS3 \x22lag on\x22\nfloat FS4 \x22high level alarm\x22\nalternator AR M1 M2\ncoil M1 \x22pump 1 starter\x22\ncoil M2 \x22pump 2 starter\x22\nlamp LT3 FS4 \x22high level\x22 red\nhorn AH1 FS4 \x22high level\x22\nEND",
    "MAKE CONTROL: Starter\nstop PB1 M1\nstart PB2 M1\noverload OL1 M1\ncoil M1 \x22motor starter\x22\nlamp LT1 M1 \x22run\x22 green\nfuse FU1\nestop ES1\ninterlock M1 M2\nnote \x22120 V control\x22\nEND",
    "MAKE CONTROL: Duplex\nlevel LS1 \x22off\x22\nfloat FS2 \x22lead on\x22\nalternating AR M1 M2\ncontactor M1\ncontactor M2\nlight LT1 M1 \x22run\x22\nEND",
    "MAKE CONTROL: Timer\nswitch SS1 CR1\nrelay CR1 \x22run\x22\ntimer TR1 \x225 s\x22 CR1\nsolenoid SOL1 TR1\nlimit LS1 CR1\npressure PS1 M1\ntemp TS1 M1\nEND",
    "MAKE CONTROL: Motor\nmotor starter M1\npush button PB2 M1\nemergency stop ES1\npilot light LT1 M1\nEND"
  ], [
    "MAKE CONTROL: Duplex\nRung 1: FS2 pulls in CR1.\nEND",
    "MAKE CONTROL: Duplex\nL1 -- FS1 -- CR1 -- L2\nEND",
    "MAKE CONTROL: Duplex\nfloat FS1 \x22off\x22\nEND\nThe floats start the pumps."
  ]);
  add("PIPING right", "PIPING", [
    "MAKE PIPING: Station\nwell \x22wet well\x22\ninlet \x228 in gravity sewer\x22\npump P1 \x22pump 1\x22\npump P2 \x22pump 2\x22\ncheck CV1 P1\ncheck CV2 P2\nvalve V1 P1 plug\nvalve V2 P2 plug\nheader \x224 in force main\x22\nvent\nEND",
    "MAKE PIPING: Station\nwet well\nswing check valve CV1 P1\ngate valve V1 P1\nforce main \x22100 mm\x22\nsubmersible pump P1\nEND"
  ], ["MAKE PIPING: Station\nP1 discharges through CV1 to the header.\nEND"]);
  add("LEVELS right", "LEVELS", [
    "MAKE LEVELS: Wet well\nwell \x22wet well\x22 10 ft\npump P1 P2\nfloat FS1 \x22off\x22 2 ft\nfloat FS2 \x22lead on\x22 3 ft\nfloat FS3 \x22lag on\x22 4 ft\nfloat FS4 \x22high level alarm\x22 5 ft\ninlet \x22inlet invert\x22 6.5 ft\nEND",
    "MAKE LEVELS: Wet well\noff 2 ft\nlead 3 ft\nlag 4 ft\nalarm 5 ft\nfloor 0 ft\nEND",
    "MAKE LEVELS: Wet well\nLSHH1 high high alarm 7 ft\nFS1: off at 2 ft\nEND"
  ], ["MAKE LEVELS: Wet well\nThe floats hang from a bracket.\nEND"]);
  // kinds with no words of their own: any line, but the block and nothing else
  add("SLIDES", "SLIDES", ["MAKE SLIDES: Lift station\n# Lift station\n- Two pumps take turns\n- Four floats\nEND"], ["Here are the slides:\nMAKE SLIDES: Lift station\n# Lift station\nEND"]);
  add("SHEET", "SHEET", ["MAKE SHEET: Run hours\nPump | Hours\nP1 | 120\nP2 | 118\nEND"], ["MAKE SHEET: Run hours\nPump | Hours\nEND\nI added two rows."]);
  // the lines Lantern hands back in a correction, written as the model is told to write them, under the grammar the
  // correction is held to (fixKind): MAKE CONTROL's, MAKE LEVELS' and MAKE STATION's own
  function likes(problems) {
    var out = [];
    problems.forEach(function (p) { var m = /like:? (.*)$/.exec(p); if (m) m[1].replace(/\.$/, "").split(/,\s+(?:or [a-z ]+:\s+)?(?=(?:float|coil|start|stop|limit|switch|alternator|lamp|horn|pressure|button|well|pump|inlet)\b)/).forEach(function (l) { out.push(l.replace(/^\s+|\s+$/g, "")); }); });
    return out;
  }
  var CQ = "Draw the control circuit for a duplex lift station with an alternating relay";
  var broken = [
    ['float FS1 "off"', 'float FS2 "lead on"', 'alternator AR M1 M2', 'coil M1'],
    ['float FS1 "off"', 'float FS2 "float two"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'],
    ['stop PB1', 'coil M1 "motor starter"', 'coil M2 "fan"', 'limit LS1'],
    ['alternator AR M1 M2 M3', 'coil M1', 'coil M2', 'coil M3', 'float FS1 "off"', 'float FS2 "lead on"']
  ], fixC = [];
  broken.forEach(function (ls) { var r = L.aiAct.build(H.ctl(ls), CQ); if (r && !r.ok && L.aiAct.fixKind(r) === "CONTROL") { var l = likes(r.problems); if (l.length) fixC.push("MAKE CONTROL: Fixed\n" + l.join("\n") + "\nEND"); } });
  add("CONTROL fix lines", "CONTROL", fixC, []);
  var lvR = L.aiAct.build(H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm" 6 ft']), "Draw where the floats go in a wet well");
  add("LEVELS fix lines", "LEVELS", ["MAKE LEVELS: Wet well\npump P1 P2\n" + likes(lvR.problems || []).join("\n") + "\nEND"], []);
  var SQ0 = "Design a duplex lift station: draw the control circuit, the piping and the float levels";
  var C4 = H.ctl(['float FS1 "off"', 'float FS2 "lead on"', 'float FS3 "lag on"', 'float FS4 "high level alarm"', 'alternator AR M1 M2', 'coil M1 "pump 1 starter"', 'coil M2 "pump 2 starter"'], "Duplex");
  var clash = L.aiAct.build(C4 + "\n\n" + H.blk("LEVELS", "Wet well", ['pump P1 P2', 'float FS1 "off" 2 ft', 'float FS2 "lead on" 3 ft', 'float FS3 "high level alarm" 5 ft']), SQ0);
  var simplex = L.aiAct.build(H.ctl(['float FS1 "off"', 'float FS2 "pump on"', 'coil M1 "pump starter"'], "Simplex"), SQ0);
  var hint = [];
  L.aiActions.forEach(function (a) { if (a.id === "station" && a.fixHint) hint = a.fixHint().slice(1); });
  add("STATION fix lines", "STATION", ["MAKE STATION: Duplex\n" + hint.join("\n") + "\nEND", "MAKE STATION: Duplex\npumps 2\n" + likes(clash.problems || []).join("\n") + "\nEND",
    "MAKE STATION: Duplex\n" + likes(simplex.problems || []).join("\n") + "\nEND"], []);
  // the whole guide copied (the 0.8B's way, 1.24.30): its prose lines are held out
  var guide = [];
  L.aiActions.forEach(function (a) { if (a.id === "station") guide = a.prompt.slice(1).filter(function (l) { return !/^(MAKE STATION|END)/.test(l); }); });
  add("STATION guide copied", "STATION", [], ["MAKE STATION: Copied\n" + guide.join("\n") + "\nEND"]);
  // every bench ideal's block (both sets), under its own kind's grammar: what a correction of that kind is held to must
  // let the right answer through
  var byKind = {};
  H.bench().forEach(function (it) {
    var re = /^MAKE ([A-Z][A-Z0-9 ]*?):[^\n]*\n[\s\S]*?^END[ \t]*$/gm, m;
    while ((m = re.exec(String(it.ideal || "")))) { if (!G(m[1])) continue; (byKind[m[1]] = byKind[m[1]] || []).push(m[0]); }
  });
  Object.keys(byKind).sort().forEach(function (k) { add("bench ideals " + k, k, byKind[k], []); });
  process.stdout.write(JSON.stringify(cases, null, 1) + "\n");
  process.exit(0);
});
