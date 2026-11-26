# merge.py -- join the runs' cases_*.json into cases.json: a re-run of some redact cases (cases_redact_rerun.json) takes
# the place of those cases' rows in the first run
import json, os, glob, sys
HERE = os.path.dirname(os.path.abspath(__file__))
rows = []
order = ["cases_redact.json", "cases_area.json", "cases_read.json", "cases_fold.json", "cases_form.json", "cases_tile.json", "cases_misc.json", "cases_sweep_a.json", "cases_sweep_b.json", "cases_sweep_c.json", "cases_redsweep_a.json", "cases_redsweep_b.json"]
rerun = []
for rf in ["cases_redact_rerun.json", "cases_redact_rerun2.json"]:
    rer = os.path.join(HERE, rf)
    if not os.path.exists(rer): continue
    new = json.load(open(rer)); nn = set(r["check"].split(":")[0] for r in new)
    rerun = [r for r in rerun if r["check"].split(":")[0] not in nn] + new
names = set(r["check"].split(":")[0] for r in rerun)
for f in order:
    p = os.path.join(HERE, f)
    if not os.path.exists(p): continue
    for r in json.load(open(p)):
        if f == "cases_redact.json" and r["check"].split(":")[0] in names: continue
        rows.append(r)
    if f == "cases_redact.json": rows += rerun
json.dump(rows, open(os.path.join(HERE, "cases.json"), "w"), indent=1, ensure_ascii=False)
from collections import Counter
c = Counter(r["group"] for r in rows); f_ = Counter(r["group"] for r in rows if not r["pass"])
print(len(rows), "checks,", sum(f_.values()), "failed")
for g in c: print("  %-9s %5d checks %4d failed" % (g, c[g], f_[g]))
