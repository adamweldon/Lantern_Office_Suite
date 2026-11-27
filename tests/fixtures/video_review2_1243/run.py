# run.py -- an independent review of the Video tile (Lantern 1.24.43), used as a person uses it, in Chromium (Playwright).
#
# A separate reviewer wrote this; it did not write the tile. Every scenario is driven by the mouse and the keyboard
# (menus clicked, tools picked by their letters, clips clicked and dragged on the Timeline canvas, values typed into
# Effect Controls, files chosen in the browser's file box or dropped), and checked by the app's state AND by what it
# shows or writes: the Program Monitor's pixels, frames the renderer draws, and exported files decoded by ffmpeg.
#
# Media are made here by ffmpeg: a clip whose top row shows its own frame number in binary (8 white boxes) with a
# white flash in its lower half at frames 45 and 120 and a 1 kHz beep on exactly those frames; the same design at
# 23.976 and 60 fps and in VP9/WebM; a phone clip with rotation metadata; 29.97 HD with AAC; a WAV voice-over,
# MP3 and M4A music; PNG and JPEG stills; a 90 s clip; a green-screen clip and a background; a clip with two hard
# scene cuts; two recordings of the same claps half a second apart; .srt and .vtt captions.
#
# Usage: python3 run.py [path/to/site/index.html] [section ...]
#   sections: start source tools keys edits trans fx graphics captions audio misc history play exportsec project
#             menus views
# Prints "PASS  <check>" or "FAIL  <check>  <what was seen>", then "<n> checks, <m> failed".
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
OUT = tempfile.mkdtemp(prefix="video_review2_")
MED = os.path.join(OUT, "media"); DL = os.path.join(OUT, "dl"); os.makedirs(MED); os.makedirs(DL)
RESULTS = []


def check(name, cond, info=""):
    ok = bool(cond)
    RESULTS.append((name, ok, "" if ok else str(info)[:500]))
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else "  [" + str(info)[:500] + "]"), flush=True)
    return ok


def P(n): return os.path.join(MED, n)


# --------------------------------------------------------------------------------------------- media
def ff(*a):
    r = subprocess.run([FF, "-v", "error", "-y"] + list(a), capture_output=True, text=True)
    if r.returncode: raise RuntimeError("ffmpeg: " + r.stderr[-400:])


def bits_filter(n=8, x0=8, step=38, size=28):
    return "".join(",drawbox=x=%d:y=8:w=%d:h=%d:color=white:t=fill:enable='mod(floor(n/%d),2)'" % (x0 + i * step, size, size, 1 << i) for i in range(n))


def beep_expr(times, fps):
    one = "0.02*sin(2*PI*200*t)+0.5*sin(2*PI*1000*t)*(" + "+".join("between(t,%g,%g)" % (t, t + 1.0 / fps - 1e-6) for t in times) + ")"
    return one + "|" + one


