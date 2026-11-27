# video_algos.py -- the Video tile's files and arithmetic (1.24.43) against other programs' own: ffprobe reading the tracks
# Lantern's MP4, WebM/Matroska and AVI readers find; ffmpeg decoding what Lantern's MP4, WebM, AVI, WAV and GIF writers make
# (remuxed files must decode to the same frames and sound as the originals); ffmpeg's ebur128 for loudness and true peak;
# ffmpeg's lut3d for .cube LUTs; SciPy's Gaussian and median filters and its biquad responses; and the rules the Timeline's
# edits must keep (no overlaps, never past a clip's media, linked clips together), drop-frame timecode, keyframes, the
# mixer's resampling, EDL and Final Cut Pro XML both ways, captions, blend modes, scene cuts and sync by sound.
# The modules run in Node, taken from src/lantern.inner.html between their markers. A check that needs a program not on
# the machine says SKIP. Usage: python3 tests/video_algos.py
import os, re, sys, json, math, shutil, subprocess, tempfile
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = open(os.path.join(ROOT, "src", "lantern.inner.html"), encoding="utf-8").read()
NAMES = ["VIDEO_TIME", "VIDEO_BYTES", "VIDEO_MP4_READ", "VIDEO_MKV_READ", "VIDEO_RIFF", "VIDEO_MP4_WRITE", "VIDEO_WEBM_WRITE", "VIDEO_GIF_WRITE", "VIDEO_SEQ", "VIDEO_EDIT", "VIDEO_KEYS",
         "VIDEO_COLOR", "VIDEO_FX", "VIDEO_LUMETRI", "VIDEO_FILT", "VIDEO_FX_IMAGE", "VIDEO_FX_SPACE", "VIDEO_FX_KEY", "VIDEO_TRANS", "VIDEO_TITLE", "VIDEO_CAPTIONS", "VIDEO_AFX",
         "VIDEO_LOUD", "VIDEO_MIX", "VIDEO_BLEND", "VIDEO_MASK", "VIDEO_SCOPES", "VIDEO_STAB", "VIDEO_XCHG"]
code = "".join(re.search(r"// MODULE: %s - START\n.*?// MODULE: %s - END\n" % (n, n), SRC, re.S).group(0) for n in NAMES)
OUT = tempfile.mkdtemp(prefix="video_algos_")
lib = os.path.join(OUT, "lib.js")
open(lib, "w", encoding="utf-8").write("global.window = global.window || { Lantern: {} };\ntry { global.DOMParser = new (require(%s).JSDOM)('').window.DOMParser; } catch (e) {}\n" % json.dumps(os.path.join(ROOT, "node_modules", "jsdom")) + code)
fails = 0; n = 0
def check(name, cond, info=""):
    global fails, n
    n += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + str(info)[:400]))
    if not cond: fails += 1
def run(js):
    f = os.path.join(OUT, "t.js")
    open(f, "w").write("var fs = require('fs'); require(%s); var V = window.Lantern.video, OUT = %s;\nfunction bytes(p) { return V.bytes.fromBytes(new Uint8Array(fs.readFileSync(p))); }\n"
        "Promise.resolve().then(function () {\n%s\n}).then(function (r) { console.log(JSON.stringify(r)); }, function (e) { console.log(JSON.stringify({ error: String(e && e.stack || e) })); });" % (json.dumps(lib), json.dumps(OUT), js))
    r = subprocess.run(["node", f], capture_output=True, text=True, timeout=900)
    if r.returncode: raise RuntimeError(r.stderr[-1500:])
    out = json.loads(r.stdout.strip().split("\n")[-1])
    if isinstance(out, dict) and "error" in out: raise RuntimeError(out["error"][:1500])
    return out
FF = shutil.which("ffmpeg"); FP = shutil.which("ffprobe")
def ff(*a): return subprocess.run([FF, "-v", "error", "-y"] + list(a), capture_output=True)
def probe(f, *a): return json.loads(subprocess.run([FP, "-v", "error", "-of", "json"] + list(a) + [f], capture_output=True, text=True).stdout)
def p(name): return os.path.join(OUT, name)
if not FF or not FP:
    print("SKIP  ffmpeg/ffprobe not here: no container checks")
