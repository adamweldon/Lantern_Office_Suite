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
  ok("lines as models write them: bold, a bullet, numerals, x2, B-A-G-E, an instrument in brackets, no bar lines", loose.plan && loose.plan.sound === "violin" &&
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
  ok("a line Lantern does not read is named, with the lines it reads", /^\u201cloudness 11\u201d: Lantern reads key, tempo, time, style, sound, backing, bass, drums, chords, melody, repeat, arrange, form, part and note lines$/.test(unread.problems[0]) &&
    unread.problems.length === 2 && /^\u201cThis is a nice song.\u201d: Lantern reads/.test(unread.problems[1]) && chords(unread.plan) === "C F", unread.problems);
  var words = S.make({ title: "x", lines: ["tempo slow", "style gentle lullaby", "sound violin", "time 3/4", "chords C | G7 | C"] });
  ok("plain words: slow is 70, a lullaby is a ballad, a violin a violin (1.20.0)", words.plan.tempo === 70 && words.plan.style === "ballad" && words.plan.sound === "violin" && words.plan.n === 3);
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
  ok("the bench: four songs (1.22.0: the Ode for an orchestra), every model answer passes", Q.length === 4 && Q.every(function (q) { return q.cat === "make" && grade(q.id, q.ideal).pass; }), Q.map(function (q) { return grade(q.id, q.ideal).why; }));
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

  // --- 1.20.0: the instruments, from Adam Weldon's Generative Music Studio (MUSIC_INST, MUSIC_SAMPLER) -----------------
  var I = L.musicInst, SM = L.musicSampler;
  ok("the instruments: 58 (1.22.0: the timpani), each with its engine, range, General MIDI program, kind and level", I && SM && I.LIST.length === 58 && I.LIST.every(function (k) {
    var e = I.get(k); return I.engine(e.engine) && e.low < e.high && e.gm >= 0 && e.gm < 128 && e.level > 0 && /^(decay|hold)$/.test(e.kind); }), I && I.LIST.length);
  var silent = [], t0 = Date.now();
  I.LIST.forEach(function (k) {   // a half-second note in the middle of each one's range
    var e = I.get(k), j = SM.job(k, Math.round((e.low + e.high) / 2), 0.8, 0.5), b = SM.bake(j), pk = 0, fin = true;
    for (var i = 0; i < b.length; i++) { if (!isFinite(b[i])) { fin = false; break; } if (Math.abs(b[i]) > pk) pk = Math.abs(b[i]); }
    if (!fin || pk < 0.01 || pk * e.level > 1.2 || b.length < 0.5 * SM.SR) silent.push(k + " " + pk.toFixed(3) + " x" + e.level);
  });
  ok("...every one plays a note: finite, not silent, not too loud in the mix, as long as asked", !silent.length, silent);
  console.log("  (58 instruments, a half-second note each: " + (Date.now() - t0) + " ms)");
  ok("words for them: in the order written, the longer names first, a few names each", I.all("sound violin and piano").map(function (e) { return e.key; }).join() === "violin,piano" &&
    I.find("electric bass").key === "bass" && I.find("a warm double bass").key === "upright bass" && I.find("fiddle").key === "violin" && I.find("music box").key === "celesta" &&
    I.find("bell").key === "celesta" && I.find("blues harp").key === "harmonica" && I.find("english horn").key === "oboe" && !I.find("theremin"));
  ok("...a question's instruments, not a bass line, a lead, the keys or a horn section", I.named("Write a waltz for violin and piano with a bass line, a lead and the keys").join() === "violin,piano" &&
    !I.named("a barbershop quartet in two keys").length && I.named("for banjo", true)[0].word === "banjo" && I.named("for banjo", true)[0].key === "guitar");
  var j1 = SM.job("violin", 69, 0.87, 1.1);
  ok("a note to make: instrument, pitch, loudness to a tenth, length to a quarter second", j1.key === "violin|69|0.9|1" && j1.params.preset === "solo" && Math.abs(j1.freq - 440) < 1e-9);
  var st0 = SM.stats().made, got = await SM.prepare([j1, SM.job("cello", 48, 0.8, 1), j1]), st1 = SM.stats().made;
  await SM.prepare([j1]);
  ok("...prepare makes each note once (here: no workers in this test) and keeps it for next time", Object.keys(got).length === 2 && st1 - st0 === 2 && SM.stats().made === st1 &&
    SM.stats().workers === 0 && SM.get(j1.key) === got[j1.key], [Object.keys(got), st1 - st0, SM.stats()]);
  function mk(lines) { return S.make({ title: "x", lines: lines }); }
  var vw = mk(["key D major", "time 3/4", "sound violin and piano", "chords D | A7", "melody F# - A | G - E"]);
  ok("sound violin and piano: the tune on the violin, the chords on the piano, the waltz's own bass", vw.plan.sound === "violin" && vw.plan.backing === "piano" &&
    vw.plan.plays.melody === "violin" && vw.plan.plays.chords === "piano" && vw.plan.plays.bass === "upright bass" && /the melody on a violin, the chords on piano, the bass on upright bass/.test(vw.summary) &&
    /^sound violin\nbacking piano$/m.test(vw.plan.text.split("\n").slice(4, 6).join("\n")), [vw.summary, vw.plan.text]);
  var ve = B.events(vw.plan);
  ok("...and in the band's notes", ve.filter(function (e) { return e.part === "melody"; }).every(function (e) { return e.inst === "violin"; }) &&
    ve.filter(function (e) { return e.part === "chords"; }).every(function (e) { return e.inst === "piano"; }) && ve.filter(function (e) { return e.part === "bass"; }).every(function (e) { return e.inst === "upright bass"; }));
  var hb = mk(["style folk", "backing harp", "bass synth", "chords C | G"]), he = B.events(hb.plan);
  ok("backing harp, bass synth: the chords and the bass on them (in its range), written back", hb.plan.plays.chords === "harp" && hb.plan.plays.bass === "synth bass" &&
    he.some(function (e) { return e.part === "chords" && e.inst === "harp"; }) && he.filter(function (e) { return e.part === "bass"; }).every(function (e) { return e.inst === "synth bass" && e.midi >= 24 && e.midi <= 67; }) &&
    /\nbacking harp\n/.test(hb.plan.text) && /\nbass synth bass\n/.test(hb.plan.text + "\n") && mk(hb.plan.text.split("\n")).plan.plays.bass === "synth bass", hb.plan.text);
  var off = mk(["style pop", "backing off", "chords C | G", "melody C D E F | G - - -"]), oe = B.events(off.plan);
  ok("backing off: no chords played; the bass and the drums still", off.plan.plays.chords === null && !oe.some(function (e) { return e.part === "chords"; }) && oe.some(function (e) { return e.part === "bass"; }) && oe.some(function (e) { return e.drum; }));
  ok("each style's own instruments: a march's brass and tuba, rock's electric guitar, reggae's organ, a ballad's piano", ["march", "rock", "reggae", "ballad"].map(function (st) {
    var p = mk(["style " + st, "chords C | G"]).plan.plays; return p.chords + "/" + p.bass; }).join() === "brass/tuba,electric guitar/bass,organ/bass,piano/upright bass");
  ok("chords moved into their instrument's range: a flute's backing above middle C", B.events(mk(["style block", "backing flute", "chords C | G"]).plan).filter(function (e) { return e.part === "chords"; }).every(function (e) { return e.midi >= 60; }));
  var tb = mk(["key F", "sound tuba", "melody F G A F | F G A F"]);
  ok("a melody goes where its instrument plays: down two octaves for a tuba, said", names(tb.plan) === "F2 G2 A2 F2 F2 G2 A2 F2" && /moved the melody down 2 octaves, where the tuba plays it/.test(tb.summary), [names(tb.plan), tb.summary]);
  var lw = mk(["key G", "melody G3 A3 B3 C4 | D4 - - -"]);
  ok("...a flute's tune written below its lowest note goes up an octave", names(lw.plan) === "G4 A4 B4 C5 D5" && !lw.problems.length, names(lw.plan));
  var pc = mk(["key C", "sound piccolo", "melody C4 G4 C5 G5 | C6 G6 C7 -"]);
  ok("...a tune wider than its instrument plays goes back, with what to write", pc.problems.length === 1 &&
    /^the melody goes from C5 to C8, wider than the piccolo plays \(D5 to C8\): bar 1\u2019s \u201cC4\u201d \(C5\) is below it -- write that part an octave higher, or choose an instrument that plays it all \(sound piano does\)$/.test(pc.problems[0]), pc.problems);
  ok("an instrument Lantern does not have is said, and the flute plays", mk(["sound theremin", "chords C", "melody C D E -"]).plan.sound === "flute" &&
    /Lantern has no \u201ctheremin\u201d; the melody is on the flute \(Lantern\u2019s 58 instruments are under How to write it, in Music\)/.test(mk(["sound theremin", "chords C", "melody C D E -"]).summary));
  var vm = Array.prototype.join.call(L.musicMidi.file(vw.plan));
  ok("MIDI: each part's General MIDI program (violin 40, piano 0, upright bass 32)", vm.indexOf(",192,40,") >= 0 && vm.indexOf(",193,0,") >= 0 && vm.indexOf(",194,32,") >= 0);
  var nt = L.musicSynth.notes(vw.plan), keys = nt.list.map(function (j) { return j.key; });
  ok("the notes made for a song: each pitch of each instrument once; a held note as long as its longest, a struck one as long as it rings", keys.length && keys.every(function (k, i) { return keys.indexOf(k) === i; }) &&
    ve.filter(function (e) { return !e.drum; }).every(function (e) { return nt.keyOf(e); }) && keys.indexOf("violin|66|0.9|1.75") >= 0 &&
    nt.list.filter(function (j) { return j.inst === "piano"; }).every(function (j) { return j.seconds === 3; }), keys);
  ok("the AI's lines name the instruments, by family", L.aiMusic.HINT.some(function (l) { return /^sound violin  /.test(l); }) && L.aiMusic.HINT.some(function (l) { return /^backing piano  /.test(l); }) &&
    L.aiMusic.HINT.some(function (l) { return /^  bowed strings: violin, viola, cello, contrabass, strings$/.test(l); }) && L.aiMusic.HINT.some(function (l) { return /^  basses: bass, upright bass, synth bass, slap bass$/.test(l); }));
  var WQ = "Write a gentle 8-bar waltz in D major for violin and piano.", WZ = ["key D major", "time 3/4", "style waltz", "chords D | A7 | D | G | D | A7 | D | D",
    "melody F# - A | G - E | F# - D | B4 - G | A - F# | E - C# | D - - | D - -"], wf = act.build(song(WZ), WQ);
  ok("the question's instruments: a waltz for violin and piano with the tune on the flute goes back", wf.problems.length === 1 &&
    /^the question asks for the violin, and the song does not play it: write sound violin \(the melody\u2019s instrument\) or backing violin \(the chords\u2019\)$/.test(wf.problems[0]), wf.problems);
  ok("...on the violin it passes (the waltz's piano plays the chords), and the bench says so; the chords on a guitar go back for the piano", act.build(song(WZ.concat(["sound violin"])), WQ).ok &&
    grade("make-music-waltz", song(WZ.concat(["sound violin"]))).pass && /^Lantern still questions it: the question asks for the piano, and the song does not play it: write sound piano/.test(grade("make-music-waltz", song(WZ.concat(["sound violin", "backing guitar"]))).why),
    grade("make-music-waltz", song(WZ.concat(["sound violin", "backing guitar"]))).why);
  ok("...one instrument for the tune: on the cello means the melody", /^the question asks for the tune on the cello; the melody is on the flute: write sound cello$/.test(act.build(song(["key C", "melody C D E F | G - - -"]), "Play a short tune on the cello").problems[0] || ""));
  ok("...guitar chords: the strum's guitar plays them", act.build(song(["style strum", "chords C | G"]), "Give me some guitar chords to hear").ok);

  // --- 1.21.0: printed music read as a song (SHEET_MUSIC_SONG writes its lines; SHEET_MUSIC_CHAT gives them to the AI and checks the song) ---
  var SMS = L.sheetMusic && L.sheetMusic._song, SC = L.sheetChat;
  ok("the sheet-reading parts are there", !!(SMS && SMS.write && L.sheetMusic.song && L.sheetMusic.prepare && SC && SC.compare && SC.remember));
  function snt(letter, oct, alter, len) { return { letter: letter, oct: oct, alter: alter, midi: (oct + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][letter] + alter, len: len }; }
  function rd(key, time, bars) { return SMS.write({ found: true, key: key, time: time, bars: bars, problems: [], systems: 1, spacing: 10 }); }
  var Cl = 0, Dl = 1, El = 2, Fl = 3, Gl = 4, Al = 5, Bl = 6;
  var odeRead = rd(0, [4, 4], [[snt(El, 4, 0, 1), snt(El, 4, 0, 1), snt(Fl, 4, 0, 1), snt(Gl, 4, 0, 1)], [snt(Gl, 4, 0, 1), snt(Fl, 4, 0, 1), snt(El, 4, 0, 1), snt(Dl, 4, 0, 1)],
    [snt(Cl, 4, 0, 1), snt(Cl, 4, 0, 1), snt(Dl, 4, 0, 1), snt(El, 4, 0, 1)], [snt(El, 4, 0, 1.5), snt(Dl, 4, 0, 0.5), snt(Dl, 4, 0, 1), { rest: true, len: 1 }]]);
  ok("a reading written as MAKE MUSIC lines: a bar's shares from its notes' lengths (a dotted quarter is 3 of 8), r for a rest, the octave once",
    odeRead.lines === "key C major\ntime 4/4\nmelody E4 E F G | G F E D | C C D E | E - - D D - r -" && odeRead.summary === "4 bars in C major, 4/4, 15 notes" && odeRead.tune.length === 15, odeRead.lines);
  var minRead = rd(0, [4, 4], [[snt(Al, 4, 0, 1), snt(Bl, 4, 0, 1), snt(Cl, 5, 0, 1), snt(Dl, 5, 0, 1)], [snt(Gl, 4, 1, 1), snt(Al, 4, 0, 1), snt(El, 5, 0, 2)], [snt(Al, 4, 0, 4)]]);
  ok("...A minor from where the tune ends and its raised 7th; the G# written, an octave with each leap past a 4th", minRead.keyName === "A minor" &&
    minRead.lines === "key A minor\ntime 4/4\nmelody A4 B C D | G#4 A E5 - | A4 - - -", minRead.lines);
  var gRead = rd(1, [3, 4], [[snt(Gl, 4, 0, 1), snt(Fl, 4, 1, 1), snt(Fl, 4, 0, 1)], [snt(Gl, 4, 0, 3)]]);
  ok("...in G major a plain F is the key's F#, and an F natural is written Fn", gRead.lines === "key G major\ntime 3/4\nmelody G4 F Fn | G - -", gRead.lines);
  var QS = "Use your Lantern Tools to read the sheet music and then reproduce a playable music file";
  SC.remember(QS, odeRead);
  ok("a song asked of a picture that was read: copying the lines passes", act.build(song(odeRead.lines.split("\n").concat(["style ballad"]), "Ode to Joy"), QS).ok);
  var off = act.build(song(["key C major", "melody E E F G | G F E D | C C D E | D - - r"]), QS);
  ok("...a tune from memory goes back with the lines as read", off.problems.some(function (x) { return /^the melody is not the one Lantern read in the picture -- from bar 4 \(note 13\): write the key, time and melody lines exactly as read:\nkey C major\ntime 4\/4\nmelody E4 E F G/.test(x); }), off.problems);
  SC.remember("What is this?", odeRead);
  ok("...and a question with music read from its picture is offered MAKE MUSIC", act.relevant("What is this?").some(function (a) { return a.id === "music"; }) && !act.relevant("What is that?").some(function (a) { return a.id === "music"; }));
  // 1.21.1: the left hand's chords, the heading's title
  function bassN(letter, oct, alter, len) { return snt(letter, oct, alter, len); }
  var lh = SMS.write({ found: true, key: 0, time: [4, 4], problems: [], systems: 1, spacing: 10,
    bars: [[snt(Dl, 4, 0, 1), snt(Dl, 4, 0, 1), snt(El, 4, 0, 1), snt(Cl, 4, 0, 1)], [snt(Dl, 4, 0, 1), snt(El, 4, 0, 0.5), snt(Fl, 4, 0, 0.5), snt(El, 4, 0, 1), snt(Cl, 4, 0, 1)],
      [snt(Dl, 4, 0, 1), snt(El, 4, 0, 0.5), snt(Fl, 4, 0, 0.5), snt(El, 4, 0, 1), snt(Dl, 4, 0, 1)], [snt(Cl, 4, 0, 1), snt(Dl, 4, 0, 1), { rest: true, len: 2 }]],
    bass: [[bassN(Gl, 3, 0, 2), bassN(Cl, 3, 0, 2)], [bassN(Gl, 3, 0, 2), bassN(Cl, 3, 0, 2)], [bassN(Gl, 3, 0, 2), bassN(Gl, 3, 1, 2)], [bassN(Al, 3, 0, 2), bassN(Gl, 3, 0, 1), { rest: true, len: 1 }]] });
  ok("the left hand's bass notes become the chords line: G under D, G7 under F, E7/G# under E and D, Am under C (Ode to Joy's bars 9 to 12)",
    lh.chords === "G C | G7 C | G7 E7/G# | Am G" && /\nchords G C \| G7 C \| G7 E7\/G# \| Am G\nmelody /.test(lh.lines) && lh.chordList.length === 8 && /the chords from the left hand/.test(lh.summary), [lh.chords, lh.lines]);
  var QC = "Play the sheet music I pasted";
  SC.remember(QC, lh);
  var mel4 = "melody " + lh.melody;
  ok("...a song with those chords passes (G for G7 too: the same root); one with chords of its own goes back for the left hand's",
    act.build(song(["key C major", "chords G C | G7 C | G7 E7/G# | Am G", mel4]), QC).ok && act.build(song(["key C major", "chords G C | G C | G E7/G# | Am G", mel4]), QC).ok &&
    /^the chords are not the ones the left hand plays in the picture \(bar 9|bar 1 has G\)|\(bar 1 has G\): write the chords line exactly as read -- chords G C \| G7 C/.test(act.build(song(["key C major", "chords C | G | F | C", mel4]), QC).problems.join("\n")),
    act.build(song(["key C major", "chords C | G | F | C", mel4]), QC).problems);
  ok("the heading's title as printed, or out of capitals", SMS.titled("ODE TO JOY") === "Ode to Joy" && SMS.titled("Ode to Joy") === "Ode to Joy" && SMS.titled("THE WATER IS WIDE") === "The Water Is Wide");
  var mem = S.make({ title: "x", lines: ["key C major", "style ballad", "sound piano", "chords C | G | F | C", "melody E E F G | G F E D | C C D E | D - - r", "melody E E F G | G F E D | C C D E | D - - r",
    "melody E G A C | D E D C | B C D | A - - r", "melody D C B A | G B A F | E - - r"] });
  ok("a long note against a chord that plays again under a longer melody: where to write the chord (the 35B's Ode, 1.20.0)", mem.problems.length === 1 &&
    /^bar 15: the melody holds E over F \(F A C\).* \(bar 15 plays the chords line\u2019s bar 3 again: write a chord for each of the 15 bars, or leave the chords line out and Lantern chooses them\)$/.test(mem.problems[0]), mem.problems);
  // 1.21.2: tunes Lantern knows by their opening (Adam's untitled Ode to Joy was called Fur Elise by the 35B)
  var TU = L.musicTunes, NM = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function mids(s) { return s.split(" ").map(function (n) { return NM[n.charAt(0)] + (n.charAt(1) === "#" ? 1 : 0) + 12 * (+n.slice(-1) + 1); }); }
  ok("the tune finder is there, its tunes all old ones", !!(TU && TU.find && TU.LIST.length >= 25) && TU.LIST.every(function (x) { return !x[2] || +x[2] < 1929; }));
  ok("...each tune it knows is found from its own opening", TU.LIST.every(function (x) { var f = TU.find(mids(x[3])); return f && f.title === x[0]; }),
    TU.LIST.filter(function (x) { var f = TU.find(mids(x[3])); return !f || f.title !== x[0]; }).map(function (x) { return x[0]; }));
  var fOde = TU.find(mids("E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4")), fTw = TU.find(mids("G4 G4 D5 D5 E5 E5 D5 C5 C5 B4 B4 A4 A4 G4")),
    fIntro = TU.find(mids("C4 G4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4")), fFE = TU.find(mids("E5 D#5 E5 D#5 E5 B4 D5 C5 A4"));
  ok("...Ode to Joy by its first notes, Twinkle in G, Ode after two notes of introduction, Fur Elise",
    fOde && fOde.title === "Ode to Joy" && fOde.notes === 13 && /Beethoven/.test(fOde.by) && fTw && /^Twinkle/.test(fTw.title) && fIntro && fIntro.title === "Ode to Joy" && fFE && fFE.title === "F\u00fcr Elise", [fOde, fTw, fIntro, fFE]);
  ok("...and not a scale, a few notes, or nothing", TU.find(mids("C4 D4 E4 F4 G4 A4 B4 C5 D5")) === null && TU.find(mids("E4 E4 F4 G4 G4")) === null && TU.find([]) === null && TU.find(null) === null);
  ok("a reading of a tune Lantern knows carries its name", odeRead.known && odeRead.known.title === "Ode to Joy" && lh.known === null, [odeRead.known, lh.known]);
  var QT = "Make this sheet music into a song";
  SC.remember(QT, odeRead);
  var elise = act.build(song(odeRead.lines.split("\n"), "F\u00fcr Elise"), QT);
  ok("...a song of it called another piece goes back for its name; its own name, in other words too, passes",
    !elise.ok && elise.problems.length === 1 && elise.problems[0] === "the song is called \u201cF\u00fcr Elise\u201d, but Lantern knows the tune as \u201cOde to Joy\u201d: write MAKE MUSIC: Ode to Joy" &&
    act.build(song(odeRead.lines.split("\n"), "Ode to Joy"), QT).ok && act.build(song(odeRead.lines.split("\n"), "Beethoven's Ode to Joy (piano)"), QT).ok, elise.problems);
  var titledRead = rd(0, [4, 4], [[snt(Cl, 4, 0, 1), snt(Dl, 4, 0, 1), snt(El, 4, 0, 1), snt(Cl, 4, 0, 1)], [snt(Gl, 4, 0, 4)]]);
  titledRead.title = "Morning Song";
  ok("...a title printed above the music is the one asked for", SC.compare({ title: "Ode to Joy", melody: titledRead.tune.map(function (n) { return { midi: n.midi, len: n.len, bar: 1 }; }) }, titledRead)[0] ===
    "the song is called \u201cOde to Joy\u201d, but the picture is headed \u201cMorning Song\u201d: write MAKE MUSIC: Morning Song");

  // --- 1.22.0: an orchestra (MUSIC_ARRANGE), the timpani, a song talked about after it is made (MUSIC_CHAT) ---
  // (Adam's trial of 1.21.2: "Can you fill in the missing pieces of the song with an orchestra?" -- the 35B asked whether
  // to go ahead, wrote the parts in prose, and said Lantern's tools could not make the file)
  var AR = L.musicArrange, MC = L.musicChat, IN = L.musicInst, SMP = L.musicSampler;
  ok("the arranger, the timpani and the follow-up are there", !!(AR && AR.make && MC && MC.about && MC.noBlock && IN.get("timpani") && IN.get("timpani").engine === "TimpaniMath"));
  var tb = SMP.bake(SMP.job("timpani", 48, 0.8, 1.5)), tpk = 0, tend = 0, ti;
  for (ti = 0; ti < tb.length; ti++) { tpk = Math.max(tpk, Math.abs(tb[ti])); if (ti > tb.length - 400) tend = Math.max(tend, Math.abs(tb[ti])); }
  ok("...a timpani note: struck, dying away to silence", tpk > 0.1 && tpk < 1 && tend < 0.02, [tpk, tend]);
  var ODE12 = ["key C major", "tempo 100", "chords C | G7 | C | G | C | G7 | C | G C | G C | G7 C | G7 E7/G# | Am G",
    "melody E4 E F G | G F E D | C C D E | E - - D D - r - | E E F G | G F E D | C C D E | D - - C C - r - | D D E C | D - E F E - C - | D - E F E - D - | C D r -"];
  var orc = S.make({ title: "Ode to Joy", lines: ODE12.concat(["arrange orchestra"]) }), oa = orc.plan.arrangement;
  ok("arrange orchestra: every player's part from the melody and chords -- an introduction, the tune softly, everyone, the last chord held",
    !orc.problems.length && oa && oa.players.length === 12 && oa.form.join() === "intro,soft,full,coda" && oa.bars === 28 && orc.plan.seconds === 67 &&
    orc.summary.indexOf("arranged for orchestra (12 players): an introduction (bars 1\u20132): the key\u2019s chord and its dominant, held quietly over a timpani roll; the tune softly on the first violins (bars 3\u201314); " +
      "everyone (bars 15\u201326): the tune on the first violins, flute, oboe and trumpet, with the timpani; the last chord held over a timpani roll (bars 27\u201328) \u2014 28 bars") > 0 &&
    /\narrange orchestra\n/.test(orc.plan.text) && !/\nstyle /.test(orc.plan.text), [orc.problems, orc.summary, orc.plan.text]);
  var OV = AR.voices(orc.plan, oa.shift), vbad = [];
  OV.forEach(function (v) {
    [v.a, v.t, v.b].forEach(function (m) { if (m == null || v.c.pcs.indexOf(T.mod(m, 12)) < 0) vbad.push(v.c.name + " " + m); });
    if (!(v.b < v.t && v.t < v.a)) vbad.push("order " + v.c.name);
    orc.plan.melody.forEach(function (n) { if (n.at < v.at + v.len - 1e-9 && n.at + n.len > v.at + 1e-9 && n.midi + oa.shift <= v.a) vbad.push("above the tune at " + v.c.name); });
  });
  ok("...the inner voices are notes of each chord, below the tune all the while and above the bass; E7/G#'s bass is G#", !vbad.length && OV[14].c.name === "E7/G#" && T.mod(OV[14].b, 12) === 8, vbad);
  function parallel(p, c) {
    var V = ["l", "s", "a", "t", "b"], n = 0;
    for (var i = 0; i < V.length; i++) for (var j = i + 1; j < V.length; j++) {
      var x0 = p[V[i]], y0 = p[V[j]], x1 = c[V[i]], y1 = c[V[j]];
      if (x0 == null || y0 == null || x1 == null || y1 == null || x0 === x1 || y0 === y1) continue;
      var a = T.mod(x0 - y0, 12), b = T.mod(x1 - y1, 12);
      if (a === b && (a === 0 || a === 7) && (x1 - x0 > 0) === (y1 - y0 > 0)) n++;
    }
    return n;
  }
  var npar = 0, oi;
  [ODE12, ["key D major", "time 3/4", "chords D | A7 | D | G | D | A7 | D | D", "melody F# - A | G - E | F# - D | B4 - G | A - F# | E - C# | D - - | D - -"],
    ["key C major", "melody C C G G | A A G - | F F E E | D D C - | G G F F | E E D - | G G F F | E E D - | C C G G | A A G - | F F E E | D D C -"], ["key G major", "chords G | C | D7 | G | Em | C | D | G"]].forEach(function (ls) {
    ["orchestra", "brass", "winds"].forEach(function (en) {
      var pp = S.make({ title: "", lines: ls.concat(["arrange " + en]) }).plan, vv = AR.voices(pp, pp.arrangement.shift);
      for (oi = 1; oi < vv.length; oi++) npar += parallel(vv[oi - 1], vv[oi]);
    });
  });
  ok("...no fifths or octaves in parallel between any two voices (the Ode, a waltz, Twinkle with Lantern's chords, chords alone; orchestra, brass, winds)", npar === 0, npar);
  var rbad = oa.events.filter(function (e) { var ie = IN.get(e.inst); return e.midi < ie.low || e.midi > ie.high || e.at < 0 || e.at + e.len > oa.length + 1e-9; });
  ok("...every note in its instrument's range and inside the piece", !rbad.length, rbad.slice(0, 3));
  var tim = oa.events.filter(function (e) { return e.part === "timpani"; });
  ok("...the timpani on C and G: a roll into the tune, when everyone plays, and a roll under the last chord -- not in the soft pass", tim.every(function (e) { return T.mod(e.midi, 12) === 0 || T.mod(e.midi, 12) === 7; }) &&
    tim.filter(function (e) { return e.at < 8 - 1e-9; }).length === 16 && !tim.some(function (e) { return e.at >= 8 - 1e-9 && e.at < 56 - 1e-9; }) && tim.filter(function (e) { return e.at >= 104 - 1e-9; }).length === 32, tim.length);
  // 1.22.2: the introduction is the key's chord and its dominant, no tune (the tune's last phrase there sounded like playing from the
  // middle, Adam's trial); the moving line waits at the first bar through it, and stays at the last bar through the ending
  var intro = oa.events.filter(function (e) { return e.at < 8 - 1e-9; });
  ok("...the introduction: the key's chord, then its dominant seventh, no tune; the line waits at bar 1, then follows each pass from its start",
    intro.length && !intro.some(function (e) { return e.part === "violin 1" || e.part === "flute" || e.part === "oboe" || e.part === "trumpet"; }) &&
    intro.filter(function (e) { return e.at < 4 - 1e-9 && e.part !== "timpani"; }).every(function (e) { return [0, 4, 7].indexOf(T.mod(e.midi, 12)) >= 0; }) &&
    intro.filter(function (e) { return e.at >= 4 - 1e-9 && e.part !== "timpani"; }).every(function (e) { return [7, 11, 2, 5].indexOf(T.mod(e.midi, 12)) >= 0; }) &&
    AR.themeAt(oa, 0) === 0 && AR.themeAt(oa, 7.5) === 0 && AR.themeAt(oa, 9) === 1 && AR.themeAt(oa, 57) === 1 && AR.themeAt(oa, 110) === 44, intro.length);
  var omid = L.musicMidi.file(orc.plan), mtr = 0;
  for (oi = 0; oi + 4 < omid.length; oi++) if (omid[oi] === 77 && omid[oi + 1] === 84 && omid[oi + 2] === 114 && omid[oi + 3] === 107) mtr++;
  ok("...Save MIDI: a track for each player; Play and Save WAV: the arrangement's notes (the band's are left out)", mtr === 13 && L.musicBand.events(orc.plan).length === oa.events.length &&
    !L.musicBand.events(orc.plan).some(function (e) { return e.part === "melody" || e.part === "chords" || e.drum; }), mtr);
  var ens4 = ["strings", "string quartet", "brass", "winds"].map(function (en) { var r = S.make({ title: "", lines: ODE12.concat(["arrange " + en]) }); return r.problems.length ? -1 : r.plan.arrangement.players.length; });
  ok("strings, a string quartet, brass and winds: their own players", ens4.join() === "5,4,5,5", ens4);
  var f1 = S.make({ title: "", lines: ODE12.concat(["arrange strings", "form soft loud"]) }), f2 = S.make({ title: "", lines: ODE12.concat(["arrange strings", "form verse soft"]) });
  ok("form: the order written; a word Lantern does not play goes back", f1.plan.arrangement.form.join() === "soft,full" && f1.plan.arrangement.bars === 24 &&
    /^form \u201cverse\u201d: Lantern plays intro, soft, full and coda/.test(f2.problems[0]), [f1.plan.arrangement.form, f2.problems]);
  var VIO = "part viola: C - - - | B - - - | C - - - | B - - - | C - - - | B - - - | C - - - | B - C - | B - C - | B - C - | B - B - | C - B -";
  var pv = S.make({ title: "", lines: ODE12.concat(["arrange orchestra", VIO]) }), pva = pv.plan.arrangement;
  var violaSoft = pva.events.filter(function (e) { return e.part === "viola" && e.at >= 8 - 1e-9 && e.at < 56 - 1e-9; });
  ok("a part of the AI's own plays for its player in the tune's passes, checked against the chords", !pv.problems.length && violaSoft.length === 17 && T.mod(violaSoft[0].midi, 12) === 0 &&
    /\npart viola: C - - - \| B - - -/.test(pv.plan.text), [pv.problems, violaSoft.length]);
  var pcl = S.make({ title: "", lines: ODE12.concat(["arrange orchestra", VIO.replace("part viola: C - - -", "part viola: C# - - -")]) });
  ok("...a long note a half step from its chord goes back", /^part viola, bar 1: C# over C \(C E G\), a half step from a note of the chord: write a note of the chord there$/.test(pcl.problems[0]), pcl.problems);
  var p35 = S.make({ title: "", lines: ODE12.concat(["arrange orchestra", "Violins II: C4 C D E | E D C B | A A B C | C - - B B - r -"]) });
  ok("...written the 35B's way (Violins II: C4 C D E | ...) it is a part for the second violins; 4 bars of 12 go back", p35.plan.arrangement && p35.plan.partLines.length === 1 &&
    /^part Violins II has 4 bars; the tune has 12: write a bar for each of them/.test(p35.problems[0]), p35.problems);
  var pxx = S.make({ title: "", lines: ODE12.concat(["arrange orchestra", "part theremin: C D E F"]) });
  ok("...an instrument Lantern does not have goes back", /^part theremin: Lantern has no such instrument/.test(pxx.problems[0]), pxx.problems);
  var pnb = S.make({ title: "", lines: ["key C", "chords C | G | C | C", "melody E D C D | E E E - | D D E D | C - - -", "part cello: C - - - | G - - - | C - - - | C - - -"] });
  ok("...without an orchestra, a part joins the band", !pnb.problems.length && !pnb.plan.arrangement && /, a cello part/.test(pnb.summary) && L.musicBand.events(pnb.plan).filter(function (e) { return e.part === "cello"; }).length === 4, [pnb.problems, pnb.summary]);
  var AQ = "Can you arrange it for an orchestra?";
  ok("a question for an orchestra: a song without arrange goes back with the line; with it, it passes; a string quartet asked, an orchestra made, goes back",
    /the question asks for an orchestra: write arrange orchestra \(Lantern writes every player\u2019s part from the melody and chords\), with the key, chords and melody lines as they are/.test(act.build(song(ODE12), AQ).problems.join("\n")) &&
    act.build(song(ODE12.concat(["arrange orchestra"])), AQ).ok && /the question asks for a string quartet; the song is arranged for orchestra: write arrange string quartet/.test(act.build(song(ODE12.concat(["arrange orchestra"])), "Play it with a string quartet").problems.join("\n")),
    act.build(song(ODE12), AQ).problems);
  ok("Adam's questions after the song are about music", L.aiMusic.asks("Can you fill in the missing pieces of the song with an orchestra?") && L.aiMusic.asks("So can you use the lantern tools to create the file of the orchestra as you envision it in your basic framework?") &&
    !L.aiMusic.asks("What is an orchestra?"));
  var HIST = [{ role: "user", content: "Play Ode to Joy" }, { role: "assistant", content: "Here it is.\n" + song(ODE12, "Ode to Joy") }], FQ = "Can you fill in the missing pieces of the song with an orchestra?";
  var ab = await MC.about(FQ, HIST);
  ok("a question after a song: the song as made, and how to have an orchestra play it; the music action offered", ab &&
    /^THE SONG SO FAR: Lantern made this song earlier in this chat -- \u201cOde to Joy\u201d, 12 bars in C major:\ntitle Ode to Joy\nkey C major\ntime 4\/4\ntempo 100\nchords C \| G7 /.test(ab.prompt) &&
    /For an orchestra, write a MAKE MUSIC block with these lines and one more: arrange orchestra\. Lantern writes every player\u2019s part/.test(ab.prompt) && /Keep its key, time, chords and melody lines as they are\.$/.test(ab.prompt) &&
    act.relevant(FQ).some(function (a) { return a.id === "music"; }), ab && ab.prompt);
  ok("...not with no song before it, nor for a question about something else", (await MC.about(FQ, [])) === null && (await MC.about("What is the capital of France?", HIST)) === null);
  var WM = ODE12.slice(); WM[3] = WM[3].replace("D D E C", "D D E D");
  var kp = act.build(song(WM.concat(["arrange orchestra"]), "Ode to Joy"), FQ), kp2 = act.build(song(ODE12.concat(["arrange orchestra"]), "Ode to Joy"), FQ);
  ok("...the new song keeps the melody: a note changed goes back with the lines as they were; the same lines with arrange orchestra pass",
    /^the melody is not the one in the song made before -- from bar 9 \(note 34\): keep its key, time, chords and melody lines as they were:\nkey C major\ntime 4\/4\nchords C \| G7/.test(kp.problems[0]) && kp2.ok, [kp.problems, kp2.problems]);
  var nb1 = MC.noBlock(FQ, "NEED: Do you want me to compose an orchestral arrangement for \"Ode to Joy\" based on the sheet music provided, or do you have specific instruments or sections in mind for the orchestra?");
  var nb2 = MC.noBlock(FQ, "I cannot create a playable orchestral file using Lantern's tools because the available functions do not include a tool capable of generating multi-instrument orchestral audio files.");
  var nb3 = MC.noBlock(FQ, "**Strings:**\n- **Violins I:** E4 E F G | G F E D\n- **Violins II:** C4 C D E | E D C B");
  ok("a reply with no block -- asking whether to go ahead, saying Lantern cannot, writing the parts out -- goes back with the block to write; another question's does not",
    nb1 && /^The person has already asked for this: make it now\. It plays a song on an orchestra, writes it out and saves it[\s\S]*like this:\nMAKE MUSIC: Ode to Joy\nkey C major\ntime 4\/4\ntempo 100\nchords C \| G7[\s\S]*\narrange orchestra\nEND\nLantern writes every player\u2019s part/.test(nb1.prompt) &&
    nb2 && /^Lantern can make this\./.test(nb2.prompt) && nb3 && /^Lantern cannot play parts written out in a reply\./.test(nb3.prompt) && MC.noBlock("What is the capital of France?", "I cannot say.") === null &&
    MC.noBlock(FQ, "Here it is.\n" + song(ODE12.concat(["arrange orchestra"]))) === null, [nb1 && nb1.prompt, nb2 && nb2.why, nb3 && nb3.why]);
  // --- 1.22.1: Adam's second sheet (a web page's preview of a piano arrangement) ---
  // a bar read too long ("bar 1 adds up to 18 beats"): the lines play it in a bar's time, and a song copying them exactly
  // was sent back for a tune it could not write -- now the check is against the tune as the lines play it
  var over = rd(0, [4, 4], [[snt(El, 4, 0, 1), snt(El, 4, 0, 1), snt(Fl, 4, 0, 1), snt(Gl, 4, 0, 1)], [snt(Al, 4, 0, 4), snt(El, 5, 0, 4)], [snt(Cl, 5, 0, 4)]]), QO = "turn the screenshot into a playable music file";
  SC.remember(QO, over);
  var ov1 = act.build(song(over.lines.split("\n"), "Sheet music"), QO), ov2 = act.build(song(["key C major", "melody E E F G | A - E5 - | D5 - - -"], "Sheet music"), QO);
  ok("a bar read too long: the lines copied exactly pass; another tune still goes back", over.played && ov1.ok && !ov2.ok && /^the melody is not the one Lantern read/.test(ov2.problems[0]), [ov1.problems, ov2.problems]);
  // a beam lying along a staff line (its eighths read as quarters): the line is the rows that run furthest
  var W0 = 600, H0 = 120, bm = new Uint8Array(W0 * H0), yy, xx;
  for (yy = 0; yy < 5; yy++) for (xx = 20; xx < 580; xx++) { bm[(30 + yy * 16) * W0 + xx] = 1; bm[(31 + yy * 16) * W0 + xx] = 1; }
  for (yy = 24; yy <= 33; yy++) for (xx = 60; xx < 400; xx++) bm[yy * W0 + xx] = 1;   // the beam, over the top line
  var sv = L.sheetMusic.staves({ w: W0, h: H0, b: bm });
  ok("a beam along a staff line leaves the line as thin as the others, where it is", sv.length === 1 && sv[0].thick <= 3 && Math.abs(sv[0].lines[0] - 30.5) < 1 && Math.abs(sv[0].spacing - 16) < 0.5, sv);
  // --- 1.22.4: Adam's piece in E minor (read as G major; its sharpened left-hand chords misread) ---
  function lhc(root, others) { root.with = others.map(function (n) { return { midi: n.midi }; }); return root; }
  function emin(l) { return lhc(snt(El, 3, 0, l), [snt(Gl, 3, 0, l), snt(Bl, 3, 0, l)]); }
  var mel5 = [[snt(Bl, 4, 0, 1), snt(Al, 4, 0, 1), snt(Gl, 4, 0, 1), snt(Fl, 4, 1, 1)], [snt(Gl, 4, 0, 1), snt(Al, 4, 0, 1), snt(Bl, 4, 0, 2)]];
  var noLh = SMS.write({ found: true, key: 1, time: [4, 4], bars: JSON.parse(JSON.stringify(mel5)), problems: [], systems: 1, spacing: 10 });
  var withLh = SMS.write({ found: true, key: 1, time: [4, 4], bars: JSON.parse(JSON.stringify(mel5)), bass: [[emin(4)], [emin(4)]], problems: [], systems: 1, spacing: 10 });
  ok("the key's mode from the left hand too: a tune ending on B in one sharp is G major alone, E minor over a left hand on E", noLh.keyName === "G major" && withLh.keyName === "E minor" &&
    /^key E minor\n/.test(withLh.lines), [noLh.keyName, withLh.keyName]);
  var dim = SMS.write({ found: true, key: 1, time: [4, 4], problems: [], systems: 1, spacing: 10,
    bars: [[snt(El, 5, 0, 2), snt(Bl, 4, 0, 2)], [snt(Fl, 5, 1, 2), snt(Al, 4, 0, 2)], [snt(Gl, 4, 0, 4)], [snt(El, 4, 0, 4)]],
    bass: [[emin(4)], [lhc(snt(Dl, 3, 1, 4), [snt(Fl, 3, 1, 4), snt(Al, 3, 0, 4)])], [emin(4)], [emin(4)]] });
  ok("...a minor key's raised seventh chord named from the left hand: D#dim in E minor", dim.chords === "Em | D#dim | Em | Em", dim.chords);
  var sp8 = SMS.write({ found: true, key: 0, time: [4, 4], problems: [], systems: 1, spacing: 10,
    bars: [[snt(El, 4, 0, 2), snt(Gl, 4, 0, 2)], [snt(Bl, 4, 0, 2), snt(Gl, 4, 1, 2)], [snt(Al, 4, 0, 4)], [snt(Cl, 5, 0, 4)]],
    bass: [[snt(Cl, 3, 0, 4)], [snt(Al, 2, -1, 4)], [snt(Al, 2, 0, 4)], [snt(Cl, 3, 0, 4)]] });
  ok("...a bass read as A flat under an E chord is spelt as the chord has it: E/G#", sp8.chords === "C | E/G# | Am | C", sp8.chords);
  // --- 1.22.3: the MIDI file in a DAW (Adam): each track's level from Lantern's mix (CC7), its seat (CC10), the soft and full
  // passes on expression (CC11); for orchestral sample libraries, the dynamics on CC1 too and legato overlaps ---
  function midiTracks(b) {
    var i = 14, out = [];
    function vl() { var v = 0, c; do { c = b[i++]; v = (v << 7) | (c & 127); } while (c & 128); return v; }
    while (i < b.length) {
      var end = i + 8 + ((b[i + 4] << 24) | (b[i + 5] << 16) | (b[i + 6] << 8) | b[i + 7]), tk = { cc: {}, notes: [], name: "", inst: "" }, tt = 0, on = {}, st = 0;
      i += 8;
      while (i < end) {
        tt += vl();
        var s = b[i];
        if (s === 0xff) { var ty = b[i + 1]; i += 2; var n = vl(), txt = String.fromCharCode.apply(null, Array.prototype.slice.call(b, i, i + n)); if (ty === 3) tk.name = txt; if (ty === 4) tk.inst = txt; i += n; continue; }
        if (s & 0x80) { st = s; i++; }
        var hi = st & 0xf0, d1 = b[i], d2 = b[i + 1];
        if (hi === 0xc0) { i += 1; continue; }
        i += 2;
        if (hi === 0xb0) (tk.cc[d1] = tk.cc[d1] || []).push([tt, d2]);
        else if (hi === 0x90 && d2) on[d1] = tt;
        else if (hi === 0x80 || hi === 0x90) { if (on[d1] != null) { tk.notes.push([on[d1], tt, d1]); delete on[d1]; } }
      }
      tk.notes.sort(function (x, y) { return x[0] - y[0]; });
      out.push(tk); i = end;
    }
    return out;
  }
  function byName(ts, n) { return ts.filter(function (x) { return x.name === n; })[0]; }
  function legato(tk) { var o = 0, same = 0; for (var k = 1; k < tk.notes.length; k++) if (tk.notes[k - 1][1] > tk.notes[k][0]) { if (tk.notes[k - 1][2] === tk.notes[k][2]) same++; else o++; } return [o, same]; }
  var mt0 = midiTracks(L.musicMidi.file(orc.plan)), mt1 = midiTracks(L.musicMidi.file(orc.plan, { library: true })), v1d = byName(mt0, "violin 1"), v1l = byName(mt1, "violin 1");
  ok("MIDI for a DAW: each player's level from Lantern's mix (the tune 100, its doublings and the held chords lower), its seat, its instrument's name",
    v1d.cc[7][0][1] === 100 && byName(mt0, "flute").cc[7][0][1] === 65 && byName(mt0, "horns").cc[7][0][1] === 60 && byName(mt0, "cello").cc[7][0][1] === 84 &&
    v1d.cc[10][0][1] < 64 && byName(mt0, "violin 2").cc[10][0][1] < 64 && byName(mt0, "cello").cc[10][0][1] > 64 && byName(mt0, "contrabass").cc[10][0][1] > 64 && byName(mt0, "trumpet").cc[10][0][1] > 64 &&
    v1d.inst === "violin" && byName(mt0, "horns").inst === "french horn", mt0.map(function (x) { return [x.name, x.cc[7], x.cc[10]]; }));
  ok("...the soft passes on expression (CC11 100), the full ones at 127; no mod wheel and no overlapping notes for a plain player",
    JSON.stringify(v1d.cc[11]) === JSON.stringify([[0, 100], [3840, 100], [26880, 127], [49920, 127]]) && !mt0.some(function (x) { return x.cc[1]; }) && legato(v1d).join() === "0,0", [v1d.cc[11], legato(v1d)]);
  ok("...for orchestral sample libraries: the dynamics on CC1 too (60 soft, 100 full), a held line's notes overlap the next (not the same pitch again); the timpani not",
    JSON.stringify(v1l.cc[1]) === JSON.stringify([[0, 60], [3840, 60], [26880, 100], [49920, 100]]) && legato(v1l)[0] > 30 && legato(v1l)[1] === 0 && !byName(mt1, "timpani").cc[1] && legato(byName(mt1, "timpani")).join() === "0,0",
    [v1l.cc[1], legato(v1l)]);
  var mtb = midiTracks(L.musicMidi.file(S.make({ title: "", lines: ["key C", "style ballad", "chords C | G", "melody E D C D | E - - -"] }).plan));
  ok("...a song without an orchestra: the melody loudest, the chords and bass under it", byName(mtb, "melody").cc[7][0][1] === 100 && byName(mtb, "chords").cc[7][0][1] === 77 && byName(mtb, "bass").cc[7][0][1] === 92,
    mtb.map(function (x) { return [x.name, x.cc[7]]; }));


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
  // 1.22.0: Adam's next questions, in the same chat (his trial of 1.21.2, with Ode to Joy)
  function lastUser(i) { var m = modelCalls[i] ? modelCalls[i].messages[modelCalls[i].messages.length - 1].content : ""; return typeof m === "string" ? m : JSON.stringify(m); }
  var TW = ["key C", "chords C | F C | F C | G C", "melody C C G G | A A G - | F F E E | D D C -", "arrange orchestra"];
  modelReplies = ["NEED: Do you want me to compose an orchestral arrangement for \"Twinkle\", or do you have specific instruments in mind for the orchestra?", song(TW, "Twinkle")];
  before = logText().length;
  chatAsk("Can you fill in the missing pieces of the song with an orchestra?"); await sleep(300);
  t = logText().slice(before);
  ok("Chat, the question after the song: the AI is given the song and arrange orchestra; its NEED goes back; the orchestra plays it",
    modelCalls.length === 2 && /THE SONG SO FAR: Lantern made this song earlier in this chat -- \u201cTwinkle\u201d/.test(lastUser(0)) && /arrange orchestra/.test(modelCalls[0].messages[0].content) &&
    /^The person has already asked for this: make it now\./.test(lastUser(1)) && /The AI asked whether to go ahead/.test(t) &&
    /Lantern made a song: Twinkle \u2014 4 bars in C major, 4\/4 at \d+ a minute, arranged for orchestra \(12 players\)/.test(t) && !/still questions/.test(t),
    [modelCalls.length, lastUser(0).slice(0, 300), lastUser(1).slice(0, 200), t.slice(-400)]);
  modelReplies = ["I cannot create a playable orchestral file using Lantern's tools; you would need a DAW like MuseScore.",
    song(TW.map(function (l) { return l.replace("D D C -", "D D D -"); }), "Twinkle"), song(TW, "Twinkle")];
  before = logText().length;
  chatAsk("So can you use the lantern tools to create the file of the orchestra as you envision it in your basic framework?"); await sleep(300);
  t = logText().slice(before);
  ok("...the AI says Lantern cannot: back with the block to write; a tune from memory goes back for the one made before; then the orchestra plays it",
    modelCalls.length === 3 && /^Lantern can make this\. It plays a song on an orchestra/.test(lastUser(1)) && /the melody is not the one in the song made before -- from bar 4 \(note 14\)/.test(lastUser(2)) &&
    /said Lantern could not make it/.test(t) && /Lantern made a song: Twinkle \u2014 4 bars in C major, 4\/4 at \d+ a minute, arranged for orchestra/.test(t) && !/still questions/.test(t),
    [modelCalls.length, lastUser(1).slice(0, 200), lastUser(2).slice(0, 300), t.slice(-400)]);
  btn(card, "Open in Music").click(); await sleep(80); fire(w, "hashchange"); await sleep(80);
  var song1 = L.store.get("music.song", {});
  ok("Open in Music: the song goes to the Make a song card, with what Lantern wrote in", /^title Twinkle\nkey C major/.test(song1.text) && /melody C C G G \| A A G - \| F F E E \| D D C -/.test(song1.text), song1);
  // the card in the Music tile
  go("music"); await sleep(120);
  var ta = d.querySelector("textarea[aria-label=Song]");
  ok("the Make a song card: the song in its box, written out, with Save MIDI, Save WAV and examples", ta && /title Twinkle/.test(ta.value) && d.querySelector(".la-song canvas") &&
    btn(d, "Save MIDI") && btn(d, "Save WAV") && d.querySelectorAll("select[aria-label='Start from'] option").length === 8, ta && ta.value);
  var sel = d.querySelector("select[aria-label='Start from']");
  sel.value = "2"; fire(sel, "change"); await sleep(30);
  ok("...an example: Ode to Joy, 8 bars in D major", /title Ode to Joy/.test(ta.value) && /8 bars in D major/.test(d.body.textContent));
  ta.value = "key C\nchords C | Q7"; fire(ta, "input"); await sleep(700);
  ok("...typing redraws: a problem is shown, and what is kept", /\u201cQ7\u201d \(bar 2\) is not a chord/.test(d.body.textContent) && L.store.get("music.song", {}).text === "key C\nchords C | Q7");
  var libBox = d.querySelector("input[aria-label='MIDI for orchestral sample libraries']"), seen = [], mf0 = L.musicMidi.file;
  L.musicMidi.file = function (p, o) { seen.push(o); return mf0(p, o); };
  libBox.checked = true; fire(libBox, "change");
  ta.value = "key C\nchords C | G"; fire(ta, "input"); await sleep(700);
  btn(d, "Save MIDI").click();
  ok("...a setting for orchestral sample libraries, kept, and Save MIDI follows it (Chat's too)", libBox && L.store.get("music.midiLibrary", false) === true && seen.length === 1 && seen[0].library === true, seen);
  L.musicMidi.file = mf0; L.store.set("music.midiLibrary", false);
  L.musicDocs.EXAMPLES.forEach(function (x) { var r = S.make({ title: "", lines: x[1].split("\n") }); ok("example " + x[0] + ": made, nothing questioned", r.plan && !r.problems.length, r.problems); });

  ok("no page errors", errs.length === 0, errs);
  console.log(fails ? fails + " MUSIC TESTS FAILED (" + passes + " passed)" : "ALL MUSIC TESTS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
