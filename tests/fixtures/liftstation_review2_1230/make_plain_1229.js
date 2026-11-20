#!/usr/bin/env node
// make_plain_1229.js -- writes plain_1229.json: what Lantern 1.24.29 made of each plain circuit (plain_circuits.js) and
// which tools it offered, so replay.js compares 1.24.30 with it without git.
// Usage: git show lantern-1.24.29:src/lantern.inner.html > /tmp/l1229.html; node make_plain_1229.js /tmp/l1229.html
"use strict";
var fs = require("fs"), path = require("path");
var load = require("./load.js"), cases = require("./plain_circuits.js"), sig = require("./plain_sig.js");
var L = load(process.argv[2]).L, out = {};
if (L.version !== "1.24.29") throw new Error("not 1.24.29: " + L.version);
cases.forEach(function (c) { out[c.id] = { sig: sig(L.aiAct.build(c.b, c.q)), tools: L.aiAct.relevant(c.q).map(function (a) { return a.id; }) }; });
fs.writeFileSync(path.join(__dirname, "plain_1229.json"), JSON.stringify(out, null, 1) + "\n");
console.log(Object.keys(out).length + " circuits written from " + L.version);
