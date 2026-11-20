// excel_convert.js -- the second Excel reviewer's own reading of Excel's CONVERT (1.24.29), written from Microsoft's
// CONVERT page (its unit names, case and all, its metric and binary prefixes) and the exact definitions of NIST SP 811
// (the international pound 0.45359237 kg, the inch 2.54 cm, the US gallon 231 cubic inches, the pound-force
// 4.4482216152605 N, the IT calorie 4.1868 J and the thermochemical 4.184 J, the IT BTU 1055.05585262 J). It does not
// read Lantern's code: it is what the cases are judged by. excel(v, from, to) -> number, or "#N/A".
"use strict";
var LB = 0.45359237, IN = 0.0254, FT = 0.3048, LBF = 4.4482216152605, GAL = 231 * IN * IN * IN * 1000;   // litres
var HP = 550 * FT * LBF;
// [factor to the group's base unit, the power a metric prefix takes before it (0: none; km2 is a million m2), 1: a
// binary prefix may go before it too]
var U = {
  mass: { g: [0.001, 1], sg: [LBF / FT], lbm: [LB], u: [1.66053906660e-27, 1], ozm: [LB / 16], grain: [LB / 7000], cwt: [100 * LB], shweight: [100 * LB],
    uk_cwt: [112 * LB], lcwt: [112 * LB], hweight: [112 * LB], stone: [14 * LB], ton: [2000 * LB], uk_ton: [2240 * LB], LTON: [2240 * LB], brton: [2240 * LB] },
  distance: { m: [1, 1], mi: [1609.344], Nmi: [1852], "in": [IN], ft: [FT], yd: [0.9144], ang: [1e-10, 1], ell: [45 * IN], ly: [9460730472580800],
    parsec: [3.0856775814913673e16], pc: [3.0856775814913673e16], Picapt: [IN / 72], Pica: [IN / 72], pica: [IN / 6], survey_mi: [5280 * 1200 / 3937] },
  time: { yr: [365.25 * 86400], day: [86400], d: [86400], hr: [3600], mn: [60], min: [60], sec: [1, 1], s: [1, 1] },
  pressure: { Pa: [1, 1], p: [1, 1], atm: [101325, 1], at: [101325, 1], mmHg: [133.322387415, 1], psi: [LBF / (IN * IN)], Torr: [101325 / 760] },
  force: { N: [1, 1], dyn: [1e-5, 1], dy: [1e-5, 1], lbf: [LBF] },
  energy: { J: [1, 1], e: [1e-7, 1], c: [4.184, 1], cal: [4.1868, 1], eV: [1.602176634e-19, 1], ev: [1.602176634e-19, 1], HPh: [HP * 3600], hh: [HP * 3600],
    Wh: [3600, 1], wh: [3600, 1], flb: [FT * LBF], BTU: [1055.05585262], btu: [1055.05585262] },
  power: { HP: [HP], h: [HP], PS: [75 * 9.80665], W: [1, 1], w: [1, 1] },
  magnetism: { T: [1, 1], ga: [1e-4, 1] },
  volume: { tsp: [GAL / 768], tspm: [0.005], tbs: [GAL / 256], oz: [GAL / 128], cup: [GAL / 16], pt: [GAL / 8], us_pt: [GAL / 8], uk_pt: [0.56826125],
    qt: [GAL / 4], uk_qt: [1.1365225], gal: [GAL], uk_gal: [4.54609], l: [1, 1], L: [1, 1], lt: [1, 1], barrel: [42 * GAL], bushel: [35.23907016688],
    GRT: [100 * FT * FT * FT * 1000], regton: [100 * FT * FT * FT * 1000], MTON: [40 * FT * FT * FT * 1000] },
  area: { uk_acre: [4046.8564224], us_acre: [43560 * Math.pow(1200 / 3937, 2)], ar: [100, 1], ha: [10000], Morgen: [2500] },
  information: { bit: [1, 1, 1], "byte": [8, 1, 1] },
  speed: { admkn: [6080 * FT / 3600], kn: [1852 / 3600], "m/h": [1 / 3600, 1], "m/hr": [1 / 3600, 1], "m/s": [1, 1], "m/sec": [1, 1], mph: [1609.344 / 3600] }
};
var LEN = { m: 1, ang: 1e-10, ft: FT, "in": IN, ly: 9460730472580800, mi: 1609.344, yd: 0.9144, Nmi: 1852, Picapt: IN / 72, Pica: IN / 72 };
Object.keys(LEN).forEach(function (k) {
  var p = k === "m" || k === "ang" ? 1 : 0;
  U.area[k + "2"] = U.area[k + "^2"] = [LEN[k] * LEN[k], p ? 2 : 0];
  U.volume[k + "3"] = U.volume[k + "^3"] = [LEN[k] * LEN[k] * LEN[k] * 1000, p ? 3 : 0];
});
var TEMP = { C: "C", cel: "C", F: "F", fah: "F", K: "K", kel: "K", Rank: "R", Reau: "Re" };
var PRE = { Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1, e: 1e1, d: 1e-1, c: 1e-2, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24 };
var BIN = { Yi: Math.pow(2, 80), Zi: Math.pow(2, 70), Ei: Math.pow(2, 60), Pi: Math.pow(2, 50), Ti: Math.pow(2, 40), Gi: Math.pow(2, 30), Mi: Math.pow(2, 20), ki: 1024 };
function plain(n) {
  if (TEMP[n]) return { g: "temperature", t: TEMP[n], f: 1 };
  for (var g in U) if (Object.prototype.hasOwnProperty.call(U[g], n)) return { g: g, f: U[g][n][0], p: U[g][n][1] || 0, bin: !!U[g][n][2] };
  return null;
}
function unit(n) {
  n = String(n);
  var x = plain(n), b;
  if (x) return x;
  if (n.length > 2 && BIN[n.slice(0, 2)] && (b = plain(n.slice(2))) && b.bin) return { g: b.g, f: b.f * BIN[n.slice(0, 2)] };
  var tries = [];
  if (n.length > 2 && n.slice(0, 2) === "da") tries.push([10, n.slice(2)]);
  if (n.length > 1 && PRE[n.charAt(0)]) tries.push([PRE[n.charAt(0)], n.slice(1)]);
  for (var i = 0; i < tries.length; i++) {
    b = plain(tries[i][1]);
    if (!b) continue;
    if (b.g === "temperature") { if (b.t === "K") return { g: "temperature", t: "K", f: tries[i][0] }; continue; }
    if (b.p) return { g: b.g, f: b.f * Math.pow(tries[i][0], b.p) };
  }
  return null;
}
function toK(v, t) { return t === "C" ? v + 273.15 : t === "F" ? (v - 32) * 5 / 9 + 273.15 : t === "R" ? v * 5 / 9 : t === "Re" ? v * 1.25 + 273.15 : v; }
function fromK(k, t) { return t === "C" ? k - 273.15 : t === "F" ? (k - 273.15) * 9 / 5 + 32 : t === "R" ? k * 9 / 5 : t === "Re" ? (k - 273.15) * 0.8 : k; }
function excel(v, from, to) {
  if (typeof v !== "number" || isNaN(v)) return "#VALUE!";
  var a = unit(from), b = unit(to);
  if (!a || !b || a.g !== b.g) return "#N/A";
  var r = a.g === "temperature" ? fromK(toK(v * a.f, a.t), b.t) / b.f : v * a.f / b.f;
  return Number(r.toPrecision(15));
}
module.exports = { excel: excel, unit: unit };
