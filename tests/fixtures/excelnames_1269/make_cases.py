#!/usr/bin/env python3
# make_cases.py -- writes cases.json, the review of draft 1.24.29 (GAMMA, LORE, CONVERT in a sheet, Save .xlsx,
# and the audit of every function name Lantern shares with Excel). The reviewer wrote these from Microsoft's
# documentation and the exact unit definitions (excel_ref.py), not from Lantern's source.
#
#   python3 make_cases.py            # writes cases.json beside it
#   node replay.js [lantern.inner.html]
#
# Each case: id, kind (sheet | chat | xlsx), input, expect, source, harm (high | medium | low), and where it applies
# group, note, unjudged (Excel's own constant not certain to 15 digits: checked to the tolerance given).
# expect forms: {"num": x, "tol": rel} | {"err": "#N/A"} | {"text": "..."} | {"bool": true} |
#               {"any": [expect, ...]} (any one of them is right: Excel's #N/A or Lantern's lenient reading)
import json, math, os, statistics as st
from fractions import Fraction as Fr
from datetime import date
import excel_ref as X
from scipy import stats as SS

HERE = os.path.dirname(os.path.abspath(__file__))
TOL = 1e-14          # 15 significant digits (relative), as Excel shows a number
cases = []
MS_CONVERT = "Microsoft Support, CONVERT function (unit names, groups, prefixes, #N/A rules)"


def q(s):
    return '"' + s + '"'


def num(x, tol=TOL):
    return {"num": x, "tol": tol}


def add(id, kind, inp, expect, source, harm, **kw):
    c = {"id": id, "kind": kind, "input": inp, "expect": expect, "source": source, "harm": harm}
    c.update(kw)
    cases.append(c)


# ---------------------------------------------------------------------------------------------------------------
# 1. CONVERT in a sheet where Excel gives a number (the guard of ordinary uses first)
CV = [
    # mass
    (1, "kg", "lbm", "high"), (150, "lbm", "kg", "high"), (1, "lbm", "g", "high"), (16, "ozm", "lbm", "high"),
    (8, "ozm", "g", "high"), (100, "g", "ozm", "high"), (1, "ton", "kg", "high"), (1, "ton", "lbm", "high"),
    (2, "uk_ton", "kg", "medium"), (1, "LTON", "lbm", "medium"), (1, "brton", "ton", "medium"),
    (1, "Mg", "lbm", "high"), (1, "Mg", "ton", "high"), (12, "stone", "kg", "high"), (70, "kg", "stone", "high"),
    (1, "cwt", "lbm", "medium"), (1, "uk_cwt", "kg", "medium"), (1, "shweight", "kg", "medium"),
    (1, "hweight", "lbm", "medium"), (1, "lcwt", "lbm", "medium"), (7000, "grain", "lbm", "medium"),
    (1, "grain", "mg", "medium"), (500, "mg", "g", "high"), (250, "ug", "mg", "medium"), (3.5, "kg", "g", "high"),
    (1, "kg", "ton", "high"), (5, "lbm", "ozm", "high"), (1, "sg", "lbm", "low"),
    # distance
    (5, "km", "mi", "high"), (26.2, "mi", "km", "high"), (6, "ft", "m", "high"), (1, "m", "ft", "high"),
    (1, "in", "cm", "high"), (1, "in", "mm", "high"), (100, "yd", "m", "high"), (1, "m", "in", "high"),
    (1, "Nmi", "km", "high"), (1, "mi", "ft", "high"), (1, "yd", "in", "high"), (10, "cm", "in", "high"),
    (1, "ang", "nm", "medium"), (500, "nm", "um", "medium"), (1, "survey_mi", "m", "low"), (1, "ell", "in", "low"),
    (72, "Pica", "in", "low"), (6, "pica", "in", "low"), (1, "dam", "m", "medium"), (1, "hm", "m", "medium"),
    (5280, "ft", "mi", "high"), (1, "Nmi", "mi", "high"), (1, "mm", "in", "high"), (1, "km", "m", "high"),
    (1, "Mm", "km", "medium"), (1, "ly", "km", "low"), (1, "mi", "yd", "high"), (2.5, "in", "mm", "high"),
    # time
    (1, "day", "hr", "high"), (2.5, "hr", "mn", "high"), (90, "min", "hr", "high"), (1, "yr", "day", "high"),
    (1, "hr", "sec", "high"), (1, "d", "s", "high"), (250, "ms", "s", "high"), (1, "s", "us", "medium"),
    (1, "ns", "s", "medium"), (1, "yr", "hr", "medium"), (7, "day", "mn", "high"), (45, "mn", "sec", "high"),
    (1, "ks", "mn", "low"), (1, "min", "mn", "medium"),
    # pressure
    (32, "psi", "kPa", "high"), (1, "atm", "kPa", "high"), (1, "atm", "psi", "high"), (1, "atm", "Torr", "medium"),
    (1013.25, "hPa", "atm", "high"), (1, "MPa", "psi", "high"), (100, "kPa", "psi", "high"), (1, "p", "Pa", "low"),
    (1, "at", "Pa", "low"), (1, "GPa", "MPa", "medium"), (760, "mmHg", "atm", "medium"), (120, "mmHg", "kPa", "medium"),
    (14.7, "psi", "atm", "high"), (1, "Torr", "Pa", "medium"),
    # force
    (1, "lbf", "N", "high"), (1, "kN", "lbf", "high"), (1, "N", "dyn", "medium"),
    (1, "dy", "N", "low"), (10, "N", "lbf", "high"),
    # energy
    (1, "kWh", "J", "high"), (1, "kWh", "BTU", "high"), (1, "BTU", "J", "high"), (1, "cal", "J", "high"),
    (1, "c", "J", "medium"), (1, "kcal", "kJ", "high"), (2000, "kcal", "MJ", "high"), (1, "J", "e", "medium"),
    (1, "Wh", "J", "high"), (1, "wh", "J", "medium"), (1, "MWh", "kWh", "high"), (1, "HPh", "kWh", "medium"),
    (1, "kJ", "cal", "high"), (1, "btu", "kJ", "medium"), (1, "GJ", "kWh", "high"), (100, "BTU", "Wh", "high"),
    (1, "hh", "J", "low"), (1, "eV", "J", "low"), (1, "flb", "J", "low"), (1, "cal", "BTU", "medium"),
    (1, "kcal", "kWh", "high"), (1, "kwh", "J", "medium"),
    # power
    (1, "HP", "W", "high"), (100, "kW", "HP", "high"), (1, "h", "kW", "medium"), (1, "PS", "W", "medium"),
    (1, "MW", "kW", "high"), (1, "w", "W", "low"), (1500, "W", "HP", "high"), (1, "PS", "HP", "medium"),
    # magnetism
    (1, "T", "ga", "medium"), (50, "mT", "ga", "medium"), (1, "ga", "uT", "low"),
    # temperature
    (68, "F", "C", "high"), (100, "C", "F", "high"), (-40, "C", "F", "high"), (37, "C", "F", "high"),
    (98.6, "F", "C", "high"), (0, "C", "K", "high"), (300, "K", "C", "high"), (32, "F", "K", "high"),
    (0, "K", "F", "high"), (1, "Rank", "K", "low"), (100, "C", "Reau", "low"), (80, "Reau", "C", "low"),
    (0, "F", "Rank", "low"), (25, "cel", "fah", "medium"), (273.15, "kel", "cel", "medium"), (350, "F", "C", "high"),
    (180, "C", "F", "high"), (1, "mK", "K", "low"), (-10, "C", "F", "high"), (451, "F", "C", "high"),
    # volume
    (1, "gal", "l", "high"), (10, "l", "gal", "high"), (1, "uk_gal", "l", "high"), (1, "uk_gal", "gal", "high"),
    (1, "cup", "ml", "high"), (1, "tsp", "ml", "high"), (1, "tbs", "tsp", "high"), (1, "cup", "tbs", "high"),
    (1, "cup", "oz", "high"), (1, "pt", "cup", "high"), (1, "qt", "pt", "high"), (1, "gal", "qt", "high"),
    (12, "oz", "ml", "high"), (500, "ml", "cup", "high"), (1, "tspm", "ml", "medium"), (1, "uk_pt", "ml", "high"),
    (1, "us_pt", "l", "medium"), (1, "uk_qt", "l", "medium"), (1, "barrel", "gal", "medium"),
    (1, "barrel", "l", "medium"), (1, "bushel", "l", "medium"), (1, "m3", "l", "high"), (1, "m^3", "l", "high"),
    (1, "ft3", "l", "high"), (1, "ft^3", "gal", "high"), (1, "in3", "ml", "high"), (1, "yd3", "m3", "high"),
    (1, "cm3", "ml", "high"), (1, "L", "lt", "low"), (1, "dl", "ml", "medium"), (1, "hl", "l", "medium"),
    (2, "mL", "tsp", "high"), (1, "GRT", "ft3", "low"), (1, "MTON", "ft3", "low"), (1, "regton", "m3", "low"),
    (1, "km3", "m3", "medium"), (1, "dm3", "l", "medium"), (1, "l", "in3", "medium"), (1, "oz", "ml", "high"),
    (1, "oz", "tbs", "high"), (1, "oz", "l", "high"), (1, "tbs", "ml", "high"), (3, "tsp", "tbs", "high"),
    (1, "gal", "oz", "high"), (1, "cl", "ml", "medium"), (1, "yd^3", "ft^3", "high"),
    # area
    (1, "us_acre", "m2", "high"), (1, "uk_acre", "m2", "high"), (1, "ha", "us_acre", "high"),
    (1, "uk_acre", "ft2", "high"), (1, "m2", "ft2", "high"), (100, "ft^2", "m^2", "high"), (1, "km2", "m2", "high"),
    (1, "km2", "ha", "high"), (1, "mi2", "km2", "high"), (1, "cm2", "in2", "medium"), (1, "in2", "mm2", "medium"),
    (1, "yd2", "m2", "high"), (1, "ar", "m2", "medium"), (1, "Morgen", "m2", "low"), (1, "ha", "m2", "high"),
    (1, "Nmi2", "km2", "low"), (640, "uk_acre", "mi2", "medium"), (1, "km^2", "mi^2", "high"),
    (1500, "ft2", "m2", "high"), (1, "ha", "uk_acre", "high"),
    # information
    (1, "byte", "bit", "high"), (1, "kibyte", "byte", "high"), (1, "Mibit", "bit", "medium"),
    (1, "kbyte", "byte", "high"), (1, "Gibyte", "Mibyte", "high"), (1, "Mbyte", "kbit", "medium"),
    (1, "Gbyte", "Gibyte", "medium"), (1, "Tbyte", "Gbyte", "medium"), (1, "kibit", "byte", "low"),
    # speed
    (60, "mph", "km/h", "high"), (100, "km/h", "mph", "high"), (1, "m/s", "km/h", "high"), (1, "kn", "km/h", "high"),
    (1, "kn", "mph", "high"), (10, "m/s", "mph", "high"), (1, "km/hr", "m/s", "medium"), (1, "m/sec", "m/hr", "low"),
    (1, "admkn", "kn", "low"), (1, "mph", "m/s", "high"), (30, "km/h", "m/s", "high"),
]
seen = set()
for i, (x, a, b, harm) in enumerate(CV, 1):
    key = (x, a, b)
    assert key not in seen, key
    seen.add(key)
    v, unj = X.convert(x, a, b)
    assert v != "#N/A", (x, a, b)
    f = "=CONVERT(%s,%s,%s)" % (repr(x) if isinstance(x, float) else x, q(a), q(b))
    kw = {"group": "convert-excel"}
    tol = TOL
    if unj:
        tol = 1e-5
        kw["unjudged"] = "Excel's own constant for one of these units is not published to 15 digits; checked to 1e-5 against the definition"
    add("cv-%03d" % i, "sheet", {"cells": {"A1": f}}, num(v, tol), MS_CONVERT + "; exact definitions (excel_ref.py)", harm, **kw)

# ordinary uses around CONVERT in a sheet
n = 0
def cv2(cells, expect, src, harm, ref="A1", note=None):
    global n
    n += 1
    kw = {"group": "convert-excel"}
    if note: kw["note"] = note
    add("cu-%03d" % n, "sheet", {"cells": cells, "ref": ref}, expect, src, harm, **kw)

cv2({"A1": "5", "B1": "km", "C1": "mi", "D1": "=CONVERT(A1,B1,C1)"}, num(X.convert(5, "km", "mi")[0]), MS_CONVERT, "high", "D1", "units typed in cells")
cv2({"A1": "150", "B1": "=CONVERT(A1,\"lbm\",\"kg\")*2"}, num(X.convert(300, "lbm", "kg")[0]), MS_CONVERT, "high", "B1")
cv2({"A1": "=ROUND(CONVERT(100,\"F\",\"C\"),1)"}, num(37.8), MS_CONVERT, "high")
cv2({"A1": "=SUM(CONVERT(1,\"ft\",\"in\"),CONVERT(1,\"yd\",\"in\"))"}, num(48), MS_CONVERT, "high")
cv2({"A1": "=CONVERT(CONVERT(100,\"ft\",\"m\"),\"ft\",\"m\")"}, num(9.290304), "Microsoft CONVERT example (100 square feet in square metres)", "high")
cv2({"A1": "=CONVERT(0,\"gal\",\"l\")"}, num(0), MS_CONVERT, "low")
cv2({"A1": "=CONVERT(1.5,\"hr\",\"sec\")"}, num(5400), MS_CONVERT, "high")
cv2({"A1": "=CONVERT(1,\"m\",\"m\")"}, num(1), MS_CONVERT, "low")
cv2({"A1": "=CONVERT(1,\"lbm\",\"kg\")"}, num(0.45359237), "Microsoft CONVERT example: 1 pound mass in kilograms", "high")
cv2({"A1": "=CONVERT(68,\"F\",\"C\")"}, num(20), "Microsoft CONVERT example: 68 F in C", "high")
cv2({"A1": "=CONVERT(2.5,\"ft\",\"sec\")"}, {"err": "#N/A"}, "Microsoft CONVERT example: different groups, #N/A", "low")
cv2({"A1": "=IFNA(CONVERT(1,\"m\",\"s\"),\"check units\")"}, {"text": "check units"}, "Microsoft: units of different groups give #N/A; IFNA", "medium")
cv2({"A1": "=ISNA(CONVERT(1,\"kg\",\"m\"))"}, {"bool": True}, "Microsoft: units of different groups give #N/A", "medium")
cv2({"A1": "=CONVERT(\"abc\",\"m\",\"ft\")"}, {"err": "#VALUE!"}, "Microsoft: wrong input data types give #VALUE!", "low")
cv2({"A1": "=CONVERT(1,\"kim\",\"m\")"}, {"err": "#N/A"}, "Microsoft: a binary prefix on a unit that does not take one is #N/A", "low")
cv2({"A1": "=CONVERT(1,\"kmi\",\"mi\")"}, {"any": [{"err": "#N/A"}, num(1000)]}, "Excel: mi takes no prefix (#N/A, as LibreOffice); a lenient 1000 mi is right physically", "low")
cv2({"A1": "100", "B1": "=CONVERT(A1,\"km/h\",\"mph\")", "C1": "=ROUND(B1,1)"}, num(62.1), MS_CONVERT, "high", "C1")
cv2({"A1": "=CONVERT(-40,\"F\",\"C\")"}, num(-40), MS_CONVERT, "high")
cv2({"A1": "=CONVERT(1,\"cup\",\"tsp\")"}, num(48), MS_CONVERT, "high")
cv2({"A1": "=CONVERT(1,\"gal\",\"tsp\")"}, num(768), MS_CONVERT, "high")
cv2({"A1": "=CONVERT(1,\"m\",\"ft\")*CONVERT(1,\"m\",\"ft\")"}, num(float(1 / (X.FT * X.FT))), MS_CONVERT, "medium")
cv2({"A1": "lbm", "B1": "=CONVERT(2,A1,\"kg\")"}, num(0.90718474), MS_CONVERT, "high", "B1")
cv2({"A1": "=CONVERT(1,\"kg\",\"kg\")"}, num(1), MS_CONVERT, "low")
cv2({"A1": "=CONVERT(1E-3,\"km\",\"m\")"}, num(1), MS_CONVERT, "medium")
cv2({"A1": "=CONVERT(5,\"Gibyte\",\"Gbyte\")"}, num(5 * 2 ** 30 / 1e9), MS_CONVERT, "medium")