else:
    # --- test media, made by ffmpeg
    ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30000/1001", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "30", "-bf", "2", "-c:a", "aac", "-b:a", "96k", p("h264_aac.mp4"))
    ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=44100", "-t", "2", "-c:v", "libx264", "-bf", "0", "-c:a", "pcm_s16le", p("pcm.mov"))
    ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-f", "lavfi", "-i", "sine=sample_rate=48000", "-t", "2", "-c:v", "libx264", "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov", p("frag.mp4"))
    ff("-f", "lavfi", "-i", "testsrc2=size=256x144:rate=24", "-f", "lavfi", "-i", "sine=sample_rate=48000", "-t", "2", "-c:v", "libvpx-vp9", "-b:v", "300k", "-c:a", "libopus", p("vp9_opus.mp4"))
    ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-f", "lavfi", "-i", "sine=sample_rate=48000", "-t", "2.5", "-c:v", "libvpx", "-b:v", "400k", "-c:a", "libopus", p("vp8.webm"))
    ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25", "-f", "lavfi", "-i", "sine=sample_rate=44100", "-t", "2", "-c:v", "libx264", "-c:a", "aac", p("h264.mkv"))
    ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=15", "-f", "lavfi", "-i", "sine=sample_rate=22050", "-t", "2", "-c:v", "mjpeg", "-q:v", "4", "-c:a", "pcm_s16le", p("mjpeg.avi"))
    ff("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30", "-t", "1", "-c:v", "libx264", p("plain.mp4")); ff("-display_rotation", "90", "-i", p("plain.mp4"), "-c", "copy", p("rot90.mp4"))
    # --- the readers against ffprobe
    for f in ["h264_aac.mp4", "pcm.mov", "frag.mp4", "vp9_opus.mp4", "rot90.mp4", "vp8.webm", "h264.mkv", "mjpeg.avi"]:
        rd = "V.riff.readAvi" if f.endswith(".avi") else "V.mkv.read" if re.search(r"\.(webm|mkv)$", f) else "V.mp4.read"
        m = run("return %s(bytes(%s)).then(function (m) { return m.tracks.map(function (t) { return { type: t.type, codec: t.codec, w: t.width, h: t.height, rot: t.rotation || 0, pcm: !!t.pcm, frames: t.frames || 0, sr: t.sampleRate || 0, ch: t.channels || 0, "
                "pts: t.samples.map(function (s) { return s.cts / t.timescale + t.start; }), key: t.samples.map(function (s) { return s.key; }), size: t.samples.map(function (s) { return s.size; }) }; }); });" % (rd, json.dumps(p(f))))
        pr = probe(p(f), "-show_packets", "-show_streams")
        for i, t in enumerate(m):
            st = pr["streams"][i]; pk = [x for x in pr["packets"] if x["stream_index"] == i]
            if t["pcm"]:
                dec = len(subprocess.run([FF, "-v", "error", "-i", p(f), "-map", "0:a", "-f", "s16le", "-ac", "1", "-"], capture_output=True).stdout) // 2
                check("%s sound: %d uncompressed frames, as many as ffmpeg decodes" % (f, t["frames"]), t["frames"] == dec, (t["frames"], dec))
                continue
            fp = sorted(float(x["pts_time"]) for x in pk); tol = 0.0011 if re.search(r"\.(webm|mkv)$", f) else 1e-4
            check("%s %s: %d packets, their times, sizes and sync points as ffprobe's" % (f, t["type"], len(t["pts"])), len(fp) == len(t["pts"]) and max(abs(a - b) for a, b in zip(fp, sorted(t["pts"]))) < tol + (0.025 if f == "h264.mkv" and t["type"] == "audio" else 0) and t["size"] == [int(x["size"]) for x in pk] and [("K" in x["flags"]) for x in pk] == t["key"],
                  (len(fp), len(t["pts"]), fp[:3], sorted(t["pts"])[:3]))
            if t["type"] == "video": check("%s picture %dx%d as ffprobe's" % (f, t["w"], t["h"]), t["w"] == st["width"] and t["h"] == st["height"], (t["w"], t["h"]))
        if f == "rot90.mp4": check("rot90.mp4: a 90-degree turn found (270 clockwise is ffmpeg's 90 anticlockwise)", m[0]["rot"] == 270, m[0]["rot"])
    # --- remux through Lantern's readers and writers: the same frames and sound as the original
    REMUX = r"""
      var f = %s, out = %s, src = bytes(f), rd = /\.(webm|mkv)$/.test(f) ? V.mkv.read(src) : /\.avi$/.test(f) ? V.riff.readAvi(src) : V.mp4.read(src), mk = /\.(webm|mkv)$/.test(out);
      return rd.then(function (m) {
        var tracks = m.tracks.filter(function (t) { return t.type === 'video' || t.type === 'audio'; }).map(function (t) {
          var o = { type: t.type, codec: t.codec, description: t.description, width: t.width, height: t.height, sampleRate: t.sampleRate, channels: t.channels, timescale: t.timescale, codecDelay: t.type === 'audio' && t.start < 0 ? -t.start : 0 };
          if (t.pcm) { var b = []; t.chunks.forEach(function (c) { var x = src.all.subarray(c.off, c.off + c.frames * t.bpf); for (var i = 0; i < x.length; i += 2) b.push(t.littleEndian ? (x[i] | (x[i+1] << 8)) << 16 >> 16 : ((x[i] << 8) | x[i+1]) << 16 >> 16); }); o.pcm = Int16Array.from(b); o.samples = [1]; return o; }
          o.samples = t.samples.map(function (s) { return { data: src.all.slice(s.off, s.off + s.size), pts: mk ? s.cts / t.timescale + (t.type === 'video' ? t.start : 0) : s.cts + Math.round(t.start * t.timescale), key: s.key, discardNs: s.discardNs }; });
          return o;
        });
        require('fs').writeFileSync(out, mk ? V.webmw.write({ matroska: /mkv$/.test(out), tracks: tracks }) : V.mp4w.write({ mov: /mov$/.test(out), tracks: tracks })); return 1;
      });"""
    def frames_md5(f): return subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:v", "-fps_mode", "passthrough", "-f", "framemd5", "-"], capture_output=True, text=True).stdout.split("\n")
    def vsig(f): return [l.split(",")[-1].strip() for l in frames_md5(f) if l and not l.startswith("#")]
    def asig(f): return subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:a", "-f", "md5", "-"], capture_output=True, text=True).stdout.strip()
    for a, b in [("h264_aac.mp4", "r_h264.mp4"), ("pcm.mov", "r_pcm.mov"), ("frag.mp4", "r_frag.mp4"), ("vp9_opus.mp4", "r_vp9.mp4"), ("vp8.webm", "r_vp8.webm"), ("h264.mkv", "r_h264.mkv"), ("vp9_opus.mp4", "r_vp9.webm")]:
        run(REMUX % (json.dumps(p(a)), json.dumps(p(b))))
        check("%s rewritten by Lantern as %s: every picture decodes the same" % (a, b), vsig(p(a)) == vsig(p(b)) and len(vsig(p(b))) > 10, (len(vsig(p(a))), len(vsig(p(b)))))
        check("%s rewritten by Lantern as %s: the sound decodes the same" % (a, b), asig(p(a)) == asig(p(b)), (asig(p(a)), asig(p(b))))
    # --- AVI: read ffmpeg's Motion JPEG, write it again
    r = run(r"""var src = bytes(%s); return V.riff.readAvi(src).then(function (m) { var v = m.tracks[0], a = m.tracks[1], pcm = [];
        a.chunks.forEach(function (c) { var b = src.all.subarray(c.off, c.off + c.frames * a.bpf); for (var i = 0; i < b.length; i += 2) pcm.push((b[i] | (b[i+1] << 8)) << 16 >> 16); });
        require('fs').writeFileSync(%s, V.riff.writeAvi({ width: v.width, height: v.height, fps: { num: 15, den: 1 }, frames: v.samples.map(function (s) { return src.all.slice(s.off, s.off + s.size); }), audio: { rate: a.sampleRate, channels: a.channels, pcm16: Int16Array.from(pcm) } })); return [v.samples.length, a.frames]; });""" % (json.dumps(p("mjpeg.avi")), json.dumps(p("r.avi"))))
    check("AVI: Lantern's Motion JPEG and PCM file decodes to ffmpeg's frames and sound", vsig(p("mjpeg.avi")) == vsig(p("r.avi")) and asig(p("mjpeg.avi")) == asig(p("r.avi")), r)
    # --- WAV both ways
    r = run(r"""var n = 48000, x = new Float32Array(n), y = new Float32Array(n); for (var i = 0; i < n; i++) { x[i] = 0.9 * Math.sin(2 * Math.PI * (200 + i / 20) * i / 48000); y[i] = -x[i] * 0.5; }
        var out = {}; [16, 24, 32].forEach(function (b) { var w = V.riff.writeWav([x, y], 48000, b); require('fs').writeFileSync(OUT + '/s' + b + '.wav', w); var r = V.riff.readWav(w), e = 0; for (var i = 0; i < n; i++) e = Math.max(e, Math.abs(r.data[0][i] - x[i]), Math.abs(r.data[1][i] - y[i])); out[b] = e; }); return out;""")
    for b in ("16", "24", "32"):
        raw = np.frombuffer(subprocess.run([FF, "-v", "error", "-i", p("s%s.wav" % b), "-f", "f32le", "-"], capture_output=True).stdout, np.float32).reshape(-1, 2)
        t = np.arange(48000); x = 0.9 * np.sin(2 * np.pi * (200 + t / 20) * t / 48000)
        check("WAV %s-bit: read back within one step, and ffmpeg reads Lantern's file" % b, r[b] <= (2 ** -15 if b == "16" else 2 ** -23 if b == "24" else 1e-7) and np.abs(raw[:, 0] - x).max() < (2 ** -14 if b == "16" else 1e-6), (r[b], float(np.abs(raw[:, 0] - x).max())))
    # --- GIF
    try:
        from PIL import Image, ImageSequence
        run(r"""var w = 160, h = 90, g = V.gifw.start(w, h), fr = []; for (var f = 0; f < 12; f++) { var px = new Uint8ClampedArray(w * h * 4); for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = (y * w + x) * 4; px[i] = (x * 255 / w + f * 20) %% 256; px[i+1] = y * 255 / h; px[i+2] = (x + y + f * 7) %% 256; px[i+3] = 255; } fr.push(px); }
            V.gifw.delays(12, { num: 30000, den: 1001 }).forEach(function (d) { g.add(fr[d.frame], d.delay, true); }); require('fs').writeFileSync(%s, g.done()); require('fs').writeFileSync(%s, Buffer.concat(fr.map(function (p) { return Buffer.from(p.buffer); }))); return 1;""" % (json.dumps(p("o.gif")), json.dumps(p("o.bin"))))
        src = np.frombuffer(open(p("o.bin"), "rb").read(), np.uint8).reshape(12, 90, 160, 4)[..., :3].astype(float)
        im = Image.open(p("o.gif")); errs = []; durs = []
        for i, f in enumerate(ImageSequence.Iterator(im)): errs.append(np.abs(np.array(f.convert("RGB")).astype(float) - src[i]).mean()); durs.append(f.info.get("duration"))
        check("GIF: PIL reads 12 frames, each within 6 levels on average of what was given (256 colours a frame, dithered)", len(errs) == 12 and max(errs) < 6, errs)
        check("GIF: the delays add up to 12 frames at 29.97 fps (in hundredths of a second, none under 2)", abs(sum(durs) / 1000 - 12 / 29.97) <= 0.011 and min(durs) >= 20, durs)
    except ImportError: print("SKIP  PIL not here: GIF not checked")
# --- timecode, edits, keyframes
r = run(r"""var T = V.time, r = T.rate(30000, 1001), r60 = T.rate(60000, 1001), ok = {};
  ok.df = [T.tc(1800, r, true), T.tc(17982, r, true), T.tc(107892, r, true), T.tc(1799, r, true), T.tc(3600, r60, true), T.tc(90, T.rate(25, 1), false)];
  var all = true; for (var f = 0; f < 300000; f += 7) if (T.parseTc(T.tc(f, r, true), r) !== f) { all = false; break; } ok.round = all;
  ok.parse = [T.parseTc('00:01:00;02', r), T.parseTc('01:00:00;00', r), T.parseTc('10.5', T.rate(30, 1)), T.parseTc('150', T.rate(30, 1)), T.parseTc('00:00:61:00', T.rate(30, 1))];
  ok.from = [T.fromFps(29.98), T.fromFps(23.976), T.fromFps(59.94), T.fromFps(12.5)];
  return ok;""")
