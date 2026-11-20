#!/usr/bin/env python3
# excel_ref.py -- the reviewer's own reading of Excel's CONVERT (review of draft 1.24.29, 2026-11-20).
# Written from Microsoft's CONVERT page (unit names, groups, prefixes, case-sensitivity, #N/A rules) and the exact
# definitions of the units (international yard and pound 1959: 1 lb = 0.45359237 kg, 1 yd = 0.9144 m; standard
# gravity 9.80665 m/s2; US gallon 231 in3; imperial gallon 4.54609 l; IT calorie 4.1868 J, thermochemical 4.184 J;
# IT BTU 1055.05585262 J; US survey foot 1200/3937 m; NIST SP 811). Not read from Lantern's source.
# Arithmetic in exact fractions; a unit whose constant Excel does not publish (u, eV, ly, pc, mmHg, flb, admkn) is
# marked UNJUDGED: the reviewer could not be sure of Excel's own constant to 15 digits.
from fractions import Fraction as Fr

IN = Fr(254, 10000)
FT = 12 * IN
YD = 3 * FT
MI = 5280 * FT
LBM = Fr(45359237, 100000000)          # kg
G0 = Fr(980665, 100000)                # m/s2
LBF = LBM * G0                         # N
GAL = 231 * IN ** 3                    # m3 (US gallon)
UKGAL = Fr(454609, 100000000)          # m3
SFT = Fr(1200, 3937)                   # US survey foot, m
HP = 550 * FT * LBF                    # W (mechanical horsepower, 550 ft lbf/s)

UNJUDGED = set(["u", "eV", "ev", "ly", "ly2", "ly^2", "ly3", "ly^3", "parsec", "pc", "mmHg", "flb", "admkn", "sg"])

# name -> (group, factor to SI, metric prefixes allowed, binary prefixes allowed, power of a prefix)
U = {}
def add(names, group, f, pre=False, binary=False, power=1):
    for n in names.split():
        U[n] = (group, Fr(f), pre, binary, power)

# Weight and mass (kg)
add("g", "mass", Fr(1, 1000), True)
add("sg", "mass", LBF / FT)
add("lbm", "mass", LBM)
add("u", "mass", Fr("1.66053906660e-27"), True)
add("ozm", "mass", LBM / 16)
add("grain", "mass", LBM / 7000)
add("cwt shweight", "mass", 100 * LBM)
add("uk_cwt lcwt hweight", "mass", 112 * LBM)
add("stone", "mass", 14 * LBM)
add("ton", "mass", 2000 * LBM)
add("uk_ton LTON brton", "mass", 2240 * LBM)
# Distance (m)
add("m", "length", 1, True)
add("mi", "length", MI)
add("Nmi", "length", 1852)
add("in", "length", IN)
add("ft", "length", FT)
add("yd", "length", YD)
add("ang", "length", Fr(1, 10 ** 10), True)
add("ell", "length", 45 * IN)
add("ly", "length", Fr(9460730472580800), True)
add("parsec pc", "length", Fr("3.0856775814913673e16"), True)
add("Picapt Pica", "length", IN / 72)
add("pica", "length", IN / 6)
add("survey_mi", "length", 5280 * SFT)
# Time (s)
add("yr", "time", Fr(36525, 100) * 86400)
add("day d", "time", 86400)
add("hr", "time", 3600)
add("mn min", "time", 60)
add("sec s", "time", 1, True)
# Pressure (Pa)
add("Pa p", "pressure", 1, True)
add("atm at", "pressure", 101325, True)
add("mmHg", "pressure", Fr(101325, 760), True)
add("psi", "pressure", LBF / IN ** 2)
add("Torr", "pressure", Fr(101325, 760))
# Force (N)
add("N", "force", 1, True)
add("dyn dy", "force", Fr(1, 100000), True)
add("lbf", "force", LBF)
# "pond" is not on Microsoft's CONVERT page (checked 2026-11-20; LibreOffice has it as its own extra)
# Energy (J)
add("J", "energy", 1, True)
add("e", "energy", Fr(1, 10 ** 7), True)
add("c", "energy", Fr(4184, 1000), True)
add("cal", "energy", Fr(41868, 10000), True)
add("eV ev", "energy", Fr("1.602176634e-19"), True)
add("HPh hh", "energy", HP * 3600)
add("Wh wh", "energy", 3600, True)
add("flb", "energy", FT * LBF)
add("BTU btu", "energy", Fr("1055.05585262"))
# Power (W)
add("HP h", "power", HP)
add("PS", "power", Fr("735.49875"))
add("W w", "power", 1, True)
# Magnetism (T)
add("T", "magnetism", 1, True)
add("ga", "magnetism", Fr(1, 10000), True)
# Volume (m3)
add("tsp", "volume", GAL / 768)
add("tspm", "volume", Fr(5, 10 ** 6))
add("tbs", "volume", GAL / 256)
add("oz", "volume", GAL / 128)
add("cup", "volume", GAL / 16)
add("pt us_pt", "volume", GAL / 8)
add("uk_pt", "volume", UKGAL / 8)
add("qt", "volume", GAL / 4)
add("uk_qt", "volume", UKGAL / 4)
add("gal", "volume", GAL)
add("uk_gal", "volume", UKGAL)
add("l L lt", "volume", Fr(1, 1000), True)
add("ang3 ang^3", "volume", Fr(1, 10 ** 30), True, False, 3)
add("barrel", "volume", 42 * GAL)
add("bushel", "volume", Fr("2150.42") * IN ** 3)
add("ft3 ft^3", "volume", FT ** 3)
add("in3 in^3", "volume", IN ** 3)
add("ly3 ly^3", "volume", Fr(9460730472580800) ** 3, True, False, 3)
add("m3 m^3", "volume", 1, True, False, 3)
add("mi3 mi^3", "volume", MI ** 3)
add("yd3 yd^3", "volume", YD ** 3)
add("Nmi3 Nmi^3", "volume", Fr(1852) ** 3)
add("GRT regton", "volume", 100 * FT ** 3)
add("MTON", "volume", 40 * FT ** 3)
# Area (m2)
add("uk_acre", "area", 4840 * YD ** 2)
add("us_acre", "area", 43560 * SFT ** 2)
add("ang2 ang^2", "area", Fr(1, 10 ** 20), True, False, 2)
add("ar", "area", 100, True)
add("ft2 ft^2", "area", FT ** 2)
add("ha", "area", 10000)
add("in2 in^2", "area", IN ** 2)
add("ly2 ly^2", "area", Fr(9460730472580800) ** 2, True, False, 2)
add("m2 m^2", "area", 1, True, False, 2)
add("Morgen", "area", 2500)
add("mi2 mi^2", "area", MI ** 2)
add("Nmi2 Nmi^2", "area", Fr(1852) ** 2)
add("yd2 yd^2", "area", YD ** 2)
# Information (bit)
add("bit", "info", 1, True, True)
add("byte", "info", 8, True, True)
# Speed (m/s)
add("admkn", "speed", 6080 * FT / 3600)
add("kn", "speed", Fr(1852, 3600))
add("m/h m/hr", "speed", Fr(1, 3600), True)
add("m/s m/sec", "speed", 1, True)
add("mph", "speed", MI / 3600)

