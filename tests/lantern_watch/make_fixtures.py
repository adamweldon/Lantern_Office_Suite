#!/usr/bin/env python3
"""Writes the recorded-reading fixtures both watchers replay with --simulate /
-Simulate. Each watch fixture is one second per sample. Run from anywhere:
    python3 make_fixtures.py [out_dir]   (default: ./fixtures next to this file)
"""
import json
import os
import sys

MB = 1048576.0
GB = 1e9

MODELS = [
    {"name": "Qwen3.5-35B-A3B-Q4_K_M.gguf", "bytes": 17.2 * GB, "vbytes": 0.90 * GB},
    {"name": "Qwen3.5-9B-Q4_K_M.gguf", "bytes": 5.6 * GB, "vbytes": 0.88 * GB},
    {"name": "Qwen3.5-4B-Q4_K_M.gguf", "bytes": 2.7 * GB, "vbytes": 0.67 * GB},
    {"name": "Qwen3.5-0.8B-Q8_0.gguf", "bytes": 0.8 * GB, "vbytes": 0.20 * GB},
]
BIG = MODELS[0]
BIG_TOTAL = BIG["bytes"] + BIG["vbytes"]


def lerp(a, b, f):
    return a + (b - a) * max(0.0, min(1.0, f))


def load(total, mbps_at, avail_at, paging_at=lambda i: 0.0, start_avail=26000.0, prep=5, ready=5, stop=True,
         ws_final=None, max_s=900):
    """A load: 1 s starting, then reading at mbps_at(i), then `prep` seconds
    preparing, `ready` seconds answering, then the engine stops."""
    s = [{"engine": True, "health": 0, "readBytes": 0.0, "availMb": start_avail, "pagingPs": 0.0,
          "commitPct": 35.0, "cpuPct": 8.0, "engineCpuPct": 0.0, "engineWsMb": 40.0, "enginePrivMb": 30.0}]
    read = 0.0
    i = 0
    ws_final = ws_final if ws_final is not None else total / MB * 0.96
    while read < total and i < max_s:
        i += 1
        read = min(total, read + mbps_at(i) * MB)
        s.append({"engine": True, "health": 503, "readBytes": read, "availMb": avail_at(i, read / total),
                  "pagingPs": paging_at(i), "commitPct": 40.0, "cpuPct": 22.0, "engineCpuPct": 6.0,
                  "engineWsMb": lerp(40.0, ws_final * 0.15, read / total), "enginePrivMb": 900.0})
    last = s[-1]
    for k in range(prep):
        x = dict(last)
        x.update(engineWsMb=lerp(ws_final * 0.15, ws_final, (k + 1) / float(prep)), engineCpuPct=95.0, pagingPs=paging_at(i + k))
        s.append(x)
    for k in range(ready):
        x = dict(s[-1])
        x.update(health=200, engineCpuPct=1.0, pagingPs=0.0)
        s.append(x)
    if stop:
        s.append({"engine": False, "health": 0, "readBytes": s[-1]["readBytes"], "availMb": 25000.0})
    return s