check("drop-frame timecode: 1 min is ;02, 10 min ;00, 1 hour ;00 (SMPTE 12M), 59.94 skips four", r["df"] == ["00:01:00;02", "00:10:00;00", "01:00:00;00", "00:00:59;29", "00:01:00;04", "00:00:03:15"], r["df"])
check("drop-frame timecode read back to the same frame, every 7th frame to over 2 hours", r["round"])
check("timecode typed: drop-frame, seconds, frames; a bad one refused", r["parse"][:4] == [1800, 107892, 315, 150] and r["parse"][4] is None, r["parse"])
check("a measured frame rate named: 29.98 is 29.97 (30000/1001), 23.976 is 24000/1001", r["from"][0] == {"num": 30000, "den": 1001} and r["from"][1] == {"num": 24000, "den": 1001} and r["from"][2] == {"num": 60000, "den": 1001}, r["from"])
r = run(r"""var S = V.seq, E = V.edit, T = V.time, out = {}, p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1);
  p.media.m1 = { id: 'm1', kind: 'video', dur: 10 }; p.media.m2 = { id: 'm2', kind: 'video', dur: 4 };
  function av(m, start, dur, srcIn) { var l = S.uid('l'); return [{ t: seq.v[0], c: S.clip({ media: m, start: start, dur: dur, srcIn: srcIn || 0, link: l }) }, { t: seq.a[0], c: S.clip({ media: m, start: start, dur: dur, srcIn: srcIn || 0, link: l }) }]; }
  function lay(t) { return t.clips.map(function (c) { return [c.start, c.dur, +c.srcIn.toFixed(4)]; }); }
  function sane() { return S.tracks(seq).every(function (t) { for (var i = 0; i < t.clips.length; i++) { var c = t.clips[i], m = p.media[c.media]; if (c.dur < 1 || c.srcIn < -1e-9 || (m && c.srcIn + S.srcSpan(c, seq) > m.dur + 1e-6)) return false; if (i && c.start < t.clips[i-1].start + t.clips[i-1].dur) return false; } return true; }); }
  E.overwrite(seq, 0, av('m1', 0, 90)); E.overwrite(seq, 90, av('m2', 90, 60)); out.lay0 = lay(seq.v[0]);
  E.insert(seq, 45, av('m2', 0, 30, 1)); out.ins = lay(seq.v[0]); out.insA = lay(seq.a[0]); out.sane1 = sane();
  E.rippleDelete(seq, [seq.v[0].clips[1].id, seq.a[0].clips[1].id]); out.rd = lay(seq.v[0]);
  E.razor(seq, 100); out.cut = [seq.v[0].clips.length, seq.a[0].clips.length, +seq.v[0].clips[3].srcIn.toFixed(6), !!seq.v[0].clips[3].link && seq.v[0].clips[3].link === seq.a[0].clips[3].link];
  var a1 = seq.v[0].clips[0], b1 = seq.v[0].clips[1]; out.roll = [E.roll(p, seq, a1, b1, 10), a1.dur, b1.start, b1.dur, +b1.srcIn.toFixed(6)];
  out.roll2 = E.roll(p, seq, a1, b1, -1000);
  var c3 = seq.v[0].clips[2]; E.slip(p, seq, c3, 1000); out.slip = +(c3.srcIn + c3.dur / 30).toFixed(6);
  var c4 = seq.v[0].clips[3]; E.trimTail(p, seq, seq.v[0], c4, 1000); out.trim = +(c4.srcIn + c4.dur / 30).toFixed(6);
  var c1 = seq.v[0].clips[0], d1 = c1.dur; E.rateStretch(seq, seq.v[0], c1, c1.dur * 2); var last = seq.v[0].clips[seq.v[0].clips.length - 1], dl = last.dur, sl = last.speed; E.rateStretch(seq, seq.v[0], last, dl * 2);
  out.rate = [c1.dur === d1 && c1.speed === 1, last.dur === dl * 2, +(last.speed / sl).toFixed(6)];
  out.sane2 = sane(); var before = S.end(seq); E.extract(seq, 10, 20); out.ext = before - S.end(seq); E.lift(seq, 0, 5); out.lift = seq.v[0].clips[0].start;
  // reversed clip cut in two: the left part shows the later source
  var q = S.project(), s2 = q.seqs[q.active]; s2.rate = T.rate(30, 1); q.media.m = { id: 'm', kind: 'video', dur: 10 }; var rc = S.clip({ media: 'm', start: 0, dur: 60, srcIn: 2, reverse: true }); s2.v[0].clips.push(rc);
  var t0 = S.srcTime(rc, 0, s2), t59 = S.srcTime(rc, 59, s2); var rr = E.split(s2, s2.v[0], rc, 30); out.rev = [+t0.toFixed(6), +t59.toFixed(6), +S.srcTime(rc, 0, s2).toFixed(6), +S.srcTime(rr, 30, s2).toFixed(6), +S.srcTime(rr, 59, s2).toFixed(6)];
  // ripple trim keeps linked sound with its picture
  var q2 = S.project(), s3 = q2.seqs[q2.active]; s3.rate = T.rate(30, 1); q2.media.m = { id: 'm', kind: 'video', dur: 10 }; var l = 'L1', v1 = S.clip({ media: 'm', start: 0, dur: 60, link: l }), a1b = S.clip({ media: 'm', start: 0, dur: 60, link: l }), v2 = S.clip({ media: 'm', start: 60, dur: 30, srcIn: 5 }), a2 = S.clip({ media: 'm', start: 60, dur: 30, srcIn: 5 });
  s3.v[0].clips.push(v1, v2); s3.a[0].clips.push(a1b, a2); E.trimHead(q2, s3, s3.v[0], v1, 15, 'ripple', S.partners(s3, v1));
  out.rip = [v1.start, v1.dur, +v1.srcIn.toFixed(4), a1b.start, a1b.dur, +a1b.srcIn.toFixed(4), v2.start, a2.start];
  var K = V.keys, list = [{ f: 0, v: 0, i: 'ease' }, { f: 10, v: 100, i: 'linear' }, { f: 20, v: 50, i: 'hold' }, { f: 30, v: 0 }];
  out.keys = [K.value(list, 5), +K.value(list, 2).toFixed(6), K.value(list, 15), K.value(list, -3), K.value(list, 25), K.value(list, 40)];
  var la = [{ f: 0, v: 0, i: 'auto' }, { f: 10, v: 10, i: 'auto' }, { f: 20, v: 20 }]; out.auto = [K.value(la, 5), K.value(la, 15)];
  return out;""")
check("overwrite lays clips end to end", r["lay0"] == [[0, 90, 0], [90, 60, 0]], r["lay0"])
check("insert at 45 cuts the first clip and pushes the rest on every sync-locked track", r["ins"] == [[0, 45, 0], [45, 30, 1], [75, 45, 1.5], [120, 60, 0]] and r["insA"] == r["ins"] and r["sane1"], r["ins"])
check("ripple delete closes the gap", r["rd"] == [[0, 45, 0], [45, 45, 1.5], [90, 60, 0]], r["rd"])
check("Add Edit cuts picture and sound together; the right halves stay linked to each other", r["cut"] == [4, 4, 0.333333, True], r["cut"])
check("rolling edit moves the cut and the next clip's in point", r["roll"] == [10, 55, 55, 35, 1.833333], r["roll"])
check("rolling edit stops where a clip would vanish", r["roll2"] == -54, r["roll2"])
check("slip and trim never go past the media's end (4 s)", r["slip"] == 4 and r["trim"] == 4, (r["slip"], r["trim"]))
check("rate stretch: a clip with one right after it cannot grow; the last clip doubles in length at half the speed", r["rate"] == [True, True, 0.5], r["rate"])
check("after every edit: no overlaps, no clip past its media", r["sane2"])
check("extract shortens the sequence by its range; lift leaves a gap", r["ext"] == 10 and r["lift"] == 5, (r["ext"], r["lift"]))
check("a reversed clip plays its source backwards, and cut in two the halves still do", r["rev"] == [3.966667, 2.0, 3.966667, 2.966667, 2.0], r["rev"])
check("a ripple trim (its linked sound trimmed with it) keeps the sound with its picture and moves what follows, once", r["rip"] == [0, 45, 0.5, 0, 45, 0.5, 45, 45], r["rip"])
check("keyframes: ease (3u^2 - 2u^3), linear, hold, before the first and after the last", r["keys"] == [50, 10.4, 75, 0, 50, 0], r["keys"])
check("Auto Bezier passes a straight line through equally spaced keys", abs(r["auto"][0] - 5) < 1e-9 and abs(r["auto"][1] - 15) < 1e-9, r["auto"])
# --- the mixer
r = run(r"""var S = V.seq, T = V.time, out = {}, sr0 = 44100, n0 = sr0 * 3, d = new Float32Array(n0); for (var i = 0; i < n0; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr0);
  V.media = V.media || { rt: {} }; V.media.rt = V.media.rt || {}; V.media.rt.m1 = { audio: { sampleRate: sr0, data: [d] } };
  var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1); p.media.m1 = { id: 'm1', kind: 'audio', dur: 3 };
  var c = S.clip({ media: 'm1', start: 0, dur: 60 }); seq.a[0].clips.push(c);
  var o = V.mix.range(p, seq, 0, 96000), e = 0; for (var k = 200; k < 95000; k++) e = Math.max(e, Math.abs(o[0][k] - 0.5 * Math.sin(2 * Math.PI * 440 * k / 48000))); out.res = e;
  c.vol = -6; V.mix.clear(); o = V.mix.range(p, seq, 0, 48000); var rms = 0; for (k = 0; k < 48000; k++) rms += o[0][k] * o[0][k]; out.vol = 20 * Math.log10(Math.sqrt(rms / 48000) / (0.5 / Math.SQRT2));
  c.vol = 0; c.pan = -100; V.mix.clear(); o = V.mix.range(p, seq, 0, 4800); out.pan = [Math.max.apply(null, Array.prototype.slice.call(o[0])), Math.max.apply(null, Array.prototype.slice.call(o[1]))];
  c.pan = 0; c.speed = 2; c.dur = 30; V.mix.clear(); o = V.mix.range(p, seq, 0, 48000); var zc = 0; for (k = 1; k < 24000; k++) if ((o[0][k-1] < 0) !== (o[0][k] < 0)) zc++; out.pitch = zc;
  // Maintain Audio Pitch: a chord of 300 and 700 Hz at 200% and 50%, kept at its pitch and level, the clip's length filled
  var d2 = new Float32Array(n0); for (i = 0; i < n0; i++) d2[i] = 0.3 * Math.sin(2 * Math.PI * 300 * i / sr0) + 0.2 * Math.sin(2 * Math.PI * 700 * i / sr0);
  V.media.rt.m2 = { audio: { sampleRate: sr0, data: [d2] } }; p.media.m2 = { id: 'm2', kind: 'audio', dur: 3 }; out.keep = [];
  [[2, 30], [0.5, 120], [1.5, 40]].forEach(function (sd) { var c2 = S.clip({ media: 'm2', start: 0, dur: sd[1] }); c2.speed = sd[0]; c2.pitch = true; seq.a[1].clips = [c2]; seq.a[0].mute = true; V.mix.clear(); var o2 = V.mix.range(p, seq, 0, sd[1] * 1600 + 4800); out.keep.push([sd[0], Array.prototype.slice.call(o2[0], 2400, sd[1] * 1600 - 2400)]); });
  seq.a[1].clips = []; seq.a[0].mute = false;
  seq.a[0].mute = true; V.mix.clear(); o = V.mix.range(p, seq, 0, 4800); out.mute = Math.max.apply(null, Array.prototype.slice.call(o[0]).map(Math.abs));
  out.fades = [V.mix.fade('constantPower', 0.5), V.mix.fade('constantGain', 0.5), V.mix.fade('exponential', 0.5)];
  return out;""")
