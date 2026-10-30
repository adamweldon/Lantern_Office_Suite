// music.js -- songs made correct by construction (1.19.0): MUSIC_THEORY (keys,
// notes, chords, numerals), MUSIC_SONG_READ and MUSIC_SONG (the lines of a
// song: bars a note's share, holds, rests, octaves where the tune leads,
// the key found, chords chosen, what cannot be right sent back with the
// line to write), MUSIC_BAND (styles), MUSIC_MIDI (a file music programs
// read), MUSIC_SCORE (the lead sheet's layout), MUSIC_SONG_APP (the "Make
// a song" card) and AI_MUSIC (MAKE MUSIC in Chat and on the bench).
// Scripted model; the canvas records calls.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var vc = new VirtualConsole(), errs = [];
vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://127.0.0.1:8080/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
var w = dom.window, d = w.document;
w.alert = function () {}; w.confirm = function () { return true; }; w.scrollTo = function () {};
w.HTMLElement.prototype.scrollIntoView = function () {};
var calls = [];
w.HTMLCanvasElement.prototype.getContext = function () {
  return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; if (k === "measureText") return function (s) { return { width: String(s).length * 7 }; };
    return function () { calls.push(k); }; }, set: function (t, k, v) { t[k] = v; return true; } });
};
var modelReplies = [], modelCalls = [], saved = [];
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
w.fetch = function (url, opts) {
  url = String(url);
  if (/:8081\//.test(url)) return Promise.reject(new TypeError("no library"));
  if (/\/v1\/models$/.test(url)) return resp(200, JSON.stringify({ data: [{ id: "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf" }] }));
  if (/\/props$/.test(url)) return resp(200, JSON.stringify({ modalities: { vision: false, audio: false } }));
  var body = opts && opts.body ? JSON.parse(opts.body) : null;
  modelCalls.push(body);
  var r = modelReplies.length ? modelReplies.shift() : "ANSWER: ok";
  if (typeof r === "function") r = r(body);
  return resp(200, JSON.stringify({ choices: [{ message: { content: r }, finish_reason: "stop" }], usage: { completion_tokens: 20 } }));
};
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 700)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function btn(root, text) { return Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; }
function fire(elm, type) { var e = d.createEvent("Event"); e.initEvent(type, true, true); elm.dispatchEvent(e); }
function go(hash) { w.location.hash = hash; fire(w, "hashchange"); }
function song(lines, title) { return "MAKE MUSIC: " + (title || "Song") + "\n" + lines.join("\n") + "\nEND"; }
function names(p) { return p.melody.map(function (n) { return n.letter + (n.acc > 0 ? "#" : n.acc < 0 ? "b" : "") + n.oct; }).join(" "); }
function lens(p) { return p.melody.map(function (n) { return n.len; }).join(" "); }
function chords(p) { return p.chords.map(function (c) { return c.name + (c.len !== p.barLen ? ":" + c.len : ""); }).join(" "); }

