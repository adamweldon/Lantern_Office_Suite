# video_tile_e2e.py -- the Video tile (1.24.43) in a real browser (Chromium via Playwright), driven as a person drives it:
# videos made here by ffmpeg brought in from the start screen; frames the Program Monitor shows compared with ffmpeg's own
# decode; the Timeline by mouse (drag a clip, trim an edge, the Razor, a marquee) and by keys (I, O, Ctrl+K, Shift+Delete,
# Ctrl+D, Q, W, arrows, Ctrl+Z); the Effects panel, Effect Controls (a slider dragged, a keyframe), Lumetri, Essential
# Graphics, Captions, Markers, the Audio Track Mixer's loudness, the Source Monitor's insert and overwrite, Speed/Duration
# (with Maintain Audio Pitch), a mask tracked forward;
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
    pg.keyboard.press("Control+r"); pg.wait_for_selector(".vd-dialog"); pg.fill(".vd-dialog .vd-drow:has-text('Speed') input", "50"); pg.check(".vd-dialog .vd-drow:has-text('Maintain Audio Pitch') input"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    sp = ev("() => { var A = Lantern.video.app, c = A.seq.v[0].clips[1], s = A.seq.a[0].clips.filter(function (x) { return x.link === c.link; })[0]; return [c.speed, c.dur, s.speed, s.pitch]; }")
    check("Speed/Duration 50%: the clip plays at half speed (as long as the room after it allows)", sp[0] == 0.5, sp)
    check("Speed/Duration with Maintain Audio Pitch ticked: its linked sound at 50% too, keeping its pitch", sp[2] == 0.5 and sp[3] is True, sp)
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
    # --- a mask tracked forward: a patch moving 3 pixels a frame to the right on grey
    ff("-f", "lavfi", "-i", "color=c=gray:s=320x240:r=30", "-f", "lavfi", "-i", "testsrc=s=40x40:r=30", "-filter_complex", "[0][1]overlay=x='60+3*n':y=100", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", P("mv.mp4"))
    tk = ctx.new_page(); tk.add_init_script("window.showSaveFilePicker = undefined;"); tk.on("pageerror", lambda e: errs.append(str(e)[:300]))
    tk.goto("http://127.0.0.1:%d/index.html#video" % port); tk.wait_for_selector("text=New project from video files", timeout=60000)
    tk.set_input_files(".vd-start input[type=file][multiple]", [P("mv.mp4")]); tk.wait_for_function("() => Lantern.video.seq.all(Lantern.video.app.seq).length === 1", timeout=30000)
    tk.evaluate("() => { var A = Lantern.video.app, S = Lantern.video.seq, v = A.seq.v[0].clips[0]; A.sel = [v.id]; A.seq.playhead = 0; A.refresh('all'); }"); tk.wait_for_timeout(300)
    tk.select_option(".vd-prop:has(.vd-plab:text-is('Mask')) select", "Ellipse"); tk.wait_for_timeout(300)
    tk.evaluate("() => { var A = Lantern.video.app; A.exec('place', function (seq) { var m = seq.v[0].clips[0].mask; m.cx = 80; m.cy = 120; m.rx = 20; m.ry = 20; }); }"); tk.wait_for_timeout(300)
    tk.click("button:text-is('Track forward')"); tk.wait_for_function("() => /Tracked|stopped/.test(Lantern.video.app.msg)", timeout=120000)
    tr = tk.evaluate("() => { var m = Lantern.video.app.seq.v[0].clips[0].mask; return { msg: Lantern.video.app.msg, dx: m.keys.dx.map(function (k) { return [k.f, k.v]; }), dy: m.keys.dy.map(function (k) { return k.v; }) }; }")
    check("Track forward: the mask follows a patch moving 3 pixels a frame (every frame within 1.5 pixels, none up or down)", len(tr["dx"]) == 60 and all(abs(v - 3 * f) <= 1.5 for f, v in tr["dx"]) and all(abs(v) <= 1.5 for v in tr["dy"]), tr)
    tk.keyboard.press("Control+z"); tk.wait_for_timeout(200)
    check("Undo takes the tracking back as one step", tk.evaluate("() => JSON.stringify(Lantern.video.app.seq.v[0].clips[0].mask.keys)") == "{}")
    # a mask on an effect (Mosaic over the patch, as a face is hidden), placed by its numbers and tracked: the blocks follow it
    tk.evaluate("() => { var A = Lantern.video.app; A.exec('Mosaic', function (seq) { var c = seq.v[0].clips[0]; c.mask = null; c.fx.push(Lantern.video.fx.make('mosaic')); }); }"); tk.wait_for_timeout(300)
    sec = ".vd-sec:has(.vd-sech strong:text-is('Mosaic')) "
    tk.select_option(sec + ".vd-prop:has(.vd-plab:text-is('Mask')) select", "Rectangle"); tk.wait_for_timeout(300)
    for lab, v in (("Mask centre X", 80), ("Mask centre Y", 120), ("Mask width", 40), ("Mask height", 40)):
        i = tk.locator(sec + ".vd-prop:has(.vd-plab:text-is('%s')) input[type=number]" % lab); i.fill(str(v)); i.dispatch_event("change"); tk.wait_for_timeout(150)
    tk.click(sec + "button:text-is('Track forward')"); tk.wait_for_function("() => /Tracked/.test(Lantern.video.app.msg)", timeout=120000)
    span = tk.evaluate("""() => new Promise(function (ok) { var A = Lantern.video.app, R = Lantern.video.render, e = A.seq.v[0].clips[0].fx[0]; R.frame(A.p, A.seq, 45, { scale: 1, full: true }).then(function (c) { var a = c.getContext('2d').getImageData(0, 0, 320, 240).data; e.on = false; R.frame(A.p, A.seq, 45, { scale: 1, full: true }).then(function (c2) { var b = c2.getContext('2d').getImageData(0, 0, 320, 240).data, x0 = 999, x1 = -1; for (var y = 0; y < 240; y++) for (var x = 0; x < 320; x++) { var q = (y * 320 + x) * 4; if (Math.abs(a[q] - b[q]) + Math.abs(a[q + 1] - b[q + 1]) > 30) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } e.on = true; ok([x0, x1]); }); }); })""")
    check("a mask on Mosaic, placed by its numbers and tracked: at frame 45 the blocks are where the patch went (x 195 to 235, within the feather)", 185 <= span[0] <= 200 and 230 <= span[1] <= 245, span)
    # Time Remapping: the stopwatch on Speed at frame 0 (100%), then 50% typed at frame 30: the picture slows through the ramp
    tk.evaluate("() => { var A = Lantern.video.app; A.exec('clear', function (seq) { seq.v[0].clips[0].fx = []; }); A.seq.playhead = 0; A.refresh('all'); }"); tk.wait_for_timeout(200)
    row = ".vd-sec:has(.vd-sech strong:text-is('Time Remapping')) .vd-prop:has(.vd-plab:text-is('Speed (%)')) "
    tk.click(row + ".vd-sw"); tk.wait_for_timeout(200)
    tk.evaluate("() => { var A = Lantern.video.app; A.seq.playhead = 30; A.refresh('all'); }"); tk.wait_for_timeout(200)
    i = tk.locator(row + "input[type=number]"); i.fill("50"); i.dispatch_event("change"); tk.wait_for_timeout(300)
    def xpos(f):
        d = tk.evaluate("(f) => new Promise(function (ok) { var A = Lantern.video.app; Lantern.video.render.frame(A.p, A.seq, f, { scale: 1, full: true }).then(function (c) { ok(Array.from(c.getContext('2d').getImageData(0, 120, 320, 1).data)); }); })", f)
        r = np.array(d, float).reshape(320, 4)[:, :3]; xs = np.where(np.abs(r - r[5]).sum(1) > 40)[0]; return int(xs.min()) if len(xs) else -999
    src = [tk.evaluate("(f) => Lantern.video.seq.srcTime(Lantern.video.app.seq.v[0].clips[0], f, Lantern.video.app.seq)", f) for f in (30, 59)]
    want = sum((100 - 50 * j / 30) / 100 / 30 for j in range(30)); moved = xpos(59) - xpos(30)
    check("Time Remapping (100% to 50% over the first second, then 50%): the source at frames 30 and 59 is the sum of the speeds, and the picture moves that far (3 pixels a source frame)", abs(src[0] - want) < 1e-9 and abs(src[1] - want - 29 * 0.5 / 30) < 1e-9 and abs(moved - 3 * (int(src[1] * 30 + 1e-6) - int(src[0] * 30 + 1e-6))) <= 3, (src, want, moved))
    tk.close()
    # --- Warp Stabilizer: a shaky camera (a 320 x 240 window moved and turned at random over a still textured picture)
    rng = np.random.default_rng(3); nz = rng.random((360, 480)); k = np.exp(-(np.fft.fftfreq(360)[:, None] ** 2 + np.fft.fftfreq(480)[None, :] ** 2) * (2 * np.pi * 2.5) ** 2 / 2)
    nz = np.fft.ifft2(np.fft.fft2(nz) * k).real; nz = (nz - nz.min()) / (nz.max() - nz.min())
    open(P("still.rgb"), "wb").write(np.stack([nz * 230 + 20, nz * 200 + 30, nz * 160 + 60], -1).astype(np.uint8).tobytes())
    ff("-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "480x360", "-i", P("still.rgb"), "-frames:v", "1", P("still.png"))
    ff("-loop", "1", "-i", P("still.png"), "-vf", "fps=30,rotate=a='0.02*sin(n*0.9)':c=none:ow=480:oh=360,crop=320:240:x='80+12*sin(n*1.3)+6*sin(n*0.31)':y='60+9*cos(n*1.7)'", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12", P("shake.mp4"))
    def pc(a, b):
        w = np.outer(np.hanning(a.shape[0]), np.hanning(a.shape[1])); R = np.fft.fft2((a - a.mean()) * w).conj() * np.fft.fft2((b - b.mean()) * w); R /= np.abs(R) + 1e-9; r = np.fft.ifft2(R).real
        y, x = np.unravel_index(np.argmax(r), r.shape); return abs(x if x < a.shape[1] / 2 else x - a.shape[1]) + abs(y if y < a.shape[0] / 2 else y - a.shape[0])
    st = ctx.new_page(); st.add_init_script("window.showSaveFilePicker = undefined;"); st.on("pageerror", lambda e: errs.append(str(e)[:300]))
    st.goto("http://127.0.0.1:%d/index.html#video" % port); st.wait_for_selector("text=New project from video files", timeout=60000)
    st.set_input_files(".vd-start input[type=file][multiple]", [P("shake.mp4")]); st.wait_for_function("() => Lantern.video.seq.all(Lantern.video.app.seq).length === 1", timeout=30000)
    st.evaluate("() => { var A = Lantern.video.app, v = A.seq.v[0].clips[0]; A.sel = [v.id]; A.seq.playhead = 0; A.refresh('all'); }"); st.wait_for_timeout(300)
    st.click(".vd-tab:text-is('Effects')"); st.fill("input[placeholder='Find an effect']", "warp"); st.click(".vd-fxitem:text-is('Warp Stabilizer')"); st.wait_for_timeout(300)
    added = st.evaluate("() => Lantern.video.app.msg"); st.click(".vd-tab:text-is('Effect Controls')"); st.wait_for_timeout(200)
    sec = ".vd-sec:has(.vd-sech strong:text-is('Warp Stabilizer')) "
    st.click(sec + "button:text-is('Analyze')"); st.wait_for_function("() => /Analysed/.test(Lantern.video.app.msg)", timeout=180000)
    def rend(f, on):
        return np.array(st.evaluate("""(a) => new Promise(function (ok) { var A = Lantern.video.app, e = A.seq.v[0].clips[0].fx[0]; e.on = a[1]; Lantern.video.render.frame(A.p, A.seq, a[0], { scale: 1, full: true }).then(function (c) { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, o = []; for (var i = 0; i < d.length; i += 4) o.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); e.on = true; ok(o); }); })""", [f, on]), float).reshape(240, 320)[60:180, 80:240]
    st.select_option(sec + ".vd-prop:has(.vd-plab:text-is('Result')) select", "No Motion"); st.wait_for_timeout(200)
    on = [rend(f, True) for f in range(0, 40, 3)]; off = [rend(f, False) for f in range(0, 40, 3)]
    m_on = np.mean([pc(on[0], x) for x in on[1:]]); m_off = np.mean([pc(off[0], x) for x in off[1:]])
    check("Warp Stabilizer from the Effects panel, Analyze, No Motion: a camera shaking about 17 pixels holds within a pixel of its first frame", "Analyze" in added and m_off > 8 and m_on <= 1, (added, m_off, m_on))
    st.select_option(sec + ".vd-prop:has(.vd-plab:text-is('Result')) select", "Smooth Motion"); st.wait_for_timeout(200)
    on = [rend(f, True) for f in range(0, 20)]
    jit = np.mean([pc(on[i], on[i + 1]) for i in range(19)])
    check("Warp Stabilizer, Smooth Motion: the frame-to-frame shake is gone (under a pixel a frame)", jit < 1, jit)
    # an effect preset: saved from Effect Controls, put on a clip from the Effects panel (without the analysis, which is the clip's own)
    st.fill("input[placeholder='Preset name']", "Steady"); st.click("button:text-is('Save effects as preset')"); st.wait_for_timeout(200)
    st.evaluate("() => { var A = Lantern.video.app; A.exec('clear', function (seq) { seq.v[0].clips[0].fx = []; }); }")
    st.click(".vd-tab:text-is('Effects')"); st.fill("input[placeholder='Find an effect']", ""); st.click(".vd-fxitem:text-is('Steady')"); st.wait_for_timeout(200)
    fx = st.evaluate("() => Lantern.video.app.seq.v[0].clips[0].fx.map(function (e) { return [e.type, e.p.result, !!e.data]; })")
    check("Save effects as preset, then the preset from the Effects panel: the same effect and settings on the clip, the analysis not carried", fx == [["warpStabilizer", "Smooth Motion", False]], fx)
    st.evaluate("() => Lantern.video.cmd.dropPreset('Steady')")
    st.close()
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
