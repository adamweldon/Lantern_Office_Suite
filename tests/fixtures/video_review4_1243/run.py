# run.py -- review 4 of the Video tile (Lantern 1.24.43): the tile used as a person uses it, on its newest and mended parts.
#
# Written by a separate reviewer that did not write the tile and did not copy reviews 1 and 2. Every scenario is driven
# by the mouse and the keyboard in headless Chromium (Playwright): menus clicked, tools picked by their letters, clips
# clicked and dragged on the Timeline canvas, values typed into Effect Controls, files chosen in the browser's file box,
# items dragged from the Project panel and the Source Monitor. Each result is read from the app's state AND from what
# it shows or writes: the Program Monitor's pixels, frames drawn by the renderer, the sequence's mix, and exported
# files decoded by ffprobe and ffmpeg.
#
# The media are made here by ffmpeg, afresh, in a temporary folder:
#   tick.mp4   320x240 30 fps, 180 frames, H.264 + AAC. Its frame number in binary in a row of 8 boxes at the bottom;
#              a white band at the top on frames 30-31, 90-91, 150-151 and a 2 kHz beep on exactly those frames, over a
#              steady 440 Hz bed (so pitch can be measured). Teal background.
#   tock.mp4   the same design, 120 frames, purple, 330 Hz bed, band and beep on frames 15-16 and 75-76.
#   face.mp4   90 frames: a textured 48x48 patch (a stand-in for a face) moving 3 px right and 1 px down a frame over flat
#              grey.
#   shaky.mp4  60 frames: a detailed still picture seen through a window that shakes up to about 20 px a frame.
#   music.wav  20 s of a steady 600 Hz tone (stereo), for a long music clip across edits.
#   voice.wav  2 s mono 300 Hz.
#   ntsc.mp4   160x120 at 29.97 fps, 2 s (drop-frame timecode).
#
# Usage: python3 run.py [path/to/index.html] [section ...]
#   sections: trims edits trans fx fx2 target undo keys exportsec project views more
# A full run takes about 5 minutes on 2 cores. It writes nothing outside its temporary folder (removed at the end).
# Prints "PASS  <check>" or "FAIL  <check>  [what was seen]" per check, then "<n> checks, <m> failed".
import os, sys, re, json, math, time, shutil, tempfile, threading, subprocess, http.server, socketserver, zipfile, traceback
import numpy as np
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[1:]
SITE = os.path.abspath(os.path.join(HERE, "..", "..", "..", "site", "index.html"))
if ARGS and ARGS[0].endswith(".html"):
    SITE = os.path.abspath(ARGS[0]); ARGS = ARGS[1:]
ONLY = set(ARGS)
FF = shutil.which("ffmpeg"); FP = shutil.which("ffprobe")
OUT = tempfile.mkdtemp(prefix="video_review4_")
MED = os.path.join(OUT, "media"); DL = os.path.join(OUT, "dl"); os.makedirs(MED); os.makedirs(DL)
import atexit; atexit.register(shutil.rmtree, OUT, True)      # the temporary folder goes even if the run is stopped
RESULTS = []


def check(name, cond, info=""):
    ok = bool(cond)
    RESULTS.append((name, ok, "" if ok else str(info)[:600]))
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else "  [" + str(info)[:600] + "]"), flush=True)
    return ok


def P(n): return os.path.join(MED, n)


# ============================================================================================ media
def ff(*a):
    r = subprocess.run([FF, "-v", "error", "-y"] + list(a), capture_output=True, text=True)
    if r.returncode: raise RuntimeError("ffmpeg: " + r.stderr[-400:])


BOX_X0, BOX_STEP, BOX_W, BOX_Y, BOX_H = 6, 39, 30, 214, 18


def bits_filter():
    return "".join(",drawbox=x=%d:y=%d:w=%d:h=%d:color=white:t=fill:enable='mod(floor(n/%d),2)'" % (BOX_X0 + i * BOX_STEP, BOX_Y, BOX_W, BOX_H, 1 << i) for i in range(8))


def marked(bg, frames, n, bed, path, beepf=2000):
    """a clip of n frames at 30 fps, frame number at the bottom, a white band at the top and a beep on the given frames"""
    en = "+".join("between(n,%d,%d)" % (f, f + 1) for f in frames)
    beep = "+".join("between(t,%.6f,%.6f)" % (f / 30.0, (f + 2) / 30.0 - 1e-6) for f in frames)
    expr = "0.1*sin(2*PI*%d*t)+0.5*sin(2*PI*%d*t)*(%s)" % (bed, beepf, beep)
    ff("-f", "lavfi", "-i", "color=c=%s:s=320x240:r=30:d=%.4f,format=yuv420p" % (bg, n / 30.0) + bits_filter() + ",drawbox=x=0:y=0:w=320:h=60:color=white:t=fill:enable='%s'" % en,
       "-f", "lavfi", "-i", "aevalsrc='%s|%s':s=48000:d=%.4f" % (expr, expr, n / 30.0), "-frames:v", str(n), "-c:v", "libx264", "-g", "15", "-bf", "2", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", path)


def make_media():
    marked("0x205050", [30, 90, 150], 180, 440, P("tick.mp4"))
    marked("0x502050", [15, 75], 120, 330, P("tock.mp4"))
    # a textured patch (a still) moving over flat grey
    ff("-f", "lavfi", "-i", "testsrc2=s=48x48:r=1:d=1", "-frames:v", "1", P("patch.png"))
    ff("-f", "lavfi", "-i", "color=c=0x606060:s=320x240:r=30:d=3", "-loop", "1", "-i", P("patch.png"), "-filter_complex", "[0][1]overlay=x='40+3*n':y='70+n':shortest=1,format=yuv420p",
       "-frames:v", "90", "-c:v", "libx264", "-qp", "10", "-pix_fmt", "yuv420p", P("face.mp4"))
    # a detailed still seen through a window that shakes
    ff("-f", "lavfi", "-i", "testsrc2=s=480x360:r=1:d=1,noise=alls=50:allf=u,gblur=sigma=0.8", "-frames:v", "1", P("scene.png"))
    ff("-framerate", "30", "-loop", "1", "-i", P("scene.png"), "-vf", "crop=320:240:x='80+12*sin(n*2.1)+8*sin(n*3.7)':y='60+10*sin(n*1.3+1)+6*sin(n*4.9)',format=yuv420p",
       "-frames:v", "60", "-r", "30", "-c:v", "libx264", "-qp", "8", "-pix_fmt", "yuv420p", P("shaky.mp4"))
    ff("-f", "lavfi", "-i", "sine=frequency=600:sample_rate=48000:duration=20,volume=0.3", "-ac", "2", "-c:a", "pcm_s16le", P("music.wav"))
    ff("-f", "lavfi", "-i", "sine=frequency=300:sample_rate=48000:duration=2,volume=0.3", "-ac", "1", "-c:a", "pcm_s16le", P("voice.wav"))
    ff("-f", "lavfi", "-i", "testsrc=s=160x120:r=30000/1001:d=2", "-f", "lavfi", "-i", "sine=frequency=500:sample_rate=48000:duration=2,volume=0.2",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", P("ntsc.mp4"))


# ============================================================================================ reading files
def probe(f):
    r = subprocess.run([FP, "-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", f], capture_output=True, text=True)
    return json.loads(r.stdout or "{}")


def frames_of(f, w, h):
    raw = subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:v:0", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(float) if raw else np.zeros((0, h, w, 3))


def pcm_of(f, sr=48000):
    raw = subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:a:0", "-f", "f32le", "-ac", "2", "-ar", str(sr), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2) if raw else np.zeros((0, 2), np.float32)


def num_of(img, k=1.0):
    """the frame number a marked frame shows (img HxWx3 floats), scaled by k"""
    n = 0
    for i in range(8):
        x = int((BOX_X0 + i * BOX_STEP + BOX_W / 2) * k); y = int((BOX_Y + BOX_H / 2) * k)
        if img[y, x].mean() > 128: n |= 1 << i
    return n


def band_frames(fr, k=1.0):
    return [i for i in range(len(fr)) if fr[i][int(10 * k):int(50 * k)].mean() > 200]


def beeps(pcm, sr=48000):
    """the start of each beep (2 kHz, 0.5) over the bed (0.1): a 4 ms RMS over 0.2"""
    x = pcm[:, 0].astype(float); w = int(sr * 0.004)
    if len(x) < w: return []
    e = np.sqrt(np.convolve(x * x, np.ones(w) / w, mode="same"))
    out = []; i = 0
    while i < len(e):
        if e[i] > 0.2: out.append((i - w / 2) / sr); i += int(sr * 0.25)
        else: i += 1
    return out


def ebur128(f):
    e = subprocess.run([FF, "-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", e); pk = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)
    return (float(I[-1]) if I else None, float(pk[-1]) if pk else None)


# ============================================================================================ server
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0].split("#")[0]
        if p in ("/", "/index.html"): return SITE
        return os.path.join(MED, os.path.basename(p))


socketserver.TCPServer.allow_reuse_address = True
SRV = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler); PORT = SRV.server_address[1]
threading.Thread(target=SRV.serve_forever, daemon=True).start()

# reads only: frames the renderer draws, what the Program Monitor shows, the mix
PAGE_JS = r"""
window.__r4 = {
  num: function (img, k) { var n = 0; for (var i = 0; i < 8; i++) { var x = Math.floor((6 + i * 39 + 15) * k), y = Math.floor((214 + 9) * k), q = (y * img.width + x) * 4; if ((img.data[q] + img.data[q + 1] + img.data[q + 2]) / 3 > 128) n |= 1 << i; } return n; },
  mean: function (img, x0, y0, x1, y1) { var s = [0, 0, 0, 0], n = 0; for (var y = Math.max(0, Math.floor(y0)); y < Math.min(img.height, y1); y++) for (var x = Math.max(0, Math.floor(x0)); x < Math.min(img.width, x1); x++) { var q = (y * img.width + x) * 4; s[0] += img.data[q]; s[1] += img.data[q + 1]; s[2] += img.data[q + 2]; s[3] += img.data[q + 3]; n++; } return s.map(function (v) { return Math.round(v / Math.max(1, n)); }); },
  img: function (f, scale) { var A = Lantern.video.app; return Lantern.video.render.frame(A.p, A.seq, f, { scale: scale || 1, full: true }).then(function (c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); }); },
  info: function (f) { var R = window.__r4; return R.img(f, 1).then(function (img) { var k = img.width / 320; return { n: R.num(img, k), band: R.mean(img, 0, 10 * k, img.width, 50 * k)[0], mid: R.mean(img, img.width * 0.3, img.height * 0.4, img.width * 0.7, img.height * 0.8), all: R.mean(img, 0, 0, img.width, img.height), w: img.width, h: img.height }; }); },
  shown: function () { var c = document.querySelector('.vd-right canvas.vd-screen'); if (!c || !c.width) return null; var img = c.getContext('2d').getImageData(0, 0, c.width, c.height), k = c.width / 320; return { n: window.__r4.num(img, k), w: c.width, h: c.height, mid: window.__r4.mean(img, img.width * 0.3, img.height * 0.4, img.width * 0.7, img.height * 0.8), all: window.__r4.mean(img, 0, 0, img.width, img.height) }; },
  mix: function (a, b) { var A = Lantern.video.app; return Lantern.video.mix.range(A.p, A.seq, a, b); },
  // the start of each beep in the mix (seconds): a 4 ms RMS over 0.2, the same rule as beeps() for files
  beeps: function (a, b) { var c = window.__r4.mix(a, b)[0], sr = Lantern.video.app.seq.sampleRate, w = Math.round(sr * 0.004), out = [], i = 0; while (i + w <= c.length) { var s = 0; for (var j = i; j < i + w; j++) s += c[j] * c[j]; if (Math.sqrt(s / w) > 0.2) { var k = i; while (k > 0 && Math.abs(c[k]) > 0.15 && i - k < w) k--; out.push((a + i) / sr); i += Math.round(sr * 0.25); } else i += Math.round(w / 4); } return out; },
  // the strongest frequency between samples a and b (an FFT-free search: correlation with sines 50..3000 Hz in 5 Hz steps)
  freq: function (a, b) { var c = window.__r4.mix(a, b)[0], sr = Lantern.video.app.seq.sampleRate, best = 0, bf = 0; for (var f = 50; f <= 3000; f += 5) { var re = 0, im = 0, w = 2 * Math.PI * f / sr; for (var i = 0; i < c.length; i += 1) { re += c[i] * Math.cos(w * i); im += c[i] * Math.sin(w * i); } var p = re * re + im * im; if (p > best) { best = p; bf = f; } } return bf; },
  rms: function (a, b, ch) { var c = window.__r4.mix(a, b)[ch || 0], s = 0; for (var i = 0; i < c.length; i++) s += c[i] * c[i]; return Math.sqrt(s / Math.max(1, c.length)); },
  lay: function () { var A = Lantern.video.app; return Lantern.video.seq.all(A.seq).map(function (x) { return [x.t.name, x.c.start, x.c.dur, Math.round(x.c.srcIn * 1000) / 1000, Math.round(x.c.speed * 1000) / 1000, x.c.kind]; }).sort(); },
  snap: function () { var A = Lantern.video.app; return JSON.stringify([A.seq.v.map(function (t) { return t.clips; }), A.seq.a.map(function (t) { return t.clips; }), A.seq.markers, A.seq.inF, A.seq.outF]); },
  // every linked pair: [picture track, sound track, same start, same length, same source in, same speed]
  pairs: function () { var A = Lantern.video.app, S = Lantern.video.seq, out = []; A.seq.v.forEach(function (t) { t.clips.forEach(function (c) { if (!c.link) return; S.partners(A.seq, c).forEach(function (y) { if (y.t.kind !== 'a') return; out.push({ v: t.name, a: y.t.name, start: [c.start, y.c.start], dur: [c.dur, y.c.dur], src: [Math.round(c.srcIn * 1000) / 1000, Math.round(y.c.srcIn * 1000) / 1000], speed: [c.speed, y.c.speed], ok: c.start === y.c.start && c.dur === y.c.dur && Math.abs(c.srcIn - y.c.srcIn) < 1e-6 && Math.abs(c.speed - y.c.speed) < 1e-9 && !!c.reverse === !!y.c.reverse }); }); }); }); return out; }
};
"""


