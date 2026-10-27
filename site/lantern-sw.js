// Lantern offline worker (site build). Keeps Lantern and the AI engine files
// on the device after the first visit so the app opens with no connection.
// Models are NOT cached here: the engine keeps them in the browser's private
// file store. Requests to a model server's API (/v1/...) are never cached.
// With ?coi=1 it also adds cross-origin isolation headers, which lets the
// engine use several CPU threads on hosts that cannot send them (GitHub Pages).
var VERSION = "1.14.1-b1c23879";
var CACHE = "lantern-" + VERSION;
var COI = new URL(self.location.href).searchParams.get("coi") === "1";
var CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  "icons/apple-touch-icon.png", "ai/wllama/index.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("lantern-") === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isolate(res) {
  if (!COI || !res || res.status === 0 || res.type === "opaque") return res;
  var h = new Headers(res.headers);
  h.set("Cross-Origin-Embedder-Policy", "require-corp");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
function keep(req, res) {
  if (res && res.ok && res.type === "basic") {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}
// Pages: network first (so updates arrive), falling back to the saved copy
// after 4 seconds or when offline. Everything else: saved copy first.
function page(req) {
  return new Promise(function (resolve) {
    var done = false;
    function fallback() {
      if (done) return;
      caches.match(req).then(function (hit) { return hit || caches.match("index.html"); }).then(function (hit) {
        if (!done && hit) { done = true; resolve(hit); }
      });
    }
    var t = setTimeout(fallback, 4000);
    fetch(req).then(function (res) {
      clearTimeout(t);
      if (!done) { done = true; resolve(keep(req, res)); }
    }).catch(function () { clearTimeout(t); fallback(); });
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (/\/v1\//.test(url.pathname) || /\/(health|props|slots|metrics)$/.test(url.pathname)) return;
  var p = req.mode === "navigate" ? page(req) :
    caches.match(req).then(function (hit) { return hit || fetch(req).then(function (res) { return keep(req, res); }); });
  e.respondWith(p.then(isolate));
});