# ---------------------------------------------------------------------------------------------------------------
# 2. CONVERT in a sheet where Excel gives #N/A: Lantern may read leniently (allowed); the reading must be right
fbn = 0
def fb(x, a, b, phys, harm, note=None, tol=1e-9, unjudged=None):
    global fbn
    fbn += 1
    v, _ = X.convert(x, a, b)
    assert v == "#N/A", (x, a, b, v)
    oks = [{"err": "#N/A"}]
    kw0 = {"errharm": "low"}
    for p in (phys if isinstance(phys, list) else [phys]):
        if p is not None:
            oks.append(num(p, tol))
    kw = {"group": "convert-fallback"}
    kw.update(kw0)
    if note: kw["note"] = note
    if unjudged: kw["unjudged"] = unjudged
    f = "=CONVERT(%s,%s,%s)" % (x, q(a), q(b))
    add("fb-%03d" % fbn, "sheet", {"cells": {"A1": f}}, {"any": oks},
        "Excel gives #N/A (" + MS_CONVERT + "); the lenient reading must be right physically", harm, **kw)

LB = 0.45359237
fb(1, "KG", "g", 1000, "low", "wrong case")
fb(1, "lb", "kg", LB, "high")
fb(2, "pounds", "kg", 2 * LB, "high")
fb(1, "tonne", "kg", 1000, "high")
fb(1, "t", "kg", 1000, "medium")
fb(8, "oz", "g", 8 * LB / 16 * 1000, "high", "oz is a fluid ounce to Excel; a mass reading next to g is right")
fb(1, "lbs", "kg", LB, "high")
fb(1, "bar", "psi", float(Fr(100000) / X.U["psi"][1]), "high")
fb(1, "bar", "kPa", 100, "high")
fb(1, "kph", "mph", float(Fr(1000, 3600) / X.U["mph"][1]), "medium")
fb(1, "acre", "m2", [4046.8564224, float(X.U["us_acre"][1])], "high", "international or US survey acre")
fb(1, "sqft", "m2", 0.09290304, "medium")
fb(1, "cc", "ml", 1, "medium")
fb(1, "Cal", "kJ", [4.1868, 4.184], "medium", "food Calorie = kcal (IT or thermochemical)")
fb(100, "c", "F", 212, "low", "c is Excel's thermochemical calorie; Celsius is the lenient reading")
fb(1, "Km", "m", 1000, "low")
fb(1, "hp", "kW", float(X.HP) / 1000, "medium")
fb(1, "Btu", "J", 1055.05585262, "medium")
fb(2, "h", "mn", 120, "low", "h is horsepower to Excel; hour is the lenient reading next to a time")
fb(1, "wk", "day", 7, "medium")
fb(1, "week", "hr", 168, "medium")
fb(1, "inch", "cm", 2.54, "medium")
fb(1, "feet", "m", 0.3048, "medium")
fb(1, "miles", "km", 1.609344, "medium")
fb(1, "liter", "ml", 1000, "medium")
fb(1, "gallon", "l", 3.785411784, "medium", "US gallon")
fb(1, "nmi", "km", 1.852, "low", "nautical mile")
fb(1, "KM", "MI", float(Fr(1000) / X.MI), "low")
fb(1, "LBM", "KG", LB, "low")
fb(1, "Hz", "kHz", 0.001, "low")
fb(1, "mbar", "Pa", 100, "medium")
fb(1, "kgf", "N", 9.80665, "medium")
fb(1, "fl oz", "ml", float(X.GAL / 128 * 10 ** 6), "medium")
fb(1, "oz", "lbm", 0.0625, "high", "beside lbm the ounce is the ounce of weight")
fb(1, "lb", "oz", 16, "high", "beside lb the ounce is the ounce of weight")
fb(1, "kg", "oz", float(Fr(1) / (X.LBM / 16)), "high")
fb(1, "oz", "kg", float(X.LBM / 16), "high")
fb(1, "ton", "lb", 2000, "high", "ton is the short ton in a sheet (CONVERT(1,\"ton\",\"lbm\") is 2000); the lenient lb must not change it")
fb(1, "lb", "ton", 0.0005, "high", "ton is the short ton in a sheet")
fb(1, "tonne", "ton", float(Fr(1000) / X.U["ton"][1]), "high", "ton is the short ton in a sheet")
fb(1, "pounds", "ton", 0.0005, "high", "ton is the short ton in a sheet")
fb(1, "ton", "tonne", 0.90718474, "high", "ton is the short ton in a sheet")
fb(5, "bar", "atm", 500000 / 101325, "high")
fb(1, "psi", "bar", float(X.U["psi"][1] / 100000), "high")
fb(1, "hrs", "mn", 60, "medium")
fb(1, "Tbsp", "ml", float(X.GAL / 256 * 10 ** 6), "low")
fb(1, "KWH", "kJ", 3600, "low")
fb(1, "kmh", "km/h", 1, "low")
fb(1, "ton", "t", 0.90718474, "high", "ton is the short ton in a sheet")
fb(1, "h", "hr", 1, "low")
fb(1, "Cal", "cal", [1000, 4184 / 4.1868], "low")
fb(1, "mile", "km", 1.609344, "medium")
fb(10, "lb", "ozm", 160, "high")
fb(1, "ton", "lbs", 2000, "high", "ton is the short ton in a sheet")
fb(1, "tons", "kg", [907.18474, 1000], "low", "plural, either ton")
fb(1, "metric ton", "kg", 1000, "low")
fb(1, "sq m", "ft2", float(Fr(1) / X.FT ** 2), "low")
PONDJ = "Microsoft's CONVERT page (fetched 2026-11-20) has no pond; LibreOffice lists it as its own extra"
fb(1, "pond", "N", 0.00980665, "low", unjudged=PONDJ)
fb(1, "kpond", "N", 9.80665, "low", unjudged=PONDJ)
# an Excel unit beside a lenient one: the Excel unit keeps the meaning it has in the sheet (to 15 digits), and
# ordinary lenient partners (words people type) are read right
FLIP = "the Excel unit keeps its sheet meaning beside a lenient partner (CONVERT with two Excel names gives this to 15 digits)"
fb(1, "cal", "joules", 4.1868, "medium", FLIP, tol=1e-14)
fb(1, "lbf", "kgf", LB, "low", FLIP, tol=1e-14)
fb(1, "psi", "bar", float(X.U["psi"][1] / 100000), "low", FLIP, tol=1e-14)
fb(1, "bar", "psi", float(Fr(100000) / X.U["psi"][1]), "low", FLIP, tol=1e-14)
fb(1, "yr", "days", 365.25, "medium", FLIP, tol=1e-14)
fb(1, "BTU", "joules", 1055.05585262, "medium", FLIP, tol=1e-14)
fb(1, "atm", "bar", 1.01325, "medium", FLIP, tol=1e-14)
fb(1, "gal", "liters", 3.785411784, "high", FLIP, tol=1e-14)
fb(1, "qt", "liters", 0.946352946, "high", FLIP, tol=1e-14)
fb(1, "cup", "liters", 0.2365882365, "high", FLIP, tol=1e-14)
fb(1, "mi", "kilometers", 1.609344, "high", FLIP, tol=1e-14)
fb(1, "mph", "kph", 1.609344, "high", FLIP, tol=1e-14)
fb(1, "Wh", "joules", 3600, "medium", FLIP, tol=1e-14)
fb(1, "day", "hours", 24, "high", FLIP, tol=1e-14)
fb(1, "ozm", "pounds", 0.0625, "high", FLIP, tol=1e-14)
fb(1, "ft", "meters", 0.3048, "high", FLIP, tol=1e-14)
fb(1, "lbm", "kilograms", LB, "high", FLIP, tol=1e-14)
fb(1, "sec", "minutes", 1 / 60, "medium", FLIP, tol=1e-14)
fb(1, "hr", "minutes", 60, "high", FLIP, tol=1e-14)
fb(1, "yd", "meters", 0.9144, "high", FLIP, tol=1e-14)
fb(1, "ha", "acres", [float(Fr(10000) / X.U["uk_acre"][1]), float(Fr(10000) / X.U["us_acre"][1])], "high", "either acre", tol=1e-14)
fb(1, "cwt", "pounds", 100, "medium", FLIP + " (cwt is the US hundredweight, 100 lb)", tol=1e-14)
fb(1, "uk_gal", "liters", 4.54609, "medium", FLIP, tol=1e-14)
fb(1, "tsp", "liters", float(X.GAL / 768 * 1000), "medium", FLIP, tol=1e-14)
fb(1, "stone", "pounds", 14, "medium", FLIP, tol=1e-14)
fb(1, "HP", "watts", float(X.HP), "medium", FLIP, tol=1e-14)
fb(1, "kn", "kph", 1.852, "medium", FLIP, tol=1e-14)
fb(1, "c", "joules", 4.184, "low", FLIP + " (c is the thermochemical calorie)", tol=1e-14)
fb(1, "mn", "seconds", 60, "medium", FLIP, tol=1e-14)
fb(1, "ton", "kilograms", 907.18474, "high", FLIP + " (ton is the short ton)", tol=1e-14)
fb(1, "ton", "pounds", 2000, "high", FLIP + " (ton is the short ton)", tol=1e-14)
fb(1, "ton", "metric tons", 0.90718474, "high", FLIP + " (ton is the short ton)", tol=1e-14)
# Excel gives #N/A and nothing physical can be read: must be an error (Excel's #N/A)
for a, b, harm in [("m", "s", "medium"), ("kg", "m", "medium"), ("gal", "lbm", "medium"), ("J", "W", "medium"),
                   ("mph", "m", "medium"), ("xyz", "m", "low"), ("m", "", "low"), ("C", "J", "low")]:
    fbn += 1
    add("fb-%03d" % fbn, "sheet", {"cells": {"A1": "=CONVERT(1,%s,%s)" % (q(a), q(b))}}, {"err": "#N/A"},
        "Excel gives #N/A: " + MS_CONVERT, harm, group="convert-fallback", note="no physical reading: Excel's #N/A")

# ---------------------------------------------------------------------------------------------------------------
# 3. GAMMA, GAMMAFN, LORE and LORENTZ in a sheet
MS_GAMMA = "Microsoft Support, GAMMA function (#NUM! at 0 and negative whole numbers; #VALUE! for text); the gamma function"
gn = 0
def ga(f, expect, src, harm, note=None):
    global gn
    gn += 1
    kw = {"group": "gamma"}
    if note: kw["note"] = note
    add("ga-%03d" % gn, "sheet", {"cells": {"A1": f}}, expect, src, harm, **kw)

