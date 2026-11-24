# review_library_1238.py -- the review of the library prompt (LIBRARY_CATALOG) and of the food-keeping reading, replayed.
# An agent that had not seen the change written made 423 cases of its own (tests/fixtures/review_library_1238/, cases.js,
# findings.txt): 147 questions on keeping food, water, medicines, fuel, seeds; 89 replies a model might write with OPEN;
# 125 headers judged; 62 prompts compared with the short ones. On the draft (08959b4) it found 32 high: the first
# reading of how long a thing keeps ("how long ... kept", "safe to eat or drink" of anything) made a question a how-to,
# and HEALTH_CHAT then handed it a Health lesson whole on its looser bar -- the birth lesson for medicines past their
# date, Drowning for diesel, Making water safe for bleach and sea water, Cooking food for wild mushrooms; the header said
# "on shelf" for lessons right 83 times in 100, and named shelves right six times in ten as "most likely"; the place
# cards were sure on "north". Mended: how long a food keeps is its own reading (keeps), given only a Food tile lesson
# by SUITE_CHAT's provider, never a how-to; a shelf named only at 8 in 10 ("likely") or 9 in 10 ("sure"), counted per
# kind of evidence and per shelf; OPEN read however a model dresses the line but never in a list of steps; a shelf
# opened gives a lesson only when it has something of the question. After that every case agrees but these.
# Usage: python3 tests/review_library_1238.py [-v]
import os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "review_library_1238")
KEEPS_MISS = ("nothing is given, as before 1.24.38: the reading was narrowed after this review (a food named, how long it keeps, "
              "no medicine, no person going without; \u201csafe to eat or drink\u201d left out) -- a safe miss (rule 7), where the first draft "
              "handed medicines the birth lesson, diesel Drowning, bleach and sea water Making water safe.")
KEEP = {
    "keeps-rice-overnight": KEEPS_MISS,
    "keeps-pizza": KEEPS_MISS,
    "keeps-smells": KEEPS_MISS,
    "keeps-soup-stove": KEEPS_MISS,
    "keeps-rice-can-i": KEEPS_MISS,
    "keeps-chicken-night": KEEPS_MISS,
    "keeps-rice-30deg": KEEPS_MISS,
    "keeps-beans-nofridge": KEEPS_MISS,
    "keeps-raw-meat": KEEPS_MISS,
    "keeps-cow-milk": KEEPS_MISS,
    "keeps-goat-milk-raw": KEEPS_MISS,
    "keeps-cracked-egg": KEEPS_MISS,
    "keeps-raw-eggs": KEEPS_MISS,
    "keeps-raw-eggs-preg": KEEPS_MISS,
    "keeps-cookie-dough": KEEPS_MISS,
    "keeps-bulging-can": KEEPS_MISS,
    "keeps-dented-can": KEEPS_MISS,
    "keeps-pink-pork": KEEPS_MISS,
    "keeps-rare-chicken": KEEPS_MISS,
    "keeps-dried-meat": KEEPS_MISS,
    "keeps-jerky": KEEPS_MISS,
    "keeps-sauerkraut": KEEPS_MISS,
    "keeps-sauerkraut-scum": KEEPS_MISS,
    "keeps-salted-fish": KEEPS_MISS,
    "keeps-smoked-fish": KEEPS_MISS,
    "keeps-rain": KEEPS_MISS,
    "keeps-river": KEEPS_MISS,
    "keeps-this-water": KEEPS_MISS,
    "keeps-stream": KEEPS_MISS,
    "keeps-puddle": KEEPS_MISS,
    "keeps-flood": KEEPS_MISS,
    "keeps-latrine-well": KEEPS_MISS,
    "keeps-bleach-water": KEEPS_MISS,
    "keeps-boiled-stored": KEEPS_MISS,
    "keeps-treated-kept": KEEPS_MISS,
    "keeps-store-water": KEEPS_MISS,
    "keeps-honey-baby": KEEPS_MISS,
    "keeps-ors-kept": KEEPS_MISS,
    "keeps-ors-stored": KEEPS_MISS,
    "keeps-ors-giving": KEEPS_MISS,
    "keeps-cpr-keep": KEEPS_MISS,
    "keeps-recovery": KEEPS_MISS,
    "keeps-tourniquet": KEEPS_MISS,
    "keeps-fever": KEEPS_MISS,
    "keeps-labour": KEEPS_MISS,
    "keeps-bleed-birth": KEEPS_MISS,
    "keeps-sick-goat": KEEPS_MISS,
    "keeps-dead-chicken": KEEPS_MISS,
    "keeps-hen-laying": KEEPS_MISS,
    "keeps-goat-alone": KEEPS_MISS,
    "keeps-hens-no-water": KEEPS_MISS,
    "keeps-seeds": KEEPS_MISS,
    "keeps-saved-seeds": KEEPS_MISS,
    "keeps-tomato-seeds": KEEPS_MISS,
    "keeps-car-garage": KEEPS_MISS,
    "keeps-generator-indoors": KEEPS_MISS,
    "keeps-petrol": KEEPS_MISS,
    "keeps-petrol-stale": KEEPS_MISS,
    "keeps-engine-oil": KEEPS_MISS,
    "keeps-battery-last": KEEPS_MISS,
    "keeps-battery-lights": KEEPS_MISS,
    "keeps-full-moon": KEEPS_MISS,
    "keeps-eclipse": KEEPS_MISS,
    "header-things-fall-apart": "an old fault, not of this change: ASSIST_CORE\u2019s plants-bed card matches \u201capart\u201d, so the question has been a sum with that card in every prompt since the card was added; the library header names the card\u2019s shelf (likely, 83%). Listed in the queue.",
    "header-sky-blue": "an offer, not a claim (\u201cmay be on shelf 5.2 ... OPEN 5.2\u201d, right about half the time for its kind): the model chooses whether to open it.",
    "prompt-assist-body-6": "by design, after this review\u2019s own finding (assist-offers-*): Assist runs no OPEN and gives no lessons, so its library prompt names no shelf for a question in words; the short instructions under the start are whole (the other assist-body cases).",
    "prompt-assist-body-7": "by design, after this review\u2019s own finding (assist-offers-*): Assist runs no OPEN and gives no lessons, so its library prompt names no shelf for a question in words; the short instructions under the start are whole (the other assist-body cases).",
    "prompt-open-run-leftovers": "Keeping food without a fridge is now on the food shelf (the review\u2019s finding 4) and has enough of the question to pass OPEN\u2019s bar; the model chose to open the shelf, and the lesson is about keeping food.",
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
    if int(total.group(1)) < 423: fails.append("%s cases, fewer than 423" % total.group(1))
    new = [c for c in dis if c not in KEEP]
    if new: fails.append("disagree, not kept: " + ", ".join(new))
    gone = [c for c in KEEP if c not in dis]
    if gone: fails.append("kept but now agree (take them out of KEEP): " + ", ".join(gone))
for f in fails: print("FAIL " + f)
if total: print("%s cases: %s agree, %d kept" % (total.group(1), total.group(2), len([c for c in dis if c in KEEP])))
print("ALL LIBRARY REVIEW 1.24.38 CHECKS PASS" if not fails else "LIBRARY REVIEW 1.24.38 FAILED")
sys.exit(1 if fails else 0)
