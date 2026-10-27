#!/usr/bin/env node
// make_places.js -- builds Lantern's place lists (1.14.0).
//
//   NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson
//   curl -LO $NE/ne_10m_populated_places_simple.geojson
//   curl -LO $NE/ne_10m_admin_0_countries.geojson
//   npm i --no-save all-the-cities@3.1.0
//   node tools/make_places.js ne_10m_populated_places_simple.geojson ne_10m_admin_0_countries.geojson
//
// Writes:
//   src/lantern.inner.html   its PLACES_DATA module, replaced in place,
//                            from Natural Earth 5.1.2 -- PUBLIC DOMAIN, so the
//                            single file stays CC0: about 7,300 towns and
//                            cities (every capital, every region capital, the
//                            big towns), and the countries
//   site/places.txt          every town of 1,000 people and up (GeoNames
//                            cities1000, about 135,000), most populous first.
//                            NOT public domain: GeoNames is CC BY 4.0, so it
//                            is a separate file that carries its own credit
//                            line; the kit and the website serve it beside
//                            Lantern and the Places module reads it.
//
// Sources and licences (also in Lantern's Sources & licences page):
//   Natural Earth (naturalearthdata.com), public domain;
//   GeoNames (geonames.org), Creative Commons Attribution 4.0 -- through the
//   all-the-cities npm package (MIT), which packs GeoNames' cities1000.
// Kept out: GeoNames' historical, abandoned and destroyed places (PPLH, PPLQ,
// PPLW) and Natural Earth's "Historic place" points.
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.dirname(__dirname);
if (process.argv.length < 4) { console.log("usage: node tools/make_places.js <ne_10m_populated_places_simple.geojson> <ne_10m_admin_0_countries.geojson>"); process.exit(2); }
function clean(s) { return String(s == null ? "" : s).replace(/\x60/g, "\x27").replace(/[\t\n\r|;]+/g, " ").replace(/\s+/g, " ").trim(); }   // Inch`on -> Inch'on
var US = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
var USCODE = {};
Object.keys(US).forEach(function (k) { USCODE[US[k]] = k; });
function fold(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function line(r) { return [r.name, r.cc, r.admin, r.lat.toFixed(3), r.lon.toFixed(3), r.pop, r.cap ? "C" : "", r.alt || ""].join("\t").replace(/\t+$/, ""); }

// --- Natural Earth: countries ------------------------------------------------
var C0 = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).features.map(function (f) { return f.properties; });
var RANK = { "Sovereign country": 0, "Country": 1, "Sovereignty": 2, "Dependency": 3, "Disputed": 4, "Indeterminate": 5, "Lease": 6 };
function rank(c) { return RANK.hasOwnProperty(c.TYPE) ? RANK[c.TYPE] : 9; }
// where Natural Earth has no ISO code: Somaliland's towns in Somalia and
// Northern Cyprus's in Cyprus, as GeoNames and the UN list them
var A3 = { SOL: "SO", CYN: "CY" }, byCC = {}, NOCAP = { SOL: 1, CYN: 1 };
// A town is "the capital" when Natural Earth marks it the capital (adm0cap),
// except in these countries -- more than one capital, or Natural Earth also
// marks a former one (Johannesburg, Abidjan, Yangon) or misses the official
// one (Dodoma, Porto-Novo): their capitals, by their constitutions
var CAPITALS = { ZA: ["Pretoria", "Cape Town", "Bloemfontein"], BO: ["Sucre", "La Paz"], CI: ["Yamoussoukro"], MM: ["Naypyidaw"],
  NL: ["Amsterdam"], BJ: ["Porto-Novo", "Cotonou"], TZ: ["Dodoma"], LK: ["Sri Jayawardenepura Kotte", "Colombo"], MY: ["Kuala Lumpur", "Putrajaya"], SS: ["Juba"], EH: [] };
