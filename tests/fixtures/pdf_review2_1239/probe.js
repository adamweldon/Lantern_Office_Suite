// probe.js -- evaluated in the page (Playwright): opens one PDF with Lantern.pdf and returns what Lantern made of it:
// title, lock, text of each page, fields, layers, bookmarks, annotations, and the drawn page (and pageImage) measured in
// regions given in PDF points. Works on 1.24.38 too (the functions it lacks are left out).
async (a) => {
  var P = Lantern.pdf, out = { errors: [] }, t0 = performance.now(), pdf;
  try {
    var buf = await (await fetch(a.f)).arrayBuffer();
    pdf = await P.open(new Uint8Array(buf), a.pw !== undefined ? { password: a.pw } : {});
  } catch (e) {
    return { openError: String(e && e.message || e), needPassword: !!(e && e.needPassword), wrongPassword: !!(e && e.wrongPassword), ms: Math.round(performance.now() - t0) };
  }
  out.openMs = Math.round(performance.now() - t0);
  if (a.layerOn && P.layers) {
    var on = {};
    P.layers(pdf).forEach(function (l) { if (a.layerOn[l.name] !== undefined) on[l.key] = a.layerOn[l.name]; });
    pdf.layerOn = on;
  }
  out.count = pdf.count; out.title = pdf.title; out.security = pdf.security || null;
  var np = Math.min(pdf.count, a.maxPages || 6);
  out.texts = [];
  if (a.text !== false) for (var i = 0; i < np; i++) {
    try { out.texts.push((await P.pageText(pdf, i)).text); } catch (e) { out.texts.push("ERROR: " + e.message); out.errors.push("pageText " + i + ": " + e.message); }
  }
  if (P.fields && a.fields !== false) { try { out.fields = await P.fields(pdf); } catch (e) { out.errors.push("fields: " + e.message); } }
  if (P.layers) { try { out.layers = P.layers(pdf); } catch (e) { out.errors.push("layers: " + e.message); } }
  if (P.outline) {
    try {
      var flat = function (items, d) { var o = []; items.forEach(function (it) { o.push([it.title, it.page, d]); o = o.concat(flat(it.kids || [], d + 1)); }); return o; };
      out.outline = flat(P.outline(pdf), 0);
    } catch (e) { out.errors.push("outline: " + e.message); }
  }
  if (P.annots && a.annots !== false) {
    out.annots = [];
    for (i = 0; i < np; i++) {
      try {
        out.annots.push((await P.annots(pdf, i)).map(function (an) {
          return { sub: an.sub, hidden: an.hidden, ap: !!an.apRef, contents: an.contents, author: an.author, opacity: an.opacity,
            field: an.field ? { name: an.field.name, type: an.field.type, value: an.field.value, checked: an.field.checked, comb: an.field.comb, maxLen: an.field.maxLen } : null };
        }));
      } catch (e) { out.errors.push("annots " + i + ": " + e.message); }
    }
  }
  function measure(cv, pg, r) {
    var g = cv.getContext("2d"), s = cv.width / (pg.rotate === 90 || pg.rotate === 270 ? pg.h : pg.w);
    var x0 = r[0] * s, x1 = r[2] * s, y0 = cv.height - r[3] * s, y1 = cv.height - r[1] * s;
    var w = Math.max(1, Math.round(x1 - x0)), h = Math.max(1, Math.round(y1 - y0));
    var d = g.getImageData(Math.round(x0), Math.round(y0), w, h).data, c = 0, n = 0, R = 0, G = 0, B = 0, white = 0;
    for (var k = 0; k < d.length; k += 4) { n++; R += d[k]; G += d[k + 1]; B += d[k + 2]; if (d[k] + d[k + 1] + d[k + 2] < 300) c++; if (d[k] > 245 && d[k + 1] > 245 && d[k + 2] > 245) white++; }
    return { dark: Math.round(1000 * c / n) / 10, nonwhite: Math.round(1000 * (n - white) / n) / 10, rgb: [Math.round(R / n), Math.round(G / n), Math.round(B / n)] };
  }
  function hash(cv) {
    var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, h = 2166136261;
    for (var k = 0; k < d.length; k += 4) { h ^= d[k] + 3 * d[k + 1] + 7 * d[k + 2]; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16) + ":" + cv.width + "x" + cv.height;
  }
  out.draw = {};
  if (a.draw !== false && P.pageDraw) {
    var dp = a.drawPages || [0];
    for (var j = 0; j < dp.length; j++) {
      var pi = dp[j];
      if (pi >= pdf.count) continue;
      try {
        var t2 = performance.now(), cv = await P.pageDraw(pdf, pi, { scale: a.scale || 1 });
        out.draw[pi] = { hash: hash(cv), ms: Math.round(performance.now() - t2), regions: (a.regions && a.regions[pi] || []).map(function (r) { return measure(cv, pdf.pages[pi], r); }) };
        if (a.png === pi) out.png = cv.toDataURL("image/png");
      } catch (e) { out.errors.push("pageDraw " + pi + ": " + e.message); }
    }
  }
  if (a.pageImage) {
    try {
      var im = await P.pageImage(pdf, a.page || 0, { maxSide: 1200 });
      out.pageImage = im ? a.pageImage.map(function (r) { return measure(im, pdf.pages[a.page || 0], r); }) : null;
    } catch (e) { out.errors.push("pageImage: " + e.message); }
  }
  out.ms = Math.round(performance.now() - t0);
  return out;
}
