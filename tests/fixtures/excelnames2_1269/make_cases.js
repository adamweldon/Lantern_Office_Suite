// make_cases.js -- writes cases.json, the second Excel reviewer's cases for 1.24.29 (CONVERT and the mended functions).
// Written from Microsoft's documentation of each function and the rules as given to the reviewer, not from Lantern's
// code. Each case is checked three ways by replay.js: in Chat (Lantern.formula.evaluate), in a sheet
// (Lantern.sheetDocs.compute) and saved (Lantern.xlsx.write), where the saved formula is read back as Excel would read it
// (excel_convert.js) and, with --lo, recalculated by LibreOffice.
//
// A conversion case: [id, value, from, to, spec]
//   spec.x = [a, b]: what the case means in Excel's names (expected = Excel's CONVERT(value, a, b)); x: 1 means the
//            names as written. The saved formula must be one Excel works out to the same number.
//   spec.n = number: expected where Excel has no name for a unit (bar, kgf, week); saved as its value, with a note
//   spec.err = "#N/A" | "#VALUE!": expected error (in a sheet; Chat says it cannot)
//   spec.why: the reason, where the case is not plain Excel
// node make_cases.js > cases.json
"use strict";
var X = require("./excel_convert.js").excel;
var cases = [];
function conv(group, list) {
  list.forEach(function (c) {
    var id = c[0], v = c[1], from = c[2], to = c[3], s = c[4] || {}, o = { id: id, group: group };
    o.f = "CONVERT(" + v + ",\x22" + from + "\x22,\x22" + to + "\x22)";
    if (s.x) {
      var xs = s.x === 1 ? [from, to] : s.x;
      o.excel = "CONVERT(" + v + ",\x22" + xs[0] + "\x22,\x22" + xs[1] + "\x22)";
      o.expect = X(v, xs[0], xs[1]);
      o.save = "formula";
    } else if (s.n !== undefined) { o.expect = s.n; o.save = "value"; }
    else if (s.err) { o.expect = s.err; o.save = "any"; }
    if (s.tol) o.tol = s.tol;
    if (s.why) o.why = s.why;
    cases.push(o);
  });
}
var GAL = 3.785411784, LB = 0.45359237, PSI = 4.4482216152605 / (0.0254 * 0.0254);

