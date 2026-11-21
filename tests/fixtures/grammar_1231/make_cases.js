// writes the grammar cases: each kind's grammar from Lantern, with blocks it must take and replies it must hold out
var load = require(require("path").join(__dirname, "..", "liftstation_review1_1230", "load.js"));
var o = load(process.argv[2] || require("path").join(__dirname, "..", "..", "..", "src", "lantern.inner.html")), L = o.L, G = L.aiAct.grammarFor;
var cases = [];
function add(kind, yes, no) { cases.push({ name: kind, grammar: G(kind), samples: yes.map(function (t) { return { text: t, want: true }; }).concat(no.map(function (t) { return { text: t, want: false }; })) }); }
add("STATION", ["MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\nEND",
  "MAKE STATION: Sewage station\npumps 2\nfloats off lead lag alarm\nfloat FS1 \"off\" 1 m\nfloat FS2 \"lead on\" 1.5 m\nwell \"wet well\" 3 m\ninlet \"200 mm gravity sewer\" 2.4 m\nmain \"100 mm force main\"\nvalves plug\nsupply \"120 V AC\"\nEND",
  "MAKE STATION: Sump\nPumps: 1\nEND", "MAKE STATION: Lift station — duplex\npumps 2\nEND",
  // (the first review) what the parser reads must be let through: any case, a list's bullet or number, a blank line, a tag first
  // (1.24.32) a reply may stop after any whole line, END or no END (1.24.31's run: a reply made to go on to END ran away)
  "MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm\n", "MAKE STATION: Lift station\npumps 2\nfloats off lead lag alarm",
  "MAKE STATION: Station\nPUMPS 2\n- floats off lead lag alarm\n\nWet well: 10 ft deep\nNumber of pumps: 2\nforce main 4 in\ncontrol voltage 120 V AC\nType: duplex\n1. gate valves\nFS1: off float at 2 ft\nEND"],
  ["Here is the block:\nMAKE STATION: Lift station\npumps 2\nEND", "MAKE STATION: Lift station\nThe station has two pumps that take turns.\nEND",
   "MAKE CONTROL: Lift station\npumps 2\nEND", "MAKE STATION: Lift station\npumps 2\nEND\nThat is the station."]);
add("CONTROL", ["MAKE CONTROL: Starter\ne-stop PB0\nrun light LT1 M1\ntime delay relay TR1 \"5 s\"\nEND", "MAKE CONTROL: Duplex pump station\nsupply \"120 V AC\"\nfloat FS1 \"off\"\nfloat FS2 \"lead on\"\nfloat FS3 \"lag on\"\nfloat FS4 \"high level alarm\"\nalternator AR M1 M2\ncoil M1 \"pump 1 starter\"\ncoil M2 \"pump 2 starter\"\nlamp LT1 M1 \"pump 1 run\" green\nEND",
  "MAKE CONTROL: Motor starter\nstop PB1\nstart PB2 M1\noverload OL1 M1\ncoil M1 \"motor starter\"\nlamp LT1 M1 \"run\" green\nEND"],
  ["MAKE CONTROL: Duplex\nThe floats start the pumps.\nEND", "MAKE CONTROL: Duplex\nfloat FS1 \"off\"\nWire L1 to FS1 then to CR1.\nEND"]);
add("PIPING", ["MAKE PIPING: Station\nflap check valve CV1 P1\neccentric plug valve V1 P1\npump P1\nEND", "MAKE PIPING: Lift station\nwell \"wet well\"\ninlet \"8 in gravity sewer\"\npump P1 \"pump 1\"\npump P2 \"pump 2\"\ncheck CV1 P1\nvalve V1 P1 plug\nheader \"4 in force main\"\nvent\nEND",
  "MAKE PIPING: Station\nwet well \"wet well\"\nforce main \"4 in\"\npump P1\nEND"], ["MAKE PIPING: Station\nThe pumps discharge into a header.\nEND"]);
add("LEVELS", ["MAKE LEVELS: Wet well\nwell \"wet well\" 10 ft\npump P1 P2\nfloat FS1 \"off\" 2 ft\nfloat FS2 \"lead on\" 3.5 ft\ninlet \"inlet invert\" 6.5 ft\nEND", "MAKE LEVELS: Wet well\nFS1: off float at 2 ft\n1. float FS2 \"lead on\" 3 ft\nEND"], ["MAKE LEVELS: Wet well\nThe off float is at the bottom.\nEND"]);
add("SHEET", ["MAKE SHEET: Shopping\nItem | Qty | Price | Cost\nBread | 2 | 1.50 | =B2*C2\nEND", "MAKE SHEET: Shopping\nItem | Qty\n", "MAKE SHEET: Ends\nENDS | 1\nEN | 2\nE | 3\nEND"], ["Sure! MAKE SHEET: Shopping\nItem | Qty\nEND", "MAKE SHEET: Shopping\nItem | Qty\nEND\nEnjoy your shopping!"]);
add("SCHEMATIC", ["MAKE SCHEMATIC: Lamp circuit\npart B1 battery \"12 V\"\npart L1 lamp\nwire B1+ L1\nEND", "MAKE SCHEMATIC: Lamp\n\nEND"], ["MAKE SCHEMATIC: Lamp circuit\npart B1 battery\nEND\nI hope this helps."]);
add("CODE", ["MAKE CODE: Blink\nlanguage arduino\nvoid setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }\nEND"], []);
add("DOC", ["MAKE DOC: Notes\n# Notes\nA paragraph with \"quotes\" and a back\\slash.\nEND"], []);
// (1.24.32) the replies of 1.24.31's run that a grammar held and that ran on to the token limit without END
// (tests/fixtures/bench_run_1.24.31_*.json): each cut at its last whole line must now be a reply the model may stop at
var fs = require("fs"), path = require("path"), runaway = {};
["0.8b", "2b", "4b"].forEach(function (m) {
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "bench_run_1.24.31_" + m + ".json"), "utf8")).forEach(function (r) {
    var t = String(r.reply || ""), k = /^MAKE ([A-Z][A-Z ]*[A-Z]):/.exec(t);
    if (!r.grammar || /\nEND\s*$/.test(t) || !k || !G(k[1]) || t.lastIndexOf("\n") < 0) return;
    (runaway[k[1]] = runaway[k[1]] || []).push(t.slice(0, t.lastIndexOf("\n")));
  });
});
Object.keys(runaway).sort().forEach(function (k) { add(k, runaway[k], []); });
console.log(JSON.stringify(cases, null, 1));
