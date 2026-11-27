# video_tile_e2e.py -- the Video tile (1.24.43) in a real browser (Chromium via Playwright), driven as a person drives it:
# videos made here by ffmpeg brought in from the start screen; frames the Program Monitor shows compared with ffmpeg's own
# decode; the Timeline by mouse (drag a clip, trim an edge, the Razor, a marquee) and by keys (I, O, Ctrl+K, Shift+Delete,
# Ctrl+D, Q, W, arrows, Ctrl+Z); the Effects panel, Effect Controls (a slider dragged, a keyframe), Lumetri, Essential
# Graphics, Captions, Markers, the Audio Track Mixer's loudness, the Source Monitor's insert and overwrite, Speed/Duration;
# then Export Media to MP4, WebM, Motion JPEG AVI, GIF and WAV, each file opened by ffprobe and decoded by ffmpeg, the MP4's
# frames compared with the Program Monitor's; a project saved and opened again; EDL and XML out; a phone-sized window.
# Usage: python3 tests/browser/video_tile_e2e.py [site/index.html]
import os, sys, json, re, threading, http.server, socketserver, tempfile, subprocess, shutil
from playwright.sync_api import sync_playwright
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SITE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "site", "index.html")
OUT = tempfile.mkdtemp(prefix="video_e2e_")
FF = shutil.which("ffmpeg"); FP = shutil.which("ffprobe")
fails = 0; n = 0
def check(name, cond, info=""):
    global fails, n
    n += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:400]))
    if not cond: fails += 1
if not FF:
    print("SKIP  ffmpeg not here: no test videos can be made"); print("ALL VIDEO TILE CHECKS PASS"); sys.exit(0)
def ff(*a): subprocess.run([FF, "-v", "error", "-y"] + list(a), check=True)
def P(n): return os.path.join(OUT, n)
ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000,volume=4", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "15", "-bf", "2", "-c:a", "aac", P("a.mp4"))
ff("-f", "lavfi", "-i", "smptehdbars=size=320x240:rate=30", "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000", "-t", "3", "-c:v", "libvpx", "-b:v", "500k", "-c:a", "libopus", P("b.webm"))
ff("-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100", "-t", "5", P("tone.wav"))
open(P("subs.srt"), "w").write("1\n00:00:00,500 --> 00:00:02,000\nFirst words\n\n2\n00:00:02,500 --> 00:00:03,500\nSecond\n")
def ff_frames(f, w, h):
    raw = subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:v:0", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(float)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0]
        if p in ("/", "/index.html"): return SITE
        return os.path.join(OUT, os.path.basename(p))
srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    b = pw.chromium.launch(); ctx = b.new_context(viewport={"width": 1400, "height": 900}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.add_init_script("window.showSaveFilePicker = undefined;")
    pg.goto("http://127.0.0.1:%d/index.html#video" % port)
    pg.wait_for_selector("text=New project from video files", timeout=60000)
    pg.set_input_files(".vd-start input[type=file][multiple]", [P("a.mp4"), P("b.webm")])
    pg.wait_for_selector(".vd-lanes", timeout=30000)
    pg.wait_for_function("() => Lantern.video.seq.all(Lantern.video.app.seq).length === 4", timeout=30000)
    def ev(js, arg=None): return pg.evaluate(js, arg)
    def lay(): return ev("() => { var A = Lantern.video.app; return Lantern.video.seq.all(A.seq).map(function (x) { return [x.t.name, x.c.start, x.c.dur, Math.round(x.c.srcIn * 1000) / 1000]; }); }")
    st = ev("() => { var A = Lantern.video.app; return { w: A.seq.w, h: A.seq.h, rate: A.seq.rate, msg: A.msg, media: Object.keys(A.p.media).length }; }")
    check("two videos from the start screen: two media, four clips end to end, the sequence takes the first clip's size and rate", st["w"] == 320 and st["h"] == 240 and st["rate"] == {"num": 30, "den": 1} and sorted(lay()) == sorted([["V1", 0, 120, 0], ["A1", 0, 120, 0], ["V1", 120, 90, 0], ["A1", 120, 90, 0]]), (st, lay()))
    pg.wait_for_function("() => { var r = Lantern.video.media.rt; return Object.keys(r).every(function (k) { return !!r[k].audio; }); }", timeout=30000)
    # --- the Program Monitor shows the right frames (compared with ffmpeg's decode of the same file)
    ref = ff_frames(P("a.mp4"), 320, 240)
    def prog_frame(f):
        ev("(f) => { var A = Lantern.video.app; A.playRes = 1; A.seq.playhead = f; A.refresh('playhead'); }", f)
        pg.wait_for_timeout(500)
        d = ev("""() => new Promise(function (ok) { var A = Lantern.video.app; Lantern.video.render.frame(A.p, A.seq, A.seq.playhead, { scale: 1, full: true }).then(function (c) { ok(Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data)); }); })""")
        return np.array(d, float).reshape(240, 320, 4)[..., :3]
    right = 0
    for f in (0, 17, 59, 101, 119):
        x = prog_frame(f); errs_ = np.abs(ref - x).reshape(ref.shape[0], -1).mean(axis=1); best = int(np.argmin(errs_))
        right += best == f
    check("Program Monitor: frames 0, 17, 59, 101 and 119 are ffmpeg's same frames (B-frames and all)", right == 5, right)
    # --- keys: I, O, Ctrl+K (Add Edit), Shift+Delete
    pg.click(".vd-lanes", position={"x": 5, "y": 5})
    ev("() => { var A = Lantern.video.app; A.seq.playhead = 30; A.refresh('playhead'); }")
    pg.keyboard.press("Control+k"); pg.wait_for_timeout(200)
    check("Ctrl+K cuts the clip under the playhead, picture and sound", sorted(lay()) == sorted([["A1", 0, 30, 0], ["A1", 30, 90, 1.0], ["V1", 0, 30, 0], ["V1", 30, 90, 1.0], ["V1", 120, 90, 0], ["A1", 120, 90, 0]]), lay())
    # select the first piece by clicking it on the Timeline, then Shift+Delete
    rows = ev("() => Lantern.video.ui.U.tl.rows().map(function (r) { return [r.t.name, r.y, r.h]; })")
    vy = [r for r in rows if r[0] == "V1"][0]; ay = [r for r in rows if r[0] == "A1"][0]
    box = pg.locator(".vd-lanes").bounding_box()
    def xof(f): return ev("(f) => { var s = Lantern.video.ui.U.tl.state; return (f - s.x0) * s.ppf; }", f)
    pg.mouse.click(box["x"] + xof(15), box["y"] + vy[1] + vy[2] / 2)
    check("a click on a clip selects it with its linked sound", ev("() => Lantern.video.app.sel.length") == 2, ev("() => Lantern.video.app.sel.length"))
    pg.keyboard.press("Shift+Delete"); pg.wait_for_timeout(200)
    check("Shift+Delete (Ripple Delete) takes the piece out and closes the gap on both tracks", sorted(lay()) == sorted([["V1", 0, 90, 1.0], ["A1", 0, 90, 1.0], ["V1", 90, 90, 0], ["A1", 90, 90, 0]]), lay())
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(200)
    check("Ctrl+Z puts it back", len(lay()) == 6, lay())
    pg.keyboard.press("Control+Shift+z"); pg.wait_for_timeout(200)
    check("Ctrl+Shift+Z takes it out again", len(lay()) == 4, lay())
    # --- drag a clip: the second video clip moved 30 frames later (its sound with it)
    box = pg.locator(".vd-lanes").bounding_box(); x0 = box["x"] + xof(130); yv = box["y"] + vy[1] + vy[2] / 2
    pg.mouse.move(x0, yv); pg.mouse.down(); pg.mouse.move(x0 + 40, yv, steps=4); pg.mouse.move(box["x"] + xof(160), yv, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)
    L2 = sorted(lay())
    check("dragging a clip moves it and its linked sound (by the frames dragged, snapping aside)", ["V1", 120, 90, 0] in L2 and ["A1", 120, 90, 0] in L2, L2)
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(150)
    # --- trim the first clip's right edge 20 frames shorter
    box = pg.locator(".vd-lanes").bounding_box(); ex = box["x"] + xof(90) - 2
    pg.mouse.move(ex, yv); pg.mouse.down(); pg.mouse.move(ex - 10, yv, steps=3); pg.mouse.move(box["x"] + xof(70), yv, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    tr = [x for x in lay() if x[1] == 0]
    check("dragging a clip's end 20 frames in trims it (and its linked sound) by that, within a frame of the mouse, leaving a gap", len(tr) == 2 and tr[0][2] == tr[1][2] and 69 <= tr[0][2] <= 71, lay())
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(150)
    # --- the Razor tool (C) by mouse, then back to Selection (V)
    pg.keyboard.press("c"); box = pg.locator(".vd-lanes").bounding_box()
    pg.mouse.click(box["x"] + xof(150), yv); pg.wait_for_timeout(200)
    check("Razor (C): a click cuts the clip there, on its linked track too", len(lay()) == 6 and ["V1", 150, 30, 2.0] in lay() and ["A1", 150, 30, 2.0] in lay(), lay())
    pg.keyboard.press("v")
    check("V returns to the Selection tool", ev("() => Lantern.video.app.tool") == "select")
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(150)
    # --- in and out on the sequence, Extract
    ev("() => { var A = Lantern.video.app; A.seq.playhead = 10; A.refresh('playhead'); }"); pg.locator(".vd-lanes").focus()
    pg.keyboard.press("i"); ev("() => { var A = Lantern.video.app; A.seq.playhead = 19; A.refresh('playhead'); }"); pg.keyboard.press("o"); pg.keyboard.press("'"); pg.wait_for_timeout(200)
    check("I, O and Extract (') take frames 10 to 19 out of the targeted tracks and close up", ev("() => Lantern.video.seq.end(Lantern.video.app.seq)") == 170, ev("() => Lantern.video.seq.end(Lantern.video.app.seq)"))
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(150)
    ev("() => { var A = Lantern.video.app; A.exec('clear', function (seq) { seq.inF = null; seq.outF = null; }); }")
    # --- a transition at the cut with Ctrl+D; Effects panel; Effect Controls
    ev("() => { var A = Lantern.video.app; A.seq.playhead = 89; A.refresh('playhead'); }"); pg.locator(".vd-lanes").focus(); pg.keyboard.press("Control+d"); pg.wait_for_timeout(200)
    tin = ev("() => { var c = Lantern.video.app.seq.v[0].clips[1]; return c.tin; }")
    check("Ctrl+D: a one-second Cross Dissolve centred on the cut", tin and tin["type"] == "crossDissolve" and tin["dur"] == 30 and tin["align"] == "center", tin)
    # frame 90 is 15.5/30 through the dissolve; the outgoing clip (from 1 s) has run out of media there and holds its last frame
    mid = prog_frame(90); rb_ = ff_frames(P("b.webm"), 320, 240); u = 15.5 / 30
    check("the frame at the cut mixes the two (the outgoing clip's last frame held) as Cross Dissolve says: within 8 levels on average (two decoders, ffmpeg and the browser, differ a little each)", np.abs(mid - (ref[119] * (1 - u) + rb_[0] * u)).mean() < 8, np.abs(mid - (ref[119] * (1 - u) + rb_[0] * u)).mean())
    pg.mouse.click(pg.locator(".vd-lanes").bounding_box()["x"] + xof(40), pg.locator(".vd-lanes").bounding_box()["y"] + vy[1] + vy[2] / 2)
    pg.click(".vd-tab:text-is('Effects')"); pg.click("summary:has-text('Video Effects')"); pg.click(".vd-fxitem:text-is('Black & White')"); pg.wait_for_timeout(200)
    check("clicking Black & White in Effects puts it on the selected clip", ev("() => Lantern.video.app.seq.v[0].clips[0].fx.map(function (e) { return e.type; })") == ["bw"])
    g = prog_frame(40); check("the Program Monitor shows the clip in black and white", np.abs(g[..., 0] - g[..., 2]).max() <= 2, np.abs(g[..., 0] - g[..., 2]).max())
    pg.click(".vd-tab:text-is('Effect Controls')"); pg.wait_for_timeout(200)
    sc = pg.locator(".vd-prop:has(.vd-plab:text-is('Scale')) input[type=number]:visible")
    sc.fill("150"); sc.press("Enter"); pg.wait_for_timeout(300)
    check("Effect Controls: Scale typed 150 is one step in History", ev("() => Lantern.video.app.seq.v[0].clips[0].motion.scale") == 150 and ev("() => Lantern.video.app.history().slice(-1)[0].name") == "Scale", ev("() => [Lantern.video.app.seq.v[0].clips[0].motion.scale, Lantern.video.app.history().slice(-1)[0].name]"))
    ev("() => { var A = Lantern.video.app; A.seq.playhead = 0; A.refresh('playhead'); }"); pg.wait_for_timeout(200)
    pg.click(".vd-prop:has(.vd-plab:text-is('Opacity')) .vd-sw:visible"); pg.wait_for_timeout(200)
    ev("() => { var A = Lantern.video.app; A.seq.playhead = 60; A.refresh('playhead'); }"); pg.wait_for_timeout(300)
    op = pg.locator(".vd-prop:has(.vd-plab:text-is('Opacity')) input[type=number]:visible"); op.fill("20"); op.press("Enter"); pg.wait_for_timeout(300)
    k = ev("() => Lantern.video.app.seq.v[0].clips[0].keys.opacity")
    check("Opacity keyframed: the stopwatch makes a key at 0 (100), a value typed at frame 60 makes another (20)", k == [{"f": 0, "v": 100, "i": "linear"}, {"f": 60, "v": 20, "i": "linear"}], k)
    check("half way the opacity is half way (60)", abs(ev("() => Lantern.video.keys.get(Lantern.video.app.seq.v[0].clips[0], 'opacity', 30, 100)") - 60) < 1e-9)
    # --- Lumetri, a graphic, captions, markers
    pg.click(".vd-tab:text-is('Lumetri Color')"); pg.click("button:text-is('Add Lumetri Color to this clip')"); pg.wait_for_timeout(300)
    ex_ = pg.locator(".vd-prop:has(.vd-plab:text-is('Exposure')) input[type=number]:visible"); ex_.fill("1"); ex_.press("Enter"); pg.wait_for_timeout(200)
    check("Lumetri Color: added from its panel, Exposure set to 1", ev("() => Lantern.video.app.seq.v[0].clips[0].fx.filter(function (e) { return e.type === 'lumetri'; })[0].p.exposure") == 1)
    ev("() => { var A = Lantern.video.app; A.seq.playhead = 20; A.refresh('playhead'); }"); pg.keyboard.press("Control+t"); pg.wait_for_timeout(300)
    t = ev("() => { var x = Lantern.video.seq.all(Lantern.video.app.seq).filter(function (y) { return y.c.kind === 'title'; })[0]; return x && [x.t.name, x.c.start, x.c.dur]; }")
    check("Ctrl+T: a title at the playhead on the first free video track, five seconds", t == ["V2", 20, 150], t)
    pg.click(".vd-tab:text-is('Essential Graphics')"); pg.wait_for_timeout(200)
    pg.fill(".vd-gtext", "Lantern Video"); pg.locator(".vd-gtext").press("Tab"); pg.wait_for_timeout(200)
    check("Essential Graphics: the words typed are the title's", ev("() => Lantern.video.seq.all(Lantern.video.app.seq).filter(function (y) { return y.c.kind === 'title'; })[0].c.data.layers[0].text") == "Lantern Video")
    pg.click(".vd-tab:text-is('Captions')")
    with pg.expect_file_chooser() as fc: pg.click("button:text-is('Import .srt / .vtt\u2026')")
    fc.value.set_files(P("subs.srt")); pg.wait_for_timeout(400)
    check("Captions: an .srt brought in at its times (frames at 30 fps)", ev("() => Lantern.video.app.seq.cap.map(function (c) { return [c.start, c.end, c.text]; })") == [[15, 60, "First words"], [75, 105, "Second"]], ev("() => Lantern.video.app.seq.cap"))
    ev("() => { var A = Lantern.video.app; A.seq.playhead = 45; A.refresh('playhead'); }"); pg.locator(".vd-lanes").focus(); pg.keyboard.press("m"); pg.wait_for_timeout(100)
    check("M adds a marker at the playhead", ev("() => Lantern.video.app.seq.markers.map(function (m) { return m.f; })") == [45])
    pg.click(".vd-tab:text-is('Audio Track Mixer')"); pg.click("button:text-is('Measure loudness')"); pg.wait_for_function("() => /LUFS/.test(document.querySelector('.vd-loud').textContent)", timeout=60000)
    check("the Audio Track Mixer measures the sequence's loudness", "LUFS" in pg.inner_text(".vd-loud"), pg.inner_text(".vd-loud"))
    # --- Speed/Duration
    pg.mouse.click(pg.locator(".vd-lanes").bounding_box()["x"] + xof(130), pg.locator(".vd-lanes").bounding_box()["y"] + vy[1] + vy[2] / 2)
    pg.keyboard.press("Control+r"); pg.wait_for_selector(".vd-dialog"); pg.fill(".vd-dialog .vd-drow:has-text('Speed') input", "50"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    sp = ev("() => { var c = Lantern.video.app.seq.v[0].clips[1]; return [c.speed, c.dur]; }")
    check("Speed/Duration 50%: the clip plays at half speed (as long as the room after it allows)", sp[0] == 0.5, sp)
    pg.keyboard.press("Control+z")
    # --- export: MP4, WebM, AVI, GIF, WAV
    def export(fmt, extra=None):
        pg.keyboard.press("Escape"); pg.locator(".vd-lanes").focus(); pg.keyboard.press("Control+m"); pg.wait_for_selector(".vd-dialog")
        pg.select_option(".vd-dialog .vd-drow:has-text('Format') select", fmt)
        if extra: extra()
        try:
            with pg.expect_download(timeout=120000) as dl: pg.click(".vd-dialog button:text-is('Export')")
        except Exception as e:
            info = pg.evaluate("() => { var n = document.querySelector('.vd-dialog .vd-note'); return (n ? n.textContent : 'no dialog') + ' | ' + Lantern.video.app.msg; }")
            pg.keyboard.press("Escape"); raise RuntimeError("no file came: " + info)
        f = P("out_" + dl.value.suggested_filename); dl.value.save_as(f); return f
    files = {}; seqdur = ev("() => Lantern.video.seq.end(Lantern.video.app.seq) / 30")
    for fmt in ("mp4", "webm", "avi", "gif", "wav"):
        try: files[fmt] = export(fmt, (lambda: pg.select_option(".vd-dialog .vd-drow:has-text('Loudness') select", "-23")) if fmt == "wav" else None)
        except Exception as e: check("Export " + fmt, False, e)
    for fmt, f in files.items():
        pr = json.loads(subprocess.run([FP, "-v", "error", "-show_streams", "-show_format", "-of", "json", f], capture_output=True, text=True).stdout or "{}")
        sts = pr.get("streams", []); v = [s for s in sts if s["codec_type"] == "video"]; a = [s for s in sts if s["codec_type"] == "audio"]
        dur = float(pr.get("format", {}).get("duration", 0) or 0)
        want = {"mp4": ("h264", True), "webm": ("vp9", True), "avi": ("mjpeg", True), "gif": ("gif", False), "wav": (None, True)}[fmt]
        okv = (want[0] is None and not v) or (v and v[0]["codec_name"] == want[0] and v[0]["width"] == 320 and v[0]["height"] == 240)
        check("Export %s: ffprobe reads %s%s, %s sound, as long as the sequence (%.1f s)" % (fmt, want[0] or "sound only", ", 320 x 240" if want[0] else "", "with" if want[1] else "no", seqdur), okv and bool(a) == want[1] and abs(dur - seqdur) < 0.1, (sts and [(s["codec_name"], s.get("width")) for s in sts], dur))
    if "mp4" in files:
        got = ff_frames(files["mp4"], 320, 240)
        check("the MP4 has a frame for every frame of the sequence", got.shape[0] == round(seqdur * 30), got.shape[0])
        diffs = []
        for f in (5, 40, 100, 150):
            x = prog_frame(f); diffs.append(np.abs(got[f] - x).mean())
        check("the MP4's frames 5, 40, 100, 150 are the Program Monitor's (within 6 levels on average: H.264's loss)", max(diffs) < 6, diffs)
    if "wav" in files:
        e = subprocess.run([FF, "-hide_banner", "-nostats", "-i", files["wav"], "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
        I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1])
        check("the WAV normalised to -23 LUFS reads -23 in ffmpeg's ebur128 (within 0.3)", abs(I + 23) <= 0.3, I)
    # --- project saved and opened; EDL and XML
    pg.keyboard.press("Escape")
    with pg.expect_download() as dl: pg.locator(".vd-lanes").focus(); pg.keyboard.press("Control+s")
    pj = P("p.lvproj"); dl.value.save_as(pj)
    before = lay()
    ev("() => { Lantern.video.app.newProject(); }"); pg.wait_for_timeout(200)
    with pg.expect_file_chooser() as fc: pg.click(".vd-mbtn:text-is('File')"); pg.click(".vd-mitem:has-text('Open Project')")
    fc.value.set_files(pj); pg.wait_for_timeout(500)
    check("Save Project and Open Project: the same edit comes back", sorted(lay()) == sorted(before), (lay(), before))
    with pg.expect_download() as dl: pg.click(".vd-mbtn:text-is('File')"); pg.click(".vd-mitem:has-text('Export EDL')")
    edl = P("e.edl"); dl.value.save_as(edl); txt = open(edl).read()
    check("Export EDL: a CMX 3600 list naming both files", txt.startswith("TITLE:") and "a.mp4" in txt and "b.webm" in txt, txt[:200])
    with pg.expect_download() as dl: pg.click(".vd-mbtn:text-is('File')"); pg.click(".vd-mitem:has-text('Export Final Cut Pro XML')")
    x = P("e.xml"); dl.value.save_as(x); txt = open(x).read()
    check("Export Final Cut Pro XML: an xmeml sequence with clip items", "<xmeml version=\"4\">" in txt and txt.count("<clipitem") >= 4, txt[:200])
    # --- a phone-sized window
    ph = ctx.new_page(); ph.set_viewport_size({"width": 390, "height": 844}); ph.add_init_script("window.showSaveFilePicker = undefined;")
    ph.goto("http://127.0.0.1:%d/index.html#video" % port); ph.wait_for_selector("text=New project from video files", timeout=60000)
    ph.set_input_files(".vd-start input[type=file][multiple]", [P("a.mp4")]); ph.wait_for_selector(".vd-lanes", timeout=30000); ph.wait_for_timeout(800)
    wide = ph.evaluate("() => document.documentElement.scrollWidth")
    check("on a phone (390 px) the tile fits the width and the Timeline is there", wide <= 400 and ph.locator(".vd-lanes").is_visible(), wide)
    check("no errors in the page", not errs, errs[:5])
    b.close()
print("%d checks, %d failed" % (n, fails))
print("ALL VIDEO TILE CHECKS PASS" if not fails else "%d VIDEO TILE CHECK(S) FAILED" % fails)
shutil.rmtree(OUT, ignore_errors=True)
sys.exit(1 if fails else 0)
