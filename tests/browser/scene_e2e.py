#!/usr/bin/env python3
"""scene_e2e.py -- a landscape in Chat, in a real browser, with a stand-in
model that sees (not part of npm test; needs Playwright with Chromium).

The stand-in answers Adam's two requests of 2026-11-06 with the blocks the
35B wrote on 1.24.6: mountains with their bases in the sky, the sun drawn
last, a road as three upright lines, no shore. Checked on the built site
(run tools/build_site.py first), in Chromium:
  - the road: made in one go; the caption says what Lantern changed; the
    picture the model is shown on the look turn is a real PNG in which the
    road is gray and narrows, the mountains stand on the horizon, and the
    mountain is in front of the sun;
  - the shore: the block goes back once with the line for a beach; the
    second block is drawn with the mountains on the horizon and sand at the
    bottom;
  - no page errors.
Usage: python3 tests/browser/scene_e2e.py [outdir for the two pictures]
"""
import base64, json, os, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="lantern-scene-")
os.makedirs(OUT, exist_ok=True)
PORT = 8129
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:600]))
    if not cond: fails.append(name)

ROAD_Q = "draw a picture of a road dissapearing into the distance over a far horizon. Fill other things into the picture as needed"
ROAD = ("MAKE DRAWING: Road to the horizon\nrect 0 0 20 12 fill sky\nrect 0 6 20 6 fill green\nline 10 6 10 12 fill black width 1\nline 9 6 9 12 fill black width 1\n"
        "line 11 6 11 12 fill black width 1\ntri 2 6 10 4 18 6 fill brown\ntri 1 4 6 2 11 4 fill gray\ntri 9 5 14 3 19 5 fill gray\ncircle 16 3 2 fill yellow\nEND")
SHORE_Q = "draw a picture of an ocean shore with mountains in the distance at sunset"
SHORE = ("MAKE DRAWING: Ocean shore at sunset\nrect 0 0 20 12 fill orange\nrect 0 8 20 4 fill blue\ntri 2 8 10 4 18 8 fill brown\ntri 1 5 6 2 11 5 fill gray\n"
         "tri 8 6 14 3 19 6 fill gray\ncircle 16 3 2 fill yellow\nEND")
SHORE2 = SHORE.replace("rect 0 8 20 4 fill blue\n", "rect 0 8 20 4 fill blue\nrect 0 10.5 20 1.5 fill sand\n")
calls, pngs = [], []

def text_of(c):
    return c if isinstance(c, str) else "\n".join(x.get("text", "") for x in c if x.get("type") == "text")

def reply(body):
    msgs = body["messages"]; last = msgs[-1]; t = text_of(last.get("content"))
    users = "\n".join(text_of(m.get("content")) for m in msgs if m.get("role") == "user")
    if isinstance(last.get("content"), list) and any(x.get("type") == "image_url" for x in last["content"]):
        pngs.append({"text": t, "url": [x for x in last["content"] if x.get("type") == "image_url"][0]["image_url"]["url"]})
        return "LOOKS RIGHT: the picture shows what was asked."
    if "ocean shore" in users.split("road dissapearing")[-1] and "ocean shore" in t or (SHORE_Q in users and "Lantern checked your MAKE" in t):
        return SHORE2 if "Lantern checked your MAKE" in t else SHORE
    if "road dissapearing" in t:
        return ROAD
    return "ANSWER: ok"

def handle(route):
    url = route.request.url
    if url.endswith("/v1/models"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": [{"id": "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf"}]}))
    if url.endswith("/props"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"modalities": {"vision": True}}))
    if "/health" in url:
        return route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}')
    if "/v1/chat/completions" in url:
        body = json.loads(route.request.post_data or "{}"); calls.append(body)
        return route.fulfill(status=200, content_type="application/json",
                             body=json.dumps({"choices": [{"message": {"content": reply(body)}, "finish_reason": "stop"}], "usage": {"completion_tokens": 20}}))
    return route.continue_()

# The PNG the model was shown, read in the page itself (a canvas): its size, and the colour at grid points.
READ = """async (a) => {
  var img = new Image(); img.src = a[0];
  await new Promise(function (ok, no) { img.onload = ok; img.onerror = no; });
  var cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, px: a[1].map(function (p) {
    var d = cx.getImageData(Math.min(img.width - 1, Math.floor(p[0] * img.width / 20)), Math.min(img.height - 1, Math.floor(p[1] * img.height / 12)), 1, 1).data;
    return [d[0], d[1], d[2]]; }) };
}"""
class Pic:
    def __init__(self, pg, url):
        self.pg, self.url = pg, url
        self.size = pg.evaluate(READ, [url, []])
    def at(self, gx, gy):
        return tuple(self.pg.evaluate(READ, [self.url, [[gx, gy]]])["px"][0])
    def save(self, path):
        open(path, "wb").write(base64.b64decode(self.url.split(",")[1]))
def px(pic, gx, gy):
    return pic.at(gx, gy)
