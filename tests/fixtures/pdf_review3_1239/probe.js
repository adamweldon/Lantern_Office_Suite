// probe.js -- evaluated in the page (Playwright): opens one PDF with Lantern.pdf and returns what Lantern made of it:
// title, lock, text of each page (with ownLetters and notes), fields, layers, bookmarks, links, and the drawn page
// measured in regions given in PDF points (ink, colour, and how much of the region is see-through). Works on 1.24.38
// too (what it lacks is left out). After pdf_review2_1239/probe.js.
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
  out.trailerKeys = pdf.doc.trailer ? Object.keys(pdf.doc.trailer).sort() : null;
  var np = Math.min(pdf.count, a.maxPages || 6);
  out.texts = []; out.own = []; out.notes = [];
  if (a.text !== false) for (var i = 0; i < np; i++) {
    try { var t1 = performance.now(), pt = await P.pageText(pdf, i); out.texts.push(pt.text); out.own.push(pt.ownLetters); out.notes.push(pt.notes || null); out.textMs = Math.round(performance.now() - t1); }
    catch (e) { out.texts.push("ERROR: " + e.message); out.errors.push("pageText " + i + ": " + e.message); }
  }
  if (P.fields && a.fields !== false) { try { out.fields = await P.fields(pdf); } catch (e) { out.errors.push("fields: " + e.message); } }
  if (P.layers) { try { out.layers = P.layers(pdf); } catch (e) { out.errors.push("layers: " + e.message); } }
  if (P.outline) {
    try {
      var flat = function (items, d) { var o = []; items.forEach(function (it) { o.push([it.title, it.page, d]); o = o.concat(flat(it.kids || [], d + 1)); }); return o; };
      out.outline = flat(P.outline(pdf), 0);
    } catch (e) { out.errors.push("outline: " + e.message); }
  }
  if (P.links && a.links) {
    out.links = [];
    for (i = 0; i < np; i++) { try { out.links.push((await P.links(pdf, i)).map(function (l) { return { page: l.page, uri: l.uri }; })); } catch (e) { out.errors.push("links " + i + ": " + e.message); } }
  }
  function measure(cv, pg, r) {
    var g = cv.getContext("2d"), s = cv.width / (pg.rotate === 90 || pg.rotate === 270 ? pg.h : pg.w);
    var x0 = r[0] * s, x1 = r[2] * s, y0 = cv.height - r[3] * s, y1 = cv.height - r[1] * s;
    var w = Math.max(1, Math.round(x1 - x0)), h = Math.max(1, Math.round(y1 - y0));
    var d = g.getImageData(Math.round(x0), Math.round(y0), w, h).data, c = 0, n = 0, R = 0, G = 0, B = 0, white = 0, clear = 0;
    for (var k = 0; k < d.length; k += 4) { n++; R += d[k]; G += d[k + 1]; B += d[k + 2]; if (d[k + 3] < 250) clear++; if (d[k] + d[k + 1] + d[k + 2] < 300) c++; if (d[k] > 245 && d[k + 1] > 245 && d[k + 2] > 245) white++; }
    return { dark: Math.round(1000 * c / n) / 10, nonwhite: Math.round(1000 * (n - white) / n) / 10, rgb: [Math.round(R / n), Math.round(G / n), Math.round(B / n)], clear: Math.round(1000 * clear / n) / 10 };
  }
  function hash(cv) {
    var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, h = 2166136261, clear = 0;
    for (var k = 0; k < d.length; k += 4) { h ^= d[k] + 3 * d[k + 1] + 7 * d[k + 2] + 11 * d[k + 3]; h = Math.imul(h, 16777619); if (d[k + 3] < 255) clear++; }
    return (h >>> 0).toString(16) + ":" + cv.width + "x" + cv.height + (clear ? ":clear" + clear : "");
  }
  out.draw = {};
  if (a.draw !== false && P.pageDraw) {
    var dp = a.drawPages || [0];
    for (var j = 0; j < dp.length; j++) {
      var pi = dp[j];
      if (pi >= pdf.count) continue;
      try {
        var t2 = performance.now(), o2 = Object.assign({ scale: a.scale || 1 }, a.drawOpts || {}), cv = await P.pageDraw(pdf, pi, o2);
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
