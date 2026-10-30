# music_e2e.py -- songs in a real browser (Chromium through Playwright), Chat
# with a stand-in model (1.19.0): the AI is told MAKE MUSIC; a reply with a
# word that is not a note goes back once with the problem and how Lantern
# reads the block; the corrected song is written out as sheet music and
# played through Web Audio (the button turns to Stop, the red line moves
# along the bars); Save MIDI and Save WAV give real files (MThd, RIFF/WAVE
# at 44.1 kHz with sound in it); Open in Music puts the song in the Make a
# song card, whose examples all play. 1.20.0: the instruments -- Play first
# makes the notes in background workers ("Preparing the instruments"), then
# plays them; a worker's note sounds like the page's own; the waltz for
# violin and piano is saved as a WAV (little_waltz.wav, to listen to).
# Screenshots and sound files in the folder given (default: the system temp
# folder).
# Usage: python3 tests/browser/music_e2e.py [screenshot folder]
import json, os, sys, subprocess, tempfile, time, wave, struct
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8123
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:500]))
    if not cond: fails.append(name)
BAD = """Here is the theme.
MAKE MUSIC: Ode to Joy
key D major
tempo 108
chords D | A7 | D | D - A -
melody F# F# G A | A G F# E | D D E F# | F#. E E2
END"""
GOOD = BAD.replace("F#. E E2", "F# - - E E - - -")
replies, calls = [BAD, GOOD], []
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
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); pg = b.new_page(viewport={"width": 1000, "height": 1300}, accept_downloads=True); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.route("**/*", handle)
        pg.goto("http://127.0.0.1:%d/index.html#chat" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.aiMusic && document.querySelector(\"input[aria-label='Message']\"))", timeout=30000)
        time.sleep(2.5)
        pg.locator("input[aria-label='Message']").fill("Write out the main theme of Beethoven's Ode to Joy with chords, so I can hear it.")
        pg.locator("button", has_text="Send").first.click()
        pg.wait_for_function("document.querySelectorAll('.la-make .la-song canvas').length > 0", timeout=25000); time.sleep(0.8)
        sysmsg = calls[0]["messages"][0]["content"]
        ok("Chat: the AI is told MAKE MUSIC (the bars do the timing)", "MAKE MUSIC: <title>" in sysmsg and "the notes of a bar share it equally" in sysmsg and "MAKE DRAWING" not in sysmsg)
        back = calls[1]["messages"][-1]["content"] if len(calls) > 1 else ""
        ok("...a word that is not a note, and a note far from the tune, go back once, with how Lantern reads a MAKE MUSIC block", "\u201cF#.\u201d (bar 4) is not a note" in back and
           "\u201cE2\u201d is far below the rest of the tune" in back and
           "Lantern reads a MAKE MUSIC block line by line" in back and "- holds the note before one more share" in back, back[:700])
        t = pg.evaluate("document.querySelector('[aria-label=Conversation]').innerText")
        ok("...the corrected song is made: 4 bars in D major", "Lantern made a song: Ode to Joy \u2014 4 bars in D major" in t and "still questions" not in t, t[-600:])
        card = pg.locator(".la-make").last
        card.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, "music_chat.png"))
        t0 = time.time(); card.locator("button", has_text="Play").first.click(); time.sleep(0.05)
        prep = pg.evaluate("document.querySelector('.la-make .la-song').innerText")
        pg.wait_for_function("Array.from(document.querySelectorAll('.la-make .la-song div')).some(function (d) { return d.style.background && d.style.position === 'absolute' && d.style.display !== 'none'; })", timeout=30000)
        ready = time.time() - t0; time.sleep(1.0)
        st = pg.evaluate("Lantern.musicSampler.stats()")
        ok("Play: the instruments' notes are made first, in background workers, and said (%.1f s here)" % ready, "Preparing the instruments" in prep and (st.get("workers") or 0) >= 1 and st["notes"] >= 10 and ready < 12, [prep[:200], st, ready])
        x1 = pg.evaluate("parseFloat(Array.from(document.querySelectorAll('.la-make .la-song div')).filter(function (d) { return d.style.background && d.style.position === 'absolute'; }).pop().style.left)")
        state = pg.evaluate("Array.from(document.querySelectorAll('.la-make .la-song button')).pop().textContent")
        time.sleep(1.5)
        x2 = pg.evaluate("parseFloat(Array.from(document.querySelectorAll('.la-make .la-song div')).filter(function (d) { return d.style.background && d.style.position === 'absolute'; }).pop().style.left)")
        ok("Play: the button turns to Stop and the line moves along the bars", "Stop" in state and x2 > x1, [state, x1, x2])
        card.locator("button", has_text="Stop").first.click(); time.sleep(0.4)
        ok("...Stop ends it", "Play" in pg.evaluate("Array.from(document.querySelectorAll('.la-make .la-song button')).pop().textContent"))
        with pg.expect_download() as dl: card.locator("button", has_text="Save MIDI").click()
        mp = os.path.join(OUT, "ode.mid"); dl.value.save_as(mp); head = open(mp, "rb").read(14)
        ok("Save MIDI: a standard MIDI file (MThd, format 1, 480 a quarter)", head[:4] == b"MThd" and head[9] == 1 and head[12:14] == bytes([1, 224]) and dl.value.suggested_filename == "Ode_to_Joy.mid", [head, dl.value.suggested_filename])
        cmp = pg.evaluate("""(async function () {
            var S = Lantern.musicSampler, j = S.job('violin', 69, 0.8, 1), mine = S.bake(j), ws = S.workers(), w = ws[0].w;
            var theirs = await new Promise(function (ok) { var h = function (e) { if (e.data.id === 'cmp') { w.removeEventListener('message', h); ok(e.data.buf); } }; w.addEventListener('message', h);
              w.postMessage({ id: 'cmp', engine: j.engine, freq: j.freq, vel: j.vel, params: j.params, sr: j.sr }); });
            function rms(b) { var s = 0; for (var i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); }
            return [mine.length, theirs.length, rms(mine), rms(theirs)]; })()""")
        ok("...a worker's note is the page's own: as long, as loud", cmp[0] == cmp[1] and abs(cmp[2] - cmp[3]) < 0.1 * cmp[2], cmp)
        with pg.expect_download(timeout=60000) as dl: card.locator("button", has_text="Save WAV").click()
        wp = os.path.join(OUT, "ode.wav"); dl.value.save_as(wp)
        wv = wave.open(wp); n = wv.getnframes(); data = struct.unpack("<%dh" % n, wv.readframes(n)); peak = max(abs(x) for x in data) / 32768.0
        ok("Save WAV: 44.1 kHz mono, about the song's length, sound in it and none clipped", wv.getframerate() == 44100 and wv.getnchannels() == 1 and 9 < n / 44100.0 < 13 and 0.2 < peak <= 0.91, [n / 44100.0, peak])
        card.locator("button", has_text="Open in Music").click(); time.sleep(1.5)
        ok("Open in Music: the Make a song card has the song", pg.evaluate("location.hash") == "#music" and "title Ode to Joy" in pg.evaluate("document.querySelector('textarea[aria-label=Song]').value"))
        pg.screenshot(path=os.path.join(OUT, "music_card.png"))
        made = []
        for i in range(6):
            pg.select_option("select[aria-label='Start from']", str(i)); time.sleep(0.5)
            made.append(pg.evaluate("document.querySelector('textarea[aria-label=Song]').parentNode.innerText.indexOf('\u26a0') < 0 && !!document.querySelector('.la-song canvas')"))
            pg.locator(".la-song canvas").first.screenshot(path=os.path.join(OUT, "music_example_%d.png" % i))
        ok("every example is made, written out, nothing questioned", all(made), made)
        pg.select_option("select[aria-label='Start from']", "1"); time.sleep(0.6)
        with pg.expect_download(timeout=90000) as dl: pg.locator("button", has_text="Save WAV").first.click()
        lw = os.path.join(OUT, "little_waltz.wav"); dl.value.save_as(lw)
        wv = wave.open(lw); n = wv.getnframes(); data = struct.unpack("<%dh" % n, wv.readframes(n)); peak = max(abs(x) for x in data) / 32768.0
        rms = (sum(x * x for x in data[:n // 2]) / max(1, n // 2)) ** 0.5 / 32768.0
        ok("the waltz for violin and piano as a WAV: its 8 bars of 3/4 at 96, sound all through, none clipped", 16 < n / 44100.0 < 20 and 0.2 < peak <= 0.91 and rms > 0.02, [n / 44100.0, peak, rms])
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("ALL MUSIC BROWSER TESTS PASS" if not fails else "%d MUSIC BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