check("44.1 kHz sound resampled to 48 kHz: within -60 dB of the true sine", r["res"] < 0.0005, r["res"])
check("Volume -6 dB is -6 dB (within 0.01)", abs(r["vol"] + 6) < 0.01, r["vol"])
check("Pan hard left: all in the left ear", r["pan"][0] > 0.49 and r["pan"][1] < 1e-6, r["pan"])
check("200% speed: 880 Hz from 440 (the sound plays faster, higher)", abs(r["pitch"] - 880) < 4, r["pitch"])
check("a muted track is silent", r["mute"] == 0)
for sp, sig in r["keep"]:
    x = np.array(sig); spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))); fq = np.fft.rfftfreq(len(x), 1 / 48000)
    top = sorted(fq[np.argsort(spec)[-2:]]); lv = 20 * np.log10(np.sqrt(np.mean(x ** 2)) / np.sqrt(0.3 ** 2 / 2 + 0.2 ** 2 / 2))
    check("Maintain Audio Pitch at %d%%: a chord of 300 and 700 Hz stays 300 and 700 Hz (within 2 Hz), its level within 1 dB, sound to the clip's end" % (sp * 100), abs(top[0] - 300) < 2 and abs(top[1] - 700) < 2 and abs(lv) < 1 and np.sqrt(np.mean(x[-2400:] ** 2)) > 0.1, (top, lv))
check("transition curves at the middle: constant power 0.7071, constant gain 0.5, exponential 0.25", abs(r["fades"][0] - 0.70710678) < 1e-6 and r["fades"][1] == 0.5 and r["fades"][2] == 0.25, r["fades"])
# --- Time Remapping and a nested sequence's sound
r = run(r"""var S = V.seq, T = V.time, E = V.edit, out = {};
  var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1); p.media.m = { id: 'm', kind: 'video', dur: 20, w: 320, h: 240 };
  var c = S.clip({ media: 'm', start: 0, dur: 120, srcIn: 1 }); seq.v[0].clips.push(c);
  c.keys.remap = [{ f: 0, v: 100, i: 'linear' }, { f: 30, v: 100, i: 'linear' }, { f: 60, v: 50, i: 'linear' }];
  out.t = [S.srcTime(c, 30, seq), S.srcTime(c, 60, seq), S.srcTime(c, 90, seq), S.srcSpan(c, seq)];
  var r = E.split(seq, seq.v[0], c, 45); out.split = [r.srcIn, S.srcTime(c, 45, seq), S.srcTime(r, 60, seq), out.t[1]];
  E.trimHead(p, seq, seq.v[0], c, 10, 'plain'); out.trim = [c.start, S.srcTime(c, 30, seq)];
  var sr = 48000, d = new Float32Array(sr * 4); for (var i = 0; i < d.length; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr);
  V.media = V.media || { rt: {} }; V.media.rt = V.media.rt || {}; V.media.rt.m1 = { audio: { sampleRate: sr, data: [d] } };
  var q = S.project(), s2 = q.seqs[q.active]; s2.rate = T.rate(30, 1); q.media.m1 = { id: 'm1', kind: 'audio', dur: 4 };
  var ns = S.sequence({ name: 'N' }); ns.rate = T.rate(30, 1); q.seqs[ns.id] = ns; ns.a[0].clips.push(S.clip({ media: 'm1', start: 0, dur: 90, srcIn: 0.5 }));
  s2.a[0].clips.push(S.clip({ kind: 'nest', nest: ns.id, start: 30, dur: 60, srcIn: 1 })); V.mix.clear();
  var o = V.mix.range(q, s2, 0, sr * 4), e = 0, before = 0; for (var s = sr + 100; s < sr * 3 - 100; s++) e = Math.max(e, Math.abs(o[0][s] - 0.5 * Math.sin(2 * Math.PI * 440 * (s / sr + 0.5))));
  for (s = 0; s < sr - 1000; s++) before = Math.max(before, Math.abs(o[0][s])); out.nest = [e, before];
  // Amplify keyed from 0 dB at frame 0 to -20 dB at frame 60: the level along the way
  var s3 = q.seqs[q.active], c3 = S.clip({ media: 'm1', start: 0, dur: 90 }), e3 = V.fx.make('amplify'); e3.keys.gain = [{ f: 0, v: 0, i: 'linear' }, { f: 60, v: -20, i: 'linear' }]; c3.fx.push(e3); s3.a[0].clips = [c3]; V.mix.clear();
  o = V.mix.range(q, s3, 0, sr * 3); out.amp = [12000, 24000, 48000, 96000].map(function (at) { var r2 = 0; for (var k = at - 800; k < at + 800; k++) r2 += o[0][k] * o[0][k]; return 20 * Math.log10(Math.sqrt(r2 / 1600) / (0.5 / Math.SQRT2)); });
  return out;""")
ramp = sum((100 - 50 * j / 30) / 100 / 30 for j in range(30))
check("Time Remapping: the source shown is the sum of each frame's speed (100% for a second, a ramp to 50%, then 50%); the clip covers 1 s + the ramp + 1 s of source", all(abs(a - b) < 1e-9 for a, b in zip(r["t"], [2, 2 + ramp, 2.5 + ramp, 1 + ramp + 1])), r["t"])
check("Time Remapping: a cut and a head trim keep each frame's source where it was", abs(r["split"][0] - r["split"][1]) < 1e-9 and abs(r["split"][2] - r["split"][3]) < 1e-9 and r["trim"][0] == 10 and abs(r["trim"][1] - 2) < 1e-9, (r["split"], r["trim"]))
check("Amplify keyframed 0 dB to -20 dB over 60 frames: -2.5, -5, -10 and (after the last key) -20 dB at 0.25, 0.5, 1 and 2 s (within 0.1 dB)", all(abs(a - b) < 0.1 for a, b in zip(r["amp"], [-2.5, -5, -10, -20])), r["amp"])
check("a nested sequence's clip plays that sequence's sound, to the sample (within 1e-6), silent before it starts", r["nest"][0] < 1e-6 and r["nest"][1] == 0, r["nest"])
# --- Warp Stabilizer: the camera's move between two views of one picture, found again; the path held still or smoothed
r = run(r"""var G = V.filt, S = V.stab, out = { fits: [] }, seed = 7;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var big = { width: 480, height: 360, data: new Uint8ClampedArray(480 * 360 * 4) }; for (var i = 0; i < 480 * 360; i++) { var v = rnd() * 255; big.data[i * 4] = big.data[i * 4 + 1] = big.data[i * 4 + 2] = v; big.data[i * 4 + 3] = 255; } G.gaussian(big, 1.5);
  // a 320 x 240 view: its point p (from its centre) shows the picture at R(th) s p + t
  function view(th, s, tx, ty) { var W = 320, H = 240, d = new Uint8ClampedArray(W * H * 4), o = [0, 0, 0, 0], c = Math.cos(th) * s, sn = Math.sin(th) * s; for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var px = x + 0.5 - W / 2, py = y + 0.5 - H / 2; G.sample(big, c * px - sn * py + tx + 240 - 0.5, sn * px + c * py + ty + 180 - 0.5, o); var q = (y * W + x) * 4; d[q] = o[0]; d[q + 1] = o[1]; d[q + 2] = o[2]; d[q + 3] = 255; } return { width: W, height: H, data: d }; }
  var a = S.grey(view(0, 1, 0, 0));
  [[0, 1, 7.3, -4.6], [0.03, 1, 2, 1], [-0.05, 1.04, -6, 3], [0, 1, 25, 18]].forEach(function (t) {
    var m = S.motion(a, S.grey(view(t[0], t[1], t[2], t[3]))), c = Math.cos(t[0]) * t[1], sn = Math.sin(t[0]) * t[1], dd = c * c + sn * sn, ia = c / dd, ib = -sn / dd;
    out.fits.push({ truth: [ia, ib, -(ia * t[2] - ib * t[3]), -(ib * t[2] + ia * t[3])], psr: m.psr, pos: m.pos });
  });
  // a path that shakes about a slow pan: No Motion undoes all of it, Smooth Motion keeps the pan
  var steps = [], xs = [0]; for (i = 1; i < 60; i++) xs.push(0.5 * i + 6 * Math.sin(i * 1.3));
  for (i = 1; i < 60; i++) steps.push({ pos: [1, 0, xs[i] - xs[i - 1], 0], psr: [1, 0, xs[i] - xs[i - 1], 0] });
  var an = { steps: steps, w: 320, h: 240, fps: 30 }, still = S.plan(an, { result: 'No Motion', smooth: 50, method: 'Position' }, 320, 240), smooth = S.plan(an, { result: 'Smooth Motion', smooth: 50, method: 'Position' }, 320, 240);
  out.still = still.mats.map(function (M, k) { return M[2] - xs[k]; }); out.zoom = still.zoom; out.maxx = Math.max.apply(null, xs.map(Math.abs));
  out.smooth = smooth.mats.map(function (M, k) { return xs[k] - M[2]; });
  return out;""")
