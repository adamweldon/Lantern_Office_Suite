// qregex.js <inner.html> -- find regex literals that contain a bare quote char.
// A string-blind lexer (PCEngine's gate) treats that quote as opening a string
// and desyncs brace counting until the next matching quote.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || require("path").join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
const js = src.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
const acorn = (() => { try { return require("acorn"); } catch (e) { return null; } })();
if (!acorn) { console.log("need acorn"); process.exit(2); }
const mods = []; js.replace(/\/\/ MODULE: ([A-Z0-9_]+) - START/g, (m, n, off) => { mods.push([off, n]); return m; });
const modAt = p => { let n = "?"; for (const [o, m] of mods) { if (o <= p) n = m; else break; } return n; };
const hits = [];
acorn.parse(js, { ecmaVersion: 2017, onToken: t => {
  if (t.type.label === "regexp") {
    const raw = js.slice(t.start, t.end);
    if (/["']/.test(raw)) hits.push({ mod: modAt(t.start), raw, line: js.slice(0, t.start).split("\n").length });
  }
}});
for (const h of hits) console.log(h.mod.padEnd(16), "line", String(h.line).padStart(5), h.raw);
console.log(hits.length, "quote-bearing regex literals"); process.exit(hits.length ? 1 : 0);