conv("cooking", [
  ["c01", 1, "cup", "ml", { x: 1 }], ["c02", 250, "ml", "cup", { x: 1 }], ["c03", 2, "tbs", "ml", { x: 1 }], ["c04", 1, "tsp", "ml", { x: 1 }],
  ["c05", 3, "tsp", "tbs", { x: 1 }], ["c06", 1, "cup", "tbs", { x: 1 }],
  ["c07", 8, "oz", "ml", { x: 1, why: "Excel's oz is the US fluid ounce" }],
  ["c08", 8, "oz", "g", { x: ["ozm", "g"], why: "oz beside grams: Excel's reading is of two kinds (#N/A), so Lantern's other reading, the ounce of weight" }],
  ["c09", 500, "g", "oz", { x: ["g", "ozm"], why: "the same, the other way" }],
  ["c10", 1, "lb", "oz", { x: ["lbm", "ozm"], why: "lb is Lantern's pound; oz beside it is the ounce of weight" }],
  ["c11", 16, "oz", "lb", { x: ["ozm", "lbm"] }],
  ["c12", 2, "cups", "ml", { x: ["cup", "ml"], why: "plural of Excel's cup" }], ["c13", 4, "cups", "l", { x: ["cup", "l"] }],
  ["c14", 1, "l", "cup", { x: 1 }], ["c15", 350, "F", "C", { x: 1 }], ["c16", 180, "C", "F", { x: 1 }], ["c17", 200, "cel", "fah", { x: 1 }],
  ["c18", 425, "fah", "C", { x: 1 }], ["c19", 1, "pt", "cup", { x: 1 }], ["c20", 1, "qt", "cup", { x: 1 }], ["c21", 1, "gal", "cup", { x: 1 }],
  ["c22", 1, "uk_pt", "ml", { x: 1 }], ["c23", 1, "tspm", "ml", { x: 1 }], ["c24", 2, "tspm", "tsp", { x: 1 }], ["c25", 100, "g", "ozm", { x: 1 }],
  ["c26", 12, "ozm", "g", { x: 1 }], ["c27", 1.5, "kg", "lb", { x: ["kg", "lbm"] }], ["c28", 2, "lbs", "kg", { x: ["lbm", "kg"] }],
  ["c29", 3, "pounds", "kg", { x: ["lbm", "kg"] }], ["c30", 750, "grams", "lb", { x: ["g", "lbm"] }],
  ["c31", 1, "kilograms", "pounds", { x: ["kg", "lbm"] }], ["c32", 6, "fl oz", "ml", { x: ["oz", "ml"] }],
  ["c33", 1, "cup", "fl oz", { x: ["cup", "oz"] }], ["c34", 1, "cup", "oz", { x: 1 }],
  ["c35", 2, "cup", "g", { err: "#N/A", why: "a cup is a volume and a gram a weight in either reading" }],
  ["c36", 1, "tbs", "tsp", { x: 1 }], ["c37", 500, "ml", "pt", { x: 1 }], ["c38", 1, "l", "qt", { x: 1 }], ["c39", 250, "mL", "cup", { x: 1 }],
  ["c40", 5, "cl", "ml", { x: 1 }], ["c41", 3, "dl", "ml", { x: 1 }],
  ["c42", 1, "tablespoon", "ml", { err: "#N/A", why: "neither Excel nor Lantern has the word (a gap, not a disagreement)" }],
  ["c43", 1, "stick", "g", { err: "#N/A" }],
  ["c44", 8, "ounces", "g", { x: ["ozm", "g"], why: "Lantern reads ounces as weight" }], ["c45", 1, "ounce", "g", { x: ["ozm", "g"] }],
  ["c46", 20, "ounces", "kg", { x: ["ozm", "kg"] }], ["c47", 0, "C", "F", { x: 1 }], ["c48", -18, "C", "F", { x: 1 }], ["c49", 165, "F", "C", { x: 1 }],
  ["c50", 100, "C", "K", { x: 1 }], ["c51", 212, "F", "K", { x: 1 }], ["c52", 37, "celsius", "fahrenheit", { x: ["C", "F"] }],
  ["c53", 2, "cup", "tsp", { x: 1 }], ["c54", 1, "pt", "ml", { x: 1 }], ["c55", 1, "uk_pt", "pt", { x: 1 }]
]);
conv("fuel", [
  ["f01", 40, "l", "gal", { x: 1 }], ["f02", 15, "gal", "l", { x: 1 }], ["f03", 12, "uk_gal", "l", { x: 1 }], ["f04", 1, "gal", "uk_gal", { x: 1 }],
  ["f05", 10, "gallons", "litres", { x: ["gal", "l"] }], ["f06", 50, "litres", "gallons", { x: ["l", "gal"] }],
  ["f07", 20, "imperial gallons", "l", { x: ["uk_gal", "l"] }], ["f08", 60, "L", "uk_gal", { x: 1 }], ["f09", 5, "US gallons", "l", { x: ["gal", "l"] }],
  ["f10", 1, "barrel", "l", { x: 1 }], ["f11", 1, "barrel", "gal", { x: 1 }], ["f12", 100, "km", "mi", { x: 1 }], ["f13", 300, "mi", "km", { x: 1 }],
  ["f14", 1, "lt", "gal", { x: 1 }], ["f15", 45, "liters", "uk_gal", { x: ["l", "uk_gal"] }],
  ["f16", 8, "imperial pints", "gallons", { x: ["uk_pt", "uk_gal"], why: "Lantern reads a plain gallon beside an imperial measure as the imperial gallon (1.24.17 review: 8 imperial pints are 1 gallon)" }],
  ["f17", 1, "imperial gallons", "quarts", { x: ["uk_gal", "uk_qt"], why: "Lantern reads a plain quart beside an imperial measure as the imperial quart" }],
  ["f18", 2, "uk_gal", "gallons", { x: ["uk_gal", "gal"], why: "Lantern does not know uk_gal; a plain gallon is the US one" }],
  ["f19", 1, "m3", "l", { x: 1 }], ["f20", 55, "l", "gallon", { x: ["l", "gal"] }], ["f21", 1, "qt", "l", { x: 1 }], ["f22", 4, "quarts", "l", { x: ["qt", "l"] }],
  ["f23", 1, "gal", "qt", { x: 1 }], ["f24", 1, "uk_gal", "uk_pt", { x: 1 }], ["f25", 1, "uk_qt", "uk_pt", { x: 1 }],
  ["f26", 18, "UK gallons", "litres", { x: ["uk_gal", "l"] }], ["f27", 30, "litre", "US gallon", { x: ["l", "gal"] }],
  ["f28", 1, "imperial gallons", "fl oz", { n: 160, why: "a plain fluid ounce beside an imperial measure is Lantern's imperial one (Excel has none)" }],
  ["f29", 8, "UK pints", "gallons", { x: ["uk_pt", "uk_gal"], why: "as f16" }], ["f30", 1, "imperial gallon", "pints", { x: ["uk_gal", "uk_pt"] }],
  ["f31", 4, "imperial quarts", "gallons", { x: ["uk_qt", "uk_gal"], why: "as f17" }],
  ["f32", 1, "gallons", "imperial gallons", { x: ["gal", "uk_gal"], why: "a measure beside its own imperial one stays the US one (Lantern, third review of 1.24.17)" }],
  ["f33", 1, "imperial gallons", "qt", { x: ["uk_gal", "qt"], why: "qt is Excel's US quart wherever it stands" }]
]);
conv("pressure", [
  ["p01", 32, "psi", "kPa", { x: 1 }], ["p02", 2.2, "bar", "psi", { n: 2.2e5 / PSI }], ["p03", 250, "kPa", "psi", { x: 1 }],
  ["p04", 35, "psi", "bar", { n: 35 * PSI / 1e5 }], ["p05", 1, "atm", "psi", { x: 1 }], ["p06", 30, "psi", "atm", { x: 1 }],
  ["p07", 2.4, "bar", "kPa", { n: 240 }], ["p08", 101.325, "kPa", "atm", { x: 1 }], ["p09", 1, "atm", "mmHg", { x: 1, why: "mmHg as NIST's conventional 133.322387415 Pa; Excel's own last digits not checked" }],
  ["p10", 760, "Torr", "atm", { x: 1 }], ["p11", 760, "torr", "atm", { x: ["Torr", "atm"] }], ["p12", 120, "mmHg", "kPa", { x: 1 }],
  ["p13", 1013.25, "hPa", "atm", { x: 1 }], ["p14", 1, "MPa", "psi", { x: 1 }], ["p15", 36, "psi", "Pa", { x: 1 }], ["p16", 1, "at", "Pa", { x: 1, why: "Excel's at is the standard atmosphere" }],
  ["p17", 3000, "psi", "MPa", { x: 1 }], ["p18", 1, "kgf", "N", { n: 9.80665 }], ["p19", 100, "lbf", "N", { x: 1 }], ["p20", 1, "kN", "lbf", { x: 1 }],
  ["p21", 29.92, "inHg", "hPa", { err: "#N/A" }], ["p22", 1, "bar", "atm", { n: 1e5 / 101325 }], ["p23", 14.7, "psi", "bar", { n: 14.7 * PSI / 1e5 }],
  ["p24", 2.5, "bar", "kPa", { n: 250 }], ["p25", 44, "psi", "kPa", { x: 1 }]
]);
conv("shipping", [
  ["s01", 25, "lbm", "kg", { x: 1 }], ["s02", 50, "kg", "lb", { x: ["kg", "lbm"] }], ["s03", 1, "ton", "kg", { x: 1 }], ["s04", 1, "ton", "lbm", { x: 1 }],
  ["s05", 2, "tons", "kg", { x: ["ton", "kg"], why: "plural of Excel's ton" }], ["s06", 3, "tonnes", "lb", { x: ["Mg", "lbm"] }],
  ["s07", 1, "tonne", "ton", { x: ["Mg", "ton"] }], ["s08", 1, "ton", "tonne", { x: ["ton", "Mg"] }],
  ["s09", 1, "ton", "kilograms", { x: ["ton", "kg"], why: "ton is Excel's short ton beside any name" }], ["s10", 1, "uk_ton", "kg", { x: 1 }],
  ["s11", 1, "LTON", "lbm", { x: 1 }], ["s12", 1, "stone", "kg", { x: 1 }], ["s13", 11, "stone", "lbm", { x: 1 }], ["s14", 80, "kg", "stone", { x: 1 }],
  ["s15", 1, "cwt", "kg", { x: 1 }], ["s16", 1, "uk_cwt", "lbm", { x: 1 }], ["s17", 20, "short tons", "kg", { x: ["ton", "kg"] }],
  ["s18", 2, "long tons", "kg", { x: ["uk_ton", "kg"] }], ["s19", 5, "metric tons", "lb", { x: ["Mg", "lbm"] }], ["s20", 1000, "kg", "t", { x: ["kg", "Mg"] }],
  ["s21", 2.5, "t", "lb", { x: ["Mg", "lbm"] }], ["s22", 1, "Mg", "kg", { x: 1 }], ["s23", 70, "KG", "lb", { x: ["kg", "lbm"] }],
  ["s24", 12, "oz", "kg", { x: ["ozm", "kg"] }], ["s25", 1, "grain", "mg", { x: 1 }], ["s26", 500, "mg", "grain", { x: 1 }], ["s27", 1, "sg", "kg", { x: 1 }],
  ["s28", 40, "ton", "Mg", { x: 1 }], ["s29", 3, "kilos", "lb", { x: ["kg", "lbm"] }], ["s30", 10, "stones", "kg", { x: ["stone", "kg"] }],
  ["s31", 1, "tons", "lbs", { x: ["ton", "lbm"] }], ["s32", 1, "ton", "lb", { x: ["ton", "lbm"] }], ["s33", 1, "tons", "tonnes", { x: ["ton", "Mg"] }],
  ["s34", 2, "T", "kg", { x: ["Mg", "kg"], why: "Excel's T is the tesla; beside kg Lantern's other reading, the tonne" }],
  ["s35", 1, "lbm", "ozm", { x: 1 }], ["s36", 250, "g", "lbm", { x: 1 }], ["s37", 1, "kg", "g", { x: 1 }], ["s38", 5, "lb", "g", { x: ["lbm", "g"] }],
  ["s39", 100, "pounds", "kilograms", { x: ["lbm", "kg"] }], ["s40", 1, "hweight", "kg", { x: 1 }], ["s41", 22, "Kg", "lbs", { x: ["kg", "lbm"] }],
  ["s42", 1, "brton", "ton", { x: 1 }]
]);
conv("distance", [
  ["d01", 26.2, "mi", "km", { x: 1 }], ["d02", 5, "km", "mi", { x: 1 }], ["d03", 100, "m", "yd", { x: 1 }], ["d04", 6, "ft", "m", { x: 1 }],
  ["d05", 180, "cm", "ft", { x: 1 }], ["d06", 1, "Nmi", "km", { x: 1 }], ["d07", 1, "mi", "ft", { x: 1 }], ["d08", 12, "in", "cm", { x: 1 }],
  ["d09", 500, "miles", "km", { x: ["mi", "km"] }], ["d10", 10, "kilometers", "miles", { x: ["km", "mi"] }], ["d11", 5, "feet", "m", { x: ["ft", "m"] }],
  ["d12", 72, "inches", "cm", { x: ["in", "cm"] }], ["d13", 100, "yards", "m", { x: ["yd", "m"] }], ["d14", 1, "mile", "m", { x: ["mi", "m"] }],
  ["d15", 42.195, "km", "mi", { x: 1 }], ["d16", 1, "mm", "in", { x: 1 }], ["d17", 3, "m", "ft", { x: 1 }], ["d18", 5280, "ft", "mi", { x: 1 }],
  ["d19", 1, "ly", "km", { x: 1 }], ["d20", 1, "ell", "m", { x: 1 }], ["d21", 1, "survey_mi", "m", { x: 1 }],
  ["d22", 1, "nm", "m", { x: 1, why: "Excel's nm is the nanometre" }], ["d23", 12, "pica", "in", { x: 1 }], ["d24", 72, "Picapt", "in", { x: 1 }],
  ["d25", 1, "ang", "nm", { x: 1 }], ["d26", 6, "foot", "in", { x: ["ft", "in"] }], ["d27", 2, "metres", "feet", { x: ["m", "ft"] }],
  ["d28", 1, "km", "m", { x: 1 }], ["d29", 1, "mi", "yd", { x: 1 }], ["d30", 10, "km", "Nmi", { x: 1 }], ["d31", 1, "in", "mm", { x: 1 }],
  ["d32", 5, "MI", "km", { x: ["mi", "km"] }], ["d33", 1, "yd", "in", { x: 1 }], ["d34", 400, "m", "mi", { x: 1 }], ["d35", 8, "inch", "mm", { x: ["in", "mm"] }]
]);
conv("speed", [
  ["v01", 60, "mph", "km/h", { x: 1 }], ["v02", 100, "km/h", "mph", { x: 1 }], ["v03", 30, "kn", "km/h", { x: 1 }], ["v04", 10, "m/s", "km/h", { x: 1 }],
  ["v05", 70, "mph", "m/s", { x: 1 }], ["v06", 120, "kph", "mph", { x: ["km/h", "mph"] }], ["v07", 20, "knots", "mph", { x: ["kn", "mph"] }],
  ["v08", 50, "km/hr", "m/s", { x: 1 }], ["v09", 1, "admkn", "kn", { x: 1 }], ["v10", 90, "kmh", "mph", { x: ["km/h", "mph"] }],
  ["v11", 100, "m/sec", "mph", { x: 1 }], ["v12", 15, "knot", "m/s", { x: ["kn", "m/s"] }]
]);
conv("area", [
  ["a01", 1, "ha", "m2", { x: 1 }], ["a02", 1, "uk_acre", "ha", { x: 1 }], ["a03", 2, "acres", "ha", { x: ["uk_acre", "ha"] }],
  ["a04", 5, "hectares", "acre", { x: ["ha", "uk_acre"] }], ["a05", 1000, "sq ft", "m2", { x: ["ft2", "m2"] }], ["a06", 50, "m2", "ft2", { x: 1 }],
  ["a07", 1, "km2", "ha", { x: 1 }], ["a08", 1, "mi2", "km2", { x: 1 }], ["a09", 120, "square feet", "m2", { x: ["ft2", "m2"] }],
  ["a10", 1, "us_acre", "m2", { x: 1 }], ["a11", 1, "ar", "m2", { x: 1 }], ["a12", 1, "Morgen", "m2", { x: 1 }], ["a13", 144, "in2", "ft2", { x: 1 }],
  ["a14", 10, "ft^2", "m^2", { x: 1 }], ["a15", 25, "sq m", "sq ft", { x: ["m2", "ft2"] }], ["a16", 1, "acre", "ft2", { x: ["uk_acre", "ft2"] }],
  ["a17", 1, "yd2", "m2", { x: 1 }], ["a18", 1, "cm2", "mm2", { x: 1 }]
]);
conv("volume", [
  ["w01", 1, "m3", "ft3", { x: 1 }], ["w02", 1, "ft3", "l", { x: 1 }], ["w03", 1, "cm3", "ml", { x: 1 }], ["w04", 1, "yd3", "m3", { x: 1 }],
  ["w05", 1, "bushel", "l", { x: 1 }], ["w06", 1, "in3", "ml", { x: 1 }], ["w07", 1, "gal", "in3", { x: 1 }], ["w08", 1, "GRT", "m3", { x: 1 }],
  ["w09", 1, "MTON", "ft3", { x: 1 }], ["w10", 2, "cubic metres", "l", { x: ["m3", "l"] }], ["w11", 3, "m^3", "gal", { x: 1 }]
]);
conv("time", [
  ["t01", 2, "hr", "mn", { x: 1 }], ["t02", 2, "h", "min", { x: ["hr", "mn"], why: "h beside minutes: Lantern's other reading, the hour (Excel #N/A)" }],
  ["t03", 90, "min", "h", { x: ["mn", "hr"] }], ["t04", 1, "day", "hr", { x: 1 }], ["t05", 3, "days", "hr", { x: ["day", "hr"] }],
  ["t06", 1, "yr", "day", { x: 1 }], ["t07", 1, "h", "W", { x: 1, why: "Excel's h is horsepower" }], ["t08", 1, "week", "day", { n: 7 }],
  ["t09", 2, "weeks", "hr", { n: 336 }], ["t10", 45, "mins", "h", { x: ["mn", "hr"] }], ["t11", 3600, "sec", "hr", { x: 1 }],
  ["t12", 1, "hours", "s", { x: ["hr", "s"] }], ["t13", 500, "ms", "s", { x: 1 }], ["t14", 8, "hrs", "min", { x: ["hr", "mn"] }],
  ["t15", 1, "d", "h", { x: ["day", "hr"] }], ["t16", 1, "years", "days", { x: ["yr", "day"] }], ["t17", 30, "s", "mn", { x: 1 }],
  ["t18", 1.5, "h", "s", { x: ["hr", "s"] }], ["t19", 1, "day", "s", { x: 1 }], ["t20", 2, "hours", "minutes", { x: ["hr", "mn"] }]
]);
conv("energy", [
  ["e01", 1, "kWh", "J", { x: 1 }], ["e02", 350, "kWh", "MJ", { x: 1 }], ["e03", 1, "kWh", "BTU", { x: 1 }], ["e04", 100000, "BTU", "kWh", { x: 1 }],
  ["e05", 1, "MJ", "kWh", { x: 1 }], ["e06", 2000, "kcal", "kJ", { x: 1, why: "Excel's kcal is the kilo- IT calorie, 4.1868 kJ" }], ["e07", 1, "Wh", "J", { x: 1 }],
  ["e08", 1, "HPh", "kWh", { x: 1 }], ["e09", 500, "cal", "J", { x: 1 }], ["e10", 1, "c", "J", { x: 1 }], ["e11", 1, "GJ", "kWh", { x: 1 }],
  ["e12", 1, "kwh", "kJ", { x: 1 }], ["e13", 1, "BTU", "J", { x: 1 }], ["e14", 1, "flb", "J", { x: 1 }], ["e15", 1, "eV", "J", { x: 1, tol: 1e-8 }],
  ["e16", 100, "kcal", "kWh", { x: 1 }], ["e17", 1, "therm", "kWh", { err: "#N/A" }], ["e18", 1, "kJ", "cal", { x: 1 }], ["e19", 1, "MWh", "GJ", { x: 1 }],
  ["e20", 250, "kc", "kJ", { x: 1 }], ["e21", 1, "btu", "Wh", { x: 1 }], ["e22", 1000, "joules", "kWh", { x: ["J", "kWh"] }], ["e23", 1, "kWh", "kcal", { x: 1 }],
  ["e24", 1, "e", "J", { x: 1 }], ["e25", 1, "hh", "kWh", { x: 1 }], ["e26", 1, "cal", "c", { x: 1 }]
]);
conv("power", [
  ["o01", 150, "hp", "kW", { x: ["HP", "kW"] }], ["o02", 1500, "W", "hp", { x: ["W", "HP"] }], ["o03", 200, "HP", "kW", { x: 1 }], ["o04", 1, "PS", "W", { x: 1 }],
  ["o05", 1, "kW", "HP", { x: 1 }], ["o06", 100, "PS", "hp", { x: ["PS", "HP"] }], ["o07", 1, "kW", "BTU/h", { n: 3600000 / 1055.05585262 }],
  ["o08", 3, "kW", "W", { x: 1 }], ["o09", 1, "MW", "kW", { x: 1 }], ["o10", 2, "h", "kW", { x: ["HP", "kW"] }], ["o11", 60, "watts", "kW", { x: ["W", "kW"] }]
]);
conv("data", [
  ["i01", 1, "byte", "bit", { x: 1 }], ["i02", 1, "kbyte", "byte", { x: 1 }], ["i03", 1, "kibyte", "byte", { x: 1 }], ["i04", 1, "GB", "MB", { x: ["Gbyte", "Mbyte"] }],
  ["i05", 1, "Gibyte", "Mibyte", { x: 1 }], ["i06", 100, "Mbit", "Mbyte", { x: 1 }], ["i07", 1, "TB", "GB", { x: ["Tbyte", "Gbyte"] }],
  ["i08", 500, "MB", "GB", { x: ["Mbyte", "Gbyte"] }], ["i09", 1, "Mibyte", "kbyte", { x: 1 }]
]);
conv("other", [
  ["x01", 1, "T", "ga", { x: 1 }], ["x02", 1, "N", "dyn", { x: 1 }], ["x03", 10, "kgf", "lbf", { n: 98.0665 / 4.4482216152605 }],
  ["x04", 60, "rpm", "Hz", { n: 1, tol: 1e-9, why: "rpm: Lantern's own unit" }], ["x05", 0, "C", "Rank", { x: 1 }], ["x06", 100, "C", "Reau", { x: 1 }],
  ["x07", 300, "K", "C", { x: 1 }], ["x08", 1, "Pica", "mm", { x: 1 }]
]);
conv("errors", [
  ["r01", 1, "foo", "kg", { err: "#N/A" }], ["r02", 1, "kg", "m", { err: "#N/A" }], ["r03", 1, "KWH", "J", { err: "#N/A" }],
  ["r04", 1, "tbsp", "ml", { err: "#N/A", why: "Excel's name is tbs; Lantern has no tbsp (a gap)" }], ["r05", 1, "cc", "ml", { err: "#N/A" }],
  ["r06", 1, "gallon", "kg", { err: "#N/A" }], ["r07", 1, "C", "kg", { err: "#N/A" }], ["r08", -5, "kg", "lbm", { x: 1 }],
  ["r09", 1, "ft", "sec", { err: "#N/A" }], ["r10", 1, "LBM", "kg", { x: ["lbm", "kg"], why: "Excel's names are case-sensitive (LBM is #N/A there); Lantern reads LBM as its pound, and saves lbm" }]
]);
// a value that is not a number (CONVERT(TRUE,...) is left out: what Excel gives for a logical value could not be checked;
// Lantern and LibreOffice both read TRUE as 1)
cases.push({ id: "r11", group: "errors", f: "CONVERT(\x22abc\x22,\x22lbm\x22,\x22kg\x22)", expect: "#VALUE!", save: "any" });

