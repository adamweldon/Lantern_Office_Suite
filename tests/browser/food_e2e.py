# food_e2e.py -- the Food tile in a real browser (Chromium through Playwright),
# after its audit, and Chat with a stand-in SMALL model (1.24.5). Not part of
# npm test.
#  - the tile: three groups, every topic opens with Print and Close and
#    closes; the two tables; the daily-needs sum typed into (an adult gets
#    numbers, a baby does not); on a phone's width nothing runs off the side;
#  - Chat with a stand-in 2B: the instructions are the short ones, by the
#    kind of question (1.24.6); "How do I
#    make sauerkraut ..." is given the Fermenting lesson, every step of it;
#    a reply written "ANSWER: CONVERT(26,"mile","km")" is computed and Chat
#    says how it read it; a request the server refuses as too long is sent
#    again, shorter, and Chat says so; a NEED for the question's own numbers
#    is answered by Lantern; a reply that uses nothing of the lesson it was
#    given has the lesson itself shown under it (1.24.6).
# Screenshots go in the folder given (default: the system temp folder).
# Usage: python3 tests/browser/food_e2e.py [output folder]
import json, os, re, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
os.makedirs(OUT, exist_ok=True)
PORT = 8128
fails = []


def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:700]))
    if not cond:
        fails.append(name)


calls = []
state = {"refuse": 0}


def text_of(c):
    return c if isinstance(c, str) else "\n".join(x.get("text", "") for x in c if x.get("type") == "text")


def reply(body):
    last = text_of(body["messages"][-1].get("content"))
    if "LESSONS: passages" in last:
        m = re.search(r"mix in 3 tablespoons of salt[^.\n]*\.", last)
        sent = "For every 2¼ kg (5 lb) " + m.group(0) if m else "It is in the lesson."
        return sent[:-1] + " [1].\nQUOTE [1]: " + sent
    if "TOOL RESULTS" in last:
        return "ANSWER: That is {result}."
    if "the question gives these numbers" in last:
        return "=VOLTS(0.02,470)\nANSWER: The voltage is {result} volts."
    if "26 miles" in last:
        return "ANSWER: CONVERT(26,\"mile\",\"km\")"
    if "470 ohm" in last:
        return "NEED: What is the resistance in ohms and the current in amperes?"
    if "having a fit" in last:
        return "ANS: = (1)\nANS: = (2)\nANS: = (3)"
    if "about water" in last:
        return "Water is a liquid that every living thing needs."
    return "ANSWER: Not in my library."


def handle(route):
    url = route.request.url
    if url.endswith("/v1/models"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": [{"id": "Stand-in-2B-Q4_K_M.gguf"}]}))
    if url.endswith("/props"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"modalities": {"vision": False}}))
    if "/health" in url:
        return route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}')
    if "/v1/chat/completions" in url:
        body = json.loads(route.request.post_data or "{}")
        calls.append(body)
        if state["refuse"] > 0:
            state["refuse"] -= 1
            return route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": {"code": 400, "type": "exceed_context_size_error",
                                 "message": "request (8566 tokens) exceeds the available context size (8192 tokens), try increasing it"}}))
        return route.fulfill(status=200, content_type="application/json",
                             body=json.dumps({"choices": [{"message": {"content": reply(body)}, "finish_reason": "stop"}], "usage": {"completion_tokens": 40}}))
    return route.continue_()