for f in r["fits"]:
    t_, p_ = f["truth"], f["psr"]
    ok = abs(p_[0] - t_[0]) < 0.003 and abs(p_[1] - t_[1]) < 0.002 and abs(p_[2] - t_[2]) < 0.35 and abs(p_[3] - t_[3]) < 0.35
    check("Warp Stabilizer's analysis: a view moved (%.1f, %.1f), turned %.2f rad, scaled %.2f is found again (turn within 0.002, shift within 0.35 pixel)" % (-t_[2], -t_[3], -math.atan2(t_[1], t_[0]), 1 / math.hypot(t_[0], t_[1])), ok, f)
sm = np.array(r["smooth"])
check("No Motion: each frame moved back by exactly the camera's move (within 1e-9); Auto-scale enlarges just enough for the largest move (half-width / (half-width - move))", max(abs(x) for x in r["still"]) < 1e-9 and abs(r["zoom"] - 160 / (160 - r["maxx"])) < 1e-3, (r["still"][:5], r["zoom"], r["maxx"]))
check("Smooth Motion (50%): the kept path has the pan (0.5 pixel a frame) and almost none of the shake (frame-to-frame change within 0.15 of the pan's)", np.max(np.abs(np.diff(sm[10:-10]) - 0.5)) < 0.15, np.diff(sm)[10:20])
# --- loudness against ffmpeg's ebur128
if FF:
    sigs = {"sine997_stereo": "sine=frequency=997:sample_rate=48000,volume=0.1", "pink_noise": "anoisesrc=color=pink:sample_rate=48000:amplitude=0.2:seed=3", "sine1k_441": "sine=frequency=1000:sample_rate=44100,volume=0.3", "tone_and_quiet": "sine=frequency=500:sample_rate=48000,volume='if(lt(t,4),0.5,0.005)':eval=frame"}
    for name, filt in sigs.items():
        sr = 44100 if "441" in name else 48000
        ff("-f", "lavfi", "-i", filt, "-t", "8", "-ac", "2", "-c:a", "pcm_f32le", p(name + ".wav"))
        e = subprocess.run([FF, "-hide_banner", "-nostats", "-i", p(name + ".wav"), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
        I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]); TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])
        ours = run(r"""var w = V.riff.readWav(require('fs').readFileSync(%s)); return [V.loud.integrated(w.data, w.sampleRate), V.loud.truePeak(w.data), V.loud.peak(w.data)];""" % json.dumps(p(name + ".wav")))
        check("loudness of %s: %.2f LUFS, ffmpeg's ebur128 %.1f (within 0.1 LU)" % (name, ours[0], I), abs(ours[0] - I) <= 0.1, (ours[0], I))
        check("true peak of %s: %.2f dBTP, ffmpeg's %.1f (within 0.2 dB)" % (name, ours[1], TP), abs(ours[1] - TP) <= 0.2 and ours[1] >= ours[2] - 1e-6, (ours[1], TP, ours[2]))
# --- colour: a .cube LUT against ffmpeg's lut3d, filters against SciPy, Lumetri at its defaults
rng = np.random.default_rng(5); H, W = 60, 80
yy, xx = np.mgrid[0:H, 0:W]
img = np.clip(np.dstack([128 + 100 * np.sin(xx / 9.0), 128 + 90 * np.cos(yy / 7.0 + xx / 13.0), (xx * 3 + yy * 2) % 256]) + rng.normal(0, 10, (H, W, 3)), 0, 255).astype(np.uint8)
rgba = np.dstack([img, np.full((H, W), 255, np.uint8)]); open(p("img.bin"), "wb").write(rgba.tobytes())
N = 17; g = np.linspace(0, 1, N); lines = ["TITLE \x22test\x22", "LUT_3D_SIZE %d" % N]
for b in g:
    for gg in g:
        for r_ in g: lines.append("%.6f %.6f %.6f" % (min(1, r_ ** 0.8 * 0.9 + 0.05), min(1, gg * gg * 0.7 + 0.2 * b), min(1, (b + r_) / 2)))
open(p("t.cube"), "w").write("\n".join(lines) + "\n")
LOAD = "var fs = require('fs'); function load() { return { width: %d, height: %d, data: new Uint8ClampedArray(fs.readFileSync(%s)) }; } function save(n, d) { fs.writeFileSync(OUT + '/' + n, Buffer.from(d.data.buffer)); }\n" % (W, H, json.dumps(p("img.bin")))
r = run(LOAD + r"""var C = V.color, F = V.fx, G = V.filt, out = {};
  var lut = C.parseCube(fs.readFileSync(%s, 'utf8')), a = load(); C.applyCube(a, lut, 1); save('lut.bin', a);
  [1, 2.5, 6].forEach(function (s) { var b = load(); G.gaussian(b, s); save('g' + s + '.bin', b); }); var b2 = load(); G.gaussian(b2, 20); save('g20.bin', b2);
  [1, 2].forEach(function (rr) { var b = load(); G.median(b, rr); save('m' + rr + '.bin', b); });
  var same = 0, x0 = load(); F.order.forEach(function (t) { if (t !== 'lumetri' && t !== 'brightContrast' && t !== 'procAmp' && t !== 'levels' && t !== 'curves' && t !== 'channelMixer' && t !== 'colorBalance' && t !== 'colorBalanceHls' && t !== 'transform' && t !== 'cornerPin' && t !== 'lensDistortion' && t !== 'crop') return; if (F.defs[t].audio) return; var y = load(); F.run(y, F.make(t), 0, { scale: 1 }); var d = 0; for (var i = 0; i < y.data.length; i++) d = Math.max(d, Math.abs(y.data[i] - x0.data[i])); if (d <= 1) same++; else out['moved_' + t] = d; });
  out.neutral = same;
  var lv = load(); C.levels(lv, { inBlack: 20, inWhite: 230, gamma: 1.4, outBlack: 10, outWhite: 245 }); save('levels.bin', lv);
  var ps = load(); F.run(ps, (function () { var e = F.make('posterize'); e.p.levels = 4; return e; })(), 0, { scale: 1 }); save('post.bin', ps);
  var bw = load(); F.run(bw, F.make('bw'), 0, { scale: 1 }); save('bw.bin', bw);
  var ex = load(); var e2 = F.make('lumetri'); e2.p.exposure = 1; F.run(ex, e2, 0, { scale: 1 }); save('exp.bin', ex);
  var sat = load(); var e3 = F.make('lumetri'); e3.p.saturation = 0; F.run(sat, e3, 0, { scale: 1 }); save('sat0.bin', sat);
  return out;""" % json.dumps(p("t.cube")))
def got(n): return np.frombuffer(open(p(n), "rb").read(), np.uint8).reshape(H, W, 4).astype(float)
if FF:
    Image_ok = True
    try:
        from PIL import Image
        Image.fromarray(img).save(p("img.png"))
        ff("-i", p("img.png"), "-vf", "lut3d=file=%s:interp=trilinear" % p("t.cube"), "-pix_fmt", "rgb24", p("lut_ff.png"))
        ref = np.array(Image.open(p("lut_ff.png")).convert("RGB")).astype(float)
        check(".cube LUT (17 steps) against ffmpeg's lut3d, trilinear: within 1 level", np.abs(got("lut.bin")[..., :3] - ref).max() <= 1, np.abs(got("lut.bin")[..., :3] - ref).max())
    except ImportError: print("SKIP  PIL not here: LUT not compared")
