// h.js -- the second review's helpers (1.24.33): Lantern loaded once in jsdom (as tests/pptx.js loads it), with a
// scripted model whose finish ("stop", "length", none) the AI cases choose; decks read and written; zip parts read back.
"use strict";
var fs = require("fs"), path = require("path"), zlib = require("zlib");
var HERE = __dirname, ROOT = path.join(HERE, "..", "..", "..");
var SRC = process.env.LANTERN_SRC || path.join(ROOT, "src", "lantern.inner.html");
var load = require(path.join(ROOT, "tests", "fixtures", "liftstation_review1_1230", "load.js"));
var o = null;
function get() {
  if (o) return o;
  o = load(SRC);
  // the model's reply and its finish, as a server gives them (the AI cases set o.next = {content, finish})
  var w = o.w;
  var base = w.fetch;
  w.fetch = function (url, opts) {
    url = String(url);
    if (o.next && /chat\x2Fcompletions/.test(url)) {
      var n = o.next; o.next = n.after || null; o.sent = JSON.parse(opts.body);
      var ch = { message: { content: n.content } };
      if (n.finish !== undefined) ch.finish_reason = n.finish;
      var body = JSON.stringify({ choices: [ch], usage: { completion_tokens: 20 } });
      return Promise.resolve({ ok: true, status: 200, headers: { get: function () { return "application/json"; } }, text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
    }
    return base(url, opts);
  };
  return o;
}
function L() { return get().L; }
function u8(b) { var w = get().w, a = new w.Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b[i]; return a; }
function deck(name) { return path.join(HERE, "decks", name); }
function read(name) { return L().pptx.read(u8(fs.readFileSync(deck(name))), name); }
function readBytes(buf, name) { return L().pptx.read(u8(buf), name); }
// a tiny zip reader for what Lantern wrote: {names, text(n), bytes(n)}
function unzip(buf) {
  buf = Buffer.from(buf);
  var e = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), n = buf.readUInt16LE(e + 10), at = buf.readUInt32LE(e + 16), files = {};
  for (var i = 0; i < n; i++) {
    var m = buf.readUInt16LE(at + 10), cs = buf.readUInt32LE(at + 20), nl = buf.readUInt16LE(at + 28), xl = buf.readUInt16LE(at + 30), cl = buf.readUInt16LE(at + 32), lo = buf.readUInt32LE(at + 42);
    var nm = buf.toString("utf8", at + 46, at + 46 + nl), lnl = buf.readUInt16LE(lo + 26), lxl = buf.readUInt16LE(lo + 28), d = buf.slice(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + cs);
    files[nm] = m === 8 ? zlib.inflateRawSync(d) : d;
    at += 46 + nl + xl + cl;
  }
  return { names: Object.keys(files), text: function (k) { return files[k] ? files[k].toString("utf8") : null; }, bytes: function (k) { return files[k] || null; } };
}
function write(d) { var r = L().pptx.write(d); return { bytes: Buffer.from(r.bytes), notes: r.notes, z: unzip(Buffer.from(r.bytes)) }; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// say(a, b): "" when equal, else what differs
function same(got, want) { var g = JSON.stringify(got), w = JSON.stringify(want); return g === w ? "" : "got " + g.slice(0, 400) + " -- wanted " + w.slice(0, 400); }
function strip(h) { return String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
var JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAGAAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
module.exports = { get: get, L: L, u8: u8, deck: deck, read: read, readBytes: readBytes, unzip: unzip, write: write, sleep: sleep, same: same, strip: strip, JPEG: JPEG, HERE: HERE, ROOT: ROOT, SRC: SRC, fs: fs, path: path };
