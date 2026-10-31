# sheet_read_e2e.py -- printed music read as a song, in a real browser (Chromium through Playwright), 1.21.0:
# the Sheet Music Reader reads each test sheet (tests/fixtures/sheets: engraved with Verovio, 5.5 to 11 pixels a
# space) bar for bar -- notes, lengths, dots, eighths, rests, key and time -- and its lines play back as read; Chat
# reads a pasted picture of music (with a model that sees and one that does not) and gives the AI the lines; the
# 35B's Ode to Joy from memory (Adam's screenshot, 1.20.0) goes back with the lines as read, and the copied lines
# make the song; the Music tile's reader makes a song of it. 1.21.1: the chords from the piano's left hand, the title
# from the heading, and the 35B's 1.21.0 reply (the tune copied, its own chords) sent back for the chords as read.
# Screenshots in the folder given (default: temp).
# Usage: python3 tests/browser/sheet_read_e2e.py [screenshot folder]
import json, os, sys, subprocess, tempfile, time, base64
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHEETS = os.path.join(ROOT, "tests", "fixtures", "sheets")
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.gettempdir()
PORT = 8124
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:700]))
    if not cond: fails.append(name)
E = json.load(open(os.path.join(SHEETS, "expected.json")))
def b64(f): return base64.b64encode(open(os.path.join(SHEETS, f), "rb").read()).decode()
# the 35B's reply to Adam's screenshot (1.20.0): the tune from memory, wrong from bar 9, under a 4-bar chord loop
FROM_MEMORY = """I can't see the picture you attached, so I can't read the sheet music from it.
MAKE MUSIC: Ode to Joy
key C major
style ballad
sound piano
chords C | G | F | C
melody E E F G | G F E D | C C D E | D - - r
melody E E F G | G F E D | C C D E | D - - r
melody E G A C | D E D C | B C D | A - - r
melody D C B A | G B A F | E - - r
END"""
replies, calls, vision = [], [], [True]
def handle(route):
    url = route.request.url
    if url.endswith("/v1/models"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": [{"id": "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf"}]}))
    if url.endswith("/props"):
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"modalities": {"vision": vision[0]}}))
    if "/health" in url:
        return route.fulfill(status=200, content_type="application/json", body='{"status":"ok"}')
    if "/v1/chat/completions" in url:
        calls.append(json.loads(route.request.post_data or "{}"))
        r = replies.pop(0) if replies else "ANSWER: ok"
        if callable(r): r = r(calls[-1])
        return route.fulfill(status=200, content_type="application/json",
                             body=json.dumps({"choices": [{"message": {"content": r}, "finish_reason": "stop"}], "usage": {"completion_tokens": 20}}))
    return route.continue_()
