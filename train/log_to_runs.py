"""log_to_runs.py -- turn a "Lantern Bench" job log into a run file train/build_data.js reads.

    python3 train/log_to_runs.py job.log [more.log ...] --out train/runs

A cloud session can read a GitHub job's log but not its artifact (the artifact store is another site). From 1.24.38
the log prints every row that passed, as the model wrote it, between "=== PASSED ROWS" and "=== END PASSED ROWS ===".
This keeps those rows (and the failed ones, marked, which build_data.js leaves out) in the shape of the AI tile's
Save JSON, named lantern-bench-<model>-<prompt>-<lantern>.json, so build_data.js can put each to today's Lantern again
and keep the right ones as examples. A right reply of the 4B is a right example for the 0.8B: build_data.js still
checks it against the question's own truth and the prompt it would be trained under.
"""
import argparse, json, os, re, sys


def read(path):
    rows, mode, head = [], None, {}
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.rstrip("\n")
        line = re.sub(r"^\d{4}-\d\d-\d\dT[\d:.]+Z ", "", line)
        if line.startswith("=== PASSED ROWS"):
            mode = "pass"; continue
        if line.startswith("=== FAILED ROWS"):
            mode = "fail"; continue
        if line.startswith("=== END"):
            mode = None; continue
        if mode and line.lstrip().startswith("{"):
            try:
                r = json.loads(line.strip())
            except ValueError:
                continue
            r["pass"] = mode == "pass"
            rows.append(r)
            continue
        m = re.match(r"Lantern ([\d.]+), model `[^`]*?\(([^)]*)\)`", line)
        if m:
            head["lantern"], head["model"] = m.group(1), m.group(2)
        m = re.match(r"Prompt: (\w+)", line)
        if m:
            head["prompt"] = m.group(1)
        m = re.match(r"Processor: (?!\$)(.+)", line)
        if m:
            head["processor"] = m.group(1).strip()
        m = re.search(r"--set (a|b)\b", line)
        if m:
            head["set"] = m.group(1)
    return head, rows


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("logs", nargs="+")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for path in a.logs:
        head, rows = read(path)
        passed = [r for r in rows if r["pass"]]
        if not passed:
            print("%s: no passed rows in this log (a log from before 1.24.38 prints only the failed ones)" % path)
            continue
        size = re.search(r"(0\.8|\d+)B", head.get("model", ""))
        name = "lantern-bench-%s-%s-%s.json" % ((size.group(1).lower() + "b") if size else "model", head.get("prompt", "auto"), head.get("lantern", "x"))
        doc = {"bench": "lantern", "source": os.path.basename(path), "lantern": head.get("lantern"), "model": head.get("model"),
               "prompt": head.get("prompt"), "processor": head.get("processor"), "set": head.get("set", "a"), "rows": rows}
        with open(os.path.join(a.out, name), "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
        print("%s -> %s: %d passed, %d failed" % (path, name, len(passed), len(rows) - len(passed)))


if __name__ == "__main__":
    sys.exit(main())