// names changed since Natural Earth 5.1.2, or given there in the local form
// only (the old name is kept as another name)
var RENAME = { "Nur-Sultan": "Astana", "K\u00f8benhavn": "Copenhagen" };
C0.forEach(function (c) {
  var cc = /^[A-Z]{2}$/.test(c.ISO_A2_EH) ? c.ISO_A2_EH : /^[A-Z]{2}$/.test(c.ISO_A2) ? c.ISO_A2 : "";
  if (!cc) return;
  A3[c.ADM0_A3] = A3[c.ADM0_A3] || cc; A3[c.SOV_A3] = A3[c.SOV_A3] || cc;
  var o = byCC[cc];
  // one entry a code: the country itself, not its outlying bits (Australia, not Coral Sea Is.)
  if (o && (rank(o) < rank(c) || (rank(o) === rank(c) && (o.POP_EST || 0) >= (c.POP_EST || 0)))) return;
  byCC[cc] = c;
});
// --- Natural Earth: towns ---------------------------------------------------
var P = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).features.map(function (f) { return f.properties; });
var capital = {}, small = [];
P.forEach(function (p) {
  if (/^historic/i.test(p.featurecla)) return;
  var cc = /^[A-Z]{2}$/.test(p.iso_a2) ? p.iso_a2 : A3[p.adm0_a3] || A3[p.sov_a3] || "";
  if (!cc) return;
  var name = clean(p.name), alt = [];
  if (RENAME[name]) { alt.push(name); name = RENAME[name]; }
  // "Washington, D.C." -> Washington (DC); commas split a typed name from its region
  if (name.indexOf(",") >= 0) { alt.push(name.replace(/,\s*/g, " ")); name = name.split(",")[0].trim(); }
  [p.nameascii, p.namealt].forEach(function (a) {
    // (not a name cut short in the source: "Ciudad de M")
    String(a || "").split(/\s*[|,]\s*/).forEach(function (x) { x = clean(x); if (x && !/\s\S$/.test(x) && fold(x) !== fold(name) && alt.every(function (y) { return fold(y) !== fold(x); })) alt.push(x); });
  });
  var admin = clean(p.adm1name);
  if (cc === "US") admin = USCODE[admin] || admin;
  var cap = CAPITALS[cc] ? CAPITALS[cc].indexOf(name) >= 0 : p.adm0cap === 1 && !NOCAP[p.adm0_a3];
  var r = { name: name, cc: cc, admin: admin, lat: p.latitude, lon: p.longitude, pop: p.pop_max || p.pop_min || 0, cap: cap, alt: alt.join(";") };
  if (cap && !capital[cc]) capital[cc] = name;
  small.push(r);
});
small.sort(function (a, b) { return b.pop - a.pop || (a.name < b.name ? -1 : 1); });
// countries: code|name|other names|capital|continent. Other names in Latin
// letters, and only names no other country also goes by.
// the name shown: NAME, unless it is cut short ("Dem. Rep. Congo") or the long
// one is shorter ("United States" for "United States of America")
function shown(c) { var n = clean(c.NAME), l = clean(c.NAME_LONG); return l && (/\./.test(n) || l.length < n.length) ? l : n; }
var claim = {};
Object.keys(byCC).forEach(function (cc) { claim[fold(shown(byCC[cc]))] = cc; claim[fold(byCC[cc].NAME)] = cc; });
var otherNames = {};
Object.keys(byCC).forEach(function (cc) {
  var c = byCC[cc];
  // (not ABBREV: "Ger.", "S.K." are cut-short labels, not names people type)
  ["NAME", "NAME_LONG", "ADMIN", "FORMAL_EN", "NAME_ALT", "NAME_CIAWF", "NAME_SORT", "BRK_NAME", "GEOUNIT", "NAME_DE", "NAME_ES", "NAME_FR", "NAME_PT", "NAME_IT", "NAME_NL", "NAME_ID", "NAME_TR", "NAME_VI", "NAME_SV", "NAME_PL"]
    .forEach(function (k) {
      var v = clean(c[k]), f = fold(v);
      if (!v || !f || /[^\u0000-\u024f]/.test(v) || f === fold(shown(c)) || f.length < 2 || /,/.test(v)) return;
      if (claim[f] && claim[f] !== cc) return;
      (otherNames[f] = otherNames[f] || {})[cc] = v;
    });
});
var aliases = {};
Object.keys(otherNames).forEach(function (f) {
  var ccs = Object.keys(otherNames[f]);
  if (ccs.length === 1) (aliases[ccs[0]] = aliases[ccs[0]] || []).push(otherNames[f][ccs[0]]);
});
var countries = Object.keys(byCC).sort().map(function (cc) {
  var c = byCC[cc], seen = {}, al = (aliases[cc] || []).filter(function (a) { var f = fold(a); if (seen[f]) return false; seen[f] = 1; return true; });
  return [cc, shown(c), al.join(";"),
    CAPITALS[cc] ? CAPITALS[cc].join(" / ") : capital[cc] || "", clean(c.CONTINENT)].join("|");
});

