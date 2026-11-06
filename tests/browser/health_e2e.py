# health_e2e.py -- the Health tile in a real browser (Chromium through
# Playwright), after its audit (1.24.4). Not part of npm test.
#  - the tile: four groups, emergencies first, every topic opens and closes;
#    on a phone's width nothing runs off the side;
#  - the ORS mixer, bleach for water, and the counter with real taps over a
#    (shortened) minute;
#  - Print: a lesson printed to a real PDF has its title and its last line,
#    over as many pages as it needs, and nothing of the tile behind it;
#  - Chat with a stand-in model: "My son is choking ..." is given the Choking
#    lesson whole before the model answers, and the answer is shown as backed.
# Screenshots and the PDF go in the folder given (default: the system temp folder).
# Usage: python3 tests/browser/health_e2e.py [output folder]
import json, os, re, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
os.makedirs(OUT, exist_ok=True)
PORT = 8127
fails = []


def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:600]))
    if not cond:
        fails.append(name)


calls = []


def text_of(c):
    return c if isinstance(c, str) else "\n".join(x.get("text", "") for x in c if x.get("type") == "text")


def reply(body):
    last = text_of(body["messages"][-1].get("content"))
    if "LESSONS: passages" in last:
        m = re.search(r"\n\[1\] [^\n]*\n([\s\S]*?)\n\n", last)
        lines = [l for l in (m.group(1) if m else "").split("\n") if l.endswith(".") and len(l) > 60]
        sent = (lines[1] if len(lines) > 1 else lines[0]).split(". ")[0] + "."
        return sent[:-1] + " [1].\nQUOTE [1]: " + sent
    return "ANSWER: Not in my library."


def handle(route):
    url = route.request.url
    if url.endswith("/v1/models"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": [{"id": "Stand-in-4B-Q4_K_M.gguf"}]}))
    if url.endswith("/props"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"modalities": {"vision": False}}))
    if "/health" in url:
        return route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}')
    if "/v1/chat/completions" in url:
        body = json.loads(route.request.post_data or "{}")
        calls.append(body)
        return route.fulfill(status=200, content_type="application/json",
                             body=json.dumps({"choices": [{"message": {"content": reply(body)}, "finish_reason": "stop"}], "usage": {"completion_tokens": 40}}))
    return route.continue_()


srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1100, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.route("**/*", handle)
        pg.goto("http://127.0.0.1:%d/index.html#health" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.healthCount && document.querySelector('.health-tool'))", timeout=30000)

        # --- the tile ---
        heads = pg.eval_on_selector_all("h2", "els => els.map(e => e.textContent)")
        ok("four groups, emergencies first", heads[:4] == ["Emergencies", "Sick children and adults", "Mother and baby", "Staying well"], heads)
        names = pg.eval_on_selector_all("button.tile .name", "els => els.map(e => e.textContent)")
        bad = []
        for n in names:
            pg.locator("button.tile", has_text=n).first.click()
            ov = pg.locator(".lesson-overlay")
            if ov.count() != 1 or len(ov.locator(".lesson-body").inner_text()) < 250 or ov.locator(".guide-head button").all_inner_texts() != ["Print", "Close"]:
                bad.append(n)
            pg.keyboard.press("Escape")
            if pg.locator(".lesson-overlay").count():
                bad.append(n + " (did not close)")
        ok("all %d topics open with Print and Close, and Esc closes them" % len(names), len(names) == 42 and not bad, bad)
        pg.screenshot(path=os.path.join(OUT, "health_tile.png"), full_page=True)

        # --- ORS, bleach ---
        ok("the ORS mixer answers at once", pg.locator(".physresult").first.inner_text().startswith("For 1 L: 6 level tsp sugar + 0.5 level tsp salt"), pg.locator(".physresult").first.inner_text())
        pg.locator("input[aria-label='Litres of clean water']").fill("0.5")
        ok("...half a litre: the numbers and the warning", "too much salt is harmful" in pg.locator(".physresult").first.inner_text())
        pg.locator("input[aria-label='Litres of clean water']").fill("0.05")
        ok("...a mouthful: no numbers, mix a litre", "too little to measure safely" in pg.locator(".physresult").first.inner_text())
        bl = pg.locator(".health-tool[data-tool='bleach']")
        bl.locator("input[type='number']").fill("200")
        ok("bleach for a 200 litre drum", "400 drops (about 25 ml, 5 teaspoons)" in bl.locator(".physresult").inner_text(), bl.locator(".physresult").inner_text())
        bl.locator("input[type='checkbox']").check()
        ok("...cloudy water: twice as much", "of cloudy water: 800 drops" in bl.locator(".physresult").inner_text(), bl.locator(".physresult").inner_text())

        # --- the counter, with real taps ---
        pg.evaluate("Lantern.healthCount.seconds = 2")
        ct = pg.locator(".health-tool[data-tool='count']")
        ct.locator("select").nth(1).select_option("2-12m")
        ct.locator("button", has_text="Start one minute").click()
        for _ in range(4):
            ct.locator("button.health-tap").click()
            time.sleep(0.15)
        mid = ct.inner_text()
        pg.wait_for_function("/breaths a minute/.test(document.querySelector(\".health-tool[data-tool='count'] .physresult\").textContent)", timeout=6000)
        res = ct.locator(".physresult").inner_text()
        ok("the counter: taps counted while the time runs, judged when it ends", "so far" in mid and res.startswith("4 breaths a minute") and "not fast breathing" in res, [mid[-120:], res])
        ct.locator("input[type='number']").fill("56")
        ct.locator("button", has_text="What does it mean?").click()
        ok("...a typed count: 56 at 8 months is fast breathing", "50 or more is fast breathing" in ct.locator(".physresult").inner_text() and "health worker" in ct.locator(".physresult").inner_text())
        pg.evaluate("Lantern.healthCount.seconds = 60")

        # --- Print: a real PDF of one lesson ---
        pg.evaluate("window.__printed = 0; window.print = function () { window.__printed++; }; 0")   # (the 0: Playwright calls a function an expression returns)
        pg.locator("button.tile", has_text="Not breathing (CPR)").first.click()
        pg.locator(".lesson-overlay .guide-head button", has_text="Print").click()
        ok("Print opens the print dialog with the lesson marked", pg.evaluate("window.__printed") == 1 and pg.evaluate("document.body.classList.contains('lesson-printing')"))
        pdf = os.path.join(OUT, "health_cpr.pdf")
        pg.pdf(path=pdf, format="A5")
        txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], stdout=subprocess.PIPE).stdout.decode("utf-8", "replace")
        pages = txt.count("\f")
        ok("the printed lesson has its title, its first and its last line", "Not breathing: chest pushes (CPR)" in txt and "needs their chest pushed at once" in re.sub(r"\s+", " ", txt)
           and "no other help is available yet" in re.sub(r"\s+", " ", txt), txt[:300])
        ok("...and nothing of the tile behind it, nor the buttons", "ORS mixer" not in txt and "Staying well" not in txt and "Close" not in txt and "Print" not in txt, txt[:300])
        ok("...on A5 it runs over more than one page and none is lost", pages >= 2, pages)
        pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
        ok("...unmarked after printing", not pg.evaluate("document.body.classList.contains('lesson-printing')"))
        pg.keyboard.press("Escape")
        # the survival cards still print by themselves
        pg.locator("button", has_text="Print survival cards").click()
        pdf2 = os.path.join(OUT, "health_cards.pdf")
        pg.pdf(path=pdf2, format="A4")
        t2 = re.sub(r"\s+", " ", subprocess.run(["pdftotext", pdf2, "-"], stdout=subprocess.PIPE).stdout.decode("utf-8", "replace"))
        ok("the survival cards print as before, with the child's danger signs", "Oral Rehydration Solution" in t2 and "A sick child needs help now if" in t2 and "ORS mixer" not in t2, t2[:300])
        pg.locator(".guide-overlay button", has_text="Close").click()

        # --- a phone ---
        pg.set_viewport_size({"width": 360, "height": 740})
        time.sleep(0.3)
        over = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        ok("on a phone's width nothing runs off the side", over <= 0, over)
        pg.screenshot(path=os.path.join(OUT, "health_phone.png"), full_page=True)
        pg.locator("button.tile", has_text="Choking").first.click()
        pg.screenshot(path=os.path.join(OUT, "health_phone_lesson.png"))
        pg.keyboard.press("Escape")
        pg.set_viewport_size({"width": 1100, "height": 1000})

        # --- Chat ---
        pg.goto("http://127.0.0.1:%d/index.html#chat" % PORT)
        pg.wait_for_function("!!document.querySelector(\"input[aria-label='Message']\")", timeout=30000)
        pg.locator("input[aria-label='Message']").fill("My son is choking on a piece of meat and cannot breathe!")
        pg.locator("button", has_text="Send").first.click()
        pg.wait_for_function("/QUOTE|blows/.test(document.body.innerText) && /backed|Lantern gave the AI/.test(document.body.innerText)", timeout=25000)
        time.sleep(0.8)
        page_text = pg.evaluate("document.body.innerText")
        sent = text_of(calls[-1]["messages"][-1]["content"]) if calls else ""
        ok("Chat: Lantern says which lesson it gave the AI", "from its own lessons" in page_text and "Choking (Health tile)" in page_text, page_text[-600:])
        ok("...the model had the whole Choking lesson in front of it", "LESSONS: passages" in sent and "5 sharp blows between the shoulder blades" in sent and "Never squeeze a baby" in sent
           and "Give the steps to do now, in order" in sent, sent[:300])
        ok("...and its answer is shown", "blows" in page_text, page_text[-400:])
        pg.screenshot(path=os.path.join(OUT, "health_chat.png"), full_page=True)
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("ALL HEALTH BROWSER TESTS PASS" if not fails else "%d HEALTH BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
