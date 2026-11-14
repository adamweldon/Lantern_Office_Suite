// get_page.js -- site/get.html, the one link to share (1.24.19), in jsdom:
//  - each computer or phone is shown its own box, and only that one;
//  - a computer's download starts by itself (not with ?nodl, never on a phone);
//  - an ARM Linux is given the ARM program;
//  - every file the page links to is one tools/pack_starter.py makes and the release workflow publishes;
//  - with nothing known (or the script off), every download is listed.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(ROOT, "site", "get.html"), "utf8");
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 800)); } }

function load(ua, opts) {
  opts = opts || {};
  var vc = new VirtualConsole(), errs = [], navs = [];
  vc.on("jsdomError", function (e) { if (/navigation/i.test(String(e.message))) navs.push(1); else errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM(html, { url: "https://adamweldon.github.io/Lantern_Office_Suite/get.html" + (opts.q || ""), runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse: function (w) {
      Object.defineProperty(w.navigator, "userAgent", { value: ua });
      Object.defineProperty(w.navigator, "maxTouchPoints", { value: opts.touch || 0 });
      w.setTimeout = function (f) { f(); };
    } });
  var d = dom.window.document;
  var shown = Array.prototype.slice.call(d.querySelectorAll(".pick.on")).map(function (e) { return e.id; });
  var said = shown.length ? d.querySelector("#" + shown[0] + " [data-started]") : null;
  var started = navs.length > 0 && !!said && !said.hidden;   // went to the file, and said so
  var btn = shown.length ? d.querySelector("#" + shown[0] + " a.btn") : null;
  return { d: d, shown: shown, started: started, btn: btn && btn.getAttribute("data-get"), href: btn && btn.href, errs: errs, title: d.getElementById("all-title").textContent };
}

var UA = {
  win: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
  pi: "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  cros: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  odd: "SomeBrowser/1.0"
};
var REL = "https://github.com/adamweldon/Lantern_Office_Suite/releases/latest/download/";
var r;
r = load(UA.win);
ok("Windows: its box only, the .exe, the download started", r.shown.join() === "p-windows" && r.btn === "Get-Lantern.exe" && r.href === REL + "Get-Lantern.exe" && r.started && r.errs.length === 0, r);
r = load(UA.win, { q: "?nodl" });
ok("...not started with ?nodl", r.shown.join() === "p-windows" && !r.started, r);
r = load(UA.mac);
ok("a Mac: its box, the Mac zip, started", r.shown.join() === "p-mac" && r.btn === "Get-Lantern-Mac.zip" && r.started, r);
r = load(UA.ipad, { touch: 5 });
ok("an iPad (which says Macintosh): the phone steps, nothing downloaded", r.shown.join() === "p-ios" && !r.started && /Add to Home Screen/.test(r.d.getElementById("p-ios").textContent), r.shown);
r = load(UA.iphone, { touch: 5 });
ok("an iPhone: Share, Add to Home Screen", r.shown.join() === "p-ios" && !r.started, r.shown);
r = load(UA.android, { touch: 5 });
ok("Android (which says Linux): Install app, nothing downloaded", r.shown.join() === "p-android" && !r.started && /Install app/.test(r.d.getElementById("p-android").textContent), r.shown);
r = load(UA.linux);
ok("Linux: the x64 program, and the line that lets it run", r.shown.join() === "p-linux" && r.btn === "Get-Lantern-Linux-x64" && r.started && /chmod \+x Get-Lantern-Linux-x64 && \.\/Get-Lantern-Linux-x64/.test(r.d.querySelector("[data-cmd]").textContent), r);
r = load(UA.pi);
ok("a Raspberry Pi: the ARM program, and its line", r.btn === "Get-Lantern-Linux-arm64" && r.href === REL + "Get-Lantern-Linux-arm64" && /Get-Lantern-Linux-arm64 && \.\/Get-Lantern-Linux-arm64/.test(r.d.querySelector("[data-cmd]").textContent), r);
r = load(UA.cros);
ok("a Chromebook: install the website, nothing downloaded", r.shown.join() === "p-chromebook" && !r.started, r.shown);
r = load(UA.odd);
ok("anything else: no box, every download listed", r.shown.length === 0 && r.title === "Choose your computer", r);

// the files the page names are the files that are made and published
var names = {};
html.replace(/data-get="([^"]+)"/g, function (_, n) { names[n] = 1; });
html.replace(/releases\/latest\/download\/([A-Za-z0-9._-]+)/g, function (_, n) { names[n] = 1; });
var pack = fs.readFileSync(path.join(ROOT, "tools", "pack_starter.py"), "utf8");
var wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "lantern-zip.yml"), "utf8");
Object.keys(names).forEach(function (n) {
  if (n === "Lantern.zip") return ok("Lantern.zip is published", /dist\/Lantern\.zip/.test(wf));
  ok("the page's " + n + " is made by pack_starter.py", pack.indexOf('"' + n + '"') >= 0 || pack.indexOf(n) >= 0, n);
});
ok("...and the release publishes them all", /dist\/get\/Get-Lantern\*/.test(wf));
ok("the page names five files", Object.keys(names).sort().join() === "Get-Lantern-Linux-arm64,Get-Lantern-Linux-x64,Get-Lantern-Mac.zip,Get-Lantern.exe,Lantern.zip", Object.keys(names));
ok("ES5 only in its script", !/=>|\blet |\bconst |`/.test(html.split("<script>")[1]));

console.log(fails ? fails + " GET PAGE FAILURES (" + passes + " passed)" : "ALL GET PAGE CHECKS PASS (" + passes + ")");
process.exit(fails ? 1 : 0);