def ask(pg, q, wait_js, timeout=25000):
    pg.locator("input[aria-label='Message']").fill(q)
    pg.locator("button", has_text="Send").first.click()
    pg.wait_for_function(wait_js, timeout=timeout)
    time.sleep(0.6)
    return pg.evaluate("document.body.innerText")


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
        pg.goto("http://127.0.0.1:%d/index.html#food" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.foodNeeds && document.querySelectorAll('table.data').length === 2)", timeout=30000)
        # (the built site is the version package.json names: a pinned number here failed on every version after it)
        VER = json.load(open(os.path.join(ROOT, "package.json")))["version"]
        ok("the built site is this version (" + VER + ")", pg.evaluate("Lantern.version") == VER, pg.evaluate("Lantern.version"))

        # --- the tile ---
        heads = pg.eval_on_selector_all("h2", "els => els.map(e => e.textContent)")
        ok("three groups, then the sum and the tables", heads[:3] == ["Eating well", "Safe to eat", "Keeping food"] and "Preserving food" in heads and "Cook until safe" in heads, heads)
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
        ok("all %d topics open with Print and Close, and Esc closes them" % len(names), len(names) == 10 and not bad, bad)
        t1 = pg.locator("table.data").nth(0).inner_text()
        t2 = pg.locator("table.data").nth(1).inner_text()
        ok("the preserving table says what each way needs to be safe, and offers no oil covering", "To be safe" in t1 and "boil the strips 5 minutes" in t1 and "Oil covering" not in t1 and "never dry fish unsalted" in t1, t1[:300])
        ok("the cooking table gives temperatures", "74°C" in t2 and "63°C, then rest 3 minutes" in t2 and "brought to the boil" in t2, t2[:300])
        page = pg.evaluate("document.body.innerText")
        ok("...and the notes under them: botulism, and what to do with no thermometer", "cannot be seen, smelt or tasted" in page and "boil or stew meat in small pieces" in page)
        pg.screenshot(path=os.path.join(OUT, "food_tile.png"), full_page=True)

        # --- the sum, typed into ---
        pg.locator("input[aria-label='Weight in kg']").fill("70")
        pg.locator("input[aria-label='Height in cm']").fill("175")
        pg.locator("input[aria-label='Age in years']").fill("30")
        pg.locator("select[aria-label='Sex']").select_option("m")
        card = pg.locator(".convbox", has_text="Daily needs: energy, water, protein")
        ok("an adult: energy, water and protein", "2,556 kcal/day" in card.inner_text().replace(" ", ",") or "2556 kcal/day" in card.inner_text().replace(",", "").replace(" ", ""), card.inner_text()[-200:])
        pg.locator("input[aria-label='Weight in kg']").fill("8")
        pg.locator("input[aria-label='Height in cm']").fill("70")
        pg.locator("input[aria-label='Age in years']").fill("0.7")
        txt = card.inner_text()
        ok("a baby: no number, and why", "This sum is for adults" in txt and "kcal/day" not in txt and "litres/day" not in txt and "only breast milk for about the first six months" in txt, txt[-300:])
        card.locator(".lessonlink").click()
        ok("...the link under it opens Feeding babies and children", pg.locator(".lesson-overlay").count() == 1 and "Not before 12 months" in pg.locator(".lesson-body").inner_text())
        pg.keyboard.press("Escape")

        # --- the help guide ---
        pg.locator("button", has_text=re.compile(r"^\?|Help")).first.click() if pg.locator("button[aria-label='Help']").count() == 0 else pg.locator("button[aria-label='Help']").first.click()
        time.sleep(0.3)
        gtxt = pg.evaluate("document.body.innerText")
        ok("the tile has a help guide", "Food - Help & Tutorial" in gtxt and "three groups" in gtxt, gtxt[:200])
        pg.keyboard.press("Escape")
        if pg.locator(".guide-overlay").count():
            pg.locator(".guide-overlay button", has_text="Close").first.click()

        # --- a phone ---
        pg.set_viewport_size({"width": 360, "height": 740})
        time.sleep(0.3)
        over = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        ok("on a phone's width nothing runs off the side", over <= 0, over)
        pg.screenshot(path=os.path.join(OUT, "food_phone.png"), full_page=True)
        pg.set_viewport_size({"width": 1100, "height": 1000})

        # --- Chat, with a stand-in small model ---
        pg.goto("http://127.0.0.1:%d/index.html#chat" % PORT)
        pg.wait_for_function("!!document.querySelector(\"input[aria-label='Message']\")", timeout=30000)
        pg.wait_for_function("window.Lantern && Lantern.ai && Lantern.ai.server && Lantern.ai.server.state === 'ready'", timeout=15000)
        ok("a 2B on the kit's server gets the short prompt", pg.evaluate("Lantern.aiPrompt.small() && Lantern.aiPrompt.active()") == "short")
        calls.clear()
        text = ask(pg, "How do I make sauerkraut, and how much salt does it need?", "/3 tablespoons of salt/.test(document.body.innerText) && /backed|Lantern gave the AI|from its own lessons/.test(document.body.innerText)")
        sysmsg = text_of(calls[0]["messages"][0]["content"]) if calls else ""
        sent = text_of(calls[-1]["messages"][-1]["content"]) if calls else ""
        ok("the instructions the model got are the short ones for a question in words (under 2,500 characters: no functions, nothing about sums)", calls and calls[0]["messages"][0]["role"] == "system" and len(sysmsg) < 2500
           and "HOHMANN(" not in sysmsg and "FUNCTIONS" not in sysmsg and "STARTS with =" not in sysmsg and "LESSON: <2 to 5 words>" in sysmsg, len(sysmsg))
        ok("Chat says which lesson it gave the AI", "Fermenting (Food tile)" in text, text[-500:])
        ok("...the whole procedure was in front of the model: salt, the weight, the weeks, keeping it", "LESSONS: passages" in sent and "3 tablespoons of salt" in sent and "a plate and a weight" in sent
           and "3 to 4 weeks at 21 to 24" in sent and "as cold as you can" in sent, sent[:300])
        pg.screenshot(path=os.path.join(OUT, "food_chat.png"), full_page=True)

        n1 = len(calls)
        text = ask(pg, "Convert 26 miles to kilometres.", "/41\\.84/.test(document.body.innerText)")
        sys2 = text_of(calls[n1]["messages"][0]["content"]) if len(calls) > n1 else ""
        ok("...and for a sum they are the sums and its functions (CONVERT), under 2,500 characters", "STARTS with =" in sys2 and "CONVERT(" in sys2 and "LESSON:" not in sys2 and len(sys2) < 2500, len(sys2))
        ok("a formula written after ANSWER: is computed (41.84), and Chat says how it read it", "41.84" in text and "Lantern read a formula written after “ANSWER:” as a formula line." in text, text[-500:])

        text = ask(pg, "What voltage is across a 470 ohm resistor carrying 0.02 amps?", "/9\\.4/.test(document.body.innerText)")
        ok("a NEED for the question's own numbers is answered by Lantern, and the sum is done (9.4 volts)", "the question gives these numbers: 470 ohm; 0.02 amps" in text and "9.4" in text, text[-600:])

        n0 = len(calls)
        state["refuse"] = 1
        text = ask(pg, "Tell me about water in one sentence, from your own knowledge.", "/every living thing needs/.test(document.body.innerText)")
        ok("a request refused as too long is sent again, shorter, and Chat says so", len(calls) == n0 + 2 and len(json.dumps(calls[-1]["messages"])) < len(json.dumps(calls[-2]["messages"]))
           and "That was more than the AI model can hold at once; Lantern sent it a shorter version of the conversation." in text, [len(calls) - n0, text[-300:]])
        pg.screenshot(path=os.path.join(OUT, "food_chat_small.png"), full_page=True)

        # (1.24.6) a reply with not one sentence from the lesson: the lesson itself is shown under it
        text = ask(pg, "My brother is having a fit. What do I do?", "!!document.querySelector('.la-lesson-shown')")
        box = pg.locator(".la-lesson-shown").last
        btxt = box.inner_text()
        ok("a reply that uses nothing of the lesson Lantern gave: the lesson itself is shown under it, whole, as Lantern\u2019s own words",
           "The AI\u2019s answer does not use the lesson Lantern gave it. This is what Lantern\u2019s own lesson says:" in btxt and "Fits (seizures, convulsions) (Health tile)" in btxt
           and "Note the time it starts." in btxt and "Put nothing in the mouth" in btxt, btxt[:400])
        box.scroll_into_view_if_needed()
        pg.screenshot(path=os.path.join(OUT, "chat_lesson_shown.png"))
        box.locator("button", has_text="Open the lesson").click()
        time.sleep(0.5)
        ok("...and its button opens the lesson", pg.locator(".lesson-overlay").count() == 1 and "Fits" in pg.locator(".lesson-overlay").inner_text()[:300], pg.url)
        pg.keyboard.press("Escape")
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("ALL FOOD BROWSER TESTS PASS" if not fails else "%d FOOD BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
