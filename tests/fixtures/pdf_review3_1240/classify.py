# classify.py -- each failed check in cases.json put to the REPORT's finding it shows, or to the oracle / my fixture
import json, re, collections, os
HERE = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(HERE, "cases.json")))
def cls(r):
    g, f, c, got = r["group"], r["file"], r["check"], r["got"]
    if g == "sweep":
        if "c_styles" in f or "h_form_opt" in f: return "oracle"
        return "4 letter-spacing"
    if g == "redsweep":
        if "form_" in f or "forms2" in f or "strings" in f: return "10 flatten look"
        if "t_inherit" in f or "forms3" in f: return "oracle"
        if "s_deep" in f: return "5 deep forms"
        if "e_textops" in f: return "8 decomposed/drift (+fixture glyph-name line)"
        if "c_styles" in f: return "oracle (soft hyphens in poppler's words; Chromium header dashes read as U+E088/E08B, pre-existing)"
    if g == "misc": return "6 links"
    if g == "form": return "9 limits (comb)"
    if "Winterbourne" in c or "Featherstonehaugh" in c or "Marchetti" in c or "Ravenscroft" in c or "manual" in c:
        if f.startswith("l_manual") or "manual" in c: 
            if "by (100%)" in got: return "4 letter-spacing (fused 'by' blacked)"
            if "a + b = c" in c or "Q = 25" in c or "words as near" in c: return "4 letter-spacing"
            return "1 multi-column hyphen"
        if f == "c_styles.pdf": return "3 U+2010 / own hyphen"
        if f == "e_textops.pdf": return "3 own hyphen"
    if f in ("l_manual2.pdf", "l_manual3.pdf", "l_manual2_t1.pdf"):
        return "4 letter-spacing" if ("a + b" in c or "words as near" in c or "by (" in got) else "1 multi-column hyphen"
    if re.search("Şahin|Yıldız|istanbul|ışıl|ŞAHİN|Παπαδ|παπαδ|οδος", c): return "2 Turkish/Greek folding"
    if re.search("Ashworth-Bramley|Quenby-Ashton|U\\+2010|Featherstone‐", c): return "3 own hyphen / U+2010"
    if re.search("José|Griffiths|Clifford", c) or ("e_textops" in f and "still found" in c and "Nuñez" in got): return "8 decomposed/ligature"
    if re.search("Ireby|Keswick|Ambleside|Lindale|Penrith|Bowness|Depth 9|10 deep|9 deep", c) or (f in ("s_deep.pdf",) ) or ("Depth" in got and "still found" in c): return "5 deep forms"
    if re.search("Ainsworth|Boothroyd|078051120|9185550143", c) and ("qflat" in f or "Ainsworth" in c or "Boothroyd" in c): return "9 limits"
    if f in ("f_acro.pdf", "f_orphan.pdf", "f_acro_lin.pdf"): return "7 field estimate"
    if "Keys" in c or "keypad" in c or "pins" in c or "a + b = c" in c or "thick space" in c: return "4 letter-spacing"
    if f in ("e_drawing.pdf", "e_drawing_rot90.pdf") or "Goathland" in c: return "oracle (poppler's slanted fragments) / 11"
    if "stamped10" in c: return "fixture (stamps over the header)"
    if f == "c_styles.pdf" and ("lies over a word" in c or "cut by a mark" in c or "still found" in c): return "oracle (poppler keeps U+00AD inside Chromium's words; header dashes read as U+E088/E08B, pre-existing)"
    if f == "e_textops.pdf" and "still found" in c: return "8 decomposed/ligature (drift) + fixture glyph-name line"
    if "c_styles" in f and "words as near" in c: return "oracle"
    return "other"
out = collections.Counter(); ex = {}
for r in rows:
    if r["pass"]: continue
    k = cls(r); out[k] += 1; ex.setdefault(k, (r["group"], r["file"], r["check"][:120]))
for k, v in sorted(out.items(), key=lambda z: -z[1]): print("%4d  %s   e.g. %s" % (v, k, ex[k]))
