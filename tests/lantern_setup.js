// lantern_setup.js -- the page's side of the Lantern starter (LANTERN_SETUP, 1.24.19), in jsdom with a stand-in
// starter answering /lantern-setup/status on Lantern's own address:
//  - the corner button says what is being fetched; the list shows each download with its bar, the offers with sizes;
//  - Chat's AI, asked while the AI is still coming, says so in a plain sentence (not "No AI model on this device");
//  - the AI module is told when the AI starts and when a stronger model takes over (Lantern.ai.detect);
//  - the list opens by itself once, when the first model is in, for the offers; Add posts the choice;
//  - Stop Lantern asks once, then posts stop;
//  - the kit's model-loading screen stays in the corner under the starter;
//  - served by anything else (no answer at /lantern-setup/status, a file, another address), nothing shows.
"use strict";
var JSDOM = require("jsdom").JSDOM, VirtualConsole = require("jsdom").VirtualConsole;
var fs = require("fs"), path = require("path");
var inner = fs.readFileSync(process.argv[2] || path.join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
var JS = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
var fails = 0, passes = 0;
function ok(name, cond, info) { if (cond) passes++; else { fails++; console.log("FAIL", name, info === undefined ? "" : JSON.stringify(info).slice(0, 1500)); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function resp(status, body) {
  return Promise.resolve({ ok: status < 400, status: status, headers: { get: function () { return "application/json"; } },
    text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } });
}
function job(id, name, state, bytes, total, leftMs) { return { id: id, name: name, gb: 0.55, state: state, bytes: bytes || 0, total: total || 0, rate: bytes ? 2e6 : 0, leftMs: leftMs == null ? -1 : leftMs, why: "" }; }
var OFFERS = [{ id: "library", name: "The encyclopedia", gb: 12, what: "Wikipedia: the first part of every article" }, { id: "shelves", name: "Medicine, repair, travel and science books", gb: 5, what: "WikiMed, iFixit" }];

function boot(url, starter) {
  var vc = new VirtualConsole(), errs = [];
  vc.on("jsdomError", function (e) { if (!/Not implemented/.test(String(e.message))) errs.push(String(e.message).slice(0, 200)); });
  var dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", { url: url, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, posts = [], asked = [];
  w.fetch = function (u, o) {
    var x = new w.URL(String(u), url);
    asked.push(x.pathname);
    if (starter && x.pathname === "/lantern-setup/status") return resp(200, JSON.stringify(starter.st));
    if (starter && x.pathname === "/lantern-setup/choose") { posts.push(["choose", JSON.parse(o.body).id]); starter.st.offers = starter.st.offers.filter(function (f) { return f.id !== JSON.parse(o.body).id; }); return resp(200, JSON.stringify(starter.st)); }
    if (starter && x.pathname === "/lantern-setup/stop") { posts.push(["stop"]); return resp(200, "{\"ok\":true}"); }
    if (x.pathname === "/v1/models") return starter && starter.ai ? resp(200, JSON.stringify({ data: [{ id: starter.ai }] })) : resp(404, "{}");
    if (x.pathname === "/props") return resp(200, "{}");
    return resp(404, "{}");
  };
  w.eval(JS);
  var ev = w.document.createEvent("Event"); ev.initEvent("DOMContentLoaded", true, true); w.document.dispatchEvent(ev);
  return { w: w, errs: errs, posts: posts, asked: asked };
}

(async function () {
  var starter = { st: { v: 1, starter: "1.24.19", lantern: "1.24.19", busy: true, freeGB: 80, offers: OFFERS, watch: 8082,
    ai: { state: "downloading" }, jobs: [job("engine", "The AI engine (llama.cpp)", "done", 5e7, 5e7, 0), job("0.8b", "A small AI model (Qwen3.5 0.8B)", "running", 2e8, 5.5e8, 140000),
      job("laptop", "A stronger AI model (Qwen3.5 4B)", "queued")], message: "Getting a small AI model (Qwen3.5 0.8B): 36%, about 2 min left." } };
  var B = boot("http://127.0.0.1:8080/", starter), w = B.w, L = w.Lantern, d = w.document;
  await sleep(300);
  ok("boot clean", B.errs.length === 0, B.errs);
  ok("served by the starter: it is seen", L.lanternSetup && L.lanternSetup.active() && B.asked.indexOf("/lantern-setup/status") >= 0);
  var pill = d.querySelector(".ls-pill");
  ok("the corner button says what is being fetched", pill && /Getting a small AI model \(Qwen3\.5 0\.8B\): 36%, about 2 min left/.test(pill.textContent), pill && pill.textContent);
  ok("the list is not open by itself while the first model comes", d.querySelector(".ls-veil").style.display === "none");
  var note = L.aiWaitNote();
  ok("Chat's sentence while the AI comes: how far, how long, and that the rest works", /^Lantern’s AI is still arriving: 36% downloaded, about 2 min left\. Everything else in Lantern works now/.test(note), note);
  var err = null;
  try { await L.aiRoute([{ role: "user", content: "hello" }], {}); } catch (e) { err = e; }
  ok("...and the AI, asked meanwhile, answers with it (not the in-page AI's no-model error)", err && /still arriving/.test(err.message) && !/No AI model on this device/.test(err.message), err && err.message);
  pill.onclick();
  var box = d.querySelector(".ls-box"), txt = box.textContent;
  ok("the list: each download with its state, the offers with sizes, free space, Stop", /Getting Lantern ready/.test(txt) && /You can use everything else in Lantern now/.test(txt) &&
    /The AI engine \(llama\.cpp\)done ✓/.test(txt) && /36% of 0\.6 GB/.test(txt) && /about 2 min left/.test(txt) && /A stronger AI model \(Qwen3\.5 4B\)next/.test(txt) &&
    /Add \(12 GB\)/.test(txt) && /Add \(5 GB\)/.test(txt) && /Free on this drive: 80 GB/.test(txt) && /Stop Lantern/.test(txt), txt);
  ok("...a bar for each download that has begun", box.querySelectorAll("[role=progressbar]").length === 2 && box.querySelectorAll("[role=progressbar]")[1].getAttribute("aria-valuenow") === "36");
  // the AI starts: the AI module is told
  var detected = 0, d0 = L.ai.detect; L.ai.detect = function () { detected++; return d0.apply(this, arguments); };
  starter.st.ai = { state: "starting" }; starter.st.jobs[1] = job("0.8b", "A small AI model (Qwen3.5 0.8B)", "done", 5.5e8, 5.5e8, 0);
  starter.st.message = "Lantern's AI is starting.";
  await sleep(2300);
  ok("the AI starting: the AI module is told", detected >= 1, detected);
  ok("...and Chat's sentence says so", /it is starting now/.test(L.aiWaitNote()), L.aiWaitNote());
  // ready, with offers: the list opens once
  d.querySelector(".ls-box button:last-child") && Array.prototype.slice.call(d.querySelectorAll(".ls-box button")).filter(function (b) { return b.textContent === "Close"; })[0].onclick();
  starter.st.ai = { state: "ready", model: "Qwen3.5-0.8B-Q4_K_M", next: "A stronger AI model (Qwen3.5 4B)" }; starter.ai = "Qwen3.5-0.8B-Q4_K_M.gguf";
  starter.st.jobs[2] = job("laptop", "A stronger AI model (Qwen3.5 4B)", "running", 3e8, 3.5e9, 1500000);
  starter.st.message = "Getting a stronger AI model (Qwen3.5 4B): 8%, about 25 min left.";
  var before = detected;
  await sleep(2300);
  ok("the AI ready: told again; Chat's sentence is gone", detected > before && L.aiWaitNote() === "", [detected, L.aiWaitNote()]);
  ok("the first model in: the list opens by itself, once, for the offers", d.querySelector(".ls-veil").style.display === "" && /The AI works now \(Qwen3\.5-0\.8B\); a stronger AI model \(Qwen3\.5 4B\) is coming/.test(d.querySelector(".ls-box").textContent),
    d.querySelector(".ls-box").textContent.slice(0, 300));
  ok("...remembered, so it does not open by itself again", L.store.get("setup.offersShown", false) === true);
  var add = Array.prototype.slice.call(d.querySelectorAll(".ls-box button")).filter(function (b) { return /Add \(12 GB\)/.test(b.textContent); })[0];
  add.onclick();
  await sleep(700);
  ok("Add posts the choice, and the offer goes from the list", B.posts.some(function (p) { return p[0] === "choose" && p[1] === "library"; }) && !/Add \(12 GB\)/.test(d.querySelector(".ls-box").textContent), B.posts);
  // the stronger model takes over
  starter.st.ai = { state: "ready", model: "Qwen3.5-4B-Q4_K_M" }; starter.ai = "Qwen3.5-4B-Q4_K_M.gguf"; starter.st.jobs[2].state = "done"; starter.st.busy = false; starter.st.message = "Everything Lantern needs is here.";
  before = detected;
  await sleep(2300);
  ok("a stronger model taking over: the AI module is told again", detected > before, detected);
  ok("nothing happening: the corner button says so", /Lantern on this computer/.test(d.querySelector(".ls-pill").textContent), d.querySelector(".ls-pill").textContent);
  // Stop: asked once, then posted
  var stop = d.querySelector(".ls-stop"); stop.onclick();
  ok("Stop Lantern asks first, saying how to start it again", /Yes, stop Lantern and its AI/.test(d.querySelector(".ls-stop").textContent) && /double-click Lantern on the desktop/.test(d.querySelector(".ls-box").textContent));
  d.querySelector(".ls-stop").onclick();
  await sleep(200);
  ok("...then stops it, and says it has stopped", B.posts.some(function (p) { return p[0] === "stop"; }) && /Lantern has stopped on this computer/.test(d.querySelector(".ls-pill").textContent) && !L.lanternSetup.active(),
    [B.posts, d.querySelector(".ls-pill").textContent]);

  // the model-loading screen of the kit: in the corner under the starter
  var S2 = { st: { v: 1, starter: "1.24.19", busy: false, offers: [], jobs: [], ai: { state: "starting" }, message: "" } };
  var B2 = boot("http://127.0.0.1:8080/", S2);
  B2.w.fetch = (function (f) { return function (u, o) { var x = new B2.w.URL(String(u), "http://127.0.0.1:8080/"); if (x.pathname === "/v1/models") return resp(503, "{}"); if (x.pathname === "/health") return resp(503, "{}"); return f(u, o); }; })(B2.w.fetch);
  await sleep(2600);
  var veil = B2.w.document.querySelector(".lw-veil");
  ok("the kit's loading screen stays in the corner under the starter", !veil || veil.style.display === "none", veil && veil.style.display);

  // anywhere else: nothing
  var B3 = boot("http://127.0.0.1:8080/", null);
  await sleep(300);
  ok("a server that is not the starter: nothing shows, and the AI's own error is as before", !B3.w.Lantern.lanternSetup.active() && !B3.w.document.querySelector(".ls-pill") && B3.w.Lantern.aiWaitNote() === "");
  var B4 = boot("https://adamweldon.github.io/Lantern_Office_Suite/", starter);
  await sleep(300);
  ok("...nor on the website (it never asks there)", !B4.w.Lantern.lanternSetup.active() && B4.asked.indexOf("/lantern-setup/status") < 0);

  console.log(fails ? fails + " LANTERN SETUP FAILURES (" + passes + " passed)" : "ALL LANTERN SETUP CHECKS PASS (" + passes + ")");
  process.exit(fails ? 1 : 0);
})();