// CONVERT with its units or its value in other cells, or inside other functions (sheet and save only)
function cell(id, cells, f, s) {
  var o = { id: id, group: "cells", f: f, cells: cells, chat: false };
  for (var k in s) o[k] = s[k];
  cases.push(o);
}
cell("q01", { A1: 10, B1: "lb", C1: "kg" }, "CONVERT(A1,B1,C1)", { expect: 10 * LB, save: "value", why: "lb typed in B1: Excel has no lb" });
cell("q02", { A1: 10, B1: "lbm", C1: "kg" }, "CONVERT(A1,B1,C1)", { expect: X(10, "lbm", "kg"), save: "formula" });
cell("q03", { A1: 5, B1: "tons" }, "CONVERT(A1,B1,\x22kg\x22)", { expect: X(5, "ton", "kg"), save: "value" });
cell("q04", { A1: 5, B1: "ton" }, "CONVERT(A1,B1,\x22kg\x22)", { expect: X(5, "ton", "kg"), save: "formula" });
cell("q05", { A1: 2, B1: "bar" }, "CONVERT(A1,B1,\x22psi\x22)", { expect: 2e5 / PSI, save: "value" });
cell("q06", { A1: 100 }, "CONVERT(A1,\x22lb\x22,\x22kg\x22)", { expect: 100 * LB, save: "formula" });
cell("q07", { A1: 3 }, "CONVERT(A1*2,\x22tonne\x22,\x22kg\x22)", { expect: 6000, save: "formula" });
cell("q08", { A1: 2, A2: 3 }, "CONVERT(SUM(A1:A2),\x22lb\x22,\x22kg\x22)", { expect: 5 * LB, save: "formula", why: "the value is a SUM: the units must still be written as Excel's" });
cell("q09", { A1: 10 }, "ROUND(CONVERT(A1,\x22lb\x22,\x22kg\x22),2)", { expect: 4.54, save: "formula" });
cell("q10", { A1: 26.2 }, "CONVERT(A1,\x22mi\x22,\x22km\x22)*2", { expect: X(52.4, "mi", "km"), save: "formula", tol: 1e-12 });
cell("q11", { B1: 1 }, "CONVERT(A1,\x22lbm\x22,\x22kg\x22)", { expect: 0, save: "formula", why: "an empty cell is 0 in Excel's CONVERT" });
cell("q12", { A1: "abc" }, "CONVERT(A1,\x22lbm\x22,\x22kg\x22)", { expect: "#VALUE!", save: "any" });
cell("q13", { A1: 100, B1: "C", C1: "F" }, "CONVERT(A1,B1,C1)", { expect: 212, save: "formula" });
cell("q14", { A1: 1, B1: "kg", C1: "lb" }, "CONVERT(A1,B1,C1)", { expect: 1 / LB, save: "value" });
cell("q15", { A1: 2, B1: "h", C1: "min" }, "CONVERT(A1,B1,C1)", { expect: 120, save: "value", why: "Excel reads h in B1 as horsepower: #N/A beside min" });
cell("q16", { A1: 8, B1: "oz", C1: "g" }, "CONVERT(A1,B1,C1)", { expect: X(8, "ozm", "g"), save: "value" });
cell("q17", { A1: 8, B1: "oz", C1: "ml" }, "CONVERT(A1,B1,C1)", { expect: X(8, "oz", "ml"), save: "formula" });
cell("q18", { A2: 5, B1: "lb", C1: "kg" }, "CONVERT(A2,$B$1,$C$1)", { expect: 5 * LB, save: "value" });
cell("q19", { A1: 3, B1: "lbs" }, "CONVERT(A1,\x22kg\x22,B1)", { expect: 3 / LB, save: "value" });
cell("q20", { A1: 7 }, "IF(A1>0,CONVERT(A1,\x22lb\x22,\x22kg\x22),0)", { expect: 7 * LB, save: "formula" });
cell("q21", { A1: 98.6 }, "CONVERT(A1,\x22F\x22,\x22C\x22)", { expect: 37, save: "formula", tol: 1e-12 });
cell("q22", { A1: 4 }, "CONVERT(A1,\x22l\x22&\x22b\x22,\x22kg\x22)", { expect: 4 * LB, save: "value", why: "units built with &: Excel reads lb and gives #N/A, so a formula kept would show #N/A" });
cell("q23", { A1: 5, B1: "kg" }, "CONVERT(A1,\x22lb\x22,B1)", { expect: 5 * LB, save: "formula", why: "kg in B1 is Excel's; lb in quotes can be written lbm" });
cell("q24", { A1: 2 }, "CONVERT(A1,\x22tons\x22,\x22lb\x22)+CONVERT(A1,\x22stones\x22,\x22lb\x22)", { expect: 4000 + 28, save: "formula" });
cell("q25", { A1: 12, A2: 18 }, "AVERAGE(CONVERT(A1,\x22gal\x22,\x22l\x22),CONVERT(A2,\x22gal\x22,\x22l\x22))", { expect: 15 * GAL, save: "formula", tol: 1e-12 });
cell("q26", { A1: 32 }, "CONVERT(A1,\x22psi\x22,\x22bar\x22)", { expect: 32 * PSI / 1e5, save: "value" });
cell("q27", { A1: 3, B1: "weeks" }, "CONVERT(A1,B1,\x22day\x22)", { expect: 21, save: "value" });
cell("q28", { A1: 5 }, "CONVERT(-A1,\x22lb\x22,\x22kg\x22)", { expect: -5 * LB, save: "formula" });
cell("q29", { A1: 4, B1: "Kg", C1: "lbm" }, "CONVERT(A1,B1,C1)", { expect: 4 / LB, save: "value", why: "Kg in B1: Excel's names are case-sensitive" });
cell("q30", { A1: 2, B1: "ton", C1: "kilograms" }, "CONVERT(A1,B1,C1)", { expect: X(2, "ton", "kg"), save: "value" });
cell("q31", { A1: 2, B1: "kilograms" }, "CONVERT(A1,\x22ton\x22,B1)", { expect: X(2, "ton", "kg"), save: "value" });
cell("q32", { A1: 2, B1: "ton" }, "CONVERT(A1,B1,\x22kilograms\x22)", { expect: X(2, "ton", "kg"), save: "formula", why: "ton in B1 is Excel's; kilograms in quotes can be written kg" });
cell("q33", { A1: 150, A2: 160, A3: 170 }, "CONVERT(AVERAGE(A1:A3),\x22lb\x22,\x22kg\x22)", { expect: 160 * LB, save: "formula" });
cell("q34", { A1: 100, B1: 0.1 }, "CONVERT(A1*(1+B1),\x22lb\x22,\x22kg\x22)", { expect: 110 * LB, save: "formula", tol: 1e-12 });
cell("q35", { A1: 10 }, "CONVERT(CONVERT(A1,\x22kg\x22,\x22lbm\x22),\x22lb\x22,\x22ozm\x22)", { expect: X(10, "kg", "ozm"), save: "formula", tol: 1e-12 });
cell("q36", { A1: 12.4 }, "CONVERT(ROUND(A1,0),\x22gallons\x22,\x22litres\x22)", { expect: 12 * GAL, save: "formula" });
cell("q37", { A1: 5 }, "CONVERT(A1,\x22kg \x22,\x22lb\x22)", { expect: 5 / LB, save: "formula", why: "a space after kg: Excel #N/A; Lantern trims it, so it saves kg" });
cell("q38", { A1: 10 }, "CONVERT(A1,\x22m²\x22,\x22ft²\x22)", { expect: X(10, "m2", "ft2"), save: "formula" });
cell("q39", { A1: 2, B1: "m³" }, "CONVERT(A1,B1,\x22l\x22)", { expect: 2000, save: "value" });
cell("q40", { A1: 8, B1: "imperial pints", C1: "gallons" }, "CONVERT(A1,B1,C1)", { expect: 1, save: "value", why: "as f16, from cells" });

