# hydraulic_e2e.py -- hydraulic circuits in a real browser (Chromium through
# Playwright), Chat with a stand-in model: the bench's question gets the
# MAKE HYDRAULIC instructions; the 35B's old part/wire reply is piped by
# Lantern at once (no correction round) and shown; a MAKE HYDRAULIC press
# with a flow control and a gauge is shown and opens in Draw. Screenshots in
# the folder given (default: the system temp folder). Not part of npm test.
# Usage: python3 tests/browser/hydraulic_e2e.py [screenshot folder]
import json, os, sys, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8119
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:400]))
    if not cond: fails.append(name)
OLD = """MAKE SCHEMATIC: Hydraulic Pump and Cylinder Circuit
mode hydraulic
part P1 pump "Hydraulic Pump"
part V1 valve "Directional Control Valve"
part C1 cylinder "Hydraulic Cylinder"
part T1 tank "Oil Tank"
wire T1 P1
wire P1 V1
wire V1 C1
wire C1 T1
note This circuit shows a basic open-loop system
END"""
PRESS = """MAKE HYDRAULIC: Press
pump P1 "20 L/min"
relief R1 "150 bar"
cylinder C1 double "press ram"
valve V1 C1 4/3 tandem solenoid
flow F1 C1 extend meter-out
gauge G1
END"""
replies, calls = [OLD, PRESS], []
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
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1100, "height": 1300}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.route("**/*", handle)
        pg.goto("http://127.0.0.1:%d/index.html#chat" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.aiHydraulic && document.querySelector(\"input[aria-label='Message']\"))", timeout=30000)
        time.sleep(2.5)
        def ask(q, n):
            pg.locator("input[aria-label='Message']").fill(q)
            pg.locator("button", has_text="Send").first.click()
            pg.wait_for_function("document.querySelectorAll('.la-make canvas').length >= %d" % n, timeout=20000); time.sleep(0.6)
        ask("Draw a hydraulic circuit: a pump takes oil from a tank and feeds a cylinder through a valve, and the oil returns to the tank.", 1)
        sysmsg = calls[0]["messages"][0]["content"]
        log = pg.evaluate("document.querySelector('[aria-label=Conversation]').innerText")
        ok("the AI is told MAKE HYDRAULIC: parts and what they do, never pipes", "MAKE HYDRAULIC: <title>" in sysmsg and "Never write pipes or ports" in sysmsg and "part <ID> <type>" not in sysmsg)
        ok("the 35B's old reply is piped by Lantern at once: no correction round, and Chat says so", len(calls) == 1 and "piped by Lantern" in log and "Lantern added the relief valve R1" in log, log[-500:])
        pg.locator(".la-make canvas").last.scroll_into_view_if_needed()
        pg.screenshot(path=os.path.join(OUT, "hyd_chat_old_reply.png"))
        ask("Now draw a press: a double-acting ram, a 4/3 tandem solenoid valve, a meter-out flow control on extend, a gauge, relief at 150 bar.", 2)
        log = pg.evaluate("document.querySelector('[aria-label=Conversation]').innerText")
        ok("a MAKE HYDRAULIC press is drawn", "Lantern made a schematic: Press" in log and "1 cylinder, 1 valve" in log, log[-400:])
        pg.locator(".la-make canvas").last.scroll_into_view_if_needed()
        pg.screenshot(path=os.path.join(OUT, "hyd_chat_press.png"))
        pg.locator("button", has_text="Open in Draw").last.click(); time.sleep(1.0)
        n = pg.evaluate("Lantern.store.get('draw.scene', []).length")
        ok("Open in Draw: the circuit is there to edit", pg.evaluate("location.hash") == "#draw" and n > 20, n)
        pg.screenshot(path=os.path.join(OUT, "hyd_draw_press.png"))
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("ALL HYDRAULIC BROWSER TESTS PASS" if not fails else "%d HYDRAULIC BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