def text_of(m):
    c = m.get("content")
    return c if isinstance(c, str) else " ".join(x.get("text", "") for x in c if isinstance(x, dict))
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"),
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1000, "height": 1300}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
        pg.route("**/*", handle)
        pg.goto("http://127.0.0.1:%d/index.html#music" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.sheetMusic && Lantern.sheetMusic.song && Lantern.sheetChat && Lantern.musicSong)", timeout=30000)
        READ = """(async function (a) {
          var im = new Image(); im.src = 'data:image/png;base64,' + a; await im.decode();
          var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
          var t0 = performance.now(), r = Lantern.sheetMusic.song(c), ms = performance.now() - t0, old = Lantern.sheetMusic.read(c);
          if (!r.found) return { found: false, staves: old.staves };
          await Lantern.sheetMusic.heading(r);
          var m = Lantern.musicSong.make({ title: '', lines: r.lines.split('\\n') }), pl = m.plan, same = !!pl && pl.melody.length === r.tune.length;
          for (var i = 1; same && i < r.tune.length; i++) if (pl.melody[i].midi - pl.melody[i - 1].midi !== r.tune[i].midi - r.tune[i - 1].midi || Math.abs(pl.melody[i].len - r.tune[i].len) > 1e-9) same = false;
          return { found: true, key: r.key, time: r.time, bars: r.bars.map(function (b) { return b.map(function (e) { return [e.rest ? null : e.midi, e.len]; }); }),
            lines: r.lines, same: same, problems: m.problems, ms: ms, staves: old.staves, spacing: r.spacing, chords: r.chords || null, title: r.title || null, heading: r.heading || null }; })"""
        right = 0
        for f, want in sorted(E["sheets"].items()):
            r = pg.evaluate(READ, b64(f))
            good = r["found"] and r["bars"] == want["bars"] and r["key"] == want["key"] and r["time"] == want["time"]
            right += good
            ok("%s (%.1f px a space): %d bars, key %+d, %s -- every note, length and rest as printed, read in %d ms" % (f, r.get("spacing", 0), len(want["bars"]), want["key"], "/".join(map(str, want["time"])), r.get("ms", 0)), good,
               [r.get("key"), r.get("time"), [(i + 1, g, w) for i, (g, w) in enumerate(zip(r.get("bars", []), want["bars"])) if g != w][:2]])
            ok("...its lines make the same tune again, nothing questioned; the pitch reader finds its staves too", r["found"] and r["same"] and not r["problems"] and r["staves"] >= 1, [r.get("problems"), r.get("staves")])
            ok("...its chords " + ("from the left hand: " + want["chords"] if want.get("chords") else "left to the song (no left hand)"), r.get("chords") == want.get("chords"), r.get("chords"))
            ok("...its heading: " + (repr(want["title"]) if want.get("title") else "none"), r.get("title") == want.get("title") and (not want.get("heading") or r.get("heading") == want["heading"]), [r.get("title"), r.get("heading")])
        ode = pg.evaluate(READ, b64("ode_piano_900.png"))
        ok("Ode to Joy, piano (as in Adam's screenshot): the tune's lines, with the left hand's chords", ode["lines"] == "key C major\ntime 4/4\nchords C | G7 | C | G | C | G7 | C | G C | G C | G7 C | G7 C | G C\n"
           "melody E4 E F G | G F E D | C C D E | E - - D D - r - | E E F G | G F E D | C C D E | D - - C C - r - | D D E C | D - E F E - C - | D - E F E - D - | C D r -", ode["lines"])
        # --- Chat: the picture pasted, the AI given the lines ---
        def chat_round(question, rep, see, sheet="ode_piano_900.png"):
            vision[0] = see; calls.clear(); replies.clear(); replies.extend(rep)
            pg.evaluate("Lantern.ai.detect()"); time.sleep(0.5)
            pg.evaluate("location.hash = 'chat'"); pg.wait_for_selector("input[aria-label='Message']", timeout=15000); time.sleep(0.6)
            pg.evaluate("""(async function (a) {
              var bin = atob(a), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
              await Lantern.chatPics.add([new File([u], 'ode.png', { type: 'image/png' })]); })""", b64(sheet))
            time.sleep(1.2)
            before = pg.evaluate("document.querySelector('[aria-label=Conversation]').innerText.length")
            pg.locator("input[aria-label='Message']").fill(question)
            pg.locator("button", has_text="Send").first.click()
            pg.wait_for_function("document.querySelector('[aria-label=Conversation]').innerText.length > %d && /Lantern made a song|still questions|no MAKE/.test(document.querySelector('[aria-label=Conversation]').innerText.slice(%d))" % (before, before), timeout=40000)
            time.sleep(1.0)
            return pg.evaluate("document.querySelector('[aria-label=Conversation]').innerText").__getitem__(slice(before, None))
        Q = "Use your Lantern Tools to read the sheet music and then reproduce a playable music file"
        COPY = "MAKE MUSIC: Ode to Joy\n" + ode["lines"] + "\nstyle ballad\nsound piano\nEND"
        t = chat_round(Q, [FROM_MEMORY, COPY], True)
        first = text_of(calls[0]["messages"][-1]) if calls else ""
        sysm = calls[0]["messages"][0]["content"] if calls else ""
        ok("Chat (a model that sees): the picture is read and the AI is given its lines, with MAKE MUSIC", "SHEET MUSIC: Lantern’s Sheet Music Reader read the person’s picture -- 12 bars in C major, 4/4" in first and
           ode["lines"] in first and "MAKE MUSIC: <title>" in sysm and "Lantern’s Sheet Music Reader read the picture: \u201cOde to Joy\u201d (Lantern knows the tune), 12 bars in C major" in t, [first[:600], t[:400]])
        back = text_of(calls[1]["messages"][-1]) if len(calls) > 1 else ""
        ok("...the tune from memory goes back: not the tune read (with the lines), and the clash under the repeated chords says where to write", "the melody is not the one Lantern read in the picture" in back and
           ode["lines"] in back and "plays the chords line’s bar 3 again: write a chord for each of the 15 bars, or leave the chords line out" in back, back[:900])
        ok("...the copied lines make the song: 12 bars, nothing questioned", "Lantern made a song: Ode to Joy — 12 bars in C major" in t and "still questions" not in t, t[-500:])
        pg.screenshot(path=os.path.join(OUT, "sheet_chat.png"), full_page=False)
        # the 35B on 1.21.0 (Adam's trial): the tune copied, octaves on every note, chords of its own -- back for the chords
        OWN = ("MAKE MUSIC: Lantern\u2019s Sheet Music Reader\nkey C major\ntime 4/4\ntempo 90\nstyle folk\nsound flute\nchords C | G | F | C | C | G | F | C | Dm | G | C | C\n"
               "melody E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4 - - D4 D4 - r - | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4 - - C4 C4 - r - | D4 D4 E4 C4 | D4 - E4 F4 E4 - C4 - | "
               "D4 - E4 F4 E4 - D4 - | C4 D4 r -\nEND")
        t3 = chat_round("read the sheetmusic using lanterns tools and produce a playable file from it", [OWN, COPY], True, "ode_title_900.png")
        first3 = text_of(calls[0]["messages"][-1]) if calls else ""
        back3 = text_of(calls[1]["messages"][-1]) if len(calls) > 1 else ""
        ok("Chat, a sheet with its heading: the title and the chords given; the 35B's own chords go back for the left hand's", "title Ode to Joy\nkey C major" in first3 and "Printed above the music: Ode to Joy / Ludwig van Beethoven" in first3 and
           "\u201cOde to Joy\u201d" in t3 and "the chords are not the ones the left hand plays in the picture (bar 3 has C): write the chords line exactly as read -- chords C | G7 | C | G" in back3 and
           "Lantern made a song: Ode to Joy" in t3, [first3[:500], back3[:400], t3[-300:]])
        # 1.21.2: Adam's untitled Ode (only the composer printed) was called Fur Elise by the 35B -- Lantern knows the tune, and a wrong name goes back
        ELISE = COPY.replace("MAKE MUSIC: Ode to Joy", "MAKE MUSIC: F\u00fcr Elise")
        t4 = chat_round(Q, [ELISE, COPY], True)
        first4 = text_of(calls[0]["messages"][-1]) if calls else ""
        back4 = text_of(calls[1]["messages"][-1]) if len(calls) > 1 else ""
        ok("Chat, a sheet with no title: Lantern names the tune it knows; the AI's other name goes back, and the song is made with its own",
           "Lantern knows the tune by its first 13 notes: Ode to Joy (Beethoven (Symphony No. 9), 1824)." in first4 and "title Ode to Joy\nkey C major" in first4 and
           "\u201cOde to Joy\u201d (Lantern knows the tune)" in t4 and
           "the song is called \u201cF\u00fcr Elise\u201d, but Lantern knows the tune as \u201cOde to Joy\u201d: write MAKE MUSIC: Ode to Joy" in back4 and "Lantern made a song: Ode to Joy" in t4,
           [first4[:700], back4[:400], t4[-300:]])
        t2 = chat_round("Play this for me", [COPY], False)
        first2 = text_of(calls[0]["messages"][-1]) if calls else ""
        ok("Chat (a model that cannot see): the picture is still read, and the song made at once", "SHEET MUSIC:" in first2 and ode["lines"] in first2 and len(calls) == 1 and "Lantern made a song: Ode to Joy" in t2, [len(calls), t2[-300:]])
        # --- the Music tile's reader: Make a song from it ---
        vision[0] = True
        pg.evaluate("location.hash = 'music'"); time.sleep(1.2)
        path = os.path.join(SHEETS, "twinkle_g_900.png")
        pg.locator("input[type=file][accept='image/*']").first.set_input_files(path); time.sleep(2.0)
        shown = pg.evaluate("(document.querySelector('pre[aria-label=\"The tune as song lines\"]') || {}).textContent || ''")
        ok("the Music tile's reader: the tune as song lines, with Make a song from it", shown.startswith("key G major\ntime 4/4\nmelody G4 G D5 D") and pg.locator("button", has_text="Make a song from it").count() == 1, shown)
        pg.locator("button", has_text="Make a song from it").first.click(); time.sleep(1.5)
        ta = pg.evaluate("(document.querySelector('textarea[aria-label=Song]') || {}).value || ''")
        ok("...which opens it in the Make a song card, written out", ta.startswith("title Twinkle, Twinkle, Little Star\nkey G major") and "melody G4 G D5 D" in ta and "12 bars in G major" in pg.evaluate("document.body.innerText"), ta[:200])
        pg.screenshot(path=os.path.join(OUT, "sheet_song_card.png"))
        ok("no page errors", not errs, errs)
        b.close()
finally:
    srv.terminate()
print("ALL SHEET READER BROWSER TESTS PASS" if not fails else "%d SHEET READER BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
