# code_lab_e2e.py -- Code Lab in a real browser (Chromium through Playwright):
# the tile after Turtle Code, an example opened and broken and Check finding
# the line, ladder drawn and turned into Structured Text, JavaScript run in a
# real Web Worker and an endless loop stopped, then Chat with a stand-in model:
# MAKE CODE checked, one corrected block, shown once, adapted from the tested
# example, opened in Code Lab with its indents. Not part of npm test.
# Usage: python3 tests/browser/code_lab_e2e.py   (serves site/ on port 8117)
import json, os, sys, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = 8117
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:400]))
    if not cond: fails.append(name)
STEP = """MAKE CODE: Stepper back and forth
language arduino
// A4988 on STEP pin 3, DIR pin 2: 1600 steps one way, then back
#include <AccelStepper.h>

AccelStepper stepper(AccelStepper::DRIVER, 3, 2);

void setup() {
  stepper.setMaxSpeed(1000);
  stepper.setAcceleration(500)
  stepper.moveTo(1600);
}

void loop() {
  if (stepper.distanceToGo() == 0) {
    stepper.moveTo(-stepper.currentPosition());
  }
  stepper.run();
}
END"""
replies = [STEP, STEP.replace("setAcceleration(500)\n", "setAcceleration(500);\n")]
calls = []
def handle(route):
    url = route.request.url
    if url.endswith("/v1/models"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": [{"id": "Qwen3.5-4B-Q4_K_M.gguf"}]}))
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
def pick(pg, ex_id):
    pg.evaluate("""(function(id){ var s = document.querySelector('textarea.cl-ta').closest('.wrap').querySelector('select[aria-label=Examples]');
      s.value = id; s.dispatchEvent(new Event('change')); })""", ex_id)
    time.sleep(0.5)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1100, "height": 1000}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.route("**/*", handle)
        pg.goto("http://127.0.0.1:%d/index.html#codelab" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.codeFiles && document.querySelector('textarea.cl-ta'))", timeout=30000)
        order = pg.evaluate("Lantern.order.slice(Lantern.order.indexOf('code'), Lantern.order.indexOf('code') + 2)")
        ok("Code Lab comes right after Turtle Code", order == ["code", "codelab"] and pg.evaluate("Lantern.apps.code.name") == "Turtle Code", order)
        pick(pg, "arduino-accelstepper-driver")
        pg.evaluate("""(function(){ var t = document.querySelector('textarea.cl-ta'); t.value = t.value.replace('stepper.setMaxSpeed(2000);', 'stepper.setMaxSpeed(2000)');
          t.dispatchEvent(new Event('input')); })()""")
        pg.locator("button", has_text="Check").first.click(); time.sleep(0.4)
        out = pg.evaluate("document.querySelector('.cl-out').innerText")
        red = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('.cl-gut .bad'), function(x){return x.textContent})")
        ok("Check finds the missing ; on its line, red in the margin", "line 19: this line may be missing a ;" in out and red == ["19"], (out, red))
        pick(pg, "ladder-pump-alternation")
        ok("ladder is drawn as rungs", pg.evaluate("!!document.querySelector('.cl-out svg')"))
        pg.locator("button", has_text="Structured Text").first.click(); time.sleep(0.5)
        st = pg.evaluate("document.querySelector('textarea.cl-ta').value")
        ok("Ladder -> Structured Text opens an ST program", st.startswith("PROGRAM Ladder") and "END_PROGRAM" in st, st[:120])
        pick(pg, "javascript-plc-scan")
        pg.locator("button", has_text="Run").first.click(); time.sleep(1.5)
        out = pg.evaluate("document.querySelector('.cl-out').innerText")
        ok("JavaScript runs in a real Web Worker", "motor=true" in out and "finished in" in out, out[-300:])
        pg.evaluate("""(function(){ var t = document.querySelector('textarea.cl-ta'); t.value = 'while (true) {}'; t.dispatchEvent(new Event('input')); })()""")
        pg.locator("button", has_text="Run").first.click(); time.sleep(2.8)
        ok("an endless loop is stopped after 2 s", "stopped after 2 s" in pg.evaluate("document.querySelector('.cl-out').innerText"))
        # Chat with a stand-in model
        pg.evaluate("location.hash='chat'"); time.sleep(2.5)
        pg.locator("input[aria-label='Message']").fill("Write an Arduino sketch to run a stepper back and forth with an A4988 driver")
        pg.locator("button", has_text="Send").first.click()
        pg.wait_for_function("document.body.innerText.indexOf('Lantern made a program') >= 0", timeout=20000); time.sleep(0.5)
        log = pg.evaluate("document.querySelector('[aria-label=Conversation]').innerText")
        ok("the AI was given the tested AccelStepper example", len(calls) == 2 and "Stepper on a step/dir driver" in calls[0]["messages"][0]["content"], len(calls))
        ok("the missing ; went back once; the fixed program is shown once", "line 8: this line may be missing a ;" in log and log.count("stepper.run();") == 1 and "still questions" not in log, log[-600:])
        ok("it says the program was adapted from the tested example", "adapted from Lantern’s tested example" in log, log[-500:])
        pg.locator("button", has_text="Open in Code Lab").last.click(); time.sleep(0.8)
        code = pg.evaluate("document.querySelector('textarea.cl-ta').value")
        ok("Open in Code Lab: the program with its indents", pg.evaluate("location.hash") == "#codelab" and "\n  stepper.setAcceleration(500);\n" in code and "```" not in code, code[:200])
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("ALL CODE LAB BROWSER TESTS PASS" if not fails else "%d CODE LAB BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