// the mended functions, in Chat and a sheet, and saved
function fn(id, f, expect, s) {
  var o = { id: id, group: "functions", f: f, expect: expect, save: "formula" };
  for (var k in s || {}) o[k] = s[k];
  cases.push(o);
}
// FIXED (Microsoft: FIXED(1234.567,1) is 1,234.6; FIXED(1234.567,-1) 1,230; FIXED(-1234.567,-1,TRUE) -1230; FIXED(44.332) 44.33)
fn("F01", "FIXED(1234.567)", "1,234.57"); fn("F02", "FIXED(1234.567,1)", "1,234.6"); fn("F03", "FIXED(1234.567,-1)", "1,230");
fn("F04", "FIXED(-1234.567,-1,TRUE)", "-1230"); fn("F05", "FIXED(44.332)", "44.33"); fn("F06", "FIXED(1234.56789,5)", "1,234.56789");
fn("F07", "FIXED(1234567.891,2,TRUE)", "1234567.89"); fn("F08", "FIXED(2.5,0)", "3"); fn("F09", "FIXED(-2.5,0)", "-3");
fn("F10", "FIXED(0.125,2)", "0.13"); fn("F11", "FIXED(1000000)", "1,000,000.00"); fn("F12", "FIXED(1.005,2)", "1.01", { why: "Excel rounds 1.005 to 1.01 (ROUND(1.005,2) is 1.01)" });
fn("F13", "FIXED(0.1234567,6,TRUE)", "0.123457"); fn("F14", "FIXED(1234.5)", "1,234.50"); fn("F15", "FIXED(-1234567.5,1)", "-1,234,567.5");
fn("F16", "FIXED(12345.6789,3,FALSE)", "12,345.679");
// DOLLAR (Microsoft's examples, en-US)
fn("D01", "DOLLAR(1234.567)", "$1,234.57"); fn("D02", "DOLLAR(1234.567,-2)", "$1,200"); fn("D03", "DOLLAR(-1234.567,-2)", "($1,200)");
fn("D04", "DOLLAR(-0.123,4)", "($0.1230)"); fn("D05", "DOLLAR(99.888)", "$99.89"); fn("D06", "DOLLAR(1234.56789,4)", "$1,234.5679");
fn("D07", "DOLLAR(0.5,0)", "$1"); fn("D08", "DOLLAR(1000000,0)", "$1,000,000"); fn("D09", "DOLLAR(12.5)", "$12.50");
// TEXTBEFORE / TEXTAFTER (Microsoft: instance_num, match_mode, match_end, if_not_found)
var S = "\x22apple-banana-cherry\x22";
fn("T01", "TEXTBEFORE(" + S + ",\x22-\x22)", "apple"); fn("T02", "TEXTBEFORE(" + S + ",\x22-\x22,2)", "apple-banana");
fn("T03", "TEXTBEFORE(" + S + ",\x22-\x22,-1)", "apple-banana"); fn("T04", "TEXTAFTER(" + S + ",\x22-\x22)", "banana-cherry");
fn("T05", "TEXTAFTER(" + S + ",\x22-\x22,-1)", "cherry"); fn("T06", "TEXTAFTER(" + S + ",\x22-\x22,2)", "cherry");
fn("T07", "TEXTBEFORE(\x22apple\x22,\x22-\x22)", "#N/A"); fn("T08", "TEXTBEFORE(\x22apple\x22,\x22-\x22,,,1)", "apple");
fn("T09", "TEXTAFTER(\x22apple\x22,\x22-\x22,,,1)", ""); fn("T10", "TEXTAFTER(\x22apple\x22,\x22-\x22,,,,\x22none\x22)", "none");
fn("T11", "TEXTBEFORE(\x22Hello World\x22,\x22WORLD\x22,,1)", "Hello "); fn("T12", "TEXTBEFORE(\x22Hello World\x22,\x22WORLD\x22)", "#N/A");
fn("T13", "TEXTBEFORE(\x22a-b\x22,\x22-\x22,3)", "#N/A"); fn("T14", "TEXTBEFORE(\x22a-b\x22,\x22-\x22,2,,1)", "a-b");
fn("T15", "TEXTAFTER(\x22a-b\x22,\x22-\x22,-2,,1)", "a-b"); fn("T16", "TEXTBEFORE(\x22a-b\x22,\x22-\x22,0)", "#VALUE!");
fn("T17", "TEXTAFTER(\x22john@example.com\x22,\x22@\x22)", "example.com"); fn("T18", "TEXTBEFORE(\x22john@example.com\x22,\x22@\x22)", "john");
fn("T19", "TEXTBEFORE(\x22a-b\x22,\x22-\x22,-2,,1)", ""); fn("T20", "TEXTAFTER(\x22abc\x22,\x22\x22)", "abc"); fn("T21", "TEXTBEFORE(\x22abc\x22,\x22\x22)", "");
fn("T22", "TEXTAFTER(\x22abc\x22,\x22\x22,-1)", ""); fn("T23", "TEXTBEFORE(\x22abc\x22,\x22\x22,-1)", "abc");
fn("T24", "TEXTAFTER(\x22Total: 42 kg\x22,\x22: \x22)", "42 kg"); fn("T25", "TEXTBEFORE(\x22x\x22,\x22-\x22,,,,\x22none\x22)", "none");
// FREQUENCY, a list (sheet and save; Chat with constants)
var FC = { A1: 1, A2: 2, A3: 3, A4: 4, A5: 5, A6: 6, B1: 2, B2: 4 };
fn("Q01", "SUM(FREQUENCY(A1:A6,B1:B2))", 6, { cells: FC, chat: false }); fn("Q02", "INDEX(FREQUENCY(A1:A6,B1:B2),1)", 2, { cells: FC, chat: false });
fn("Q03", "INDEX(FREQUENCY(A1:A6,B1:B2),2)", 2, { cells: FC, chat: false }); fn("Q04", "INDEX(FREQUENCY(A1:A6,B1:B2),3)", 2, { cells: FC, chat: false });
var GC = { A1: 55, A2: 67, A3: 72, A4: 81, A5: 90, A6: 45, A7: 88, A8: 77, B1: 59, B2: 69, B3: 79, B4: 89 };
fn("Q05", "INDEX(FREQUENCY(A1:A8,B1:B4),1)", 2, { cells: GC, chat: false }); fn("Q06", "INDEX(FREQUENCY(A1:A8,B1:B4),2)", 1, { cells: GC, chat: false });
fn("Q07", "INDEX(FREQUENCY(A1:A8,B1:B4),5)", 1, { cells: GC, chat: false }); fn("Q08", "MAX(FREQUENCY(A1:A8,B1:B4))", 2, { cells: GC, chat: false });
fn("Q09", "INDEX(FREQUENCY(A1:A4,B1),2)", 1, { cells: { A1: 1, A2: "x", A3: 3, B1: 2 }, chat: false, why: "text and empty cells are not counted" });
fn("Q10", "SUM(FREQUENCY({1,2,3,4,5},{2,4}))", 5, { chat: false, why: "constants in a sheet (Chat takes no { } constants at all: not FREQUENCY's matter)" });
fn("Q11", "INDEX(FREQUENCY({1,2,3,4,5},{2,4}),3)", 1, { chat: false });
// ROMAN, forms 0 to 4 (Microsoft: 499 is CDXCIX, LDVLIV, XDIX, VDIV, ID)
fn("R01", "ROMAN(499)", "CDXCIX"); fn("R02", "ROMAN(499,1)", "LDVLIV"); fn("R03", "ROMAN(499,2)", "XDIX"); fn("R04", "ROMAN(499,3)", "VDIV");
fn("R05", "ROMAN(499,4)", "ID"); fn("R06", "ROMAN(1999,4)", "MIM"); fn("R07", "ROMAN(2026)", "MMXXVI"); fn("R08", "ROMAN(4)", "IV");
fn("R09", "ROMAN(0)", ""); fn("R10", "ROMAN(4000)", "#VALUE!"); fn("R11", "ROMAN(1999,TRUE)", "MCMXCIX"); fn("R12", "ROMAN(1999,FALSE)", "MIM");
fn("R13", "ROMAN(45,1)", "VL"); fn("R14", "ROMAN(3.9)", "III"); fn("R15", "ROMAN(-1)", "#VALUE!"); fn("R16", "ROMAN(1999,1)", "MLMVLIV");
fn("R17", "ROMAN(1999,2)", "MXMIX"); fn("R18", "ROMAN(1999,3)", "MVMIV"); fn("R19", "ROMAN(5)", "V"); fn("R20", "ROMAN(1994)", "MCMXCIV");
// ADDRESS (Microsoft's examples)
fn("A01", "ADDRESS(2,3)", "$C$2"); fn("A02", "ADDRESS(2,3,2)", "C$2"); fn("A03", "ADDRESS(2,3,2,FALSE)", "R2C[3]");
fn("A04", "ADDRESS(2,3,1,FALSE,\x22[Book1]Sheet1\x22)", "\x27[Book1]Sheet1\x27!R2C3"); fn("A05", "ADDRESS(2,3,1,FALSE,\x22EXCEL SHEET\x22)", "\x27EXCEL SHEET\x27!R2C3");
fn("A06", "ADDRESS(2,3,4,FALSE)", "R[2]C[3]"); fn("A07", "ADDRESS(2,3,3,FALSE)", "R[2]C3"); fn("A08", "ADDRESS(1,27)", "$AA$1");
fn("A09", "ADDRESS(1,1,1,FALSE)", "R1C1"); fn("A10", "ADDRESS(5,1,4)", "A5"); fn("A11", "ADDRESS(1,1,1,TRUE,\x22Sheet1\x22)", "Sheet1!$A$1");
fn("A12", "ADDRESS(3,2,3)", "$B3");
// TIMEVALUE (Microsoft: "2:24 AM" is 0.1, "22-Aug-2011 6:35 AM" 0.2743)
fn("V01", "TIMEVALUE(\x226:35 AM\x22)", 0.274305555555556); fn("V02", "TIMEVALUE(\x222:24 AM\x22)", 0.1); fn("V03", "TIMEVALUE(\x2212:00\x22)", 0.5);
fn("V04", "TIMEVALUE(\x2218:30\x22)", 0.770833333333333); fn("V05", "TIMEVALUE(\x2212:00 AM\x22)", 0); fn("V06", "TIMEVALUE(\x2212:30 PM\x22)", 0.520833333333333);
fn("V07", "TIMEVALUE(\x226:35:20 PM\x22)", 0.774537037037037); fn("V08", "TIMEVALUE(\x2222-Aug-2011 6:35 AM\x22)", 0.274305555555556);
fn("V09", "TIMEVALUE(\x22abc\x22)", "#VALUE!"); fn("V10", "TIMEVALUE(\x221:30 pm\x22)", 0.5625); fn("V11", "TIMEVALUE(\x229:15\x22)", 0.385416666666667);
// GAMMA is Excel's gamma function; GAMMAFN its old name (saved as GAMMA); LORE and LORENTZ the Lorentz factor (Lantern's own)
fn("G01", "GAMMA(2.5)", 1.32934038817914); fn("G02", "GAMMA(-3.75)", 0.267866128861417); fn("G03", "GAMMA(0)", "#NUM!"); fn("G04", "GAMMA(-2)", "#NUM!");
fn("G05", "GAMMA(5)", 24); fn("G06", "GAMMA(0.5)", 1.77245385090552); fn("G07", "GAMMAFN(2.5)", 1.32934038817914, { saveAs: "GAMMA(2.5)" });
fn("G08", "GAMMA(10)", 362880); fn("G09", "LORE(0.6*299792458)", 1.25, { save: "own" }); fn("G10", "LORENTZ(0.8*299792458)", 5 / 3, { save: "own" });
fn("G11", "GAMMA(1)", 1);
fn("R21", "ROMAN(3999)", "MMMCMXCIX"); fn("R22", "ROMAN(3999,4)", "MMMIM"); fn("R23", "ROMAN(1000,4)", "M"); fn("R24", "ROMAN(1990,4)", "MXM");
fn("R25", "ROMAN(95,1)", "VC"); fn("R26", "ROMAN(490,2)", "XD");
fn("D10", "DOLLAR(1234.567,1)", "$1,234.6"); fn("F17", "FIXED(-0.5,0)", "-1"); fn("F18", "FIXED(999.995,2)", "1,000.00");