try:
    from scipy import ndimage, signal
    for s in (1, 2.5, 6):
        ref = np.dstack([ndimage.gaussian_filter(img[..., c].astype(float), s, mode="nearest", truncate=3.0) for c in range(3)])
        check("Gaussian blur sigma %s against SciPy's (edges repeated): within 1 level" % s, np.abs(got("g%s.bin" % s)[..., :3] - ref).max() <= 1.01, np.abs(got("g%s.bin" % s)[..., :3] - ref).max())
    ref = np.dstack([ndimage.gaussian_filter(img[..., c].astype(float), 20, mode="nearest") for c in range(3)])
    check("Gaussian blur sigma 20 (three box blurs) against SciPy's: within 4 levels away from the edges (on this small picture the edges differ more)", np.abs(got("g20.bin")[20:-20, 20:-20, :3] - ref[20:-20, 20:-20]).max() <= 4, np.abs(got("g20.bin")[20:-20, 20:-20, :3] - ref[20:-20, 20:-20]).max())
    for rr in (1, 2):
        ref = np.dstack([ndimage.median_filter(img[..., c], size=2 * rr + 1, mode="nearest") for c in range(3)])
        check("Median radius %d against SciPy's median filter: the same" % rr, np.abs(got("m%d.bin" % rr)[..., :3] - ref).max() == 0, np.abs(got("m%d.bin" % rr)[..., :3] - ref).max())
    # EQ: a 6 dB peak at 1 kHz is 6 dB there (SciPy's response of Lantern's coefficients)
    cs = run(r"""return [V.afx.biquad('peak', 1000, 2, 6, 48000), V.afx.biquad('lowshelf', 200, 0.7071, -9, 48000), V.afx.biquad('highpass', 80, 0.7071, 0, 48000), V.afx.biquad('notch', 60, 30, 0, 48000)];""")
    def resp(c, f): w, h = signal.freqz([c["b0"], c["b1"], c["b2"]], [1, c["a1"], c["a2"]], worN=[2 * np.pi * f / 48000]); return 20 * np.log10(abs(h[0]))
    check("EQ peak +6 dB at 1 kHz; low shelf -9 dB at 20 Hz; high-pass -3 dB at 80 Hz; notch deep at 60 Hz (SciPy's freqz)", abs(resp(cs[0], 1000) - 6) < 0.01 and abs(resp(cs[1], 20) + 9) < 0.3 and abs(resp(cs[2], 80) + 3.01) < 0.05 and resp(cs[3], 60) < -40, (resp(cs[0], 1000), resp(cs[1], 20), resp(cs[2], 80), resp(cs[3], 60)))
except ImportError: print("SKIP  SciPy not here: filters not compared")
check("every colour and geometry effect that has a neutral default leaves the picture as it was (within 1 level)", r["neutral"] == 12 and not [k for k in r if k.startswith("moved_")], r)
x = img.astype(float); lv = np.clip((x - 20) / 210, 0, 1) ** (1 / 1.4) * 235 + 10
check("Levels by its formula: ((x - in black) / (in white - in black))^(1/gamma) scaled to the output", np.abs(got("levels.bin")[..., :3] - np.round(lv)).max() <= 1, np.abs(got("levels.bin")[..., :3] - np.round(lv)).max())
check("Posterize 4: four levels a channel (0, 85, 170, 255)", set(np.unique(got("post.bin")[..., :3])) <= {0.0, 85.0, 170.0, 255.0})
yl = 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]
check("Black & White keeps Rec. 709 brightness", np.abs(got("bw.bin")[..., 0] - yl).max() <= 1 and (got("bw.bin")[..., 0] == got("bw.bin")[..., 2]).all())
check("Lumetri Saturation 0 keeps Rec. 709 brightness", np.abs(got("sat0.bin")[..., 0] - yl).max() <= 1.01)
lin = np.where(x / 255 <= 0.04045, x / 255 / 12.92, ((x / 255 + 0.055) / 1.055) ** 2.4) * 2; sr_ = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.clip(lin, 0, 1) ** (1 / 2.4) - 0.055) * 255
check("Lumetri Exposure +1 doubles the light (in linear light, through the sRGB curve)", np.abs(got("exp.bin")[..., :3] - np.clip(sr_, 0, 255)).max() <= 1.01, np.abs(got("exp.bin")[..., :3] - np.clip(sr_, 0, 255)).max())
# --- blend modes against their formulas
r = run(r"""var B = V.blend, a = [], b = []; for (var i = 0; i < 256; i += 15) for (var j = 0; j < 256; j += 15) { a.push(i, i, j, 255); b.push(j, i, i, 255); }
  var out = {}; ['linearBurn', 'linearLight', 'vividLight', 'pinLight', 'hardMix', 'subtract', 'divide', 'darkerColor', 'lighterColor'].forEach(function (m) { var below = { data: new Uint8ClampedArray(b) }, above = { data: new Uint8ClampedArray(a) }; B.pixel(m, below, above, 1); out[m] = Array.from(below.data); });
  out.a = a; out.b = b; return out;""")
A_ = np.array(r["a"], float).reshape(-1, 4)[:, :3] / 255; B_ = np.array(r["b"], float).reshape(-1, 4)[:, :3] / 255
def burn(b, a): return np.where(a <= 0, 0, np.maximum(0, 1 - (1 - b) / np.maximum(a, 1e-9)))
def dodge(b, a): return np.where(a >= 1, 1, np.minimum(1, b / np.maximum(1 - a, 1e-9)))
refs = {"linearBurn": np.maximum(0, A_ + B_ - 1), "linearLight": np.clip(B_ + 2 * A_ - 1, 0, 1), "vividLight": np.where(A_ <= 0.5, burn(B_, 2 * A_), dodge(B_, 2 * A_ - 1)), "pinLight": np.where(A_ <= 0.5, np.minimum(B_, 2 * A_), np.maximum(B_, 2 * A_ - 1)),
        "subtract": np.maximum(0, B_ - A_), "divide": np.where(A_ <= 0, 1, np.minimum(1, B_ / np.maximum(A_, 1e-9)))}
refs["hardMix"] = (refs["vividLight"] >= 0.5).astype(float)
ya = A_ @ [0.2126, 0.7152, 0.0722]; yb = B_ @ [0.2126, 0.7152, 0.0722]
refs["darkerColor"] = np.where((ya < yb)[:, None], A_, B_); refs["lighterColor"] = np.where((ya > yb)[:, None], A_, B_)
bad = {m: float(np.abs(np.array(r[m], float).reshape(-1, 4)[:, :3] - np.round(refs[m] * 255)).max()) for m in refs}
check("the blend modes the canvas lacks, against their formulas (Linear Burn/Light, Vivid, Pin, Hard Mix, Subtract, Divide, Darker/Lighter Color): within 1 level", max(bad.values()) <= 1, bad)
# --- scene cuts, sync by sound
r = run(r"""var Sc = V.scopes, hs = [], sizes = [[200, 30, 30], [30, 200, 60], [40, 40, 210], [220, 220, 40]];
  for (var shot = 0; shot < 4; shot++) for (var f = 0; f < 25; f++) { var d = new Uint8ClampedArray(32 * 18 * 4); for (var i = 0; i < d.length; i += 4) { var k = (i / 4 + f * 3) % 37; d[i] = sizes[shot][0] + k; d[i+1] = sizes[shot][1] - k / 2; d[i+2] = sizes[shot][2] + (f % 5); d[i+3] = 255; } hs.push(Sc.coarse({ data: d })); }
  var sc = []; for (var j = 1; j < hs.length; j++) sc.push(Sc.cutScore(hs[j - 1], hs[j]));
  var sr = 8000, n = sr * 6, a = new Float32Array(n), b = new Float32Array(n), seed = 7; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; }
  // bursts of noise (words, a clap) at uneven times
  var env = new Float32Array(n), at = 0.1; while (at < 6) { var len = 0.05 + (rnd() + 0.5) * 0.4, s0 = Math.round(at * sr); for (var q = 0; q < len * sr && s0 + q < n; q++) env[s0 + q] = 0.3 + (rnd() + 0.5); at += len + 0.1 + (rnd() + 0.5) * 0.5; }
  for (var t = 0; t < n; t++) a[t] = rnd() * env[t];
  for (t = 0; t < n; t++) { var tb = t + Math.round(1.23 * sr); b[t] = tb < n ? a[tb] * 0.5 + rnd() * 0.01 : 0; }
  return { cuts: Sc.cuts(sc, 1), lag: Sc.sync(a, b, sr, 5) };""")