# ============================================================================================ the page
class App:
    """one page with the Video tile open"""
    def __init__(self, browser, viewport=(1400, 900), keep_store=None):
        self.ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, accept_downloads=True)
        self.pg = self.ctx.new_page(); self.errs = []; self.dialogs = []
        self.pg.on("pageerror", lambda e: self.errs.append(str(e)[:300]))
        self.pg.on("dialog", lambda d: (self.dialogs.append(d.message), d.accept()))
        self.pg.add_init_script("window.showSaveFilePicker = undefined;")
        self.pg.add_init_script(PAGE_JS)
        self.pg.goto("http://127.0.0.1:%d/index.html#video" % PORT)
        self.pg.wait_for_selector("text=New project from video files", timeout=90000)

    def close(self): self.ctx.close()
    def ev(self, js, arg=None): return self.pg.evaluate(js, arg)

    # --- bringing media in
    def start(self, names, n_clips=None):
        """the start screen's New project from video files (the browser's file box)"""
        with self.pg.expect_file_chooser() as fc: self.pg.click("button:text-is('New project from video files…')")
        fc.value.set_files([P(x) for x in names])
        self.pg.wait_for_selector(".vd-lanes", timeout=30000)
        self.wait_media(len(names))
        if n_clips is not None:
            self.pg.wait_for_function("(n) => Lantern.video.seq.all(Lantern.video.app.seq).length === n", arg=n_clips, timeout=30000)
        self.pg.wait_for_timeout(300)

    def wait_media(self, n):
        self.pg.wait_for_function("(n) => { var A = Lantern.video.app, r = Lantern.video.media.rt; var ids = Object.keys(A.p.media); return ids.length >= n && ids.every(function (k) { var m = A.p.media[k]; return r[k] && (m.kind === 'image' || r[k].audio || !m.hasAudio); }); }", arg=n, timeout=60000)

    def import_files(self, names):
        """the Project panel's Import... button (the browser's file box)"""
        n0 = self.ev("() => Object.keys(Lantern.video.app.p.media).length")
        self.tab("Project")
        with self.pg.expect_file_chooser() as fc: self.pg.click(".vd-pbar button:text-is('Import…')")
        fc.value.set_files([P(x) for x in names])
        self.wait_media(n0 + len(names)); self.pg.wait_for_timeout(200)

    # --- reading state (never changing it)
    def A(self, expr): return self.ev("() => { var A = Lantern.video.app, S = Lantern.video.seq; return (" + expr + "); }")
    def lay(self): return sorted(self.ev("() => __r4.lay()"))
    def pairs(self): return self.ev("() => __r4.pairs()")
    def synced(self): p = self.pairs(); return bool(p) and all(x["ok"] for x in p), p
    def ph(self): return self.A("A.seq.playhead")
    def msg(self): return self.A("A.msg")
    def hist(self): return self.A("A.history().map(function (h) { return h.name; })")
    def end(self): return self.A("S.end(A.seq)")
    def snap(self): return self.ev("() => __r4.snap()")
    def clips(self, track): return self.A("(function () { var t = A.seq.v.concat(A.seq.a).filter(function (t) { return t.name === '%s'; })[0]; return t ? S.sort(t).clips.map(function (c) { return JSON.parse(JSON.stringify(c)); }) : null; })()" % track)
    def info(self, f): return self.ev("(f) => __r4.info(f)", f)
    def beeps(self, a_s, b_s): return self.ev("(a) => __r4.beeps(a[0], a[1])", [int(a_s * 48000), int(b_s * 48000)])
    def freq(self, a_s, b_s): return self.ev("(a) => __r4.freq(a[0], a[1])", [int(a_s * 48000), int(b_s * 48000)])
    def rms(self, a_s, b_s): return self.ev("(a) => __r4.rms(a[0], a[1])", [int(a_s * 48000), int(b_s * 48000)])
    def shown(self, wait=400):
        self.pg.wait_for_timeout(wait)
        return self.ev("() => __r4.shown()")

    # --- what a person does
    def tab(self, name):
        self.pg.click(".vd-tab:text-is('%s')" % name); self.pg.wait_for_timeout(120)

    def menu(self, top, item):
        self.pg.click(".vd-mbtn:text-is('%s')" % top)
        self.pg.locator(".vd-menu .vd-mitem").filter(has=self.pg.locator("span:text-is('%s')" % item)).first.click()
        self.pg.wait_for_timeout(200)

    def lanes(self): return self.pg.locator(".vd-lanes").bounding_box()
    def row(self, track): return self.ev("(n) => Lantern.video.ui.U.tl.rows().filter(function (r) { return r.t.name === n; }).map(function (r) { return [r.y, r.h]; })[0]", track)
    def xof(self, f): return self.ev("(f) => { var s = Lantern.video.ui.U.tl.state; return (f - s.x0) * s.ppf; }", f)

    def fit(self):
        """\\ in the Timeline: the whole sequence in view"""
        self.focus_tl(); self.key("\\")

    def visible(self, *fs):
        """bring frames into the Timeline's view as a person would: \\ to fit, - to zoom out, then the scroll bar"""
        w = self.ev("() => document.querySelector('.vd-lanes').clientWidth")
        ok = lambda: all(0 <= self.xof(f) <= w - 6 for f in fs)
        if ok(): return
        self.pg.locator(".vd-lanes").focus(); self.pg.keyboard.press("\\"); self.pg.wait_for_timeout(80)
        tries = 0
        while (max(fs) - min(fs) + 10) * self.ev("() => Lantern.video.ui.U.tl.state.ppf") > w - 20 and tries < 8:
            self.pg.keyboard.press("-"); self.pg.wait_for_timeout(60); tries += 1
        if not ok():
            mx = self.ev("() => { var A = Lantern.video.app, s = Lantern.video.ui.U.tl.state, tot = Math.max(Lantern.video.seq.end(A.seq) + 150, Math.round(A.fps() * 30)); return Math.max(0, tot - document.querySelector('.vd-lanes').clientWidth / s.ppf * 0.8); }")
            if mx > 0: self.pg.locator(".vd-hbar").fill(str(max(0, min(1000, int((min(fs) - 5) / mx * 1000))))); self.pg.wait_for_timeout(80)

    def pt(self, track, f, dy=0.5):
        self.visible(f)
        b = self.lanes(); r = self.row(track)
        return (b["x"] + self.xof(f), b["y"] + r[0] + r[1] * dy)

    def click_at(self, track, f, mods=None, dy=0.5, dx=0):
        x, y = self.pt(track, f, dy)
        for m in mods or []: self.pg.keyboard.down(m)
        self.pg.mouse.click(x + dx, y)
        for m in mods or []: self.pg.keyboard.up(m)
        self.pg.wait_for_timeout(150)

    def dblclick_at(self, track, f):
        x, y = self.pt(track, f); self.pg.mouse.dblclick(x, y); self.pg.wait_for_timeout(300)

    def drag(self, x0, y0, x1, y1, mods=None, steps=10):
        for m in mods or []: self.pg.keyboard.down(m)
        self.pg.mouse.move(x0, y0); self.pg.mouse.down(); self.pg.mouse.move(x0 + (1 if x1 >= x0 else -1) * 3, y0, steps=2)
        self.pg.mouse.move(x1, y1, steps=steps); self.pg.mouse.up()
        for m in mods or []: self.pg.keyboard.up(m)
        self.pg.wait_for_timeout(250)

    def drag_frames(self, track, f0, f1, track1=None, mods=None, edge=None):
        """press on a clip at frame f0 (just inside an edge when edge is given) and let go at frame f1"""
        self.visible(f0, f1)
        x0, y0 = self.pt(track, f0); x1, y1 = self.pt(track1 or track, f1)
        if edge == "tail": x0 -= 2; x1 -= 2
        if edge == "head": x0 += 2; x1 += 2
        self.drag(x0, y0, x1, y1, mods)

    def focus_tl(self):
        # keyboard focus on the Timeline, then Shift+3 (Premiere's key for the Timeline panel) so the keys act there
        self.pg.locator(".vd-lanes").focus(); self.pg.keyboard.press("Shift+Digit3")

    def key(self, k, n=1):
        for _ in range(n): self.pg.keyboard.press(k)
        self.pg.wait_for_timeout(160)

    def goto(self, f):
        """type a frame count into the Timeline's timecode box"""
        box = self.pg.locator(".vd-tc"); box.click(); box.fill(str(f)); box.press("Enter"); self.pg.wait_for_timeout(150)
        self.focus_tl()

    def tool(self, letter): self.focus_tl(); self.key(letter)

    def _scope(self, sec):
        return ".vd-ctl .vd-sec:has(> .vd-sech strong:text-is('%s')) " % sec if sec else ".vd-ctl "

    def prop(self, label, kind="number", sec=None):
        return self.pg.locator(self._scope(sec) + ".vd-prop:has(.vd-plab:text-is('%s')) input[type=%s]:visible" % (label, kind)).first

    def set_prop(self, label, value, sec=None):
        i = self.prop(label, sec=sec); i.fill(str(value)); i.press("Enter"); self.pg.wait_for_timeout(300)

    def choose_prop(self, label, value, sec=None):
        self.pg.locator(self._scope(sec) + ".vd-prop:has(.vd-plab:text-is('%s')) select:visible" % label).first.select_option(label=value); self.pg.wait_for_timeout(300)

    def tick_prop(self, label, on, sec=None):
        self.prop(label, kind="checkbox", sec=sec).set_checked(on); self.pg.wait_for_timeout(300)

    def stopwatch(self, label, sec=None):
        self.pg.locator(self._scope(sec) + ".vd-prop:has(.vd-plab:text-is('%s')) .vd-sw:visible" % label).first.click(); self.pg.wait_for_timeout(300)

    def sec_button(self, sec, text):
        return self.pg.locator(self._scope(sec) + "button:text-is('%s'):visible" % text).first

    def effect(self, name):
        """the Effects panel: find the effect by name and click it"""
        self.tab("Effects")
        q = self.pg.locator("input[aria-label='Find an effect']"); q.fill(name); self.pg.wait_for_timeout(150)
        self.pg.locator(".vd-fxlist button.vd-fxitem:text-is('%s')" % name).first.click(); self.pg.wait_for_timeout(300)
        q.fill(""); self.pg.wait_for_timeout(100)

    def grey(self, f, x0=0, y0=0, x1=320, y1=240):
        """frame f as drawn by the renderer, in grey, as a numpy array (a crop)"""
        d = self.ev("""(a) => __r4.img(a[0], 1).then(function (img) { var out = [], q; for (var y = a[2]; y < a[4]; y++) for (var x = a[1]; x < a[3]; x++) { q = (y * img.width + x) * 4; out.push(Math.round(0.2126 * img.data[q] + 0.7152 * img.data[q + 1] + 0.0722 * img.data[q + 2])); } return out; })""", [f, x0, y0, x1, y1])
        return np.array(d, float).reshape(y1 - y0, x1 - x0)

    def save_dl(self, action, timeout=60000):
        with self.pg.expect_download(timeout=timeout) as dl: action()
        f = os.path.join(DL, "%d_%s" % (int(time.time() * 1000) % 100000000, dl.value.suggested_filename))
        dl.value.save_as(f); return f, dl.value.suggested_filename

    def drag_item(self, name, track, f):
        """drag an item from the Project panel to a track of the Timeline at frame f (an HTML drag, as the mouse makes)"""
        self.tab("Project")
        x, y = self.pt(track, f); lb = self.lanes()
        self.pg.drag_and_drop(".vd-pitem:has-text('%s')" % name, ".vd-lanes", target_position={"x": max(1, x - lb["x"]), "y": y - lb["y"]})
        self.pg.wait_for_timeout(400)

    def drag_source(self, track, f):
        """drag the Source Monitor's marked part (its Drag handle) to a track at frame f"""
        self.tab("Source")
        x, y = self.pt(track, f); lb = self.lanes()
        self.pg.drag_and_drop(".vd-dragsrc", ".vd-lanes", target_position={"x": max(1, x - lb["x"]), "y": y - lb["y"]})
        self.pg.wait_for_timeout(400)

    def head_btn(self, track, title_start):
        """a track header button (by its title: Target, Sync Lock, Lock, Show, Mute, Solo)"""
        return self.pg.locator(".vd-heads button[title='%s %s']" % (title_start, track)).first if title_start != "Target" else self.pg.locator(".vd-heads button[title='Target %s for edits']" % track).first


SECTIONS = []


def section(fn):
    SECTIONS.append(fn); return fn


def undo_if(app, s0):
    if app.snap() != s0: app.focus_tl(); app.key("Control+z")


# ============================================================================================ sections
# (sections are added below)

def base_two(B, viewport=(1400, 900), extra=None):
    """tick then tock end to end on V1 and A1 (New project from video files), snapping off"""
    a = App(B, viewport)
    a.start(["tick.mp4", "tock.mp4"], n_clips=4)
    if extra: a.import_files(extra)
    a.focus_tl()
    if a.A("A.snap"): a.key("s")
    a.fit()
    return a


def back_to(a, s0, n=25):
    """Ctrl+Z until the tracks are as they were (or n presses)"""
    a.focus_tl()
    for _ in range(n):
        if a.snap() == s0: return True
        a.key("Control+z")
    return a.snap() == s0


def near(xs, ys, tol):
    return len(xs) == len(ys) and all(abs(x - y) <= tol for x, y in zip(xs, ys))