// --- GeoNames: site/places.txt --------------------------------------------------
var cities = require("all-the-cities"), DROP = { PPLH: 1, PPLQ: 1, PPLW: 1 };
var rows = cities.filter(function (c) { return !DROP[c.featureCode] && c.loc && c.loc.coordinates; })
  .sort(function (a, b) { return b.population - a.population || (a.name < b.name ? -1 : 1); })
  .map(function (c) {
    return { name: clean(c.name), cc: c.country, admin: clean(c.adminCode), lat: c.loc.coordinates[1], lon: c.loc.coordinates[0],
      pop: c.population, cap: c.featureCode === "PPLC" };
  });
var HEAD = ["# Lantern place list: towns and cities of the world of 1,000 people and up, most populous first.",
  "# Data from GeoNames (https://www.geonames.org), licensed under Creative Commons Attribution 4.0",
  "# (https://creativecommons.org/licenses/by/4.0/), via the all-the-cities package (cities1000).",
  "# Keep this credit with the file. (Lantern itself is CC0; this file is not, so it is kept apart.)",
  "# name<TAB>country code<TAB>region code<TAB>latitude<TAB>longitude<TAB>population<TAB>C for a capital",
  "# Built " + new Date().toISOString().slice(0, 10) + " by tools/make_places.js."];
var all = HEAD.concat(rows.map(line)).join("\n") + "\n";
fs.writeFileSync(path.join(ROOT, "site", "places.txt"), all);

function esc(s) {   // the file rules: ASCII only, no "</" in strings, no backquotes (rule 6 reads them as template literals)
  return JSON.stringify(s).replace(/[\u0080-\uffff\x60]/g, function (ch) { return "\\u" + ("000" + ch.charCodeAt(0).toString(16)).slice(-4); }).replace(/<\//g, "<\\u002F");
}
var mod = [
  "// ===========================================================================",
  "// MODULE: PLACES_DATA - START",
  "// Depends: (none)",
  "// Exports: Lantern.placesData = {rows, countries, source, people, count}",
  "// ===========================================================================",
  "// Data only. " + small.length + " towns and cities -- every capital, every region",
  "// capital and the big towns -- most populous first: name, country code, region,",
  "// latitude, longitude, people (the urban area), C for a capital, other names",
  "// -- tab-separated, one a line. Countries: code|name|other names|capital|",
  "// continent. From Natural Earth 5.1.2 (naturalearthdata.com), which is in the",
  "// public domain, so this file stays CC0. Built by tools/make_places.js; the",
  "// kit and the website also serve every town of 1,000 and up in places.txt",
  "// (GeoNames, CC BY 4.0 -- a separate file, with its credit).",
  "(function () {",
  "  window.Lantern = window.Lantern || {};",
  "  window.Lantern.placesData = {",
  "    source: \"Natural Earth (naturalearthdata.com), public domain\",",
  "    people: \"the urban area\",",
  "    count: " + small.length + ",",
  "    countries: " + esc(countries.join("\n")) + ",",
  "    rows: " + esc(small.map(line).join("\n")),
  "  };",
  "})();",
  "// ===========================================================================",
  "// MODULE: PLACES_DATA - END",
  "// ==========================================================================="].join("\n");
// into src/lantern.inner.html, in place of the PLACES_DATA module there
var SRC = path.join(ROOT, "src", "lantern.inner.html"), src = fs.readFileSync(SRC, "utf8");
var A = "// ===========================================================================\n// MODULE: PLACES_DATA - START",
  B = "// MODULE: PLACES_DATA - END\n// ===========================================================================";
var a = src.indexOf(A), b = src.indexOf(B);
if (a < 0 || b < a) { console.log("src/lantern.inner.html has no PLACES_DATA module to replace"); process.exit(1); }
fs.writeFileSync(SRC, src.slice(0, a) + mod + src.slice(b + B.length));
console.log("site/places.txt: " + rows.length + " places, " + (all.length / 1048576).toFixed(1) + " MB (GeoNames, CC BY 4.0); PLACES_DATA: " + small.length +
  " places, " + (mod.length / 1024).toFixed(0) + " KB, " + countries.length + " countries (Natural Earth, public domain)");