check("Scene Edit Detection finds the three cuts between four shots (frames 25, 50, 75), and no others", r["cuts"] == [25, 50, 75], r["cuts"])
check("Synchronize: a recording whose sound at t is the other's at t + 1.23 s is found 1.23 s off (within 10 ms)", abs(r["lag"] - 1.23) <= 0.01, r["lag"])
# --- EDL and Final Cut Pro XML both ways; captions
r = run(r"""var S = V.seq, E = V.edit, T = V.time, X = V.xchg, p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30000, 1001); seq.drop = true; seq.name = 'Edit';
  p.media.a = { id: 'a', name: 'interview.mp4', kind: 'video', dur: 60, w: 1920, h: 1080, fps: T.rate(30000, 1001), hasAudio: true }; p.media.b = { id: 'b', name: 'broll.mov', kind: 'video', dur: 30, w: 1920, h: 1080, fps: T.rate(30000, 1001) };
  // in points on frames of 29.97 (an EDL counts frames): 300 and 75 frames
  E.place(seq, seq.v[0], S.clip({ media: 'a', start: 0, dur: 300, srcIn: 300 * 1001 / 30000 })); E.place(seq, seq.v[0], S.clip({ media: 'b', start: 300, dur: 150, srcIn: 75 * 1001 / 30000 })); E.place(seq, seq.a[0], S.clip({ media: 'a', start: 0, dur: 450, srcIn: 300 * 1001 / 30000 }));
  var c2 = seq.v[0].clips[1]; c2.tin = { type: 'crossDissolve', dur: 15, align: 'start' };
  var edl = X.edl(p, seq), q = S.project(), s2 = q.seqs[q.active]; s2.rate = seq.rate; q.media = S.clone(p.media); s2.v[0].clips = []; s2.a[0].clips = [];
  var note = X.readEdl(edl, q, s2);
  var xml = X.fcpxml(p, seq), back = X.readFcpxml(xml, q);
  function lay(sq) { return S.all(sq).map(function (x) { return [x.t.name, x.c.start, x.c.dur, Math.round(x.c.srcIn * 1000) / 1000, x.c.media]; }); }
  var cap = V.cap.parse('1\n00:00:01,000 --> 00:00:03,500\nHello there\n\n2\n00:00:04,000 --> 00:00:05,000\nSecond <b>line</b>\n');
  var vt = V.cap.parse('WEBVTT\n\n00:01.000 --> 00:03.500 align:start\nHello there\n'), fr = V.cap.toFrames(cap, seq), srt = V.cap.srt(fr, seq);
  return { edl: edl.split('\r\n').slice(0, 6), orig: lay(seq), fromEdl: lay(s2), fromXml: lay(back.seq), note: note + back.notes, cap: cap, vt: vt, again: V.cap.parse(srt) };""")
check("EDL: drop-frame header, an event per clip with source and record timecode, the clip's name", r["edl"][1] == "FCM: DROP FRAME" and r["edl"][3].startswith("001  AX       V     C        00:00:10;00 00:00:20;00 01:00:00;00 01:00:10;00"), r["edl"])
check("EDL read back: the same clips, places, in points and media (found by name)", sorted(r["fromEdl"]) == sorted(r["orig"]), (r["fromEdl"], r["orig"]))
check("Final Cut Pro XML read back: the same clips, places, in points and media", sorted(r["fromXml"]) == sorted(r["orig"]), (r["fromXml"], r["orig"]))
check("SubRip read: times, words, tags taken off; WebVTT's settings ignored", r["cap"] == [{"start": 1, "end": 3.5, "text": "Hello there"}, {"start": 4, "end": 5, "text": "Second line"}] and r["vt"] == [{"start": 1, "end": 3.5, "text": "Hello there"}], r["cap"])
check("captions written as SubRip and read again come back (to the frame at 29.97)", all(abs(a["start"] - b["start"]) < 0.034 and a["text"] == b["text"] for a, b in zip(r["again"], r["cap"])) and len(r["again"]) == 2, r["again"])
LINKBODY = "var seed = SEED; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; } function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }\nfunction build() {\n  var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1);\n  ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'].forEach(function (m, i) { p.media[m] = { id: m, kind: 'video', dur: 4 + i, w: 320, h: 240, hasAudio: true }; });\n  [0, 1].forEach(function (pair) {\n    var f = ri(0, 10);\n    for (var k = 0; k < 6; k++) {\n      var dur = ri(20, 70), m = 'm' + ri(0, 5), src = rnd() * 1.5, l = S.uid('l');\n      if (src + dur / 30 > p.media[m].dur) dur = Math.floor((p.media[m].dur - src) * 30);\n      seq.v[pair].clips.push(S.clip({ media: m, start: f, dur: dur, srcIn: src, link: l }));\n      seq.a[pair].clips.push(S.clip({ media: m, start: f, dur: dur, srcIn: src, link: l }));\n      var gap = rnd() < 0.4 ? ri(2, 20) : 0;\n      // a gap on one track only now and then filled: a title on the picture's track, or sound of its own on the sound's\n      if (gap && rnd() < 0.6) { var g0 = ri(0, 1), g = ri(1, gap); if (rnd() < 0.5) seq.v[pair].clips.push(S.clip({ kind: 'title', start: f + dur + (g0 ? gap - g : 0), dur: g, name: 'g' })); else seq.a[pair].clips.push(S.clip({ media: 'm5', start: f + dur + (g0 ? gap - g : 0), dur: g, srcIn: rnd() * 2 })); }\n      f += dur + gap;\n    }\n  });\n  // a title on V3 now and then, and some sound of its own on A3\n  seq.v.push(S.track('v', 3)); seq.a.push(S.track('a', 3));\n  seq.v[2].clips.push(S.clip({ kind: 'title', start: 30, dur: 60, name: 'T' }));\n  seq.a[2].clips.push(S.clip({ media: 'm5', start: 10, dur: 90, srcIn: 0 }));\n  S.tracks(seq).forEach(function (t) { S.sort(t); });\n  return { p: p, seq: seq };\n}\nfunction bad(s) {\n  var out = [], seq = s.seq, groups = {};\n  S.tracks(seq).forEach(function (t) {\n    var cs = t.clips.slice().sort(function (a, b) { return a.start - b.start; });\n    for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (c.dur < 1 || c.start < 0 || !isFinite(c.dur)) out.push('frames ' + t.name); if (i && c.start < cs[i - 1].start + cs[i - 1].dur) out.push('overlap ' + t.name);\n      var len = S.mediaLen(s.p, c); if (c.kind === 'av' && len !== Infinity && (c.srcIn < -1e-6 || c.srcIn + S.srcSpan(c, seq) > len + 1e-6)) out.push('source ' + t.name);\n      if (c.link) (groups[c.link] = groups[c.link] || []).push(c); }\n  });\n  for (var l in groups) { var g = groups[l]; if (g.some(function (c) { return c.start !== g[0].start || c.dur !== g[0].dur; })) out.push('parted ' + g.map(function (c) { return c.start + '+' + c.dur; }).join('/')); }\n  return out;\n}\nvar counts = { trim: [0, 0], roll: [0, 0], slide: [0, 0] }, examples = {};\nfor (var ep = 0; ep < 300; ep++) {\n  var s = build();\n  for (var st = 0; st < 30; st++) {\n    var all = S.all(s.seq).filter(function (x) { return x.c.link; }); if (!all.length) break;\n    var x = all[ri(0, all.length - 1)], kind = ['trim', 'roll', 'slide'][ri(0, 2)], edge = rnd() < 0.5 ? 'head' : 'tail', d = ri(-40, 40), ps = S.partners(s.seq, x.c);\n    var before = JSON.stringify(s.p);\n    if (kind === 'trim') E.trimLinked(s.p, s.seq, x.t, x.c, edge, d, ps);\n    else if (kind === 'roll') E.rollLinked(s.p, s.seq, x.t, x.c, edge, d, ps);\n    else E.slideLinked(s.p, s.seq, x.t, x.c, d, ps);\n    var b = bad(s); counts[kind][0]++;\n    if (b.length) { counts[kind][1]++; if (!examples[kind]) examples[kind] = b.slice(0, 3).join('; '); break; }\n  }\n}\nreturn { counts: counts, examples: examples };\n"

# --- the Timeline's linked edits (1.24.43, after review 3): a plain trim, a rolling edit and a slide of a clip with its
# linked partners, on tracks whose neighbours differ (a title in a picture's gap, sound of its own in a sound's gap):
# no overlaps, no frame counts broken, no source past the media, and linked clips together
LINKFUZZ = r"""var S = V.seq, T = V.time, E = V.edit;
%s"""
for seed in (1, 7):
    r = run((LINKFUZZ % LINKBODY).replace("SEED", str(seed)))
    for k in ("trim", "roll", "slide"):
        check("linked %s (E.%sLinked, as the Timeline calls it), %d edits from seed %d: linked clips stay together and no rule is broken" % ({"trim": "plain trims", "roll": "rolling edits", "slide": "slides"}[k], k, r["counts"][k][0], seed), r["counts"][k][0] > 2000 and r["counts"][k][1] == 0, r["examples"].get(k))
# --- a WAV's channel mask: 4.0 (L R C S) and 2.1 (L R LFE) folded to stereo as ffmpeg folds them (-ac 2)
if FF:
    for lay, nch in (("4.0", 4), ("2.1", 3), ("5.1(side)", 6)):
        tt = np.arange(48000 * 2) / 48000.0; x = np.stack([0.1 * np.sin(2 * np.pi * (300 + 200 * i) * tt) for i in range(nch)], 1).astype("<f4")
        open(p("mc.f32"), "wb").write(x.tobytes())
        ff("-f", "f32le", "-ar", "48000", "-ch_layout", lay, "-i", p("mc.f32"), "-c:a", "pcm_f32le", p("mc.wav")); ff("-i", p("mc.wav"), "-ac", "2", "-f", "f32le", p("dm.f32"))
        ref = np.frombuffer(open(p("dm.f32"), "rb").read(), "<f4").reshape(-1, 2)[:48000]
        r = run(r"""var S = V.seq, T = V.time, w = V.riff.readWav(new Uint8Array(fs.readFileSync(%s))); V.media = V.media || { rt: {} }; V.media.rt = V.media.rt || {};
          V.media.rt.mc = { audio: { sampleRate: w.sampleRate, data: w.data, mask: w.mask } }; var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1); p.media.mc = { id: 'mc', kind: 'audio', dur: 2 };
          seq.a[0].clips.push(S.clip({ media: 'mc', start: 0, dur: 30 })); V.mix.clear(); var o = V.mix.range(p, seq, 0, 48000); return { mask: w.mask, l: Array.prototype.slice.call(o[0]), r: Array.prototype.slice.call(o[1]) };""" % json.dumps(p("mc.wav")))
        y = np.stack([r["l"], r["r"]], 1)
        check("a %s WAV (channel mask 0x%X) folded to stereo by its mask as ffmpeg folds it (-ac 2): within 1e-4" % (lay, r["mask"]), np.abs(y[200:-200] - ref[200:-200]).max() < 1e-4, np.abs(y[200:-200] - ref[200:-200]).max())