def near(c, hexv, tol=24):
    t = tuple(int(hexv[i:i + 2], 16) for i in (1, 3, 5))
    return all(abs(a - b) <= tol for a, b in zip(c, t))
GRAY, GREEN, SKY, YELLOW, BROWN, SAND, ORANGE, BLUE = "#6b7280", "#16a34a", "#7dd3fc", "#facc15", "#92400e", "#e9d8a6", "#f97316", "#2563eb"

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1000, "height": 1400}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.route("**/*", handle)
        pg.goto("http://127.0.0.1:%d/index.html#chat" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.aiScene && Lantern.ai && Lantern.ai.canSee && Lantern.ai.canSee() && document.querySelector(\"input[aria-label='Message']\"))", timeout=30000)
        time.sleep(1.5)

        # --- the road ---
        pg.locator("input[aria-label='Message']").fill(ROAD_Q)
        pg.locator("button", has_text="Send").first.click()
        pg.wait_for_function("document.querySelectorAll('.la-make canvas').length >= 1 && /looked at the picture/.test(document.body.innerText)", timeout=30000); time.sleep(0.5)
        page_text = pg.evaluate("document.body.innerText")
        ok("the road is made in one go: one reply from the model, then the look turn", len(calls) == 2 and len(pngs) == 1, [len(calls), len(pngs)])
        ok("the caption under the picture says what Lantern changed, in plain words",
           "Lantern stood the 2 gray mountains on the horizon" in page_text and "put the sun behind the mountain: it was drawn in front" in page_text and
           "drew the road as it looks going away: wide at the bottom edge, a point on the horizon" in page_text, page_text[-900:])
        ok("...and the model is told the same with the picture it is shown", "Before drawing it, Lantern stood the 2 gray mountains on the horizon" in pngs[0]["text"], pngs[0]["text"][:400])
        img = Pic(pg, pngs[0]["url"]); img.save(os.path.join(OUT, "road.png"))
        ok("the picture is a real PNG of exactly its 20 by 12 cells (720 by 432: no white strip at the right or the bottom)", img.size["w"] == 720 and img.size["h"] == 432, img.size)
        ok("the road is gray and narrows: gray near the bottom edge 2 cells either side of its middle, green there half way up, gray on its middle line's sides near the top",
           near(px(img, 8.2, 11.6), GRAY) and near(px(img, 11.8, 11.6), GRAY) and near(px(img, 8.2, 8.5), GREEN) and near(px(img, 11.8, 8.5), GREEN) and near(px(img, 9.7, 7.2), GRAY) and near(px(img, 5, 10), GREEN),
           [px(img, 8.2, 11.6), px(img, 8.2, 8.5), px(img, 9.7, 7.2)])
        ok("the mountains stand on the horizon: gray just above the ground line where there was sky (the bases were at y 4 and 5)", near(px(img, 3, 5.6), GRAY) and near(px(img, 17.5, 5.7), GRAY) and near(px(img, 0.4, 5.6), SKY),
           [px(img, 3, 5.6), px(img, 17.5, 5.7), px(img, 0.4, 5.6)])
        ok("the mountain is in front of the sun: where they overlap the picture is gray; the rest of the sun is yellow", near(px(img, 15, 4.5), GRAY) and near(px(img, 16.6, 1.8), YELLOW), [px(img, 15, 4.5), px(img, 16.6, 1.8)])

        # --- the shore ---
        n0 = len(calls)
        pg.locator("input[aria-label='Message']").fill(SHORE_Q)
        pg.locator("button", has_text="Send").first.click()
        pg.wait_for_function("document.querySelectorAll('.la-make canvas').length >= 2 && (document.body.innerText.match(/looked at the picture/g) || []).length >= 2", timeout=40000); time.sleep(0.5)
        page_text = pg.evaluate("document.body.innerText")
        sent = [text_of(c["messages"][-1].get("content")) for c in calls[n0:]]
        ok("the shore: the first block goes back once, with the line for a beach worked out for this picture",
           len(calls) - n0 == 3 and "add rect 0 10.5 20 1.5 fill sand after the water" in sent[1], [len(calls) - n0, sent[1][:400] if len(sent) > 1 else ""])
        img2 = Pic(pg, pngs[-1]["url"]); img2.save(os.path.join(OUT, "shore.png"))
        ok("the second block is drawn with the mountains on the horizon (gray where their bases left orange sky), the hill in front of them, the sea, and sand along the bottom",
           near(px(img2, 2.5, 7.5), GRAY) and near(px(img2, 18, 7.6), GRAY) and near(px(img2, 10, 6), BROWN) and near(px(img2, 10, 9), BLUE) and near(px(img2, 10, 11.4), SAND) and near(px(img2, 0.3, 3), ORANGE),
           [px(img2, 2.5, 7.5), px(img2, 18, 7.6), px(img2, 10, 6), px(img2, 10, 9), px(img2, 10, 11.4)])
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("\nPictures: " + OUT)
print("SCENE E2E: " + ("ALL PASS" if not fails else "%d FAILED: %s" % (len(fails), "; ".join(fails))))
sys.exit(1 if fails else 0)