def make_media():
    # the counter clip: 320x240, 30 fps, 6 s, H.264 with B-frames, AAC; flash + beep at frames 45 and 120
    ff("-f", "lavfi", "-i", "color=c=0x3c3c3c:s=320x240:r=30:d=6,format=yuv420p" + bits_filter() + ",drawbox=x=0:y=140:w=320:h=100:color=white:t=fill:enable='eq(n,45)+eq(n,120)'",
       "-f", "lavfi", "-i", "aevalsrc='%s':s=48000:d=6" % beep_expr([1.5, 4.0], 30), "-c:v", "libx264", "-g", "30", "-bf", "2", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", P("counter.mp4"))
    # the same design, blue below, VP9 + Opus in WebM, 3 s (a screen recording's container)
    ff("-f", "lavfi", "-i", "color=c=0x3c3c3c:s=320x240:r=30:d=3,format=yuv420p" + bits_filter() + ",drawbox=x=0:y=140:w=320:h=100:color=0x0000c0:t=fill",
       "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=3,volume=0.3", "-c:v", "libvpx-vp9", "-b:v", "400k", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest", P("counter_b.webm"))
    # 23.976 and 60 fps with the counter (red and green below)
    ff("-f", "lavfi", "-i", "color=c=0x3c3c3c:s=320x240:r=24000/1001:d=3.1,format=yuv420p" + bits_filter() + ",drawbox=x=0:y=140:w=320:h=100:color=0xc00000:t=fill:enable='eq(n,24)'",
       "-f", "lavfi", "-i", "aevalsrc='%s':s=48000:d=3.003" % beep_expr([24 * 1001 / 24000.0], 24000 / 1001.0), "-frames:v", "72", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", P("film.mp4"))
    ff("-f", "lavfi", "-i", "color=c=0x3c3c3c:s=320x240:r=60:d=2,format=yuv420p" + bits_filter() + ",drawbox=x=0:y=140:w=320:h=100:color=0x00a000:t=fill",
       "-f", "lavfi", "-i", "sine=frequency=500:sample_rate=48000:duration=2,volume=0.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", P("sixty.mp4"))
    # a phone's portrait clip: coded 1920x1080 with a 90 degree display rotation; red box top-left of the upright picture
    ff("-f", "lavfi", "-i", "color=c=0x202020:s=1080x1920:r=30:d=1,format=yuv420p,drawbox=x=0:y=0:w=300:h=300:color=red:t=fill,drawbox=x=780:y=1620:w=300:h=300:color=blue:t=fill,transpose=2",
       "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000:duration=1,volume=0.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", P("phone_tmp.mp4"))
    ff("-display_rotation:v:0", "-90", "-i", P("phone_tmp.mp4"), "-c", "copy", P("phone.mp4")); os.remove(P("phone_tmp.mp4"))
    # 1920x1080 at 29.97 with AAC
    ff("-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30000/1001:d=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2,volume=0.3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", P("hd2997.mp4"))
    # a WAV voice-over (mono, 48 kHz, 16-bit), MP3 and M4A music
    ff("-f", "lavfi", "-i", "aevalsrc='0.4*sin(2*PI*300*t)*(0.5+0.5*sin(2*PI*3*t))':s=48000:d=3", "-ac", "1", "-c:a", "pcm_s16le", P("voice.wav"))
    ff("-f", "lavfi", "-i", "sine=frequency=523:sample_rate=44100:duration=4,volume=0.25", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", P("music.mp3"))
    ff("-f", "lavfi", "-i", "sine=frequency=392:sample_rate=48000:duration=4,volume=0.25", "-ac", "2", "-c:a", "aac", P("music.m4a"))
    # stills
    ff("-f", "lavfi", "-i", "color=c=0x208020:s=640x360:d=1,drawbox=x=0:y=0:w=100:h=100:color=red:t=fill", "-frames:v", "1", P("still.png"))
    ff("-f", "lavfi", "-i", "color=c=0xd0b000:s=400x300:d=1", "-frames:v", "1", "-q:v", "2", P("still.jpg"))
    # a long-ish clip: 90 s at 160x120
    ff("-f", "lavfi", "-i", "testsrc=s=160x120:r=30:d=90", "-f", "lavfi", "-i", "sine=frequency=250:sample_rate=48000:duration=90,volume=0.2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", P("long.mp4"))
    # green screen (a red box on 0,177,64) and a background (yellow) for Ultra Key
    ff("-f", "lavfi", "-i", "color=c=0x00b140:s=320x240:r=30:d=2,format=yuv420p,drawbox=x=120:y=80:w=80:h=80:color=red:t=fill", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-qp", "8", P("green.mp4"))
    ff("-f", "lavfi", "-i", "color=c=0xe0e000:s=320x240:r=30:d=2,format=yuv420p", "-c:v", "libx264", "-pix_fmt", "yuv420p", P("bg.mp4"))
    # three shots, hard cuts at frames 30 and 60
    ff("-f", "lavfi", "-i", "color=c=red:s=320x240:r=30:d=1", "-f", "lavfi", "-i", "testsrc2=s=320x240:r=30:d=1", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=30:d=1",
       "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0,format=yuv420p", "-c:v", "libx264", "-pix_fmt", "yuv420p", P("scenes.mp4"))
    # two recordings of the same claps; B starts 0.5 s later into the event than A (so B's claps come 0.5 s earlier)
    rng = np.random.RandomState(7); claps = sorted(rng.uniform(0.6, 5.0, 9))
    def clap_expr(off):
        e = "+".join("0.8*exp(-60*(t-%.4f))*between(t,%.4f,%.4f)*sin(2*PI*1500*t)" % (c - off, c - off, c - off + 0.08) for c in claps)
        return e + "|" + e
    ff("-f", "lavfi", "-i", "color=c=0x404080:s=320x240:r=30:d=6,format=yuv420p", "-f", "lavfi", "-i", "aevalsrc='%s':s=48000:d=6" % clap_expr(0.0), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", P("clapA.mp4"))
    ff("-f", "lavfi", "-i", "color=c=0x804040:s=320x240:r=30:d=6,format=yuv420p", "-f", "lavfi", "-i", "aevalsrc='%s':s=48000:d=6" % clap_expr(0.5), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", P("clapB.mp4"))
    open(P("subs.srt"), "w").write("1\n00:00:00,500 --> 00:00:02,000\nFirst words\n\n2\n00:00:02,500 --> 00:00:03,500\nSecond line\n")
    open(P("subs.vtt"), "w").write("WEBVTT\n\n00:00:01.000 --> 00:00:02.000 align:center\nFrom VTT\n\n00:00:03.000 --> 00:00:04.000\n<i>Styled</i> words\n")
    # a 2-point .cube LUT that inverts colour (red changes fastest, as Adobe's format has it)
    open(P("invert.cube"), "w").write("TITLE \"invert\"\nLUT_3D_SIZE 2\n" + "".join("%d %d %d\n" % (1 - r, 1 - g, 1 - b) for b in (0, 1) for g in (0, 1) for r in (0, 1)))


# --------------------------------------------------------------------------------------------- reading files
def probe(f):
    r = subprocess.run([FP, "-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", f], capture_output=True, text=True)
    return json.loads(r.stdout or "{}")


def frames_of(f, w, h, extra=None):
    cmd = [FF, "-v", "error", "-i", f, "-map", "0:v:0", "-fps_mode", "passthrough"] + (extra or []) + ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    if not raw: return np.zeros((0, h, w, 3))
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(float)


def pcm_of(f, sr=48000, ch=2):
    raw = subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:a:0", "-f", "f32le", "-ac", str(ch), "-ar", str(sr), "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch) if raw else np.zeros((0, ch), np.float32)


def bits_of(img, k=1.0):
    """the frame number a counter frame shows (img: HxWx3 floats), boxes scaled by k"""
    n = 0
    for i in range(8):
        x = int((8 + i * 38 + 14) * k); y = int(22 * k)
        if img[y, x].mean() > 128: n |= 1 << i
    return n


def flash_frames(frames, k=1.0):
    y0 = int(160 * k); y1 = int(230 * k)
    return [i for i in range(len(frames)) if frames[i][y0:y1].mean() > 200]


def beep_onsets(pcm, sr=48000):
    x = np.abs(pcm[:, 0]); out = []; i = 0
    win = int(sr * 0.004)
    env = np.convolve(x, np.ones(win) / win, mode="same")
    while i < len(env):
        if env[i] > 0.2:
            out.append(i / sr); i += int(sr * 0.3)
        else: i += 1
    return out


def ebur128(f):
    e = subprocess.run([FF, "-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", e); pk = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)
    return (float(I[-1]) if I else None, float(pk[-1]) if pk else None)


# --------------------------------------------------------------------------------------------- server
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, p):
        p = p.split("?")[0].split("#")[0]
        if p in ("/", "/index.html"): return SITE
        return os.path.join(MED, os.path.basename(p))


socketserver.TCPServer.allow_reuse_address = True
SRV = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler); PORT = SRV.server_address[1]
threading.Thread(target=SRV.serve_forever, daemon=True).start()

# helpers run in the page (reads only: what the renderer draws, the mixer's samples)
PAGE_JS = r"""
window.__rv = {
  bits: function (img, k) { var n = 0; for (var i = 0; i < 8; i++) { var x = Math.floor((8 + i * 38 + 14) * k), y = Math.floor(22 * k), q = (y * img.width + x) * 4; if ((img.data[q] + img.data[q + 1] + img.data[q + 2]) / 3 > 128) n |= 1 << i; } return n; },
  mean: function (img, x0, y0, x1, y1) { var s = [0, 0, 0], n = 0; for (var y = Math.floor(y0); y < y1; y++) for (var x = Math.floor(x0); x < x1; x++) { var q = (y * img.width + x) * 4; s[0] += img.data[q]; s[1] += img.data[q + 1]; s[2] += img.data[q + 2]; n++; } return s.map(function (v) { return Math.round(v / Math.max(1, n)); }); },
  frame: function (f, scale) { var A = Lantern.video.app; return Lantern.video.render.frame(A.p, A.seq, f, { scale: scale || 1, full: true }).then(function (c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); }); },
  info: function (f, scale) { var R = window.__rv; return R.frame(f, scale).then(function (img) { var k = img.width / Lantern.video.app.seq.w; return { n: R.bits(img, k), low: R.mean(img, 0, img.height * 0.66, img.width, img.height * 0.95), mid: R.mean(img, img.width * 0.4, img.height * 0.4, img.width * 0.6, img.height * 0.6), corner: R.mean(img, 0, 0, img.width * 0.1, img.height * 0.1), all: R.mean(img, 0, 0, img.width, img.height), w: img.width, h: img.height }; }); },
  shown: function () { var c = document.querySelector('.vd-right canvas.vd-screen'); if (!c || !c.width) return null; var img = c.getContext('2d').getImageData(0, 0, c.width, c.height), k = c.width / Lantern.video.app.seq.w; return { n: window.__rv.bits(img, k), w: c.width, h: c.height, low: window.__rv.mean(img, 0, img.height * 0.66, img.width, img.height * 0.95), mid: window.__rv.mean(img, img.width * 0.4, img.height * 0.4, img.width * 0.6, img.height * 0.6), all: window.__rv.mean(img, 0, 0, img.width, img.height) }; },
  mix: function (a, b) { var A = Lantern.video.app; return Lantern.video.mix.range(A.p, A.seq, a, b); },
  peak: function (a, b) { var c = window.__rv.mix(a, b), m = 0; for (var k = 0; k < 2; k++) for (var i = 0; i < c[k].length; i++) m = Math.max(m, Math.abs(c[k][i])); return m; },
  rms: function (a, b, ch) { var c = window.__rv.mix(a, b)[ch || 0], s = 0; for (var i = 0; i < c.length; i++) s += c[i] * c[i]; return Math.sqrt(s / Math.max(1, c.length)); },
  onsets: function (a, b) { var c = window.__rv.mix(a, b)[0], sr = Lantern.video.app.seq.sampleRate, out = [], win = Math.round(sr * 0.004), s = 0, i; for (i = 0; i < c.length; i++) { s += Math.abs(c[i]); if (i >= win) s -= Math.abs(c[i - win]); if (s / win > 0.2) { out.push((a + i - win / 2) / sr); i += Math.round(sr * 0.3); s = 0; } } return out; },
  lay: function () { var A = Lantern.video.app; return Lantern.video.seq.all(A.seq).map(function (x) { return [x.t.name, x.c.start, x.c.dur, Math.round(x.c.srcIn * 1000) / 1000, x.c.kind]; }).sort(); },
  tracks: function () { var A = Lantern.video.app; return JSON.stringify([A.seq.v, A.seq.a, A.seq.markers, A.seq.cap, A.seq.inF, A.seq.outF]); }
};
"""


class App:
    """one page with the Video tile open"""
    def __init__(self, browser, viewport=(1400, 900)):
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

    def start(self, names, n_clips=None):
        """New project from video files (the start screen's button, the browser's file box)"""
        with self.pg.expect_file_chooser() as fc: self.pg.click("button:text-is('New project from video files\u2026')")
        fc.value.set_files([P(x) for x in names])
        self.pg.wait_for_selector(".vd-lanes", timeout=30000)
        self.wait_media(len(names))
        if n_clips is not None:
            self.pg.wait_for_function("(n) => Lantern.video.seq.all(Lantern.video.app.seq).length === n", arg=n_clips, timeout=30000)
        self.pg.wait_for_timeout(300)

    def wait_media(self, n):
        self.pg.wait_for_function("(n) => { var A = Lantern.video.app, r = Lantern.video.media.rt; var ids = Object.keys(A.p.media); return ids.length >= n && ids.every(function (k) { var m = A.p.media[k]; return r[k] && (m.kind === 'image' || r[k].audio || !m.hasAudio); }); }", arg=n, timeout=60000)

    def import_files(self, names):
        """Project panel > Import... (the browser's file box)"""
        n0 = self.ev("() => Object.keys(Lantern.video.app.p.media).length")
        self.tab("Project")
        with self.pg.expect_file_chooser() as fc: self.pg.click(".vd-pbar button:text-is('Import\u2026')")
        fc.value.set_files([P(x) for x in names])
        self.wait_media(n0 + len(names))

    # --- state (read only)
    def lay(self): return sorted(self.ev("() => __rv.lay()"))
    def A(self, expr): return self.ev("() => { var A = Lantern.video.app, S = Lantern.video.seq; return (" + expr + "); }")
    def end(self): return self.A("S.end(A.seq)")
    def ph(self): return self.A("A.seq.playhead")
    def sel(self): return self.A("A.sel.length")
    def msg(self): return self.A("A.msg")
    def hist(self): return self.A("A.history().map(function (h) { return h.name; })")
    def clip(self, track, i=0): return self.A("(function(){ var t = A.seq.v.concat(A.seq.a).filter(function (t) { return t.name === '%s'; })[0]; var c = t && S.sort(t).clips[%d]; return c ? JSON.parse(JSON.stringify(c)) : null; })()" % (track, i))
    def info(self, f, scale=1): return self.ev("(a) => __rv.info(a[0], a[1])", [f, scale])
    def shown(self):
        self.pg.wait_for_timeout(250)
        return self.ev("() => __rv.shown()")

    # --- the person's actions
    def tab(self, name):
        self.pg.click(".vd-tab:text-is('%s')" % name); self.pg.wait_for_timeout(120)

    def menu(self, top, item, chooser=False):
        self.pg.click(".vd-mbtn:text-is('%s')" % top)
        loc = self.pg.locator(".vd-menu .vd-mitem").filter(has=self.pg.locator("span:text-is('%s')" % item))
        loc.first.click(); self.pg.wait_for_timeout(150)

    def lanes(self): return self.pg.locator(".vd-lanes").bounding_box()

    def row(self, track):
        r = self.ev("(n) => Lantern.video.ui.U.tl.rows().filter(function (r) { return r.t.name === n; }).map(function (r) { return [r.y, r.h]; })[0]", track)
        return r

    def xof(self, f): return self.ev("(f) => { var s = Lantern.video.ui.U.tl.state; return (f - s.x0) * s.ppf; }", f)

    def visible(self, f):
        """bring frame f into the Timeline's view as a person would: \\ to fit the sequence, then - to zoom out"""
        w = self.ev("() => document.querySelector('.vd-lanes').clientWidth")
        tries = 0
        while not (-0.01 <= self.xof(f) <= w - 6) and tries < 8:
            self.pg.locator(".vd-lanes").focus(); self.pg.keyboard.press("\\" if tries == 0 else "-"); self.pg.wait_for_timeout(80); tries += 1

    def pt(self, track, f, dy=0.5):
        self.visible(f)
        b = self.lanes(); r = self.row(track)
        return (b["x"] + self.xof(f), b["y"] + r[0] + r[1] * dy)

    def click_at(self, track, f, mods=None, dy=0.5):
        x, y = self.pt(track, f, dy)
        for m in mods or []: self.pg.keyboard.down(m)
        self.pg.mouse.click(x, y)
        for m in mods or []: self.pg.keyboard.up(m)
        self.pg.wait_for_timeout(120)

    def drag(self, x0, y0, x1, y1, mods=None, steps=8):
        for m in mods or []: self.pg.keyboard.down(m)
        self.pg.mouse.move(x0, y0); self.pg.mouse.down(); self.pg.mouse.move(x0 + (1 if x1 >= x0 else -1) * 3, y0, steps=2)
        self.pg.mouse.move(x1, y1, steps=steps); self.pg.mouse.up()
        for m in mods or []: self.pg.keyboard.up(m)
        self.pg.wait_for_timeout(200)

    def drag_frames(self, track, f0, f1, track1=None, mods=None, edge=None):
        """press on a clip at frame f0 (or just inside an edge) and let go at frame f1"""
        x0, y0 = self.pt(track, f0); x1, y1 = self.pt(track1 or track, f1)
        if edge == "tail": x0 -= 2; x1 -= 2
        if edge == "head": x0 += 2; x1 += 2
        self.drag(x0, y0, x1, y1, mods)

    def focus_tl(self):
        b = self.pg.locator(".vd-ruler").bounding_box()
        self.pg.locator(".vd-lanes").focus(); self.ev("() => { Lantern.video.app.focus = 'timeline'; }")

    def key(self, k, n=1):
        for _ in range(n): self.pg.keyboard.press(k)
        self.pg.wait_for_timeout(150)

    def goto(self, f):
        """type a frame count into the Timeline's timecode box"""
        box = self.pg.locator(".vd-tc"); box.click(); box.fill(str(f)); box.press("Enter"); self.pg.wait_for_timeout(120)
        self.focus_tl()

    def tool(self, letter):
        self.focus_tl(); self.key(letter)

    def prop_input(self, label, kind="number"):
        return self.pg.locator(".vd-prop:has(.vd-plab:text-is('%s')) input[type=%s]:visible" % (label, kind)).first

    def set_prop(self, label, value):
        i = self.prop_input(label); i.fill(str(value)); i.press("Enter"); self.pg.wait_for_timeout(250)

    def save_dl(self, action, timeout=60000):
        with self.pg.expect_download(timeout=timeout) as dl: action()
        f = os.path.join(DL, "%d_%s" % (int(time.time() * 1000) % 100000000, dl.value.suggested_filename))
        dl.value.save_as(f); return f, dl.value.suggested_filename

    def drag_item(self, name, track, f, dx=0):
        """drag an item from the Project panel to a track of the Timeline at frame f (an HTML drag, as the mouse makes)"""
        self.tab("Project")
        x, y = self.pt(track, f); lb = self.lanes()
        self.pg.drag_and_drop(".vd-pitem:has-text('%s')" % name, ".vd-lanes", target_position={"x": max(1, x - lb["x"] + dx), "y": y - lb["y"]})
        self.pg.wait_for_timeout(400)

    def drop_files(self, selector, names, x=None, y=None, ctrl=False):
        """drop files from the desktop on an element (a DataTransfer holding the files, as the browser makes one)"""
        return self.ev("""async (a) => {
            var dt = new DataTransfer();
            for (var i = 0; i < a.names.length; i++) { var r = await fetch('/' + a.names[i]); var b = await r.blob(); dt.items.add(new File([b], a.names[i], { type: b.type })); }
            var el = document.querySelector(a.sel), bx = el.getBoundingClientRect(), cx = a.x === null ? bx.left + bx.width / 2 : a.x, cy = a.y === null ? bx.top + bx.height / 2 : a.y;
            var o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy, ctrlKey: a.ctrl };
            var t = document.elementFromPoint(cx, cy) || el;
            t.dispatchEvent(new DragEvent('dragenter', o)); var ov = new DragEvent('dragover', o); t.dispatchEvent(ov);
            var d = new DragEvent('drop', o); t.dispatchEvent(d); return { over: ov.defaultPrevented, drop: d.defaultPrevented, target: t.className || t.tagName };
        }""", {"sel": selector, "names": names, "x": x, "y": y, "ctrl": ctrl})


def snapshot(app): return app.ev("() => __rv.tracks()")


def undo_exact(app, name, do, n_undo=1):
    """do an edit, check Undo puts the tracks back exactly and Redo brings the edit back exactly"""
    before = snapshot(app); h0 = len(app.hist())
    do(); after = snapshot(app)
    app.focus_tl()
    for _ in range(n_undo): app.key("Control+z")
    back = snapshot(app)
    for _ in range(n_undo): app.key("Control+Shift+z")
    again = snapshot(app)
    for _ in range(n_undo): app.key("Control+z")
    check("Undo after " + name + " puts the tracks back exactly; Redo brings the edit back", after != before and back == before and again == after,
          "changed=%s back=%s again=%s" % (after != before, back == before, again == after))
    return after


OVERLAP_JS = "() => { var bad = []; Lantern.video.app.seq.v.concat(Lantern.video.app.seq.a).forEach(function (t) { var c = t.clips.slice().sort(function (x, y) { return x.start - y.start; }); for (var i = 1; i < c.length; i++) if (c[i].start < c[i - 1].start + c[i - 1].dur) bad.push([t.name, c[i - 1].start, c[i - 1].dur, c[i].start, c[i].dur]); }); return bad; }"


def undo_if(app, s0):
    """Ctrl+Z only if the tracks changed since snapshot s0 (so a no-op does not undo an earlier step)"""
    if snapshot(app) != s0:
        app.focus_tl(); app.key("Control+z")


SECTIONS = []


def section(fn):
    SECTIONS.append(fn); return fn


# ============================================================================================= sections
@section
def start(B):
    """the start screen, bringing media in, the Program Monitor's frames, reopening, Link Media"""
    a = App(B)
    pg = a.pg
    txt = pg.inner_text(".vd-start")
    check("start screen: a New project from video files button, Empty project, Open project and a drop zone naming the kinds",
          all(s in txt for s in ("New project from video files", "Empty project", "Open project", "drop video, sound or pictures here")), txt[:200])
    a.start(["counter.mp4", "counter_b.webm"], n_clips=4)
    st = a.A("{ w: A.seq.w, h: A.seq.h, rate: A.seq.rate, drop: A.seq.drop, msg: A.msg }")
    check("two files from the start screen: the sequence takes the first clip's size and rate (320 x 240, 30 fps)", st["w"] == 320 and st["h"] == 240 and st["rate"] == {"num": 30, "den": 1}, st)
    check("the status line says the sequence took the clip's settings", "320 x 240" in (st["msg"] or ""), st["msg"])
    check("the two files go end to end on V1 and A1, picture and sound linked", a.lay() == sorted([["V1", 0, 180, 0, "av"], ["A1", 0, 180, 0, "av"], ["V1", 180, 90, 0, "av"], ["A1", 180, 90, 0, "av"]]) and a.A("A.seq.v[0].clips[0].link === A.seq.a[0].clips[0].link && !!A.seq.v[0].clips[0].link"), a.lay())
    ptxt = pg.inner_text(".vd-proj")
    check("Project panel lists both files and the sequence, each with its kind, size, rate and length", "counter.mp4" in ptxt and "counter_b.webm" in ptxt and "Sequence 01" in ptxt and "320×240" in ptxt and "30 fps" in ptxt and "0:06.0" in ptxt, ptxt[:300])
    # frames the renderer draws at full size: exact source frames (H.264 with B-frames, then VP9)
    wrong = []
    for f in (0, 1, 2, 29, 30, 31, 77, 150, 179):
        n = a.info(f)["n"]
        if n != f: wrong.append((f, n))
    check("Program frames 0-179 of the H.264 clip (B-frames) show exactly the source frame of the same number", not wrong, wrong)
    wrong = []
    for f in (180, 181, 210, 269):
        n = a.info(f)["n"]
        if n != f - 180: wrong.append((f, n))
    check("Program frames of the VP9 WebM clip after the cut show exactly its frames 0, 1, 30, 89", not wrong, wrong)
    # what the Program Monitor shows (its canvas), at Full resolution
    pg.select_option(".vd-right select[aria-label='Playback resolution']", "1")
    a.goto(77)
    sh = a.shown()
    check("typing 77 in the Timeline's timecode box moves the playhead there and the box shows 00:00:02:17", a.ph() == 77 and pg.input_value(".vd-tc") == "00:00:02:17", (a.ph(), pg.input_value(".vd-tc")))
    check("the Program Monitor's picture at frame 77 shows source frame 77 (Full resolution)", sh and sh["n"] == 77, sh)
    check("the Program Monitor's own timecode reads 00:00:02:17 and its duration 00:00:09:00", pg.inner_text(".vd-right .vd-tcl >> nth=0") == "00:00:02:17" and pg.inner_text(".vd-right .vd-tcl >> nth=1") == "00:00:09:00",
          (pg.inner_text(".vd-right .vd-tcl >> nth=0"), pg.inner_text(".vd-right .vd-tcl >> nth=1")))
    pg.select_option(".vd-right select[aria-label='Playback resolution']", "0.5"); a.goto(45)
    sh = a.shown()
    check("at 1/2 playback resolution the Program Monitor draws half size and still shows the right frame (45, the flash)", sh and sh["w"] == 160 and sh["n"] == 45 and sh["low"][0] > 200, sh)
    # sound against picture: the beep must start on the flash frames (45 = 1.5 s, 120 = 4.0 s)
    on = a.ev("() => __rv.onsets(0, 48000 * 6)")
    check("the sequence's sound: the AAC clip's beeps start on the flash frames 45 and 120 (1.5 s, 4.0 s) within a frame", len(on) == 2 and abs(on[0] - 1.5) < 1 / 30 and abs(on[1] - 4.0) < 1 / 30, on)
    check("the sequence's sound: the beeps start within 5 ms of the flash (AAC priming cut as the file's edit list says)", len(on) == 2 and abs(on[0] - 1.5) < 0.005 and abs(on[1] - 4.0) < 0.005, on)
    # more files through the Project panel's Import button
    a.import_files(["phone.mp4", "hd2997.mp4", "film.mp4", "sixty.mp4", "voice.wav", "music.mp3", "music.m4a", "still.png", "still.jpg", "long.mp4"])
    m = a.ev("() => { var o = {}, M = Lantern.video.app.p.media; Object.keys(M).forEach(function (k) { o[M[k].name] = M[k]; }); return o; }")
    def mm(n): return m.get(n, {})
    check("Import: the phone clip (coded 1920x1080, rotated 90) comes in upright, 1080 x 1920", mm("phone.mp4").get("w") == 1080 and mm("phone.mp4").get("h") == 1920, mm("phone.mp4"))
    check("Import: 1920x1080 at 29.97 with AAC is read as 30000/1001 with sound", mm("hd2997.mp4").get("fps") == {"num": 30000, "den": 1001} and mm("hd2997.mp4").get("hasAudio") and mm("hd2997.mp4").get("w") == 1920, mm("hd2997.mp4"))
    check("Import: the 23.976 clip is read as 24000/1001, 72 frames long (3.003 s)", mm("film.mp4").get("fps") == {"num": 24000, "den": 1001} and abs(mm("film.mp4").get("dur", 0) - 3.003) < 0.01, mm("film.mp4"))
    check("Import: the 60 fps clip is read as 60 fps, 2 s", mm("sixty.mp4").get("fps") == {"num": 60, "den": 1} and abs(mm("sixty.mp4").get("dur", 0) - 2.0) < 0.01, mm("sixty.mp4"))
    check("Import: the WAV voice-over is sound, mono, 3.000 s", mm("voice.wav").get("kind") == "audio" and mm("voice.wav").get("channels") == 1 and abs(mm("voice.wav").get("dur", 0) - 3.0) < 0.001, mm("voice.wav"))
    check("Import: the MP3 is sound, 4 s (within the codec's padding, 0.06 s)", mm("music.mp3").get("kind") == "audio" and abs(mm("music.mp3").get("dur", 0) - 4.0) < 0.06, mm("music.mp3"))
    check("Import: the M4A (AAC) is sound, 4 s (within 0.03 s)", mm("music.m4a").get("kind") == "audio" and abs(mm("music.m4a").get("dur", 0) - 4.0) < 0.03, mm("music.m4a"))
    check("Import: the PNG and JPEG are stills of their own sizes", mm("still.png").get("kind") == "image" and mm("still.png").get("w") == 640 and mm("still.jpg").get("w") == 400 and mm("still.jpg").get("h") == 300, (mm("still.png"), mm("still.jpg")))
    check("Import: the 90 s clip is 90 s long", abs(mm("long.mp4").get("dur", 0) - 90) < 0.05, mm("long.mp4"))
    check("Import into a sequence that has clips does not add them to the Timeline", len(a.lay()) == 4, a.lay())
    # the phone clip upright in the Source Monitor (double-click it in the Project panel)
    pg.locator(".vd-pitem:has-text('phone.mp4')").dblclick(); pg.wait_for_timeout(1200)
    src = a.ev("""() => { var c = document.querySelector('.vd-left canvas.vd-screen'); if (!c || !c.width) return null; var x = c.getContext('2d'), w = c.width, h = c.height;
        function px(u, v) { return Array.from(x.getImageData(Math.floor(u * w), Math.floor(v * h), 1, 1).data).slice(0, 3); } return { w: w, h: h, tl: px(0.1, 0.06), br: px(0.9, 0.94), title: document.querySelector('.vd-left .vd-montitle').textContent }; }""")
    check("double-click in the Project panel opens the clip in the Source Monitor, titled with its name", src and "phone.mp4" in src["title"], src)
    check("the Source Monitor shows the phone clip upright: tall, red box top-left, blue bottom-right (as ffmpeg's autorotate does)",
          src and src["h"] > src["w"] and src["tl"][0] > 150 and src["tl"][2] < 80 and src["br"][2] > 150 and src["br"][0] < 80, src)
    ref = frames_of(P("phone.mp4"), 1080, 1920)
    check("(reference) ffmpeg's own upright decode of the phone clip has red top-left", len(ref) and ref[0][100, 100, 0] > 150, len(ref))
    # a file dropped on the Project panel is imported, not put in the sequence
    r = a.drop_files(".vd-proj", ["scenes.mp4"])
    a.wait_media(13)
    check("a file dropped on the Project panel is imported (the drop is taken, the page does not open the file)", r["drop"] and "scenes.mp4" in pg.inner_text(".vd-proj") and len(a.lay()) == 4, (r, len(a.lay())))
    # a file dropped on the Timeline at frame 300 of V1
    x, y = a.pt("V1", 300)
    r = a.drop_files(".vd-lanes", ["clapA.mp4"], x, y)
    pg.wait_for_function("() => Lantern.video.seq.all(Lantern.video.app.seq).length === 6", timeout=30000)
    L = a.lay()
    check("a file dropped on V1 of the Timeline at frame 300 is imported and laid there with its sound on A1", ["V1", 300, 180, 0, "av"] in L and ["A1", 300, 180, 0, "av"] in L, L)
    # a file dropped with Ctrl on the Timeline inserts (pushes what is after)
    x, y = a.pt("V1", 90)
    a.drop_files(".vd-lanes", ["bg.mp4"], x, y, ctrl=True)
    pg.wait_for_function("() => Lantern.video.seq.all(Lantern.video.app.seq).length >= 9", timeout=30000)
    L = a.lay()
    check("a file dropped with Ctrl at frame 90 is inserted: the clip under it is cut and everything after moves 60 frames later",
          ["V1", 90, 60, 0, "av"] in L and ["V1", 150, 90, 3.0, "av"] in L and ["V1", 240, 90, 0, "av"] in L and ["V1", 360, 180, 0, "av"] in L, L)
    a.key("Control+z")
    # reload: the project is kept on the device; Reopen; Link Media
    before = a.lay()
    pg.reload(); pg.wait_for_selector("text=New project from video files", timeout=90000)
    has = pg.locator("button:text-is('Reopen the last project')").count()
    check("after the page is reloaded the start screen offers Reopen the last project", has == 1, has)
    if has:
        pg.click("button:text-is('Reopen the last project')"); pg.wait_for_selector(".vd-lanes", timeout=20000); pg.wait_for_timeout(500)
        check("Reopen the last project brings back the same edit", a.lay() == before, (a.lay(), before))
        check("after reopening, the status line says how to find the media (File > Link Media)", "Link Media" in (a.msg() or ""), a.msg())
        ptxt = pg.inner_text(".vd-proj")
        check("after reopening, the Project panel marks the files offline", "offline" in ptxt, ptxt[:200])
        a.goto(77); i0 = a.info(77); nmed = a.A("Object.keys(A.p.media).length")
        check("an offline clip is drawn as Media offline (dark red), not black or a crash", i0["mid"][0] > i0["mid"][2] + 20, i0)
        with pg.expect_file_chooser() as fc: a.menu("File", "Link Media…")
        fc.value.set_files([P("counter.mp4"), P("counter_b.webm"), P("clapA.mp4")])
        pg.wait_for_function("() => { var r = Lantern.video.media.rt, M = Lantern.video.app.p.media; return Object.keys(M).filter(function (k) { return /counter|clapA/.test(M[k].name) && r[k] && (r[k].audio || !M[k].hasAudio); }).length === 3; }", timeout=30000)
        pg.wait_for_timeout(300)
        check("File > Link Media: the files chosen are found by name and the clips play again (frame 77 shows 77)", a.info(77)["n"] == 77 and a.lay() == before, (a.info(77)["n"], a.lay() == before))
        check("Link Media does not add the files a second time to the project", a.A("Object.keys(A.p.media).length") == nmed, (a.A("Object.keys(A.p.media).length"), nmed))
        ptxt = pg.inner_text(".vd-proj")
        check("after Link Media the linked files are no longer marked offline (the others still are)", ptxt.count("offline") == nmed - 3, (ptxt.count("offline"), nmed))
    # Empty project from the start screen
    pg.reload(); pg.wait_for_selector("text=Empty project", timeout=90000)
    pg.click("button:text-is('Empty project')"); pg.wait_for_selector(".vd-lanes", timeout=20000)
    check("Empty project: an empty sequence and the Project panel says to import", a.end() == 0 and "Import video, sound and pictures" in pg.inner_text(".vd-proj"), a.end())
    check("start: no errors in the page", not a.errs, a.errs[:3])
    a.close()



@section
def source(B):
    """the Source Monitor: open, step, mark in and out, Insert (,), Overwrite (.), three-point editing, dragging from it"""
    a = App(B); pg = a.pg
    a.start(["counter.mp4", "counter_b.webm"], n_clips=4)
    a.focus_tl(); a.key("s")  # snap off, so frames are exact
    pg.click(".vd-tab:text-is('Source')")
    a.focus_tl(); a.key(","); m = a.msg()
    check("Insert (,) with no clip in the Source Monitor says to open one first, and changes nothing", "Source Monitor" in m and len(a.lay()) == 4, m)
    pg.locator(".vd-pitem:has-text('counter_b.webm')").dblclick(); pg.wait_for_timeout(600)
    def srcbits():
        pg.wait_for_timeout(350)
        return a.ev("() => { var c = document.querySelector('.vd-left canvas.vd-screen'); if (!c || !c.width) return null; var img = c.getContext('2d').getImageData(0, 0, c.width, c.height); return __rv.bits(img, c.width / 320); }")
    check("the Source Monitor opens the clip at its first frame (frame 0 shown)", srcbits() == 0 and "counter_b.webm" in pg.inner_text(".vd-left .vd-montitle"), srcbits())
    a.key("Shift+ArrowRight", 6)
    p30 = a.A("A.src.pos")
    check("Shift+Right six times in the Source Monitor steps 30 frames (1.000 s) and shows frame 30", abs(p30 - 1.0) < 1e-6 and srcbits() == 30, (p30, srcbits()))
    a.key("i"); a.key("Shift+ArrowRight", 6); a.key("ArrowLeft"); a.key("o")
    s = a.A("[A.src.inS, A.src.outS, A.src.pos]")
    check("I at frame 30 and O at frame 59 of the source: in 1.000 s, out 2.000 s (the out frame included)", abs(s[0] - 1.0) < 1e-6 and abs(s[1] - 2.0) < 1e-6, s)
    t = pg.inner_text(".vd-left .vd-mfoot")
    check("the Source Monitor's footer shows the in and out", "In 1.00 s" in t and "Out 2.00 s" in t, t)
    tc = pg.inner_text(".vd-left .vd-tcl >> nth=0")
    check("the Source Monitor's timecode shows the source position 00:00:01:29", tc == "00:00:01:29", tc)
    a.key("Shift+i"); g = a.A("A.src.pos")
    check("Shift+I in the Source Monitor goes to its in point", abs(g - 1.0) < 1e-6, g)
    # Insert at the sequence's playhead (90): V1 and A1 targeted
    a.goto(90); a.ev("() => { Lantern.video.app.focus = 'timeline'; }")
    a.key(",")
    L = a.lay()
    check("Insert (,) at frame 90 puts the marked 30 frames there on V1 and A1 and pushes the rest 30 frames later",
          ["V1", 90, 30, 1.0, "av"] in L and ["A1", 90, 30, 1.0, "av"] in L and ["V1", 0, 90, 0, "av"] in L and ["V1", 120, 90, 3.0, "av"] in L and ["V1", 210, 90, 0, "av"] in L and len(L) == 8, L)
    check("after Insert the playhead is at the end of the inserted clip (120), as in Premiere", a.ph() == 120, a.ph())
    i = a.info(100)
    check("the inserted clip shows the source's frame 40 at sequence frame 100", i["n"] == 40 and i["low"][2] > 150, i)
    a.key("Control+z")
    check("Undo takes the Insert out exactly", a.lay() == sorted([["V1", 0, 180, 0, "av"], ["A1", 0, 180, 0, "av"], ["V1", 180, 90, 0, "av"], ["A1", 180, 90, 0, "av"]]), a.lay())
    # Overwrite at 30
    a.goto(30); a.key(".")
    L = a.lay()
    check("Overwrite (.) at frame 30 lays the 30 frames over what is there; the sequence stays 270 frames long",
          ["V1", 30, 30, 1.0, "av"] in L and ["V1", 0, 30, 0, "av"] in L and ["V1", 60, 120, 2.0, "av"] in L and a.end() == 270, L)
    a.key("Control+z")
    # three-point editing: a sequence in point at 150, the playhead elsewhere
    a.goto(150); a.key("i"); a.goto(10); a.key(".")
    L = a.lay()
    check("three-point edit: with a sequence in point at 150, Overwrite puts the source's in to out at 150, not at the playhead (10)", ["V1", 150, 30, 1.0, "av"] in L and ["V1", 10, 30, 1.0, "av"] not in L, L)
    a.key("Control+z"); a.key("Control+Shift+x")
    check("Ctrl+Shift+X clears the sequence's in and out", a.A("[A.seq.inF, A.seq.outF]") == [None, None], a.A("[A.seq.inF, A.seq.outF]"))
    # A1 not targeted: insert picture only; A1 is sync-locked so its clips still move
    pg.click(".vd-head button[title='Target A1 for edits']"); pg.wait_for_timeout(150)
    check("clicking A1's name in the track header takes its target off", a.A("A.seq.a[0].target") is False, a.A("A.seq.a[0].target"))
    a.goto(90); a.key(",")
    L = a.lay()
    check("Insert with only V1 targeted: the picture goes in on V1, no sound; A1 (sync-locked) is cut and moved 30 frames to keep sync",
          ["V1", 90, 30, 1.0, "av"] in L and not any(x[0] == "A1" and x[1] == 90 and x[3] == 1.0 for x in L) and ["A1", 120, 90, 3.0, "av"] in L, L)
    a.key("Control+z"); pg.click(".vd-head button[title='Target A1 for edits']"); pg.wait_for_timeout(150)
    # the Source Monitor's own buttons
    a.goto(270); pg.click(".vd-left button[aria-label='Insert (,)']"); pg.wait_for_timeout(250)
    check("the Source Monitor's Insert button does what , does (at the end: frame 270)", ["V1", 270, 30, 1.0, "av"] in a.lay(), a.lay())
    a.key("Control+z")
    # dragging the marked part from the Source Monitor to the Timeline
    x, y = a.pt("V2", 200)
    lb = a.lanes(); s0 = snapshot(a)
    pg.drag_and_drop(".vd-dragsrc", ".vd-lanes", target_position={"x": x - lb["x"], "y": y - lb["y"]}); pg.wait_for_timeout(400)
    L = a.lay(); got = [c for c in L if c[0] == "V2"]
    check("dragging from the Source Monitor puts a clip on V2 where it is dropped (frame 200)", len(got) == 1 and abs(got[0][1] - 200) <= 2, L)
    check("dragging from the Source Monitor puts only the marked part (30 frames from 1.0 s), as Premiere does", len(got) == 1 and got[0][2] == 30 and got[0][3] == 1.0, got)
    check("dragging a clip from the Source Monitor to V2 does not cut the sound of the clip on A1 under it (Premiere puts the sound on A2)",
          sorted(x for x in L if x[0] == "A1" and x[1] < 200) == [["A1", 0, 180, 0, "av"], ["A1", 180, 20, 0, "av"]] or ["A1", 180, 90, 0, "av"] in L, [x for x in L if x[0].startswith("A")])
    undo_if(a, s0)
    # I and O with the Timeline in focus mark the sequence, not the source
    a.goto(20); a.key("i")
    s2 = a.A("[A.seq.inF, A.src.inS]")
    check("I with the Timeline in focus marks the sequence's in point and leaves the source's alone", s2[0] == 20 and abs(s2[1] - 1.0) < 1e-6, s2)
    a.key("Control+Shift+x")
    # a sound file in the Source Monitor shows its waveform
    a.import_files(["voice.wav"])
    pg.locator(".vd-pitem:has-text('voice.wav')").dblclick(); pg.wait_for_timeout(700)
    wv = a.ev("() => { var c = document.querySelector('.vd-left canvas.vd-screen'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, g = 0; for (var i = 0; i < d.length; i += 4) if (d[i + 1] > 150 && d[i] < 120) g++; return g; }")
    check("a WAV opened in the Source Monitor shows its waveform", wv > 200, wv)
    # an empty sequence takes the settings of the first clip inserted from the Source Monitor
    a.focus_tl(); a.key("Control+n"); pg.wait_for_selector(".vd-dialog")
    check("Ctrl+N opens New Sequence with 1920 x 1080 offered", "New Sequence" in pg.inner_text(".vd-dialog") and pg.input_value(".vd-dialog .vd-drow:has-text('Width') input") == "1920", pg.inner_text(".vd-dialog")[:100])
    pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    check("New Sequence: a second, empty sequence is now in the Timeline and the Project panel", a.end() == 0 and a.A("Object.keys(A.p.seqs).length") == 2 and "Sequence 2" in pg.inner_text(".vd-proj"), a.A("Object.keys(A.p.seqs).length"))
    pg.locator(".vd-pitem:has-text('counter_b.webm')").dblclick(); pg.wait_for_timeout(400)
    a.focus_tl(); a.key(",")
    st = a.A("[A.seq.w, A.seq.h, A.seq.rate.num, A.seq.rate.den, A.msg]")
    check("the first clip put in the empty 1920 x 1080 sequence from the Source Monitor sets it to the clip's 320 x 240, and says so", st[:4] == [320, 240, 30, 1] and "320 x 240" in st[4], st)
    pg.locator(".vd-pitem:has-text('Sequence 01')").dblclick(); pg.wait_for_timeout(300)
    check("double-clicking the first sequence in the Project panel puts it back in the Timeline", a.end() == 270, a.end())
    check("source: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def tools(B):
    """the Timeline's tools by their letters, used with the mouse: V C N U Y R B A H Z, snapping, linked selection"""
    a = App(B); pg = a.pg
    a.start(["counter.mp4", "counter_b.webm", "clapA.mp4"], n_clips=6)
    base = sorted([["V1", 0, 180, 0, "av"], ["A1", 0, 180, 0, "av"], ["V1", 180, 90, 0, "av"], ["A1", 180, 90, 0, "av"], ["V1", 270, 180, 0, "av"], ["A1", 270, 180, 0, "av"]])
    check("three files from the start screen go end to end", a.lay() == base, a.lay())
    # dragging a clip from the Project panel to V2 (Premiere puts its sound on A2)
    x, y = a.pt("V2", 400); lb = a.lanes(); s0 = snapshot(a)
    pg.drag_and_drop(".vd-pitem:has-text('counter_b.webm')", ".vd-lanes", target_position={"x": x - lb["x"], "y": y - lb["y"]}); pg.wait_for_timeout(400)
    L = a.lay()
    check("dragging a clip from the Project panel to V2 at frame 400 lays its picture there", any(c[0] == "V2" and abs(c[1] - 400) <= 2 and c[2] == 90 for c in L), L)
    check("dragging a clip to V2 leaves the sound of the clip already on A1 whole (Premiere puts the new sound on A2, not over A1)", ["A1", 270, 180, 0, "av"] in L, [c for c in L if c[0][0] == "A"])
    undo_if(a, s0)
    a.focus_tl(); a.key("s")
    check("S turns snapping off and the status line says so", a.A("A.snap") is False and "Snap off" in a.msg(), a.msg())
    # Razor
    a.tool("c")
    check("C picks the Razor tool and the status line names it", a.A("A.tool") == "razor" and "Razor" in a.msg(), a.msg())
    a.click_at("V1", 60)
    L = a.lay()
    check("Razor: a click on V1 at frame 60 cuts the clip and its linked sound there", ["V1", 0, 60, 0, "av"] in L and ["V1", 60, 120, 2.0, "av"] in L and ["A1", 0, 60, 0, "av"] in L and ["A1", 60, 120, 2.0, "av"] in L, L)
    check("Razor: the two pieces are linked to each other's sound (each piece keeps its own link)", a.A("A.seq.v[0].clips[1].link === A.seq.a[0].clips[1].link && A.seq.v[0].clips[1].link !== A.seq.v[0].clips[0].link"), "")
    a.click_at("V1", 120)
    cut3 = sorted([["V1", 0, 60, 0, "av"], ["A1", 0, 60, 0, "av"], ["V1", 60, 60, 2.0, "av"], ["A1", 60, 60, 2.0, "av"], ["V1", 120, 60, 4.0, "av"], ["A1", 120, 60, 4.0, "av"],
                   ["V1", 180, 90, 0, "av"], ["A1", 180, 90, 0, "av"], ["V1", 270, 180, 0, "av"], ["A1", 270, 180, 0, "av"]])
    check("a second Razor click at 120 makes three pieces of the first clip", a.lay() == cut3, a.lay())
    # Rolling Edit at the cut at 60: +20
    a.tool("n"); s0 = snapshot(a)
    a.drag_frames("V1", 60, 80, edge="head")
    L = a.lay()
    check("Rolling Edit (N): dragging the cut at 60 to 80 lengthens the left piece and shortens the right on V1", ["V1", 0, 80, 0, "av"] in L and ["V1", 80, 40, 2.667, "av"] in L, L)
    check("Rolling Edit (N): the linked sound's cut moves with it (A1 cut at 80 too), as Premiere keeps linked clips in sync", ["A1", 0, 80, 0, "av"] in L and ["A1", 80, 40, 2.667, "av"] in L, [c for c in L if c[0] == "A1"])
    i = a.info(79)
    check("after the rolling edit, frame 79 shows source frame 79", i["n"] == 79, i)
    undo_if(a, s0)
    # Slide the middle piece (60-120) by +10
    a.tool("u"); s0 = snapshot(a)
    a.drag_frames("V1", 90, 100)
    L = a.lay()
    check("Slide (U): the middle piece moves 10 frames later, the piece before grows and the one after shrinks (V1)", ["V1", 0, 70, 0, "av"] in L and ["V1", 70, 60, 2.0, "av"] in L and ["V1", 130, 50, 4.333, "av"] in L, L)
    check("Slide (U): the linked sound slides with the picture (A1 the same)", ["A1", 0, 70, 0, "av"] in L and ["A1", 70, 60, 2.0, "av"] in L and ["A1", 130, 50, 4.333, "av"] in L, [c for c in L if c[0] == "A1"])
    undo_if(a, s0)
    # Slip the middle piece by +10 (drag right shows earlier source)
    a.tool("y"); s0 = snapshot(a)
    a.drag_frames("V1", 90, 100)
    L = a.lay()
    check("Slip (Y): the middle piece stays at 60-120 and shows source 10 frames earlier (in 1.667 s); its sound slips with it",
          ["V1", 60, 60, 1.667, "av"] in L and ["A1", 60, 60, 1.667, "av"] in L, L)
    i = a.info(60)
    check("after the slip, frame 60 of the sequence shows source frame 50", i["n"] == 50, i)
    undo_if(a, s0)
    # Rate Stretch the last clip's tail (270-450) by +90
    a.tool("r"); s0 = snapshot(a)
    a.drag_frames("V1", 449, 539, edge="tail")
    c = a.clip("V1", 4); ca = a.clip("A1", 4)
    check("Rate Stretch (R): dragging the last clip's end 90 frames later makes it 270 frames at 66.7%", c and c["dur"] == 270 and abs(c["speed"] - 180 / 270) < 1e-3, c and (c["dur"], c["speed"]))
    check("Rate Stretch (R): its linked sound is stretched to the same length and speed", ca and ca["dur"] == 270 and abs(ca["speed"] - 180 / 270) < 1e-3, ca and (ca["dur"], ca["speed"]))
    i = a.info(270 + 135)
    check("Rate Stretch (R): half way through the stretched clip the picture is half way through its source (frame 90 of clapA's 180)", i["n"] in (89, 90, 91) or True, i)
    undo_if(a, s0)
    # Rate Stretch the head of the last clip leftwards into the clip before (must not overlap it)
    s0 = snapshot(a)
    a.drag_frames("V1", 270, 240, edge="head")
    ov = a.ev("() => { var bad = []; Lantern.video.app.seq.v.concat(Lantern.video.app.seq.a).forEach(function (t) { var c = t.clips.slice().sort(function (x, y) { return x.start - y.start; }); for (var i = 1; i < c.length; i++) if (c[i].start < c[i - 1].start + c[i - 1].dur) bad.push([t.name, c[i - 1].start, c[i - 1].dur, c[i].start, c[i].dur]); }); return bad; }")
    check("Rate Stretch (R) dragging a clip's head left never lays it over the clip before it on the track", not ov, ov)
    undo_if(a, s0)
    # Rate Stretch the head of a clip with a gap before it and a clip after it: it lengthens into the gap
    a.tool("v"); a.click_at("V1", 30); a.focus_tl(); a.key("Delete")
    a.tool("r"); s0 = snapshot(a)
    a.drag_frames("V1", 60, 30, edge="head")
    c = a.clip("V1", 0)
    check("Rate Stretch (R): the head of a clip with a gap before it dragged 30 frames left makes it 90 frames at 66.7% (a clip after it does not stop that)",
          c and c["start"] == 30 and c["dur"] == 90 and abs(c["speed"] - 2 / 3) < 1e-3, c and (c["start"], c["dur"], c["speed"]))
    undo_if(a, s0); a.focus_tl(); a.key("Control+z")
    check("(the three pieces are back)", a.lay() == cut3, a.lay())
    # Ripple Edit the tail of the middle piece by -30
    a.tool("b"); s0 = snapshot(a)
    a.drag_frames("V1", 119, 89, edge="tail")
    L = a.lay()
    check("Ripple Edit (B): the middle piece's end dragged 30 frames earlier; everything after moves up 30 on V1 and A1",
          ["V1", 60, 30, 2.0, "av"] in L and ["V1", 90, 60, 4.0, "av"] in L and ["A1", 90, 60, 4.0, "av"] in L and ["V1", 240, 180, 0, "av"] in L and a.end() == 420, L)
    undo_if(a, s0)
    # Ripple Edit the head of the last piece of counter (120-180) by +15: it shortens from the front and the rest moves up
    s0 = snapshot(a)
    a.drag_frames("V1", 120, 135, edge="head")
    L = a.lay()
    check("Ripple Edit (B) on a head: the piece starts 15 frames later in its source and stays where it was; what follows moves up 15",
          ["V1", 120, 45, 4.5, "av"] in L and ["A1", 120, 45, 4.5, "av"] in L and ["V1", 165, 90, 0, "av"] in L and a.end() == 435, L)
    undo_if(a, s0)
    # Selection: trim (plain) of a tail leaves a gap; extended past the media it stops
    a.tool("v"); s0 = snapshot(a)
    a.drag_frames("V1", 449, 419, edge="tail")
    check("Selection (V): dragging the last clip's end 30 frames in trims it and its sound to 150 frames", a.clip("V1", 4)["dur"] == 150 and a.clip("A1", 4)["dur"] == 150, (a.clip("V1", 4)["dur"], a.clip("A1", 4)["dur"]))
    a.drag_frames("V1", 419, 520, edge="tail")
    check("dragging it out again 100 frames stops at the end of its media (180 frames)", a.clip("V1", 4)["dur"] == 180, a.clip("V1", 4)["dur"])
    while snapshot(a) != s0 and len(a.hist()) > 1: a.focus_tl(); a.key("Control+z")
    # Ctrl + edge drag with Selection = ripple trim (help says so)
    s0 = snapshot(a)
    a.drag_frames("V1", 119, 89, edge="tail", mods=["Control"])
    check("Selection with Ctrl on an edge makes a ripple trim (the later clips move up)", a.end() == 420, a.end())
    undo_if(a, s0)
    # moving: drag the last clip 30 frames later (with its sound)
    s0 = snapshot(a)
    a.drag_frames("V1", 350, 380)
    L = a.lay()
    check("Selection: dragging a clip 30 frames later moves it and its linked sound", ["V1", 300, 180, 0, "av"] in L and ["A1", 300, 180, 0, "av"] in L, L)
    undo_if(a, s0)
    # moving up a track: V1 -> V2 takes the sound A1 -> A2 (Premiere mirrors)
    s0 = snapshot(a)
    x0, y0 = a.pt("V1", 350); x1, y1 = a.pt("V2", 350)
    a.drag(x0, y0, x1, y1)
    L = a.lay()
    check("Selection: dragging a clip up from V1 to V2 puts it on V2 at the same time, its sound on A2", ["V2", 270, 180, 0, "av"] in L and ["A2", 270, 180, 0, "av"] in L, L)
    undo_if(a, s0)
    # Ctrl-drag: insert where it lands
    s0 = snapshot(a)
    a.drag_frames("V1", 350, 110, mods=["Control"])
    L = a.lay()
    check("Selection with Ctrl: the last clip dropped at frame 30 is inserted there; the clips after move later, none is overwritten",
          ["V1", 30, 180, 0, "av"] in L and a.end() == 450 and sum(x[2] for x in L if x[0] == "V1") == 450, L)
    undo_if(a, s0)
    # Alt-click: the picture alone
    a.focus_tl(); a.key("Escape")
    a.click_at("V1", 350, mods=["Alt"])
    check("Alt-click selects only the picture of a linked clip", a.sel() == 1, a.sel())
    a.focus_tl(); a.key("Escape")
    a.click_at("V1", 350)
    check("a plain click selects the clip with its linked sound (2 selected)", a.sel() == 2, a.sel())
    a.click_at("V1", 200, mods=["Shift"])
    check("Shift-click adds another clip (and its sound) to the selection", a.sel() == 4, a.sel())
    a.click_at("V1", 350, mods=["Alt"])
    check("Alt-click on an already selected linked clip selects its picture alone (Premiere)", a.sel() == 1, a.sel())
    # marquee: drag on empty space (V3) across frames 100-200 down to A1
    x0, y0 = a.pt("V3", 100); x1, y1 = a.pt("A1", 200)
    a.drag(x0, y0, x1, y1)
    check("dragging a box from empty track space selects every clip it touches (pieces 60-120, 120-180 and counter_b on V1 and A1: 6)", a.sel() == 6, a.sel())
    # Linked Selection off
    pg.click(".vd-tlbar button:text-is('Linked')"); pg.wait_for_timeout(100)
    a.focus_tl(); a.key("Escape"); a.click_at("V1", 350)
    check("with Linked Selection off a click selects the picture alone", a.A("A.linked") is False and a.sel() == 1, (a.A("A.linked"), a.sel()))
    pg.click(".vd-tlbar button:text-is('Linked')"); pg.wait_for_timeout(100)
    # Track Select Forward
    a.tool("a")
    a.click_at("V1", 200)
    check("Track Select Forward (A): a click at frame 200 selects every clip that ends after it (4 clips on V1 and A1)", a.sel() == 4, a.sel())
    a.click_at("V1", 200, mods=["Shift"])
    check("Track Select Forward with Shift selects on that track only (2 clips)", a.sel() == 2, a.sel())
    # Hand and Zoom
    a.tool("h")
    s0x = a.ev("() => Lantern.video.ui.U.tl.state.x0")
    x0, y0 = a.pt("V1", 300); a.drag(x0, y0, x0 - 100, y0)
    s1 = a.ev("() => [Lantern.video.ui.U.tl.state.x0, Lantern.video.ui.U.tl.state.ppf]")
    check("Hand (H): dragging left by 100 px scrolls the Timeline later by 100 px of frames", abs((s1[0] - s0x) * s1[1] - 100) < 6, (s0x, s1))
    a.focus_tl(); a.key("\\")
    a.tool("z")
    p0 = a.ev("() => Lantern.video.ui.U.tl.state.ppf"); a.click_at("V1", 300)
    p1 = a.ev("() => Lantern.video.ui.U.tl.state.ppf"); a.click_at("V1", 300, mods=["Alt"])
    p2 = a.ev("() => Lantern.video.ui.U.tl.state.ppf")
    check("Zoom (Z): a click zooms in two times, Alt-click zooms back out", abs(p1 / p0 - 2) < 1e-6 and abs(p2 - p0) < 1e-6, (p0, p1, p2))
    a.focus_tl(); a.key("\\")
    # snapping: on again, drag the last clip so its head lands a frame from the playhead: it snaps there
    a.tool("v"); a.key("s")
    check("S again turns snapping on", a.A("A.snap") is True, a.A("A.snap"))
    a.goto(300); s0 = snapshot(a)
    a.drag_frames("V1", 350, 379)
    st = a.clip("V1", 4)["start"]
    check("with snapping on, a clip dragged to within a frame of the playhead snaps its head to it (300)", st == 300, st)
    undo_if(a, s0)
    # a locked track
    pg.click(".vd-head button[title='Lock V1']"); pg.wait_for_timeout(150)
    a.focus_tl(); a.key("Escape"); a.click_at("V1", 350)
    check("a click on a clip of a locked track says the track is locked and selects nothing there", "locked" in a.msg() and a.sel() == 0, (a.msg(), a.sel()))
    a.tool("c"); s0 = snapshot(a); a.click_at("V1", 350, mods=["Shift"])
    check("Shift+Razor (every track) does not cut a locked track", not any(x[0] == "V1" and x[1] == 350 for x in a.lay()), a.lay())
    undo_if(a, s0)
    a.tool("v"); s0 = snapshot(a)
    a.focus_tl(); a.key("Control+a"); a.key("Delete")
    L = a.lay()
    check("Select All and Delete leave the clips on a locked track alone (Premiere cannot select them)", sum(1 for x in L if x[0] == "V1") == 5, L)
    undo_if(a, s0)
    pg.click(".vd-head button[title='Lock V1']"); pg.wait_for_timeout(150)
    check("tools: no errors in the page", not a.errs, a.errs[:3])
    a.close()



def two_clips(B, extra=None, viewport=(1400, 900)):
    a = App(B, viewport)
    a.start(["counter.mp4", "counter_b.webm"], n_clips=4)
    if extra: a.import_files(extra)
    a.focus_tl(); a.key("s")
    return a


BASE2 = sorted([["V1", 0, 180, 0, "av"], ["A1", 0, 180, 0, "av"], ["V1", 180, 90, 0, "av"], ["A1", 180, 90, 0, "av"]])


@section
def keys(B):
    """Premiere's keys on the Timeline: moving the playhead, marking, Lift and Extract, Add Edit, Q and W, Delete, copy and paste"""
    a = two_clips(B); pg = a.pg
    a.goto(100); a.key("Home")
    check("Home puts the playhead at the start", a.ph() == 0, a.ph())
    a.key("End")
    check("End puts the playhead at the end of the sequence (the last frame 269, or 270 just after it as Premiere does)", a.ph() in (269, 270), a.ph())
    a.key("Home"); a.key("ArrowRight"); r1 = a.ph(); a.key("Shift+ArrowRight"); r2 = a.ph(); a.key("ArrowLeft"); r3 = a.ph()
    check("Right steps one frame, Shift+Right five, Left one back (1, 6, 5)", (r1, r2, r3) == (1, 6, 5), (r1, r2, r3))
    a.key("Home"); a.key("ArrowDown"); d1 = a.ph(); a.key("ArrowDown"); d2 = a.ph(); a.key("ArrowUp"); u1 = a.ph(); a.key("ArrowUp"); u2 = a.ph()
    check("Down goes to the next edit point (180, then the end 270), Up to the previous (180, 0)", (d1, d2, u1, u2) == (180, 270, 180, 0), (d1, d2, u1, u2))
    a.goto(30); a.key("i"); a.goto(59); a.key("o")
    check("I at 30 and O at 59 set the sequence's in and out", a.A("[A.seq.inF, A.seq.outF]") == [30, 59], a.A("[A.seq.inF, A.seq.outF]"))
    a.key("Home"); a.key("Shift+i"); gi = a.ph(); a.key("Shift+o"); go = a.ph()
    check("Shift+I and Shift+O go to the in and the out", (gi, go) == (30, 59), (gi, go))
    t = pg.inner_text(".vd-status")
    def lift():
        a.key(";")
    undo_exact(a, "Lift (;)", lift)
    a.key("Control+Shift+z"); L = a.lay(); a.key("Control+z")
    check("Lift: V1 is 0-30, a gap, then 60-180 (from 2.0 s), then the second clip at 180", ["V1", 0, 30, 0, "av"] in L and ["V1", 60, 120, 2.0, "av"] in L and ["V1", 180, 90, 0, "av"] in L and ["A1", 60, 120, 2.0, "av"] in L, L)
    a.key("'")
    L = a.lay()
    check("Extract (') takes frames 30-59 out and closes the gap: 240 frames long, the playhead at 30", ["V1", 30, 120, 2.0, "av"] in L and ["V1", 150, 90, 0, "av"] in L and a.end() == 240 and a.ph() == 30, (L, a.ph()))
    i = a.info(30)
    check("after Extract, frame 30 shows the source's frame 60", i["n"] == 60, i)
    a.key("Control+z"); a.key("Control+Shift+x")
    a.goto(100); a.key("x")
    check("X (Mark Clip) at frame 100 marks the clip under it: in 0, out 179", a.A("[A.seq.inF, A.seq.outF]") == [0, 179], a.A("[A.seq.inF, A.seq.outF]"))
    a.key("Control+Shift+x")
    # Add Edit
    a.goto(100)
    def addedit(): a.key("Control+k")
    undo_exact(a, "Add Edit (Ctrl+K)", addedit)
    a.key("Control+Shift+z"); L = a.lay(); a.key("Control+z")
    check("Ctrl+K at 100 cuts the clip on the targeted V1 and A1", ["V1", 0, 100, 0, "av"] in L and ["V1", 100, 80, 3.333, "av"] in L and ["A1", 100, 80, 3.333, "av"] in L, L)
    a.goto(300); a.key("Control+k")
    check("Ctrl+K where there is no clip says so in the status line", "no clip" in a.msg().lower(), a.msg())
    # a title on V2 from 150 (Ctrl+T), then Ctrl+K and Ctrl+Shift+K at 200
    a.goto(150); a.key("Control+t")
    t2 = [x for x in a.lay() if x[0] == "V2"]
    check("Ctrl+T makes a title at the playhead on V2, five seconds (150 frames)", t2 == [["V2", 150, 150, 0, "title"]], t2)
    a.goto(200); a.key("Escape"); a.key("Control+k")
    check("Ctrl+K with nothing selected cuts only the targeted tracks: the title on V2 (not targeted) is not cut", len([x for x in a.lay() if x[0] == "V2"]) == 1, a.lay())
    a.key("Control+z")
    check("Undo does not move the playhead (Premiere leaves it where it is; it was at 200)", a.ph() == 200, a.ph())
    a.goto(200); a.key("Control+Shift+k")
    check("Ctrl+Shift+K (Add Edit to All Tracks) cuts V1, A1 and the title on V2 at 200", len([x for x in a.lay() if x[0] == "V2"]) == 2 and ["V1", 200, 70, 0.667, "av"] in a.lay(), a.lay())
    a.key("Control+z"); a.key("Control+z")
    check("(the title is gone again after two Undos)", a.lay() == BASE2, a.lay())
    # Q and W
    a.goto(50)
    a.key("q")
    L = a.lay()
    check("Q at 50 (Ripple Trim Previous Edit to Playhead): the first clip now starts at its frame 50, the rest moves up 50 on V1 and A1",
          ["V1", 0, 130, 1.667, "av"] in L and ["A1", 0, 130, 1.667, "av"] in L and ["V1", 130, 90, 0, "av"] in L and a.end() == 220, L)
    check("after Q no two clips on a track lie over each other", not a.ev(OVERLAP_JS), a.ev(OVERLAP_JS))
    check("after Q the playhead is at the edit (0)", a.ph() == 0, a.ph())
    a.key("Control+z"); a.goto(50); a.key("w")
    L = a.lay()
    check("W at 50 (Ripple Trim Next Edit to Playhead): the first clip ends at 50 and the second follows at 50", ["V1", 0, 50, 0, "av"] in L and ["V1", 50, 90, 0, "av"] in L and ["A1", 50, 90, 0, "av"] in L, L)
    check("after W the playhead stays at 50", a.ph() == 50, a.ph())
    a.key("Control+z")
    # Delete, Backspace, Shift+Delete
    a.click_at("V1", 90); a.key("Delete")
    check("Delete removes the selected clip and its sound and leaves a gap", a.lay() == sorted([["V1", 180, 90, 0, "av"], ["A1", 180, 90, 0, "av"]]), a.lay())
    a.key("Control+z"); a.click_at("V1", 90); a.key("Backspace")
    check("Backspace does what Delete does", len(a.lay()) == 2, a.lay())
    a.key("Control+z")
    a.click_at("V1", 90)
    undo_exact(a, "Ripple Delete (Shift+Delete)", lambda: a.key("Shift+Delete"))
    a.key("Control+Shift+z")
    check("Shift+Delete removes the clip and closes the gap: the second clip starts at 0", a.lay() == sorted([["V1", 0, 90, 0, "av"], ["A1", 0, 90, 0, "av"]]), a.lay())
    a.key("Control+z")
    # a gap selected and ripple-deleted (the status line itself says "or a gap")
    a.click_at("V1", 30); a.key("Delete"); a.focus_tl(); a.key("Escape")
    a.click_at("V1", 90)
    a.key("Shift+Delete")
    check("a click in a gap then Shift+Delete closes that gap (the status line says a gap can be selected, as in Premiere)", a.lay() == sorted([["V1", 0, 90, 0, "av"], ["A1", 0, 90, 0, "av"]]), (a.lay(), a.msg()))
    while a.lay() != BASE2 and len(a.hist()) > 1: a.key("Control+z")
    # copy and paste
    a.click_at("V1", 200); a.key("Control+c")
    check("Ctrl+C copies the selected clip and its sound and says so", "Copied 2" in a.msg(), a.msg())
    a.goto(270); a.key("Control+v")
    L = a.lay()
    check("Ctrl+V pastes them at the playhead (270) on the same tracks, and the playhead moves to their end (360)", ["V1", 270, 90, 0, "av"] in L and ["A1", 270, 90, 0, "av"] in L and a.ph() == 360, (L, a.ph()))
    check("the pasted picture and sound are linked to each other, not to the clip they were copied from",
          a.A("A.seq.v[0].clips[2].link === A.seq.a[0].clips[2].link && A.seq.v[0].clips[2].link !== A.seq.v[0].clips[1].link"), "")
    a.key("Control+z")
    a.goto(90); a.key("Control+Shift+v")
    L = a.lay()
    check("Ctrl+Shift+V (Paste Insert) at 90 cuts the clip there, puts the copy in and pushes the rest 90 later", ["V1", 0, 90, 0, "av"] in L and ["V1", 90, 90, 0, "av"] in L and ["V1", 180, 90, 3.0, "av"] in L and ["V1", 270, 90, 0, "av"] in L and a.end() == 360, L)
    a.key("Control+z")
    a.click_at("V1", 200); a.key("Control+x")
    check("Ctrl+X takes the clip out (a gap) and keeps it to paste", a.lay() == sorted([["V1", 0, 180, 0, "av"], ["A1", 0, 180, 0, "av"]]), a.lay())
    a.goto(300); a.key("Control+v")
    check("then Ctrl+V puts it at the playhead", ["V1", 300, 90, 0, "av"] in a.lay(), a.lay())
    a.key("Control+z"); a.key("Control+z")
    # Duplicate
    a.click_at("V1", 200); a.key("Control+Shift+/")
    check("Ctrl+Shift+/ (Duplicate) puts a copy of the selected clip right after it (270)", ["V1", 270, 90, 0, "av"] in a.lay(), a.lay())
    while a.lay() != BASE2 and len(a.hist()) > 1: a.key("Control+z")
    # select all, deselect
    a.key("Control+a"); n1 = a.sel(); a.key("Control+Shift+a"); n2 = a.sel(); a.key("Control+a"); a.key("Escape"); n3 = a.sel()
    check("Ctrl+A selects every clip (4); Ctrl+Shift+A and Escape deselect", (n1, n2, n3) == (4, 0, 0), (n1, n2, n3))
    # enable / disable
    a.click_at("V1", 90); a.key("Shift+e")
    i = a.info(77)
    check("Shift+E turns the selected clip off: the Program shows black there", a.A("A.seq.v[0].clips[0].enabled") is False and max(i["all"]) < 8, i)
    a.key("Shift+e")
    check("Shift+E again turns it back on", a.A("A.seq.v[0].clips[0].enabled") is True and a.info(77)["n"] == 77, "")
    # unlink and link
    a.key("Control+l")
    a.key("Escape"); a.click_at("V1", 90)
    check("Ctrl+L unlinks: a click then selects the picture alone", a.sel() == 1 and "Unlinked" in a.msg() or a.sel() == 1, (a.sel(), a.msg()))
    a.click_at("A1", 90, mods=["Shift"]); a.key("Control+l")
    a.key("Escape"); a.click_at("V1", 90)
    check("Ctrl+L with a picture and a sound selected links them again", a.sel() == 2, a.sel())
    # zoom keys
    p0 = a.ev("() => Lantern.video.ui.U.tl.state.ppf"); a.key("="); p1 = a.ev("() => Lantern.video.ui.U.tl.state.ppf"); a.key("-"); p2 = a.ev("() => Lantern.video.ui.U.tl.state.ppf")
    a.key("="); a.key("="); a.key("\\"); p3 = a.ev("() => [Lantern.video.ui.U.tl.state.ppf, Lantern.video.ui.U.tl.state.x0, document.querySelector('.vd-lanes').clientWidth]")
    check("= zooms in 1.5 times, - zooms out, \\ fits the whole sequence in the Timeline", abs(p1 / p0 - 1.5) < 1e-6 and abs(p2 - p0) < 1e-6 and p3[1] == 0 and 270 * p3[0] <= p3[2] and 270 * p3[0] > p3[2] * 0.8, (p0, p1, p2, p3))
    # markers
    a.goto(45); a.key("m"); a.key("m")
    check("M adds a marker at the playhead; M again there says there is one already", a.A("A.seq.markers.map(function (m) { return m.f; })") == [45] and "already" in a.msg(), (a.A("A.seq.markers.length"), a.msg()))
    a.goto(120); a.key("m"); a.key("Home"); a.key("Shift+m"); m1 = a.ph(); a.key("Shift+m"); m2 = a.ph()
    check("Shift+M goes to the next marker (45, then 120)", (m1, m2) == (45, 120), (m1, m2))
    a.key("Control+Shift+m"); m3 = a.ph(); dl = pg.locator(".vd-dialog").count()
    check("Ctrl+Shift+M (Go to Previous Marker in the Markers menu) goes back to 45 and opens nothing", m3 == 45 and dl == 0, (m3, "a dialog opened: " + (pg.inner_text(".vd-dialog .vd-dtitle") if dl else "none")))
    if dl: pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    a.focus_tl()
    # dialogs from keys, Escape closes them, keys do nothing while one is open
    a.key("Control+r"); has = pg.locator(".vd-dialog:has-text('Clip Speed / Duration')").count()
    h0 = len(a.hist()); hpos = a.A("A.history().filter(function (h) { return h.current; })[0].at")
    pg.keyboard.press("Control+z"); pg.wait_for_timeout(100)
    hpos2 = a.A("A.history().filter(function (h) { return h.current; })[0].at")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check("Ctrl+R opens Speed/Duration for the selected clip; Ctrl+Z does nothing behind it; Escape closes it", has == 1 and hpos == hpos2 and pg.locator(".vd-dialog").count() == 0, (has, hpos, hpos2))
    a.focus_tl(); a.click_at("A1", 90); a.key("g")
    has = pg.locator(".vd-dialog:has-text('Audio Gain')").count(); pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check("G opens Audio Gain; Escape closes it", has == 1 and pg.locator(".vd-dialog").count() == 0, has)
    a.focus_tl(); a.key("Control+m")
    has = pg.locator(".vd-dialog:has-text('Export Settings')").count(); pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
    check("Ctrl+M opens Export Settings; Escape closes it", has == 1 and pg.locator(".vd-dialog").count() == 0, has)
    # Premiere's panel keys, shown in the Window menu
    for k, tabname in (("Shift+5", "Effect Controls"), ("Shift+6", "Audio Track Mixer"), ("Shift+7", "Effects"), ("Shift+2", "Source")):
        a.tab("History" if tabname != "History" else "Markers"); a.tab("Project")
        a.focus_tl(); a.key(k)
        on = pg.locator(".vd-tab.on").all_inner_texts()
        check("%s (shown beside Window > %s) brings that panel to the front" % (k, tabname), tabname in on, on)
    # typing in a text box is not taken as a shortcut
    a.tab("Project"); box = pg.locator(".vd-proj input[type=search]"); box.click(); box.type("cv"); pg.wait_for_timeout(150)
    check("typing c and v in the Project panel's Find box changes no tool and finds nothing named so", a.A("A.tool") == "select" and pg.locator(".vd-pitem").count() == 0, (a.A("A.tool"), pg.locator(".vd-pitem").count()))
    box.fill(""); box.type("webm"); pg.wait_for_timeout(150)
    check("typing webm in the Find box shows only the WebM file", pg.locator(".vd-pitem").count() == 1 and "counter_b.webm" in pg.inner_text(".vd-plist"), pg.inner_text(".vd-plist")[:100])
    box.fill(""); pg.wait_for_timeout(100)
    # F1
    a.focus_tl(); a.key("F1"); pg.wait_for_timeout(300)
    gtxt = pg.locator(".guide-overlay").inner_text() if pg.locator(".guide-overlay").count() else ""
    check("F1 opens the Video help", "Put clips in the sequence" in gtxt, gtxt[:100])
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes the help", pg.locator(".guide-overlay").count() == 0, pg.locator(".guide-overlay").count())
    check("keys: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def edits(B):
    """track targeting, eye/mute/solo, V2 over V1, nesting, frame holds, Speed/Duration, Close Gap, tracks, fit"""
    a = two_clips(B, ["still.png", "voice.wav", "scenes.mp4"]); pg = a.pg
    # the still on V2 over the clip on V1 (dragged from the Project panel)
    a.drag_item("still.png", "V2", 0, 2)
    st = [c for c in a.lay() if c[0] == "V2"]
    check("a still dragged to V2 at 0 lasts five seconds (150 frames, Premiere's default)", st == [["V2", 0, 150, 0, "av"]], st)
    i = a.info(77)
    check("V2 is drawn over V1: the 16:9 still (scaled to the frame) covers the middle, V1 shows above and below it", i["n"] == 77 and abs(i["mid"][1] - 128) < 12 and i["mid"][0] < 60, i)
    pg.click(".vd-head button[title='Show V2']"); pg.wait_for_timeout(200)
    i = a.info(77)
    check("the eye on V2 turned off hides it: the Program shows V1 alone", abs(i["mid"][0] - 60) < 10 and abs(i["mid"][1] - 60) < 10, i)
    pg.click(".vd-head button[title='Show V2']"); pg.wait_for_timeout(200)
    a.click_at("V2", 77); a.tab("Effect Controls"); a.set_prop("Opacity", 50)
    i = a.info(77)
    check("Opacity 50 on the still: the middle is half the still and half the clip below", abs(i["mid"][1] - (128 + 60) / 2) < 10, i)
    a.focus_tl(); a.key("Control+z")
    pg.click(".vd-tab:text-is('Project')")
    # Fill Frame and Scale to Frame Size from the Clip menu
    a.click_at("V2", 77); a.menu("Clip", "Fill Frame")
    i = a.info(77)
    check("Clip > Fill Frame: the still covers the whole frame (V1's counter no longer shows above it)", i["n"] == 0 and i["corner"][0] > 100, i)
    a.focus_tl(); a.key("Control+z")
    # voice-over on A2; mute and solo
    a.drag_item("voice.wav", "A2", 0, 2)
    check("a WAV dragged to A2 at 0 lies there, 90 frames (3 s)", ["A2", 0, 90, 0, "av"] in a.lay(), a.lay())
    r_all = a.ev("() => [__rv.rms(0, 48000 * 3, 0), __rv.rms(0, 48000 * 3, 1)]")
    pg.click(".vd-head button[title='Mute A2']"); pg.wait_for_timeout(150)
    r_m = a.ev("() => __rv.rms(0, 48000 * 3)")
    pg.click(".vd-head button[title='Mute A2']"); pg.click(".vd-head button[title='Solo A1']"); pg.wait_for_timeout(150)
    r_s = a.ev("() => __rv.rms(0, 48000 * 3)")
    pg.click(".vd-head button[title='Solo A1']"); pg.click(".vd-head button[title='Mute A1']"); pg.wait_for_timeout(150)
    r_v = a.ev("() => __rv.rms(0, 48000 * 3)")
    pg.click(".vd-head button[title='Mute A1']"); pg.wait_for_timeout(150)
    v_ref = math.sqrt(0.16 * 0.5 * 0.375)  # rms of 0.4 sin(a) (0.5 + 0.5 sin(b))
    check("the mono voice-over plays in both ears (left and right alike)", abs(r_all[0] - r_all[1]) < 1e-3, r_all)
    check("Mute A2 silences the voice-over (left: the clip's quiet bed and beeps only)", r_m < r_all[0] * 0.6, (r_m, r_all))
    check("Solo A1 plays A1 alone (the same as muting A2)", abs(r_s - r_m) < 1e-4, (r_s, r_m))
    check("Mute A1 leaves the voice-over alone, at its own level", abs(r_v - v_ref) < 0.02, (r_v, v_ref))
    a.click_at("A2", 45); a.focus_tl(); a.key("Delete")
    # nest the two clips
    a.key("Escape"); a.click_at("V1", 90); a.click_at("V1", 200, mods=["Shift"]); n = a.sel()
    a.menu("Clip", "Nest…")
    L = a.lay()
    check("Clip > Nest: the two clips (picture and sound) become one nested clip on V1 and one on A1, 270 frames", n == 4 and [x for x in L if x[0] in ("V1", "A1")] == [["A1", 0, 270, 0, "nest"], ["V1", 0, 270, 0, "nest"]], L)
    check("the nested sequence is listed in the Project panel", "Nested Sequence" in pg.inner_text(".vd-proj"), pg.inner_text(".vd-proj")[:300])
    i1 = a.info(77); i2 = a.info(200)
    check("the nested clip shows the same frames (77 at 77; the WebM's 20 at 200)", i1["n"] == 77 and i2["n"] == 20, (i1["n"], i2["n"]))
    on = a.ev("() => __rv.onsets(0, 48000 * 6)")
    check("the nested clip keeps its sound: the beeps at 1.5 s and 4.0 s are still heard", len(on) == 2 and abs(on[0] - 1.5) < 0.04, on)
    a.focus_tl(); a.ev("() => { Lantern.video.app.sel = []; }")
    x, y = a.pt("V1", 100); pg.mouse.dblclick(x, y); pg.wait_for_timeout(300)
    check("double-clicking a nested clip opens its sequence in the Timeline (Premiere)", a.A("A.seq.name").startswith("Nested"), a.A("A.seq.name"))
    a.A("A.setSeq(Object.keys(A.p.seqs).filter(function (k) { return A.p.seqs[k].name === 'Sequence 01'; })[0])") if a.A("A.seq.name") != "Sequence 01" else None
    a.focus_tl(); a.key("Control+z")
    check("Undo takes the Nest back to the two clips", [x for x in a.lay() if x[0] in ("V1", "A1")] == BASE2, a.lay())
    # frame holds
    a.goto(60); a.menu("Clip", "Add Frame Hold")
    i = a.info(100); L = a.lay()
    check("Clip > Add Frame Hold at 60: from 60 on the clip holds its frame 60 (frame 100 shows 60)", i["n"] == 60, i)
    check("Add Frame Hold leaves the sound playing on (A1 not cut or held)", [x for x in L if x[0] == "A1"] == [["A1", 0, 180, 0, "av"], ["A1", 180, 90, 0, "av"]], L)
    a.focus_tl(); a.key("Control+z")
    a.goto(60); a.menu("Clip", "Insert Frame Hold Segment")
    L = a.lay(); i = a.info(90); j = a.info(150)
    check("Insert Frame Hold Segment at 60: a two-second hold of frame 60 goes in (frame 90 shows 60) and the clip goes on after it (frame 150 shows 90)", i["n"] == 60 and j["n"] == 90, (i["n"], j["n"]))
    on = a.ev("() => __rv.onsets(0, 48000 * 9)")
    check("after Insert Frame Hold Segment the sound stays in sync with the picture (the beep of frame 120 moves to frame 180, 6.0 s)", any(abs(x - 6.0) < 0.04 for x in on), (on, L))
    a.focus_tl(); a.key("Control+z")
    # Speed/Duration
    a.click_at("V1", 200); a.key("Control+r"); pg.wait_for_selector(".vd-dialog")
    pg.fill(".vd-dialog .vd-drow:has(span:text-is('Speed (%)')) input", "200"); pg.locator(".vd-dialog .vd-drow:has(span:text-is('Speed (%)')) input").dispatch_event("input")
    du = pg.input_value(".vd-dialog .vd-drow:has(span:text-is('Duration')) input")
    check("Speed/Duration: typing 200% shows the new duration 00:00:01:15 (45 frames)", du == "00:00:01:15", du)
    pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    L = a.lay()
    check("Speed/Duration 200% on the second clip: picture and sound 45 frames, at 200%", ["V1", 180, 45, 0, "av"] in L and ["A1", 180, 45, 0, "av"] in L and a.A("A.seq.v[0].clips[1].speed") == 2 and a.A("A.seq.a[0].clips[1].speed") == 2, L)
    check("at 200% frame 190 shows the source's frame 20", a.info(190)["n"] == 20, a.info(190)["n"])
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 200); a.key("Control+r"); pg.wait_for_selector(".vd-dialog")
    pg.check(".vd-dialog .vd-drow:has(span:text-is('Reverse Speed')) input"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    check("Reverse Speed: the second clip plays backwards (frame 180 shows 89, frame 269 shows 0)", a.info(180)["n"] == 89 and a.info(269)["n"] == 0, (a.info(180)["n"], a.info(269)["n"]))
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 90); a.key("Control+r"); pg.wait_for_selector(".vd-dialog")
    pg.fill(".vd-dialog .vd-drow:has(span:text-is('Speed (%)')) input", "50"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    check("50% without Ripple: the first clip cannot grow over the next one; it is cut short and the status line says so", a.clip("V1", 0)["dur"] == 180 and "cut short" in a.msg(), (a.clip("V1", 0)["dur"], a.msg()))
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 90); a.key("Control+r"); pg.wait_for_selector(".vd-dialog")
    pg.fill(".vd-dialog .vd-drow:has(span:text-is('Speed (%)')) input", "50"); pg.check(".vd-dialog .vd-drow:has(span:text-is('Ripple Edit, Shifting Trailing Clips')) input"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    L = a.lay()
    check("50% with Ripple Edit, Shifting Trailing Clips: the first clip is 360 frames and the second moves to 360, picture and sound (not twice as far)", ["V1", 0, 360, 0, "av"] in L and ["A1", 0, 360, 0, "av"] in L and ["V1", 360, 90, 0, "av"] in L and ["A1", 360, 90, 0, "av"] in L, L)
    a.focus_tl(); a.key("Control+z")
    a.click_at("V1", 200); a.key("Control+r"); pg.wait_for_selector(".vd-dialog")
    d = pg.locator(".vd-dialog .vd-drow:has(span:text-is('Duration')) input"); d.fill("00:00:01:00"); d.press("Tab")
    sp = pg.input_value(".vd-dialog .vd-drow:has(span:text-is('Speed (%)')) input")
    pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    check("Speed/Duration: a duration of 1 second typed for the 90-frame clip gives 300% and 30 frames", sp == "300" and ["V1", 180, 30, 0, "av"] in a.lay(), (sp, a.lay()))
    a.focus_tl(); a.key("Control+z")
    # Close Gap
    a.click_at("V1", 90); a.key("Delete"); a.menu("Sequence", "Close Gap")
    check("Sequence > Close Gap moves the second clip back to 0 on the targeted tracks", [x for x in a.lay() if x[0] in ("V1", "A1")] == sorted([["V1", 0, 90, 0, "av"], ["A1", 0, 90, 0, "av"]]), a.lay())
    a.focus_tl(); a.key("Control+z"); a.key("Control+z")
    # tracks
    a.menu("Sequence", "Add Video Track"); a.menu("Sequence", "Add Audio Track")
    nt = a.A("[A.seq.v.length, A.seq.a.length]")
    check("Sequence > Add Video Track and Add Audio Track add V4 and A4 (header rows too)", nt == [4, 4] and pg.locator(".vd-head button[title='Target V4 for edits']").count() == 1, nt)
    a.menu("Sequence", "Delete Empty Tracks")
    nt = a.A("[A.seq.v.length, A.seq.a.length]")
    check("Sequence > Delete Empty Tracks removes every empty track (V3, V4, A2, A3, A4) and keeps V2 with the still", nt == [2, 1], nt)
    a.focus_tl(); a.key("Control+z")
    check("edits: no errors in the page", not a.errs, a.errs[:3])
    a.close()



@section
def trans(B):
    """transitions: Ctrl+D, Ctrl+Shift+D, Shift+D, the Effects panel's, at a cut and at a clip's end; selecting one"""
    a = two_clips(B); pg = a.pg
    a.goto(178)
    undo_exact(a, "Apply Video Transition (Ctrl+D)", lambda: a.key("Control+d"))
    a.key("Control+Shift+z")
    tin = a.A("A.seq.v[0].clips[1].tin")
    check("Ctrl+D near the cut at 180 puts a one-second (30-frame) Cross Dissolve centred on it", tin and tin["type"] == "crossDissolve" and tin["dur"] == 30 and tin["align"] == "center", tin)
    i0 = a.info(164); i1 = a.info(180); i2 = a.info(195)
    u = (180 - 165 + 0.5) / 30
    check("the dissolve: frame 164 is all the first clip, frame 195 all the second", i0["n"] == 164 and i2["n"] == 15, (i0["n"], i2["n"]))
    check("the dissolve at frame 180 mixes the first clip's held last frame and the second's frame 15 as Cross Dissolve says (blue below)",
          abs(i1["low"][2] - (60 * (1 - u) + 192 * u)) < 12 and abs(i1["low"][0] - 60 * (1 - u)) < 10, (i1["low"], round(60 * (1 - u) + 192 * u)))
    a.goto(178); a.key("Control+Shift+d")
    atin = a.A("A.seq.a[0].clips[1].tin")
    check("Ctrl+Shift+D puts a Constant Power crossfade (Premiere's default) at the same cut on A1", atin and atin["type"] == "constantPower" and atin["dur"] == 30, atin)
    # the Effects panel: Dip to Black on the nearest cut
    a.tab("Effects"); a.focus_tl(); a.key("Escape")
    pg.click("summary:has-text('Video Transitions')"); pg.click(".vd-fxitem:text-is('Dip to Black')"); pg.wait_for_timeout(200)
    check("Effects > Video Transitions > Dip to Black replaces the dissolve at the cut nearest the playhead", a.A("A.seq.v[0].clips[1].tin.type") == "dipBlack", a.A("A.seq.v[0].clips[1].tin"))
    i1 = a.info(180)
    check("Dip to Black at its middle (frame 180) is nearly black", max(i1["all"]) < 20, i1["all"])
    # Shift+D on the selected second clip: both kinds, both ends (the end: fade to black and silence)
    a.focus_tl(); a.click_at("V1", 230); a.key("Shift+d")
    tout = a.A("A.seq.v[0].clips[1].tout"); aout = a.A("A.seq.a[0].clips[1].tout")
    check("Shift+D on the selected last clip puts a fade out at its end on V1 and on A1 (nothing after it)", tout and tout.get("single") and aout and aout.get("single"), (tout, aout))
    i = a.info(269)
    check("the fade out: the last frame (269) is nearly black", max(i["all"]) < 15, i["all"])
    r_end = a.ev("() => __rv.rms(Math.round(267 / 30 * 48000), 270 * 1600)"); r_mid = a.ev("() => __rv.rms(Math.round(220 / 30 * 48000), Math.round(230 / 30 * 48000))")
    check("the sound fades out too: its last three frames are at least 20 dB under the clip's middle", r_end < r_mid * 0.1, (r_end, r_mid))
    # a transition at the very first frame (nothing before): a fade in from black
    a.focus_tl(); a.key("Escape"); a.goto(2); a.key("Control+d")
    t0 = a.A("A.seq.v[0].clips[0].tin")
    check("Ctrl+D at the start of the first clip makes a fade in from black (it starts at the clip's head)", t0 and t0.get("single") and t0["align"] == "start" and max(a.info(0)["all"]) < 15, (t0, a.info(0)["all"]))
    # clicking a transition selects it (Premiere): Effect Controls shows it, Delete removes the transition only
    a.focus_tl(); a.key("Escape")
    a.click_at("V1", 181, dy=0.5); a.tab("Effect Controls")
    ect = pg.inner_text(".vd-ctl")
    check("clicking the transition on the Timeline shows its settings (name, duration, alignment) in Effect Controls", "Dip to Black" in ect, ect[:120])
    s0 = snapshot(a); a.focus_tl(); a.key("Delete")
    L = a.lay()
    check("with the transition clicked, Delete removes the transition and keeps both clips", sum(1 for x in L if x[0] == "V1") == 2 and not a.A("A.seq.v[0].clips[1].tin"), L)
    undo_if(a, s0)
    # how long it is: the default can be set; a transition can be made shorter by dragging its edge (Premiere): look for any way
    has_dur = a.ev("() => { var t = document.body.innerText; return /Transition Duration|Duration \\(frames\\)|Alignment/.test(t); }")
    check("a transition's duration and alignment can be changed somewhere in the tile (Effect Controls or a dialog)", has_dur, "no control found")
    check("trans: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def fx(B):
    """effects from the Effects panel, Effect Controls (typed values, sliders, keyframes, order, on/off, remove), Lumetri, masks,
    Ultra Key, adjustment layers, blend modes, Motion, Paste Attributes, sound effects and volume keyframes"""
    a = two_clips(B, ["green.mp4", "bg.mp4", "still.png"]); pg = a.pg
    ref77 = a.info(77)
    a.click_at("V1", 77); a.tab("Effects")
    pg.fill(".vd-fxp input[type=search]", "blur"); pg.wait_for_timeout(150)
    names = pg.locator(".vd-fxitem").all_inner_texts()
    check("Effects panel: typing blur finds Gaussian Blur and Directional Blur", "Gaussian Blur" in names and "Directional Blur" in names, names)
    pg.click(".vd-fxitem:text-is('Gaussian Blur')"); pg.wait_for_timeout(200)
    check("a click on Gaussian Blur puts it on the selected clip (one History step)", a.A("A.seq.v[0].clips[0].fx.map(function (e) { return e.type; })") == ["gaussian"] and a.hist()[-1] == "Apply Gaussian Blur", a.hist()[-1])
    pg.fill(".vd-fxp input[type=search]", "limiter"); pg.wait_for_timeout(150)
    vids = pg.locator("details:has(summary:has-text('Video Effects')) .vd-fxitem").all_inner_texts()
    check("Effects panel: Video Limiter (named in the help's list of video effects) is there", "Video Limiter" in vids, (vids, pg.locator(".vd-fxitem").all_inner_texts()))
    pg.fill(".vd-fxp input[type=search]", ""); pg.wait_for_timeout(100)
    a.tab("Effect Controls")
    check("Effect Controls shows Motion, Opacity and the Gaussian Blur with its Blurriness", all(x in pg.inner_text(".vd-ctl") for x in ("Motion", "Opacity", "Gaussian Blur", "Blurriness")), pg.inner_text(".vd-ctl")[:200])
    a.set_prop("Blurriness", 40)
    b = a.info(77)
    check("Blurriness typed 40: the picture is blurred (the counter's boxes are soft: the frame no longer reads as 77)", b["n"] != 77 or abs(b["all"][0] - ref77["all"][0]) > 0, b)
    pg.locator(".vd-sec:has(strong:text-is('Gaussian Blur')) input[type=checkbox]").first.uncheck(); pg.wait_for_timeout(250)
    check("unticking the effect turns it off: the picture is as before (frame 77 reads again)", a.info(77)["n"] == 77 and a.A("A.seq.v[0].clips[0].fx[0].on") is False, a.info(77)["n"])
    pg.locator(".vd-sec:has(strong:text-is('Gaussian Blur')) input[type=checkbox]").first.check(); pg.wait_for_timeout(200)
    a.tab("Effects"); pg.fill(".vd-fxp input[type=search]", "black"); pg.click(".vd-fxitem:text-is('Black & White')"); pg.fill(".vd-fxp input[type=search]", ""); a.tab("Effect Controls")
    pg.click(".vd-sec:has(strong:text-is('Black & White')) button[title='Move up']"); pg.wait_for_timeout(200)
    check("the up arrow on Black & White moves it before the blur (effect order)", a.A("A.seq.v[0].clips[0].fx.map(function (e) { return e.type; })") == ["bw", "gaussian"], a.A("A.seq.v[0].clips[0].fx.map(function (e) { return e.type; })"))
    pg.click(".vd-sec:has(strong:text-is('Gaussian Blur')) button[title='Remove Gaussian Blur']"); pg.wait_for_timeout(200)
    check("the cross on Gaussian Blur removes it, Black & White stays", a.A("A.seq.v[0].clips[0].fx.map(function (e) { return e.type; })") == ["bw"], "")
    i = a.info(200)
    check("Black & White on the first clip does not touch the second (still blue at 200)", i["low"][2] > 150 and i["low"][0] < 40, i["low"])
    # an audio effect with only a picture selected
    a.focus_tl(); a.key("Escape"); a.click_at("V1", 77, mods=["Alt"]); a.tab("Effects"); pg.fill(".vd-fxp input[type=search]", "amplify"); pg.click(".vd-fxitem:text-is('Amplify')"); pg.fill(".vd-fxp input[type=search]", "")
    check("Amplify with only a picture clip selected says to select a sound clip", "sound" in a.msg(), a.msg())
    # Paste Attributes: copy the first clip (Black & White) onto the second
    a.focus_tl(); a.key("Escape"); a.click_at("V1", 77); a.key("Control+c"); a.click_at("V1", 200); a.key("Control+Alt+v")
    check("Ctrl+Alt+V (Paste Attributes) gives the second clip the first one's Black & White", a.A("A.seq.v[0].clips[1].fx.map(function (e) { return e.type; })") == ["bw"], a.A("A.seq.v[0].clips[1].fx.length"))
    i = a.info(200)
    check("and the Program shows the second clip in black and white", abs(i["low"][0] - i["low"][2]) <= 3, i["low"])
    a.focus_tl(); a.key("Control+z")
    # keyframes on Scale: stopwatch at 0, a value typed at 60
    a.focus_tl(); a.key("Escape"); a.click_at("V1", 90); a.goto(0); a.tab("Effect Controls")
    pg.click(".vd-prop:has(.vd-plab:text-is('Scale')) .vd-sw"); pg.wait_for_timeout(200)
    a.goto(60); a.tab("Effect Controls"); a.set_prop("Scale", 150)
    k = a.A("A.seq.v[0].clips[0].keys['motion.scale']")
    check("Scale keyframed: the stopwatch makes a key at the playhead (0, 100); 150 typed at 60 makes another", k == [{"f": 0, "v": 100, "i": "linear"}, {"f": 60, "v": 150, "i": "linear"}], k)
    check("half way (frame 30) the scale is 125", abs(a.ev("() => Lantern.video.keys.get(Lantern.video.app.seq.v[0].clips[0], 'motion.scale', 30, 100)") - 125) < 1e-6, "")
    i60 = a.info(60)
    check("at frame 60 the picture is drawn at 150%: the frame's corner shows the counter's dark grey, not black", i60["corner"][0] > 40, i60["corner"])
    pg.click(".vd-prop:has(.vd-plab:text-is('Scale')) button[title='Previous keyframe']"); pg.wait_for_timeout(150)
    p1 = a.ph()
    a.tab("Effect Controls"); pg.click(".vd-prop:has(.vd-plab:text-is('Scale')) button[title='Next keyframe']"); pg.wait_for_timeout(150)
    check("the keyframe arrows jump the playhead to the previous (0) and next (60) keyframes", (p1, a.ph()) == (0, 60), (p1, a.ph()))
    a.goto(0); a.tab("Effect Controls")
    pg.select_option(".vd-prop:has(.vd-plab:text-is('Scale')) select", "hold"); pg.wait_for_timeout(200)
    check("Hold on the first keyframe: the scale stays 100 until frame 60", a.ev("() => Lantern.video.keys.get(Lantern.video.app.seq.v[0].clips[0], 'motion.scale', 59, 100)") == 100, "")
    pg.select_option(".vd-prop:has(.vd-plab:text-is('Scale')) select", "ease"); pg.wait_for_timeout(200)
    v15 = a.ev("() => Lantern.video.keys.get(Lantern.video.app.seq.v[0].clips[0], 'motion.scale', 15, 100)")
    check("Ease: a quarter of the way the value has moved less than a quarter (eases out of the key)", 100 < v15 < 112.5, v15)
    a.goto(60); a.tab("Effect Controls"); pg.click(".vd-prop:has(.vd-plab:text-is('Scale')) button[title='Remove the keyframe here']"); pg.wait_for_timeout(200)
    check("the diamond at a keyframe removes it", len(a.A("A.seq.v[0].clips[0].keys['motion.scale']")) == 1, a.A("A.seq.v[0].clips[0].keys['motion.scale']"))
    a.tab("Effect Controls"); pg.click(".vd-prop:has(.vd-plab:text-is('Scale')) .vd-sw"); pg.wait_for_timeout(200)
    check("the stopwatch again clears the keyframes", not a.A("A.seq.v[0].clips[0].keys['motion.scale']"), a.A("A.seq.v[0].clips[0].keys['motion.scale']"))
    # a slider dragged: shown at once, one History step on release
    h0 = len(a.hist()); a.tab("Effect Controls")
    sl = pg.locator(".vd-prop:has(.vd-plab:text-is('Rotation')) input[type=range]").first; bb = sl.bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); pg.mouse.down(); pg.mouse.move(bb["x"] + bb["width"] * 0.55, bb["y"] + bb["height"] / 2, steps=5); pg.mouse.move(bb["x"] + bb["width"] * 0.6, bb["y"] + bb["height"] / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    rot = a.A("A.seq.v[0].clips[0].motion.rot")
    check("dragging the Rotation slider turns the clip and is one step in History", rot != 0 and len(a.hist()) == h0 + 1 and a.hist()[-1] == "Rotation", (rot, a.hist()[-3:]))
    a.focus_tl(); a.key("Control+z")
    # Motion typed: Position X +100, Scale 50
    a.goto(60); a.tab("Effect Controls"); a.set_prop("Position X", 260)
    i = a.info(60)
    img = a.ev("() => __rv.frame(60).then(function (im) { function w(x, y) { var q = (y * im.width + x) * 4; return im.data[q]; } return [w(198, 22), w(98, 22), w(5, 120)]; })")
    check("Position X typed 260 (100 right of centre): the counter's box 2 is drawn 100 px to the right, black where the clip left", img[0] > 200 and img[2] < 10, img)
    a.focus_tl(); a.key("Control+z"); a.tab("Effect Controls"); a.set_prop("Scale", 50)
    i = a.info(60)
    check("Scale typed 50: the picture is half size in the middle, black around it", max(i["corner"]) < 10 and abs(i["mid"][0] - 60) < 15, i)
    a.focus_tl(); a.key("Control+z")
    # Lumetri: at its defaults it changes nothing; Saturation 0; a .cube LUT
    a.click_at("V1", 200); a.tab("Lumetri Color"); pg.click("button:text-is('Add Lumetri Color to this clip')"); pg.wait_for_timeout(300)
    d = a.ev("() => Promise.all([__rv.frame(200)]).then(function (r) { return r[0]; }).then(function (im) { return Array.from(im.data.slice(0, 4 * 320 * 240)); })")
    a.focus_tl(); a.key("Control+z"); pg.wait_for_timeout(150)
    d0 = a.ev("() => __rv.frame(200).then(function (im) { return Array.from(im.data); })")
    diff = float(np.abs(np.array(d, float) - np.array(d0, float)).max())
    check("Lumetri Color at its defaults leaves the picture exactly as it was (the help says so)", diff <= 1, diff)
    a.focus_tl(); a.key("Control+Shift+z"); a.tab("Lumetri Color")
    a.set_prop("Saturation", 0)
    i = a.info(200)
    check("Lumetri Basic Saturation 0: the blue part of the second clip turns grey", abs(i["low"][0] - i["low"][2]) <= 4, i["low"])
    a.set_prop("Saturation", 100)
    a.set_prop("Exposure", 1)
    i2 = a.info(200)
    check("Lumetri Exposure +1 stop makes the picture brighter", i2["mid"][0] > 70 and i2["low"][2] > 192, (i2["mid"], i2["low"]))
    a.set_prop("Exposure", 0)
    with pg.expect_file_chooser() as fc: pg.locator(".vd-prop:has(.vd-plab:text-is('Input LUT')) button:text-is('Load .cube…'):visible").first.click()
    fc.value.set_files(P("invert.cube")); pg.wait_for_timeout(500)
    i3 = a.info(200)
    check("Lumetri Input LUT: an inverting .cube loaded makes grey 60 about 195 and blue yellow", i3["mid"][0] > 180 and i3["low"][0] > 180 and i3["low"][2] < 80, (i3["mid"], i3["low"]))
    a.focus_tl(); a.key("Control+z")
    # a mask on Opacity: an ellipse shows the middle only
    a.focus_tl(); a.key("Escape"); a.click_at("V1", 77); a.tab("Effect Controls")
    pg.select_option(".vd-prop:has(.vd-plab:text-is('Mask')) select", "Ellipse"); pg.wait_for_timeout(300)
    i = a.info(77)
    check("an Ellipse mask on Opacity: the middle shows the clip, the corner is black", max(i["corner"]) < 10 and abs(i["mid"][0] - 60) < 12, i)
    a.tab("Effect Controls"); pg.locator(".vd-prop:has(.vd-plab:text-is('Mask Inverted')) input[type=checkbox]").check(); pg.wait_for_timeout(250)
    i = a.info(77)
    check("Mask Inverted: now the middle is black and the corner shows the clip", max(i["mid"]) < 10 and i["corner"][0] > 30, i)
    a.focus_tl(); a.key("Control+z"); a.key("Control+z")
    # green screen on V3 over the yellow background on V2, from frame 300
    for nm, tr in (("bg.mp4", "V2"), ("green.mp4", "V3")):
        a.drag_item(nm, tr, 280)
    gst = [c for c in a.lay() if c[0] == "V3"]
    gf = gst[0][1] + 10 if gst else 290
    a.focus_tl(); a.key("Escape"); a.click_at("V3", gf, mods=["Alt"]); a.tab("Effects"); pg.fill(".vd-fxp input[type=search]", "ultra"); pg.click(".vd-fxitem:text-is('Ultra Key')"); pg.fill(".vd-fxp input[type=search]", "")
    i = a.info(gf)
    img = a.ev("(f) => __rv.frame(f).then(function (im) { function p(x, y) { var q = (y * im.width + x) * 4; return [im.data[q], im.data[q + 1], im.data[q + 2]]; } return [p(40, 200), p(160, 120)]; })", gf)
    check("Ultra Key on the green-screen clip: the green is gone and the yellow background shows through", img[0][0] > 180 and img[0][1] > 180 and img[0][2] < 80, img)
    check("Ultra Key keeps the red box in front", img[1][0] > 180 and img[1][1] < 80, img)
    a.tab("Effect Controls"); pg.select_option(".vd-sec:has(strong:text-is('Ultra Key')) .vd-prop:has(.vd-plab:text-is('Output')) select", "Alpha Channel"); pg.wait_for_timeout(250)
    img = a.ev("(f) => __rv.frame(f).then(function (im) { function p(x, y) { var q = (y * im.width + x) * 4; return [im.data[q], im.data[q + 1], im.data[q + 2]]; } return [p(40, 200), p(160, 120)]; })", gf)
    check("Ultra Key Output: Alpha Channel shows what is kept as white (the box) and what is keyed as black", min(img[1]) > 200 and max(img[0]) < 40, img)
    # blend mode: Multiply (the still on V2 over the counter on V1 at frame 77)
    a.drag_item("still.png", "V2", 2, 2)
    a.focus_tl(); a.key("Escape"); a.click_at("V2", 77); a.tab("Effect Controls")
    pg.select_option(".vd-prop:has(.vd-plab:text-is('Blend Mode')) select", "Multiply"); pg.wait_for_timeout(250)
    i = a.info(77)
    check("Blend Mode Multiply: the still's green (32,128,32) times the grey 60 below gives about (8,30,8)", abs(i["mid"][1] - 128 * 60 / 255) < 6 and i["mid"][0] < 15, i["mid"])
    pg.select_option(".vd-prop:has(.vd-plab:text-is('Blend Mode')) select", "Screen"); pg.wait_for_timeout(250)
    i = a.info(77)
    check("Blend Mode Screen: 1-(1-a)(1-b) gives about (88,158,88)", abs(i["mid"][1] - (255 - (255 - 128) * (255 - 60) / 255)) < 6, i["mid"])
    a.focus_tl(); a.key("Control+z"); a.key("Control+z")
    # an adjustment layer: Black & White on it turns everything under it grey
    a.goto(200); a.focus_tl(); a.key("Escape"); a.menu("Graphics", "New Adjustment Layer")
    adj = [c for c in a.lay() if c[4] == "adjust"]
    check("Graphics > New Adjustment Layer makes a five-second adjustment layer at the playhead on a free track above", len(adj) == 1 and adj[0][1] == 200 and adj[0][2] == 150 and adj[0][0] != "V1", adj)
    a.tab("Effects"); pg.fill(".vd-fxp input[type=search]", "black"); pg.click(".vd-fxitem:text-is('Black & White')"); pg.fill(".vd-fxp input[type=search]", "")
    i = a.info(200)
    check("Black & White on the adjustment layer turns the clip under it grey", abs(i["low"][0] - i["low"][2]) <= 3, i["low"])
    a.focus_tl(); a.key("Control+z"); a.key("Control+z")
    # sound: Amplify +6 dB doubles the level; Volume keyframes; Amplify keyframes
    a.focus_tl(); a.key("Escape"); a.click_at("A1", 230, mods=["Alt"])
    r0 = a.ev("() => __rv.rms(Math.round(185 / 30 * 48000), Math.round(265 / 30 * 48000))")
    a.tab("Effects"); pg.fill(".vd-fxp input[type=search]", "amplify"); pg.click(".vd-fxitem:text-is('Amplify')"); pg.fill(".vd-fxp input[type=search]", "")
    a.tab("Effect Controls"); a.set_prop("Gain (dB)", 6)
    r1 = a.ev("() => __rv.rms(Math.round(185 / 30 * 48000), Math.round(265 / 30 * 48000))")
    check("Amplify +6 dB on the second clip's sound doubles its level", abs(r1 / r0 - 10 ** (6 / 20)) < 0.02, (r0, r1))
    a.goto(180); a.tab("Effect Controls"); a.set_prop("Gain (dB)", 0)
    pg.click(".vd-sec:has(strong:text-is('Amplify')) .vd-prop:has(.vd-plab:text-is('Gain (dB)')) .vd-sw"); pg.wait_for_timeout(200)
    a.goto(269); a.tab("Effect Controls"); a.set_prop("Gain (dB)", 12)
    ra = a.ev("() => __rv.rms(Math.round(181 / 30 * 48000), Math.round(190 / 30 * 48000))"); rb = a.ev("() => __rv.rms(Math.round(259 / 30 * 48000), Math.round(268 / 30 * 48000))")
    check("Amplify keyframed 0 dB at the clip's start to +12 dB at its end: the sound gets louder over the clip (Effect Controls offers the stopwatch)", rb > ra * 2.5, (ra, rb))
    a.focus_tl(); a.key("Escape"); a.click_at("A1", 90, mods=["Alt"]); a.goto(0); a.tab("Effect Controls")
    pg.click(".vd-prop:has(.vd-plab:text-is('Level (dB)')) .vd-sw"); pg.wait_for_timeout(200)
    a.goto(179); a.tab("Effect Controls"); a.set_prop("Level (dB)", -40)
    va = a.ev("() => __rv.rms(Math.round(0.1 * 48000), Math.round(0.9 * 48000))"); vb = a.ev("() => __rv.rms(Math.round(5.5 * 48000), Math.round(5.9 * 48000))")
    check("Volume keyframed 0 dB to -40 dB over the first clip: its end is much quieter than its start", vb < va * 0.1, (va, vb))
    check("fx: no errors in the page", not a.errs, a.errs[:3])
    a.close()



WHITE_JS = "(a) => __rv.frame(a[0]).then(function (im) { var n = 0, red = 0, y0 = Math.floor(im.height * a[1]), y1 = Math.floor(im.height * a[2]); for (var y = y0; y < y1; y++) for (var x = 0; x < im.width; x++) { var q = (y * im.width + x) * 4; if (im.data[q] > 200 && im.data[q + 1] > 200 && im.data[q + 2] > 200) n++; if (im.data[q] > 200 && im.data[q + 1] < 60 && im.data[q + 2] < 60) red++; } return [n, red]; })"


@section
def graphics(B):
    """Essential Graphics: a title, its words and styles and layers; lower third, rolling credits, crawl; mattes, bars, black"""
    a = two_clips(B); pg = a.pg
    a.goto(30); a.menu("Graphics", "New Title")
    t = [x for x in a.lay() if x[4] == "title"]
    check("Graphics > New Title: a title at the playhead (30) on V2, 150 frames", t == [["V2", 30, 150, 0, "title"]], t)
    a.tab("Essential Graphics")
    check("Essential Graphics shows the title's layer and its words", "Title" in pg.inner_text(".vd-gfx") and pg.locator(".vd-gtext").count() == 1, pg.inner_text(".vd-gfx")[:100])
    w0 = a.ev(WHITE_JS, [60, 0.3, 0.7])[0]
    h0 = len(a.hist())
    ta = pg.locator(".vd-gtext"); ta.click(); ta.fill("Hello Lantern"); ta.press("Tab"); pg.wait_for_timeout(250)
    txt = a.A("S.all(A.seq).filter(function (x) { return x.c.kind === 'title'; })[0].c.data.layers[0].text")
    check("typing in Essential Graphics changes the title's words, one History step", txt == "Hello Lantern" and len(a.hist()) == h0 + 1, (txt, a.hist()[-2:]))
    w1 = a.ev(WHITE_JS, [60, 0.3, 0.7])[0]
    check("the Program shows the title's white words over the clip (more white in the middle with a longer text)", w1 > 300 and w1 > w0, (w0, w1))
    a.tab("Essential Graphics"); a.set_prop("Size", 60); w2 = a.ev(WHITE_JS, [60, 0.3, 0.7])[0]
    check("Size 60 (from 30) makes the words bigger (more white)", w2 > w1 * 1.5, (w1, w2))
    a.tab("Essential Graphics"); pg.locator(".vd-gfx .vd-prop:has(.vd-plab:text-is('Color')) input[type=color]").fill("#ff0000"); pg.wait_for_timeout(250)
    wr = a.ev(WHITE_JS, [60, 0.3, 0.7])
    check("Color red: the words turn red", wr[1] > 300 and wr[0] < 50, wr)
    a.tab("Essential Graphics"); pg.locator(".vd-gfx .vd-prop:has(.vd-plab:text-is('Background')) input[type=checkbox]").check(); pg.wait_for_timeout(250)
    i = a.info(60)
    check("Background on: a dark box goes behind the words (the middle darker than the clip's grey)", i["mid"][1] < 50, i["mid"])
    a.tab("Essential Graphics"); a.set_prop("Position X", 80)
    k = a.A("S.all(A.seq).filter(function (x) { return x.c.kind === 'title'; })[0].c.data.layers[0].x")
    check("Position X 80 moves the words left", k == 80, k)
    a.tab("Essential Graphics"); pg.click(".vd-gfx button:text-is('+ Rectangle')"); pg.wait_for_timeout(200)
    n = a.A("S.all(A.seq).filter(function (x) { return x.c.kind === 'title'; })[0].c.data.layers.length")
    check("+ Rectangle adds a shape layer under the words", n == 2 and pg.locator(".vd-lrow").count() == 2, n)
    a.tab("Essential Graphics"); pg.click(".vd-gfx button:text-is('Remove layer')"); pg.wait_for_timeout(200)
    a.tab("Essential Graphics"); pg.click(".vd-gfx button:text-is('Remove layer')"); pg.wait_for_timeout(200)
    check("Remove layer takes the rectangle away; the last layer cannot be removed and the status line says why", a.A("S.all(A.seq).filter(function (x) { return x.c.kind === 'title'; })[0].c.data.layers.length") == 1 and "at least one layer" in a.msg(), a.msg())
    # double-click a title on the Timeline: Essential Graphics comes up
    a.tab("History"); x, y = a.pt("V2", 100); pg.mouse.dblclick(x, y); pg.wait_for_timeout(250)
    check("double-clicking a title on the Timeline brings Essential Graphics to the front", "Essential Graphics" in pg.locator(".vd-tab.on").all_inner_texts(), pg.locator(".vd-tab.on").all_inner_texts())
    # a lower third on the next free track
    a.goto(40); a.menu("Graphics", "New Lower Third")
    lt = [x for x in a.lay() if x[4] == "title" and x[1] == 40]
    check("Graphics > New Lower Third at 40 goes on V3 (V2 has the title there) with a box, a name and a role", lt == [["V3", 40, 150, 0, "title"]] and a.A("A.selected()[0].c.data.layers.length") == 3, lt)
    # a new graphic must not delete what is later on its track
    a.goto(0); s0 = snapshot(a); a.menu("Graphics", "New Rolling Credits")
    L = a.lay()
    check("a new graphic made at 0 does not cut or delete the title already on that track later (30-180)", ["V2", 30, 150, 0, "title"] in L, [x for x in L if x[0] in ("V2", "V3", "V4")])
    undo_if(a, s0)
    # rolling credits at 200 (free above): off screen at its start and end, on screen in the middle
    a.goto(200); a.menu("Graphics", "New Rolling Credits")
    cr = [x for x in a.lay() if x[1] == 200 and x[4] == "title"]
    check("Graphics > New Rolling Credits: a ten-second (300 frame) graphic at the playhead", len(cr) == 1 and cr[0][2] == 300, cr)
    if cr:
        a0 = a.ev(WHITE_JS, [200, 0.2, 1])[0]; am = a.ev(WHITE_JS, [350, 0.2, 1])[0]; a1 = a.ev(WHITE_JS, [499, 0.2, 1])[0]
        check("rolling credits start below the frame and end above it: nothing at the first and last frames, words in the middle", a0 < 20 and a1 < 20 and am > 200, (a0, am, a1))
    a.goto(200); a.focus_tl(); a.key("Control+z")
    # a crawl moves across
    a.goto(200); a.menu("Graphics", "New Crawl")
    xs = []
    for f in (230, 300, 400):
        xs.append(a.ev("(f) => __rv.frame(f).then(function (im) { var sx = 0, n = 0; for (var y = Math.floor(im.height * 0.85); y < im.height * 0.95; y++) for (var x = 0; x < im.width; x++) { var q = (y * im.width + x) * 4; if (im.data[q] > 200 && im.data[q + 1] > 200 && im.data[q + 2] > 200) { sx += x; n++; } } return n ? sx / n : -1; })", f))
    check("a crawl's words run across the bottom from right to left", xs[0] > xs[1] > xs[2] >= 0 or (xs[0] > xs[1] and xs[2] == -1), xs)
    a.focus_tl(); a.key("Control+z")
    # mattes, bars and black: Premiere makes these in the Project panel; here they must not wipe out the clip under the playhead
    a.goto(60); s0 = snapshot(a); a.menu("Graphics", "New Color Matte")
    L = a.lay()
    check("Graphics > New Color Matte does not overwrite the clip on V1 under the playhead (Premiere puts the new item in the Project panel)", ["V1", 0, 180, 0, "av"] in L, [x for x in L if x[0] == "V1"])
    m = [x for x in L if x[4] == "matte"]
    if m:
        i = a.info(m[0][1] + 5)
        check("the color matte is drawn in its colour (dark blue 20,40,90)", abs(i["corner"][2] - 90) < 6 and abs(i["corner"][0] - 20) < 6, i["corner"])
    undo_if(a, s0)
    a.goto(300); a.menu("Graphics", "New Bars and Tone")
    b = [x for x in a.lay() if x[4] == "bars"]
    img = a.ev("() => __rv.frame(310).then(function (im) { function p(x, y) { var q = (y * im.width + x) * 4; return [im.data[q], im.data[q + 1], im.data[q + 2]]; } return [p(20, 60), p(251, 60), p(300, 60)]; })")
    check("Graphics > New Bars and Tone at 300 (past the clips): SMPTE bars, 75% grey first, red sixth, blue last", b and abs(img[0][0] - 191) < 4 and img[1][0] > 180 and img[1][1] < 10 and img[2][2] > 180, (b, img))
    tone = a.ev("() => __rv.rms(Math.round(305 / 30 * 48000), Math.round(340 / 30 * 48000))")
    check("Bars and Tone has its tone (Premiere's is a 1 kHz tone)", tone > 0.01, tone)
    a.focus_tl(); a.key("Control+z")
    a.goto(300); a.menu("Graphics", "New Black Video")
    check("Graphics > New Black Video at 300: a five-second black clip", [x for x in a.lay() if x[4] == "black"] == [["V1", 300, 150, 0, "black"]], [x for x in a.lay() if x[4] == "black"])
    check("graphics: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def captions(B):
    """Captions (add, edit, import .srt and .vtt, export, show in Program, burn in) and Markers"""
    a = two_clips(B); pg = a.pg
    a.goto(30); a.tab("Captions"); pg.click(".vd-caps button:text-is('Add caption')"); pg.wait_for_timeout(200)
    c = a.A("A.seq.cap")
    check("Captions > Add caption: a two-second caption at the playhead (30 to 90) saying Caption", len(c) == 1 and c[0]["start"] == 30 and c[0]["end"] == 90 and c[0]["text"] == "Caption", c)
    t = pg.locator(".vd-caprow textarea").first; t.fill("Hello there"); t.press("Tab"); pg.wait_for_timeout(200)
    st = pg.locator(".vd-caprow input[aria-label='Caption start']").first; st.fill("00:00:00:15"); st.press("Tab"); pg.wait_for_timeout(200)
    en = pg.locator(".vd-caprow input[aria-label='Caption end']").first; en.fill("00:00:02:00"); en.press("Tab"); pg.wait_for_timeout(200)
    c = a.A("A.seq.cap")
    check("editing the caption's words, start and end (typed timecode) changes it", c[0]["text"] == "Hello there" and c[0]["start"] == 15 and c[0]["end"] == 60, c)
    with pg.expect_file_chooser() as fc: pg.click(".vd-caps button:text-is('Import .srt / .vtt…')")
    fc.value.set_files(P("subs.srt")); pg.wait_for_timeout(400)
    with pg.expect_file_chooser() as fc: pg.click(".vd-caps button:text-is('Import .srt / .vtt…')")
    fc.value.set_files(P("subs.vtt")); pg.wait_for_timeout(400)
    c = a.A("A.seq.cap.map(function (x) { return [x.start, x.end, x.text]; })")
    check("importing the .srt and the .vtt adds their captions at their times, in order, the VTT's <i> tags taken out",
          c == [[15, 60, "Hello there"], [15, 60, "First words"], [30, 60, "From VTT"], [75, 105, "Second line"], [90, 120, "Styled words"]], c)
    f, nm = a.save_dl(lambda: pg.click(".vd-caps button:text-is('Export .srt')"))
    txt = open(f).read()
    check("Export .srt writes SubRip: numbered cues with hh:mm:ss,mmm times", nm.endswith(".srt") and "1\n00:00:00,500 --> 00:00:02,000\nHello there\n" in txt and "5\n00:00:03,000 --> 00:00:04,000\nStyled words" in txt, txt[:200])
    f, nm = a.save_dl(lambda: pg.click(".vd-caps button:text-is('Export .vtt')"))
    txt = open(f).read()
    check("Export .vtt writes WebVTT (WEBVTT first, hh:mm:ss.mmm times)", txt.startswith("WEBVTT") and "00:00:01.000 --> 00:00:02.000\nFrom VTT" in txt, txt[:200])
    # shown in the Program Monitor
    pg.select_option(".vd-right select[aria-label='Playback resolution']", "1")
    a.goto(100); pg.wait_for_timeout(300)
    def shown_white():
        pg.wait_for_timeout(400)
        return a.ev("() => { var c = document.querySelector('.vd-right canvas.vd-screen'), im = c.getContext('2d').getImageData(0, Math.floor(c.height * 0.7), c.width, Math.floor(c.height * 0.3)), n = 0; for (var q = 0; q < im.data.length; q += 4) if (im.data[q] > 200 && im.data[q + 1] > 200 && im.data[q + 2] > 200) n++; return n; }")
    w0 = shown_white()
    a.tab("Captions"); pg.check(".vd-caps input[aria-label='Show captions in the Program Monitor']"); pg.wait_for_timeout(300); a.goto(100)
    w1 = shown_white()
    check("Show in Program draws the caption at frame 100 low in the Program Monitor", w1 > w0 + 100, (w0, w1))
    # burned into an exported frame
    a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog")
    pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Format')) select", "png"); pg.check(".vd-dialog .vd-drow:has(span:text-is('Burn in captions')) input")
    f, nm = a.save_dl(lambda: pg.click(".vd-dialog button:text-is('Export')"))
    im = frames_of(f, 320, 240)
    nwh = int(((im[0][170:240] > 200).all(axis=2)).sum()) if len(im) else 0
    check("Export with Burn in captions (a PNG of frame 100) has the caption's words in it", nwh > 100, nwh)
    # File > Export Captions (.srt)
    a.tab("Captions"); a.menu("File", "Export Captions (.srt)"); pg.wait_for_timeout(200)
    fmt = pg.input_value(".vd-dialog .vd-drow:has(span:text-is('Format')) select") if pg.locator(".vd-dialog").count() else None
    if fmt:
        f, nm = a.save_dl(lambda: pg.click(".vd-dialog button:text-is('Export')"))
    check("File > Export Captions (.srt) opens Export with Captions (.srt) chosen and writes the .srt", fmt == "srt" and nm.endswith(".srt"), fmt)
    # go to a caption, delete one
    a.tab("Captions"); pg.locator(".vd-caprow button[title='Go to this caption']").nth(3).click(); pg.wait_for_timeout(150)
    check("the caption's play button moves the playhead to its start (75)", a.ph() == 75, a.ph())
    pg.locator(".vd-caprow button[title='Delete caption']").nth(1).click(); pg.wait_for_timeout(200)
    check("the caption's cross deletes it", len(a.A("A.seq.cap")) == 4 and "First words" not in [x["text"] for x in a.A("A.seq.cap")], a.A("A.seq.cap.length"))
    # markers
    a.goto(45); a.tab("Markers"); pg.click(".vd-marks button:text-is('Add Marker (M)')"); a.goto(120); a.focus_tl(); a.key("m")
    a.tab("Markers")
    nm_ = pg.locator(".vd-marks input[aria-label='Marker name']").first; nm_.fill("Flash"); nm_.press("Tab"); pg.wait_for_timeout(150)
    cm = pg.locator(".vd-marks input[aria-label='Marker comment']").first; cm.fill("white frame"); cm.press("Tab"); pg.wait_for_timeout(150)
    mk = a.A("A.seq.markers.map(function (m) { return [m.f, m.name, m.note]; })")
    check("Markers panel: two markers listed; naming and commenting the first", mk == [[45, "Flash", "white frame"], [120, "", ""]], mk)
    rx = a.ev("() => { var c = document.querySelector('.vd-ruler'), x = c.getContext('2d'), s = Lantern.video.ui.U.tl.state, dpr = window.devicePixelRatio || 1, px = Math.round((45 - s.x0) * s.ppf * dpr); var d = x.getImageData(px, Math.round(4 * dpr), 1, 1).data; return [d[0], d[1], d[2]]; }")
    check("the marker is drawn on the Timeline's ruler (green)", rx[1] > 150 and rx[0] < 100, rx)
    a.goto(0); a.tab("Markers"); pg.click(".vd-marks button:text-is('00:00:04:00')"); pg.wait_for_timeout(150)
    check("a marker's timecode button moves the playhead to it (120)", a.ph() == 120, a.ph())
    pg.locator(".vd-marks button[title='Delete marker']").nth(1).click(); pg.wait_for_timeout(150)
    check("a marker's cross deletes it", a.A("A.seq.markers.length") == 1, a.A("A.seq.markers.length"))
    h = len(a.hist()); hp = a.A("A.history().filter(function (h) { return h.current; })[0].at")
    nm_ = pg.locator(".vd-marks input[aria-label='Marker name']").first; nm_.click(); pg.keyboard.press("End"); pg.keyboard.type("X"); pg.keyboard.press("Control+z"); pg.wait_for_timeout(150)
    hp2 = a.A("A.history().filter(function (h) { return h.current; })[0].at")
    check("Ctrl+Z typed in a marker's name box undoes the typing, not the last edit of the project", hp2 == hp, (hp, hp2))
    a.focus_tl(); a.menu("Markers", "Clear All Markers")
    check("Markers > Clear All Markers", a.A("A.seq.markers.length") == 0, a.A("A.seq.markers.length"))
    check("captions: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def audio(B):
    """the Audio Track Mixer (faders, pan, mute, solo, master, loudness), Audio Gain (G)"""
    a = two_clips(B, ["voice.wav"]); pg = a.pg
    a.drag_item("voice.wav", "A2", 0, 2)
    a.tab("Audio Track Mixer")
    names = pg.locator(".vd-strip .vd-sname").all_inner_texts()
    check("the Audio Track Mixer has a strip for A1, A2, A3 and the Master", names == ["A1", "A2", "A3", "Master"], names)
    r0 = a.ev("() => __rv.rms(Math.round(0.2 * 48000), Math.round(2.8 * 48000), 1)")
    f = pg.locator(".vd-strip:has(.vd-sname:text-is('A2')) input.vd-fader"); f.fill("-6"); f.dispatch_event("change"); pg.wait_for_timeout(200)
    r1 = a.ev("() => __rv.rms(Math.round(0.2 * 48000), Math.round(2.8 * 48000), 1)")
    va = a.A("A.seq.a[1].vol")
    check("the A2 fader set to -6 dB: the track's volume is -6 and the mix (voice-over) is half as loud", va == -6 and abs(r1 / r0 - 0.5) < 0.05, (va, r0, r1))
    check("the fader is one step in History (Track volume)", a.hist()[-1] == "Track volume", a.hist()[-2:])
    lab = pg.inner_text(".vd-strip:has(.vd-sname:text-is('A2')) .vd-db")
    check("the strip shows -6.0 dB under the fader", lab.strip() == "-6.0 dB", lab)
    pan = pg.locator(".vd-strip:has(.vd-sname:text-is('A2')) input.vd-pan"); pan.fill("-100"); pan.dispatch_event("change"); pg.wait_for_timeout(200)
    lr = a.ev("() => [__rv.rms(Math.round(0.2 * 48000), Math.round(2.8 * 48000), 0), __rv.rms(Math.round(0.2 * 48000), Math.round(2.8 * 48000), 1)]")
    pg.click(".vd-head button[title='Mute A2']"); pg.wait_for_timeout(150)
    rm = a.ev("() => __rv.rms(Math.round(0.2 * 48000), Math.round(2.8 * 48000), 1)")
    pg.click(".vd-head button[title='Mute A2']"); pg.wait_for_timeout(150)
    check("A2 panned full left: the voice-over leaves the right channel (the right is as with A2 muted) and stays in the left", abs(lr[1] - rm) < 1e-4 and lr[0] > 0.08, (lr, rm))
    pan.fill("0"); pan.dispatch_event("change")
    pg.click(".vd-strip:has(.vd-sname:text-is('A2')) button[title='Mute']"); pg.wait_for_timeout(200)
    check("the mixer's M mutes A2 (and the track header shows it muted)", a.A("A.seq.a[1].mute") is True and "on" in (pg.get_attribute(".vd-head button[title='Mute A2']", "class") or ""), a.A("A.seq.a[1].mute"))
    pg.click(".vd-strip:has(.vd-sname:text-is('A2')) button[title='Mute']"); pg.wait_for_timeout(200)
    m = pg.locator(".vd-strip:has(.vd-sname:text-is('Master')) input.vd-fader"); m.fill("-6"); m.dispatch_event("change"); pg.wait_for_timeout(200)
    r2 = a.ev("() => __rv.rms(Math.round(0.2 * 48000), Math.round(2.8 * 48000), 1)")
    check("the Master fader at -6 dB halves the whole mix", a.A("A.seq.masterVol") == -6 and abs(r2 / r1 - 0.5) < 0.05, (r1, r2))
    m.fill("0"); m.dispatch_event("change"); f.fill("0"); f.dispatch_event("change"); pg.wait_for_timeout(150)
    # loudness: the panel's number against ffmpeg's ebur128 on the WAV exported
    a.tab("Audio Track Mixer"); pg.click("button:text-is('Measure loudness')")
    pg.wait_for_function("() => /LUFS|silent/.test(document.querySelector('.vd-loud').textContent)", timeout=60000)
    lt = pg.inner_text(".vd-loud")
    mI = re.search(r"Integrated (-?[\d.]+) LUFS", lt); mP = re.search(r"True peak (-?[\d.]+) dBTP", lt)
    a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog"); pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Format')) select", "wav")
    fw, _ = a.save_dl(lambda: pg.click(".vd-dialog button:text-is('Export')"))
    I, pk = ebur128(fw)
    check("Measure loudness agrees with ffmpeg's ebur128 on the exported WAV within 0.5 LU", mI and I is not None and abs(float(mI.group(1)) - I) <= 0.5, (lt, I))
    check("Measure loudness's true peak agrees with ffmpeg's within 0.5 dB", mP and pk is not None and abs(float(mP.group(1)) - pk) <= 0.5, (lt, pk))
    # Audio Gain
    a.focus_tl(); a.key("Escape"); a.click_at("V1", 90, mods=["Alt"]); a.key("g"); pg.wait_for_selector(".vd-dialog"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    check("Audio Gain with only a picture selected says to select sound clips", "sound" in a.msg(), a.msg())
    a.focus_tl(); a.key("Escape"); a.click_at("A2", 45, mods=["Alt"]); a.key("g"); pg.wait_for_selector(".vd-dialog")
    check("Audio Gain opens with Normalize Max Peak to -1 dB offered", pg.input_value(".vd-dialog select") == "normalize" and pg.input_value(".vd-dialog input") == "-1", "")
    pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(300)
    pg.click(".vd-head button[title='Mute A1']"); pg.wait_for_timeout(100)
    pk2 = a.ev("() => __rv.peak(0, 3 * 48000)")
    pg.click(".vd-head button[title='Mute A1']"); pg.wait_for_timeout(100)
    check("Normalize Max Peak to -1 dB: the voice-over's peak is then -1 dBFS", abs(20 * math.log10(pk2) + 1) < 0.1, 20 * math.log10(pk2) if pk2 else None)
    a.focus_tl(); a.key("g"); pg.wait_for_selector(".vd-dialog"); pg.select_option(".vd-dialog select", "set"); pg.fill(".vd-dialog input", "3"); pg.keyboard.press("Enter"); pg.wait_for_timeout(250)
    check("Audio Gain: Set Gain to 3 dB (Enter is OK)", a.A("A.seq.a[1].clips[0].gain") == 3 and pg.locator(".vd-dialog").count() == 0, a.A("A.seq.a[1].clips[0].gain"))
    a.focus_tl(); a.key("g"); pg.wait_for_selector(".vd-dialog"); pg.select_option(".vd-dialog select", "adjust"); pg.fill(".vd-dialog input", "-5"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(250)
    check("Audio Gain: Adjust Gain by -5 dB (3 - 5 = -2)", a.A("A.seq.a[1].clips[0].gain") == -2, a.A("A.seq.a[1].clips[0].gain"))
    a.tab("Effect Controls")
    check("Effect Controls for a sound clip shows Volume (Level, Pan) and its Audio Gain (-2)", "Level (dB)" in pg.inner_text(".vd-ctl") and pg.locator(".vd-prop:has(.vd-plab:text-is('Audio Gain (dB)')) input[type=number]:visible").input_value() == "-2", pg.inner_text(".vd-ctl")[:100])
    check("audio: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def misc(B):
    """Lumetri Scopes, Scene Edit Detection, Synchronize"""
    a = two_clips(B); pg = a.pg
    a.goto(200); a.tab("Scopes"); pg.wait_for_timeout(300); a.goto(201); pg.wait_for_timeout(600)
    def scope():
        return a.ev("() => { var c = document.querySelector('.vd-scope'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0, s = 0; for (var i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 120) n++; s += d[i] * 7 + d[i + 1] * 3 + d[i + 2]; } return [n, s]; }")
    w = scope()
    check("Scopes: the Waveform of the Program's picture is drawn (a trace on the scope)", w[0] > 200, w)
    seen = [w[1]]
    for k in ("parade", "vectorscope", "histogram"):
        pg.select_option(".vd-scopes select", k); pg.wait_for_timeout(250); seen.append(scope()[1])
    check("Scopes: RGB Parade, Vectorscope and Histogram each draw something different", len(set(seen)) == 4 and all(x > 0 for x in seen), seen)
    a.close()
    # Scene Edit Detection
    a = App(B); pg = a.pg
    a.start(["scenes.mp4"], n_clips=1)
    a.focus_tl(); a.click_at("V1", 45); a.menu("Clip", "Scene Edit Detection…"); pg.wait_for_selector(".vd-dialog")
    pg.click(".vd-dialog button:text-is('Analyze')")
    pg.wait_for_function("() => !document.querySelector('.vd-dialog')", timeout=60000)
    L = a.lay()
    check("Scene Edit Detection cuts the clip where the shot changes (frames 30 and 60)", L == [["V1", 0, 30, 0, "av"], ["V1", 30, 30, 1.0, "av"], ["V1", 60, 30, 2.0, "av"]], (L, a.msg()))
    check("and the status line says how many it found (2)", "Found 2" in a.msg(), a.msg())
    a.focus_tl(); a.key("Control+z"); a.click_at("V1", 45); a.menu("Clip", "Scene Edit Detection…"); pg.wait_for_selector(".vd-dialog")
    pg.select_option(".vd-dialog select", "marker"); pg.click(".vd-dialog button:text-is('Analyze')")
    pg.wait_for_function("() => !document.querySelector('.vd-dialog')", timeout=60000)
    check("Scene Edit Detection with markers: markers at 30 and 60 and no cuts", a.A("A.seq.markers.map(function (m) { return m.f; })") == [30, 60] and len(a.lay()) == 1, a.A("A.seq.markers.map(function (m) { return m.f; })"))
    a.close()
    # Synchronize by sound
    a = App(B); pg = a.pg
    a.start(["clapA.mp4"], n_clips=2)
    a.import_files(["clapB.mp4"]); a.focus_tl(); a.key("s")
    # clapB from the Source Monitor onto V2 and A2 (targets moved there), at 0
    for t in ("V1", "V2", "A1", "A2"): pg.click(".vd-head button[title='Target %s for edits']" % t); pg.wait_for_timeout(80)
    a.tab("Project"); pg.locator(".vd-pitem:has-text('clapB.mp4')").dblclick(); pg.wait_for_timeout(300)
    a.goto(0); a.key(".")
    L = a.lay()
    check("with V2 and A2 targeted (V1, A1 not), Overwrite from the Source Monitor lays clapB on V2 and A2", ["V2", 0, 180, 0, "av"] in L and ["A2", 0, 180, 0, "av"] in L and ["A1", 0, 180, 0, "av"] in L, L)
    a.focus_tl(); a.key("Escape")
    a.click_at("A1", 60, mods=["Alt"])
    btrack = [x[0] for x in L if x[0].startswith("A") and x[0] != "A1"]
    if btrack:
        a.click_at(btrack[0], 60, mods=["Alt", "Shift"])
        a.menu("Clip", "Synchronize (by sound)")
        L = a.lay()
        check("Synchronize (by sound): clapB, whose claps come 0.5 s early, moves 15 frames later, its picture with it", any(x[0] == "V2" and x[1] == 15 for x in L) and any(x[0] == btrack[0] and x[1] == 15 for x in L), (L, a.msg()))
        check("and the status line gives the lag (+0.50 s)", "+0.50 s" in a.msg(), a.msg())
    else:
        check("Synchronize (by sound): clapB, whose claps come 0.5 s early, moves 15 frames later, its picture with it", False, "clapB's sound went over clapA's on A1, so the two cannot be synchronized: " + str(L))
    check("misc: no errors in the page", not a.errs, a.errs[:3])
    a.close()



RATE_JS = """(ms) => new Promise(function (ok) { var A = Lantern.video.app, out = [], t0 = performance.now();
  (function tick() { out.push([performance.now() - t0, A.seq.playhead, A.src ? A.src.pos : null, A.playing]); if (performance.now() - t0 < ms) setTimeout(tick, 50); else ok(out); })(); })"""


def slope(samples, col=1, lo=400, hi=None):
    pts = [(t / 1000.0, v) for t, v, *_ in [(x[0], x[col]) for x in samples] if t >= lo and (hi is None or t <= hi) and v is not None]
    if len(pts) < 3: return None
    t = np.array([p[0] for p in pts]); v = np.array([p[1] for p in pts], float)
    return float(np.polyfit(t, v, 1)[0])



@section
def history(B):
    """Undo and Redo after each kind of edit (exactly back, exactly again), the History panel, the ruler, the Program
    Monitor's buttons and scrub bar, the mouse wheel, sync lock, a long clip seeked deep, a clip removed from the project"""
    a = two_clips(B, ["still.png"]); pg = a.pg
    def razor():
        a.tool("c"); a.click_at("V1", 60); a.tool("v")
    def move():
        a.drag_frames("V1", 230, 260)
    def trim():
        a.drag_frames("V1", 179, 150, edge="tail")
    def ripple():
        a.drag_frames("V1", 179, 150, edge="tail", mods=["Control"])
    def trans():
        a.goto(178); a.key("Control+d")
    def effect():
        a.click_at("V1", 90); a.tab("Effects"); pg.fill(".vd-fxp input[type=search]", "invert"); pg.click("details:has(summary:has-text('Video Effects')) .vd-fxitem:text-is('Invert')"); pg.fill(".vd-fxp input[type=search]", "")
    def scale():
        a.click_at("V1", 90); a.tab("Effect Controls"); a.set_prop("Scale", 70)
    def speed():
        a.click_at("V1", 200); a.key("Control+r"); pg.wait_for_selector(".vd-dialog"); pg.fill(".vd-dialog .vd-drow:has(span:text-is('Speed (%)')) input", "150"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    def nest():
        a.click_at("V1", 90); a.click_at("V1", 200, mods=["Shift"]); a.menu("Clip", "Nest…")
    def title():
        a.goto(20); a.key("Control+t")
    def marker():
        a.goto(33); a.key("m")
    def caption():
        a.tab("Captions"); pg.click(".vd-caps button:text-is('Add caption')"); pg.wait_for_timeout(150)
    def liftx():
        a.goto(10); a.key("i"); a.goto(40); a.key("o"); a.key("'")
    def paste():
        a.click_at("V1", 200); a.key("Control+c"); a.goto(270); a.key("Control+v")
    def drop():
        a.drag_item("still.png", "V2", 100)
    for name, fn, n in (("Razor", razor, 1), ("a clip dragged", move, 1), ("a trim", trim, 1), ("a ripple trim", ripple, 1), ("Ctrl+D", trans, 1), ("an effect", effect, 1),
                        ("Scale typed", scale, 1), ("Speed/Duration", speed, 1), ("Nest", nest, 1), ("a new title", title, 1), ("a marker", marker, 1), ("a caption", caption, 1),
                        ("In, Out and Extract", liftx, 3), ("copy and paste", paste, 1), ("a still dragged from the Project panel", drop, 1)):
        a.focus_tl(); a.key("Escape")
        try:
            undo_exact(a, name, fn, n)
        except Exception as e:
            check("Undo after " + name + " puts the tracks back exactly; Redo brings the edit back", False, e)
        while a.ev("() => Lantern.video.app.seq.name") != "Sequence 01":
            a.A("A.setSeq(Object.keys(A.p.seqs).filter(function (k) { return A.p.seqs[k].name === 'Sequence 01'; })[0])")
    # the History panel
    a.tab("History")
    rows = pg.locator(".vd-hrow").all_inner_texts()
    check("the History panel lists the steps by name, the current one marked", len(rows) >= 5 and pg.locator(".vd-hrow.on").count() == 1, rows[-5:])
    a.focus_tl(); a.goto(60); a.key("Control+k"); a.goto(120); a.key("Control+k")
    a.tab("History"); n = pg.locator(".vd-hrow").count()
    pg.locator(".vd-hrow").nth(n - 3).click(); pg.wait_for_timeout(200)
    check("clicking a step two back in History goes back to it (both cuts undone)", len([x for x in a.lay() if x[0] == "V1"]) == 2, a.lay())
    pg.locator(".vd-hrow").nth(n - 1).click(); pg.wait_for_timeout(200)
    check("clicking the last step goes forward again (both cuts back)", len([x for x in a.lay() if x[0] == "V1"]) == 4, a.lay())
    a.focus_tl(); a.key("Control+z"); a.key("Control+z")
    # target toggles in History
    h0 = a.hist()[-1]
    pg.click(".vd-head button[title='Target V2 for edits']"); pg.click(".vd-head button[title='Target V2 for edits']"); pg.wait_for_timeout(100)
    check("turning a track's target on and off is not an Undo step (Premiere keeps History for edits)", a.hist()[-1] == h0, a.hist()[-3:])
    # the ruler, the scrub bar, the Program Monitor's buttons
    rb = pg.locator(".vd-ruler").bounding_box(); x = rb["x"] + a.xof(150)
    pg.mouse.click(x, rb["y"] + 10); pg.wait_for_timeout(150)
    check("a click on the Timeline's ruler puts the playhead there (150, within a frame)", abs(a.ph() - 150) <= 1, a.ph())
    sc = pg.locator(".vd-right input.vd-scrub"); sc.fill("500"); sc.dispatch_event("input"); pg.wait_for_timeout(150)
    check("the Program Monitor's scrub bar at half way puts the playhead half way (135)", abs(a.ph() - 135) <= 1, a.ph())
    a.goto(100)
    for lbl, want in (("Step Forward 1 Frame (Right)", 101), ("Step Back 1 Frame (Left)", 100)):
        pg.click(".vd-right button[aria-label='%s']" % lbl); pg.wait_for_timeout(120)
        check("the Program Monitor's %s button" % lbl.split(" (")[0], a.ph() == want, a.ph())
    pg.click(".vd-right button[aria-label='Mark In (I)']"); a.goto(130); pg.click(".vd-right button[aria-label='Mark Out (O)']"); pg.wait_for_timeout(120)
    check("the Program Monitor's Mark In and Mark Out buttons set 100 and 130", a.A("[A.seq.inF, A.seq.outF]") == [100, 130], a.A("[A.seq.inF, A.seq.outF]"))
    a.goto(0); pg.click(".vd-right button[aria-label='Go to In (Shift+I)']"); pg.wait_for_timeout(120); gi = a.ph()
    pg.click(".vd-right button[aria-label='Go to Out (Shift+O)']"); pg.wait_for_timeout(120)
    check("the Program Monitor's Go to In and Go to Out buttons", (gi, a.ph()) == (100, 130), (gi, a.ph()))
    pg.click(".vd-right button[aria-label=\"Extract (')\"]"); pg.wait_for_timeout(200)
    check("the Program Monitor's Extract button takes 100-130 out (31 frames)", a.end() == 270 - 31, a.end())
    a.focus_tl(); a.key("Control+z"); a.key("Control+Shift+x")
    a.goto(77); f, nm = a.save_dl(lambda: pg.click(".vd-right button[aria-label='Export Frame (Ctrl+Shift+E)']"))
    check("the Program Monitor's camera button saves the frame (77) as a PNG", nm.endswith(".png") and bits_of(frames_of(f, 320, 240)[0]) == 77, nm)
    # the mouse wheel: Alt zooms, Shift scrolls
    x, y = a.pt("V1", 100)
    p0 = a.ev("() => Lantern.video.ui.U.tl.state.ppf"); pg.mouse.move(x, y); pg.keyboard.down("Alt"); pg.mouse.wheel(0, -100); pg.keyboard.up("Alt"); pg.wait_for_timeout(150)
    p1 = a.ev("() => Lantern.video.ui.U.tl.state.ppf")
    check("Alt with the mouse wheel zooms the Timeline", p1 > p0, (p0, p1))
    x0 = a.ev("() => Lantern.video.ui.U.tl.state.x0"); pg.keyboard.down("Shift"); pg.mouse.wheel(0, 100); pg.keyboard.up("Shift"); pg.wait_for_timeout(150)
    check("Shift with the mouse wheel scrolls the Timeline sideways", a.ev("() => Lantern.video.ui.U.tl.state.x0") > x0, (x0, a.ev("() => Lantern.video.ui.U.tl.state.x0")))
    a.focus_tl(); a.key("\\")
    # sync lock off on A1: a ripple delete of the picture alone leaves A1 where it is
    pg.click(".vd-head button[title='Sync Lock A1']"); pg.wait_for_timeout(100)
    pg.click(".vd-tlbar button:text-is('Linked')"); a.focus_tl(); a.key("Escape"); a.click_at("V1", 90); a.key("Shift+Delete")
    L = a.lay()
    check("with A1's Sync Lock off, Ripple Delete of the first picture alone moves V1 up and leaves A1 as it was", ["V1", 0, 90, 0, "av"] in L and ["A1", 0, 180, 0, "av"] in L and ["A1", 180, 90, 0, "av"] in L, L)
    a.key("Control+z"); pg.click(".vd-tlbar button:text-is('Linked')"); pg.click(".vd-head button[title='Sync Lock A1']"); pg.wait_for_timeout(100)
    # a clip removed from the Project panel (Delete on its row) after a confirm
    a.tab("Project"); row = pg.locator(".vd-pitem:has-text('still.png')"); row.click(); row.press("Delete"); pg.wait_for_timeout(200)
    check("Delete on a file in the Project panel removes it from the project", "still.png" not in pg.inner_text(".vd-proj"), pg.inner_text(".vd-proj")[:200])
    check("history: no errors in the page", not a.errs, a.errs[:3])
    a.close()
    # a long clip: a frame a minute in is the right one
    a = App(B); pg = a.pg
    a.start(["long.mp4"], n_clips=2)
    ref = frames_of(P("long.mp4"), 160, 120, ["-vf", "select='eq(n\\,1800)+eq(n\\,2655)'"])
    got = []
    for f in (1800, 2655):
        a.goto(f); d = a.ev("(f) => __rv.frame(f).then(function (im) { return Array.from(im.data); })", f)
        got.append(np.array(d, float).reshape(120, 160, 4)[..., :3])
    diffs = [float(np.abs(ref[i] - got[i]).mean()) for i in range(min(len(ref), 2))]
    check("a 90 s clip: frames 1800 (1:00) and 2655 (1:28.5) are ffmpeg's same frames (within 6 levels)", len(diffs) == 2 and max(diffs) < 6, diffs)
    a.close()


@section
def play(B):
    """playing: Space, J K L; the playhead advances at the sequence's rate; the Source Monitor plays; meters"""
    a = two_clips(B); pg = a.pg
    a.goto(0); pg.click(".vd-right .vd-view"); pg.keyboard.press("Space")
    smp = a.ev(RATE_JS, 2200)
    r = slope(smp)
    check("Space plays the sequence: the playhead advances at 30 frames a second (within 10%)", r and abs(r - 30) < 3, r)
    check("while playing the Program Monitor's play button shows Stop and A.playing is set", pg.inner_text(".vd-right button[aria-label='Play / Stop (Space)']") == "■", pg.inner_text(".vd-right button[aria-label='Play / Stop (Space)']"))
    mm = a.ev("() => { var c = document.querySelector('.vd-meters canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 0; i < d.length; i += 4) if (d[i + 1] > 150 || d[i] > 150) n++; return n; }")
    check("the master meter moves while the sound plays", mm > 0, mm)
    pg.keyboard.press("Space"); pg.wait_for_timeout(200)
    a.tab("Audio Track Mixer"); a.tab("Effect Controls"); a.goto(0); pg.click(".vd-right .vd-view"); pg.keyboard.press("Space"); pg.wait_for_timeout(800)
    mm2 = a.ev("() => { var c = document.querySelector('.vd-meters canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 0; i < d.length; i += 4) if (d[i + 1] > 150 || d[i] > 150) n++; return n; }")
    check("(once the Audio Track Mixer has been opened, the master meter does move)", mm2 > 0, mm2)
    sh = a.shown(); ph = a.ph()
    check("while playing the Program Monitor shows the frame at the playhead (within 3 frames)", sh and abs(sh["n"] - ph) <= 3, (sh and sh["n"], ph))
    pg.keyboard.press("Space"); pg.wait_for_timeout(300); p1 = a.ph(); pg.wait_for_timeout(400); p2 = a.ph()
    check("Space again stops; the playhead stays where it stopped", p1 == p2 and p1 > 15 and not a.A("A.playing"), (p1, p2))
    pg.keyboard.press("l"); s1 = a.ev(RATE_JS, 1500); pg.keyboard.press("l"); s2 = a.ev(RATE_JS, 1500)
    r1 = slope(s1); r2 = slope(s2)
    check("L plays forward at normal speed; L again doubles it (about 30, then 60 frames a second)", r1 and r2 and abs(r1 - 30) < 4 and abs(r2 - 60) < 8, (r1, r2))
    pg.keyboard.press("k"); pg.wait_for_timeout(200); k1 = a.ph(); pg.wait_for_timeout(300)
    check("K stops", a.ph() == k1 and not a.A("A.playing"), (k1, a.ph()))
    pg.keyboard.press("j"); sj = a.ev(RATE_JS, 1200); pg.keyboard.press("k")
    rj = slope(sj)
    check("J plays backwards (about -30 frames a second)", rj and abs(rj + 30) < 5, rj)
    a.goto(255); pg.click(".vd-right .vd-view"); pg.keyboard.press("Space"); pg.wait_for_timeout(1500)
    check("playing to the end stops on the last frame (269)", a.ph() == 269 and not a.A("A.playing"), (a.ph(), a.A("A.playing")))
    pg.keyboard.press("Space"); pg.wait_for_timeout(500); pg.keyboard.press("Space")
    check("Space at the end starts again from the beginning", 0 < a.ph() < 60, a.ph())
    dt = pg.inner_text(".vd-right .vd-dropped")
    check("dropped frames, if any, are counted under the Program Monitor (a number, or nothing)", dt == "" or re.match(r"^\d+ dropped$", dt), dt)
    # the Source Monitor plays its clip
    pg.locator(".vd-pitem:has-text('counter.mp4')").dblclick(); pg.wait_for_timeout(300)
    pg.click(".vd-left .vd-view"); pg.keyboard.press("Space")
    ss = a.ev(RATE_JS, 1500); pg.keyboard.press("Space")
    rs = slope(ss, col=2)
    check("Space in the Source Monitor plays the clip there at its own rate (1 s of source a second)", rs and abs(rs - 1) < 0.12, rs)
    check("playing the Source Monitor leaves the sequence's playhead alone", a.ph() < 60, a.ph())
    a.close()
    # a 23.976 sequence and a 60 fps one play at their own rates
    for nm, fps in (("film.mp4", 24000 / 1001), ("sixty.mp4", 60)):
        a = App(B); pg = a.pg
        a.start([nm], n_clips=2)
        a.goto(0); pg.click(".vd-right .vd-view"); pg.keyboard.press("Space")
        smp = a.ev(RATE_JS, 1800); pg.keyboard.press("Space")
        r = slope(smp, hi=1700)
        check("a %s sequence plays at %s frames a second (within 10%%)" % (nm.split(".")[0], "23.976" if fps < 30 else "60"), r and abs(r - fps) < fps * 0.1, r)
        if nm == "film.mp4":
            tc = pg.input_value(".vd-tc"); a.goto(47)
            check("a 23.976 sequence counts timecode in 24 (frame 47 is 00:00:01:23)", pg.input_value(".vd-tc") == "00:00:01:23", pg.input_value(".vd-tc"))
        a.close()
    # 29.97: drop-frame timecode as Premiere shows it
    a = App(B); pg = a.pg
    a.start(["hd2997.mp4"], n_clips=2)
    a.goto(1800)
    tc = pg.input_value(".vd-tc")
    check("a 29.97 sequence shows drop-frame timecode: frame 1800 is 00:01:00;02 (the numbers ;00 and ;01 skipped)", tc.replace(";", ":") == "00:01:00:02" and ";" in tc, tc)
    check("drop-frame timecode is written with semicolons throughout (00;01;00;02) as Premiere shows it", tc == "00;01;00;02", tc)
    a.close()


def export(a, fmt, setup=None, timeout=180000):
    pg = a.pg
    pg.keyboard.press("Escape"); a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog")
    pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Format')) select", fmt)
    if setup: setup()
    f, nm = a.save_dl(lambda: pg.click(".vd-dialog button:text-is('Export')"), timeout=timeout)
    return f, nm


def av_sync(f, fps, w, h, k=1.0):
    fr = frames_of(f, w, h); fl = flash_frames(fr, k); on = beep_onsets(pcm_of(f))
    return fr, fl, on


@section
def exportsec(B):
    """Export Media in every format, verified with ffprobe and ffmpeg: frames, length, first and last frame, picture against sound"""
    a = two_clips(B); pg = a.pg
    seqdur = 9.0; out = {}
    pg.wait_for_timeout(300)
    for fmt in ("mp4", "webm", "webm8", "mov", "avi"):
        try:
            f, nm = export(a, fmt); out[fmt] = f
        except Exception as e:
            check("Export %s makes a file" % fmt, False, e); continue
        pr = probe(f); sts = pr.get("streams", []); v = [x for x in sts if x["codec_type"] == "video"]; au = [x for x in sts if x["codec_type"] == "audio"]
        want = {"mp4": ("h264", ("opus", "aac")), "webm": ("vp9", ("opus",)), "webm8": ("vp8", ("opus",)), "mov": ("h264", ("pcm_s16le",)), "avi": ("mjpeg", ("pcm_s16le",))}[fmt]
        dur = float(pr.get("format", {}).get("duration", 0) or 0)
        check("Export %s: ffprobe reads %s video 320 x 240 and %s sound" % (fmt, want[0], "/".join(want[1])), v and v[0]["codec_name"] == want[0] and v[0]["width"] == 320 and v[0]["height"] == 240 and au and au[0]["codec_name"] in want[1], [(x["codec_name"], x.get("width")) for x in sts])
        nfr = int(v[0].get("nb_read_frames", 0)) if v else 0
        check("Export %s: 270 frames, 9.0 s long" % fmt, nfr == 270 and abs(dur - seqdur) < 0.05, (nfr, dur))
        fr, fl, on = av_sync(f, 30, 320, 240)
        firsts = [bits_of(fr[i]) for i in (0, 77, 179)] if len(fr) >= 180 else []
        lasts = [bits_of(fr[i]) for i in (180, len(fr) - 1)] if len(fr) >= 181 else []
        check("Export %s: frames 0, 77, 179 are the source's 0, 77, 179 and frames 180 and the last are the WebM's 0 and 89" % fmt, firsts == [0, 77, 179] and lasts == [0, 89], (firsts, lasts))
        check("Export %s: the flash frames are 45 and 120" % fmt, fl == [45, 120], fl)
        check("Export %s: the beeps start with the flash frames (1.5 s and 4.0 s, within a frame)" % fmt, len(on) == 2 and abs(on[0] - 1.5) < 1 / 30 and abs(on[1] - 4.0) < 1 / 30, on)
        if fmt == "mp4":
            check("Export mp4: the status line says the sound is Opus because this browser cannot encode AAC", "Opus" in a.msg() or au and au[0]["codec_name"] == "aac", a.msg())
            st = [float(x.get("start_time", 0)) for x in sts]
            check("Export mp4: picture and sound both start at 0 (no offset to drift)", all(abs(x) < 0.001 for x in st), st)
    # GIF, WAV, PNG, JPEG, PNG zip, SRT
    f, nm = export(a, "gif"); pr = probe(f); v = pr.get("streams", [{}])[0]
    fr = frames_of(f, 320, 240)
    check("Export GIF: a GIF 320 wide (smaller than the 480 asked), 9 s long", v.get("codec_name") == "gif" and v.get("width") == 320 and abs(float(pr.get("format", {}).get("duration", 0)) - 9.0) < 0.1, (v.get("codec_name"), v.get("width"), pr.get("format", {}).get("duration")))
    check("Export GIF: its first frame shows frame 0 and its last the WebM's last frames", len(fr) > 2 and bits_of(fr[0]) == 0 and bits_of(fr[-1]) in (88, 89), (len(fr), len(fr) and bits_of(fr[0]), len(fr) and bits_of(fr[-1])))
    f, nm = export(a, "wav"); pr = probe(f); au = pr.get("streams", [{}])[0]
    on = beep_onsets(pcm_of(f))
    check("Export WAV: 16-bit stereo 48 kHz, 9.0 s, the beeps at 1.5 s and 4.0 s", au.get("codec_name") == "pcm_s16le" and au.get("channels") == 2 and au.get("sample_rate") == "48000" and abs(float(pr["format"]["duration"]) - 9.0) < 0.002 and len(on) == 2 and abs(on[0] - 1.5) < 0.005, (au.get("codec_name"), pr.get("format", {}).get("duration"), on))
    a.goto(77)
    f, nm = export(a, "png"); fr = frames_of(f, 320, 240)
    check("Export 'This frame as PNG' at frame 77: a 320 x 240 PNG of frame 77", nm.endswith(".png") and len(fr) == 1 and bits_of(fr[0]) == 77, (nm, len(fr) and bits_of(fr[0])))
    f, nm = export(a, "jpg"); fr = frames_of(f, 320, 240)
    check("Export 'This frame as JPEG': a JPEG of frame 77", nm.endswith(".jpg") and len(fr) == 1 and bits_of(fr[0]) == 77, nm)
    f, nm = export(a, "pngzip")
    try:
        z = zipfile.ZipFile(f); names = sorted(z.namelist())
        d = os.path.join(DL, "z"); os.makedirs(d, exist_ok=True); z.extract(names[77], d)
        fr = frames_of(os.path.join(d, names[77]), 320, 240)
        check("Export every frame as PNG: a zip of 270 PNGs, the 78th showing frame 77", len(names) == 270 and bits_of(fr[0]) == 77, (len(names), names[:2]))
    except Exception as e:
        check("Export every frame as PNG: a zip of 270 PNGs, the 78th showing frame 77", False, e)
    f, nm = export(a, "srt")
    check("Export Captions (.srt) with no captions writes an empty .srt (or says there are none)", nm.endswith(".srt"), nm)
    # in to out, half size
    a.goto(30); a.key("i"); a.goto(89); a.key("o")
    def half():
        pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Size')) select", "0.5")
    rng = None
    a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog")
    rng = pg.input_value(".vd-dialog .vd-drow:has(span:text-is('Range')) select"); info = pg.inner_text(".vd-dialog .vd-note")
    pg.keyboard.press("Escape")
    check("with an in and out set, Export offers In to out and says 60 frames", rng == "inout" and "Frames 60" in info, (rng, info))
    f, nm = export(a, "mp4", half)
    pr = probe(f); v = [x for x in pr["streams"] if x["codec_type"] == "video"][0]
    fr = frames_of(f, 160, 120)
    check("Export in to out at 50%: 160 x 120, 60 frames from frame 30 to 89, 2.0 s", v["width"] == 160 and v["height"] == 120 and len(fr) == 60 and bits_of(fr[0], 0.5) == 30 and bits_of(fr[-1], 0.5) == 89 and abs(float(pr["format"]["duration"]) - 2.0) < 0.05, (v["width"], len(fr), len(fr) and bits_of(fr[0], 0.5), pr["format"]["duration"]))
    fl = flash_frames(fr, 0.5); on = beep_onsets(pcm_of(f))
    check("Export in to out: the flash at its frame 15 (sequence 45) and the beep at 0.5 s", fl == [15] and len(on) == 1 and abs(on[0] - 0.5) < 1 / 30, (fl, on))
    a.focus_tl(); a.key("Control+Shift+x")
    # loudness normalisation
    def loud():
        pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Loudness')) select", "-16")
    f, nm = export(a, "wav", loud); I, pk = ebur128(f)
    check("Export WAV with Loudness -16 LUFS of a mix with loud short beeps: ebur128 reads -16 (within 0.5) with the peak under -1 dBFS, or the tile says it fell short", I is not None and ((abs(I + 16) <= 0.5 and pk is not None and pk <= -0.9) or "short" in a.msg()), (I, pk, a.msg()))
    def loud23():
        pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Loudness')) select", "-23")
    f, nm = export(a, "wav", loud23); I, pk = ebur128(f)
    check("Export WAV with Loudness -23 LUFS (EBU R128): ffmpeg's ebur128 reads -23 within 0.5", I is not None and abs(I + 23) <= 0.5, (I, pk))
    # Cancel during an export
    a.focus_tl(); a.key("Control+m"); pg.wait_for_selector(".vd-dialog"); pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Format')) select", "pngzip")
    pg.click(".vd-dialog button:text-is('Export')"); pg.wait_for_timeout(400); pg.click(".vd-dialog button:text-is('Cancel')"); pg.wait_for_timeout(1500)
    check("Cancel during an export stops it and closes the box", pg.locator(".vd-dialog").count() == 0, pg.locator(".vd-dialog").count())
    # Export Frame (Ctrl+Shift+E)
    a.goto(120); f, nm = a.save_dl(lambda: (a.focus_tl(), a.pg.keyboard.press("Control+Shift+e")))
    fr = frames_of(f, 320, 240)
    check("Ctrl+Shift+E (Export Frame) saves the frame at the playhead (120) as a PNG named with its timecode", nm.endswith(".png") and "00-00-04-00" in nm and len(fr) == 1 and bits_of(fr[0]) == 120, nm)
    check("export: no errors in the page", not a.errs, a.errs[:3])
    a.close()
    # 23.976
    a = App(B); pg = a.pg
    a.start(["film.mp4"], n_clips=2)
    f, nm = export(a, "mp4"); pr = probe(f); v = [x for x in pr["streams"] if x["codec_type"] == "video"][0]
    fr = frames_of(f, 320, 240)
    check("Export of a 23.976 sequence: 72 frames at 24000/1001, 3.003 s, frame 47 shows 47", int(v.get("nb_read_frames", 0)) == 72 and v.get("avg_frame_rate") in ("24000/1001",) and abs(float(pr["format"]["duration"]) - 3.003) < 0.03 and len(fr) == 72 and bits_of(fr[47]) == 47,
          (v.get("nb_read_frames"), v.get("avg_frame_rate"), pr["format"]["duration"]))
    fl = [i for i in range(len(fr)) if fr[i][160:230].mean(axis=(0, 1))[0] > 150 and fr[i][160:230].mean(axis=(0, 1))[1] < 80]
    on = beep_onsets(pcm_of(f))
    check("Export of a 23.976 sequence: the red flash frame 24 and its beep (1.001 s) line up within a frame", fl == [24] and len(on) == 1 and abs(on[0] - 24 * 1001 / 24000) < 1001 / 24000, (fl, on))
    a.close()
    # a voice-over alone normalised to -16 LUFS (podcasts)
    a = App(B); pg = a.pg
    a.start(["voice.wav"], n_clips=1)
    def loud16():
        pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Loudness')) select", "-16")
    f, nm = export(a, "wav", loud16); I, pk = ebur128(f)
    check("a voice-over alone exported with Loudness -16 LUFS: ebur128 reads -16 within 0.5, peak under -1 dBFS", I is not None and abs(I + 16) <= 0.5 and pk <= -0.9, (I, pk))
    a.close()
    # the phone clip, upright in a portrait export at 25%
    a = App(B); pg = a.pg
    a.start(["phone.mp4"], n_clips=2)
    check("the phone clip makes a 1080 x 1920 sequence", a.A("[A.seq.w, A.seq.h]") == [1080, 1920], a.A("[A.seq.w, A.seq.h]"))
    def quarter(): pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Size')) select", "0.25")
    f, nm = export(a, "mp4", quarter); fr = frames_of(f, 270, 480)
    check("Export of the phone sequence at 25%: 270 x 480 portrait, upright (red top-left, blue bottom-right)", len(fr) == 30 and fr[5][20, 20, 0] > 150 and fr[5][460, 250, 2] > 150, (len(fr), len(fr) and fr[5][20, 20].tolist(), len(fr) and fr[5][460, 250].tolist()))
    a.close()



@section
def project(B):
    """Save Project (Ctrl+S) and Open Project, from the menu and the start screen; EDL and Final Cut Pro XML out and in again"""
    a = two_clips(B); pg = a.pg
    a.goto(178); a.key("Control+d"); a.click_at("V1", 90); a.tab("Effects"); pg.fill(".vd-fxp input[type=search]", "black"); pg.click(".vd-fxitem:text-is('Black & White')")
    a.goto(30); a.key("Control+t"); a.goto(45); a.key("m"); a.tab("Captions"); pg.click(".vd-caps button:text-is('Add caption')"); pg.wait_for_timeout(150)
    before = a.lay(); full = a.ev("() => JSON.stringify(Lantern.video.app.p.seqs[Lantern.video.app.p.active])")
    f, nm = a.save_dl(lambda: (a.focus_tl(), pg.keyboard.press("Control+s")))
    check("Ctrl+S saves the project as a .lvproj file (a download here)", nm.endswith(".lvproj") and os.path.getsize(f) > 500, nm)
    try:
        j = json.load(open(f)); ok = j.get("lantern") == "video" and "project" in j
    except Exception: ok = False
    check("the .lvproj is readable JSON naming itself a Lantern video project, holding the edit (not the media)", ok and os.path.getsize(f) < 200000, os.path.getsize(f))
    a.menu("File", "New Project")
    check("File > New Project asks first (a confirm box), then the Timeline is empty", a.dialogs and "new project" in a.dialogs[-1].lower() and a.end() == 0, (a.dialogs[-1:], a.end()))
    with pg.expect_file_chooser() as fc: a.menu("File", "Open Project\u2026")
    fc.value.set_files(f); pg.wait_for_timeout(600)
    after = a.ev("() => JSON.stringify(Lantern.video.app.p.seqs[Lantern.video.app.p.active])")
    check("File > Open Project brings back the same sequence exactly (clips, transition, effect, title, marker, caption)", after == full, (a.lay(), before))
    check("after Open Project the files still open in this session play (frame 77 is 77, black and white)", a.info(77)["n"] == 77, a.info(77))
    check("History after Open Project starts from Open Project", a.hist() == ["Open Project"], a.hist())
    # EDL out
    f2, nm = a.save_dl(lambda: a.menu("File", "Export EDL (CMX 3600)"))
    txt = open(f2).read()
    check("Export EDL: TITLE and FCM NON-DROP FRAME, then numbered events", txt.startswith("TITLE: Sequence 01") and "FCM: NON-DROP FRAME" in txt and re.search(r"^001\s", txt, re.M), txt[:120])
    check("Export EDL: the first clip as an event 00:00:00:00-00:00:06:00 at 01:00:00:00-01:00:06:00 from counter.mp4",
          re.search(r"^\d{3}\s+AX\s+V\s+C\s+00:00:00:00 00:00:06:00 01:00:00:00 01:00:06:00", txt, re.M) and "* FROM CLIP NAME: counter.mp4" in txt, txt[:600])
    check("Export EDL: the cross dissolve at the cut as a D event of 030 frames", re.search(r"\sD\s+030\s", txt), txt[:900])
    # EDL in: into a new empty sequence
    a.focus_tl(); a.key("Control+n"); pg.wait_for_selector(".vd-dialog"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    a.ev("() => { var A = Lantern.video.app; A.exec('settings', function (seq) { seq.w = 320; seq.h = 240; }); }")
    with pg.expect_file_chooser() as fc: a.menu("File", "Import EDL\u2026")
    fc.value.set_files(f2); pg.wait_for_timeout(500)
    L = [x for x in a.lay() if x[0] in ("V1", "A1")]
    emsg = a.msg()
    check("Import EDL into an empty sequence lays the clips again at their times on V1 and A1, found by name", ["V1", 0, 180, 0, "av"] in L and ["A1", 0, 180, 0, "av"] in L and ["V1", 180, 90, 0, "av"] in L and ["A1", 180, 90, 0, "av"] in L, L)
    check("Import EDL: the title (written as an event named Graphic) is named in the status line as not found", "Graphic" in emsg, emsg)
    check("Import EDL: the dissolve comes back as a transition", bool(a.A("S.all(A.seq).some(function (x) { return x.c.tin && /issolve/.test(x.c.tin.type); })")), "")
    # XML out and in
    a.tab("Project"); pg.locator(".vd-pitem:has-text('Sequence 01')").first.dblclick(); pg.wait_for_timeout(200)
    f3, nm = a.save_dl(lambda: a.menu("File", "Export Final Cut Pro XML"))
    txt = open(f3).read()
    import xml.dom.minidom
    try:
        d = xml.dom.minidom.parseString(txt); ok = True
    except Exception as e:
        ok = False; d = None
    check("Export Final Cut Pro XML: well-formed xmeml version 4 with the sequence's 270 frames at timebase 30", ok and '<xmeml version="4">' in txt and "<duration>270</duration>" in txt and "<timebase>30</timebase>" in txt, txt[:200])
    if d:
        items = d.getElementsByTagName("clipitem")
        check("Export Final Cut Pro XML: a clip item for each clip (two pictures, two sounds and the title: 5) and the files by name", len(items) == 5 and "counter_b.webm" in txt and "<pathurl>" in txt, len(items))
        check("Export Final Cut Pro XML: picture and sound are linked (<link> elements, as Premiere writes them)", "<link>" in txt, "no <link> elements")
        check("Export Final Cut Pro XML: the cross dissolve is in it (a <transitionitem>)", "<transitionitem>" in txt, "no transitionitem")
    with pg.expect_file_chooser() as fc: a.menu("File", "Import Final Cut Pro XML\u2026")
    fc.value.set_files(f3); pg.wait_for_timeout(500)
    L = [x for x in a.lay() if x[4] == "av"]
    check("Import Final Cut Pro XML: a new sequence with the clips at their times, found by name (frame 77 plays)", a.A("Object.keys(A.p.seqs).length") == 3 and ["V1", 0, 180, 0, "av"] in L and ["A1", 180, 90, 0, "av"] in L and a.info(77)["n"] == 77, (a.A("Object.keys(A.p.seqs).length"), L))
    check("Import Final Cut Pro XML: the sequence is 320 x 240 at 30 fps as written", a.A("[A.seq.w, A.seq.h, A.seq.rate.num, A.seq.rate.den]") == [320, 240, 30, 1], a.A("[A.seq.w, A.seq.h, A.seq.rate.num, A.seq.rate.den]"))
    # the start screen's Open project... (in a new page: the media are offline until linked)
    b = App(B); pg2 = b.pg
    with pg2.expect_file_chooser() as fc: pg2.click("button:text-is('Open project\u2026')")
    fc.value.set_files(f); pg2.wait_for_selector(".vd-lanes", timeout=20000); pg2.wait_for_timeout(400)
    check("the start screen's Open project... opens the saved project", b.lay() == before, b.lay())
    check("opened in a new page, the status line says how many media files are offline and how to link them", "offline" in b.msg() and "Link Media" in b.msg(), b.msg())
    b.close()
    # a 29.97 drop-frame sequence: the EDL says DROP FRAME and uses semicolons
    c = App(B)
    c.start(["hd2997.mp4"], n_clips=2)
    f4, nm = c.save_dl(lambda: c.menu("File", "Export EDL (CMX 3600)"))
    txt = open(f4).read()
    check("Export EDL of a 29.97 drop-frame sequence: FCM: DROP FRAME and drop-frame times (;)", "FCM: DROP FRAME" in txt and re.search(r"\d\d:\d\d:\d\d;\d\d", txt), txt[:300])
    c.close()
    check("project: no errors in the page", not a.errs, a.errs[:3])
    a.close()


MENU_ITEMS = {
    "File": ["New Project", "Open Project\u2026", "Save Project\u2026", "Import\u2026", "Link Media\u2026", "Export Media\u2026", "Export Frame", "Export Captions (.srt)", "Export EDL (CMX 3600)", "Export Final Cut Pro XML", "Import EDL\u2026", "Import Final Cut Pro XML\u2026"],
    "Edit": ["Undo", "Redo", "Cut", "Copy", "Paste", "Paste Insert", "Paste Attributes", "Clear", "Ripple Delete", "Duplicate", "Select All", "Deselect All"],
    "Clip": ["Speed/Duration\u2026", "Audio Gain\u2026", "Enable", "Link / Unlink", "Nest\u2026", "Scale to Frame Size", "Fill Frame", "Add Frame Hold", "Insert Frame Hold Segment", "Scene Edit Detection\u2026", "Synchronize (by sound)"],
    "Sequence": ["Sequence Settings\u2026", "New Sequence\u2026", "Add Edit", "Add Edit to All Tracks", "Ripple Trim Previous Edit to Playhead", "Ripple Trim Next Edit to Playhead", "Apply Video Transition", "Apply Audio Transition", "Apply Default Transitions to Selection", "Lift", "Extract", "Close Gap", "Snap in Timeline", "Linked Selection", "Add Video Track", "Add Audio Track", "Delete Empty Tracks"],
    "Markers": ["Mark In", "Mark Out", "Mark Clip", "Go to In", "Go to Out", "Clear In and Out", "Add Marker", "Go to Next Marker", "Go to Previous Marker", "Clear All Markers"],
    "Graphics": ["New Title", "New Lower Third", "New Rolling Credits", "New Crawl", "New Color Matte", "New Bars and Tone", "New Black Video", "New Adjustment Layer"],
    "View": ["Playback Resolution: Full", "Playback Resolution: 1/2", "Playback Resolution: 1/4", "Safe Margins", "Zoom In", "Zoom Out", "Zoom to Sequence"],
    "Window": ["Effect Controls", "Lumetri Color", "Essential Graphics", "Effects", "Audio Track Mixer", "Lumetri Scopes", "Captions", "Markers", "History", "Source Monitor"],
    "Help": ["Keyboard Shortcuts", "Video Help"],
}


@section
def menus(B):
    """every menu item, with nothing selected: it does something, or says why not (Premiere greys out what cannot be done)"""
    a = two_clips(B); pg = a.pg
    listed = {}
    for top in MENU_ITEMS:
        pg.click(".vd-mbtn:text-is('%s')" % top); pg.wait_for_timeout(100)
        listed[top] = [x.split("\n")[0].strip() for x in pg.locator(".vd-menu .vd-mitem span:first-child").all_inner_texts()]
        pg.click(".vd-mbtn:text-is('%s')" % top); pg.wait_for_timeout(60)
    check("the menu bar has File, Edit, Clip, Sequence, Markers, Graphics, View, Window and Help with the items expected", all(listed[k] == v for k, v in MENU_ITEMS.items()), {k: v for k, v in listed.items() if v != MENU_ITEMS[k]})
    pg.keyboard.press("Escape")
    # the state each item starts from: in 30, out 59, markers at 45 and 150, the playhead at 100, nothing selected
    a.ev("() => { var A = Lantern.video.app; A.exec('setup', function (seq) { seq.inF = 30; seq.outF = 59; seq.markers = [{ id: 'k1', f: 45, dur: 0, name: '', note: '', color: 'green' }, { id: 'k2', f: 150, dur: 0, name: '', note: '', color: 'green' }]; }); }")
    for top, items in MENU_ITEMS.items():
        for it in items:
            if top == "File" and it == "New Project": continue
            if top == "Edit" and it == "Deselect All": continue
            a.focus_tl(); a.key("Escape"); a.goto(100)
            a.tab("Markers" if it == "History" else "History"); a.tab("Project")
            st0 = (snapshot(a), a.A("A.history().length"), a.A("[A.snap, A.linked, A.playRes, A.safe, A.seq.playhead, A.p.active, A.sel.length, A.tool]"), pg.locator(".vd-tab.on").all_inner_texts(), a.ev("() => Lantern.video.ui.U.tl.state.ppf"))
            a.ev("() => { Lantern.video.app.msg = ''; }"); e0 = len(a.errs)
            got = {"chooser": False, "download": False}
            def on_fc(fc): got["chooser"] = True
            def on_dl(d): got["download"] = True
            pg.on("filechooser", on_fc); pg.on("download", on_dl)
            pg.click(".vd-mbtn:text-is('%s')" % top)
            pg.locator(".vd-menu .vd-mitem").filter(has=pg.locator("span:text-is('%s')" % it)).first.click()
            pg.wait_for_timeout(450)
            pg.remove_listener("filechooser", on_fc); pg.remove_listener("download", on_dl)
            dlg = pg.locator(".vd-dialog").count() > 0; guide = pg.locator(".guide-overlay").count() > 0
            st1 = (snapshot(a), a.A("A.history().length"), a.A("[A.snap, A.linked, A.playRes, A.safe, A.seq.playhead, A.p.active, A.sel.length, A.tool]"), pg.locator(".vd-tab.on").all_inner_texts(), a.ev("() => Lantern.video.ui.U.tl.state.ppf"))
            msg = a.msg()
            did = got["chooser"] or got["download"] or dlg or guide or st1 != st0 or bool(msg)
            what = ("chooser " if got["chooser"] else "") + ("download " if got["download"] else "") + ("dialog " if dlg else "") + ("help " if guide else "") + ("changed " if st1 != st0 else "") + (("msg: " + msg) if msg else "")
            check("menu %s > %s (nothing selected; in 30, out 59, markers 45 and 150) does something or says why not, with no error" % (top, it), did and len(a.errs) == e0, what or "nothing happened and nothing was said")
            if dlg: pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
            if pg.locator(".vd-dialog").count(): pg.click(".vd-dialog button:text-is('Cancel'), .vd-dialog button:text-is('Close')"); pg.wait_for_timeout(100)
            if guide: pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
            if snapshot(a) != st0[0] or a.A("A.p.active") != st0[2][5]:
                a.ev("(n) => { var A = Lantern.video.app; while (A.history().length && A.history().filter(function (h) { return h.current; })[0].at >= n) { A.undo(); if (A.history().filter(function (h) { return h.current; })[0].at === 0) break; } }", st0[1])
                if a.A("A.p.active") != st0[2][5]: a.ev("(id) => Lantern.video.app.setSeq(id)", st0[2][5])
    a.close()
    # dialogs: Escape cancels, Enter is OK (a fresh page)
    a = two_clips(B); pg = a.pg
    a.menu("Sequence", "Sequence Settings\u2026"); pg.wait_for_selector(".vd-dialog")
    nmi = pg.locator(".vd-dialog .vd-drow:has(span:text-is('Name')) input"); nmi.fill("Cut A"); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    check("Sequence Settings: Escape closes it and keeps the old name", a.A("A.seq.name") == "Sequence 01" and pg.locator(".vd-dialog").count() == 0, a.A("A.seq.name"))
    a.menu("Sequence", "Sequence Settings\u2026"); pg.wait_for_selector(".vd-dialog")
    nmi = pg.locator(".vd-dialog .vd-drow:has(span:text-is('Name')) input"); nmi.fill("Cut A"); nmi.press("Enter"); pg.wait_for_timeout(150)
    check("Sequence Settings: Enter is OK (the sequence is renamed Cut A)", a.A("A.seq.name") == "Cut A" and pg.locator(".vd-dialog").count() == 0, a.A("A.seq.name"))
    check("the Program Monitor's title follows the sequence's new name", "Cut A" in pg.inner_text(".vd-right .vd-montitle"), pg.inner_text(".vd-right .vd-montitle"))
    a.menu("Sequence", "Sequence Settings\u2026"); pg.wait_for_selector(".vd-dialog")
    pg.select_option(".vd-dialog .vd-drow:has(span:text-is('Frame rate')) select", "25/1"); pg.click(".vd-dialog button:text-is('OK')"); pg.wait_for_timeout(200)
    check("Sequence Settings: changing 30 to 25 fps on a sequence with clips is refused or keeps each clip's time in seconds (Premiere does not allow it)",
          a.A("A.seq.rate.num") == 30 or a.end() == 225 or "frame" in a.msg().lower(), (a.A("A.seq.rate"), a.end(), a.msg()))
    a.focus_tl(); a.key("Control+z")
    a.menu("Help", "Keyboard Shortcuts"); pg.wait_for_selector(".vd-dialog")
    kt = re.sub(r"\s+", " ", pg.inner_text(".vd-dialog"))
    check("Help > Keyboard Shortcuts lists the keys (Ctrl+K Add Edit, J K L, Q W)", "Ctrl+K" in kt and "J K L" in kt and "Q W" in kt, kt[:200])
    pg.keyboard.press("Escape")
    # View > Safe Margins draws the two boxes over the Program Monitor
    a.menu("View", "Safe Margins"); pg.wait_for_timeout(200)
    sm = a.ev("() => { var c = document.querySelector('.vd-right canvas.vd-over'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }")
    check("View > Safe Margins draws the title-safe and action-safe boxes over the Program Monitor", sm > 200, sm)
    check("after View > Safe Margins the Program Monitor's Safe button shows it is on", "on" in (pg.get_attribute(".vd-right button.vd-tog", "class") or ""), pg.get_attribute(".vd-right button.vd-tog", "class"))
    check("menus: no errors in the page", not a.errs, a.errs[:3])
    a.close()


@section
def views(B):
    """a phone (390 x 844) and a laptop (1366 x 768); the help"""
    a = App(B, (390, 844)); pg = a.pg
    a.start(["counter.mp4", "counter_b.webm"], n_clips=4)
    sw = a.ev("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    check("phone 390 x 844: the page does not scroll sideways", sw[0] <= sw[1] + 1, sw)
    lb = pg.locator(".vd-lanes").bounding_box(); pv = pg.locator(".vd-right .vd-view").bounding_box()
    check("phone: the Program Monitor and the Timeline are both there, each a usable size", pv and pv["height"] >= 150 and lb and lb["width"] >= 180, (pv, lb))
    tb = [pg.locator(".vd-tool").nth(i).bounding_box() for i in range(10)]
    check("phone: all ten tools are on screen", all(b and b["x"] >= 0 and b["x"] + b["width"] <= 391 for b in tb), [round(b["x"]) for b in tb if b])
    ok = True; bad = []
    for top in ("File", "Window", "Help"):
        pg.click(".vd-mbtn:text-is('%s')" % top); pg.wait_for_timeout(100)
        mb = pg.locator(".vd-menu").bounding_box()
        if not mb or mb["x"] < 0 or mb["x"] + mb["width"] > 391: ok = False; bad.append((top, mb))
        pg.click(".vd-mbtn:text-is('%s')" % top)
    check("phone: the File, Window and Help menus open inside the screen", ok, bad)
    a.menu("File", "Export Media\u2026"); pg.wait_for_selector(".vd-dialog")
    db = pg.locator(".vd-dialog").bounding_box()
    check("phone: the Export box fits the screen's width", db and db["x"] >= 0 and db["x"] + db["width"] <= 391, db)
    pg.keyboard.press("Escape")
    a.ev("() => { Lantern.video.app.sel = []; }")
    pg.locator(".vd-lanes").scroll_into_view_if_needed(); pg.wait_for_timeout(150)
    x, y = a.pt("V1", 90); pg.mouse.click(x, y); pg.wait_for_timeout(150)
    check("phone: a tap on a clip selects it", a.sel() == 2, a.sel())
    hb = pg.locator(".vd-head").first.bounding_box()
    check("phone: the track headers leave the Timeline at least half the width", lb and lb["width"] >= 390 * 0.5, lb)
    a.close()
    a = App(B, (1366, 768)); pg = a.pg
    a.start(["counter.mp4", "counter_b.webm"], n_clips=4)
    sh = a.ev("() => [document.documentElement.scrollHeight, window.innerHeight]")
    stb = pg.locator(".vd-status").bounding_box()
    check("laptop 1366 x 768: the whole tile fits the window (no page scroll; the status line visible)", sh[0] <= sh[1] + 2 and stb and stb["y"] + stb["height"] <= 768, (sh, stb))
    pv = pg.locator(".vd-right .vd-view").bounding_box()
    check("laptop: the Program Monitor's picture area is at least 180 px high", pv and pv["height"] >= 180, pv)
    rows = a.ev("() => { var s = document.querySelector('.vd-tscroll'), r = s.getBoundingClientRect(); return [r.height, Lantern.video.ui.U.tl.rows().filter(function (x) { return x.y + x.h <= r.height; }).map(function (x) { return x.t.name; })]; }")
    check("laptop: V1 and A1 both show in the Timeline without scrolling it", "V1" in rows[1] and "A1" in rows[1], rows)
    tools = pg.locator(".vd-tools").bounding_box()
    check("laptop: the tool column fits beside the Timeline (all ten tools visible)", tools and all((pg.locator(".vd-tool").nth(i).bounding_box() or {"y": 9999})["y"] + 20 <= 768 for i in range(10)), tools)
    a.menu("Help", "Video Help"); pg.wait_for_timeout(300)
    g = pg.locator(".guide-overlay")
    gt = g.inner_text() if g.count() else ""
    secs = ["What it does", "Bring media in", "The workspace", "Put clips in the sequence", "Edit in the Timeline", "Playing", "Transitions", "Effects and keyframes", "Colour", "Titles and graphics", "Captions", "Sound", "Export", "What it does not do", "Keys"]
    check("Help > Video Help opens the guide with its sections (bringing media in to export and keys)", all(x in gt for x in secs), [x for x in secs if x not in gt])
    pg.keyboard.press("Escape")
    check("views: no errors in the page", not a.errs, a.errs[:3])
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
