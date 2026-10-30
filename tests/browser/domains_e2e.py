# domains_e2e.py -- pneumatics, control circuits, electronics and sheets by
# column name in a real browser (Chromium through Playwright), Chat with a
# stand-in model (1.18.0). Each question gets its own MAKE instructions; a
# reply with a mistake goes back once with the problem and how Lantern reads
# that kind of block (fixText), and the corrected reply is drawn; the least
# a model can write (a start and a light; a pin naming a relay) is drawn
# with what Lantern added said. Screenshots in the folder given (default:
# the system temp folder).
# Usage: python3 tests/browser/domains_e2e.py [screenshot folder]
import json, os, sys, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8121
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:500]))
    if not cond: fails.append(name)
PNEU_BAD = """MAKE PNEUMATIC: Push to extend, automatic return
pump P1
cylinder C1 double
valve V1 C1 5/2
button S1 V1
roller S2 C1 extended
END"""
PNEU_GOOD = PNEU_BAD.replace("pump P1\n", "")
CONTROL = """MAKE CONTROL: Motor starter
start PB2 M1
lamp LT1 M1 "run" green
END"""
ELEC = """MAKE ELECTRONICS: Relay driver
supply "12 V"
pin P1 "Arduino D7"
relay K1 P1 "12 V coil"
END"""
SHEET = """MAKE SHEET: Shopping
Item | Qty | Price | Cost
Bread | 2 | 1.50 | =[Qty]*[Price]
Milk | 1 | 0.99 | =[Qty]*[Price]
Eggs | 12 | 0.25 | =[Qty]*[Price]
Total | | | =SUM([Cost])
END"""
replies, calls = [PNEU_BAD, PNEU_GOOD, CONTROL, ELEC, SHEET], []
def handle(route):
    url = route.request.url
    if url.endswith("/v1/models"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": [{"id": "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf"}]}))
    if url.endswith("/props"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"modalities": {"vision": False}}))
    if "/health" in url:
        return route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}')
    if "/v1/chat/completions" in url:
        calls.append(json.loads(route.request.post_data or "{}"))
        r = replies.pop(0) if replies else "ANSWER: ok"
        return route.fulfill(status=200, content_type="application/json",
                             body=json.dumps({"choices": [{"message": {"content": r}, "finish_reason": "stop"}], "usage": {"completion_tokens": 20}}))
    return route.continue_()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1100, "height": 1400}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.route("**/*", handle)
        pg.goto("http://127.0.0.1:%d/index.html#chat" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.aiPneumatic && Lantern.aiControl && Lantern.aiElectronics && document.querySelector(\"input[aria-label='Message']\"))", timeout=30000)
        time.sleep(2.5)
        def ask(q, sel, n):   # n: unused (kept for reading); waits for one more of sel than before
            before = pg.evaluate("document.querySelectorAll('%s').length" % sel)
            pg.locator("input[aria-label='Message']").fill(q)
            pg.locator("button", has_text="Send").first.click()
            pg.wait_for_function("document.querySelectorAll('%s').length > %d" % (sel, before), timeout=25000); time.sleep(0.8)
        def log():
            return pg.evaluate("document.querySelector('[aria-label=Conversation]').innerText")
        # --- pneumatics: a mistake, sent back with how Lantern reads the block; then drawn
        ask("Draw a pneumatic circuit: pressing a push button makes a double-acting cylinder extend, and the cylinder returns by itself when it reaches the end of its stroke.", ".la-make canvas", 1)
        sysmsg = calls[0]["messages"][0]["content"]
        ok("pneumatics: the AI is told MAKE PNEUMATIC, never lines or port numbers", "MAKE PNEUMATIC: <title>" in sysmsg and "Never write lines or port numbers" in sysmsg and "MAKE HYDRAULIC" not in sysmsg)
        back = calls[1]["messages"][-1]["content"] if len(calls) > 1 else ""
        ok("...the pump goes back once, with the line's problem and how Lantern reads a MAKE PNEUMATIC block", "a pump is hydraulic" in back and "Lantern reads a MAKE PNEUMATIC block line by line" in back and "roller S3 C1 extended" in back, back[:600])
        t = log()
        ok("...the corrected block is drawn, and what each signal does is said", "S1 (push button) switches V1: C1 extends; S2 (roller, C1 fully out) switches it back: C1 retracts" in t, t[-700:])
        pg.locator(".la-make canvas").last.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, "dom_pneumatic_chat.png"))
        # --- control: the least a model can write
        ask("Draw the control circuit for a motor starter: a stop push button, a start push button with a holding contact so the motor keeps running after start is let go, the overload contact, the starter coil, and a pilot light that is on while the motor runs.", ".la-make canvas", 2)
        sysmsg = calls[2]["messages"][0]["content"]
        ok("control: the AI is told MAKE CONTROL", "MAKE CONTROL: <title>" in sysmsg and "Never write wires" in sysmsg)
        t = log()
        ok("...a start and a light are enough: the coil, holding contact, stop and overload are added and said, at once", len(calls) == 3 and "Lantern added the starter coil M1 that PB2 switches" in t and "a stop PB1 for M1" in t and "the overload contact OL1" in t, t[-800:])
        pg.locator(".la-make canvas").last.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, "dom_control_chat.png"))
        pg.locator("button", has_text="Open in Draw").last.click(); time.sleep(1.0)
        n = pg.evaluate("Lantern.store.get('draw.scene', []).length")
        ok("...Open in Draw: the ladder is there to edit", pg.evaluate("location.hash") == "#draw" and n > 10, n)
        pg.screenshot(path=os.path.join(OUT, "dom_control_draw.png"))
        pg.evaluate("location.hash = 'chat'"); time.sleep(1.5)
        pg.wait_for_function("!!document.querySelector(\"input[aria-label='Message']\")", timeout=10000)
        # --- electronics: a pin naming a relay
        ask("Draw a circuit in which an Arduino output pin switches a 12 V relay coil through an NPN transistor.", ".la-make canvas", 3)
        sysmsg = calls[3]["messages"][0]["content"]
        ok("electronics: the AI is told MAKE ELECTRONICS", "MAKE ELECTRONICS: <title>" in sysmsg and "transistor Q1 K1 P1" in sysmsg)
        t = log()
        ok("...a pin naming the relay gets the transistor, base resistor and diode, said", "Lantern added transistor Q1 to switch K1" in t and "into Q1’s base" in t and "the diode D1 across K1" in t, t[-800:])
        pg.locator(".la-make canvas").last.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, "dom_electronics_chat.png"))
        # --- a sheet by column name
        ask("Make a table of my shopping: 2 loaves of bread at 1.50 each, 1 milk at 0.99, and 12 eggs at 0.25 each, with the cost of each line and a total.", ".la-make table", 1)
        cells = pg.evaluate("Array.from(document.querySelectorAll('.la-make table')).pop().innerText")
        ok("sheets: =[Qty]*[Price] and =SUM([Cost]) worked out (6.99)", "6.99" in cells and "0.99" in cells, cells)
        pg.locator(".la-make table").last.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, "dom_sheet_chat.png"))
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("ALL DOMAIN BROWSER TESTS PASS" if not fails else "%d DOMAIN BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