// where LibreOffice 24.2 itself differs from Excel's documented unit or format (found by replay.js --lo on these cases):
// its recalculation of these is not held against Lantern, and is printed as a LO-NOTE
var LOKNOWN = {
  "Torr": ["p10", "p11"], "sg (slug)": ["s27"], "ly (an older light-year)": ["d19"], "Picapt (LibreOffice 24.2 has no such name: #VALUE!)": ["d24"],
  "admkn": ["v09"], "MTON (LibreOffice's is 1/40 ft3)": ["w09"], "BTU": ["e03", "e04", "e13"], "cal and c (older calories)": ["e06", "e09", "e10", "e18", "e20", "e23"],
  "flb (LibreOffice reads the foot-poundal, 0.0421 J; Excel's page says foot-pound)": ["e14"],
  "DOLLAR's negative format (LibreOffice's en-US locale writes -$1,200; Microsoft's page shows ($1,200))": ["D03", "D04"],
  "ADDRESS's sheet name (LibreOffice's own A1 syntax writes Sheet1.$A$1)": ["A11"],
  "FIXED(1.005,2) (LibreOffice gives 1.00; Excel's ROUND(1.005,2) is 1.01)": ["F12"]
};
Object.keys(LOKNOWN).forEach(function (why) { LOKNOWN[why].forEach(function (id) { cases.forEach(function (c) { if (c.id === id) c.loKnown = why; }); }); });
cases.forEach(function (c) { if (typeof c.expect === "number") c.expect = Number(c.expect.toPrecision(15)); });
process.stdout.write(JSON.stringify(cases, null, 1) + "\n");