@section
def trims(B):
    """Linked picture and sound through the Timeline's trims: plain, Ripple B, Rolling N, Rate Stretch R from head and
    tail, Slip Y, Slide U next to clips and to gaps, Alt for one half; a long music clip on a sync-locked track"""
    a = base_two(B); pg = a.pg
    s0 = a.snap(); F = 1 / 30.0
    # --- plain trim of the first clip's tail, Selection tool (V)
    a.tool("v"); a.drag_frames("V1", 180, 150, edge="tail")
    ok, pr = a.synced()
    check("Selection tool: dragging a linked clip's tail 30 frames in trims its picture and its sound alike", ok and a.clips("V1")[0]["dur"] == 150 and a.clips("A1")[0]["dur"] == 150, pr)
    check("Selection trim leaves the next clip where it was (a gap, not a ripple)", a.clips("V1")[1]["start"] == 180 and a.clips("A1")[1]["start"] == 180, a.lay())
    check("History names the trim", a.hist()[-1] == "Trim", a.hist()[-3:])
    # --- Alt: one half alone
    a.drag_frames("A1", 150, 140, edge="tail", mods=["Alt"])
    v, au = a.clips("V1")[0], a.clips("A1")[0]
    check("Alt with the Selection tool trims the sound alone; the picture keeps its length", v["dur"] == 150 and au["dur"] == 140, (v["dur"], au["dur"]))
    a.focus_tl(); a.key("Control+z")
    # --- plain trim outward where the sound track is blocked and the picture's is not
    a.import_files(["voice.wav"])
    mark_source(a, "voice.wav", 0, 14)                                # I at its start, O on its 15th frame: 0.5 s
    a.drag_source("A1", 158)
    vo = [c for c in a.clips("A1") if c["media"] and a.A("A.p.media['%s'].name" % c["media"]) == "voice.wav"]
    check("dragging the Source Monitor's In to Out (0.5 s of a sound file) to A1 lays only that part there", len(vo) == 1 and vo[0]["start"] == 158 and vo[0]["dur"] == 15, [(c["start"], c["dur"]) for c in vo])
    a.drag_frames("V1", 150, 170, edge="tail")
    v, au = a.clips("V1")[0], a.clips("A1")[0]
    check("Selection trim outward with the sound blocked 8 frames on by another clip: picture and sound stop at the same frame (Premiere)", v["dur"] == au["dur"], (v["dur"], au["dur"]))
    if v["dur"] != au["dur"]:
        check("... and if not, the status line says the sound could not follow", "sound" in a.msg().lower() or "A1" in a.msg(), a.msg())
    back_to(a, s0)
    # --- Ripple Edit (B): tail of the first clip in by 30
    a.tool("b"); a.drag_frames("V1", 180, 150, edge="tail")
    ok, pr = a.synced()
    check("Ripple Edit tool: the first clip's tail in 30 frames; the next clip's picture and sound both move back to 150", ok and a.lay() == sorted([["V1", 0, 150, 0, 1, "av"], ["A1", 0, 150, 0, 1, "av"], ["V1", 150, 120, 0, 1, "av"], ["A1", 150, 120, 0, 1, "av"]]), a.lay())
    bp = a.beeps(0, 9)
    check("after the ripple trim the mix beeps at 1, 3, 5.5 and 7.5 s (the second clip's beeps followed it)", near(bp, [1.0, 3.0, 5.5, 7.5], 0.01), bp)
    i1 = a.info(165)
    check("after the ripple trim frame 165 is the second clip's frame 15, its white band (picture where its beep is)", i1["n"] == 15 and i1["band"] > 200, i1)
    # --- Ripple Edit: the second clip's head in by 30 (it moves back to close the frames)
    a.drag_frames("V1", 150, 180, edge="head")
    c2v, c2a = a.clips("V1")[1], a.clips("A1")[1]
    ok, pr = a.synced()
    check("Ripple Edit on the second clip's head: it stays at 150 showing from its frame 30, picture and sound alike", ok and c2v["start"] == 150 and abs(c2v["srcIn"] - 1.0) < 1e-6 and c2v["dur"] == 90, pr)
    bp = a.beeps(0, 9)
    check("after both ripple trims the mix beeps at 1, 3 and 6.5 s (the second clip's frame 75 at 195)", near(bp, [1.0, 3.0, 6.5], 0.01), bp)
    # --- Rolling Edit (N) on the cut at 150, both ways
    a.tool("n"); a.drag_frames("V1", 150, 160, edge="head")
    ok, pr = a.synced()
    v = a.clips("V1")
    check("Rolling Edit: the cut moves 10 frames later on the picture and the sound together (150 to 160)", ok and v[0]["dur"] == 160 and v[1]["start"] == 160 and abs(v[1]["srcIn"] - 40 * F) < 1e-6, pr)
    a.drag_frames("V1", 160, 135, edge="head")
    ok, pr = a.synced(); v = a.clips("V1")
    check("Rolling Edit back 25 frames: the cut at 135, picture and sound together, the end of the sequence unchanged", ok and v[0]["dur"] == 135 and v[1]["start"] == 135 and a.end() == 240, (pr, a.end()))
    bp = a.beeps(0, 9)
    check("after the rolls the second clip's beeps (its frames 15 and 75) are at 4.5 and 6.5 s, under its band", near(bp, [1.0, 3.0, 4.5, 6.5], 0.01) and a.info(195)["band"] > 200 and a.info(135)["band"] > 200, (bp, a.info(195)))
    back_to(a, s0)
    # --- Rate Stretch (R) from the tail: 180 frames into 120
    a.tool("r"); a.drag_frames("V1", 180, 120, edge="tail")
    ok, pr = a.synced(); v = a.clips("V1")[0]
    check("Rate Stretch from the tail: 180 frames to 120 makes picture and sound 150% alike", ok and v["dur"] == 120 and abs(v["speed"] - 1.5) < 1e-6, pr)
    bp = a.beeps(0, 4)
    i20 = a.info(20)
    check("Rate Stretch 150%: the mix beeps at 0.667, 2.0, 3.333 s and frame 20 shows source frame 30 with its band", near(bp, [20 * F, 60 * F, 100 * F], 0.012) and i20["n"] == 30 and i20["band"] > 200, (bp, i20))
    # from the head: the second clip's head from 180 to 210
    a.drag_frames("V1", 180, 210, edge="head")
    ok, pr = a.synced(); v = a.clips("V1")[1]
    check("Rate Stretch from the head: the second clip 120 frames into 90 (its end kept at 300), picture and sound alike", ok and v["start"] == 210 and v["dur"] == 90 and abs(v["speed"] - 120 / 90.0) < 1e-6, pr)
    bp = [b for b in a.beeps(6.5, 10.5)]
    i = a.info(222)
    check("Rate Stretch from the head: the second clip's beeps (its frames 15 and 75) come at frames 221.25 and 266.25, its band on frame 222", near(bp, [221.25 * F, 266.25 * F], 0.012) and i["band"] > 200, (bp, i))
    # Rate Stretch from the head into the gap before it (now 120..210)
    a.drag_frames("V1", 210, 150, edge="head")
    ok, pr = a.synced(); v = a.clips("V1")[1]
    check("Rate Stretch from the head into the gap before: 150 frames from 150, picture and sound alike", ok and v["start"] == 150 and v["dur"] == 150 and abs(v["speed"] - 0.8) < 1e-6, pr)
    back_to(a, s0)
    # --- Slip (Y): head trimmed 30 first, then slipped 15 earlier in its source
    a.tool("v"); a.drag_frames("V1", 0, 30, edge="head")
    a.tool("y"); a.drag_frames("V1", 100, 115)
    ok, pr = a.synced(); v = a.clips("V1")[0]
    check("Slip: dragging 15 frames right shows 15 frames earlier of the source, picture and sound alike, in the same place", ok and v["start"] == 30 and v["dur"] == 150 and abs(v["srcIn"] - 0.5) < 1e-6, pr)
    bp = a.beeps(0, 6); i45 = a.info(45)
    check("Slip: the beep of source frame 30 is at frame 45 (1.5 s), where the band shows", near(bp[:1], [1.5], 0.01) and i45["n"] == 30 and i45["band"] > 200, (bp, i45))
    check("Slip cannot go past the source's start: dragging 40 more right stops at its first frame", (a.drag_frames("V1", 100, 140) or True) and abs(a.clips("V1")[0]["srcIn"]) < 1e-6 and a.synced()[0], a.clips("V1")[0]["srcIn"])
    back_to(a, s0)
    # --- Slide (U): three clips abutting with handles, the middle one slid both ways; then beside a gap
    a.tool("b"); a.drag_frames("V1", 180, 150, edge="tail")          # tick 0-150, tock 150-270
    a.drag_frames("V1", 270, 240, edge="tail")                       # tock 150-240 (src 0..90)
    a.drag_item("tick.mp4", "V1", 240)                               # tick again 240-420
    a.drag_frames("V1", 240, 270, edge="head")                       # its head 30 in: 240-390 from 1.0 s
    lay3 = a.lay()
    check("set-up for Slide: tick 0-150, tock 150-240, tick 240-390 from 1 s, on V1 and A1", lay3 == sorted([["V1", 0, 150, 0, 1, "av"], ["A1", 0, 150, 0, 1, "av"], ["V1", 150, 90, 0, 1, "av"], ["A1", 150, 90, 0, 1, "av"], ["V1", 240, 150, 1.0, 1, "av"], ["A1", 240, 150, 1.0, 1, "av"]]), lay3)
    a.tool("u"); a.drag_frames("V1", 200, 210)
    ok, pr = a.synced(); v = a.clips("V1")
    check("Slide 10 later: the middle clip at 160-250, the one before 10 longer, the one after starting 10 later in its source; sound alike", ok and v[0]["dur"] == 160 and v[1]["start"] == 160 and v[1]["dur"] == 90 and v[2]["start"] == 250 and abs(v[2]["srcIn"] - 40 * F) < 1e-6, pr)
    a.drag_frames("V1", 205, 185)
    ok, pr = a.synced(); v = a.clips("V1")
    check("Slide 20 earlier: the middle clip at 140-230, sound alike, the sequence's end unchanged", ok and v[1]["start"] == 140 and v[0]["dur"] == 140 and v[2]["start"] == 230 and abs(v[2]["srcIn"] - 20 * F) < 1e-6 and a.end() == 390, (pr, a.end()))
    bp = a.beeps(4.5, 13)
    check("after the slides the slid clip's beeps (its frames 15, 75) are at frames 155, 215 and the last clip's (its 30, 90) at 240, 300", near(bp[:4], [155 * F, 215 * F, 240 * F, 300 * F], 0.012), bp)
    # beside a gap: the last clip's head trimmed (plain) to leave a gap of 20 after the middle clip, then slide right
    a.tool("v"); a.drag_frames("V1", 230, 250, edge="head")
    a.tool("u"); a.drag_frames("V1", 180, 200)
    ok, pr = a.synced(); v = a.clips("V1")
    check("Slide beside a gap: the middle clip moves 20 into the gap, the clip before grows 20, the clip after is untouched", ok and v[1]["start"] == 160 and v[0]["dur"] == 160 and v[2]["start"] == 250, pr)
    a.drag_frames("V1", 180, 230)
    v = a.clips("V1")
    check("Slide beside a gap stops at the next clip (it never lands on it)", v[1]["start"] + v[1]["dur"] <= v[2]["start"] and a.synced()[0], [(c["start"], c["dur"]) for c in v])
    back_to(a, s0)
    # --- a long music clip on a sync-locked A3 across a ripple trim
    a.import_files(["music.wav"])
    a.drag_item("music.wav", "A3", 0)
    mus = a.clips("A3")
    check("music.wav dragged to A3 at 0 lies there 600 frames long (its picture-less sound on A3 only)", mus and mus[0]["start"] == 0 and mus[0]["dur"] == 600 and not a.clips("V3"), (mus and [(c["start"], c["dur"]) for c in mus], a.clips("V3")))
    a.tool("b"); a.drag_frames("V1", 180, 150, edge="tail")
    mus = a.clips("A3"); ok, pr = a.synced()
    check("Ripple trim with the music across the edit on sync-locked A3: the music is not moved or cut", len(mus) == 1 and mus[0]["start"] == 0 and mus[0]["dur"] == 600, [(c["start"], c["dur"]) for c in mus])
    check("... the status line says A3 was not moved", "A3" in a.msg(), a.msg())
    check("... V1 and A1 still ripple together", ok and a.clips("V1")[1]["start"] == 150, pr)
    a.focus_tl(); a.key("Control+z")
    a.head_btn("A3", "Sync Lock").click(); pg.wait_for_timeout(200)
    a.drag_frames("V1", 180, 150, edge="tail")
    check("with A3's Sync Lock off the same ripple trim says nothing about A3", "A3" not in a.msg() and a.clips("V1")[1]["start"] == 150, a.msg())
    check("trims: no errors in the page", not a.errs, a.errs[:3])
    a.close()





def speed_dialog(a, pct=None, ripple=None, pitch=None, reverse=None, dur=None):
    """Clip > Speed/Duration (Ctrl+R) with what is given typed or ticked, then OK"""
    pg = a.pg
    a.focus_tl(); a.key("Control+r"); pg.wait_for_selector(".vd-dialog")
    rowsel = lambda lab: ".vd-dialog .vd-drow:has(span:text-is('%s'))" % lab
    if pct is not None:
        i = pg.locator(rowsel("Speed (%)") + " input"); i.fill(str(pct)); i.dispatch_event("input")
    if dur is not None:
        i = pg.locator(rowsel("Duration") + " input"); i.fill(str(dur)); i.dispatch_event("change")
    for lab, v in (("Ripple Edit, Shifting Trailing Clips", ripple), ("Maintain Audio Pitch", pitch), ("Reverse Speed", reverse)):
        if v is not None: pg.locator(rowsel(lab) + " input").set_checked(v)
    pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(400)