TEMP = {"C": "C", "cel": "C", "F": "F", "fah": "F", "K": "K", "kel": "K", "Rank": "Rank", "Reau": "Reau"}
TEMP_PRE = set(["K", "kel"])

PREFIX = [("da", Fr(10)), ("Y", Fr(10) ** 24), ("Z", Fr(10) ** 21), ("E", Fr(10) ** 18), ("P", Fr(10) ** 15),
          ("T", Fr(10) ** 12), ("G", Fr(10) ** 9), ("M", Fr(10) ** 6), ("k", Fr(10) ** 3), ("h", Fr(10) ** 2),
          ("e", Fr(10)), ("d", Fr(1, 10)), ("c", Fr(1, 100)), ("m", Fr(1, 1000)), ("u", Fr(1, 10 ** 6)),
          ("n", Fr(1, 10 ** 9)), ("p", Fr(1, 10 ** 12)), ("f", Fr(1, 10 ** 15)), ("a", Fr(1, 10 ** 18)),
          ("z", Fr(1, 10 ** 21)), ("y", Fr(1, 10 ** 24))]
BINARY = [("Yi", 80), ("Zi", 70), ("Ei", 60), ("Pi", 50), ("Ti", 40), ("Gi", 30), ("Mi", 20), ("ki", 10)]


def look(name):
    """(group, factor, unjudged) or None, as Excel reads a unit name."""
    if name in TEMP:
        return ("temp", TEMP[name], Fr(1), False)
    if name in U:
        g, f, pre, b, pw = U[name]
        return (g, f, name in UNJUDGED)
    for p, k in BINARY:
        if name.startswith(p) and name[len(p):] in U and U[name[len(p):]][3]:
            g, f, pre, b, pw = U[name[len(p):]]
            return (g, f * Fr(2) ** k, False)
    for p, m in PREFIX:
        rest = name[len(p):]
        if name.startswith(p) and rest:
            if rest in TEMP_PRE:
                return ("temp", "K", m, False)
            if rest in U and U[rest][2]:
                g, f, pre, b, pw = U[rest]
                return (g, f * m ** pw, rest in UNJUDGED)
    return None


def to_kelvin(x, t, m=Fr(1)):
    if t == "C":
        return x + Fr("273.15")
    if t == "F":
        return (x - 32) * Fr(5, 9) + Fr("273.15")
    if t == "K":
        return x * m
    if t == "Rank":
        return x * Fr(5, 9)
    if t == "Reau":
        return x * Fr(5, 4) + Fr("273.15")


def from_kelvin(k, t, m=Fr(1)):
    if t == "C":
        return k - Fr("273.15")
    if t == "F":
        return (k - Fr("273.15")) * Fr(9, 5) + 32
    if t == "K":
        return k / m
    if t == "Rank":
        return k * Fr(9, 5)
    if t == "Reau":
        return (k - Fr("273.15")) * Fr(4, 5)


def convert(x, a, b):
    """Excel's CONVERT(x, a, b): a float, or the string '#N/A'; second value: unjudged?"""
    x = Fr(str(x)) if not isinstance(x, Fr) else x
    A, B = look(a), look(b)
    if A is None or B is None or A[0] != B[0]:
        return "#N/A", False
    if A[0] == "temp":
        return float(from_kelvin(to_kelvin(x, A[1], A[2]), B[1], B[2])), False
    return float(x * A[1] / B[1]), (A[2] or B[2])


if __name__ == "__main__":
    import sys
    print(convert(float(sys.argv[1]), sys.argv[2], sys.argv[3]))
