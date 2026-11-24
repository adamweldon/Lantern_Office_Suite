# review2_library_1238.py -- the second review of the library prompt and of how long a food keeps, replayed.
# An agent that had seen neither the change written nor the first review made 426 cases of its own and 60 labelled
# questions (tests/fixtures/review2_library_1238/, cases.js, questions.json, findings.txt), on the first review's mends
# (43135ea) and on 1.24.37 beside it. It found 14 high: the header offering "may be on shelf 6.2" for wild mushrooms and a
# cow that died of sickness, and OPEN 6.2 then handing Cooking food so it is safe; OPEN handing the newborn lesson for
# insulin on one rare word; "How long does food poisoning last?" read as food kept; and on its 60 questions the lessons'
# claims under their bands (28 of 34 "sure", 16 of 27 "likely"). Mended by reading less: lessons Chat gives are said as
# found, not claimed; a shelf offered by name only where it is likely; OPEN hands only what Chat's own sure reading finds
# on that shelf, nothing for a medicine off the health shelf nor for whether a thing is safe to eat; "last", fresh
# produce, illness, babies, animals' food and people going without are not food kept; a class opened only alone; the
# 60 questions counted in the surety, a shelf's own count drawn toward its kind's by ten questions' weight. After that
# every case agrees but these. No third reviewer has tried these mends: each reads less than the round the second tried.
# Usage: python3 tests/review2_library_1238.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review2_library_1238")
KEEPS_MISS = ("nothing is given, as on 1.24.37: how long a food keeps is read narrowly (a cooked or kept food named; not \u201clast\u201d, fresh produce, "
              "a medicine, a baby's bottle, animals' food, illness or people going without; the first sure passage a Food tile lesson) -- a safe miss "
              "(rule 7): the first round's wider readings handed medicines, fuel and wild food the wrong lessons.")
OPEN_SURE = ("OPEN hands a shelf's lessons only where Chat's own sure reading (SUITE_PASSAGES, strong) finds them for the question on that shelf, "
             "and none for a medicine off the health shelf or for whether a thing is safe to eat; here the shelf's titles go back, for the model to "
             "ask by LESSON: (a safe miss, rule 7).")
OPEN_NARROW = ("OPEN is read narrowly: a whole class only as the whole reply, a shelf with nothing after it but its title, a note in brackets, a "
               "second shelf or the header's own sentence; this line is left as the model's answer, as on 1.24.37 (a safe miss: the header "
               "says how to write the line).")
KEEP = {
    "A09": KEEPS_MISS,
    "A12": KEEPS_MISS,
    "A18": KEEPS_MISS,
    "A19": KEEPS_MISS,
    "A30": KEEPS_MISS,
    "A31": KEEPS_MISS,
    "A32": KEEPS_MISS,
    "A33": KEEPS_MISS,
    "A34": KEEPS_MISS,
    "A35": KEEPS_MISS,
    "A36": KEEPS_MISS,
    "A37": KEEPS_MISS,
    "A38": KEEPS_MISS,
    "A39": KEEPS_MISS,
    "A40": KEEPS_MISS,
    "A41": KEEPS_MISS,
    "A44": KEEPS_MISS,
    "A45": KEEPS_MISS,
    "A46": KEEPS_MISS,
    "A47": KEEPS_MISS,
    "A48": KEEPS_MISS,
    "A49": KEEPS_MISS,
    "A50": KEEPS_MISS,
    "A51": KEEPS_MISS,
    "A52": KEEPS_MISS,
    "A53": KEEPS_MISS,
    "A54": KEEPS_MISS,
    "B28": OPEN_NARROW,
    "B35": OPEN_NARROW,
    "B36": OPEN_NARROW,
    "B84": OPEN_SURE,
    "B87": OPEN_SURE,
    "B88": OPEN_SURE,
    "B99": "no shelf is offered by name below 8 in 10 (this review: of 16 offers at 5 in 10, 13 were wrong); the header tells the model it may choose a shelf itself, and OPEN 6.4 gives the farming shelf\u2019s titles, Illness among them, to ask for by LESSON:.",
    "C010": "an old fault, not of this change: AI_ACTIONS reads \u201cevery week\u201d as a plan to make, so the question gets the plan block in every prompt; the header names that tool\u2019s shelf. Listed in the queue.",
    "C143": "an old reading, not of this change: SUITE_CHAT\u2019s about() takes \u201cIs there a tool to ...\u201d as a question about Lantern\u2019s tools, and Chat gives its catalog in every prompt; the header says so.",
}
VERBOSE = "-v" in sys.argv
r = subprocess.run(["node", os.path.join(FX, "replay.js")], cwd=ROOT, capture_output=True, text=True, timeout=900)
out = r.stdout
if VERBOSE: print(out)
dis = re.findall(r"^DISAGREE\s+(\S+)", out, re.M)
total = re.search(r"^(\d+) cases: (\d+) AGREE, (\d+) DISAGREE", out, re.M)
fails = []
if not total: fails.append("the replay did not finish: " + (r.stderr or out)[-1500:])
else:
    if int(total.group(1)) < 426: fails.append("%s cases, fewer than 426" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL SECOND LIBRARY REVIEW 1.24.38 CHECKS PASS" if not fails else "SECOND LIBRARY REVIEW 1.24.38 FAILED")
sys.exit(1 if fails else 0)