GT = 1e-13   # Excel's GAMMA is not exact to the last digit; 13 digits
ga("=GAMMA(5)", num(24, GT), MS_GAMMA, "high")
ga("=GAMMA(0.5)", num(math.sqrt(math.pi), GT), MS_GAMMA + " (sqrt(pi))", "high")
ga("=GAMMA(1)", num(1, GT), MS_GAMMA, "medium")
ga("=GAMMA(2.5)", num(math.gamma(2.5), GT), "Microsoft GAMMA example: GAMMA(2.5) = 1.329", "high")
ga("=GAMMA(-0.75)", num(math.gamma(-0.75), GT), MS_GAMMA, "high")
ga("=GAMMA(-3.75)", num(math.gamma(-3.75), GT), "Microsoft GAMMA example: GAMMA(-3.75) = 0.268", "high")
ga("=GAMMA(30.5)", num(math.gamma(30.5), GT), MS_GAMMA, "low")
ga("=GAMMA(120.25)", num(math.gamma(120.25), GT), MS_GAMMA, "low")
ga("=GAMMA(170.5)", num(math.gamma(170.5), GT), MS_GAMMA, "low")
ga("=GAMMA(-10.5)", num(math.gamma(-10.5), GT), MS_GAMMA, "low")
ga("=GAMMA(0.001)", num(math.gamma(0.001), GT), MS_GAMMA, "low")
ga("=GAMMA(0)", {"err": "#NUM!"}, "Microsoft GAMMA example: GAMMA(0) is #NUM!", "medium")
ga("=GAMMA(-1)", {"err": "#NUM!"}, MS_GAMMA, "medium")
ga("=GAMMA(-2)", {"err": "#NUM!"}, "Microsoft GAMMA example: GAMMA(-2) is #NUM!", "medium")
ga("=GAMMA(171)", num(math.gamma(171), GT), MS_GAMMA + " (170!)", "low")
ga("=GAMMA(172)", {"err": "#NUM!"}, MS_GAMMA + " (above about 171.62 the result overflows)", "low")
ga("=GAMMA(171.6)", num(math.gamma(171.6), GT), MS_GAMMA, "low")
ga("=GAMMA(171.7)", {"err": "#NUM!"}, MS_GAMMA, "low")
ga("=GAMMA(1.5)", num(math.gamma(1.5), GT), MS_GAMMA, "medium")
ga("=GAMMA(10)", num(362880, GT), MS_GAMMA + " (9!)", "medium")
ga("=GAMMA(-0.5)", num(math.gamma(-0.5), GT), MS_GAMMA, "medium")
ga("=GAMMA(1/3)", num(math.gamma(1 / 3), GT), MS_GAMMA, "low")
ga("=GAMMA(\"a\")", {"err": "#VALUE!"}, MS_GAMMA, "low")
ga("=GAMMAFN(5)", num(24, GT), "draft rule: GAMMAFN (1.24.28's name) still works", "medium")
ga("=GAMMALN(4)", num(math.log(6), GT), "Microsoft GAMMALN: LN(GAMMA(x))", "medium")
ga("=GAMMALN.PRECISE(4.5)", num(math.lgamma(4.5), GT), "Microsoft GAMMALN.PRECISE example 2.453737", "low")
ga("=GAMMA.DIST(10.00001131,9,2,FALSE)", num(float(SS.gamma.pdf(10.00001131, 9, scale=2)), 1e-9), "Microsoft GAMMA.DIST example: 0.032639", "low")
ga("=GAMMA.DIST(10.00001131,9,2,TRUE)", num(float(SS.gamma.cdf(10.00001131, 9, scale=2)), 1e-9), "Microsoft GAMMA.DIST example: 0.068094", "low")
ga("=GAMMA(150000000)", {"err": "#NUM!"}, MS_GAMMA + "; the draft's rule: a speed gives #NUM!", "medium")
ga("=LORE(0.6*299792458)", num(1.25, 1e-12), "physics: 1/sqrt(1-v^2/c^2), v = 0.6c", "high")
ga("=LORENTZ(0.8,1)", num(1 / 0.6, 1e-12), "physics: v = 0.8 with c = 1", "medium")
ga("=LORE(0)", num(1, 1e-12), "physics: at rest", "low")
ga("=GAMMA(0.5)^2", num(math.pi, GT), MS_GAMMA, "low")
ga("=GAMMA(3)", num(2, GT), MS_GAMMA, "medium")
ga("=GAMMA(100)", num(math.gamma(100), GT), MS_GAMMA + " (99!)", "low")
ga("=GAMMA(-1.5)", num(math.gamma(-1.5), GT), MS_GAMMA, "low")
ga("=GAMMA(1000)", {"err": "#NUM!"}, MS_GAMMA, "low")
ga("=LORE(299792458)", {"any": [{"err": "#NUM!"}, {"err": "#DIV/0!"}]}, "physics: no Lorentz factor at the speed of light", "low")
ga("=FACT(4)=GAMMA(5)", {"bool": True}, MS_GAMMA, "low")
ga("=GAMMA(2.5)*GAMMA(0.5)", num(math.gamma(2.5) * math.gamma(0.5), GT), MS_GAMMA, "low")

# ---------------------------------------------------------------------------------------------------------------
# 4. The chat calculator (Lantern.formula.evaluate, outside a sheet). Recorded separately.
chn = 0
def ch(expr, expect, src, harm, note=None, design=False):
    global chn
    chn += 1
    kw = {"group": "chat"}
    if note: kw["note"] = note
    if design: kw["design"] = True
    add("ch-%03d" % chn, "chat", {"expr": expr}, expect, src, harm, **kw)

ch("GAMMA(5)", num(24, GT), "draft rule: GAMMA is the gamma function in the calculator too", "high")
ch("GAMMA(0.5)", num(math.sqrt(math.pi), GT), MS_GAMMA, "medium")
ch("GAMMA(0)", {"err": "#NUM!"}, MS_GAMMA, "low")
ch("GAMMA(150000000)", {"err": "#NUM!", "msg": "LORE"}, "draft rule: a speed given to GAMMA gets #NUM! naming LORE", "medium")
ch("LORE(0.6*299792458)", num(1.25, 1e-12), "physics", "high")
ch("LORENTZ(0.6*299792458)", num(1.25, 1e-12), "physics", "medium")
ch("GAMMAFN(4)", num(6, GT), "draft rule", "low")
ch("CONVERT(1,\"ton\",\"kg\")", num(1000), "draft's stated design: the calculator keeps Lantern's older reading (ton = tonne)", "medium",
   note="Excel's ton is 907.18474 kg: the same formula gives another number in a sheet", design=True)
ch("CONVERT(1,\"kg\",\"lbm\")", num(X.convert(1, "kg", "lbm")[0]), MS_CONVERT, "high")
ch("CONVERT(100,\"km/h\",\"mph\")", num(X.convert(100, "km/h", "mph")[0]), MS_CONVERT, "high")
ch("CONVERT(68,\"F\",\"C\")", num(20), MS_CONVERT, "high")
ch("CONVERT(1,\"gal\",\"l\")", num(3.785411784), MS_CONVERT, "high")
ch("CONVERT(1,\"hr\",\"mn\")", num(60), MS_CONVERT + " (mn is Excel's minute)", "medium", note="Excel's own formula typed in the calculator")
ch("CONVERT(8,\"oz\",\"g\")", num(226.796185), "draft: the calculator's lenient reading of ounces beside grams", "medium")
ch("CONVERT(1,\"cup\",\"ml\")", num(236.5882365), MS_CONVERT, "high")
ch("CONVERT(1,\"kWh\",\"J\")", num(3.6e6), MS_CONVERT, "high")
ch("CONVERT(1,\"psi\",\"kPa\")", num(X.convert(1, "psi", "kPa")[0]), MS_CONVERT, "low")
ch("CONVERT(1,\"lb\",\"kg\")", num(LB), "lenient pound", "high")
ch("CONVERT(1,\"tonne\",\"kg\")", num(1000), "lenient tonne", "medium")
ch("CONVERT(1,\"h\",\"W\")", {"any": [num(float(X.HP)), {"err": "#N/A"}, {"err": "error"}]}, "Excel: h is horsepower (745.69987158227); the calculator's h is an hour", "low",
   note="split: Excel reads h as horsepower", design=True)
ch("CONVERT(1,\"ozm\",\"g\")", num(28.349523125), MS_CONVERT, "medium")
ch("CONVERT(1,\"Nmi\",\"km\")", num(1.852), MS_CONVERT, "medium")
ch("CONVERT(1,\"us_acre\",\"m2\")", num(float(X.U["us_acre"][1])), MS_CONVERT, "medium")
ch("CONVERT(1,\"uk_gal\",\"l\")", num(4.54609), MS_CONVERT, "medium")
ch("CONVERT(1,\"Mibit\",\"bit\")", num(1048576), MS_CONVERT, "low")
ch("CONVERT(1,\"cal\",\"J\")", num(4.1868), MS_CONVERT + " (cal is the IT calorie)", "medium")
ch("CONVERT(1,\"mn\",\"s\")", num(60), MS_CONVERT, "medium", note="Excel's own formula typed in the calculator")
ch("CONVERT(1,\"ft2\",\"m2\")", num(0.09290304), MS_CONVERT, "medium")
ch("CONVERT(1,\"m3\",\"l\")", num(1000), MS_CONVERT, "medium")
ch("CONVERT(1,\"HP\",\"W\")", num(float(X.HP)), MS_CONVERT, "medium")
ch("CONVERT(1,\"Rank\",\"K\")", num(5 / 9), MS_CONVERT, "low")
ch("CONVERT(1,\"kn\",\"km/h\")", num(1.852), MS_CONVERT, "medium")
ch("CONVERT(1,\"lbm\",\"ton\")", {"any": [num(0.0005), num(0.00045359237)]}, "split: Excel 0.0005 (short ton); the calculator's ton is the tonne", "low", design=True)
ch("CONVERT(1,\"ton\",\"lbm\")", {"any": [num(2000), num(1000 / LB)]}, "split: Excel 2000", "low", design=True)
ch("CONVERT(1,\"c\",\"J\")", {"any": [num(4.184), {"err": "error"}]}, MS_CONVERT + " (c is the thermochemical calorie)", "low", design=True)
ch("CONVERT(1,\"m\",\"s\")", {"err": "error"}, "units of different kinds: an error", "low")
ch("CONVERT(1,\"day\",\"hr\")", num(24), MS_CONVERT, "medium")
ch("CONVERT(1,\"yr\",\"day\")", num(365.25), MS_CONVERT, "medium")
ch("CONVERT(1,\"Mg\",\"kg\")", num(1000), MS_CONVERT, "low")

# ---------------------------------------------------------------------------------------------------------------
# 5. Save .xlsx (Lantern.xlsx.write): CONVERT's units, GAMMA, GAMMAFN, LORE
xn = 0
def xl(cells, ref, expect, harm, note=None, unjudged=None):
    global xn
    xn += 1
    kw = {"group": "xlsx"}
    if unjudged: kw["unjudged"] = unjudged
    if note: kw["note"] = note
    add("xl-%03d" % xn, "xlsx", {"cells": cells, "ref": ref}, expect, "draft rule 3; Excel's value worked out from the saved formula by excel_ref (the reviewer's reading of Microsoft's CONVERT)", harm, **kw)

