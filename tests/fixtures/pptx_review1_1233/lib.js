// lib.js -- what the cases of review 1 of 1.24.33 share: Lantern loaded once, the decks read once, a slide's body as
// the lines a person sees (each with its list kind and depth), and the programs the write cases call.
"use strict";
var fs = require("fs"), path = require("path"), cp = require("child_process");
var HERE = __dirname, DECKS = path.join(HERE, "decks");
module.exports = function (o) {
  var L = o.L, w = o.w, cache = {};
  function u8(b) { var a = new w.Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b[i]; return a; }
  function file(name) { return fs.readFileSync(path.join(DECKS, name)); }
  // read(name) -> Lantern's reading of decks/<name> ({title, slides, notes}) or {error}
  function read(name) {
    if (!(name in cache)) {
      try { cache[name] = L.pptx.read(u8(file(name)), name); } catch (e) { cache[name] = { error: String(e && e.message || e) }; }
    }
    return cache[name];
  }
  // lines(html) -> [{k: "p"|"ul"|"ol"|"td"|"th", d: depth, t: text}] in the order a person reads them
  function lines(html) {
    var doc = new w.DOMParser().parseFromString("<body>" + (html || "") + "</body>", "text/html"), out = [];
    function walk(n, depth, kind) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (/\S/.test(c.data) && kind) { /* text straight in a list item is read with it */ } continue; }
        if (c.nodeType !== 1) continue;
        var t = c.tagName.toLowerCase();
        if (t === "ul" || t === "ol") { walk(c, depth + 1, t); continue; }
        if (t === "li") {
          var own = "";
          for (var k = c.firstChild; k; k = k.nextSibling) if (!(k.nodeType === 1 && /^(ul|ol)$/i.test(k.tagName))) own += k.nodeType === 1 && k.tagName.toLowerCase() === "br" ? "\n" : k.textContent;
          out.push({ k: kind, d: depth, t: own.replace(/[ \t\u00a0]+/g, " ").trim(), start: c.parentNode.getAttribute("start") });
          for (k = c.firstChild; k; k = k.nextSibling) if (k.nodeType === 1 && /^(ul|ol)$/i.test(k.tagName)) walk(k, depth + 1, k.tagName.toLowerCase());
          continue;
        }
        if (t === "table") { Array.prototype.forEach.call(c.rows, function (r) { out.push({ k: "tr", d: 0, t: Array.prototype.map.call(r.cells, function (x) { return x.textContent.trim(); }).join(" | ").trim() }); }); continue; }
        if (t === "p" || /^h\d$/.test(t) || t === "div") { out.push({ k: "p", d: 0, t: c.textContent.replace(/\s+/g, " ").trim() }); continue; }
        walk(c, depth, kind);
      }
    }
    walk(doc.body, 0, null);
    return out;
  }
  // plain(html): the words a person reads, a space between blocks (paragraphs, points, cells), pictures left out
  function plain(html) {
    var d = new w.DOMParser().parseFromString("<body>" + (html || "") + "</body>", "text/html");
    Array.prototype.forEach.call(d.querySelectorAll("img,script,style"), function (e) { e.remove(); });
    Array.prototype.forEach.call(d.querySelectorAll("p,div,li,ul,ol,tr,td,th,table,caption,h1,h2,h3,h4,h5,h6,br,pre,blockquote"), function (e) {
      e.parentNode.insertBefore(d.createTextNode(" "), e); if (e.nextSibling) e.parentNode.insertBefore(d.createTextNode(" "), e.nextSibling); else e.parentNode.appendChild(d.createTextNode(" "));
    });
    return d.body.textContent.replace(/\s+/g, " ").trim();
  }
  function said(r) { return (r.notes || []).join("\n"); }
  // which(cmd) -> true when the program is on this machine
  function which(cmd) { try { cp.execSync("command -v " + cmd, { stdio: "ignore" }); return true; } catch (e) { return false; } }
  function py(script, args) { return cp.execFileSync("python3", [path.join(HERE, script)].concat(args || []), { encoding: "utf8", maxBuffer: 64 << 20, timeout: 1200000 }); }
  return { L: L, o: o, w: w, u8: u8, file: file, read: read, lines: lines, plain: plain, said: said, which: which, py: py, HERE: HERE, DECKS: DECKS };
};