# --- Maintain Audio Pitch keeps time: beeps at 1, 3 and 5 s of the source come at 2, 6 and 10 s at 50% and at 0.667,
# 2 and 3.333 s at 150% (within 20 ms); Amplify keyed -20 dB with Hold, then 0 dB at frame 30: it steps at frame 30
r = run(r"""var S = V.seq, T = V.time, sr = 48000, L = 12 * sr, d = new Float32Array(L), out = {};
  [1, 3, 5].forEach(function (t0) { for (var i = 0; i < 0.1 * sr; i++) d[Math.round(t0 * sr) + i] = 0.5 * Math.sin(2 * Math.PI * 2000 * i / sr); });
  for (var i = 0; i < L; i++) d[i] += 0.02 * Math.sin(2 * Math.PI * 440 * i / sr);
  V.media = V.media || { rt: {} }; V.media.rt = V.media.rt || {}; V.media.rt.bp = { audio: { sampleRate: sr, data: [d, d] } };
  out.beeps = [0.5, 1.5].map(function (sp) {
    var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1); p.media.bp = { id: 'bp', kind: 'audio', dur: 12 };
    var c = S.clip({ media: 'bp', start: 0, dur: Math.round(6 / sp * 30), srcIn: 0, speed: sp }); c.pitch = true; seq.a[0].clips.push(c); V.mix.clear();
    var r = V.mix.clipSound(p, seq, c), ch = r.chs[0], on = [], last = -1;
    for (var j = r.pad; j < ch.length; j += 48) { var e = 0; for (var q = 0; q < 48 && j + q < ch.length; q++) e = Math.max(e, Math.abs(ch[j + q])); if (e > 0.25 && (last < 0 || j - last > sr)) { on.push((j - r.pad) / sr); last = j; } }
    return on;
  });
  var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1); var one = new Float32Array(3 * sr); one.fill(0.5); V.media.rt.dc = { audio: { sampleRate: sr, data: [one] } }; p.media.dc = { id: 'dc', kind: 'audio', dur: 3 };
  var c = S.clip({ media: 'dc', start: 0, dur: 60 }), e = V.fx.make('amplify'); e.keys = { gain: [{ f: 0, v: -20, i: 'hold' }, { f: 30, v: 0, i: 'linear' }] }; c.fx.push(e); seq.a[0].clips.push(c); V.mix.clear();
  var o = V.mix.range(p, seq, 0, 2 * sr)[0]; out.amp = [o[Math.round(29.5 / 30 * sr)], o[Math.round(29.99 / 30 * sr)], o[Math.round(30 / 30 * sr)], o[Math.round(30.5 / 30 * sr)]];
  return out;""")
b5, b15 = r["beeps"]
check("Maintain Audio Pitch keeps time: beeps at 1, 3, 5 s of the source come at 2, 6, 10 s at 50%% and at 0.667, 2, 3.333 s at 150%% (within 20 ms)  [%s / %s]" % (np.round(b5, 3).tolist(), np.round(b15, 3).tolist()),
      len(b5) == 3 and len(b15) == 3 and max(abs(a - b) for a, b in zip(b5, [2, 6, 10])) < 0.02 and max(abs(a - b) for a, b in zip(b15, [2 / 3, 2, 10 / 3])) < 0.02, (b5, b15))
amp = [20 * math.log10(abs(v) / 0.5) if v else -99 for v in r["amp"]]
check("Amplify keyed -20 dB with a Hold, then 0 dB at frame 30: -20 dB up to frame 30 (29.5, 29.99), 0 dB from it (30, 30.5) (within 0.1 dB)", all(abs(a + 20) < 0.1 for a in amp[:2]) and all(abs(a) < 0.1 for a in amp[2:]), np.round(amp, 2).tolist())
# --- captions: WebVTT written with &amp; &lt; &gt;, read back the same; a character above U+FFFF read whole; SubRip's
# text kept as typed (an &amp; in it is what was typed); only the known tags taken off
r = run(r"""var C = V.cap, S = V.seq, T = V.time, p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1);
  var list = [{ start: 30, end: 60, text: 'I <3 you & a < b > c' }], vt = C.vtt(list, seq), back = C.parse(vt);
  return { vt: vt, back: back.map(function (c) { return c.text; }), emoji: C.parse('WEBVTT\n\n00:01.000 --> 00:02.000\n&#128512; and &#x1F600;\n').map(function (c) { return c.text; }),
    srt: C.parse('1\n00:00:01,000 --> 00:00:02,000\nFish &amp; chips <i>now</i> <3\n').map(function (c) { return c.text; }) };""")
check("WebVTT written with &amp; &lt; &gt; (so a player shows 'I <3 you & a < b > c'), and read back the same", "I &lt;3 you &amp; a &lt; b &gt; c" in r["vt"] and r["back"] == ["I <3 you & a < b > c"], (r["vt"], r["back"]))
check("WebVTT's &#128512; and &#x1F600; read as the emoji itself (U+1F600, two UTF-16 halves)", r["emoji"] == ["\U0001F600 and \U0001F600"], r["emoji"])
check("SubRip: an &amp; is what was typed, <i> taken off, '<3' kept", r["srt"] == ["Fish &amp; chips now <3"], r["srt"])
# --- EDL and FCP XML: a frame hold, a Dip to White centred on its cut, and fades at a clip's free ends come back
r = run(r"""var S = V.seq, T = V.time, X = V.xchg, p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1);
  ['ta.mp4', 'tb.mp4'].forEach(function (nm, i) { p.media['m' + i] = { id: 'm' + i, name: nm, kind: 'video', dur: 20, w: 320, h: 240, hasAudio: true }; });
  var v = seq.v[0], a = S.clip({ media: 'm0', start: 0, dur: 60, srcIn: 1 }), h = S.clip({ media: 'm0', start: 60, dur: 45, srcIn: 2 }), b = S.clip({ media: 'm1', start: 105, dur: 90, srcIn: 4 });
  h.hold = 3; b.tin = { type: 'dipWhite', dur: 20, align: 'center' }; a.tin = { type: 'crossDissolve', dur: 15, align: 'start', single: true }; b.tout = { type: 'dipBlack', dur: 25, align: 'end', single: true };
  v.clips.push(a, h, b);
  function lay(sq) { return sq.v[0].clips.map(function (c) { return [c.start, c.dur, c.hold === null ? Math.round(c.srcIn * 30) : null, c.hold === null ? null : Math.round(c.hold * 30), c.tin ? [c.tin.type, c.tin.dur, c.tin.align, !!c.tin.single] : null, c.tout ? [c.tout.type, c.tout.dur, !!c.tout.single] : null]; }); }
  var edl = X.edl(p, seq), q = S.sequence({ name: 'e', rate: T.rate(30, 1) }); X.readEdl(edl, p, q);
  var xml = X.fcpxml(p, seq), back = X.readFcpxml(xml, p).seq;
  // the record times of the EDL's events, in order: none may begin before the one before it ends (CMX 3600)
  var recs = edl.split('\r\n').filter(function (l) { return /^\d{3}\s/.test(l); }).map(function (l) { var tc = l.match(/\d\d:\d\d:\d\d:\d\d/g); return [T.parseTc(tc[2], seq.rate), T.parseTc(tc[3], seq.rate)]; });
  var over = 0; for (var i = 1; i < recs.length; i++) if (recs[i][0] < recs[i - 1][1] && recs[i][1] > recs[i][0]) over++;
  return { orig: lay(seq), edl: lay(q), xml: lay(back), over: over, text: edl };""")
check("EDL out and back: a frame hold, a Dip to White centred on its cut, a fade in and a fade out come back as they were (the hold by M2 000.0, the rest by LANTERN comments)", r["edl"] == r["orig"], (r["edl"], r["orig"]))
check("EDL: no event begins before the one before it ends (the dissolve's outgoing event ends where it begins; OpenTimelineIO refuses overlaps)", r["over"] == 0, r["text"][:600])
check("Final Cut Pro XML out and back: the same frame hold, Dip to White and fades (Time Remap 0, start-black and end-black)", r["xml"] == r["orig"], (r["xml"], r["orig"]))
print("%d checks, %d failed" % (n, fails))
print("ALL VIDEO ARITHMETIC CHECKS PASS" if not fails else "%d VIDEO ARITHMETIC CHECK(S) FAILED" % fails)
shutil.rmtree(OUT, ignore_errors=True)
sys.exit(1 if fails else 0)
