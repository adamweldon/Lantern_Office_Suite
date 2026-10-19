// Boots the suite the way the self-unpacking bundle does (inner script runs
// after DOMContentLoaded), checks every app reaches the first home paint,
// then opens each app through hash routing and fails on any exception.
// mountall.js <inner.html> -- bundle timing boot, then open every registered app
// via the shell's hash routing and record exceptions per app.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const inner = fs.readFileSync(process.argv[2] || require("path").join(__dirname, "..", "src", "lantern.inner.html"), "utf8");
const js = inner.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
const vc = new VirtualConsole();
const errs = [];
vc.on("jsdomError", e => errs.push(String(e.message || e).slice(0, 200)));
const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>",
  { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
w.alert = () => {}; w.confirm = () => true; w.prompt = () => null; w.print = () => {};
w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {}; w.scrollTo = function () {}; w.scroll = function () {};
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
const ctx2d = () => new Proxy({ canvas: null }, { get: (t, k) => k in t ? t[k] : (k === "measureText" ? () => ({ width: 10 }) : (k === "getImageData" || k === "createImageData") ? () => ({ data: new Uint8ClampedArray(4) }) : (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") ? () => ({ addColorStop() {} }) : function () {}), set: (t, k, v) => { t[k] = v; return true; } });
w.HTMLCanvasElement.prototype.getContext = function () { return ctx2d(); };
w.addEventListener("error", e => errs.push("window.error: " + e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await sleep(10);
  try { w.eval(js); } catch (e) { errs.push("eval: " + e.message); }
  await sleep(30);
  const L = w.Lantern;
  const res = { apps: L.order.length, firstPaintTiles: w.document.querySelectorAll(".tile").length, bootErrors: errs.splice(0) };
  const per = {};
  for (const id of L.order) {
    try { w.location.hash = id; w.dispatchEvent(new w.HashChangeEvent("hashchange")); } catch (e) { errs.push("route: " + e.message); }
    await sleep(15);
    const ws = w.document.querySelector("main, .workspace, #workspace") || w.document.body;
    per[id] = { nodes: ws.querySelectorAll("*").length, errors: errs.splice(0) };
  }
  w.location.hash = ""; w.dispatchEvent(new w.HashChangeEvent("hashchange")); await sleep(10);
  res.homeTilesAfterTour = w.document.querySelectorAll(".tile").length;
  res.appsWithErrors = Object.keys(per).filter(k => per[k].errors.length).map(k => ({ id: k, err: per[k].errors.slice(0, 2) }));
  res.emptyApps = Object.keys(per).filter(k => per[k].nodes < 5);
  if (process.argv[3]) res.detail = per[process.argv[3]];
  console.log(JSON.stringify(res, null, 1));
  const ok = res.firstPaintTiles === res.apps && !res.bootErrors.length && !res.appsWithErrors.length && !res.emptyApps.length;
  console.log(ok ? "ALL BOOT TOUR PASS" : "BOOT TOUR FAILED");
  process.exit(ok ? 0 : 1);
})();