def fixtures():
    fx = {}
    plan32 = {"totalMb": 32500, "availMb": 26000}
    fx["watch_usb_normal"] = {"drive": "usb", "plan": plan32, "models": MODELS,
                              "samples": load(BIG_TOTAL, lambda i: 120.0, lambda i, f: lerp(26000, 9000, f))}
    slow = load(BIG_TOTAL, lambda i: 35.0, lambda i, f: lerp(26000, 9000, f), max_s=90, prep=0, ready=0, stop=False)
    slow.append({"engine": False, "health": 0, "readBytes": slow[-1]["readBytes"], "availMb": 20000.0})
    fx["watch_usb_slow"] = {"drive": "usb", "plan": plan32, "models": MODELS, "samples": slow}

    def p_rate(i):
        return 40.0 if 30 <= i <= 80 else 120.0

    def p_avail(i, f):
        if i < 30:
            return lerp(6000, 350, i / 30.0)
        if i <= 80:
            return 350.0
        return 900.0

    def p_paging(i):
        if 30 <= i <= 80:
            return 2500.0
        if 80 < i <= 120:
            return 100.0
        return 0.0
    fx["watch_pressure"] = {"drive": "usb", "plan": {"totalMb": 16000, "availMb": 6000}, "models": MODELS,
                            "planResult": {"v": 1, "choice": "anyway", "picked": BIG["name"], "wanted": BIG["name"], "availMb": 6000, "totalMb": 16000, "needMb": 20300, "reason": "total"},
                            "samples": load(BIG_TOTAL, p_rate, p_avail, p_paging, start_avail=6000.0)}
    cached = [{"engine": True, "health": 0, "readBytes": 0.0, "availMb": 27000.0, "engineWsMb": 40.0}]
    for k in range(1, 8):
        cached.append({"engine": True, "health": 503, "readBytes": 0.02 * GB, "availMb": 27000.0,
                       "engineWsMb": lerp(40.0, BIG_TOTAL / MB * 0.97, k / 6.0), "engineCpuPct": 80.0})
    for k in range(3):
        cached.append({"engine": True, "health": 200, "readBytes": 0.02 * GB, "availMb": 26900.0, "engineWsMb": BIG_TOTAL / MB * 0.97})
    fx["watch_cached"] = {"drive": "usb", "plan": plan32, "models": MODELS, "samples": cached}
    fx["watch_never_starts"] = {"drive": "usb", "plan": plan32, "models": MODELS,
                                "samples": [{"engine": False, "health": 0, "availMb": 26000.0} for _ in range(95)]}
    other = [{"engine": False, "health": 200, "readBytes": 0.0, "availMb": 20000.0} for _ in range(40)]
    fx["watch_other_server"] = {"drive": "usb", "plan": plan32, "models": MODELS, "samples": other}
    nine = MODELS[1]
    fx["watch_smaller_plan"] = {"drive": "drive", "plan": {"totalMb": 32500, "availMb": 13900}, "models": MODELS,
                                "planResult": {"v": 1, "choice": "smaller", "picked": nine["name"], "wanted": BIG["name"], "availMb": 13900, "totalMb": 32500, "needMb": 20300, "reason": "busy"},
                                "samples": load(nine["bytes"] + nine["vbytes"], lambda i: 300.0, lambda i, f: lerp(13900, 7000, f))}
    # plan fixtures: {"plan": {totalMb, availMb, answer}, "args": {...}, "expect": {...}}
    def plan(total, avail, answer=None):
        d = {"totalMb": total, "availMb": avail}
        if answer is not None:
            d["answer"] = answer
        return d
    fx["plan_fits"] = {"models": MODELS, "plan": plan(32500, 26000), "model": BIG["name"], "expect": ["ARGS=--prio -1"]}
    fx["plan_busy_smaller"] = {"models": MODELS, "plan": plan(32500, 14000, 0), "model": BIG["name"], "expect": ["ARGS=--prio -1", "PICK=" + nine["name"]]}
    fx["plan_busy_anyway"] = {"models": MODELS, "plan": plan(32500, 14000, 1), "model": BIG["name"], "expect": ["ARGS=--prio -1"]}
    fx["plan_busy_stop"] = {"models": MODELS, "plan": plan(32500, 14000, 2), "model": BIG["name"], "expect": ["ARGS=--prio -1", "STOP=1"]}
    fx["plan_total_small"] = {"models": MODELS, "plan": plan(16000, 12000), "model": BIG["name"], "expect": ["ARGS=--prio -1", "PICK=" + nine["name"]]}
    fx["plan_forced"] = {"models": MODELS, "plan": plan(32500, 14000, 0), "model": BIG["name"], "forced": True, "expect": ["ARGS=--prio -1"]}
    fx["plan_tight_smallest"] = {"models": MODELS, "plan": plan(8000, 600), "model": MODELS[2]["name"], "expect": ["ARGS=--prio -1", "PICK=" + MODELS[3]["name"]]}
    fx["plan_no_smaller"] = {"models": MODELS, "plan": plan(8000, 500), "model": MODELS[3]["name"], "expect": ["ARGS=--prio -1"]}
    fx["plan_novision_fits"] = {"models": MODELS, "plan": plan(32500, 16500), "model": BIG["name"], "novision": True, "expect": ["ARGS=--prio -1"]}
    # an "8 GB" Windows laptop with the 4B the launcher picks for it: a little
    # short of free memory is normal there and must not bring up the question
    fx["plan_8gb_4b_fits"] = {"models": MODELS, "plan": plan(7800, 3500), "model": MODELS[2]["name"], "expect": ["ARGS=--prio -1"]}
    fx["plan_novision_needed"] = {"models": MODELS, "plan": plan(32500, 16500), "model": BIG["name"], "expect": ["ARGS=--prio -1", "PICK=" + nine["name"]]}
    return fx


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
    os.makedirs(out, exist_ok=True)
    for name, data in fixtures().items():
        with open(os.path.join(out, name + ".json"), "w") as fh:
            json.dump(data, fh, indent=0)
    print("wrote %d fixtures to %s" % (len(fixtures()), out))


if __name__ == "__main__":
    main()