@section
def edits(B):
    """Q and W, Ripple Delete of separate clips, a gap clicked and closed with Delete, Insert Frame Hold Segment,
    Speed/Duration with and without Ripple and with Maintain Audio Pitch, sync-locked music across the edit"""
    a = base_two(B, extra=["music.wav"]); pg = a.pg
    s0 = a.snap(); F = 1 / 30.0
    # --- Q with V1 and A1 targeted
    a.goto(60); a.key("q")
    ok, pr = a.synced()
    check("Q at frame 60 (V1, A1 targeted): the first clip's first 60 frames go, picture and sound, the rest moves back; the playhead to 0", ok and a.lay() == sorted([["V1", 0, 120, 2.0, 1, "av"], ["A1", 0, 120, 2.0, 1, "av"], ["V1", 120, 120, 0, 1, "av"], ["A1", 120, 120, 0, 1, "av"]]) and a.ph() == 0, (a.lay(), a.ph()))
    bp = a.beeps(0, 9)
    check("after Q the mix beeps at 1, 3, 4.5, 6.5 s and the bands are on frames 30 and 135", near(bp, [1.0, 3.0, 4.5, 6.5], 0.01) and a.info(30)["band"] > 200 and a.info(135)["band"] > 200, bp)
    a.goto(100); a.key("w")
    ok, pr = a.synced()
    check("W at frame 100: the clip's end comes to 100, picture and sound, the next clip moves to 100; the playhead stays", ok and a.clips("V1")[0]["dur"] == 100 and a.clips("V1")[1]["start"] == 100 and a.clips("A1")[1]["start"] == 100 and a.ph() == 100, (pr, a.ph()))
    back_to(a, s0)
    # --- Q with only V1 targeted
    a.head_btn("A1", "Target").click(); pg.wait_for_timeout(200)
    a.goto(60); a.key("q")
    v, au = a.clips("V1"), a.clips("A1")
    ok, pr = a.synced()
    check("Q with only V1 targeted: the same 60 frames go from sync-locked A1 too, so the clip's sound stays in step with its picture (Premiere: a ripple trim to playhead removes the region from unlocked sync-locked tracks)", v[0]["dur"] == au[0]["dur"] and abs(v[0]["srcIn"] - au[0]["srcIn"]) < 1e-6, ("picture dur, sound dur, picture in, sound in", v[0]["dur"], au[0]["dur"], v[0]["srcIn"], au[0]["srcIn"]))
    check("Q with only V1 targeted: the next clip's picture and sound stay together, or the status line says A1 was left", v[1]["start"] == au[1]["start"] or "A1" in a.msg(), (v[1]["start"], au[1]["start"], a.msg()))
    a.focus_tl(); a.key("Control+z")
    a.head_btn("A1", "Target").click(); pg.wait_for_timeout(200)
    back_to(a, s0)
    # --- Ripple Delete of two separate clips (first and third)
    a.drag_item("tick.mp4", "V1", 300)
    s3 = a.snap()
    a.tool("v"); a.click_at("V1", 50); a.click_at("V1", 350, mods=["Shift"])
    nsel = a.A("A.sel.length")
    a.focus_tl(); a.key("Shift+Delete")
    ok, pr = a.synced()
    check("Ripple Delete of the first and third clips (Shift-click, Shift+Delete): only the middle one is left, at 0, picture and sound", nsel == 4 and ok and a.lay() == sorted([["V1", 0, 120, 0, 1, "av"], ["A1", 0, 120, 0, 1, "av"]]), (nsel, a.lay()))
    back_to(a, s3)
    # --- a gap clicked and closed with Delete
    a.click_at("V1", 240); a.focus_tl(); a.key("Delete")
    check("Delete on the middle clip leaves a gap 180-300 on V1 and A1", [c["start"] for c in a.clips("V1")] == [0, 300] and [c["start"] for c in a.clips("A1")] == [0, 300], a.lay())
    a.click_at("V1", 240)
    gap = a.A("A.selGap")
    check("a click in the gap on V1 chooses the gap (180 to 300)", gap and gap["a"] == 180 and gap["b"] == 300, gap)
    a.focus_tl(); a.key("Delete")
    ok, pr = a.synced()
    check("Delete on the chosen gap closes it: the last clip's picture and sound both at 180", ok and a.clips("V1")[1]["start"] == 180 and a.clips("A1")[1]["start"] == 180, a.lay())
    check("History calls it Ripple Delete", a.hist()[-1] == "Ripple Delete", a.hist()[-2:])
    bp = a.beeps(5.5, 12)
    check("after the gap is closed the last clip's beeps are at 7, 9 and 11 s", near(bp, [7.0, 9.0, 11.0], 0.01), bp)
    a.focus_tl(); a.key("Control+z")
    # with the music across the gap on sync-locked A3
    a.drag_item("music.wav", "A3", 0)
    a.click_at("V1", 240); a.focus_tl(); a.key("Delete")
    check("with music across the gap on sync-locked A3, Delete on the gap closes nothing (Premiere refuses)", [c["start"] for c in a.clips("V1")] == [0, 300] and a.clips("A3")[0]["dur"] == 600, a.lay())
    check("... and the status line names A3", "A3" in a.msg(), a.msg())
    a.head_btn("A3", "Sync Lock").click(); pg.wait_for_timeout(200)
    a.click_at("V1", 240); a.focus_tl(); a.key("Delete")
    check("with A3's Sync Lock off, Delete on the gap closes it on V1 and A1 and leaves the music whole", [c["start"] for c in a.clips("V1")] == [0, 180] and [c["start"] for c in a.clips("A1")] == [0, 180] and a.clips("A3")[0]["dur"] == 600, a.lay())
    a.head_btn("A3", "Sync Lock").click(); pg.wait_for_timeout(200)
    back_to(a, s0)
    # --- Insert Frame Hold Segment at frame 60
    a.goto(60); a.menu("Clip", "Insert Frame Hold Segment")
    v = a.clips("V1"); au = a.clips("A1")
    check("Insert Frame Hold Segment at 60: V1 has the clip to 60, a 2 s hold 60-120, the rest of the clip 120-240 from 2 s, the next clip at 240",
          [(c["start"], c["dur"]) for c in v] == [(0, 60), (60, 60), (120, 120), (240, 120)] and v[1]["hold"] is not None and abs(v[2]["srcIn"] - 2.0) < 1e-6, [(c["start"], c["dur"], c["srcIn"], c["hold"]) for c in v])
    check("Insert Frame Hold Segment: the sound has a 2 s gap at 60 and the rest of it, and the next clip's, moved 2 s with the picture",
          [(c["start"], c["dur"]) for c in au] == [(0, 60), (120, 120), (240, 120)] and abs(au[1]["srcIn"] - 2.0) < 1e-6, [(c["start"], c["dur"], c["srcIn"]) for c in au])
    ok, pr = a.synced()
    check("Insert Frame Hold Segment: the pictures after the hold are still linked to their sounds, in step", ok and len(pr) >= 2, pr)
    i90 = a.info(90); i150 = a.info(150)
    bp = a.beeps(0, 12)
    check("the hold shows frame 60 throughout (frame 90 of the sequence); frame 150 shows source frame 90 with its band", i90["n"] == 60 and i150["n"] == 90 and i150["band"] > 200, (i90["n"], i150))
    check("the mix: beeps at 1, 5, 7, 8.5 and 10.5 s (each under its band) and silence during the hold", near(bp, [1.0, 5.0, 7.0, 8.5, 10.5], 0.01) and a.rms(2.1, 3.9) < 0.01, (bp, a.rms(2.1, 3.9)))
    back_to(a, s0)
    # --- Speed/Duration: 50% with Ripple
    a.tool("v"); a.click_at("V1", 90)
    speed_dialog(a, pct=50, ripple=True)
    ok, pr = a.synced()
    check("Speed/Duration 50% with Ripple Edit: the clip (picture and sound) 360 frames long, the next clip moved to 360", ok and a.clips("V1")[0]["dur"] == 360 and a.clips("V1")[1]["start"] == 360 and a.clips("A1")[1]["start"] == 360, pr)
    bp = a.beeps(0, 12.5); fq = a.freq(0.2, 1.8)
    check("50%: the beeps come at 2, 6 and 10 s, the bands at frames 60, 180, 300", near(bp, [2.0, 6.0, 10.0], 0.012) and all(a.info(f)["band"] > 200 for f in (61, 181, 301)), bp)
    check("50% without Maintain Audio Pitch: the 440 Hz bed sounds an octave lower (220 Hz)", abs(fq - 220) <= 5, fq)
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 90)
    speed_dialog(a, pct=50, ripple=True, pitch=True)
    bp = a.beeps(0, 12.5); fq = a.freq(0.2, 1.8)
    check("50% with Maintain Audio Pitch: the bed stays at 440 Hz", abs(fq - 440) <= 5, fq)
    check("50% with Maintain Audio Pitch: the beeps still come at 2, 6 and 10 s (within a frame), with the bands", near(bp, [2.0, 6.0, 10.0], 1 / 30.0), bp)
    a.focus_tl(); a.key("Control+z")
    # without Ripple: 50% next to the following clip
    a.click_at("V1", 90)
    speed_dialog(a, pct=50, ripple=False)
    ok, pr = a.synced()
    check("Speed/Duration 50% without Ripple next to a clip: picture and sound stay 180 frames (cut short), the next clip unmoved", ok and a.clips("V1")[0]["dur"] == 180 and a.clips("V1")[1]["start"] == 180 and abs(a.clips("V1")[0]["speed"] - 0.5) < 1e-9, pr)
    check("... and the status line says the clip was cut short", "short" in a.msg(), a.msg())
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 90)
    speed_dialog(a, pct=200, ripple=False)
    ok, pr = a.synced()
    check("Speed/Duration 200% without Ripple: picture and sound 90 frames, a gap to the next clip at 180", ok and a.clips("V1")[0]["dur"] == 90 and a.clips("V1")[1]["start"] == 180, pr)
    bp = a.beeps(0, 3)
    check("200%: beeps at 0.5, 1.5, 2.5 s", near(bp, [0.5, 1.5, 2.5], 0.012), bp)
    a.focus_tl(); a.key("Control+z")
    # Duration typed (00:00:04:00 = 120 frames) with Ripple
    a.click_at("V1", 90)
    speed_dialog(a, dur="00:00:04:00", ripple=True)
    ok, pr = a.synced()
    check("Speed/Duration with a Duration of 00:00:04:00 typed and Ripple: 150%, 120 frames, the next clip at 120", ok and a.clips("V1")[0]["dur"] == 120 and abs(a.clips("V1")[0]["speed"] - 1.5) < 1e-6 and a.clips("A1")[1]["start"] == 120, pr)
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 90); speed_dialog(a, pct=200, ripple=True, pitch=True)
    bp = a.beeps(0, 3); fq = a.freq(0.1, 0.45)
    check("200% with Maintain Audio Pitch: the bed stays 440 Hz and the beeps come at 0.5, 1.5, 2.5 s (within a frame)", abs(fq - 440) <= 5 and near(bp, [0.5, 1.5, 2.5], 1 / 30.0), (fq, bp))
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 90); speed_dialog(a, reverse=True)
    ok, pr = a.synced(); bp = a.beeps(0, 6); i28 = a.info(28)
    check("Reverse Speed: picture and sound both reversed: the beeps start at 0.933, 2.933, 4.933 s and frame 28 shows source frame 151 with its band", ok and near(bp, [28 / 30.0, 88 / 30.0, 148 / 30.0], 0.012) and i28["n"] == 151 and i28["band"] > 200, (bp, i28))
    back_to(a, s0)
    # --- a sync-locked music clip across an Insert Frame Hold Segment
    a.drag_item("music.wav", "A3", 0)
    a.goto(60); a.menu("Clip", "Insert Frame Hold Segment")
    mus = a.clips("A3")
    check("Insert Frame Hold Segment with music on sync-locked A3: the music is cut at 60 and its rest moved 2 s with the picture", [(c["start"], c["dur"]) for c in mus] == [(0, 60), (120, 540)], [(c["start"], c["dur"]) for c in mus])
    a.focus_tl(); a.key("Control+z")
    # what is said when the music across the edit is left where it is
    said = {}
    a.goto(60); a.key("q"); said["Q"] = (a.msg(), pos(a.clips("A3")))
    check("Q at 60 with music on sync-locked A3: the same 60 frames are taken out of the music too, so it stays in step after the edit (Premiere)", sum(d for _, d in pos(a.clips("A3"))) == 540, pos(a.clips("A3")))
    a.focus_tl(); a.key("Control+z")
    a.tool("v"); a.click_at("V1", 240); a.focus_tl(); a.key("Shift+Delete"); said["Ripple Delete"] = (a.msg(), pos(a.clips("A3"))); a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 90); speed_dialog(a, pct=50, ripple=True); said["Speed/Duration with Ripple"] = (a.msg(), pos(a.clips("A3"))); a.focus_tl(); a.key("Control+z")
    a.tool("b"); a.drag_frames("V1", 0, 30, edge="head"); said["Ripple Edit tool on a head"] = (a.msg(), pos(a.clips("A3"))); a.focus_tl(); a.key("Control+z"); a.tool("v")
    quiet = {k: v for k, v in said.items() if v[1] == [(0, 600)] and "A3" not in (v[0] or "")}
    check("with music across the edit on sync-locked A3, Q, Ripple Delete, Speed/Duration with Ripple and the Ripple Edit tool each say A3 was not moved", not quiet, quiet)
    check("edits: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def mean_box(img, x0, y0, x1, y1):
    return img[int(y0):int(y1), int(x0):int(x1)].reshape(-1, img.shape[-1]).mean(axis=0)


@section
def trans(B):
    """Transitions: chosen by a click on the Timeline (Kind, Duration, Alignment, Direction, Border in Effect Controls;
    Delete removes only it), the Effects panel's default durations, Ctrl+D, Ctrl+Shift+D, Shift+D, a fade at the end"""
    a = base_two(B); pg = a.pg
    s0 = a.snap(); lay0 = a.lay()
    TEAL, PURP = [32, 80, 80], [80, 32, 80]
    a.focus_tl(); a.key("Escape")      # nothing selected (a selected clip takes Ctrl+D to its own ends, as in Premiere)
    a.goto(175); a.key("Control+d")
    t = a.clips("V1")[1]["tin"]
    check("Ctrl+D near the cut at 180: a Cross Dissolve on V1, 30 frames (1 s), centred on the cut", t and t["type"] == "crossDissolve" and t["dur"] == 30 and t["align"] == "center", t)
    check("Ctrl+D puts nothing on the sound", not a.clips("A1")[1]["tin"] and not a.clips("A1")[0]["tout"], a.clips("A1")[1]["tin"])
    m = a.info(180)["mid"]
    check("the middle of the dissolve (frame 180) is half each picture", abs(m[0] - 56) < 12 and abs(m[1] - 56) < 12 and abs(m[2] - 80) < 12, m)
    # click on the transition (not on the cut itself)
    a.tool("v"); a.click_at("V1", 170)
    st = a.A("A.selTrans"); sel = a.A("A.sel.length")
    labs = pg.locator(".vd-ctl .vd-plab:visible").all_inner_texts()
    check("a click on the transition on the Timeline chooses it alone (no clip selected)", st and st["edge"] == "in" and sel == 0, (st, sel))
    check("Effect Controls shows the chosen transition's Kind, Duration and Alignment", all(x in labs for x in ("Kind", "Duration (frames)", "Alignment")), labs)
    kind = pg.locator(".vd-prop:has(.vd-plab:text-is('Kind')) select:visible").first.input_value() if "Kind" in labs else None
    dv = a.prop("Duration (frames)").input_value() if "Duration (frames)" in labs else None
    al = pg.locator(".vd-prop:has(.vd-plab:text-is('Alignment')) select:visible").first.input_value() if "Alignment" in labs else None
    check("... with Cross Dissolve, 30 and Center at Cut", kind == "Cross Dissolve" and dv in ("30", "30.0") and al == "Center at Cut", (kind, dv, al))
    a.choose_prop("Kind", "Wipe")
    labs = pg.locator(".vd-ctl .vd-plab:visible").all_inner_texts()
    check("changing Kind to Wipe brings its own settings: Direction, Border Width, Border Color", all(x in labs for x in ("Direction", "Border Width", "Border Color")), labs)
    if "Direction" in labs:
        a.choose_prop("Direction", "From Right"); a.set_prop("Border Width", 8)
    t = a.clips("V1")[1]["tin"]
    check("Kind, Direction and Border Width are kept on the transition (Wipe, From Right, 8)", t["type"] == "wipe" and t.get("dir") == "From Right" and t.get("border") == 8, t)
    img = np.array(a.ev("() => __r4.img(180).then(function (i) { return Array.from(i.data); })"), float).reshape(240, 320, 4)
    left, right = mean_box(img, 10, 70, 110, 200), mean_box(img, 210, 70, 310, 200)
    check("Wipe From Right at its middle: the incoming picture on the right half, the outgoing on the left", abs(left[0] - 32) < 15 and abs(left[2] - 80) < 15 and abs(right[0] - 80) < 15 and abs(right[2] - 80) < 15 and right[1] < 50 and left[1] > 60, (left[:3].round(), right[:3].round()))
    col = [img[70:200, x, :3].mean() for x in range(130, 190)]
    check("Wipe's Border Width 8 draws a dark line at the edge", min(col) < 15, round(min(col), 1))
    a.set_prop("Duration (frames)", 20); a.choose_prop("Alignment", "Start at Cut")
    t = a.clips("V1")[1]["tin"]
    i175, i190 = a.info(175)["mid"], a.info(190)["mid"]
    check("Duration 20 and Start at Cut: frame 175 is the outgoing clip alone, frame 190 in the wipe", t["dur"] == 20 and t["align"] == "start" and abs(i175[0] - 32) < 6 and abs(i175[2] - 80) < 6, (t, i175, i190))
    n0 = len(a.hist())
    a.focus_tl(); a.key("Delete")
    check("Delete with the transition chosen removes only the transition; the clips stay as they were", a.clips("V1")[1]["tin"] is None and a.lay() == lay0, (a.clips("V1")[1]["tin"], a.lay()))
    check("History calls it Clear Transition (one step)", a.hist()[-1] == "Clear Transition" and len(a.hist()) == n0 + 1, a.hist()[-2:])
    back_to(a, s0)
    # --- the Effects panel's default durations
    a.tab("Effects")
    vbox = pg.locator("input[aria-label='Default Transition Duration, video (s)']"); abox = pg.locator("input[aria-label='Default Transition Duration, sound (s)']")
    check("the Effects panel offers the default transition durations, video and sound, 1 s each", vbox.count() == 1 and abox.count() == 1 and float(vbox.input_value()) == 1 and float(abox.input_value()) == 1, (vbox.count(), abox.count()))
    vbox.fill("0.5"); vbox.press("Enter"); abox.fill("2"); abox.press("Enter"); pg.wait_for_timeout(300)
    a.focus_tl(); a.key("Control+z")
    pv = a.A("[A.p.prefs.transSec, A.p.prefs.aTransSec]")
    shown_v = [float(vbox.input_value()), float(abox.input_value())]
    check("Ctrl+Z after changing the sound's default duration: the Effects panel's boxes show the durations then in force", shown_v == pv, ("boxes", shown_v, "in force", pv))
    a.key("Control+Shift+z")
    # handles first (Ripple Edit): the first clip ends at 150 with 30 frames unused, the second starts 30 frames into its source
    a.tool("b"); a.drag_frames("V1", 180, 150, edge="tail"); a.drag_frames("V1", 150, 180, edge="head"); a.tool("v")
    a.goto(155); a.key("Control+d"); a.key("Control+Shift+d")
    tv, ta = a.clips("V1")[1]["tin"], a.clips("A1")[1]["tin"]
    check("with the defaults at 0.5 s and 2 s, Ctrl+D makes a 15-frame Cross Dissolve and Ctrl+Shift+D a 60-frame Constant Power", tv and tv["dur"] == 15 and ta and ta["dur"] == 60 and ta["type"] == "constantPower", (tv, ta))
    r1 = min(a.rms(4.62, 4.85), a.rms(5.12, 5.32)); r0 = a.rms(1.2, 1.4)
    check("the Constant Power crossfade over handles keeps the level through the cut (within 1.5 dB)", abs(20 * math.log10(max(1e-9, r1) / r0)) < 1.5, (r0, r1))
    # an audio transition chosen on the Timeline
    a.click_at("A1", 138)
    labs = pg.locator(".vd-ctl .vd-plab:visible").all_inner_texts()
    opts = pg.locator(".vd-prop:has(.vd-plab:text-is('Kind')) select:visible option").all_inner_texts() if "Kind" in labs else []
    check("a click on the sound transition chooses it: Kind offers Constant Power, Constant Gain, Exponential Fade (no Direction)", opts == ["Constant Power", "Constant Gain", "Exponential Fade"] and "Direction" not in labs, (labs, opts))
    a.focus_tl(); a.key("Delete")
    check("Delete removes the sound transition and leaves the picture's", a.clips("A1")[1]["tin"] is None and a.clips("V1")[1]["tin"] is not None, (a.clips("A1")[1]["tin"], a.clips("V1")[1]["tin"]))
    back_to(a, s0)
    a.tab("Effects")      # the defaults back to 1 s, as a person would set them
    for lab in ("video", "sound"):
        b = pg.locator("input[aria-label='Default Transition Duration, %s (s)']" % lab); b.fill("1"); b.press("Enter"); pg.wait_for_timeout(150)
    s0 = a.snap()
    # --- Shift+D: both, as one step
    a.goto(185); h0 = len(a.hist()); a.key("Shift+d")
    tv, ta = a.clips("V1")[1]["tin"], a.clips("A1")[1]["tin"]
    check("Shift+D puts the default transition on both the picture and the sound at the cut", tv and ta and tv["type"] == "crossDissolve" and ta["type"] == "constantPower", (tv, ta))
    a.key("Control+z")
    tv, ta = a.clips("V1")[1]["tin"], a.clips("A1")[1]["tin"]
    check("one Undo takes Shift+D's transitions away, both (one command, one step) (Premiere)", not tv and not ta, (tv, ta, a.hist()[-3:]))
    back_to(a, s0)
    # --- a transition typed longer than its clips can hold
    a.goto(175); a.key("Control+d"); a.click_at("V1", 172)
    a.set_prop("Duration (frames)", 300)
    t = a.clips("V1")[1]["tin"]; m60 = a.info(60)["mid"]
    check("a dissolve's Duration typed as 300 frames between clips of 180 and 120: it is held to what the clips allow, and frame 60 is still the first clip alone (Premiere)", t["dur"] <= 120 and abs(m60[0] - 32) < 6 and abs(m60[2] - 80) < 6, (t["dur"], m60))
    back_to(a, s0)
    # --- a clip taken out from beside its transition
    a.focus_tl(); a.key("Escape"); a.goto(175); a.key("Control+d")
    a.tool("v"); a.click_at("V1", 60); a.focus_tl(); a.key("Shift+Delete")
    i0 = a.info(0)["mid"]; t = a.clips("V1")[0]["tin"]
    check("Ripple Delete of the clip before a dissolve: the clip left starts at 0 at full strength, not half way into a dissolve with nothing (Premiere)", abs(i0[0] - 80) < 8 and abs(i0[1] - 32) < 8, (i0, t))
    back_to(a, s0)
    # --- a fade out at the end of the sequence
    a.goto(298); a.key("Control+d")
    t = a.clips("V1")[1]["tout"]
    i299 = a.info(299)["all"]; i265 = a.info(265)["mid"]; i285 = a.info(285)["mid"]
    check("Ctrl+D at the end of the last clip: a 1 s fade out to black (frame 265 the picture, 285 about half, 299 nearly black)", t and t["single"] and max(i299[:3]) < 12 and abs(i265[0] - 80) < 6 and 30 < i285[0] < 50, (t, i299, i265, i285))
    check("trans: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def wait_msg(a, pattern, timeout=60):
    t0 = time.time()
    while time.time() - t0 < timeout:
        m = a.msg() or ""
        if re.search(pattern, m): return m
        a.pg.wait_for_timeout(250)
    return a.msg()


def mask_numbers(a, sec, cx, cy, rx, ry, feather=0):
    for lab, v in (("Mask centre X", cx), ("Mask centre Y", cy), ("Mask width / 2", rx), ("Mask height / 2", ry), ("Mask Feather", feather)):
        a.set_prop(lab, v, sec=sec)


@section
def fx(B):
    """Masks on Opacity and on an effect, placed by their numbers; Mosaic over a moving patch tracked forward, Esc,
    Clear tracking; Gaussian Blur under a rectangle mask; effect presets saved, applied, kept after reload, deleted"""
    a = App(B); pg = a.pg
    a.start(["tick.mp4", "tock.mp4"], n_clips=4); a.import_files(["face.mp4"])
    a.focus_tl(); a.key("s"); a.fit()
    a.drag_item("face.mp4", "V2", 0)
    check("face.mp4 (no sound) dragged to V2 at 0: its picture alone on V2, 90 frames", [(c["start"], c["dur"]) for c in a.clips("V2")] == [(0, 90)] and not a.clips("A2"), a.lay())
    # --- an ellipse mask on Opacity, by its numbers
    a.tool("v"); a.click_at("V2", 45); a.tab("Effect Controls")
    a.choose_prop("Mask", "Ellipse", sec="Opacity")
    mask_numbers(a, "Opacity", 160, 120, 40, 30)
    img = np.array(a.ev("() => __r4.img(10).then(function (i) { return Array.from(i.data); })"), float).reshape(240, 320, 4)
    inside, outside = img[115:125, 150:170, :3].mean(axis=(0, 1)), img[115:125, 210:230, :3].mean(axis=(0, 1))
    check("an Opacity ellipse mask (centre 160,120, 40 x 30, no feather): the clip shows inside, V1 below it shows outside", abs(inside - 96).max() < 10 and abs(outside - [32, 80, 80]).max() < 10, (inside.round(), outside.round()))
    a.tick_prop("Mask Inverted", True, sec="Opacity")
    img = np.array(a.ev("() => __r4.img(10).then(function (i) { return Array.from(i.data); })"), float).reshape(240, 320, 4)
    inside, outside = img[115:125, 150:170, :3].mean(axis=(0, 1)), img[115:125, 210:230, :3].mean(axis=(0, 1))
    check("Mask Inverted: V1 shows inside the ellipse and the clip outside", abs(inside - [32, 80, 80]).max() < 10 and abs(outside - 96).max() < 10, (inside.round(), outside.round()))
    a.choose_prop("Mask", "None", sec="Opacity")
    check("Mask None takes the Opacity mask away", a.A("A.selected().filter(function (x) { return x.t.kind === 'v'; })[0].c.mask") is None, "")
    # --- Mosaic with an ellipse mask over the patch at frame 0, then tracked forward
    a.effect("Mosaic")
    a.choose_prop("Mask", "Ellipse", sec="Mosaic")
    mask_numbers(a, "Mosaic", 64, 94, 30, 30)
    def patch_diff(f):
        # the patch's square at frame f with Mosaic on, then off (its checkbox in Effect Controls), then on again
        x0, y0 = 40 + 3 * f, 70 + f
        g1 = a.grey(f, x0 + 6, y0 + 6, x0 + 42, y0 + 42)
        cb = pg.locator(".vd-ctl input[aria-label='Mosaic on']").first
        cb.set_checked(False); pg.wait_for_timeout(150)
        g0 = a.grey(f, x0 + 6, y0 + 6, x0 + 42, y0 + 42)
        cb.set_checked(True); pg.wait_for_timeout(150)
        return float(np.abs(g1 - g0).mean())
    d0, d60 = patch_diff(0), patch_diff(60)
    far = a.grey(60, 10, 200, 40, 230); far_ok = abs(far - 96).max() < 3
    check("Mosaic under an ellipse mask placed by its numbers over the patch at frame 0: the patch is in blocks there", d0 > 8, d0)
    check("before tracking, the mask stays put: at frame 60 the patch (moved on) is not in blocks", d60 < 2, d60)
    a.key("Home"); a.focus_tl()
    a.sec_button("Mosaic", "Track forward").click()
    m = wait_msg(a, r"Tracked \d+ frames|stopped|could not", 90)
    ks = a.A("(function () { var c = A.selected().filter(function (x) { return x.t.kind === 'v'; })[0].c, k = c.fx[0].mask.keys; return [k.dx && k.dx.length, Lantern.video.keys.value(k.dx || [], 60, 0), Lantern.video.keys.value(k.dy || [], 60, 0), Lantern.video.keys.value(k.dx || [], 89, 0)]; })()")
    check("Track forward from frame 0 follows the patch to the clip's end and says how many frames it tracked", re.search(r"Tracked 89 frames", m or "") is not None, m)
    check("the tracked mask at frame 60 has moved 180 px right and 60 down (within 3 px), as the patch did", ks[0] and abs(ks[1] - 180) <= 3 and abs(ks[2] - 60) <= 3, ks)
    d60 = patch_diff(60); d85 = patch_diff(85)
    check("after tracking the patch is in blocks at frames 60 and 85 too", d60 > 8 and d85 > 8, (d60, d85))
    check("outside the mask the picture is untouched (flat grey far from the patch)", far_ok, far.min())
    # Clear tracking
    a.sec_button("Mosaic", "Clear tracking").click(); pg.wait_for_timeout(300)
    d60 = patch_diff(60)
    check("Clear tracking puts the mask back where it was placed (frame 60 not in blocks)", d60 < 2, d60)
    # Esc stops tracking part way, keeping what was tracked
    a.sec_button("Mosaic", "Track forward").click(); pg.wait_for_timeout(150); pg.keyboard.press("Escape")
    m = wait_msg(a, r"stopped|Tracked", 30)
    n = a.A("(function () { var c = A.p.seqs[A.seq.id].v[1].clips[0]; var k = c.fx[0].mask && c.fx[0].mask.keys; return k && k.dx ? k.dx.length : 0; })()")
    check("Esc stops Track forward part way and says where", "stopped" in (m or "") and 1 < n < 89, (m, n))
    sel = a.A("A.sel.length")
    check("the clip stays selected after Esc stops the tracking (its Effect Controls still shown)", sel > 0, sel)
    # --- Gaussian Blur under a rectangle mask on the clip below (V2 hidden)
    a.head_btn("V2", "Show").click(); pg.wait_for_timeout(200)
    a.click_at("V1", 45); a.tab("Effect Controls")
    a.effect("Gaussian Blur"); a.set_prop("Blurriness", 30, sec="Gaussian Blur")
    a.choose_prop("Mask", "Rectangle", sec="Gaussian Blur")
    for lab, v in (("Mask centre X", 80), ("Mask centre Y", 120), ("Mask width", 160), ("Mask height", 240), ("Mask Feather", 0)):
        a.set_prop(lab, v, sec="Gaussian Blur")
    # frame 17 lights box 0 (x 6..36, left of the middle) and box 4 (x 162..192, right of it)
    g = a.grey(17, 0, 223, 320, 224)[0]
    sharp_l, sharp_r = np.abs(np.diff(g[0:150])).max(), np.abs(np.diff(g[150:210])).max()
    check("Gaussian Blur with a rectangle mask on the left half: the box edges left of the middle are soft, right of it sharp", sharp_l < 60 and sharp_r > 120, (sharp_l, sharp_r))
    # --- an effect preset: Black & White and keyframed Gaussian Blur, saved, applied to the other clip
    a.effect("Black & White")
    a.key("Home"); a.focus_tl(); a.stopwatch("Blurriness", sec="Gaussian Blur")
    a.goto(60); a.set_prop("Blurriness", 5, sec="Gaussian Blur")
    pn = pg.locator(".vd-ctl input[aria-label='Preset name']"); pn.fill("Soft grey")
    pg.locator(".vd-ctl button:text-is('Save effects as preset')").click(); pg.wait_for_timeout(300)
    a.tab("Effects")
    pres = pg.locator(".vd-fxlist details:has(summary:text-matches('^Presets')) button.vd-fxitem").all_inner_texts()
    check("Save effects as preset: the Effects panel lists 'Soft grey' first, under Presets", pres == ["Soft grey"] and pg.locator(".vd-fxlist details").first.locator("summary").inner_text().startswith("Presets"), pres)
    a.click_at("V1", 240)
    pg.locator(".vd-fxlist button.vd-fxitem:text-is('Soft grey')").click(); pg.wait_for_timeout(300)
    fx2 = a.A("(function () { var c = A.seq.v[0].clips[1]; return c.fx.map(function (e) { return [e.type, e.keys && e.keys.amount ? e.keys.amount.map(function (k) { return [k.f, k.v]; }) : null, !!e.mask]; }); })()")
    check("the preset applied to the second clip gives it Gaussian Blur (its keys 30 at 0, 5 at 60, its mask) and Black & White", len(fx2) == 2 and fx2[0][0] == "gaussian" and fx2[0][1] == [[0, 30], [60, 5]] and fx2[0][2] and fx2[1][0] in ("blackWhite", "bw", "blackAndWhite"), fx2)
    mid = a.info(200)["mid"]
    check("the second clip now shows grey (Black & White from the preset)", abs(mid[0] - mid[1]) < 4 and abs(mid[1] - mid[2]) < 4, mid)
    # kept after the page is reloaded; deleted with its cross, and stays deleted
    pg.reload(); pg.wait_for_selector("text=Reopen the last project", timeout=60000)
    pg.click("button:text-is('Reopen the last project')"); pg.wait_for_selector(".vd-lanes", timeout=30000)
    a.tab("Effects")
    pres = pg.locator(".vd-fxlist details:has(summary:text-matches('^Presets')) button.vd-fxitem").all_inner_texts()
    check("after the page is reloaded the preset is still in the Effects panel", pres == ["Soft grey"], pres)
    pg.locator(".vd-fxlist button[title='Delete the preset Soft grey']").click(); pg.wait_for_timeout(300)
    pres1 = pg.locator(".vd-fxlist details:has(summary:text-matches('^Presets'))").count()
    pg.reload(); pg.wait_for_selector("text=Reopen the last project", timeout=60000)
    pg.click("button:text-is('Reopen the last project')"); pg.wait_for_selector(".vd-lanes", timeout=30000); a.tab("Effects")
    pres2 = pg.locator(".vd-fxlist details:has(summary:text-matches('^Presets'))").count()
    check("the preset's cross deletes it, and it stays deleted after a reload", pres1 == 0 and pres2 == 0, (pres1, pres2))
    check("fx: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def shift_of(a, b):
    """the shift (dx, dy) that moves picture a onto picture b (phase correlation, to a tenth of a pixel)"""
    wy = np.hanning(a.shape[0])[:, None]; wx = np.hanning(a.shape[1])[None, :]
    A = np.fft.fft2((a - a.mean()) * wy * wx); Bf = np.fft.fft2((b - b.mean()) * wy * wx)
    R = Bf * np.conj(A); R /= np.abs(R) + 1e-9
    r = np.real(np.fft.ifft2(R)); y, x = np.unravel_index(np.argmax(r), r.shape)
    def sub(m, l, c, rr):
        d = l - 2 * c + rr
        return 0 if d == 0 else 0.5 * (l - rr) / d
    h, w = r.shape
    dx = x + sub(0, r[y, (x - 1) % w], r[y, x], r[y, (x + 1) % w]); dy = y + sub(0, r[(y - 1) % h, x], r[y, x], r[(y + 1) % h, x])
    if dx > w / 2: dx -= w
    if dy > h / 2: dy -= h
    return dx, dy


def shake(a, n=60):
    """each rendered frame's shift from frame 0 (centre 192 x 144), and the frame-to-frame jumps"""
    g0 = a.grey(0, 64, 48, 256, 192); pos = [(0.0, 0.0)]
    for f in range(1, n):
        pos.append(shift_of(g0, a.grey(f, 64, 48, 256, 192)))
    p = np.array(pos); jumps = np.sqrt((np.diff(p, axis=0) ** 2).sum(axis=1))
    return p, jumps


@section
def fx2(B):
    """Warp Stabilizer (Analyze, Smooth Motion and No Motion, Framing, Maximum Scale) on a shaky clip; Time Remapping;
    keyframed Amplify"""
    a = App(B); pg = a.pg
    a.start(["shaky.mp4"], n_clips=1); a.focus_tl(); a.key("s"); a.fit()
    p_raw, j_raw = shake(a)
    a.tool("v"); a.click_at("V1", 30); a.effect("Warp Stabilizer")
    check("Warp Stabilizer added to a clip says to click Analyze", "Analyze" in (a.msg() or ""), a.msg())
    a.tab("Effect Controls")
    a.sec_button("Warp Stabilizer", "Analyze").click()
    m = wait_msg(a, r"Analysed \d+ frames|stopped|could not", 120)
    check("Analyze reads the clip and says how many frames (60)", "Analysed 60 frames" in (m or ""), m)
    p_sm, j_sm = shake(a)
    check("Smooth Motion (the default, 50%): the frame-to-frame shake is less than a third of the clip's own", j_sm.mean() < j_raw.mean() / 3, (round(j_raw.mean(), 2), round(j_sm.mean(), 2)))
    edge = [a.grey(f, 0, 0, 320, 240) for f in (5, 17, 33, 48)]
    check("Framing Stabilize, Crop, Auto-scale: no empty (black) edge in any frame looked at", all(min(e[:, :2].mean(), e[:, -2:].mean(), e[:2, :].mean(), e[-2:, :].mean()) > 20 for e in edge), [round(min(e[:, :2].mean(), e[:, -2:].mean(), e[:2, :].mean(), e[-2:, :].mean()), 1) for e in edge])
    a.choose_prop("Result", "No Motion", sec="Warp Stabilizer")
    p_nm, j_nm = shake(a)
    worst = int(np.argmax(np.abs(p_nm).max(axis=1)))
    check("No Motion with the default Method (Position, Scale, Rotation) on a shake that is only a shift: every frame holds still on frame 0 (each within 1.5 px)", np.abs(p_nm).max() <= 1.5, "raw shake up to %.1f px; held frames up to %.1f px off (frame %d)" % (np.abs(p_raw).max(), np.abs(p_nm).max(), worst))
    a.choose_prop("Method", "Position", sec="Warp Stabilizer")
    p_np, j_np = shake(a)
    check("No Motion with Method Position: every frame holds still on frame 0 (each within 1.5 px)", np.abs(p_np).max() <= 1.5, np.abs(p_np).max().round(2))
    a.choose_prop("Method", "Position, Scale, Rotation", sec="Warp Stabilizer")
    a.set_prop("Maximum Scale (%)", 101, sec="Warp Stabilizer")
    edge = [a.grey(f, 0, 0, 320, 240) for f in range(0, 60, 3)]
    blk = sum(1 for e in edge if min(e[:, :2].mean(), e[:, -2:].mean(), e[:2, :].mean(), e[-2:, :].mean()) < 5)
    check("Maximum Scale 101%: the picture cannot be enlarged enough, so empty edges show in some frames", blk > 0, blk)
    a.set_prop("Maximum Scale (%)", 150, sec="Warp Stabilizer")
    a.choose_prop("Framing", "Stabilize Only", sec="Warp Stabilizer")
    edge = [a.grey(f, 0, 0, 320, 240) for f in range(0, 60, 3)]
    blk2 = sum(1 for e in edge if min(e[:, :2].mean(), e[:, -2:].mean(), e[:2, :].mean(), e[-2:, :].mean()) < 5)
    check("Framing Stabilize Only: the moving edges show (empty borders in some frames)", blk2 > 0, blk2)
    a.choose_prop("Framing", "Stabilize, Crop, Auto-scale", sec="Warp Stabilizer")
    # trimmed after analysis: it asks to be analysed again, and does not stabilise a wrong frame
    a.drag_frames("V1", 0, 10, edge="head")
    note = pg.locator(".vd-ctl .vd-sec:has(> .vd-sech strong:text-is('Warp Stabilizer')) .muted").first.inner_text() if pg.locator(".vd-ctl .vd-sec:has(> .vd-sech strong:text-is('Warp Stabilizer'))").count() else ""
    check("after the clip is trimmed, Effect Controls says to analyse it again", "analyse it again" in note.lower() or "analyze" in note.lower(), note)
    a.close()
    # --- Time Remapping
    a = base_two(B); pg = a.pg
    a.tool("v"); a.click_at("V1", 90); a.tab("Effect Controls")
    a.key("Home"); a.focus_tl()
    a.stopwatch("Speed (%)", sec="Time Remapping")
    a.goto(30); a.set_prop("Speed (%)", 50, sec="Time Remapping")
    ks = a.A("A.seq.v[0].clips[0].keys.remap")
    check("Time Remapping: the stopwatch makes a key at 0 (100%) and typing 50 at frame 30 makes another", ks and [(k["f"], k["v"]) for k in ks] == [(0, 100), (30, 50)], ks)
    i30, i90 = a.info(30)["n"], a.info(90)["n"]
    check("the picture slows: frame 30 shows source frame 22 or 23 and frame 90 source frame 52 or 53", i30 in (22, 23) and i90 in (52, 53), (i30, i90))
    bp = a.beeps(0, 6.2)
    check("its sound stays at the clip's speed: the beeps at 1, 3 and 5 s, as before (the Help)", near(bp, [1.0, 3.0, 5.0], 0.01), bp)
    check("the clip's picture and sound keep their places and lengths", a.synced()[0], a.pairs())
    a.goto(120); a.set_prop("Speed (%)", 300, sec="Time Remapping")
    i119, i150, i175 = a.info(119)["n"], a.info(150)["n"], a.info(175)["n"]
    check("sped up to 300% by frame 120 the picture reaches the media's end near frame 120", i119 >= 170, i119)
    check("sped up past its media, the clip ends where its media does: no frozen last frame shown for the rest of it (Premiere)", not (i150 == 179 and i175 == 179), (i150, i175, a.clips("V1")[0]["dur"]))
    a.goto(30); a.stopwatch("Speed (%)", sec="Time Remapping")
    check("the stopwatch off takes the remapping away: frame 90 shows source frame 90 again", a.info(90)["n"] == 90 and not a.A("(A.seq.v[0].clips[0].keys.remap || []).length"), a.info(90)["n"])
    # --- keyframed Amplify on the sound alone (Alt-click picks the sound)
    a.click_at("A1", 90, mods=["Alt"])
    check("Alt-click on the linked sound selects the sound alone", a.A("A.sel.length") == 1 and a.A("A.selected()[0].t.name") == "A1", a.A("A.sel.length"))
    q0, q1, q2 = a.rms(0.0, 0.1), a.rms(1.4, 1.6), a.rms(2.3, 2.6)
    a.effect("Amplify"); a.tab("Effect Controls")
    a.key("Home"); a.focus_tl(); a.stopwatch("Gain (dB)", sec="Amplify")
    a.goto(60); a.set_prop("Gain (dB)", -20, sec="Amplify")
    r0, r1, r2 = a.rms(0.0, 0.1), a.rms(1.4, 1.6), a.rms(2.3, 2.6)
    d0, d1, d2 = 20 * math.log10(r0 / q0), 20 * math.log10(r1 / q1), 20 * math.log10(r2 / q2)
    check("keyframed Amplify (0 dB at frame 0, -20 dB at frame 60): about -1 dB over the first 3 frames, -15 dB at 1.5 s, -20 dB after 2 s", abs(d0 + 0.5) < 0.6 and abs(d1 + 15) < 1 and abs(d2 + 20) < 0.5, (round(d0, 2), round(d1, 2), round(d2, 2)))
    check("fx2: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def mark_source(a, name, fin, fout):
    """open a Project item in the Source Monitor (double-click), step to frame fin, I, step to fout, O"""
    pg = a.pg
    a.tab("Project"); pg.locator(".vd-pitem:has-text('%s')" % name).dblclick(); pg.wait_for_timeout(500)
    pg.locator(".vd-left .vd-view").click(); pg.wait_for_timeout(100)
    pg.keyboard.press("Home"); a.key("ArrowRight", fin); a.key("i"); a.key("ArrowRight", fout - fin); a.key("o")
    return a.A("[A.src.inS, A.src.outS]")


def pos(clips): return [(c["start"], c["dur"]) for c in clips or []]


@section
def target(B):
    """Targeting: Overwrite with only V1 targeted, Insert with only A1; drags from the Project panel and from the Source
    Monitor (In to Out) to V2 (sound to A2) and to A3; new Color Matte, Bars and Tone, Black Video, a title and credits
    never covering or cutting what is there"""
    a = base_two(B, extra=["voice.wav"]); pg = a.pg
    s0 = a.snap(); F = 1 / 30.0
    io = mark_source(a, "tock.mp4", 10, 39)
    check("Source Monitor: I at its frame 10 and O at 39 mark 10/30 s to 40/30 s (the out frame included)", abs(io[0] - 10 * F) < 1e-6 and abs(io[1] - 40 * F) < 1e-6, io)
    # only V1 targeted: Overwrite (.)
    a.head_btn("A1", "Target").click(); pg.wait_for_timeout(150)
    a.goto(60); a.key(".")
    v, au = a.clips("V1"), a.clips("A1")
    check("Overwrite (.) with only V1 targeted: the marked 30 frames of picture at 60 on V1, over what was there", pos(v) == [(0, 60), (60, 30), (90, 90), (180, 120)] and abs(v[1]["srcIn"] - 10 * F) < 1e-6, pos(v))
    check("... and the sound tracks are untouched", pos(au) == [(0, 180), (180, 120)], pos(au))
    a.focus_tl(); a.key("Control+z")
    # only A1 targeted: Insert (,)
    a.head_btn("A1", "Target").click(); a.head_btn("V1", "Target").click(); pg.wait_for_timeout(150)
    a.goto(60); a.key(",")
    v, au = a.clips("V1"), a.clips("A1")
    check("Insert (,) with only A1 targeted: the marked 30 frames of sound at 60 on A1, the rest pushed 30 on", pos(au) == [(0, 60), (60, 30), (90, 120), (210, 120)] and abs(au[1]["srcIn"] - 10 * F) < 1e-6, pos(au))
    check("... sync-locked V1 is pushed the same (a 30-frame gap at 60), so the pictures stay with their sounds", pos(v) == [(0, 60), (90, 120), (210, 120)] and a.synced()[0], (pos(v), a.pairs()))
    bp = a.beeps(0, 12)
    check("after the insert: the inserted part's beep (its frame 15) at frame 65 and the pushed clips' beeps 1 s later (4, 6, 7.5, 9.5 s)", near(bp, [1.0, 65 * F, 4.0, 6.0, 7.5, 9.5], 0.01), bp)
    a.focus_tl(); a.key("Control+z")
    a.head_btn("V1", "Target").click(); pg.wait_for_timeout(150)
    check("Undo leaves the targets as the person set them (V1 and A1 on again)", a.A("[A.seq.v[0].target, A.seq.a[0].target]") == [True, True], a.A("[A.seq.v[0].target, A.seq.a[0].target]"))
    # drags to V2 and to A3
    a.drag_item("tock.mp4", "V2", 100)
    check("dragging a clip from the Project panel to V2 at 100: its picture on V2 and its sound on A2, linked, 100-220", pos(a.clips("V2")) == [(100, 120)] and pos(a.clips("A2")) == [(100, 120)] and a.clips("V2")[0]["link"] == a.clips("A2")[0]["link"] and a.clips("V2")[0]["link"], (pos(a.clips("V2")), pos(a.clips("A2"))))
    check("... V1 and A1 are untouched by it", pos(a.clips("V1")) == [(0, 180), (180, 120)] and pos(a.clips("A1")) == [(0, 180), (180, 120)], a.lay())
    a.drag_source("V2", 250)
    v2, a2 = a.clips("V2"), a.clips("A2")
    check("dragging from the Source Monitor to V2 at 250: only its In to Out (30 frames from its frame 10), picture on V2, sound on A2", pos(v2)[-1:] == [(250, 30)] and pos(a2)[-1:] == [(250, 30)] and abs(v2[-1]["srcIn"] - 10 * F) < 1e-6, (pos(v2), pos(a2)))
    a.drag_item("tock.mp4", "A3", 320)
    check("dragging a clip to A3 at 320: its sound on A3 and its picture on V3", pos(a.clips("A3")) == [(320, 120)] and pos(a.clips("V3")) == [(320, 120)], (pos(a.clips("A3")), pos(a.clips("V3"))))
    a.drag_item("voice.wav", "V1", 400)
    check("dragging a sound file to V1 at 400 puts it on A1 (a sound has no picture)", (400, 60) in pos(a.clips("A1")) and not [c for c in a.clips("V1") if c["start"] == 400], (pos(a.clips("A1")), pos(a.clips("V1"))))
    back_to(a, s0)
    # new items at frame 30: never over what is there
    keep = (pos(a.clips("V1")), pos(a.clips("A1")))
    a.goto(30)
    a.menu("Graphics", "New Color Matte")
    check("New Color Matte at 30 with V1 busy: put on V2 (5 s), V1 untouched", pos(a.clips("V2")) == [(30, 150)] and a.clips("V2")[0]["kind"] == "matte", a.lay())
    a.menu("Graphics", "New Bars and Tone")
    b3, t2 = a.clips("V3"), a.clips("A2")
    check("New Bars and Tone at 30: the bars on V3 (V1, V2 busy) and its tone on A2 (A1 busy), linked", pos(b3) == [(30, 150)] and b3[0]["kind"] == "bars" and pos(t2) == [(30, 150)] and t2[0]["kind"] == "tone" and b3[0]["link"] == t2[0]["link"], (pos(b3), pos(t2)))
    a.head_btn("A1", "Mute").click(); pg.wait_for_timeout(200)
    fq = a.freq(1.5, 2.0); pk = a.ev("() => { var c = __r4.mix(72000, 96000)[0], m = 0; for (var i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i])); return m; }")
    check("the tone (A1 muted) is 1 kHz at -20 dBFS", abs(fq - 1000) <= 5 and abs(20 * math.log10(max(pk, 1e-9)) + 20) < 0.3, (fq, pk))
    a.head_btn("A1", "Mute").click(); pg.wait_for_timeout(150)
    n_v = a.A("A.seq.v.length")
    a.menu("Graphics", "New Black Video")
    check("New Black Video at 30 with V1-V3 busy: a new track V4 is made for it, and the status line says so", a.A("A.seq.v.length") == n_v + 1 and pos(a.clips("V4")) == [(30, 150)] and "new track" in (a.msg() or "").lower(), (a.A("A.seq.v.length"), a.msg()))
    a.focus_tl(); a.key("Control+t")
    check("New Title (Ctrl+T) at 30: on a new track V5, as V2-V4 are busy there, and said", pos(a.clips("V5")) == [(30, 150)] and "V5" in (a.msg() or ""), (a.A("A.seq.v.length"), a.msg()))
    a.goto(200); a.menu("Graphics", "New Rolling Credits")
    check("New Rolling Credits at 200: on V2, free from 180 on, 10 s long", (200, 300) in pos(a.clips("V2")), pos(a.clips("V2")))
    check("none of the new items cut or moved the clips on V1 and A1", (pos(a.clips("V1")), pos(a.clips("A1"))) == keep, a.lay())
    i = a.info(60)
    check("frame 60 shows the topmost item (the title over black video), not the clip on V1", i["n"] != 60 or i["mid"][0] < 40, i)
    check("target: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def flags(a):
    return a.A("A.seq.v.concat(A.seq.a).map(function (t) { return [t.name, !!t.target, !!t.sync, !!t.lock, !!t.off, !!t.mute, !!t.solo]; })")


def shown_flags(a):
    """the track header buttons as drawn (aria-pressed), by their titles"""
    return a.ev("() => Array.prototype.map.call(document.querySelectorAll('.vd-heads button'), function (b) { return [b.title, b.getAttribute('aria-pressed')]; })")


@section
def undo(B):
    """Undo and Redo leave the playhead and the track header buttons as they are; those buttons are not History steps;
    locked tracks untouched by Select All and Delete; nested sequences (their sound; double-click opens one)"""
    a = base_two(B); pg = a.pg
    a.goto(60); a.key("Control+k")
    check("Ctrl+K at 60 cuts the clip on V1 and A1", pos(a.clips("V1"))[:2] == [(0, 60), (60, 120)] and pos(a.clips("A1"))[:2] == [(0, 60), (60, 120)], a.lay())
    h0 = len(a.hist())
    a.goto(150)
    for tr, b in (("V1", "Show"), ("A1", "Mute"), ("A2", "Solo"), ("V2", "Lock"), ("V1", "Target"), ("A1", "Sync Lock")):
        a.head_btn(tr, b).click(); pg.wait_for_timeout(120)
    f_set = flags(a); sf_set = shown_flags(a)
    check("six track header buttons (eye, mute, solo, lock, target, sync lock) clicked: none of them is a History step", len(a.hist()) == h0, a.hist()[-4:])
    a.focus_tl(); a.key("Control+z")
    check("Undo takes back the cut", pos(a.clips("V1")) == [(0, 180), (180, 120)], pos(a.clips("V1")))
    check("Undo leaves the playhead where it is (150)", a.ph() == 150, a.ph())
    check("Undo leaves every track header button as the person set it, in the data and on screen", flags(a) == f_set and shown_flags(a) == sf_set, [x for x, y in zip(flags(a), f_set) if x != y])
    a.key("Control+Shift+z")
    check("Redo brings the cut back and still leaves the playhead and the header buttons alone", pos(a.clips("V1"))[:2] == [(0, 60), (60, 120)] and a.ph() == 150 and flags(a) == f_set, (a.ph(), pos(a.clips("V1"))))
    a.tab("History")
    hrows = pg.locator(".vd-hrow").all_inner_texts()
    check("the History panel lists the cut and no header button", any("Add Edit" in x for x in hrows) and not any(re.search(r"Mute|Solo|Lock|Target|Show", x) for x in hrows), hrows)
    # put the buttons back as they were
    for tr, b in (("V1", "Show"), ("A1", "Mute"), ("A2", "Solo"), ("V2", "Lock"), ("V1", "Target"), ("A1", "Sync Lock")):
        a.head_btn(tr, b).click(); pg.wait_for_timeout(100)
    # --- a locked track and Select All / Delete
    a.head_btn("A1", "Lock").click(); pg.wait_for_timeout(150)
    a.focus_tl(); a.key("Control+a")
    sel_tracks = a.A("A.selected().map(function (x) { return x.t.name; })")
    check("Ctrl+A with A1 locked selects the clips on V1 but none on A1", sel_tracks and "A1" not in sel_tracks and "V1" in sel_tracks, sel_tracks)
    a.key("Delete")
    check("Delete then takes the pictures off V1 and leaves locked A1's sound as it was", not a.clips("V1") and pos(a.clips("A1")) == [(0, 60), (60, 120), (180, 120)], a.lay())
    a.key("Control+z")
    a.click_at("A1", 100)
    check("a click on a clip on the locked A1 says the track is locked and selects nothing there", "locked" in (a.msg() or "") and "A1" not in a.A("A.selected().map(function (x) { return x.t.name; })"), a.msg())
    a.drag_frames("A1", 100, 130)
    check("a drag on locked A1 moves nothing", pos(a.clips("A1")) == [(0, 60), (60, 120), (180, 120)], pos(a.clips("A1")))
    a.head_btn("A1", "Lock").click(); pg.wait_for_timeout(150)
    # --- nested sequence
    a.key("Control+z")   # the cut away: tick whole again
    a.tool("v"); a.click_at("V1", 90)
    a.menu("Clip", "Nest…")
    v, au = a.clips("V1"), a.clips("A1")
    check("Clip > Nest on the first clip (picture and sound): one nested clip on V1 and one on A1, 0-180, linked", v[0]["kind"] == "nest" and au[0]["kind"] == "nest" and pos(v)[0] == (0, 180) and pos(au)[0] == (0, 180) and v[0]["link"] and v[0]["link"] == au[0]["link"], (pos(v), pos(au)))
    bp = a.beeps(0, 10); i30 = a.info(30)
    check("the nested clip plays its sequence's sound (beeps at 1, 3, 5 s, then the next clip's) and picture (frame 30 with its band)", near(bp, [1.0, 3.0, 5.0, 6.5, 8.5], 0.01) and i30["n"] == 30 and i30["band"] > 200, (bp, i30))
    a.dblclick_at("V1", 90)
    check("double-clicking the nested clip opens its sequence in the Timeline and says so", a.A("A.seq.name").startswith("Nested Sequence") and "Opened" in (a.msg() or ""), (a.A("A.seq.name"), a.msg()))
    a.tab("Project"); pg.locator(".vd-pitem:has-text('Sequence 01')").dblclick(); pg.wait_for_timeout(300)
    check("double-clicking Sequence 01 in the Project panel brings it back", a.A("A.seq.name") == "Sequence 01", a.A("A.seq.name"))
    check("undo: no errors in the page", not a.errs, a.errs[:3])
    a.close()



@section
def keys(B):
    """Shift+1..7 panels, markers and Ctrl+Shift+M, Duplicate (Ctrl+Shift+/), Alt-click, snapping a dragged clip's head and
    tail to the playhead and to markers, the menus saying why when nothing is selected or copied"""
    a = base_two(B); pg = a.pg
    s0 = a.snap()
    want = {1: ("vd-bl", "Project"), 2: ("vd-left", "Source"), 5: ("vd-left", "Effect Controls"), 6: ("vd-left", "Audio Track Mixer"), 7: ("vd-bl", "Effects")}
    got = {}
    for k in (1, 2, 5, 6, 7):
        a.focus_tl(); pg.keyboard.press("Shift+Digit%d" % k); pg.wait_for_timeout(200)
        got[k] = pg.locator(".%s .vd-tab.on" % want[k][0]).inner_text()
    check("Shift+1, 2, 5, 6, 7 bring up Project, Source, Effect Controls, Audio Track Mixer and Effects", all(got[k] == want[k][1] for k in got), got)
    a.focus_tl(); pg.keyboard.press("Shift+Digit4"); pg.wait_for_timeout(150)
    f4 = a.ev("() => document.activeElement && document.activeElement.getAttribute('aria-label')")
    pg.keyboard.press("Shift+Digit3"); pg.wait_for_timeout(150)
    f3 = a.ev("() => document.activeElement && document.activeElement.getAttribute('aria-label')")
    check("Shift+4 puts the keys on the Program Monitor and Shift+3 on the Timeline", f4 == "Program Monitor" and f3 == "Timeline tracks", (f4, f3))
    # markers
    a.goto(30); a.key("m"); a.goto(90); a.key("m"); a.goto(150)
    a.key("Control+Shift+m"); p1 = a.ph(); a.key("Control+Shift+m"); p2 = a.ph(); a.key("Shift+m"); p3 = a.ph()
    check("markers at 30 and 90: from 150 Ctrl+Shift+M goes to 90 then 30, Shift+M back to 90", (p1, p2, p3) == (90, 30, 90), (p1, p2, p3))
    check("Ctrl+Shift+M does not open the Export box", a.ev("() => !document.querySelector('.vd-dialog')"), "")
    back_to(a, s0)
    # Duplicate
    a.tool("v"); a.click_at("V1", 240); a.focus_tl(); pg.keyboard.press("Control+Shift+Slash"); pg.wait_for_timeout(300)
    dk = pos(a.clips("V1"))
    check("Ctrl+Shift+/ (Duplicate, as the Edit menu shows it) copies the last clip right after itself, picture and sound", dk == [(0, 180), (180, 120), (300, 120)] and pos(a.clips("A1")) == dk, (dk, a.msg()))
    back_to(a, s0)
    a.click_at("V1", 240); a.menu("Edit", "Duplicate")
    check("Edit > Duplicate copies the last clip right after itself", pos(a.clips("V1")) == [(0, 180), (180, 120), (300, 120)] and a.synced()[0], pos(a.clips("V1")))
    back_to(a, s0)
    a.click_at("V1", 90); a.menu("Edit", "Duplicate")
    v = pos(a.clips("V1"))
    check("Duplicate of the first of two clips that touch: the clip after it is not overwritten (or it says so)", (180, 120) in v or "overw" in (a.msg() or "").lower(), (v, a.msg()))
    back_to(a, s0)
    # Alt-click: the picture alone, then Delete
    a.click_at("V1", 90, mods=["Alt"]); a.focus_tl(); a.key("Delete")
    check("Alt-click on the picture, Delete: the picture goes and its sound stays", pos(a.clips("V1")) == [(180, 120)] and pos(a.clips("A1")) == [(0, 180), (180, 120)], a.lay())
    back_to(a, s0)
    a.click_at("V1", 90, mods=["Alt"]); a.focus_tl(); a.key("Control+c")
    check("Alt-click on the picture, Ctrl+C: one clip is copied (the picture), and the status line says one", a.A("A.clipboard ? A.clipboard.length : 0") == 1, (a.A("A.clipboard ? A.clipboard.length : 0"), a.msg()))
    # snapping a dragged clip's head to a marker and its tail to the playhead
    a.focus_tl(); a.key("s")
    check("S turns snapping on again (the status line says so)", a.A("A.snap") and "Snap on" in (a.msg() or ""), a.msg())
    a.goto(400); a.key("m"); a.goto(700)
    ppf = a.ev("() => Lantern.video.ui.U.tl.state.ppf")
    off = max(1, int(5 / ppf))
    a.visible(0, 760)
    a.drag_frames("V1", 240, 240 + 220 + off)
    v = a.clips("V1")[-1]
    check("a clip dragged so its head lands a few pixels from a marker snaps its head to the marker (400)", v["start"] == 400 and a.clips("A1")[-1]["start"] == 400, (v["start"], off))
    a.drag_frames("V1", 460, 460 + 180 - off)
    v = a.clips("V1")[-1]
    check("a clip dragged so its tail lands a few pixels from the playhead snaps its tail to the playhead (700)", v["start"] + v["dur"] == 700 and a.synced()[0], (v["start"], v["dur"]))
    back_to(a, s0)
    # menus with nothing selected or copied say why
    a.focus_tl(); a.key("Escape")
    a2 = App(B); a2.start(["tick.mp4"], n_clips=2); a2.focus_tl(); a2.key("Escape")
    said = {}
    for top, item in (("Edit", "Copy"), ("Edit", "Paste"), ("Edit", "Paste Insert"), ("Edit", "Paste Attributes"), ("Edit", "Clear"), ("Edit", "Ripple Delete"), ("Edit", "Duplicate"),
                      ("Clip", "Speed/Duration…"), ("Clip", "Enable"), ("Clip", "Link / Unlink"), ("Clip", "Nest…"), ("Clip", "Scale to Frame Size"),
                      ("Clip", "Scene Edit Detection…"), ("Clip", "Synchronize (by sound)")):
        a2.focus_tl(); a2.key("v"); before = a2.msg()
        h = len(a2.hist())
        a2.menu(top, item)
        dlg = a2.ev("() => !!document.querySelector('.vd-dialog')")
        if dlg: a2.pg.keyboard.press("Escape"); a2.pg.wait_for_timeout(100)
        said[top + " > " + item] = (a2.msg(), dlg, len(a2.hist()) - h, before)
    quiet = [k for k, v in said.items() if not v[0] or v[0] == v[3] or v[2]]
    check("with nothing selected and nothing copied, each Edit and Clip menu item says why it did nothing (and changes nothing)", not quiet, {k: said[k] for k in quiet})
    a2.focus_tl(); a2.key("v"); a2.menu("Clip", "Audio Gain…")
    dlg = a2.ev("() => !!document.querySelector('.vd-dialog')")
    if dlg: a2.pg.click(".vd-dialog button:text-is('OK')"); a2.pg.wait_for_timeout(200)
    check("Clip > Audio Gain with no sound clip selected says to select sound clips", "select" in (a2.msg() or "").lower(), (dlg, a2.msg()))
    a2.close()
    check("keys: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def export(a, fmt, setup=None, timeout=240000):
    """File > Export Media (Ctrl+M): the format chosen, anything else set by setup(), then Export; the file saved"""
    pg = a.pg
    a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog")
    pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Format')) select", fmt); pg.wait_for_timeout(300)
    if setup: setup()
    return a.save_dl(lambda: pg.click(".vd-dialog button:text-is('Export')"), timeout=timeout)


def edited(B):
    """the edit exported: tick trimmed to 150 (Ripple), a 2 s frame hold inserted at 60, a Cross Dissolve into tock at 210,
    a title on V2 at 240 with its own words. Frames: tick 0-60, hold 60-120, tick 120-210 (its 60-149), tock 210-330"""
    a = base_two(B); pg = a.pg
    a.tool("b"); a.drag_frames("V1", 180, 150, edge="tail"); a.tool("v")
    a.goto(60); a.menu("Clip", "Insert Frame Hold Segment")
    a.focus_tl(); a.key("Escape")                      # nothing selected: Ctrl+D goes on the cut at the playhead
    a.goto(208); a.key("Control+d")
    a.goto(240); a.key("Control+t")
    a.tab("Essential Graphics")
    ta = pg.locator("textarea[aria-label='The words']")
    if ta.count(): ta.fill("Cut by review 4"); ta.dispatch_event("change"); pg.wait_for_timeout(200)
    a.goto(0)
    return a


@section
def exportsec(B):
    """Export: the box shows only what each format uses; the MP4 sound note before and after; MP4, WebM, MOV, AVI, GIF,
    WAV, PNG decoded by ffmpeg (picture and sound in step through a trim, a hold and a dissolve); loudness normalisation"""
    a = edited(B); pg = a.pg
    lay = a.lay()
    check("set-up: tick 0-60, a hold 60-120, tick 120-210, tock 210-330 on V1; sound alike with a gap for the hold; a title on V2 at 240",
          pos(a.clips("V1")) == [(0, 60), (60, 60), (120, 90), (210, 120)] and pos(a.clips("A1")) == [(0, 60), (120, 90), (210, 120)] and pos(a.clips("V2")) == [(240, 150)], lay)
    # what the box shows for each format
    a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog")
    rows = ["Size", "Video bitrate (Mb/s)", "Audio bitrate", "Loudness", "Burn in captions", "GIF width"]
    want = {"mp4": {"Size", "Video bitrate (Mb/s)", "Audio bitrate", "Loudness", "Burn in captions"}, "webm": {"Size", "Video bitrate (Mb/s)", "Audio bitrate", "Loudness", "Burn in captions"},
            "mov": {"Size", "Video bitrate (Mb/s)", "Loudness", "Burn in captions"}, "avi": {"Size", "Loudness", "Burn in captions"}, "gif": {"GIF width", "Burn in captions"},
            "wav": {"Loudness"}, "png": {"Size", "Burn in captions"}, "srt": set()}
    seen = {}
    for fmt in want:
        pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Format')) select", fmt); pg.wait_for_timeout(250)
        seen[fmt] = {r for r in rows if pg.locator(".vd-dialog .vd-drow:has(> span:text-is('%s'))" % r).is_visible()}
    bad = {f: (sorted(seen[f]), sorted(want[f])) for f in want if seen[f] != want[f]}
    check("the Export box shows only the settings each format uses (MP4, WebM, MOV, AVI, GIF, WAV, PNG, SRT)", not bad, bad)
    pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Format')) select", "mp4"); pg.wait_for_timeout(800)
    note = pg.inner_text(".vd-dialog .vd-note")
    aac = a.ev("() => Lantern.video.exp.aacOk(48000)")
    check("MP4 chosen: where this browser cannot encode AAC the box says the sound will be Opus, before exporting", aac or "Opus" in note, (aac, note))
    pg.keyboard.press("Escape")
    # every format
    F = 1 / 30.0
    nums_want = [(0, 0), (30, 30), (90, 60), (150, 90), (209, 149)]
    for fmt, vc, acs in (("mp4", "h264", ("aac", "opus")), ("webm", "vp9", ("opus",)), ("mov", "h264", ("pcm_s16le",)), ("avi", "mjpeg", ("pcm_s16le",))):
        try:
            f, nm = export(a, fmt)
        except Exception as e:
            check("Export %s makes a file" % fmt, False, e); continue
        msg = a.msg()
        pr = probe(f); st = pr.get("streams", []); v = [x for x in st if x["codec_type"] == "video"]; au = [x for x in st if x["codec_type"] == "audio"]
        nfr = int(v[0].get("nb_read_frames", 0)) if v else 0
        check("Export %s: %s picture 320 x 240, %s sound, 390 frames (to the title's end)" % (fmt, vc, "/".join(acs)), v and v[0]["codec_name"] == vc and v[0]["width"] == 320 and au and au[0]["codec_name"] in acs and nfr == 390, ([(x["codec_name"], x.get("width")) for x in st], nfr))
        fr = frames_of(f, 320, 240)
        nums = [num_of(fr[i]) if i < len(fr) else None for i, _ in nums_want]
        purple = len(fr) > 300 and fr[300][100:180, 100:220, 0].mean() > fr[300][100:180, 100:220, 1].mean() + 20
        check("Export %s: frames 0, 30, 90 (the hold), 150, 209 show source frames 0, 30, 60, 90, 149; frame 300 is the second clip" % fmt, nums == [n for _, n in nums_want] and purple, (nums, purple))
        bands = [i for i in band_frames(fr) if True]
        bp = beeps(pcm_of(f))
        check("Export %s: the white bands on frames 30, 150, 225, 285 (two each) and the beeps at 1, 5, 7.5, 9.5 s, each within a frame of its band" % fmt,
              bands == [30, 31, 150, 151, 225, 226, 285, 286] and near(bp, [1.0, 5.0, 7.5, 9.5], F), (bands, [round(x, 3) for x in bp]))
        if fmt in ("mov", "avi"):
            check("Export %s (PCM sound): the beeps within 5 ms of their bands" % fmt, near(bp, [1.0, 5.0, 7.5, 9.5], 0.005), [round(x, 4) for x in bp])
        if fmt == "mp4":
            opus = au and au[0]["codec_name"] == "opus"
            check("Export mp4: when the sound is Opus the status line says so after saving", not opus or "Opus" in (msg or ""), msg)
            check("Export mp4: the note after saving does not claim every editor reads Opus (Premiere Pro does not import Opus) (Premiere)", not opus or "every current player and editor" not in (msg or ""), msg)
    f, nm = export(a, "gif"); fr = frames_of(f, 320, 240); pr = probe(f)
    dur = float(pr.get("format", {}).get("duration", 0) or 0)
    check("Export GIF: 13 s long, its first frame frame 0 and frames showing the bands", abs(dur - 13.0) < 0.15 and len(fr) and num_of(fr[0]) == 0 and len(band_frames(fr)) >= 3, (dur, len(fr), len(band_frames(fr))))
    f, nm = export(a, "wav"); pr = probe(f); au = pr.get("streams", [{}])[0]
    bp = beeps(pcm_of(f)); pc = pcm_of(f)
    check("Export WAV: 13.0 s, 48 kHz stereo, the beeps at 1, 5, 7.5, 9.5 s and silence in the hold (2-4 s)", abs(float(pr["format"]["duration"]) - 13.0) < 0.002 and au.get("sample_rate") == "48000" and near(bp, [1.0, 5.0, 7.5, 9.5], 0.005) and np.abs(pc[int(2.1 * 48000):int(3.9 * 48000)]).max() < 0.01, (pr["format"]["duration"], bp))
    a.goto(90)
    f, nm = export(a, "png"); fr = frames_of(f, 320, 240)
    check("Export 'This frame as PNG' at frame 90 (in the hold): a 320 x 240 PNG showing source frame 60", nm.endswith(".png") and len(fr) == 1 and num_of(fr[0]) == 60, (nm, len(fr) and num_of(fr[0])))
    # loudness normalisation
    for target in (-23, -14):
        f, nm = export(a, "wav", setup=lambda: pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Loudness')) select", str(target)))
        msg = a.msg() or ""; I, pk = ebur128(f)
        said = re.findall(r"brought to (-?[\d.]+) LUFS", msg)
        reached = abs(I - target) <= 0.5
        honest = bool(said) and abs(float(said[0]) - I) <= 0.5
        check("Export WAV normalised to %d LUFS: ffmpeg measures %d (within 0.5 LU), or the status says the level it reached and that is what ffmpeg measures" % (target, target), reached or honest, (I, msg))
        check("Export WAV normalised to %d LUFS: the true peak stays under -1 dBTP (ffmpeg's measure, within 0.2)" % target, pk is not None and pk <= -0.8, (pk, msg))
    check("exportsec: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def project(B):
    """Project Name, Save Project and Open Project (then Link Media); EDL and Final Cut Pro XML out and back in
    (titles, transitions, links, the frame hold)"""
    a = edited(B); pg = a.pg
    a.focus_tl(); a.key("Escape")
    a.goto(118); a.effect("Dip to White")
    a.focus_tl(); a.key("Escape"); a.goto(328); a.key("Control+d")
    lay0 = a.lay(); vt = [(c["start"], (c["tin"] or {}).get("type"), (c["tout"] or {}).get("type")) for c in a.clips("V1")]
    check("set-up: Dip to White into the clip after the hold, a Cross Dissolve into tock, a fade out at the end", vt == [(0, None, None), (60, None, None), (120, "dipWhite", None), (210, "crossDissolve", "crossDissolve")], vt)
    a.menu("File", "Project Name…")
    pg.locator(".vd-dialog input").first.fill("Holiday cut"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    f, nm = a.save_dl(lambda: (a.focus_tl(), pg.keyboard.press("Control+s")))
    check("File > Project Name 'Holiday cut', then Ctrl+S saves 'Holiday cut.lvproj'", nm == "Holiday cut.lvproj", nm)
    edl, enm = a.save_dl(lambda: a.menu("File", "Export EDL (CMX 3600)"))
    xml, xnm = a.save_dl(lambda: a.menu("File", "Export Final Cut Pro XML"))
    txt = open(edl).read()
    check("the EDL is CMX 3600 with a dissolve event (D 030) and names each clip", "FCM: NON-DROP FRAME" in txt and re.search(r"\sD\s+030\s", txt) and "* FROM CLIP NAME: tick.mp4" in txt, txt[:300])
    check("the EDL marks the frame hold as a freeze (an M2 line at speed 0), as editors write one", re.search(r"^M2\s+\S+\s+0+\.0", txt, re.M) is not None, [l for l in txt.splitlines() if l.startswith("M2")])
    # Open Project in a fresh page, then Link Media
    b = App(B)
    with b.pg.expect_file_chooser() as fc: b.pg.click("button:text-is('Open project…')")
    fc.value.set_files(f); b.pg.wait_for_selector(".vd-lanes", timeout=30000); b.pg.wait_for_timeout(400)
    check("Open project in a new page: the same project name and the same clips", b.A("A.p.name") == "Holiday cut" and b.lay() == lay0, (b.A("A.p.name"), b.lay() == lay0))
    check("... its media are offline and the status line says File > Link Media finds them", "Link Media" in (b.msg() or ""), b.msg())
    with b.pg.expect_file_chooser() as fc: b.menu("File", "Link Media…")
    fc.value.set_files([P("tick.mp4"), P("tock.mp4")]); b.wait_media(2); b.pg.wait_for_timeout(400)
    i = b.info(150)
    check("after Link Media the reopened project plays: frame 150 shows source frame 90 with its band, and the beeps are back", i["n"] == 90 and i["band"] > 200 and near(b.beeps(0, 11), [1.0, 5.0, 7.5, 9.5], 0.01), (i, b.beeps(0, 11)))
    b.close()
    # EDL back in, into a new sequence
    a.focus_tl(); a.key("Control+n"); pg.wait_for_selector(".vd-dialog")
    pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Frame size')) select", "custom")
    pg.fill(".vd-dialog .vd-drow:has(span:text-is('Width')) input", "320"); pg.fill(".vd-dialog .vd-drow:has(span:text-is('Height')) input", "240")
    pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(300)
    check("Ctrl+N with a custom 320 x 240 frame makes a new, empty sequence of that size and opens it", a.A("[A.seq.w, A.seq.h, S.all(A.seq).length]") == [320, 240, 0], a.A("[A.seq.name, A.seq.w, A.seq.h]"))
    with pg.expect_file_chooser() as fc: a.menu("File", "Import EDL…")
    fc.value.set_files(edl); pg.wait_for_timeout(600)
    v1 = [(c["start"], c["dur"], round(c["srcIn"], 3), c["hold"] is not None) for c in a.clips("V1")]
    check("EDL back in (a new sequence): V1 has the four pieces in place, the clips with their source in points", [x[:2] for x in v1] == [(0, 60), (60, 60), (120, 90), (210, 120)] and [v1[i][2] for i in (0, 2, 3)] == [0, 2.0, 0], v1)
    hold_ok = len(v1) > 1 and v1[1][3]
    if not hold_ok and len(v1) > 1:
        a.goto(61); n61 = a.info(61)["n"]; n110 = a.info(110)["n"]
    else: n61 = n110 = None
    check("EDL back in: the frame hold is a still of source frame 60 again", hold_ok, (v1[1] if len(v1) > 1 else None, "frames 61 and 110 show source frames", n61, n110))
    tin = [(c["start"], (c["tin"] or {}).get("type"), (c["tin"] or {}).get("dur")) for c in a.clips("V1")]
    check("EDL back in: the Cross Dissolve into tock is there, 30 frames", (210, "crossDissolve", 30) in tin, tin)
    check("EDL back in: each picture's sound on A1 at the same place", pos(a.clips("A1")) == [(0, 60), (120, 90), (210, 120)], pos(a.clips("A1")))
    # FCP XML back in
    with pg.expect_file_chooser() as fc: a.menu("File", "Import Final Cut Pro XML…")
    fc.value.set_files(xml); pg.wait_for_timeout(600)
    v1 = a.clips("V1"); ok, pr = a.synced()
    check("FCP XML back in: a new sequence with V1's four pieces and A1's three in place", pos(v1) == [(0, 60), (60, 60), (120, 90), (210, 120)] and pos(a.clips("A1")) == [(0, 60), (120, 90), (210, 120)], a.lay())
    check("FCP XML back in: each picture linked to its own sound, in step", ok and len(pr) == 3, pr)
    t = a.clips("V2")
    words = t and t[0].get("data") and [l.get("text") for l in t[0]["data"].get("layers", []) if l.get("type") == "text"]
    check("FCP XML back in: the title on V2 at 240 with its words", t and t[0]["kind"] == "title" and t[0]["start"] == 240 and words == ["Cut by review 4"], (pos(t), words))
    tr = [((c["tin"] or {}).get("type"), (c["tout"] or {}).get("type")) for c in v1]
    check("FCP XML back in: the Cross Dissolve into tock", len(tr) == 4 and tr[3][0] == "crossDissolve", tr)
    check("FCP XML back in: the Dip to White stays a Dip to White", len(tr) == 4 and tr[2][0] == "dipWhite", tr)
    check("FCP XML back in: the fade out at the end is kept", len(tr) == 4 and tr[3][1] is not None, tr)
    check("FCP XML back in: the frame hold is a still again", len(v1) > 1 and v1[1]["hold"] is not None, [(c["start"], c["hold"]) for c in v1])
    check("project: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def lit(a, sel):
    """how many pixels of a meter canvas are lit (green, yellow or red)"""
    return a.ev("""(sel) => { var c = document.querySelector(sel); if (!c) return -1; var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 0; i < d.length; i += 4) if (d[i] > 120 || d[i + 1] > 120) n++; return n; }""", sel)


@section
def views(B):
    """The meters while playing (master and each track's), the Safe Margins button and the Playback Resolution box
    following the View menu, Auto resolution, drop-frame timecode with semicolons, a phone and a laptop window"""
    a = base_two(B, extra=["music.wav"]); pg = a.pg
    a.drag_item("music.wav", "A2", 0)
    a.head_btn("A2", "Mute").click(); pg.wait_for_timeout(150)
    a.tab("Audio Track Mixer")
    ids = a.A("A.seq.a.map(function (t) { return t.id; })")
    a.goto(20); pg.locator(".vd-right .vd-view").click(); a.key(" "); pg.wait_for_timeout(1800)
    playing = a.A("A.playing")
    m_master = lit(a, "canvas[title='Master meter']")
    strips = a.ev("() => Array.prototype.map.call(document.querySelectorAll('.vd-strip'), function (s) { var c = s.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 0; i < d.length; i += 4) if (d[i] > 120 || d[i + 1] > 120) n++; return [s.querySelector('.vd-sname').textContent, n]; })")
    a.key(" "); pg.wait_for_timeout(200)
    sd = dict((x[0], x[1]) for x in strips)
    check("while playing, the master meter beside the Timeline moves", playing and m_master > 0, (playing, m_master))
    check("while playing, the Audio Track Mixer's A1 and Master meters move", sd.get("A1", 0) > 0 and sd.get("Master", 0) > 0, sd)
    check("while playing, the meter of muted A2 (music on it) stays dark, as it is not heard", sd.get("A2", 1) == 0, sd)
    check("while playing, the meter of empty A3 stays dark", sd.get("A3", 1) == 0, sd)
    a.head_btn("A2", "Mute").click(); pg.wait_for_timeout(150)
    # Safe Margins
    def safe_state():
        on = "on" in (pg.locator(".vd-right button.vd-tog:text-is('Safe')").get_attribute("class") or "")
        drawn = a.ev("() => { var c = document.querySelector('.vd-right .vd-over'); if (!c || !c.width) return 0; var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }")
        return on, drawn
    a.menu("View", "Safe Margins"); pg.wait_for_timeout(300)
    s1 = safe_state()
    check("View > Safe Margins: the Program Monitor's Safe button lights and the margins are drawn", s1[0] and s1[1] > 0, s1)
    pg.click(".vd-right button.vd-tog:text-is('Safe')"); pg.wait_for_timeout(200)
    s2 = safe_state()
    check("the Safe button then takes them away again", not s2[0] and s2[1] == 0, s2)
    # Playback Resolution
    sel = ".vd-right select[aria-label='Playback resolution']"
    check("Playback Resolution starts at Auto, and Auto shows a 320 x 240 sequence at full size", pg.input_value(sel) == "auto" and (a.shown() or {}).get("w") == 320, (pg.input_value(sel), a.shown()))
    a.menu("View", "Playback Resolution: 1/2"); a.goto(31)
    sh = a.shown()
    check("View > Playback Resolution: 1/2 draws the Program Monitor at half size (160 wide) and the right frame", sh and sh["w"] == 160, sh)
    check("... and the Program Monitor's resolution box says 1/2", pg.input_value(sel) == "0.5", pg.input_value(sel))
    a.menu("View", "Playback Resolution: Auto"); a.goto(32)
    check("View > Playback Resolution: Auto brings it back to full size for this small sequence", (a.shown() or {}).get("w") == 320 and pg.input_value(sel) == "auto", (a.shown(), pg.input_value(sel)))
    check("views: no errors in the page", not a.errs, a.errs[:3])
    a.close()
    # drop-frame timecode
    a = App(B); pg = a.pg
    a.start(["ntsc.mp4"], n_clips=2)
    st = a.A("[A.seq.rate.num, A.seq.rate.den, A.seq.drop]")
    a.goto(1800)
    tc = pg.input_value(".vd-tc"); mon = pg.inner_text(".vd-right .vd-tcl >> nth=0")
    check("a 29.97 clip makes a 29.97 sequence with drop-frame timecode", st == [30000, 1001, True], st)
    check("frame 1800 at 29.97 drop-frame reads 00;01;00;02 with semicolons, in the Timeline's box and the Program Monitor", tc == "00;01;00;02" and mon == "00;01;00;02", (tc, mon))
    box = pg.locator(".vd-tc"); box.click(); box.fill("00;10;00;00"); box.press("Enter"); pg.wait_for_timeout(150)
    check("typing 00;10;00;00 goes to frame 17982 (ten minutes of drop-frame)", a.ph() == 17982, a.ph())
    a.close()
    # a phone and a laptop window
    for vw, vh, name in ((390, 844, "phone 390 x 844"), (1366, 768, "laptop 1366 x 768")):
        a = base_two(B, viewport=(vw, vh)); pg = a.pg
        sw = a.ev("() => [document.scrollingElement.scrollWidth, window.innerWidth]")
        check("%s: no sideways scrolling of the page" % name, sw[0] <= sw[1] + 1, sw)
        mb = a.ev("() => Array.prototype.map.call(document.querySelectorAll('.vd-mbtn'), function (b) { var r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.right)]; })")
        check("%s: every menu (File to Help) is inside the window" % name, len(mb) == 9 and all(x[1] >= 0 and x[2] <= vw + 1 for x in mb), mb)
        # a trim with the mouse works here too
        a.tool("v"); a.drag_frames("V1", 180, 150, edge="tail")
        check("%s: a trim dragged on the Timeline works, picture and sound together" % name, a.clips("V1")[0]["dur"] == 150 and a.synced()[0], (a.clips("V1")[0]["dur"], a.pairs()))
        a.focus_tl(); a.key("Control+z")
        a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog")
        db = pg.locator(".vd-dialog").bounding_box(); eb = pg.locator(".vd-dialog button:text-is('Export')").bounding_box()
        pg.keyboard.press("Escape")
        check("%s: the Export box fits the window's width and its Export button can be reached" % name, db and db["x"] >= 0 and db["x"] + db["width"] <= vw + 1 and eb and eb["y"] + eb["height"] <= max(vh, db["y"] + db["height"]) + 1, (db, eb))
        a.click_at("V1", 90); a.focus_tl(); a.key("Control+r"); pg.wait_for_selector(".vd-dialog")
        db = pg.locator(".vd-dialog").bounding_box(); ok = pg.locator(".vd-dialog button:text-is('OK')").bounding_box()
        pg.keyboard.press("Escape")
        check("%s: the Speed/Duration box fits the window and its OK button is on screen" % name, db and db["x"] >= 0 and db["x"] + db["width"] <= vw + 1 and ok and ok["y"] + ok["height"] <= vh, (db, ok))
        if vw < 500:
            pr = pg.locator(".vd-right .vd-view").bounding_box(); lb = pg.locator(".vd-lanes").bounding_box()
            check("%s: the Program Monitor is at least 150 px high and the Timeline's tracks at least 200 px wide" % name, pr and pr["height"] >= 150 and lb and lb["width"] >= 200, (pr, lb))
        else:
            st = pg.locator(".vd-status").bounding_box()
            check("%s: the status line is on screen without scrolling" % name, st and st["y"] + st["height"] <= vh, st)
        check("%s: no errors in the page" % name, not a.errs, a.errs[:3])
        a.close()



@section
def more(B):
    """Keyframes through speed changes (Rate Stretch and Speed/Duration), a cut through a time-remapped clip, a ripple
    trim beside a gap, Linked Selection off, a gap whose sound runs on"""
    a = base_two(B); pg = a.pg
    s0 = a.snap()
    # Opacity and Gaussian Blur keyframes at the clip's first and last frames
    a.tool("v"); a.click_at("V1", 90); a.tab("Effect Controls")
    a.effect("Gaussian Blur"); a.tab("Effect Controls")
    a.key("Home"); a.focus_tl(); a.stopwatch("Opacity", sec="Opacity"); a.stopwatch("Blurriness", sec="Gaussian Blur")
    a.goto(179); a.set_prop("Opacity", 20, sec="Opacity"); a.set_prop("Blurriness", 40, sec="Gaussian Blur")
    kf = lambda: a.A("(function () { var c = A.seq.v[0].clips[0]; return [c.keys.opacity.map(function (k) { return k.f; }), c.fx[0].keys.amount.map(function (k) { return k.f; }), c.dur]; })()")
    k0 = kf()
    check("set-up: Opacity and Blurriness keyed at the clip's frames 0 and 179", k0[0] == [0, 179] and k0[1] == [0, 179], k0)
    a.tool("r"); a.drag_frames("V1", 180, 90, edge="tail")
    k1 = kf()
    check("Rate Stretch to half its length: the effect's keyframes move with the clip's own (Opacity's)", k1[0] == k1[1], k1)
    check("Rate Stretch to half its length: the clip's last keyframe is on its last frame, not past its end", k1[0][-1] == k1[2] - 1, k1)
    a.focus_tl(); a.key("Control+z")
    a.tool("v"); a.click_at("V1", 90)
    speed_dialog(a, pct=200, ripple=False)
    k2 = kf()
    check("Speed/Duration 200% gives the keyframes the same places as Rate Stretch to the same length", k2[2] == k1[2] and k2[0] == k1[0] and k2[1] == k1[1], (k1, k2))
    back_to(a, s0)
    # a cut through a time-remapped clip
    a.tool("v"); a.click_at("V1", 90); a.tab("Effect Controls")
    a.key("Home"); a.focus_tl(); a.stopwatch("Speed (%)", sec="Time Remapping")
    a.goto(30); a.set_prop("Speed (%)", 50, sec="Time Remapping")
    before = [a.info(f)["n"] for f in (59, 60, 61, 100, 150)]
    a.goto(60); a.key("Control+k")
    after = [a.info(f)["n"] for f in (59, 60, 61, 100, 150)]
    check("Ctrl+K through a time-remapped clip: every frame shows what it showed before the cut", before == after and len(a.clips("V1")) == 3, (before, after))
    back_to(a, s0)
    # a ripple trim of a head that sits after a gap
    a.tool("v"); a.drag_frames("V1", 180, 150, edge="tail")
    a.tool("b"); a.drag_frames("V1", 180, 200, edge="head")
    ok, pr = a.synced(); v = a.clips("V1")
    check("Ripple Edit on a head after a gap: the clip stays at 180, from its frame 20, picture and sound alike", ok and v[1]["start"] == 180 and abs(v[1]["srcIn"] - 20 / 30.0) < 1e-6 and v[1]["dur"] == 100, pr)
    back_to(a, s0)
    # Linked Selection off: a trim moves one half
    pg.click(".vd-tlbar button.vd-tog:text-is('Linked')"); pg.wait_for_timeout(150)
    a.tool("v"); a.drag_frames("V1", 180, 160, edge="tail")
    check("Linked Selection off: a trim of the picture leaves its sound as it was", a.clips("V1")[0]["dur"] == 160 and a.clips("A1")[0]["dur"] == 180, (a.clips("V1")[0]["dur"], a.clips("A1")[0]["dur"]))
    pg.click(".vd-tlbar button.vd-tog:text-is('Linked')"); pg.wait_for_timeout(150)
    back_to(a, s0)
    # a gap on V1 whose sound runs on under it
    pg.click(".vd-tlbar button.vd-tog:text-is('Linked')"); pg.wait_for_timeout(150)
    a.click_at("V1", 240); a.focus_tl(); a.key("Delete")
    pg.click(".vd-tlbar button.vd-tog:text-is('Linked')"); pg.wait_for_timeout(150)
    a.drag_item("tick.mp4", "V1", 300)
    a.click_at("V1", 240); a.focus_tl(); a.key("Delete")
    check("Delete on a picture gap with sound under it on sync-locked A1 closes nothing and says A1 has clips in it", [c["start"] for c in a.clips("V1")] == [0, 300] and "A1" in (a.msg() or ""), (a.lay(), a.msg()))
    check("more: no errors in the page", not a.errs, a.errs[:3])
    a.close()


def main():
    if not FF:
        print("SKIP  ffmpeg not here"); return 0
    make_media()
    with sync_playwright() as pw:
        B = pw.chromium.launch()
        for fn in SECTIONS:
            if ONLY and fn.__name__ not in ONLY: continue
            t0 = time.time()
            try:
                fn(B)
            except Exception as e:
                check(fn.__name__ + ": the section ran to its end", False, "".join(traceback.format_exception_only(type(e), e)).strip()[:400])
            print("--- section %s: %.0f s" % (fn.__name__, time.time() - t0), flush=True)
        B.close()
    n = len(RESULTS); m = sum(1 for r in RESULTS if not r[1])
    print("%d checks, %d failed" % (n, m))
    shutil.rmtree(OUT, ignore_errors=True)
    return 1 if m else 0


if __name__ == "__main__":
    sys.exit(main())