(async function () {
  w.eval(js);
  fire(d, "DOMContentLoaded");
  await sleep(60);
  var L = w.Lantern, T = L.musicTheory, S = L.musicSong, act = L.aiAct;
  ok("boot clean", errs.length === 0, errs);
  ok("the music parts are there", !!(T && L.musicRead && S && L.musicBand && L.musicSynth && L.musicMidi && L.musicScore && L.musicDocs && L.aiMusic));
  L.download = function (name, data, mime) { saved.push({ name: name, data: data, mime: mime }); };

  // --- keys, notes, chords ------------------------------------------------------------------------
  var em = T.keyOf("E minor");
  ok("keys: E minor, Em, F sharp major, Bb, Ebm; G# major is read as Ab; H is no key", em.tonic === 4 && em.minor && em.sig === 1 && T.keyOf("Em").name === "E minor" &&
    T.keyOf("F sharp major").sig === 6 && T.keyOf("Bb").name === "Bb major" && T.keyOf("Ebm").sig === -6 && T.keyOf("G# major").name === "Ab major" && !T.keyOf("H"));
  var D = T.keyOf("D major"); D.declared = true;
  ok("a plain letter takes the key's sharps; # b and n are as written", T.noteOf("F", D, null).acc === 1 && T.noteOf("F", D, null).keyed && T.noteOf("Fn", D, null).acc === 0 &&
    T.noteOf("Bb", D, null).acc === -1 && T.noteOf("C", T.keyOf("D major"), null).acc === 0);
  ok("a note without an octave goes nearest the one before; with one, where it says", T.noteOf("B", null, 60).midi === 59 && T.noteOf("E", null, 60).midi === 64 &&
    T.noteOf("G4", null, 40).midi === 67 && T.noteOf("C", null, null).midi === 60 && T.noteOf("B#3", null, null).midi === 60 && !T.noteOf("H"));
  function cn(s, k) { var c = T.chordOf(s, k ? T.keyOf(k) : null); return c ? c.name + "=" + c.pcs.join(",") : null; }
  ok("chords: kinds, slash, as written (Bbsus4 stays Bb), lowercase", cn("B7") === "B7=11,3,6,9" && cn("Cmaj7") === "Cmaj7=0,4,7,11" && cn("F#m7b5") === "F#m7b5=6,9,0,4" &&
    cn("C/G") === "C/G=0,4,7" && cn("Bbsus4", "E minor") === "Bbsus4=10,3,5" && cn("em") === "Em=4,7,11" && cn("C\u00b0") === "Cdim=0,3,6" && !cn("Hm") && !cn("Cxyz"),
    [cn("B7"), cn("Bbsus4", "E minor"), cn("em")]);
  ok("numerals in the key: I IV V7 in D, i iv V VI III VII in A minor, bVII, V/V, vii\u00b0", cn("V7", "D major") === "A7=9,1,4,7" && cn("bVII", "D major").indexOf("C=") === 0 &&
    cn("V/V", "D major").indexOf("E=") === 0 && cn("vii\u00b0", "D major").indexOf("C#dim=") === 0 &&
    ["i", "iv", "V", "VI", "III", "VII"].map(function (r) { return T.chordOf(r, T.keyOf("A minor")).name; }).join(" ") === "Am Dm E F C G");
  ok("spelling: the key's own letters (Gb in Db, G# in A minor)", [6, 1].map(function (p) { return T.spell(p, T.keyOf("Db major")); }).join() === "Gb,Db" && T.spell(8, T.keyOf("A minor")) === "G#");

  // --- a song: the bars do the timing ---------------------------------------------------------------
  var ODE = song(["key D major", "tempo 108", "chords D | A7 | D | D - A - | D | A7 | D | A - D -",
    "melody F# F# G A | A G F# E | D D E F# | F# - - E E - - - | F# F# G A | A G F# E | D D E F# | E - - D D - - -"], "Ode to Joy");
  var ode = act.build(ODE, "Write out Ode to Joy");
  ok("Ode to Joy: 8 bars in D major, nothing questioned", ode.ok && ode.plan.bars === 8 && ode.plan.key === "D major" && ode.plan.melody.length === 30, ode.problems);
  ok("...a bar's notes share it; - holds one more share (F# - - E E - - - is a dotted quarter, an eighth, a half)", lens(ode.plan).split(" ").slice(12, 15).join(" ") === "1.5 0.5 2" &&
    names(ode.plan).split(" ").slice(0, 4).join(" ") === "F#4 F#4 G4 A4", [lens(ode.plan), names(ode.plan)]);
  ok("...two chords in a bar share it", chords(ode.plan).split(" ").slice(3, 5).join(" ") === "D:2 A:2", chords(ode.plan));
  var tw = S.make({ title: "Twinkle", lines: ["melody C C G G | A A G - | F F E E | D D C -"] });
  ok("a melody alone: the key is found (C major), and Lantern chooses the chords, two in a bar where the tune needs them", tw.plan.key === "C major" &&
    chords(tw.plan) === "C F:2 C:2 F:2 C:2 G:2 C:2" && /Lantern found the key: C major/.test(tw.summary) && /Lantern chose the chords: C F C F C G C/.test(tw.summary), [chords(tw.plan), tw.summary]);
  ok("...each note where the tune leads: up a fifth to G and home to the same C (not down a fourth)", names(tw.plan) === "C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4", names(tw.plan));
  var ch = S.make({ title: "Groove", lines: ["chords: Em - Am - B7 - Em", "style reggae"] });
  ok("chords alone, with dashes between: four bars in E minor, played in the style", ch.plan && ch.plan.bars === 4 && ch.plan.key === "E minor" && !ch.plan.melody.length &&
    chords(ch.plan) === "Em Am B7 Em" && ch.plan.style === "reggae" && ch.plan.tempo === 76 && ch.plan.drums, ch.plan && chords(ch.plan));
  var loose = S.make({ title: "x", lines: ["**Key:** D major", "- Chords: I | IV | V7 | I", "Melody (violin): F-G-A-B D - - - E - - - D (x2)"] });
  ok("lines as models write them: bold, a bullet, numerals, x2, B-A-G-E, an instrument in brackets, no bar lines", loose.plan && loose.plan.sound === "strings" &&
    chords(loose.plan) === "D G A7 D D G A7 D" && loose.plan.bars === 8 && names(loose.plan).split(" ").slice(0, 7).join(" ") === "F#4 G4 A4 B4 D5 E5 D5" && !loose.problems.length, [loose.problems, loose.plan && chords(loose.plan), loose.plan && names(loose.plan)]);
  ok("...no bar lines: a note a beat, the last held to the end of its bar", lens(loose.plan) === "1 1 1 1 4 4 4 1 1 1 1 4 4 4", lens(loose.plan));
  var parts = S.make({ title: "x", lines: ["key G", "Verse:", "chords G | C", "melody G A B - | C - - -", "Chorus:", "chords D | G", "melody A - - - | G - - -"] });
  ok("Verse: and Chorus: make parts, each with its own chords", parts.plan.bars === 4 && chords(parts.plan) === "G C D G" && parts.plan.parts.length === 2, chords(parts.plan));
  var rep = S.make({ title: "x", lines: ["key C", "chords C | G", "melody E D C D | E E E - | D D D - | E G G -"] });
  ok("a part's chords play again under a longer melody, said", chords(rep.plan) === "C G C G" && /the 2 bars of chords play again under the 4 bars of melody/.test(rep.summary), rep.summary);
  var low = S.make({ title: "x", lines: ["key C", "melody C2 D2 E2 F2 | G2 - - -"] });
  ok("a melody written low moves up by octaves to where a tune sings, said", names(low.plan) === "C4 D4 E4 F4 G4" && /moved the melody up 2 octaves/.test(low.summary), [names(low.plan), low.summary]);
  var fd = S.make({ title: "x", lines: ["key D", "melody F G A B"] });
  ok("the key's sharps on plain letters are said", /in D major a plain F is F#/.test(fd.summary) && names(fd.plan) === "F#4 G4 A4 B4", fd.summary);

  // --- what cannot be right goes back with the line to write --------------------------------------
  var bad = S.make({ title: "x", lines: ["key C", "chords C | Hm7 | G", "melody C E/2 G | A4/8 G -"] });
  ok("words that are not notes or chords: one problem each, listing them, with how to write them", bad.problems.length === 2 &&
    /^\u201cE\/2\u201d \(bar 1\), \u201cA4\/8\u201d \(bar 2\) are not notes: .*its length is its share of the bar/.test(bad.problems[0]) &&
    /^\u201cHm7\u201d \(bar 2\) is not a chord Lantern knows: write a letter and its kind/.test(bad.problems[1]), bad.problems);
  var clash = act.build(song(["key E minor", "chords Em | B7 | Em", "melody B - - - | C - - - | E - - -"]), "Write a tune in E minor");
  ok("a long note a half step from its chord: drawn, questioned, with the chords of the key that fit it", clash.plan && !clash.ok &&
    /^bar 2: the melody holds C over B7 \(B D# F# A\), a half step from a note of the chord: write Am or C there \(C is in them\), or change the note$/.test(clash.problems[0]), clash.problems);
  var far = S.make({ title: "x", lines: ["key C", "melody C D E F | G A B C2"] });
  var lead = S.make({ title: "x", lines: ["melody A B | E2"] });
  ok("a note with its octave written stays where it says, and does not pull the notes before it", names(lead.plan) === "A4 B4 E2" && /\u201cE2\u201d is far below/.test(lead.problems[0]), [names(lead.plan), lead.problems]);
  ok("a note far from the rest of the tune: its octave number goes", far.problems.length === 1 && /^bar 2: \u201cC2\u201d is far below the rest of the tune: write it without its octave number/.test(far.problems[0]), far.problems);
  ok("no chords and no melody: nothing to make", !S.make({ title: "x", lines: ["key C", "tempo 90"] }).plan && /there is no chords or melody line/.test(S.make({ title: "x", lines: ["tempo 90"] }).problems[0]));
  var wrong = act.build(song(["key D major", "melody F G A B | A - - -"]), "Write an 8-bar waltz in E minor");
  ok("against the question: its key, a waltz's 3/4, its number of bars", wrong.problems.length === 3 && /the question asks for E minor, but the song is in D major: write key E minor/.test(wrong.problems[0]) &&
    /a waltz is in 3\/4/.test(wrong.problems[1]) && /the question asks for 8 bars; the tune has 2/.test(wrong.problems[2]), wrong.problems);
  ok("...a key asked without major or minor matches either", act.build(song(["key E minor", "chords Em | Am"]), "Play something in E").ok);
  var unread = S.make({ title: "x", lines: ["loudness 11", "key C", "chords C | F", "This is a nice song."] });
  ok("a line Lantern does not read is named, with the lines it reads", /^\u201cloudness 11\u201d: Lantern reads key, tempo, time, style, sound, chords, melody, repeat and note lines$/.test(unread.problems[0]) &&
    unread.problems.length === 2 && /^\u201cThis is a nice song.\u201d: Lantern reads/.test(unread.problems[1]) && chords(unread.plan) === "C F", unread.problems);
  var words = S.make({ title: "x", lines: ["tempo slow", "style gentle lullaby", "sound violin", "time 3/4", "chords C | G7 | C"] });
  ok("plain words: slow is 70, a lullaby is a ballad, a violin the strings", words.plan.tempo === 70 && words.plan.style === "ballad" && words.plan.sound === "strings" && words.plan.n === 3);
  ok("a waltz on its own is in 3/4; 3/4 on its own is a waltz", S.make({ title: "x", lines: ["style waltz", "chords C"] }).plan.time === "3/4" && S.make({ title: "x", lines: ["time 3/4", "chords C"] }).plan.style === "waltz");
  var round = S.make({ title: "x", lines: ode.plan.text.split("\n") });
  ok("the song written back as lines makes the same song", names(round.plan) === names(ode.plan) && chords(round.plan) === chords(ode.plan) && lens(round.plan) === lens(ode.plan));

  // --- the band, the file, the page ---------------------------------------------------------------
  var B = L.musicBand;
  function ev(lines) { return B.events(S.make({ title: "x", lines: lines }).plan); }
  var reg = ev(["key A minor", "style reggae", "chords Am | Dm"]);
  ok("reggae: the chord off the beat (2 and 4), the bass on 1, the one drop on 3", reg.filter(function (e) { return e.part === "chords"; }).map(function (e) { return e.at; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join() === "1,3,5,7" &&
    reg.some(function (e) { return e.part === "bass" && e.at === 0 && e.midi === 45; }) && reg.some(function (e) { return e.drum === "kick" && e.at === 2; }));
  var wz = ev(["style waltz", "chords C | G7"]);
  ok("waltz: bass on 1, the chord on 2 and 3, no drums", wz.filter(function (e) { return e.part === "bass"; }).map(function (e) { return e.at; }).join() === "0,3" &&
    wz.filter(function (e) { return e.part === "chords"; }).map(function (e) { return e.at; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join() === "1,2,4,5" && !wz.some(function (e) { return e.drum; }));
  var v1 = B.voicing(T.chordOf("C"), null), v2 = B.voicing(T.chordOf("F"), v1);
  ok("chords are voiced below the tune, each near the last", v1.every(function (m) { return m >= 48 && m < 72; }) && v2.reduce(function (s, m, i) { return s + Math.abs(m - v1[i]); }, 0) <= 4, [v1, v2]);
  ok("repeat plays it all again", ev(["repeat 2", "chords C | G"]).length === 2 * ev(["chords C | G"]).length && Math.max.apply(null, ev(["repeat 2", "style block", "chords C | G"]).map(function (e) { return e.at; })) === 12);
  var mid = L.musicMidi.file(ode.plan);
  ok("a MIDI file: MThd, five tracks (tempo, melody, chords, bass, drums for a ballad), the tempo 108", String.fromCharCode(mid[0], mid[1], mid[2], mid[3]) === "MThd" && mid[11] === 5 &&
    Array.prototype.join.call(mid.slice(0, 80)).indexOf("255,81,3,8,122,36") >= 0, Array.prototype.slice.call(mid, 0, 16));
  var lay = L.musicScore.draw(d.createElement("canvas"), ode.plan, 640);
  ok("the sheet music: four bars a line at 640 px, two lines; a moment of the song maps to its place", lay.systems.length === 2 && lay.systems[0].bars.length === 4 &&
    L.musicScore.where(lay, 16).y === lay.systems[1].y && L.musicScore.where(lay, 1).x > L.musicScore.where(lay, 0).x && calls.indexOf("bezierCurveTo") >= 0 && calls.indexOf("ellipse") >= 0);
  ok("note values: 1.5 a dotted quarter, 3 a dotted half, 0.5 an eighth", L.musicScore.value(1.5).join() === "1.5,q,1" && L.musicScore.value(3).join() === "3,h,1" && L.musicScore.value(0.5)[1] === "e");

  // --- AI_MUSIC: what the AI is told, Chat, the bench ----------------------------------------------
  var ONE = "Can you create the note progression from one love so that we can hear it?";
  ok("music questions get MAKE MUSIC and nothing else; essays, programs and meeting notes do not", act.relevant(ONE).map(function (a) { return a.id; }).join() === "music" &&
    act.relevant("Draw the sheet music for Twinkle Twinkle").map(function (a) { return a.id; }).join() === "music" && act.relevant("What are the chords of Greensleeves?").length === 1 &&
    !L.aiMusic.asks("Write an essay about the history of music") && !L.aiMusic.asks("Write an Arduino sketch that plays a melody on a buzzer") && !L.aiMusic.asks("Write meeting notes for Monday") &&
    !L.aiMusic.asks("Draw a house on a hill at sunset."), act.relevant(ONE).map(function (a) { return a.id; }));
  var pr = L.CHAT.buildSystem(ONE);
  ok("...the prompt: the lines, the bars do the timing, never lengths or MIDI numbers, an example not the bench's", /MAKE MUSIC: <title>/.test(pr) && /the notes of a bar share it equally/.test(pr) &&
    /Never write note lengths, MIDI\nnumbers or frequencies/.test(pr) && /MAKE MUSIC: Morning walk/.test(pr) && !/Ode to Joy/.test(pr));
  ok("ten actions, music last", L.aiActions.map(function (a) { return a.id; }).join(",") === "schematic,drawing,wheel,sheet,doc,slides,cards,plan,code,music", L.aiActions.map(function (a) { return a.id; }));
  var fx = act.fixText(act.build(song(["key C", "melody C E/2 G"]), "a tune"), "a tune");
  ok("the correction turn names the problem and how Lantern reads a MAKE MUSIC block", /^Lantern checked your MAKE MUSIC block: \u201cE\/2\u201d \(bar 1\) is not a note/.test(fx) &&
    /Lantern reads a MAKE MUSIC block line by line, like this:\nkey E minor/.test(fx) && /Reply with the corrected block only \(MAKE MUSIC: Song \.\.\. END\)/.test(fx), fx);
  var Q = L.aiBenchQuestions.filter(function (q) { return q.kind === "MUSIC"; });
  function grade(id, reply) { var item = Q.filter(function (q) { return q.id === id; })[0]; return L.aiBench.grade(item, reply, { made: act.build(reply, item.q) }); }
  ok("the bench: two songs, both model answers pass", Q.length === 2 && Q.every(function (q) { return q.cat === "make" && grade(q.id, q.ideal).pass; }), Q.map(function (q) { return grade(q.id, q.ideal).why; }));
  ok("...Ode to Joy with a wrong note fails, named; in another key it passes", /^note 4 of the theme is wrong/.test(grade("make-music-ode", Q[0].ideal.replace("F# F# G A | A G", "F# F# G B | A G")).why) &&
    grade("make-music-ode", song(["key C", "melody E E F G | G F E D | C C D E | E - - D D - - -"])).pass);
  ok("...the tune of its own: G major, 8 bars, a walking pace, home at the end", /questions it: the question asks for G major, but the song is in D major/.test(grade("make-music-original", song(["key D", "chords D | A | D | A | D | A | D | D", "melody D E F A | A - - - | D E F A | A - - - | D E F A | A - - - | F E D E | D - - -"])).why) &&
    /questions it: the question asks for 8 bars; the tune has 4/.test(grade("make-music-original", song(["key G", "chords G | C | D | G", "melody G A B G | C - - - | A - - - | G - - -"])).why) &&
    grade("make-music-original", song(["key G", "melody G A B G | C - E D | D C B A | B - G - | E5 - C E | D B G B | A F# A C | B - G -"])).pass);

  // --- 1.19.1: the bench run on 1.19.0 (a 35B, fixtures/bench_run_1190_35b.json): both songs were 4 bars of tune under
  // 8 bars of chords; the Ode's 4th bar had its rhythm evened out. Both passed the bench.
  var R19 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bench_run_1190_35b.json"), "utf8"));
  function row(id) { return R19.rows.filter(function (r) { return r.id === id; })[0]; }
  var od = act.build(row("make-music-ode").reply, row("make-music-ode").q);
  var TAIL = "the chords go on 4 bars past the melody (bars 5 to 8 have no tune): write the melody for bars 5 to 8 too, or end the chords at bar 4";
  ok("chords going on well past the melody: questioned, with the bars to fill", od.plan && !od.ok && od.problems.length === 1 && od.problems[0] === TAIL, od.problems);
  ok("...a bar or two of chords after the tune is an ending, said", S.make({ title: "x", lines: ["chords C | C | G | C | F | C", "melody E D C D | E E E - | D D E D | C - - -"] }).problems.length === 0 &&
    /bars 5 to 6 are chords alone/.test(S.make({ title: "x", lines: ["chords C | C | G | C | F | C", "melody E D C D | E E E - | D D E D | C - - -"] }).summary));
  var oq = Q.filter(function (q) { return q.id === "make-music-ode"; })[0], orig = Q.filter(function (q) { return q.id === "make-music-original"; })[0];
  ok("...the bench: the 35B's Ode is now questioned, and its 4th bar's rhythm is not the theme's", /^Lantern still questions it: the chords go on 4 bars/.test(grade("make-music-ode", row("make-music-ode").reply).why) &&
    /^the rhythm is off at note 13/.test(grade("make-music-ode", song(["key C", "chords C | G | Am | F", "melody E E F G | G F E D | C C D E | E D D -"])).why) &&
    grade("make-music-ode", song(["key C", "chords C | G | Am | F G", "melody E E F G | G F E D | C C D E | E - - D D - - -"])).pass);
  var o1 = act.build(row("make-music-original").first, orig.q), o2 = act.build(row("make-music-original").reply, orig.q);
  ok("the 35B's tune of its own: first the short tune and the long F# over G together, then the short tune still", o1.problems.length === 2 && o1.problems[0] === TAIL &&
    /^bar 4: the melody holds F# over G/.test(o1.problems[1]) && o2.problems.length === 1 && o2.problems[0] === TAIL && !grade("make-music-original", row("make-music-original").reply).pass, [o1.problems, o2.problems]);
  ok("...the bench needs the tune itself to fill the 8 bars", /^the tune is 4 bars; the chords go on alone to bar 8$/.test(L.aiBench.grade(orig, "x", { made: { ok: true, action: { kind: "MUSIC" }, plan: S.make({ title: "x",
    lines: ["key G", "chords G | C | D | G | G | C | D | G", "melody G A B G | C - E D | D C B A | G - - - | r | r | r | r"] }).plan } }).why));


  // Chat: a song is made, played and saved; a bad word goes back once
  await L.ai.detect();
  go("chat"); await sleep(40);
  function chatAsk(text) { var cin = d.querySelector("input[aria-label=\"Message\"]"); cin.value = text; modelCalls = []; btn(d, "Send").click(); }
  function logText() { return d.querySelector("[aria-label=\"Conversation\"]").textContent; }
  modelReplies = ["Here is the tune.\n" + song(["key C", "chords C | F C | F C | G C", "melody C C G G | A A G - | F F E E | D D C h"], "Twinkle"),
    function (body) { var last = body.messages[body.messages.length - 1].content; return /\u201ch\u201d \(bar 4\) is not a note/.test(last) ? song(["key C", "chords C | F C | F C | G C", "melody C C G G | A A G - | F F E E | D D C -"], "Twinkle") : "?"; }];
  var before = logText().length;
  chatAsk("Play Twinkle Twinkle Little Star for me"); await sleep(250);
  var t = logText().slice(before);
  ok("Chat: the AI is told MAKE MUSIC; a word that is not a note goes back once; the song is made", /MAKE MUSIC: <title>/.test(modelCalls[0].messages[0].content) && modelCalls.length === 2 &&
    /Lantern checked the MAKE MUSIC block: \u201ch\u201d \(bar 4\) is not a note/.test(t) && /Lantern made a song: Twinkle \u2014 4 bars in C major/.test(t) && !/still questions/.test(t),
    [modelCalls.length, /MAKE MUSIC: <title>/.test(modelCalls[0].messages[0].content), t.slice(-300)]);
  var card = Array.prototype.slice.call(d.querySelectorAll(".la-make")).pop();
  ok("...with the sheet music, Play, Open in Music, Save MIDI and Save WAV", card && card.querySelector("canvas") && btn(card, "\u25b6 Play") && btn(card, "Open in Music") && btn(card, "Save MIDI") && btn(card, "Save WAV"));
  btn(card, "\u25b6 Play").click(); await sleep(20);
  ok("...Play with no sound on this device says so, and the music is still written out", /no sound available/.test(card.textContent));
  btn(card, "Save MIDI").click();
  ok("...Save MIDI downloads Twinkle.mid", saved.length === 1 && saved[0].name === "Twinkle.mid" && saved[0].mime === "audio/midi", saved.map(function (s) { return s.name; }));
  btn(card, "Open in Music").click(); await sleep(80); fire(w, "hashchange"); await sleep(80);
  var song1 = L.store.get("music.song", {});
  ok("Open in Music: the song goes to the Make a song card, with what Lantern wrote in", /^title Twinkle\nkey C major/.test(song1.text) && /melody C C G G \| A A G - \| F F E E \| D D C -/.test(song1.text), song1);
  // the card in the Music tile
  go("music"); await sleep(120);
  var ta = d.querySelector("textarea[aria-label=Song]");
  ok("the Make a song card: the song in its box, written out, with Save MIDI, Save WAV and examples", ta && /title Twinkle/.test(ta.value) && d.querySelector(".la-song canvas") &&
    btn(d, "Save MIDI") && btn(d, "Save WAV") && d.querySelectorAll("select[aria-label='Start from'] option").length === 6, ta && ta.value);
  var sel = d.querySelector("select[aria-label='Start from']");
  sel.value = "1"; fire(sel, "change"); await sleep(30);
  ok("...an example: Ode to Joy, 8 bars in D major", /title Ode to Joy/.test(ta.value) && /8 bars in D major/.test(d.body.textContent));
  ta.value = "key C\nchords C | Q7"; fire(ta, "input"); await sleep(700);
  ok("...typing redraws: a problem is shown, and what is kept", /\u201cQ7\u201d \(bar 2\) is not a chord/.test(d.body.textContent) && L.store.get("music.song", {}).text === "key C\nchords C | Q7");
  L.musicDocs.EXAMPLES.forEach(function (x) { var r = S.make({ title: "", lines: x[1].split("\n") }); ok("example " + x[0] + ": made, nothing questioned", r.plan && !r.problems.length, r.problems); });

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? fails + " MUSIC TESTS FAILED (" + passes + " passed)" : "ALL MUSIC TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
