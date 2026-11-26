# merge_cases.py -- cases.json from the group runs of run_review.py (each run writes cases_<groups>.json): for each group,
# the rows of the last file named here that holds it. Usage: python3 merge_cases.py file1.json file2.json ...
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
by = {}
for f in sys.argv[1:]:
    rows = json.load(open(os.path.join(HERE, f)))
    groups = set(r["group"] for r in rows if r["group"] != "harness")
    for g in groups: by[g] = [r for r in rows if r["group"] == g]
    by.setdefault("harness", [])
    by["harness"] += [dict(r, file=f) for r in rows if r["group"] == "harness"]
order = ["afm", "redact", "find", "sweep", "form", "helv", "parse", "regress", "layout", "perf", "tile", "text", "harness"]
out = [r for g in order for r in by.get(g, [])]
json.dump(out, open(os.path.join(HERE, "cases.json"), "w"), indent=1, ensure_ascii=False)
with open(os.path.join(HERE, "cases.log"), "w") as lg:
    for r in out:
        lg.write(("PASS  " if r["pass"] else "FAIL  ") + "[%s] %s: %s" % (r["group"], r["file"], r["check"]) + ("" if r["pass"] else "  | expected: %s | got: %s" % (r["expected"][:200], r["got"][:400])) + "\n")
tot = {}
for r in out: t = tot.setdefault(r["group"], [0, 0]); t[0] += 1; t[1] += (not r["pass"])
for g in order:
    if g in tot: print("%-8s %4d checks, %3d failed" % (g, tot[g][0], tot[g][1]))
print("all      %4d checks, %3d failed" % (len(out), sum(1 for r in out if not r["pass"])))