# expect: value = the number Excel must show for the saved cell; formula: "convert" (saved as CONVERT with Excel's
# names: replay works it out), "value" (saved as its value), a regex string, or a list of allowed modes; note: regex
xl({"A1": "=CONVERT(1,\"lb\",\"kg\")"}, "A1", {"value": LB, "mode": ["convert"]}, "high")
xl({"A1": "=CONVERT(2,\"h\",\"min\")"}, "A1", {"value": 120, "mode": ["convert"]}, "high", "an hour h beside a time")
xl({"A1": "=CONVERT(1,\"tonne\",\"kg\")"}, "A1", {"value": 1000, "mode": ["convert"]}, "high")
xl({"A1": "=CONVERT(3,\"pounds\",\"kg\")"}, "A1", {"value": 3 * LB, "mode": ["convert"]}, "high")
xl({"A1": "=CONVERT(1,\"bar\",\"psi\")"}, "A1", {"value": float(Fr(100000) / X.U["psi"][1]), "mode": ["value"], "note": "A1"}, "high", "bar has no Excel name")
xl({"A1": "=GAMMA(5)"}, "A1", {"value": 24, "mode": ["^_xlfn\\.GAMMA\\(5\\)$"]}, "high")
xl({"A1": "=GAMMAFN(5)"}, "A1", {"value": 24, "mode": ["^_xlfn\\.GAMMA\\(5\\)$"]}, "high")
xl({"A1": "=LORE(0.6*299792458)"}, "A1", {"value": 1.25, "mode": ["^LORE\\(", "value"], "note": "LORE"}, "medium", "kept as Lantern's own, with its value and a note")
xl({"A1": "=CONVERT(8,\"oz\",\"g\")"}, "A1", {"value": 226.796185, "mode": ["convert"]}, "high")
xl({"A1": "=CONVERT(1,\"ton\",\"kg\")"}, "A1", {"value": 907.18474, "mode": ["convert"]}, "high")
xl({"A1": "=CONVERT(1,\"KG\",\"g\")"}, "A1", {"value": 1000, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(100,\"kph\",\"mph\")"}, "A1", {"value": float(Fr(100000, 3600) / X.U["mph"][1]), "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(1,\"sqft\",\"m2\")"}, "A1", {"value": 0.09290304, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(1,\"acre\",\"m2\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "medium", "Excel's value must be the one Lantern shows")
xl({"A1": "=CONVERT(1,\"t\",\"kg\")"}, "A1", {"value": 1000, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(100,\"c\",\"F\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "medium", "whatever Lantern shows, Excel must show the same")
xl({"A1": "=CONVERT(1,\"Cal\",\"kJ\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(1,\"hp\",\"kW\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "low", "Lantern's hp is 745.6998716 W; Excel's HP is 745.69987158227 W")
xl({"A1": "=CONVERT(1,\"Btu\",\"J\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(1,\"kwh\",\"J\")"}, "A1", {"value": 3.6e6, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(1,\"week\",\"day\")"}, "A1", {"value": 7, "mode": ["convert", "value"]}, "medium")
xl({"A1": "1", "B1": "lb", "C1": "kg", "D1": "=CONVERT(A1,B1,C1)"}, "D1", {"value": LB, "mode": ["convert", "value"]}, "medium",
   "units in cells: Excel reads lb in B1 as #N/A unless the save sees to it")
xl({"A1": "=CONVERT(1,\"lbm\",\"kg\")"}, "A1", {"value": LB, "mode": ["^CONVERT\\(1,\"lbm\",\"kg\"\\)$"]}, "high", "Excel's own names unchanged")
xl({"A1": "=CONVERT(5,\"bar\",\"atm\")"}, "A1", {"value": 500000 / 101325, "mode": ["value"], "note": "A1"}, "high")
xl({"A1": "=CONVERT(1,\"ton\",\"lb\")"}, "A1", {"value": 2000, "mode": ["convert", "value"]}, "high", "a sheet's ton is the short ton")
xl({"A1": "=CONVERT(1,\"tonne\",\"ton\")"}, "A1", {"value": float(Fr(1000) / X.U["ton"][1]), "mode": ["convert", "value"]}, "high", "a sheet's ton is the short ton")
xl({"A1": "=GAMMA(0.5)*2"}, "A1", {"value": 2 * math.sqrt(math.pi), "mode": ["^_xlfn\\.GAMMA\\(0\\.5\\)\\*2$"]}, "medium")
xl({"A1": "=LORENTZ(0.6,1)"}, "A1", {"value": 1.25, "mode": ["^LORENTZ\\(", "value"], "note": "LORENTZ"}, "low")
xl({"A1": "=CONVERT(1,\"oz\",\"ml\")"}, "A1", {"value": 29.5735295625, "mode": ["^CONVERT\\(1,\"oz\",\"ml\"\\)$"]}, "high", "oz beside ml is Excel's fluid ounce, kept")
xl({"A1": "=CONVERT(1,\"lb\",\"oz\")"}, "A1", {"value": 16, "mode": ["convert", "value"]}, "high")
xl({"A1": "=CONVERT(1,\"inch\",\"cm\")"}, "A1", {"value": 2.54, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(1,\"liter\",\"gal\")"}, "A1", {"value": float(Fr(1, 1000) / X.GAL), "mode": ["convert", "value"]}, "medium")
xl({"A1": "=SUM(CONVERT(1,\"lb\",\"kg\"),CONVERT(1000,\"pounds\",\"g\")/1000)"}, "A1", {"value": LB + 1000 * LB, "mode": ["^SUM\\(CONVERT\\(1,\"lbm\",\"kg\"\\),CONVERT\\(1000,\"lbm\",\"g\"\\)/1000\\)$"]}, "high")
xl({"A1": "=IFERROR(CONVERT(1,\"lb\",\"kg\"),0)"}, "A1", {"value": LB, "mode": ["^IFERROR\\(CONVERT\\(1,\"lbm\",\"kg\"\\),0\\)$"]}, "high")
xl({"A1": "=CONVERT(1,\"mbar\",\"Pa\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "medium", "whatever Lantern shows, Excel must show the same")
xl({"A1": "=CONVERT(1,\"hrs\",\"mn\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "medium", "whatever Lantern shows, Excel must show the same")
xl({"A1": "=CONVERT(1,\"kpond\",\"N\")"}, "A1", {"value": 9.80665, "mode": ["convert", "value"]}, "low", unjudged=PONDJ)
xl({"A1": "=CONVERT(1,\"cal\",\"joules\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "medium", "whatever Lantern shows, Excel must show the same")
xl({"A1": "=CONVERT(1,\"lbf\",\"kgf\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "low", "whatever Lantern shows, Excel must show the same")
xl({"A1": "=CONVERT(1,\"psi\",\"bar\")"}, "A1", {"value": float(X.U["psi"][1] / 100000), "mode": ["value"], "note": "A1"}, "medium", "bar has no Excel name")
xl({"A1": "=CONVERT(1,\"yr\",\"days\")"}, "A1", {"value": 365.25, "mode": ["convert", "value"]}, "medium")
xl({"A1": "=CONVERT(10,\"mi\",\"kilometers\")"}, "A1", {"value": 16.09344, "mode": ["convert", "value"]}, "high")
xl({"A1": "=CONVERT(1,\"Schooner\",\"l\")"}, "A1", {"value": None, "mode": ["convert", "value", "^CONVERT"]}, "low", "an error stays an error")
xl({"A1": "=CONVERT(1,\"ton\",\"kilograms\")"}, "A1", {"value": 907.18474, "mode": ["convert", "value"]}, "high", "a sheet's ton is the short ton")
xl({"A1": "=CONVERT(1,\"kmh\",\"mph\")"}, "A1", {"value": None, "mode": ["convert", "value"]}, "low")
xl({"A1": "=CONVERT(1,\"m\",\"s\")"}, "A1", {"value": "#N/A", "mode": ["convert", "value", "^CONVERT"]}, "low", "an error stays an error")
xl({"A1": "=CONVERT(150,\"lbs\",\"kg\")"}, "A1", {"value": 150 * LB, "mode": ["convert"]}, "high")
xl({"A1": "=CONVERT(2,\"cup\",\"ml\")"}, "A1", {"value": 473.176473, "mode": ["^CONVERT\\(2,\"cup\",\"ml\"\\)$"]}, "high")

# ---------------------------------------------------------------------------------------------------------------
# 6. Audit: every function name Lantern shares with Excel (sheet), Excel's answer from Microsoft's page for it
an = 0
def au(f, expect, src, harm="medium", cells=None, ref="A1", note=None):
    global an
    an += 1
    c = dict(cells or {})
    c[ref] = f
    kw = {"group": "audit"}
    if note: kw["note"] = note
    add("au-%03d" % an, "sheet", {"cells": c, "ref": ref}, expect, src, harm, **kw)

def ms(fn):
    return "Microsoft Support, %s function" % fn

T = lambda s: {"text": s}
B = lambda b: {"bool": b}
E = lambda e: {"err": e}

# maths and rounding
au("=ABS(-3)", num(3), ms("ABS"))
au("=ACOS(-1)", num(math.pi), ms("ACOS"))
au("=ACOSH(10)", num(math.acosh(10)), ms("ACOSH"), "low")
au("=ASIN(-0.5)", num(-math.pi / 6), ms("ASIN"))
au("=ASINH(10)", num(math.asinh(10)), ms("ASINH"), "low")
au("=ATAN(1)", num(math.pi / 4), ms("ATAN"))
au("=ATAN2(1,1)", num(math.pi / 4), ms("ATAN2") + " example", "high")
au("=ATAN2(-1,-1)", num(-3 * math.pi / 4), ms("ATAN2") + " example: -2.35619449", "high")
au("=ATAN2(0,1)", num(math.pi / 2), ms("ATAN2") + ": ATAN2(x_num, y_num), x first", "high")
au("=ATAN2(1,0)", num(0), ms("ATAN2") + ": ATAN2(x_num, y_num), x first", "high")
au("=ATAN2(0,0)", E("#DIV/0!"), ms("ATAN2") + ": both 0 is #DIV/0!", "low")
au("=ATAN2(-1,0)", num(math.pi), ms("ATAN2"), "medium")
au("=ATANH(0.76159416)", num(math.atanh(0.76159416)), ms("ATANH") + " example 1.00000001", "low")
au("=COS(PI())", num(-1), ms("COS"))
au("=SIN(PI()/2)", num(1), ms("SIN"))
au("=TAN(0.785)", num(math.tan(0.785)), ms("TAN") + " example 0.99920399", "low")
au("=DEGREES(PI())", num(180), ms("DEGREES"))
au("=RADIANS(270)", num(3 * math.pi / 2), ms("RADIANS") + " example 4.712389")
au("=EXP(1)", num(math.e), ms("EXP"))
au("=LN(86)", num(math.log(86)), ms("LN") + " example 4.4543473")
au("=LOG(10)", num(1), ms("LOG") + ": base 10 when left out", "high")
au("=LOG(8,2)", num(3), ms("LOG") + " example", "high")
au("=LOG(86,2.7182818)", num(math.log(86) / math.log(2.7182818)), ms("LOG") + " example 4.4543473")
au("=LOG(10,1)", E("#DIV/0!"), ms("LOG") + ": base 1", "low")
au("=LOG(0)", E("#NUM!"), ms("LOG"), "low")
au("=LOG10(86)", num(math.log10(86)), ms("LOG10") + " example 1.9345")
au("=LOG10(1E5)", num(5), ms("LOG10") + " example", "low")
au("=SQRT(16)", num(4), ms("SQRT"))
au("=SQRT(-16)", E("#NUM!"), ms("SQRT") + " example", "medium")
au("=SQRTPI(2)", num(math.sqrt(2 * math.pi)), ms("SQRTPI") + " example 2.506628", "low")
au("=SIGN(-0.00001)", num(-1), ms("SIGN"))
au("=SIGN(0)", num(0), ms("SIGN"), "low")
au("=POWER(5,2)", num(25), ms("POWER") + " example")
au("=POWER(98.6,3.2)", num(98.6 ** 3.2), ms("POWER") + " example 2401077.222")
au("=POWER(4,5/4)", num(4 ** 1.25), ms("POWER") + " example 5.656854")
au("=POWER(0,0)", E("#NUM!"), "Excel: 0 to the power 0 is #NUM! (Microsoft: the ^ operator and POWER)", "low")
au("=POWER(-8,1/3)", E("#NUM!"), "Excel: a negative number to a fractional power is #NUM!", "low")
au("=POWER(0,-1)", E("#DIV/0!"), "Excel: 0 to a negative power is #DIV/0!", "low")
au("=0^0", E("#NUM!"), "Excel: 0^0 is #NUM!", "low")
au("=PRODUCT(5,15,30)", num(2250), ms("PRODUCT") + " example")
au("=SUMSQ(3,4)", num(25), ms("SUMSQ") + " example")
au("=MOD(3,2)", num(1), ms("MOD") + " example", "high")
au("=MOD(-3,2)", num(1), ms("MOD") + " example: the sign of the divisor", "high")
au("=MOD(3,-2)", num(-1), ms("MOD") + " example", "high")
au("=MOD(-3,-2)", num(-1), ms("MOD") + " example", "high")
au("=MOD(5.5,2)", num(1.5), ms("MOD"), "medium")
au("=MOD(1,0)", E("#DIV/0!"), ms("MOD"), "low")
au("=MOD(-10,3)", num(2), ms("MOD"), "high")
au("=QUOTIENT(5,2)", num(2), ms("QUOTIENT") + " example")
au("=QUOTIENT(-10,3)", num(-3), ms("QUOTIENT") + " example: toward zero", "high")
au("=QUOTIENT(4.5,3.1)", num(1), ms("QUOTIENT") + " example")
au("=INT(8.9)", num(8), ms("INT") + " example", "high")
au("=INT(-8.9)", num(-9), ms("INT") + " example: down, away from zero", "high")
au("=TRUNC(8.9)", num(8), ms("TRUNC") + " example", "high")
au("=TRUNC(-8.9)", num(-8), ms("TRUNC") + " example", "high")
au("=TRUNC(0.45)", num(0), ms("TRUNC") + " example")
au("=TRUNC(3.14159,2)", num(3.14), ms("TRUNC"))
au("=TRUNC(1234.5,-2)", num(1200), ms("TRUNC"), "low")
au("=ROUND(2.15,1)", num(2.2), ms("ROUND") + " example", "high")
au("=ROUND(2.149,1)", num(2.1), ms("ROUND") + " example", "high")
au("=ROUND(-1.475,2)", num(-1.48), ms("ROUND") + " example", "high")
au("=ROUND(21.5,-1)", num(20), ms("ROUND") + " example", "high")
au("=ROUND(626.3,-3)", num(1000), ms("ROUND") + " example")
au("=ROUND(1.98,-1)", num(0), ms("ROUND") + " example")
au("=ROUND(-50.55,-2)", num(-100), ms("ROUND") + " example")
au("=ROUND(2.5,0)", num(3), ms("ROUND") + ": half away from zero", "high")
au("=ROUND(-2.5,0)", num(-3), ms("ROUND") + ": half away from zero", "high")
au("=ROUND(1.005,2)", num(1.01), "Excel: ROUND(1.005,2) is 1.01 (Excel rounds the 15-digit decimal it shows)", "medium")
au("=ROUND(2.675,2)", num(2.68), "Excel: ROUND(2.675,2) is 2.68", "medium")
au("=ROUND(0.285,2)", num(0.29), "Excel: ROUND(0.285,2) is 0.29", "medium")
au("=ROUNDUP(3.2,0)", num(4), ms("ROUNDUP") + " example", "high")
au("=ROUNDUP(76.9,0)", num(77), ms("ROUNDUP") + " example")
au("=ROUNDUP(3.14159,3)", num(3.142), ms("ROUNDUP") + " example")
au("=ROUNDUP(-3.14159,1)", num(-3.2), ms("ROUNDUP") + " example: away from zero", "high")
au("=ROUNDUP(31415.92654,-2)", num(31500), ms("ROUNDUP") + " example")
au("=ROUNDDOWN(3.2,0)", num(3), ms("ROUNDDOWN") + " example")
au("=ROUNDDOWN(76.9,0)", num(76), ms("ROUNDDOWN") + " example")
au("=ROUNDDOWN(3.14159,3)", num(3.141), ms("ROUNDDOWN") + " example")
au("=ROUNDDOWN(-3.14159,1)", num(-3.1), ms("ROUNDDOWN") + " example: toward zero", "high")
au("=ROUNDDOWN(31415.92654,-2)", num(31400), ms("ROUNDDOWN") + " example")
au("=MROUND(10,3)", num(9), ms("MROUND") + " example")
au("=MROUND(-10,-3)", num(-9), ms("MROUND") + " example")
au("=MROUND(1.3,0.2)", num(1.4), ms("MROUND") + " example")
au("=MROUND(5,-2)", E("#NUM!"), ms("MROUND") + " example", "low")
au("=FLOOR(3.7,2)", num(2), ms("FLOOR") + " example", "high")
au("=FLOOR(-2.5,-2)", num(-2), ms("FLOOR") + " example", "high")
au("=FLOOR(2.5,-2)", E("#NUM!"), ms("FLOOR") + " example", "low")
au("=FLOOR(1.58,0.1)", num(1.5), ms("FLOOR") + " example", "high")
au("=FLOOR(0.234,0.01)", num(0.23), ms("FLOOR") + " example", "high")
au("=FLOOR(-2.5,2)", num(-4), ms("FLOOR") + ": negative number, positive significance: away from zero (Excel 2010 and later)", "medium")
au("=CEILING(2.5,1)", num(3), ms("CEILING") + " example", "high")
au("=CEILING(-2.5,-2)", num(-4), ms("CEILING") + " example", "high")
au("=CEILING(-2.5,2)", num(-2), ms("CEILING") + " example", "high")
au("=CEILING(1.5,0.1)", num(1.5), ms("CEILING") + " example", "high")
au("=CEILING(0.234,0.01)", num(0.24), ms("CEILING") + " example", "high")
au("=CEILING(2.5,-2)", E("#NUM!"), "Excel: a positive number with a negative significance is #NUM!", "low")
au("=CEILING.MATH(24.3,5)", num(25), ms("CEILING.MATH") + " example")
au("=CEILING.MATH(6.7)", num(7), ms("CEILING.MATH") + " example")
au("=CEILING.MATH(-8.1,2)", num(-8), ms("CEILING.MATH") + " example")
au("=CEILING.MATH(-5.5,2,-1)", num(-6), ms("CEILING.MATH") + " example")
au("=CEILING.PRECISE(4.3)", num(5), ms("CEILING.PRECISE") + " example")
au("=CEILING.PRECISE(-4.3)", num(-4), ms("CEILING.PRECISE") + " example")
au("=CEILING.PRECISE(4.3,-2)", num(6), ms("CEILING.PRECISE") + " example")
au("=CEILING.PRECISE(-4.3,-2)", num(-4), ms("CEILING.PRECISE") + " example")
au("=FLOOR.MATH(24.3,5)", num(20), ms("FLOOR.MATH") + " example")
au("=FLOOR.MATH(6.7)", num(6), ms("FLOOR.MATH") + " example")
au("=FLOOR.MATH(-8.1,2)", num(-10), ms("FLOOR.MATH") + " example")
au("=FLOOR.MATH(-5.5,2,-1)", num(-4), ms("FLOOR.MATH") + " example")
au("=FLOOR.PRECISE(-3.2,-1)", num(-4), ms("FLOOR.PRECISE") + " example")
au("=FLOOR.PRECISE(3.2,-1)", num(3), ms("FLOOR.PRECISE") + " example")
au("=FLOOR.PRECISE(-3.2,1)", num(-4), ms("FLOOR.PRECISE") + " example")
au("=FLOOR.PRECISE(3.2)", num(3), ms("FLOOR.PRECISE") + " example")
au("=EVEN(1.5)", num(2), ms("EVEN") + " example")
au("=EVEN(3)", num(4), ms("EVEN") + " example")
au("=EVEN(2)", num(2), ms("EVEN") + " example")
au("=EVEN(-1)", num(-2), ms("EVEN") + " example")
au("=ODD(1.5)", num(3), ms("ODD") + " example")
au("=ODD(3)", num(3), ms("ODD") + " example")
au("=ODD(2)", num(3), ms("ODD") + " example")
au("=ODD(-1)", num(-1), ms("ODD") + " example")
au("=ODD(-2)", num(-3), ms("ODD") + " example")
au("=ODD(0)", num(1), "Excel: ODD(0) is 1", "low")
au("=FACT(5)", num(120), ms("FACT") + " example", "high")
au("=FACT(1.9)", num(1), ms("FACT") + " example: truncated", "medium")
au("=FACT(0)", num(1), ms("FACT") + " example")
au("=FACT(-1)", E("#NUM!"), ms("FACT") + " example", "low")
au("=COMBIN(8,2)", num(28), ms("COMBIN") + " example")
au("=PERMUT(100,3)", num(970200), ms("PERMUT") + " example")
au("=PERMUT(3,2)", num(6), ms("PERMUT") + " example")
au("=GCD(5,2)", num(1), ms("GCD") + " example")
au("=GCD(24,36)", num(12), ms("GCD") + " example")
au("=GCD(5,0)", num(5), ms("GCD") + " example", "low")
au("=LCM(5,2)", num(10), ms("LCM") + " example")
au("=LCM(24,36)", num(72), ms("LCM") + " example")
au("=PI()", num(math.pi), ms("PI"))
au("=RANDBETWEEN(7,7)", num(7), ms("RANDBETWEEN"), "low")
au("=AND(RAND()>=0,RAND()<1)", B(True), ms("RAND"), "low")
# statistics
S1 = [1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299]
S1s = ",".join(str(v) for v in S1)
au("=AVERAGE(10,7,9,27,2)", num(11), ms("AVERAGE") + " example")
au("=AVEDEV(4,5,6,7,5,4,3)", num(st.mean([abs(v - st.mean([4, 5, 6, 7, 5, 4, 3])) for v in [4, 5, 6, 7, 5, 4, 3]])), ms("AVEDEV") + " example 1.020408")
au("=AVERAGE(A2:A4)", num(15), ms("AVERAGE") + ": text in a range is left out", "high", cells={"A2": "10", "A3": "x", "A4": "20"})
au("=AVERAGEA(A2:A4)", num(10), ms("AVERAGEA") + ": text in a range counts as 0", "medium", cells={"A2": "10", "A3": "x", "A4": "20"})
SALES = {"A2": "100000", "A3": "200000", "A4": "300000", "A5": "400000", "B2": "7000", "B3": "14000", "B4": "21000", "B5": "28000"}
au("=AVERAGEIF(B2:B5,\"<23000\")", num(14000), ms("AVERAGEIF") + " example", cells=SALES)
au("=AVERAGEIF(A2:A5,\">250000\")", num(350000), ms("AVERAGEIF") + " example", cells=SALES)
au("=AVERAGEIF(A2:A5,\"<95000\")", E("#DIV/0!"), ms("AVERAGEIF") + " example", "low", cells=SALES)
au("=AVERAGEIF(A2:A5,\">250000\",B2:B5)", num(24500), ms("AVERAGEIF") + " example", cells=SALES)
au("=SUMIF(A2:A5,\">160000\",B2:B5)", num(63000), ms("SUMIF") + " example", "high", cells=SALES)
au("=SUMIF(A2:A5,\">160000\")", num(900000), ms("SUMIF") + " example", "high", cells=SALES)
au("=SUMIF(A2:A5,300000,B2:B5)", num(21000), ms("SUMIF") + " example", cells=SALES)
au("=COUNTIF(A2:A5,\">=200000\")", num(3), ms("COUNTIF"), "high", cells=SALES)
FR = {"A2": "apples", "A3": "oranges", "A4": "peaches", "A5": "apples", "B2": "32", "B3": "54", "B4": "75", "B5": "86"}
au("=COUNTIF(A2:A5,\"apples\")", num(2), ms("COUNTIF") + " example", "high", cells=FR)
au("=COUNTIF(A2:A5,A4)", num(1), ms("COUNTIF") + " example", cells=FR)
au("=COUNTIF(B2:B5,\">55\")", num(2), ms("COUNTIF") + " example", cells=FR)
au("=COUNTIF(B2:B5,\"<>\"&B4)", num(3), ms("COUNTIF") + " example", cells=FR)
au("=COUNTIF(A2:A5,\"*es\")", num(4), ms("COUNTIF") + " example: wildcards", cells=FR)
au("=COUNTIF(A2:A5,\"?????es\")", num(2), ms("COUNTIF") + " example: wildcards", cells=FR)
au("=COUNTIFS(A2:A5,\"apples\",B2:B5,\">50\")", num(1), ms("COUNTIFS"), cells=FR)
au("=SUMIFS(B2:B5,A2:A5,\"apples\",B2:B5,\"<50\")", num(32), ms("SUMIFS"), cells=FR)
au("=AVERAGEIFS(B2:B5,A2:A5,\"apples\")", num(59), ms("AVERAGEIFS"), cells=FR)
au("=MAXIFS(B2:B5,A2:A5,\"apples\")", num(86), ms("MAXIFS"), cells=FR)
au("=MINIFS(B2:B5,A2:A5,\"apples\")", num(32), ms("MINIFS"), cells=FR)
au("=COUNT(A2:A6)", num(2), ms("COUNT") + ": numbers only", "high", cells={"A2": "5", "A3": "x", "A4": "7", "A6": "seven"})
au("=COUNT(A2:A4)", num(1), ms("COUNT") + ": TRUE in a cell is a logical value, not counted", "low", cells={"A2": "5", "A3": "TRUE", "A4": "x"})
au("=COUNTA(A2:A6)", num(4), ms("COUNTA"), "high", cells={"A2": "5", "A3": "x", "A4": "7", "A6": "TRUE"})
au("=COUNTBLANK(A2:A6)", num(1), ms("COUNTBLANK"), cells={"A2": "5", "A3": "x", "A4": "7", "A6": "TRUE"})
au("=MAX(10,7,9,27,2)", num(27), ms("MAX") + " example")
au("=MIN(10,7,9,27,2)", num(2), ms("MIN") + " example")
au("=MAXA(A2:A4)", num(0), ms("MAXA") + ": text counts as 0", "low", cells={"A2": "-5", "A3": "x", "A4": "-7"})
au("=MINA(A2:A4)", num(-7), ms("MINA"), "low", cells={"A2": "-5", "A3": "x", "A4": "-7"})
au("=MEDIAN(1,2,3,4,5,6)", num(3.5), ms("MEDIAN") + " example")
au("=MODE(5.6,4,4,3,2,4)", num(4), ms("MODE") + " example")
au("=MODE.SNGL(5.6,4,4,3,2,4)", num(4), ms("MODE.SNGL") + " example")
au("=LARGE({3,5,3,5,4},3)", num(4), ms("LARGE") + " example")
au("=SMALL({3,4,5,2,3,4,6,4,7},4)", num(4), ms("SMALL") + " example")
au("=STDEV(" + S1s + ")", num(st.stdev(S1)), ms("STDEV") + " example 27.46391572", "high")
au("=STDEV.S(" + S1s + ")", num(st.stdev(S1)), ms("STDEV.S") + " example")
au("=STDEVP(" + S1s + ")", num(st.pstdev(S1)), ms("STDEVP") + " example 26.05455814")
au("=STDEV.P(" + S1s + ")", num(st.pstdev(S1)), ms("STDEV.P") + " example")
au("=VAR(" + S1s + ")", num(st.variance(S1)), ms("VAR") + " example 754.2667", "high")
au("=VAR.S(" + S1s + ")", num(st.variance(S1)), ms("VAR.S") + " example")
au("=VARP(" + S1s + ")", num(st.pvariance(S1)), ms("VARP") + " example 678.84")
au("=VAR.P(" + S1s + ")", num(st.pvariance(S1)), ms("VAR.P") + " example")
D7 = [4, 5, 8, 7, 11, 4, 3]
au("=DEVSQ(4,5,8,7,11,4,3)", num(48), ms("DEVSQ") + " example")
au("=GEOMEAN(4,5,8,7,11,4,3)", num(math.exp(sum(math.log(v) for v in D7) / 7)), ms("GEOMEAN") + " example 5.476987")
au("=HARMEAN(4,5,8,7,11,4,3)", num(7 / sum(1 / v for v in D7)), ms("HARMEAN") + " example 5.028376")
KX = [6, 5, 11, 7, 5, 4, 4]; KY = [2, 3, 9, 1, 8, 7, 5]
def lin(xs, ys):
    mx, my = st.mean(xs), st.mean(ys)
    sxy = sum((a - mx) * (b - my) for a, b in zip(xs, ys)); sxx = sum((a - mx) ** 2 for a in xs); syy = sum((b - my) ** 2 for b in ys)
    return sxy, sxx, syy, mx, my
sxy, sxx, syy, mx, my = lin(KX, KY)
au("=SLOPE({2,3,9,1,8,7,5},{6,5,11,7,5,4,4})", num(sxy / sxx), ms("SLOPE") + " example 0.305556: known_y's first", "high")
au("=INTERCEPT({2,3,9,1,8,7,5},{6,5,11,7,5,4,4})", num(my - sxy / sxx * mx), ms("INTERCEPT") + " (Microsoft's data)", "high")
au("=RSQ({2,3,9,1,8,7,5},{6,5,11,7,5,4,4})", num(sxy ** 2 / (sxx * syy)), ms("RSQ") + " example 0.05795", "medium")
au("=STEYX({2,3,9,1,8,7,5},{6,5,11,7,5,4,4})", num(math.sqrt((syy - sxy ** 2 / sxx) / 5)), ms("STEYX") + " example 3.305719", "medium")
CX = [3, 2, 4, 5, 6]; CY = [9, 7, 12, 15, 17]
sxy2, sxx2, syy2, mx2, my2 = lin(CX, CY)
au("=CORREL({3,2,4,5,6},{9,7,12,15,17})", num(sxy2 / math.sqrt(sxx2 * syy2)), ms("CORREL") + " example 0.997054486")
au("=PEARSON({9,7,5,3,1},{10,6,1,5,3})", num(lin([9, 7, 5, 3, 1], [10, 6, 1, 5, 3])[0] / math.sqrt(lin([9, 7, 5, 3, 1], [10, 6, 1, 5, 3])[1] * lin([9, 7, 5, 3, 1], [10, 6, 1, 5, 3])[2])), ms("PEARSON") + " example 0.699379")
au("=COVAR({3,2,4,5,6},{9,7,12,15,17})", num(sxy2 / 5), ms("COVAR") + " example 5.2")
au("=COVARIANCE.P({3,2,4,5,6},{9,7,12,15,17})", num(sxy2 / 5), ms("COVARIANCE.P") + " example 5.2")
au("=COVARIANCE.S({2,4,8},{5,11,12})", num(lin([2, 4, 8], [5, 11, 12])[0] / 2), ms("COVARIANCE.S") + " example 9.666666667")
FX = [20, 28, 31, 38, 40]; FY = [6, 7, 9, 15, 21]
sxy3, sxx3, syy3, mx3, my3 = lin(FX, FY)
au("=FORECAST(30,{6,7,9,15,21},{20,28,31,38,40})", num(my3 - sxy3 / sxx3 * mx3 + sxy3 / sxx3 * 30), ms("FORECAST") + " example 10.607253", "high")
au("=FORECAST.LINEAR(30,{6,7,9,15,21},{20,28,31,38,40})", num(my3 - sxy3 / sxx3 * mx3 + sxy3 / sxx3 * 30), ms("FORECAST.LINEAR") + " example 10.607253")
au("=STANDARDIZE(42,40,1.5)", num(2 / 1.5), ms("STANDARDIZE") + " example 1.333333")
from scipy import stats as SS
au("=NORM.DIST(42,40,1.5,TRUE)", num(SS.norm.cdf(42, 40, 1.5), 1e-12), ms("NORM.DIST") + " example 0.9087888")
au("=NORM.DIST(42,40,1.5,FALSE)", num(SS.norm.pdf(42, 40, 1.5), 1e-12), ms("NORM.DIST") + " example 0.10934")
au("=NORMDIST(42,40,1.5,TRUE)", num(SS.norm.cdf(42, 40, 1.5), 1e-12), ms("NORMDIST"))
au("=NORM.INV(0.908789,40,1.5)", num(SS.norm.ppf(0.908789, 40, 1.5), 1e-9), ms("NORM.INV") + " example 42.000002")
au("=NORMINV(0.908789,40,1.5)", num(SS.norm.ppf(0.908789, 40, 1.5), 1e-9), ms("NORMINV"))
au("=NORM.S.DIST(1.333333,TRUE)", num(SS.norm.cdf(1.333333), 1e-12), ms("NORM.S.DIST") + " example 0.908788726")
au("=NORM.S.DIST(1.333333,FALSE)", num(SS.norm.pdf(1.333333), 1e-12), ms("NORM.S.DIST") + " example 0.164010148")
au("=NORMSDIST(1.333333)", num(SS.norm.cdf(1.333333), 1e-12), ms("NORMSDIST") + ": one argument, the cumulative")
au("=NORM.S.INV(0.908789)", num(SS.norm.ppf(0.908789), 1e-9), ms("NORM.S.INV") + " example 1.3333347")
au("=NORMSINV(0.908789)", num(SS.norm.ppf(0.908789), 1e-9), ms("NORMSINV"))
au("=BINOM.DIST(6,10,0.5,FALSE)", num(SS.binom.pmf(6, 10, 0.5), 1e-12), ms("BINOM.DIST") + " example 0.2050781")
au("=BINOMDIST(6,10,0.5,TRUE)", num(SS.binom.cdf(6, 10, 0.5), 1e-12), ms("BINOMDIST"))
au("=GAMMADIST(10.00001131,9,2,FALSE)", num(float(SS.gamma.pdf(10.00001131, 9, scale=2)), 1e-9), ms("GAMMADIST") + " example 0.032639")
au("=CONFIDENCE(0.05,2.5,50)", num(SS.norm.ppf(0.975) * 2.5 / math.sqrt(50), 1e-9), ms("CONFIDENCE") + " example 0.692952")
au("=CONFIDENCE.NORM(0.05,2.5,50)", num(SS.norm.ppf(0.975) * 2.5 / math.sqrt(50), 1e-9), ms("CONFIDENCE.NORM") + " example 0.692952")
au("=PERCENTILE({1,3,2,4},0.3)", num(1.9), ms("PERCENTILE") + " example")
au("=PERCENTILE.INC({1,3,2,4},0.3)", num(1.9), ms("PERCENTILE.INC") + " example")
au("=PERCENTILE.EXC({1,2,3,6,6,6,7,8,9},0.25)", num(2.5), ms("PERCENTILE.EXC") + " example")
au("=PERCENTILE.EXC({1,2,3,6,6,6,7,8,9},0)", E("#NUM!"), ms("PERCENTILE.EXC") + " example", "low")
au("=QUARTILE({1,2,4,7,8,9,10,12},1)", num(3.5), ms("QUARTILE") + " example")
au("=QUARTILE.INC({1,2,4,7,8,9,10,12},1)", num(3.5), ms("QUARTILE.INC") + " example")
au("=QUARTILE.EXC({6,7,15,36,39,40,41,42,43,47,49},1)", num(15), ms("QUARTILE.EXC") + " example")
au("=QUARTILE.EXC({6,7,15,36,39,40,41,42,43,47,49},3)", num(43), ms("QUARTILE.EXC") + " example")
au("=PERCENTRANK({13,12,11,8,4,3,2,1,1,1},2)", num(0.333), ms("PERCENTRANK") + " example: three digits, truncated")
au("=PERCENTRANK({13,12,11,8,4,3,2,1,1,1},4)", num(0.555), ms("PERCENTRANK") + " example")
au("=PERCENTRANK({13,12,11,8,4,3,2,1,1,1},8)", num(0.666), ms("PERCENTRANK") + " example")
au("=PERCENTRANK({13,12,11,8,4,3,2,1,1,1},5)", num(0.583), ms("PERCENTRANK") + " example: interpolated")
au("=PERCENTRANK.INC({13,12,11,8,4,3,2,1,1,1},2)", num(0.333), ms("PERCENTRANK.INC") + " example")
au("=RANK(7,{7,3.5,3.5,1,2},1)", num(5), ms("RANK") + " example")
au("=RANK(3.5,{7,3.5,3.5,1,2},1)", num(3), ms("RANK") + " example")
au("=RANK.EQ(7,{7,3.5,3.5,1,2})", num(1), ms("RANK.EQ"), "medium")
au("=RANK.AVG(94,{89,88,92,101,94,97,95})", num(4), ms("RANK.AVG") + " example")
au("=RANK.AVG(3.5,{7,3.5,3.5,1,2},1)", num(3.5), ms("RANK.AVG"))
au("=INDEX(FREQUENCY({79,85,78,85,50,81,95,88,97},{70,79,89}),2)", num(2), ms("FREQUENCY") + " example {1;2;4;2}")
au("=INDEX(FREQUENCY({79,85,78,85,50,81,95,88,97},{70,79,89}),4)", num(2), ms("FREQUENCY") + " example: the last bin, above 89")
au("=SUM(FREQUENCY({79,85,78,85,50,81,95,88,97},{70,79,89}))", num(9), ms("FREQUENCY"))
au("=SUMPRODUCT({3,4;8,6;1,9},{2,7;6,7;5,3})", num(156), ms("SUMPRODUCT") + " example")
au("=SUM(3,2)", num(5), ms("SUM"))
au("=SUM(\"3\",2,TRUE)", num(6), ms("SUM") + ": text and TRUE typed as arguments are counted", "low")
au("=SUM(A2:A4)", num(5), ms("SUM") + ": text and TRUE in a range are left out", "medium", cells={"A2": "5", "A3": "x", "A4": "TRUE"})
# SUBTOTAL
SUB = {"A2": "120", "A3": "10", "A4": "150", "A5": "23"}
au("=SUBTOTAL(9,A2:A5)", num(303), ms("SUBTOTAL") + " example", "high", cells=SUB, ref="B1")
au("=SUBTOTAL(1,A2:A5)", num(75.75), ms("SUBTOTAL") + " example", "high", cells=SUB, ref="B1")
au("=SUBTOTAL(2,A2:A5)", num(4), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(4,A2:A5)", num(150), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(5,A2:A5)", num(10), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(6,A2:A5)", num(120 * 10 * 150 * 23), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(7,A2:A5)", num(st.stdev([120, 10, 150, 23])), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(8,A2:A5)", num(st.pstdev([120, 10, 150, 23])), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(10,A2:A5)", num(st.variance([120, 10, 150, 23])), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(109,A2:A5)", num(303), ms("SUBTOTAL"), cells=SUB, ref="B1")
au("=SUBTOTAL(9,A2:A6)", num(303), ms("SUBTOTAL") + ": a SUBTOTAL inside the range is left out, so nothing is counted twice", "high",
   cells={"A2": "120", "A3": "10", "A4": "150", "A5": "23", "A6": "=SUBTOTAL(9,A2:A5)"}, ref="B1")
au("=SUBTOTAL(12,A2:A5)", E("#VALUE!"), ms("SUBTOTAL") + ": 1-11 and 101-111 only", "low", cells=SUB, ref="B1")
au("=AGGREGATE(9,6,A2:A4)", num(30), ms("AGGREGATE") + ": option 6 leaves errors out", cells={"A2": "10", "A3": "=1/0", "A4": "20"}, ref="B1")
au("=AGGREGATE(14,6,A2:A6,2)", num(72), ms("AGGREGATE") + ": LARGE, second", cells={"A2": "72", "A3": "=1/0", "A4": "30", "A5": "96", "A6": "32"}, ref="B1")
# dates
SER = lambda y, m, d: (date(y, m, d) - date(1899, 12, 30)).days
au("=DATE(2008,1,1)", num(39448), ms("DATE"), "high")
au("=DATE(2008,14,2)", num(SER(2009, 2, 2)), ms("DATE") + ": a month past 12 goes into the next year (Feb 2 2009)")
au("=DATE(2008,1,-15)", num(SER(2007, 12, 16)), ms("DATE") + ": days before the first (Dec 16 2007)")
au("=YEAR(DATE(2008,7,5))", num(2008), ms("YEAR"))
au("=MONTH(DATE(2011,4,15))", num(4), ms("MONTH"))
au("=DAY(DATE(2011,4,15))", num(15), ms("DAY"))
au("=DATEVALUE(\"8/22/2011\")", num(SER(2011, 8, 22)), ms("DATEVALUE") + " example", "medium")
au("=DATEVALUE(\"22-MAY-2011\")", num(SER(2011, 5, 22)), ms("DATEVALUE") + " example", "medium")
au("=DAYS(\"15-MAR-2021\",\"1-FEB-2021\")", num(42), ms("DAYS") + " example: end date first", "high")
au("=DAYS(DATE(2021,2,1),DATE(2021,3,15))", num(-42), ms("DAYS") + ": end date first", "high")
au("=DAYS360(DATE(2011,1,30),DATE(2011,12,31))", num(330), ms("DAYS360") + " example")
au("=DATEDIF(DATE(2001,1,1),DATE(2003,1,1),\"Y\")", num(2), ms("DATEDIF") + " example")
au("=DATEDIF(DATE(2001,6,1),DATE(2002,8,15),\"D\")", num(440), ms("DATEDIF") + " example")
au("=DATEDIF(DATE(2001,6,1),DATE(2002,8,15),\"YD\")", num(75), ms("DATEDIF") + " example")
au("=DATEDIF(DATE(2001,6,1),DATE(2002,8,15),\"MD\")", num(14), ms("DATEDIF"))
au("=DATEDIF(DATE(2001,6,1),DATE(2002,8,15),\"YM\")", num(2), ms("DATEDIF"))
au("=DATEDIF(DATE(2001,6,1),DATE(2002,8,15),\"M\")", num(14), ms("DATEDIF"))
au("=DATEDIF(DATE(2003,1,1),DATE(2001,1,1),\"Y\")", E("#NUM!"), ms("DATEDIF") + ": a start after the end is #NUM!", "low")
au("=EDATE(DATE(2011,1,15),1)", num(SER(2011, 2, 15)), ms("EDATE") + " example")
au("=EDATE(DATE(2011,1,15),-1)", num(SER(2010, 12, 15)), ms("EDATE") + " example")
au("=EDATE(DATE(2011,1,31),1)", num(SER(2011, 2, 28)), ms("EDATE") + ": to the month's last day")
au("=EOMONTH(DATE(2011,1,1),1)", num(SER(2011, 2, 28)), ms("EOMONTH") + " example")
au("=EOMONTH(DATE(2011,1,1),-3)", num(SER(2010, 10, 31)), ms("EOMONTH") + " example")
au("=WEEKDAY(DATE(2008,2,14))", num(5), ms("WEEKDAY") + " example")
au("=WEEKDAY(DATE(2008,2,14),2)", num(4), ms("WEEKDAY") + " example")
au("=WEEKDAY(DATE(2008,2,14),3)", num(3), ms("WEEKDAY") + " example")
au("=WEEKNUM(DATE(2012,3,9))", num(10), ms("WEEKNUM") + " example")
au("=WEEKNUM(DATE(2012,3,9),2)", num(11), ms("WEEKNUM") + " example")
au("=ISOWEEKNUM(DATE(2012,3,9))", num(10), ms("ISOWEEKNUM") + " example")
au("=WORKDAY(DATE(2008,10,1),151)", num(SER(2009, 4, 30)), ms("WORKDAY") + " example")
au("=WORKDAY(DATE(2008,10,1),151,{39778,39786,39834})", num(SER(2009, 5, 5)), ms("WORKDAY") + " example with holidays")
au("=WORKDAY.INTL(DATE(2012,1,1),90,11)", num(41013), ms("WORKDAY.INTL") + " example")
au("=WORKDAY.INTL(DATE(2012,1,1),30,17)", num(SER(2012, 2, 5)), ms("WORKDAY.INTL") + " example")
au("=WORKDAY.INTL(DATE(2012,1,1),30,0)", E("#NUM!"), ms("WORKDAY.INTL") + " example", "low")
au("=NETWORKDAYS(DATE(2012,10,1),DATE(2013,3,1))", num(110), ms("NETWORKDAYS") + " example")
au("=NETWORKDAYS(DATE(2012,10,1),DATE(2013,3,1),DATE(2012,11,22))", num(109), ms("NETWORKDAYS") + " example")
au("=NETWORKDAYS.INTL(DATE(2006,1,1),DATE(2006,1,31))", num(22), ms("NETWORKDAYS.INTL") + " example")
au("=NETWORKDAYS.INTL(DATE(2006,2,28),DATE(2006,1,31))", num(-21), ms("NETWORKDAYS.INTL") + " example")
au("=NETWORKDAYS.INTL(DATE(2006,1,1),DATE(2006,2,1),7,{38719,38733})", num(22), ms("NETWORKDAYS.INTL") + " example")
au("=NETWORKDAYS.INTL(DATE(2006,1,1),DATE(2006,2,1),\"0010001\",{38719,38733})", num(20), ms("NETWORKDAYS.INTL") + " example")
au("=YEARFRAC(DATE(2012,1,1),DATE(2012,7,30))", num(209 / 360), ms("YEARFRAC") + " example 0.58055556 (30/360)")
au("=YEARFRAC(DATE(2012,1,1),DATE(2012,7,30),1)", num(211 / 366), ms("YEARFRAC") + " example 0.57650273")
au("=YEARFRAC(DATE(2012,1,1),DATE(2012,7,30),3)", num(211 / 365), ms("YEARFRAC") + " example 0.57808219")
au("=TIME(12,0,0)", num(0.5), ms("TIME") + " example")
au("=TIME(16,48,10)", num((16 * 3600 + 48 * 60 + 10) / 86400), ms("TIME") + " example 0.7001157")
au("=TIME(27,0,0)", num(0.125), ms("TIME") + ": hours past 23 wrap")
au("=TIMEVALUE(\"2:24 AM\")", num(0.1), ms("TIMEVALUE") + " example")
au("=TIMEVALUE(\"22-Aug-2011 6:35 AM\")", num((6 * 60 + 35) / 1440), ms("TIMEVALUE") + " example 0.2743056", "low")
au("=HOUR(0.75)", num(18), ms("HOUR") + " example")
au("=HOUR(\"3:30:30 PM\")", num(15), ms("HOUR"), "low")
au("=MINUTE(\"12:45:00 PM\")", num(45), ms("MINUTE") + " example")
au("=SECOND(\"4:48:18 PM\")", num(18), ms("SECOND") + " example")
au("=TODAY()=INT(NOW())", B(True), ms("TODAY"), "low")
# finance
def fv(r, n, pmt, pv=0, t=0):
    if r == 0: return -(pv + pmt * n)
    return -(pv * (1 + r) ** n + pmt * (1 + r * t) * ((1 + r) ** n - 1) / r)
def pmt(r, n, pv, f=0, t=0):
    if r == 0: return -(pv + f) / n
    return -(pv * (1 + r) ** n + f) * r / ((1 + r * t) * ((1 + r) ** n - 1))
def pv(r, n, p, f=0, t=0):
    if r == 0: return -(f + p * n)
    return -(f + p * (1 + r * t) * ((1 + r) ** n - 1) / r) / (1 + r) ** n
def ipmt(r, per, n, p0, f=0, t=0):
    P = pmt(r, n, p0, f, t)
    return fv(r, per - 1, P, p0, t) * r
def ppmt(r, per, n, p0, f=0, t=0):
    return pmt(r, n, p0, f, t) - ipmt(r, per, n, p0, f, t)
def npv(r, vals):
    return sum(v / (1 + r) ** (i + 1) for i, v in enumerate(vals))
def solve(f, lo, hi):
    for _ in range(300):
        mid = (lo + hi) / 2
        if (f(lo) < 0) == (f(mid) < 0): lo = mid
        else: hi = mid
    return (lo + hi) / 2
au("=PMT(0.08/12,10,10000)", num(pmt(0.08 / 12, 10, 10000)), ms("PMT") + " example -1037.03", "high")
au("=PMT(0.08/12,10,10000,0,1)", num(pmt(0.08 / 12, 10, 10000, 0, 1)), ms("PMT") + " example -1030.16")
au("=PMT(0.06/12,18*12,0,50000)", num(pmt(0.06 / 12, 216, 0, 50000)), ms("PMT") + " example -129.08")
au("=PV(0.08/12,12*20,500,,0)", num(pv(0.08 / 12, 240, 500)), ms("PV") + " example -59777.15", "high")
au("=FV(0.06/12,10,-200,-500,1)", num(fv(0.06 / 12, 10, -200, -500, 1)), ms("FV") + " example 2581.40", "high")
au("=FV(0.12/12,12,-1000)", num(fv(0.01, 12, -1000)), ms("FV") + " example 12682.50")
au("=NPER(0.12/12,-100,-1000,10000,1)", num(math.log((-100 * 1.01 - 10000 * 0.01) / (-100 * 1.01 + -1000 * 0.01)) / math.log(1.01)), ms("NPER") + " example 59.6738657")
au("=NPER(0.12/12,-100,-1000)", num(math.log((-100 - 0) / (-100 + -1000 * 0.01)) / math.log(1.01)), ms("NPER") + " example -9.57859404")
au("=IPMT(0.1/12,1,3*12,8000)", num(ipmt(0.1 / 12, 1, 36, 8000)), ms("IPMT") + " example -66.67")
au("=IPMT(0.1,3,3,8000)", num(ipmt(0.1, 3, 3, 8000)), ms("IPMT") + " example -292.45")
au("=PPMT(0.1/12,1,2*12,2000)", num(ppmt(0.1 / 12, 1, 24, 2000)), ms("PPMT") + " example -75.62")
au("=PPMT(0.08,10,10,200000)", num(ppmt(0.08, 10, 10, 200000)), ms("PPMT") + " example -27598.05")
au("=CUMIPMT(0.09/12,30*12,125000,13,24,0)", num(sum(ipmt(0.0075, k, 360, 125000) for k in range(13, 25)), 1e-12), ms("CUMIPMT") + " example -11135.23")
au("=CUMIPMT(0.09/12,30*12,125000,1,1,0)", num(ipmt(0.0075, 1, 360, 125000)), ms("CUMIPMT") + " example -937.50")
au("=CUMPRINC(0.09/12,30*12,125000,13,24,0)", num(sum(ppmt(0.0075, k, 360, 125000) for k in range(13, 25)), 1e-12), ms("CUMPRINC") + " example -934.1071")
au("=NPV(0.1,-10000,3000,4200,6800)", num(npv(0.1, [-10000, 3000, 4200, 6800])), ms("NPV") + " example 1188.44", "high")
au("=NPV(0.08,8000,9200,10000,12000,14500)-40000", num(npv(0.08, [8000, 9200, 10000, 12000, 14500]) - 40000), ms("NPV") + " example 1922.06")
IRRV = [-70000, 12000, 15000, 18000, 21000, 26000]
au("=IRR({-70000,12000,15000,18000,21000,26000})", num(solve(lambda r: npv(r, IRRV[1:]) + IRRV[0], 0.0, 0.5), 1e-9), ms("IRR") + " example 8.7%", "high")
au("=IRR({-70000,12000,15000,18000,21000})", num(solve(lambda r: npv(r, [12000, 15000, 18000, 21000]) - 70000, -0.5, 0.5), 1e-9), ms("IRR") + " example -2.1%")
au("=IRR({-70000,12000,15000},-0.1)", num(solve(lambda r: npv(r, [12000, 15000]) - 70000, -0.9, -0.1), 1e-9), ms("IRR") + " example -44.4%")
MV = [-120000, 39000, 30000, 21000, 37000, 46000]
def mirr(vals, fr, rr):
    n = len(vals)
    pos = sum(v * (1 + rr) ** (n - 1 - i) for i, v in enumerate(vals) if v > 0)
    neg = sum(v / (1 + fr) ** i for i, v in enumerate(vals) if v < 0)
    return (pos / -neg) ** (1 / (n - 1)) - 1
au("=MIRR({-120000,39000,30000,21000,37000,46000},0.1,0.12)", num(mirr(MV, 0.1, 0.12)), ms("MIRR") + " example 12.6%")
au("=MIRR({-120000,39000,30000,21000},0.1,0.12)", num(mirr(MV[:4], 0.1, 0.12)), ms("MIRR") + " example -4.8%")
XD = [39448, 39508, 39751, 39859, 39904]; XV = [-10000, 2750, 4250, 3250, 2750]
xnpv = lambda r: sum(v / (1 + r) ** ((d - XD[0]) / 365) for v, d in zip(XV, XD))
au("=XNPV(0.09,{-10000,2750,4250,3250,2750},{39448,39508,39751,39859,39904})", num(xnpv(0.09)), ms("XNPV") + " example 2086.65")
au("=XIRR({-10000,2750,4250,3250,2750},{39448,39508,39751,39859,39904})", num(solve(lambda r: -xnpv(r), 0.0, 1.0), 1e-7), ms("XIRR") + " example 0.373362535")
rate = solve(lambda r: pv(r, 48, -200) - 8000, 0.0001, 0.1)
au("=RATE(4*12,-200,8000)", num(rate, 1e-9), ms("RATE") + " example 1% a month")
au("=RATE(4*12,-200,8000)*12", num(rate * 12, 1e-9), ms("RATE") + " example 9.24%")
au("=EFFECT(0.0525,4)", num((1 + 0.0525 / 4) ** 4 - 1), ms("EFFECT") + " example 0.0535427")
au("=NOMINAL(0.053543,4)", num(4 * ((1.053543) ** 0.25 - 1)), ms("NOMINAL") + " example 0.0525")
def db(cost, salv, life, per, month=12):
    rate = round(1 - (salv / cost) ** (1 / life), 3)
    tot = 0
    for p in range(1, per + 1):
        if p == 1: d = cost * rate * month / 12
        elif p == life + 1: d = (cost - tot) * rate * (12 - month) / 12
        else: d = (cost - tot) * rate
        tot += d
    return d
au("=DB(1000000,100000,6,1,7)", num(db(1e6, 1e5, 6, 1, 7)), ms("DB") + " example 186,083.33: declining-balance depreciation", "high")
au("=DB(1000000,100000,6,2,7)", num(db(1e6, 1e5, 6, 2, 7)), ms("DB") + " example 259,639.42")
au("=DB(1000000,100000,6,7,7)", num(db(1e6, 1e5, 6, 7, 7)), ms("DB") + " example 15,845.10")
def ddb(cost, salv, life, per, fac=2):
    tot = 0
    for p in range(1, per + 1):
        d = min((cost - tot) * fac / life, max(0, cost - salv - tot))
        tot += d
    return d
au("=DDB(2400,300,10*365,1)", num(ddb(2400, 300, 3650, 1)), ms("DDB") + " example 1.32")
au("=DDB(2400,300,10*12,1,2)", num(ddb(2400, 300, 120, 1)), ms("DDB") + " example 40.00")
au("=DDB(2400,300,10,1,2)", num(ddb(2400, 300, 10, 1)), ms("DDB") + " example 480.00")
au("=DDB(2400,300,10,2,1.5)", num(ddb(2400, 300, 10, 2, 1.5)), ms("DDB") + " example 306.00")
au("=DDB(2400,300,10,10)", num(ddb(2400, 300, 10, 10), 1e-12), ms("DDB") + " example 22.12")
au("=SLN(30000,7500,10)", num(2250), ms("SLN") + " example")
au("=SYD(30000,7500,10,1)", num(22500 * 10 / 55), ms("SYD") + " example 4090.91")
au("=SYD(30000,7500,10,10)", num(22500 * 1 / 55), ms("SYD") + " example 409.09")
# text
au("=LEFT(\"Sale Price\",4)", T("Sale"), ms("LEFT") + " example", "high")
au("=LEFT(\"Sweden\")", T("S"), ms("LEFT") + " example: one character when left out")
au("=RIGHT(\"Sale Price\",5)", T("Price"), ms("RIGHT") + " example", "high")
au("=RIGHT(\"Stock Number\")", T("r"), ms("RIGHT") + " example")
au("=MID(\"Fluid Flow\",1,5)", T("Fluid"), ms("MID") + " example", "high")
au("=MID(\"Fluid Flow\",7,20)", T("Flow"), ms("MID") + " example")
au("=MID(\"Fluid Flow\",20,5)", T(""), ms("MID") + " example")
au("=LEN(\"Phoenix, AZ\")", num(11), ms("LEN") + " example", "high")
au("=LEN(\"     One   \")", num(11), ms("LEN") + " example")
au("=FIND(\"M\",\"Miriam McGovern\")", num(1), ms("FIND") + " example")
au("=FIND(\"m\",\"Miriam McGovern\")", num(6), ms("FIND") + " example: case-sensitive", "high")
au("=FIND(\"M\",\"Miriam McGovern\",3)", num(8), ms("FIND") + " example")
au("=FIND(\"z\",\"Miriam\")", E("#VALUE!"), ms("FIND") + ": not found is #VALUE!", "medium")
au("=SEARCH(\"e\",\"Statements\",6)", num(7), ms("SEARCH") + " example")
au("=SEARCH(\"margin\",\"Profit Margin\")", num(8), ms("SEARCH") + " example: not case-sensitive", "high")
au("=SEARCH(\"p?o\",\"Profit\")", num(1), ms("SEARCH") + ": ? wildcard")
au("=SEARCH(\"f*t\",\"Profit\")", num(4), ms("SEARCH") + ": * wildcard")
au("=SEARCH(\"~*\",\"a*b\")", num(2), ms("SEARCH") + ": ~ before a wildcard", "low")
au("=SUBSTITUTE(\"Sales Data\",\"Sales\",\"Cost\")", T("Cost Data"), ms("SUBSTITUTE") + " example", "high")
au("=SUBSTITUTE(\"Quarter 1, 2008\",\"1\",\"2\",1)", T("Quarter 2, 2008"), ms("SUBSTITUTE") + " example")
au("=SUBSTITUTE(\"Quarter 1, 2011\",\"1\",\"2\",3)", T("Quarter 1, 2012"), ms("SUBSTITUTE") + " example")
au("=REPLACE(\"abcdefghijk\",6,5,\"*\")", T("abcde*k"), ms("REPLACE") + " example", "high")
au("=REPLACE(\"2009\",3,2,\"10\")", T("2010"), ms("REPLACE") + " example")
au("=REPLACE(\"123456\",1,3,\"@\")", T("@456"), ms("REPLACE") + " example")
au("=REPT(\"*-\",3)", T("*-*-*-"), ms("REPT") + " example")
au("=TRIM(\" First Quarter   Earnings \")", T("First Quarter Earnings"), ms("TRIM") + " example: inner runs of spaces made one", "high")
au("=PROPER(\"this is a TITLE\")", T("This Is A Title"), ms("PROPER") + " example")
au("=PROPER(\"2-way street\")", T("2-Way Street"), ms("PROPER") + " example")
au("=PROPER(\"76BudGet\")", T("76Budget"), ms("PROPER") + " example")
au("=UPPER(\"total\")", T("TOTAL"), ms("UPPER"))
au("=LOWER(\"E. E. Cummings\")", T("e. e. cummings"), ms("LOWER") + " example")
au("=EXACT(\"word\",\"Word\")", B(False), ms("EXACT") + " example", "high")
au("=EXACT(\"word\",\"word\")", B(True), ms("EXACT") + " example")
au("=CONCATENATE(\"Stream population for \",\"brook trout\",\" is \",32,\"/mile.\")", T("Stream population for brook trout is 32/mile."), ms("CONCATENATE") + " example")
au("=CONCAT(\"a\",\"b\",1)", T("ab1"), ms("CONCAT"))
au("=CONCAT(A2:B3)", T("a1b2"), ms("CONCAT") + ": a range, row by row", cells={"A2": "a", "B2": "1", "A3": "b", "B3": "2"}, ref="C1")
au("=TEXTJOIN(\", \",TRUE,\"a\",\"\",\"b\")", T("a, b"), ms("TEXTJOIN") + ": empty left out")
au("=TEXTJOIN(\"-\",FALSE,\"a\",\"\",\"b\")", T("a--b"), ms("TEXTJOIN"))
au("=CHAR(65)", T("A"), ms("CHAR") + " example")
au("=CODE(\"A\")", num(65), ms("CODE") + " example")
au("=CLEAN(CHAR(9)&\"Monthly report\"&CHAR(10))", T("Monthly report"), ms("CLEAN") + " example")
au("=UNICHAR(66)", T("B"), ms("UNICHAR") + " example")
au("=UNICODE(\"B\")", num(66), ms("UNICODE") + " example")
au("=T(\"Rainfall\")", T("Rainfall"), ms("T") + " example")
au("=T(19)", T(""), ms("T") + " example: a number gives empty text", "medium")
au("=N(7)", num(7), ms("N") + " example")
au("=N(\"Even\")", num(0), ms("N") + " example", "medium")
au("=N(DATE(2011,4,17))", num(SER(2011, 4, 17)), ms("N") + " example")
au("=VALUE(\"$1,000\")", num(1000), ms("VALUE") + " example", "high")
au("=VALUE(\"16:48:00\")-VALUE(\"12:00:00\")", num(0.2), ms("VALUE") + " example")
au("=NUMBERVALUE(\"2.500,27\",\",\",\".\")", num(2500.27), ms("NUMBERVALUE") + " example")
au("=NUMBERVALUE(\"3.5%\")", num(0.035), ms("NUMBERVALUE") + " example")
au("=TEXT(1234.567,\"$#,##0.00\")", T("$1,234.57"), ms("TEXT") + " example", "high")
au("=TEXT(0.285,\"0.0%\")", T("28.5%"), ms("TEXT") + " example", "high")
au("=TEXT(DATE(2012,3,14),\"MM/DD/YY\")", T("03/14/12"), ms("TEXT") + " example", "high")
au("=TEXT(DATE(2012,3,14),\"dddd\")", T("Wednesday"), ms("TEXT") + " example")
au("=TEXT(0.75,\"h:mm AM/PM\")", T("6:00 PM"), ms("TEXT") + " example")
au("=TEXT(4.34,\"# ?/?\")", T("4 1/3"), ms("TEXT") + " example")
au("=TEXT(12200000,\"0.00E+00\")", T("1.22E+07"), ms("TEXT") + " example")
au("=TEXT(1234,\"0000000\")", T("0001234"), ms("TEXT") + " example")
au("=TEXT(-5,\"0;(0)\")", T("(5)"), ms("TEXT"))
au("=TEXT(1234567898,\"[<=9999999]###-####;(###) ###-####\")", T("(123) 456-7898"), ms("TEXT") + " example")
au("=FIXED(1234.567,1)", T("1,234.6"), ms("FIXED") + " example")
au("=FIXED(1234.567,-1)", T("1,230"), ms("FIXED") + " example")
au("=FIXED(-1234.567,-1,TRUE)", T("-1230"), ms("FIXED") + " example")
au("=FIXED(44.332)", T("44.33"), ms("FIXED") + " example")
au("=DOLLAR(1234.567,2)", T("$1,234.57"), ms("DOLLAR") + " example")
au("=DOLLAR(1234.567,-2)", T("$1,200"), ms("DOLLAR") + " example")
au("=DOLLAR(-1234.567,-2)", T("($1,200)"), ms("DOLLAR") + " example")
au("=DOLLAR(-0.123,4)", T("($0.1230)"), ms("DOLLAR") + " example")
au("=DOLLAR(99.888)", T("$99.89"), ms("DOLLAR") + " example")
au("=DOLLAR(1234.5678,4)", T("$1,234.5678"), ms("DOLLAR") + ": decimals are not grouped", "medium")
au("=FIXED(1234.56789,4)", T("1,234.5679"), ms("FIXED") + ": decimals are not grouped", "medium")
au("=FIXED(0.12345,4)", T("0.1235"), ms("FIXED") + ": decimals are not grouped", "medium")
au("=DOLLAR(0.5,5)", T("$0.50000"), ms("DOLLAR") + ": decimals are not grouped", "medium")
au("=TEXT(1234.5678,\"#,##0.0000\")", T("1,234.5678"), ms("TEXT"), "medium")
au("=TEXTBEFORE(\"Red riding hood's, red hood\",\"hood\")", T("Red riding "), ms("TEXTBEFORE") + " example")
au("=TEXTBEFORE(\"Red riding hood's, red hood\",\"hood\",2)", T("Red riding hood's, red "), ms("TEXTBEFORE") + " example")
TB = {"A2": "Little Red Riding Hood's red hood", "A3": "Little red Riding Hood's red hood"}
au("=TEXTBEFORE(A2,\"Red\")", T("Little "), ms("TEXTBEFORE") + " example 1", cells=TB, ref="B1")
au("=TEXTBEFORE(A3,\"Red\")", E("#N/A"), ms("TEXTBEFORE") + " example 1: case-sensitive", "low", cells=TB, ref="B1")
au("=TEXTBEFORE(A3,\"red\",2)", T("Little red Riding Hood's "), ms("TEXTBEFORE") + " example 1", cells=TB, ref="B1")
au("=TEXTBEFORE(A3,\"red\",-2)", T("Little "), ms("TEXTBEFORE") + " example 1: from the end", cells=TB, ref="B1")
au("=TEXTBEFORE(A3,\"Red\",,FALSE)", E("#N/A"), ms("TEXTBEFORE") + " example 1: instance left out (1)", "low", cells=TB, ref="B1")
au("=TEXTBEFORE(A3,\"red\",3)", E("#N/A"), ms("TEXTBEFORE") + " example 1", "low", cells=TB, ref="B1")
au("=TEXTBEFORE(A3,\"Red\",,1)", T("Little "), ms("TEXTBEFORE") + ": instance left out (1), match_mode 1 not case-sensitive", "medium", cells=TB, ref="B1")
TB2 = {"A2": "Marcus Aurelius", "A3": "Socrates", "A4": "Immanuel Kant"}
au("=TEXTBEFORE(A2,\" \",,,1)", T("Marcus"), ms("TEXTBEFORE") + " example 2", cells=TB2, ref="B1")
au("=TEXTBEFORE(A3,\" \",,,0)", E("#N/A"), ms("TEXTBEFORE") + " example 2", "low", cells=TB2, ref="B1")
au("=TEXTBEFORE(A3,\" \",,,1)", T("Socrates"), ms("TEXTBEFORE") + " example 2: match_end", cells=TB2, ref="B1")
au("=TEXTBEFORE(A4,\" \",,,1)", T("Immanuel"), ms("TEXTBEFORE") + " example 2", cells=TB2, ref="B1")
au("=TEXTAFTER(\"Red riding hood's, red hood\",\"hood\")", T("'s, red hood"), ms("TEXTAFTER") + " example")
au("=TEXTAFTER(\"Red riding hood's, red hood\",\"HOOD\",1,1)", T("'s, red hood"), ms("TEXTAFTER") + " example")
au("=TEXTAFTER(\"Red riding hood's, red hood\",\"basket\")", E("#N/A"), ms("TEXTAFTER") + ": not found is #N/A", "low")
au("=BASE(7,2)", T("111"), ms("BASE") + " example")
au("=BASE(100,16)", T("64"), ms("BASE") + " example")
au("=BASE(15,2,10)", T("0000001111"), ms("BASE") + " example")
au("=DECIMAL(\"FF\",16)", num(255), ms("DECIMAL") + " example")
au("=DECIMAL(\"111\",2)", num(7), ms("DECIMAL") + " example")
au("=DECIMAL(\"zap\",36)", num(45745), ms("DECIMAL") + " example")
au("=ROMAN(499,0)", T("CDXCIX"), ms("ROMAN") + " example")
au("=ROMAN(499,1)", T("LDVLIV"), ms("ROMAN") + " example")
au("=ROMAN(499,4)", T("ID"), ms("ROMAN") + " example")
au("=ROMAN(2024)", T("MMXXIV"), ms("ROMAN"))
au("=ARABIC(\"LVII\")", num(57), ms("ARABIC") + " example")
au("=ARABIC(\"mcmxii\")", num(1912), ms("ARABIC") + " example")
au("=DEC2BIN(9,4)", T("1001"), ms("DEC2BIN") + " example")
au("=DEC2BIN(-100)", T("1110011100"), ms("DEC2BIN") + " example: ten digits, two's complement")
au("=DEC2HEX(100,4)", T("0064"), ms("DEC2HEX") + " example")
au("=DEC2HEX(-54)", T("FFFFFFFFCA"), ms("DEC2HEX") + " example")
au("=DEC2OCT(58,3)", T("072"), ms("DEC2OCT") + " example")
au("=DEC2OCT(-100)", T("7777777634"), ms("DEC2OCT") + " example")
au("=BIN2DEC(\"1100100\")", num(100), ms("BIN2DEC") + " example")
au("=BIN2DEC(\"1111111111\")", num(-1), ms("BIN2DEC") + " example")
au("=HEX2DEC(\"A5\")", num(165), ms("HEX2DEC") + " example")
au("=HEX2DEC(\"FFFFFFFF5B\")", num(-165), ms("HEX2DEC") + " example")
au("=OCT2DEC(\"54\")", num(44), ms("OCT2DEC") + " example")
au("=OCT2DEC(\"7777777533\")", num(-165), ms("OCT2DEC") + " example")
# logic and lookup
au("=IF(1>2,\"a\",\"b\")", T("b"), ms("IF"))
au("=IF(FALSE,1)", B(False), ms("IF") + ": no value_if_false gives FALSE", "low")
au("=IFERROR(1/0,\"x\")", T("x"), ms("IFERROR"))
au("=IFNA(NA(),\"x\")", T("x"), ms("IFNA"))
au("=IFNA(1/0,\"x\")", E("#DIV/0!"), ms("IFNA") + ": only #N/A", "medium")
au("=IFS(1>2,\"a\",TRUE,\"b\")", T("b"), ms("IFS"))
au("=IFS(1>2,\"a\")", E("#N/A"), ms("IFS") + ": nothing true is #N/A", "low")
au("=AND(TRUE,FALSE)", B(False), ms("AND"))
au("=OR(TRUE,FALSE)", B(True), ms("OR"))
au("=NOT(FALSE)", B(True), ms("NOT"))
au("=XOR(3>0,2<9)", B(False), ms("XOR") + " example")
au("=XOR(3>12,4>6)", B(False), ms("XOR") + " example")
au("=XOR(3>12,4<6)", B(True), ms("XOR") + " example")
au("=XOR(1,1,1)", B(True), ms("XOR") + ": an odd number of TRUE")
au("=SWITCH(2,1,\"a\",2,\"b\",\"c\")", T("b"), ms("SWITCH"))
au("=SWITCH(3,1,\"a\",2,\"b\")", E("#N/A"), ms("SWITCH") + ": no match and no default is #N/A", "low")
au("=SWITCH(9,1,\"a\",2,\"b\",\"none\")", T("none"), ms("SWITCH") + ": the default")
au("=CHOOSE(2,\"1st\",\"2nd\",\"3rd\",\"Finished\")", T("2nd"), ms("CHOOSE") + " example")
au("=CHOOSE(5,\"a\",\"b\")", E("#VALUE!"), ms("CHOOSE") + ": an index past the list is #VALUE!", "low")
au("=INDEX({1,2;3,4},2,2)", num(4), ms("INDEX"))
au("=INDEX({1,2;3,4},1,2)", num(2), ms("INDEX"))
au("=MATCH(39,{25,38,40,41},1)", num(2), ms("MATCH") + " example")
au("=MATCH(41,{25,38,40,41},0)", num(4), ms("MATCH") + " example")
au("=MATCH(40,{25,38,40,41},-1)", E("#N/A"), ms("MATCH") + " example: the list is not in descending order", "low")
au("=MATCH(39,{25,38,40,41})", num(2), ms("MATCH") + ": match_type 1 when left out")
au("=LOOKUP(4.19,{4.14,4.19,5.17},{\"red\",\"orange\",\"yellow\"})", T("orange"), ms("LOOKUP") + " example")
au("=LOOKUP(5,{4.14,4.19,5.17},{\"red\",\"orange\",\"yellow\"})", T("orange"), ms("LOOKUP") + " example: the largest not above")
au("=LOOKUP(0,{4.14,4.19,5.17},{\"red\",\"orange\",\"yellow\"})", E("#N/A"), ms("LOOKUP") + " example", "low")
au("=VLOOKUP(2,{1,\"a\";2,\"b\";3,\"c\"},2,FALSE)", T("b"), ms("VLOOKUP"), "high")
au("=VLOOKUP(2.5,{1,\"a\";2,\"b\";3,\"c\"},2,TRUE)", T("b"), ms("VLOOKUP") + ": approximate", "high")
au("=VLOOKUP(2.5,{1,\"a\";2,\"b\";3,\"c\"},2)", T("b"), ms("VLOOKUP") + ": range_lookup TRUE when left out", "high")
au("=VLOOKUP(5,{1,\"a\";2,\"b\";3,\"c\"},2,FALSE)", E("#N/A"), ms("VLOOKUP"), "medium")
au("=HLOOKUP(\"b\",{\"a\",\"b\";1,2},2,FALSE)", num(2), ms("HLOOKUP"))
au("=HLOOKUP(2.5,{1,2,3;\"x\",\"y\",\"z\"},2)", T("y"), ms("HLOOKUP") + ": approximate when left out")
au("=XLOOKUP(2,{1;2;3},{\"a\";\"b\";\"c\"})", T("b"), ms("XLOOKUP"))
au("=XLOOKUP(5,{1;2;3},{\"a\";\"b\";\"c\"},\"none\")", T("none"), ms("XLOOKUP") + ": if_not_found")
au("=XLOOKUP(2.5,{1;2;3},{\"a\";\"b\";\"c\"},,-1)", T("b"), ms("XLOOKUP") + ": match_mode -1, the next smaller")
au("=XLOOKUP(2.5,{1;2;3},{\"a\";\"b\";\"c\"},,1)", T("c"), ms("XLOOKUP") + ": match_mode 1, the next larger")
au("=XLOOKUP(9,{1;2;3},{\"a\";\"b\";\"c\"})", E("#N/A"), ms("XLOOKUP"), "low")
au("=XMATCH(3,{1;2;3})", num(3), ms("XMATCH"))
au("=XMATCH(2.5,{1;2;3},1)", num(3), ms("XMATCH") + ": the next larger")
au("=XMATCH(2.5,{1;2;3},-1)", num(2), ms("XMATCH") + ": the next smaller")
au("=ADDRESS(2,3)", T("$C$2"), ms("ADDRESS") + " example")
au("=ADDRESS(2,3,2)", T("C$2"), ms("ADDRESS") + " example")
au("=ADDRESS(2,3,2,FALSE)", T("R2C[3]"), ms("ADDRESS") + " example")
au("=ADDRESS(2,3,1,FALSE,\"[Book1]Sheet1\")", T("'[Book1]Sheet1'!R2C3"), ms("ADDRESS") + " example")
au("=ADDRESS(2,3,1,FALSE,\"EXCEL SHEET\")", T("'EXCEL SHEET'!R2C3"), ms("ADDRESS") + " example")
au("=COLUMN(C5)", num(3), ms("COLUMN"))
au("=COLUMNS(A1:C4)", num(3), ms("COLUMNS"), ref="E1")
au("=ROW(C10)", num(10), ms("ROW"))
au("=ROWS(C1:E4)", num(4), ms("ROWS"), ref="F1")
au("=INDIRECT(\"B1\")", num(5), ms("INDIRECT"), cells={"B1": "5"})
au("=OFFSET(A2,1,1)", num(9), ms("OFFSET"), cells={"A2": "1", "B3": "9"}, ref="D1")
au("=SUM(OFFSET(A2,0,0,2,1))", num(3), ms("OFFSET") + ": height", cells={"A2": "1", "A3": "2", "A4": "4"}, ref="D1")
au("=HYPERLINK(\"https://example.org\",\"Click\")", T("Click"), ms("HYPERLINK") + ": shows the friendly name", "low")
au("=ISFORMULA(B2)", B(True), ms("ISFORMULA"), "low", cells={"B2": "=1+1"}, ref="D1")
au("=ERROR.TYPE(1/0)", num(2), ms("ERROR.TYPE"))
au("=ERROR.TYPE(NA())", num(7), ms("ERROR.TYPE"))
au("=ERROR.TYPE(5)", E("#N/A"), ms("ERROR.TYPE") + ": no error is #N/A", "low")
au("=ISBLANK(B2)", B(True), ms("ISBLANK"), "low", ref="D1")
au("=ISERR(NA())", B(False), ms("ISERR") + ": #N/A is not counted", "medium")
au("=ISERROR(NA())", B(True), ms("ISERROR"))
au("=ISNA(NA())", B(True), ms("ISNA"))
au("=ISEVEN(-1)", B(False), ms("ISEVEN") + " example")
au("=ISEVEN(2.5)", B(True), ms("ISEVEN") + " example: truncated")
au("=ISODD(5)", B(True), ms("ISODD") + " example")
au("=ISODD(-1)", B(True), ms("ISODD"))
au("=ISNUMBER(\"19\")", B(False), ms("ISNUMBER") + ": text is not a number", "medium")
au("=ISNONTEXT(19)", B(True), ms("ISNONTEXT"))
au("=ISTEXT(\"x\")", B(True), ms("ISTEXT"))
au("=NA()", E("#N/A"), ms("NA"))
au("=SUM(SEQUENCE(4))", num(10), ms("SEQUENCE"))
au("=INDEX(SEQUENCE(2,3,10,5),2,3)", num(35), ms("SEQUENCE") + ": rows, columns, start, step")
au("=INDEX(SORT({3;1;2}),1)", num(1), ms("SORT"))
au("=INDEX(SORT({3;1;2},1,-1),1)", num(3), ms("SORT") + ": descending")
au("=COUNTA(UNIQUE({1;2;2;3}))", num(3), ms("UNIQUE"))
au("=SUM(FILTER({1;2;3;4},{1;0;1;0}))", num(4), ms("FILTER"))
au("=INDEX(TRANSPOSE({1,2,3}),3,1)", num(3), ms("TRANSPOSE"))

# the reviewer's Excel unit table, for replay.js to work out what Excel shows for a CONVERT Lantern saved
units = {"units": {k: [g, float(f), pre, b, pw] for k, (g, f, pre, b, pw) in X.U.items()},
         "temp": X.TEMP, "tempPre": sorted(X.TEMP_PRE),
         "prefix": [[p, float(m)] for p, m in X.PREFIX], "binary": [[p, k] for p, k in X.BINARY]}
json.dump(units, open(os.path.join(HERE, "excel_units.json"), "w"), indent=0, sort_keys=True)

json.dump(cases, open(os.path.join(HERE, "cases.json"), "w"), indent=1)
from collections import Counter
print(len(cases), "cases", dict(Counter(c["group"] for c in cases)))
