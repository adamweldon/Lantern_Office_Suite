# run.py -- an independent review of the Video tile's files and arithmetic (Lantern 1.24.43), written by a
# reviewer who did not write the tile. Every check compares Lantern with a reference that is not Lantern:
# ffprobe/ffmpeg 6.1 (packets, decoding, ebur128, lut3d), NumPy/SciPy (filters, biquads, resampling),
# SMPTE 12M drop-frame arithmetic done independently here, and the standards' own formulas.
# The modules run in Node, cut out of ../../../src/lantern.inner.html between their markers.
# Media is made afresh by ffmpeg in a temporary folder on every run; seeds are fixed.
# Usage: python3 tests/fixtures/video_review1_1243/run.py [section ...]
#   sections: readers writers time edits keys mix loud color afx xchg scenes media  (default: all)
# Output: one line per check, "PASS  ..." or "FAIL  ...", then "<n> checks, <m> failed".
import os, re, sys, json, shutil, subprocess, tempfile, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = open(os.path.join(ROOT, "src", "lantern.inner.html"), encoding="utf-8").read()
NAMES = ["VIDEO_TIME", "VIDEO_BYTES", "VIDEO_MP4_READ", "VIDEO_MKV_READ", "VIDEO_RIFF", "VIDEO_MP4_WRITE", "VIDEO_WEBM_WRITE",
         "VIDEO_GIF_WRITE", "VIDEO_SEQ", "VIDEO_EDIT", "VIDEO_KEYS", "VIDEO_COLOR", "VIDEO_FX", "VIDEO_LUMETRI", "VIDEO_FILT",
         "VIDEO_FX_IMAGE", "VIDEO_FX_SPACE", "VIDEO_FX_KEY", "VIDEO_TRANS", "VIDEO_CAPTIONS", "VIDEO_AFX", "VIDEO_LOUD",
         "VIDEO_MIX", "VIDEO_BLEND", "VIDEO_MEDIA", "VIDEO_MASK", "VIDEO_SCOPES", "VIDEO_XCHG"]
code = "".join(re.search(r"// MODULE: %s - START\n.*?// MODULE: %s - END\n" % (n, n), SRC, re.S).group(0) for n in NAMES)
OUT = tempfile.mkdtemp(prefix="video_review1_")
LIB = os.path.join(OUT, "lib.js")
# Math.random is replaced by a seeded generator so that ids and anything random in the tile repeat run to run
open(LIB, "w", encoding="utf-8").write(
    "(function () { var s = 12345; Math.random = function () { s = (s * 1103515245 + 12345) %% 2147483648; return s / 2147483648; }; })();\n"
    "global.window = global.window || { Lantern: {} };\n"
    "try { global.DOMParser = new (require(%s).JSDOM)('').window.DOMParser; } catch (e) {}\n" % json.dumps(os.path.join(ROOT, "node_modules", "jsdom")) + code)

FF = shutil.which("ffmpeg"); FP = shutil.which("ffprobe")
if not FF or not FP or not shutil.which("node"):
    print("ffmpeg, ffprobe and node are needed"); sys.exit(2)

N = 0; FAILS = 0; FAILED = []
def check(name, cond, info=""):
    global N, FAILS
    N += 1
    ok = bool(cond)
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else "    [" + str(info)[:600] + "]"), flush=True)
    if not ok: FAILS += 1; FAILED.append(name)

def run(js, timeout=1800):
    f = os.path.join(OUT, "t.js")
    open(f, "w").write(
        "var fs = require('fs'); require(%s); var V = window.Lantern.video, OUT = %s;\n"
        "function bytes(p) { return V.bytes.fromBytes(new Uint8Array(fs.readFileSync(p))); }\n"
        "function f32(p) { var b = fs.readFileSync(p); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); }\n"
        "function f64(p) { var b = fs.readFileSync(p); return new Float64Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); }\n"
        "function save32(p, a) { fs.writeFileSync(p, Buffer.from(new Float32Array(a).buffer)); }\n"
        "Promise.resolve().then(function () {\n%s\n}).then(function (r) { fs.writeFileSync(OUT + '/result.json', JSON.stringify(r === undefined ? null : r)); },"
        " function (e) { fs.writeFileSync(OUT + '/result.json', JSON.stringify({ __error: String(e && e.stack || e) })); });" % (json.dumps(LIB), json.dumps(OUT), js))
    r = subprocess.run(["node", "--max-old-space-size=4096", f], capture_output=True, text=True, timeout=timeout)
    if r.returncode: raise RuntimeError(r.stderr[-2000:])
    out = json.load(open(os.path.join(OUT, "result.json")))
    if isinstance(out, dict) and "__error" in out: raise RuntimeError("the JavaScript of a check failed: " + out["__error"][:1500])
    return out

def ff(*a):
    r = subprocess.run([FF, "-hide_banner", "-v", "error", "-y"] + [str(x) for x in a], capture_output=True)
    if r.returncode: raise RuntimeError("ffmpeg failed: %s\n%s" % (" ".join(map(str, a)), r.stderr.decode()[-1500:]))
    return r
def probe(f, *a): return json.loads(subprocess.run([FP, "-v", "error", "-of", "json"] + list(a) + [f], capture_output=True, text=True).stdout)
def p(name): return os.path.join(OUT, name)
def J(x): return json.dumps(x)
def errors_of(f):
    """what ffmpeg says when it decodes the whole file (nothing, for a good file)"""
    r = subprocess.run([FF, "-hide_banner", "-v", "error", "-i", f, "-f", "null", "-"], capture_output=True, text=True)
    return (r.stderr.strip() + ("" if r.returncode == 0 else " (exit %d)" % r.returncode)).strip()
def vsig(f, extra=()):
    out = subprocess.run([FF, "-v", "error"] + list(extra) + ["-i", f, "-map", "0:v:0", "-fps_mode", "passthrough", "-f", "framemd5", "-"], capture_output=True, text=True).stdout
    return [l.split(",")[-1].strip() for l in out.split("\n") if l and not l.startswith("#")]
def vpts(f):
    out = subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:v:0", "-fps_mode", "passthrough", "-f", "framemd5", "-"], capture_output=True, text=True).stdout
    rows = [l.split(",") for l in out.split("\n") if l and not l.startswith("#")]
    tb = re.search(r"#tb 0: (\d+)/(\d+)", out)
    k = int(tb.group(1)) / int(tb.group(2)) if tb else 1
    return [int(r_[2]) * k for r_ in rows]
def asig(f, idx=0):
    return subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:a:%d" % idx, "-f", "md5", "-"], capture_output=True, text=True).stdout.strip()
def decode_f32(f, idx=0, extra=()):
    st = probe(f, "-show_streams", "-select_streams", "a:%d" % idx)["streams"][0]
    ch = int(st["channels"])
    raw = subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:a:%d" % idx] + list(extra) + ["-f", "f32le", "-acodec", "pcm_f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch)

SECTIONS = sys.argv[1:] or ["readers", "writers", "time", "edits", "keys", "mix", "loud", "color", "afx", "xchg", "scenes", "media"]
def want(s): return s in SECTIONS

# ============================================================================================================
# 1. READERS against ffprobe
# ============================================================================================================
READ_JS = r"""
var f = %s, rd = /\.(webm|mkv)$/.test(f) ? V.mkv.read : /\.avi$/.test(f) ? V.riff.readAvi : V.mp4.read;
return rd(bytes(f)).then(function (m) { return { kind: m.kind, duration: m.duration, tracks: m.tracks.map(function (t) { return { type: t.type, codec: t.codec, w: t.width || 0, h: t.height || 0,
  rot: t.rotation || 0, pcm: !!t.pcm, frames: t.frames || 0, sr: t.sampleRate || 0, ch: t.channels || 0, bits: t.bits || 0, le: t.littleEndian, fl: !!t.float, fps: t.fps || 0, start: t.start || 0,
  pts: (t.samples || []).map(function (s) { return s.cts / t.timescale + (t.start || 0); }), key: (t.samples || []).map(function (s) { return !!s.key; }), size: (t.samples || []).map(function (s) { return s.size; }),
  off: (t.samples || []).map(function (s) { return s.off; }), disc: (t.samples || []).map(function (s) { return s.discardNs || 0; }), chunks: (t.chunks || []).length, desc: t.description ? t.description.length : 0 }; }) }; },
  function (e) { return { error: String(e && e.message || e) }; });"""
def read_file(f): return run(READ_JS % J(f))

def make(name, *args):
    ff(*args, p(name)); return p(name)

LAVV = lambda size, rate, dur=2: ["-f", "lavfi", "-i", "testsrc2=size=%s:rate=%s:duration=%s" % (size, rate, dur)]
LAVA = lambda sr, ch=2, dur=2, freq=440: ["-f", "lavfi", "-i", "sine=frequency=%d:sample_rate=%d:duration=%s" % (freq, sr, dur)] + (["-ac", str(ch)] if ch != 1 else [])
def lava_multi(sr, layout, dur=2):
    return ["-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=%d:amplitude=0.3:duration=%s:seed=5,aformat=channel_layouts=%s" % (sr, dur, layout)]

def compare_tracks(label, f, lt, pk, st, tol, key_check=True, size_check=True, off_check=True):
    """lt: Lantern's track; pk: ffprobe packets of that stream; st: ffprobe stream"""
    fp = [float(x["pts_time"]) for x in pk if x.get("pts_time") not in (None, "N/A")]
    order_f = sorted(range(len(pk)), key=lambda i: int(pk[i]["pos"]) if pk[i].get("pos") not in (None, "N/A") else i)
    for x in pk:
        if x.get("pts_time") in (None, "N/A"): x["pts_time"] = x.get("dts_time", "nan")
    ok_n = len(lt["pts"]) == len(pk)
    extra_ok = False
    if not ok_n and len(lt["pts"]) > len(pk) and f.endswith((".mp4", ".mov", ".m4a")) and pk[0].get("pos") not in (None, "N/A"):
        # ffmpeg leaves out of its listing the sound packets an edit list cuts whole; Lantern lists them with times before 0.
        # They are right if every one Lantern has more of ends at or before the start (time 0).
        have = set(int(x["pos"]) for x in pk)
        extra = [(lt["pts"][i], lt["size"][i]) for i in range(len(lt["off"])) if lt["off"][i] not in have]
        span = (max(lt["pts"]) - min(lt["pts"])) / max(1, len(lt["pts"]) - 1)
        extra_ok = len(extra) == len(lt["pts"]) - len(pk) and all(t + span <= 1e-6 for t, _ in extra)
        if extra_ok:
            keep = [i for i in range(len(lt["off"])) if lt["off"][i] in have]
            lt = dict(lt, pts=[lt["pts"][i] for i in keep], key=[lt["key"][i] for i in keep], size=[lt["size"][i] for i in keep], off=[lt["off"][i] for i in keep])
    check("%s %s: %d packets, as many as ffprobe lists%s" % (label, lt["type"], len(pk), " (and the ones its edit list cuts whole, all before 0 s)" if extra_ok else ""), ok_n or extra_ok, (len(lt["pts"]), len(pk)))
    if not (ok_n or extra_ok) or not pk: return
    # match by byte position (both list them); ffprobe gives pos for every packet of these containers
    pos = [int(x["pos"]) for x in pk] if all(x.get("pos") not in (None, "N/A") for x in pk) else None
    if pos and off_check:
        # Lantern's off is the start of the coded bytes. ffprobe's pos is the same for MP4 and AVI; for Matroska it is the
        # start of the block's own header (track number, 2-byte time, flags: 4 bytes for track numbers under 127)
        if f.endswith((".mkv", ".webm")): pos = [x + 4 for x in pos]
        same_pos = sorted(pos) == sorted(lt["off"])
        check("%s %s: every packet found at the byte where ffprobe finds it" % (label, lt["type"]), same_pos,
              [(a, b) for a, b in zip(sorted(pos), sorted(lt["off"])) if a != b][:4])
        byoff = {o: i for i, o in enumerate(lt["off"])}
        idx = [byoff.get(x, -1) for x in pos]
    else:
        idx = list(range(len(pk)))
    if -1 in idx: idx = list(range(len(pk)))
    lp = [lt["pts"][i] for i in idx]
    pairs = [(a, float(x["pts_time"])) for a, x in zip(lp, pk) if x["pts_time"] != "nan"]
    dpts = max(abs(a - b) for a, b in pairs) if pairs else 0
    check("%s %s: presentation times within %g s of ffprobe's" % (label, lt["type"], tol), dpts <= tol, ("max diff", dpts, [(round(a, 5), x["pts_time"]) for a, x in zip(lp, pk)][:4]))
    if size_check:
        check("%s %s: packet sizes as ffprobe's" % (label, lt["type"]), [lt["size"][i] for i in idx] == [int(x["size"]) for x in pk],
              [(lt["size"][i], x["size"]) for i, x in zip(idx, pk) if lt["size"][i] != int(x["size"])][:4])
    if key_check:
        fk = [("K" in x["flags"]) for x in pk]
        lk = [lt["key"][i] for i in idx]
        check("%s %s: sync points (keyframes) as ffprobe's" % (label, lt["type"]), fk == lk, [(i, a, b) for i, (a, b) in enumerate(zip(lk, fk)) if a != b][:6])

def stream_rotation(st):
    for sd in st.get("side_data_list", []) or []:
        if "rotation" in sd: return int(round(float(sd["rotation"])))
    tags = st.get("tags", {}) or {}
    if "rotate" in tags: return -int(tags["rotate"])
    return 0

if want("readers"):
    V = []  # (file, note)
    # --- MP4 / MOV / M4A, as phones, cameras and programs write them
    V.append(make("phone_portrait.mp4", *LAVV("1080x1920", "30"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "3", "-g", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest"))
    V.append(make("sd_23976_mono441.mp4", *LAVV("854x480", "24000/1001"), *LAVA(44100, 1), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "0", "-g", "48", "-c:a", "aac", "-shortest"))
    V.append(make("odd_642x362_25_51.mp4", *LAVV("642x362", "25"), *lava_multi(48000, "5.1"), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-shortest"))
    V.append(make("ntsc_2997_faststart.mp4", *LAVV("640x360", "30000/1001", 3), *LAVA(44100, 2, 3), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-movflags", "+faststart", "-shortest"))
    V.append(make("pal50.mp4", *LAVV("1280x720", "50", 1.5), *LAVA(48000, 2, 1.5), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest"))
    V.append(make("ntsc5994.mp4", *LAVV("1280x720", "60000/1001", 1.5), *LAVA(48000, 2, 1.5), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-shortest"))
    ff(*LAVV("640x360", "30", 3), "-vf", "select='not(eq(mod(n\\,5)\\,2))*not(eq(mod(n\\,7)\\,3))'", "-fps_mode", "vfr", "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", p("vfr.mp4")); V.append(p("vfr.mp4"))
    V.append(make("ts90k.mp4", *LAVV("320x240", "30000/1001"), "-c:v", "libx264", "-preset", "ultrafast", "-video_track_timescale", "90000"))
    make("plain_for_rot.mp4", *LAVV("1920x1080", "30", 1), *LAVA(48000, 2, 1), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-shortest")
    for deg in (90, 180, 270):
        ff("-display_rotation", str(deg), "-i", p("plain_for_rot.mp4"), "-c", "copy", p("rot%d.mp4" % deg)); V.append(p("rot%d.mp4" % deg))
    # stream copy from the middle (an edit list hides the frames before 1.3 s), and a sound that starts 0.5 s late (an empty edit)
    ff("-ss", "1.3", "-i", p("ntsc_2997_faststart.mp4"), "-c", "copy", p("cut_copy.mp4")); V.append(p("cut_copy.mp4"))
    make("only_audio.m4a", *LAVA(48000, 2, 2), "-c:a", "aac")
    ff("-i", p("sd_23976_mono441.mp4"), "-itsoffset", "0.5", "-i", p("only_audio.m4a"), "-map", "0:v", "-map", "1:a", "-c", "copy", p("late_audio.mp4")); V.append(p("late_audio.mp4"))
    V.append(p("only_audio.m4a"))
    V.append(make("two_audio.mp4", *LAVV("320x240", "25"), *LAVA(48000, 2, 2), *LAVA(44100, 1, 2, 880), "-map", "0:v", "-map", "1:a", "-map", "2:a", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest"))
    V.append(make("frag.mp4", *LAVV("320x240", "30"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-g", "15", "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-shortest"))
    V.append(make("frag_basedata.mp4", *LAVV("320x240", "25"), *LAVA(44100, 2), "-c:v", "libx264", "-preset", "ultrafast", "-g", "25", "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov", "-shortest"))
    V.append(make("hevc.mp4", *LAVV("640x360", "30"), "-c:v", "libx265", "-preset", "ultrafast", "-tag:v", "hvc1", "-x265-params", "log-level=error"))
    V.append(make("av1.mp4", *LAVV("320x240", "24", 1), "-c:v", "libaom-av1", "-cpu-used", "8", "-b:v", "200k"))
    V.append(make("mp3_in.mp4", *LAVV("320x240", "25"), *LAVA(44100, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "libmp3lame", "-shortest"))
    V.append(make("camera.mov", *LAVV("1280x720", "30000/1001"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-timecode", "01:00:00;00", "-shortest"))
    PCM_MOV = [("pcm_s16le", "s16le"), ("pcm_s16be", "s16be"), ("pcm_s24le", "s24le"), ("pcm_s24be", "s24be"), ("pcm_s32le", "s32le"), ("pcm_f32le", "f32le"), ("pcm_f32be", "f32be")]
    for codec, tag in PCM_MOV:
        make("pcm_%s.mov" % tag, *LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", codec, "-shortest")
    make("pcm_s16le_mono.mov", *LAVV("320x240", "25"), *LAVA(44100, 1), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "pcm_s16le", "-shortest")
    try:
        make("ipcm.mp4", *LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "pcm_s24le", "-shortest")
    except RuntimeError: pass
    # --- WebM / Matroska
    MK = []
    MK.append(make("vp8_vorbis.webm", *LAVV("320x240", "30"), *LAVA(44100, 2), "-c:v", "libvpx", "-b:v", "300k", "-c:a", "libvorbis", "-shortest"))
    MK.append(make("vp9_opus_portrait.webm", *LAVV("360x640", "30"), *LAVA(48000, 2), "-c:v", "libvpx-vp9", "-b:v", "300k", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest"))
    MK.append(make("av1_opus.webm", *LAVV("320x240", "24", 1), *LAVA(48000, 1, 1), "-c:v", "libaom-av1", "-cpu-used", "8", "-b:v", "200k", "-c:a", "libopus", "-shortest"))
    MK.append(make("h264_aac_bframes.mkv", *LAVV("640x360", "30000/1001"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "3", "-c:a", "aac", "-shortest"))
    MK.append(make("h264_flac.mkv", *LAVV("320x240", "25"), *LAVA(44100, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "flac", "-shortest"))
    MK.append(make("h264_pcm16.mkv", *LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "pcm_s16le", "-shortest"))
    MK.append(make("h264_pcm24.mkv", *LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "pcm_s24le", "-shortest"))
    MK.append(make("hevc_2aud_subs.mkv", *LAVV("320x240", "24000/1001"), *LAVA(48000, 2), *LAVA(44100, 1, 2, 660), "-f", "lavfi", "-i", "anullsrc", "-map", "0:v", "-map", "1:a", "-map", "2:a",
                   "-c:v", "libx265", "-preset", "ultrafast", "-x265-params", "log-level=error", "-c:a", "aac", "-shortest"))
    ff(*LAVV("320x240", "30"), *LAVA(48000, 2), "-c:v", "libvpx", "-b:v", "300k", "-c:a", "libopus", "-shortest", "-live", "1", "-f", "webm", p("live.webm")); MK.append(p("live.webm"))
    ff(*LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest", "-f", "webm", "-cluster_size_limit", "2000", p("smallclusters.webm")); MK.append(p("smallclusters.webm"))
    # --- AVI
    AV = []
    AV.append(make("mjpeg_pcm16.avi", *LAVV("480x270", "25"), *LAVA(44100, 2), "-c:v", "mjpeg", "-q:v", "5", "-c:a", "pcm_s16le", "-shortest"))
    AV.append(make("mjpeg_u8.avi", *LAVV("320x240", "15"), *LAVA(8000, 1), "-c:v", "mjpeg", "-q:v", "5", "-c:a", "pcm_u8", "-shortest"))
    AV.append(make("mjpeg_ntsc_noaudio.avi", *LAVV("640x480", "30000/1001"), "-c:v", "mjpeg", "-q:v", "5"))
    AV.append(make("mjpeg_pcm24.avi", *LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "mjpeg", "-q:v", "5", "-c:a", "pcm_s24le", "-shortest"))
    AV.append(make("mjpeg_pcm96k.avi", *LAVV("320x240", "25"), *LAVA(96000, 2), "-c:v", "mjpeg", "-q:v", "5", "-c:a", "pcm_s16le", "-shortest"))
    AV.append(make("h264_mp3.avi", *LAVV("320x240", "25"), *LAVA(44100, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "0", "-c:a", "libmp3lame", "-shortest"))

    for f in V + MK + AV:
        label = os.path.basename(f)
        m = read_file(f)
        if "error" in m:
            check("%s: read at all" % label, False, m["error"]); continue
        pr = probe(f, "-show_packets", "-show_streams")
        streams = [s for s in pr["streams"] if s["codec_type"] in ("video", "audio")]
        lts = [t for t in m["tracks"] if t["type"] in ("video", "audio")]
        check("%s: %d picture/sound tracks, as ffprobe" % (label, len(streams)), len(lts) == len(streams), ([t["type"] for t in lts], [s["codec_type"] for s in streams]))
        for st in streams:
            same_type = [t for t in lts if t["type"] == st["codec_type"]]
            k = [s for s in streams if s["codec_type"] == st["codec_type"]].index(st)
            if k >= len(same_type): continue
            lt = same_type[k]
            pk = [x for x in pr["packets"] if x["stream_index"] == st["index"]]
            mk = label.endswith((".mkv", ".webm"))
            tol = 0.0011 if mk else 2e-4
            if label == "cut_copy.mp4":
                # this edit list starts 1.3 ms before a frame boundary; ffmpeg moves the frames onto it, ISO 14496-12 does not.
                # Within half a frame both show the same picture at every frame's time.
                tol = 0.5 * 1001 / 30000
            if st["codec_name"].startswith("pcm_"):
                check("%s sound: ffprobe's %s is read as uncompressed sound Lantern decodes itself" % (label, st["codec_name"]), lt["pcm"] and lt["codec"] == "pcm", (lt["codec"], lt["pcm"]))
            if lt["type"] == "video":
                check("%s picture: %dx%d as ffprobe" % (label, st["width"], st["height"]), (lt["w"], lt["h"]) == (st["width"], st["height"]), (lt["w"], lt["h"]))
                if not label.endswith(".avi"):
                    rot = (-stream_rotation(st)) % 360
                    check("%s picture: turned %d degrees clockwise for showing, as ffprobe's display matrix says" % (label, rot), lt["rot"] == rot, (lt["rot"], stream_rotation(st)))
                fr = st.get("avg_frame_rate", "0/1").split("/")
                if int(fr[1]) and label not in ("vfr.mp4",):
                    afr = int(fr[0]) / int(fr[1])
                    check("%s picture: frame rate %.3f as ffprobe's average" % (label, afr), abs(lt["fps"] - afr) < 0.01 * afr, (lt["fps"], afr))
            else:
                check("%s sound: %d Hz, %d channels as ffprobe" % (label, int(st["sample_rate"]), st["channels"]), (int(lt["sr"]), lt["ch"]) == (int(st["sample_rate"]), st["channels"]), (lt["sr"], lt["ch"]))
            if lt["type"] == "audio" and lt["pcm"] and not mk:
                # uncompressed sound in MP4/MOV/AVI is listed in chunks: the frames must add up to what ffmpeg decodes
                dec = decode_f32(f, k).shape[0]
                check("%s sound: %d uncompressed frames, as many as ffmpeg decodes" % (label, dec), lt["frames"] == dec, (lt["frames"], dec))
                continue
            if label.endswith(".avi") and st["codec_name"] not in ("mjpeg",) and not st["codec_name"].startswith("pcm_"):
                # Lantern claims Motion JPEG and PCM in AVI only; for other codecs only the packets themselves are compared
                compare_tracks(label, f, lt, pk, st, 1e9, key_check=False)
                continue
            compare_tracks(label, f, lt, pk, st, tol)
    # WebM's last Opus packet: how much of it is padding (DiscardPadding), against ffprobe's skip_end side data
    for f in ("vp9_opus_portrait.webm", "av1_opus.webm"):
        m = read_file(p(f)); a = [t for t in m["tracks"] if t["type"] == "audio"][0]
        pr = probe(p(f), "-show_packets", "-select_streams", "a", "-show_entries", "packet=pts_time:packet_side_data")
        skip = 0
        for x in pr["packets"]:
            for sd in x.get("side_data_list", []) or []:
                if "skip_samples" in sd or sd.get("side_data_type", "").lower().startswith("skip"): skip = int(sd.get("skip_samples", 0) or 0) + 0
                if "discard_padding" in sd: skip = int(sd["discard_padding"])
        last = pr["packets"][-1]
        sde = [sd for sd in (last.get("side_data_list") or []) if "skip_end" in sd or "discard_padding" in sd]
        want_end = int(sde[0].get("skip_end", sde[0].get("discard_padding", 0))) if sde else 0
        check("%s: the last sound packet's padding (DiscardPadding) %d samples, as ffprobe's skip_end" % (f, want_end), round(a["disc"][-1] * 48000 / 1e9) == want_end, (a["disc"][-1], want_end))

    # --- WAV, every ordinary kind, against ffmpeg's own decoding
    WAVS = [("u8_mono_8k", ["-ar", "8000", "-ac", "1", "-c:a", "pcm_u8"]), ("s16_stereo_441", ["-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le"]),
            ("s24_stereo_48", ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le"]), ("s32_stereo_48", ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s32le"]),
            ("f32_stereo_48", ["-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le"]), ("f64_mono_48", ["-ar", "48000", "-ac", "1", "-c:a", "pcm_f64le"]),
            ("s24_51_48_extensible", ["-ar", "48000", "-ac", "6", "-c:a", "pcm_s24le"]), ("s16_stereo_96k_extensible", ["-ar", "96000", "-ac", "2", "-c:a", "pcm_s16le"]),
            ("s16_with_list_chunk", ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", "-metadata", "title=Odd length title", "-metadata", "artist=Lantern review"]),
            ("s16_rf64", ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", "-rf64", "always"]), ("s16_mono_odd_length", ["-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", "-t", "1.00001"]),
            ("s24_mono_odd_bytes", ["-ar", "48000", "-ac", "1", "-c:a", "pcm_s24le", "-t", "0.020021"])]
    for name, args in WAVS:
        ff("-f", "lavfi", "-i", "anoisesrc=color=white:sample_rate=96000:amplitude=0.6:seed=11:duration=1.5,volume=0.9", *args, p(name + ".wav"))
        ref = decode_f32(p(name + ".wav"), extra=["-af", "aformat=sample_fmts=flt"]) if False else None
        raw = subprocess.run([FF, "-v", "error", "-i", p(name + ".wav"), "-f", "f64le", "-acodec", "pcm_f64le", "-"], capture_output=True).stdout
        ch = int(probe(p(name + ".wav"), "-show_streams")["streams"][0]["channels"]); ref = np.frombuffer(raw, np.float64).reshape(-1, ch)
        r = run(r"""var w = V.riff.readWav(new Uint8Array(fs.readFileSync(%s))); var o = new Float64Array(w.data[0].length * w.channels); for (var i = 0; i < w.data[0].length; i++) for (var c = 0; c < w.channels; c++) o[i * w.channels + c] = w.data[c][i];
            fs.writeFileSync(OUT + '/w.bin', Buffer.from(o.buffer)); return [w.sampleRate, w.channels, w.bits, w.data[0].length];""" % J(p(name + ".wav")))
        got = np.frombuffer(open(p("w.bin"), "rb").read(), np.float64).reshape(-1, ch) if r[3] else np.zeros((0, ch))
        st = probe(p(name + ".wav"), "-show_streams")["streams"][0]
        same = got.shape == ref.shape and (np.abs(got - ref).max() if got.size else 0) <= 1e-7
        check("WAV %s: %d Hz, %d channels, %d frames, every sample as ffmpeg decodes it" % (name, int(st["sample_rate"]), ch, ref.shape[0]),
              same and r[0] == int(st["sample_rate"]) and r[1] == ch, (r, ref.shape, float(np.abs(got - ref).max()) if got.shape == ref.shape and got.size else "shape"))


# ============================================================================================================
# 2. WRITERS: Lantern's MP4/MOV, WebM/MKV, AVI, WAV and GIF read back by ffmpeg
# ============================================================================================================
REMUX_JS = r"""
var f = %s, out = %s, opts = %s, src = bytes(f), rd = /\.(webm|mkv)$/.test(f) ? V.mkv.read(src) : V.mp4.read(src), mk = /\.(webm|mkv)$/.test(out), fromMk = /\.(webm|mkv)$/.test(f);
return rd.then(function (m) {
  var tracks = m.tracks.filter(function (t) { return (t.type === 'video' && !opts.noVideo) || (t.type === 'audio' && !opts.noAudio); }).map(function (t) {
    var o = { type: t.type, codec: t.codec, description: t.description, width: t.width, height: t.height, sampleRate: t.sampleRate, channels: t.channels };
    if (t.pcm) {
      // 16-bit sound as interleaved Int16 (the only uncompressed sound Lantern's MP4 writer takes)
      var b = [], bps = t.bits / 8; t.chunks.forEach(function (c) { var x = src.all.subarray(c.off, c.off + c.frames * t.bpf); for (var i = 0; i < x.length; i += bps) b.push(t.littleEndian ? (x[i] | (x[i+1] << 8)) << 16 >> 16 : ((x[i] << 8) | x[i+1]) << 16 >> 16); });
      o.codec = 'pcm'; o.pcm = Int16Array.from(b); o.samples = [1]; return o;
    }
    if (mk) {
      // WebM/MKV: times in seconds; sound keeps its codec delay as CodecDelay
      o.codecDelay = t.type === 'audio' && t.start < 0 ? -t.start : 0;
      o.samples = t.samples.map(function (s) { return { data: src.all.slice(s.off, s.off + s.size), pts: s.cts / t.timescale + (t.type === 'video' || !(t.start < 0) ? t.start : 0), key: s.key, discardNs: s.discardNs }; });
    } else {
      var ts = fromMk ? (t.type === 'audio' ? t.sampleRate : 90000) : t.timescale;
      o.timescale = ts;
      o.samples = t.samples.map(function (s) { var sec = s.cts / t.timescale + t.start; return { data: src.all.slice(s.off, s.off + s.size), pts: Math.round(sec * ts), key: s.key }; });
    }
    return o;
  });
  fs.writeFileSync(out, mk ? V.webmw.write({ matroska: /mkv$/.test(out), tracks: tracks }) : V.mp4w.write({ mov: /mov$/.test(out), tracks: tracks }));
  return tracks.map(function (t) { return t.type; });
});"""

def packet_pts(f, sel):
    pr = probe(f, "-show_packets", "-select_streams", sel, "-show_entries", "packet=pts_time")
    return sorted(float(x["pts_time"]) for x in pr["packets"] if x.get("pts_time") not in (None, "N/A"))
def sound_from_zero(f, k=0):
    """the sound a player plays from presentation time 0 on (what is before 0 is cut), as 16-bit stereo-or-mono frames"""
    ch = int(probe(f, "-show_streams", "-select_streams", "a:%d" % k)["streams"][0]["channels"])
    raw = subprocess.run([FF, "-v", "error", "-copyts", "-i", f, "-map", "0:a:%d" % k, "-af", "atrim=start=0", "-f", "s16le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, ch).astype(np.int32)
def sound_lag(x, y, span=2048):
    """how many samples y is late against x, from their first 20,000 samples; and whether they then agree exactly"""
    n = min(len(x), len(y)) - 2 * span - 20000
    if n < 0: return None, None
    c = int(np.argmax((x[:40000].astype(float) ** 2).sum(0)))      # the loudest channel (a centre-only 5.1 has silent fronts)
    seg = y[span:span + 20000, c]
    best = min(range(-span, span + 1), key=lambda L: int(np.abs(x[span + L:span + L + 20000, c] - seg).sum()))
    m = min(len(x) - (span + best), len(y) - span) - 4096
    same = int(np.abs(x[span + best:span + best + m] - y[span:span + m]).max()) if m > 0 else None
    return best, same

def remux_checks(srcf, outf, opts=None, audio_tracks=1, video=True):
    run(REMUX_JS % (J(p(srcf)), J(p(outf)), J(opts or {})))
    a, b = p(srcf), p(outf)
    ref = p("ffref_" + outf)
    ff("-i", a, "-map", "0:v?", "-map", "0:a?", "-c", "copy", ref)    # ffmpeg's own rewrite into the same container
    cross = srcf.rsplit(".", 1)[1] in ("mkv", "webm") or outf.rsplit(".", 1)[1] in ("mkv", "webm")
    e = errors_of(b)
    check("%s rewritten by Lantern as %s: ffmpeg reads it with no error or warning" % (srcf, outf), e == "", e)
    if video:
        sa, sb = vsig(a), vsig(b)
        check("%s -> %s: every picture decodes the same (%d frames)" % (srcf, outf, len(sa)), sa == sb and len(sa) > 5, (len(sa), len(sb), sum(1 for x, y in zip(sa, sb) if x != y)))
        pa, pb = packet_pts(a, "v:0"), packet_pts(b, "v:0")
        tolp = 0.0011 if cross else 0.0006   # an MP4 edit list counts in the movie's milliseconds: half of one is allowed
        okp = len(pa) == len(pb) and max(abs(x - y) for x, y in zip(pa, pb)) <= tolp
        check("%s -> %s: every picture shown at the same time (within %g s)" % (srcf, outf, tolp), okp, (len(pa), len(pb), [(round(x, 4), round(y, 4)) for x, y in zip(pa, pb) if abs(x - y) > tolp][:4]))
        # seeking: ask both files for the frame 60% of the way in, by its own time (a quarter of a frame early)
        k = int(len(pa) * 0.6); dur_ = (pa[-1] - pa[0]) / max(1, len(pa) - 1); t_ = pa[k] - 0.25 * dur_
        fa = vsig(a, ["-seek_timestamp", "1", "-ss", "%.5f" % t_])[:1]; fb = vsig(b, ["-seek_timestamp", "1", "-ss", "%.5f" % t_])[:1]
        check("%s -> %s: a seek to picture %d (60%% of the way in) finds that picture" % (srcf, outf, k), fb and fb == [sa[k]] if fa == [sa[k]] else fb == fa, (fa, fb, sa[k]))
    for kk in range(audio_tracks):
        x, y = sound_from_zero(a, kk), sound_from_zero(b, kk)
        lag, diff = sound_lag(x, y)
        tol = 48 if cross else 0
        check("%s -> %s: sound track %d plays the same samples from time 0 on, in step with the pictures (within %d samples)" % (srcf, outf, kk + 1, tol),
              lag is not None and abs(lag) <= tol and diff == 0, ("lag", lag, "max diff after aligning", diff, len(x), len(y)))
    da = float(probe(ref, "-show_format")["format"]["duration"]); db_ = float(probe(b, "-show_format")["format"]["duration"])
    check("%s -> %s: the file lasts as long as ffmpeg's own rewrite (%.3f s, within 1/30 s)" % (srcf, outf, da), abs(da - db_) <= 0.034, (da, db_))

if want("writers"):
    need = ["phone_portrait.mp4", "sd_23976_mono441.mp4", "odd_642x362_25_51.mp4", "ntsc5994.mp4", "vfr.mp4", "hevc.mp4", "av1.mp4", "frag.mp4",
            "two_audio.mp4", "camera.mov", "pcm_s16le.mov", "pcm_s16be.mov", "pcm_s16le_mono.mov", "only_audio.m4a", "vp8_vorbis.webm", "vp9_opus_portrait.webm",
            "av1_opus.webm", "h264_aac_bframes.mkv", "h264_flac.mkv", "smallclusters.webm"]
    if not os.path.exists(p("phone_portrait.mp4")):
        make("phone_portrait.mp4", *LAVV("1080x1920", "30"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "3", "-g", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest")
        make("sd_23976_mono441.mp4", *LAVV("854x480", "24000/1001"), *LAVA(44100, 1), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "0", "-g", "48", "-c:a", "aac", "-shortest")
        make("odd_642x362_25_51.mp4", *LAVV("642x362", "25"), *lava_multi(48000, "5.1"), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-shortest")
        make("ntsc5994.mp4", *LAVV("1280x720", "60000/1001", 1.5), *LAVA(48000, 2, 1.5), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-shortest")
        ff(*LAVV("640x360", "30", 3), "-vf", "select='not(eq(mod(n\\,5)\\,2))*not(eq(mod(n\\,7)\\,3))'", "-fps_mode", "vfr", "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", p("vfr.mp4"))
        make("hevc.mp4", *LAVV("640x360", "30"), "-c:v", "libx265", "-preset", "ultrafast", "-tag:v", "hvc1", "-x265-params", "log-level=error")
        make("av1.mp4", *LAVV("320x240", "24", 1), "-c:v", "libaom-av1", "-cpu-used", "8", "-b:v", "200k")
        make("frag.mp4", *LAVV("320x240", "30"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-g", "15", "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-shortest")
        make("two_audio.mp4", *LAVV("320x240", "25"), *LAVA(48000, 2, 2), *LAVA(44100, 1, 2, 880), "-map", "0:v", "-map", "1:a", "-map", "2:a", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest")
        make("camera.mov", *LAVV("1280x720", "30000/1001"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "2", "-c:a", "aac", "-timecode", "01:00:00;00", "-shortest")
        for codec, tag in [("pcm_s16le", "s16le"), ("pcm_s16be", "s16be")]:
            make("pcm_%s.mov" % tag, *LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", codec, "-shortest")
        make("pcm_s16le_mono.mov", *LAVV("320x240", "25"), *LAVA(44100, 1), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "pcm_s16le", "-shortest")
        make("only_audio.m4a", *LAVA(48000, 2, 2), "-c:a", "aac")
        make("vp8_vorbis.webm", *LAVV("320x240", "30"), *LAVA(44100, 2), "-c:v", "libvpx", "-b:v", "300k", "-c:a", "libvorbis", "-shortest")
        make("vp9_opus_portrait.webm", *LAVV("360x640", "30"), *LAVA(48000, 2), "-c:v", "libvpx-vp9", "-b:v", "300k", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest")
        make("av1_opus.webm", *LAVV("320x240", "24", 1), *LAVA(48000, 1, 1), "-c:v", "libaom-av1", "-cpu-used", "8", "-b:v", "200k", "-c:a", "libopus", "-shortest")
        make("h264_aac_bframes.mkv", *LAVV("640x360", "30000/1001"), *LAVA(48000, 2), "-c:v", "libx264", "-preset", "ultrafast", "-bf", "3", "-c:a", "aac", "-shortest")
        make("h264_flac.mkv", *LAVV("320x240", "25"), *LAVA(44100, 2), "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "flac", "-shortest")
        ff(*LAVV("320x240", "25"), *LAVA(48000, 2), "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest", "-f", "webm", "-cluster_size_limit", "2000", p("smallclusters.webm"))
    # MP4 and MOV
    remux_checks("phone_portrait.mp4", "w_phone.mp4")
    remux_checks("sd_23976_mono441.mp4", "w_23976.mp4")
    remux_checks("odd_642x362_25_51.mp4", "w_51.mp4")
    remux_checks("ntsc5994.mp4", "w_5994.mp4")
    remux_checks("vfr.mp4", "w_vfr.mp4", audio_tracks=0)
    remux_checks("hevc.mp4", "w_hevc.mp4", audio_tracks=0)
    remux_checks("av1.mp4", "w_av1.mp4", audio_tracks=0)
    remux_checks("frag.mp4", "w_unfrag.mp4")
    remux_checks("two_audio.mp4", "w_two_audio.mp4", audio_tracks=2)
    remux_checks("camera.mov", "w_camera.mp4")
    remux_checks("pcm_s16le.mov", "w_pcm.mov")
    remux_checks("pcm_s16be.mov", "w_pcm_be.mov")
    remux_checks("pcm_s16le_mono.mov", "w_pcm_mono.mov")
    remux_checks("only_audio.m4a", "w_audio.m4a", video=False)
    remux_checks("vp9_opus_portrait.webm", "w_vp9_opus.mp4")
    remux_checks("h264_aac_bframes.mkv", "w_mkv_to.mp4")
    # WebM and Matroska
    remux_checks("vp8_vorbis.webm", "w_vp8_vorbis.webm")
    remux_checks("vp9_opus_portrait.webm", "w_vp9.webm")
    remux_checks("av1_opus.webm", "w_av1.webm")
    remux_checks("smallclusters.webm", "w_small.webm")
    remux_checks("h264_aac_bframes.mkv", "w_h264.mkv")
    remux_checks("phone_portrait.mp4", "w_phone.mkv")
    remux_checks("h264_flac.mkv", "w_flac.mkv")
    # a WebM a player can seek in: a minute of VP8 and Opus rewritten by Lantern; a seek near its end should not read the whole file
    ff("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30:duration=60", "-f", "lavfi", "-i", "sine=sample_rate=48000:duration=60", "-c:v", "libvpx", "-b:v", "500k", "-deadline", "realtime", "-cpu-used", "8", "-g", "60", "-c:a", "libopus", "-shortest", p("minute.webm"))
    run(REMUX_JS % (J(p("minute.webm")), J(p("w_minute.webm")), J({})))
    def bytes_read_seeking(f):
        e = subprocess.run([FF, "-v", "debug", "-ss", "55", "-i", f, "-frames:v", "1", "-f", "null", "-"], capture_output=True, text=True).stderr
        m = re.findall(r"Statistics: (\d+) bytes read", e)
        return int(m[-1]) if m else -1
    size_ = os.path.getsize(p("w_minute.webm")); rb = bytes_read_seeking(p("w_minute.webm")); rb_ff = bytes_read_seeking(p("minute.webm"))
    check("Lantern's WebM: a seek to 55 s of a 60 s file reads less than a quarter of it (its Cues found through a SeekHead, as ffmpeg's own file allows: %d%% read there)" % round(100 * rb_ff / os.path.getsize(p("minute.webm"))),
          0 < rb < size_ / 4, ("bytes read", rb, "of", size_, "ffmpeg's own file", rb_ff))

    # AVI: Motion JPEG pictures and 16-bit sound, written by Lantern from ffmpeg's JPEGs
    AVI_JS = r"""var src = bytes(%s), fps = %s, rate = %d, out = %s, withAudio = %s; return V.riff.readAvi(src).then(function (m) { var v = m.tracks[0], a = m.tracks[1], pcm = null;
        if (withAudio && a && a.pcm) { var b = []; a.chunks.forEach(function (c) { var x = src.all.subarray(c.off, c.off + c.frames * a.bpf); for (var i = 0; i < x.length; i += 2) b.push((x[i] | (x[i+1] << 8)) << 16 >> 16); }); pcm = Int16Array.from(b); }
        else if (withAudio) { var n = Math.round(v.samples.length * fps.den / fps.num * rate), q = new Int16Array(n * 2); for (var i = 0; i < n; i++) { var s = Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / rate)); q[2*i] = s; q[2*i+1] = -s; } pcm = q; }
        var frames = v.samples.map(function (s) { return src.all.slice(s.off, s.off + s.size); });
        fs.writeFileSync(out, V.riff.writeAvi({ width: v.width, height: v.height, fps: fps, frames: frames, audio: pcm ? { rate: rate, channels: 2, pcm16: pcm } : null }));
        if (pcm) fs.writeFileSync(out + '.pcm', Buffer.from(pcm.buffer)); return [frames.length, frames.filter(function (x) { return x.length & 1; }).length, pcm ? pcm.length / 2 : 0]; });"""
    for srcf, fps, rate, outf, wa in [("mjpeg_pcm16.avi", "{num:25,den:1}", 44100, "w_25.avi", "true"), ("mjpeg_ntsc_noaudio.avi", "{num:30000,den:1001}", 48000, "w_2997.avi", "true"),
                                      ("mjpeg_ntsc_noaudio.avi", "{num:24000,den:1001}", 48000, "w_23976.avi", "true"), ("mjpeg_pcm16.avi", "{num:25,den:1}", 44100, "w_silent.avi", "false")]:
        if not os.path.exists(p(srcf)):
            if srcf == "mjpeg_pcm16.avi": make(srcf, *LAVV("480x270", "25"), *LAVA(44100, 2), "-c:v", "mjpeg", "-q:v", "5", "-c:a", "pcm_s16le", "-shortest")
            else: make(srcf, *LAVV("640x480", "30000/1001"), "-c:v", "mjpeg", "-q:v", "5")
        r = run(AVI_JS % (J(p(srcf)), fps, rate, J(p(outf)), wa))
        e = errors_of(p(outf))
        check("AVI %s (%d frames, %d of odd length): ffmpeg reads it with no error or warning" % (outf, r[0], r[1]), e == "", e)
        check("AVI %s: every picture decodes as ffmpeg's own JPEGs" % outf, vsig(p(srcf)) == vsig(p(outf)), (len(vsig(p(srcf))), len(vsig(p(outf)))))
        st = probe(p(outf), "-show_streams", "-count_packets")["streams"]
        num, den = [int(x) for x in fps.strip("{}").replace("num:", "").replace("den:", "").split(",")]
        check("AVI %s: frame rate %d/%d as written (ffprobe)" % (outf, num, den), st[0]["r_frame_rate"] == "%d/%d" % (num, den) and int(st[0]["nb_read_packets"]) == r[0], (st[0]["r_frame_rate"], st[0]["nb_read_packets"]))
        if r[2]:
            got = np.frombuffer(subprocess.run([FF, "-v", "error", "-i", p(outf), "-map", "0:a", "-f", "s16le", "-"], capture_output=True).stdout, np.int16)
            want_ = np.frombuffer(open(p(outf) + ".pcm", "rb").read(), np.int16)
            check("AVI %s: the sound decodes sample for sample as given (%d frames)" % (outf, r[2]), got.shape == want_.shape and (got == want_).all(), (got.shape, want_.shape))
            vd = r[0] * den / num; ad = r[2] / rate
            check("AVI %s: the sound lasts as long as the pictures (%.3f s)" % (outf, vd), abs(vd - ad) < 1.0 / rate * 2, (vd, ad))
        kf = int(r[0] * 0.55); allf = vsig(p(srcf))
        tb_ = (kf - 0.25) * den / num
        fb_ = vsig(p(outf), ["-seek_timestamp", "1", "-ss", "%.5f" % tb_])[:1]
        check("AVI %s: a seek to picture %d finds that picture" % (outf, kf), fb_ == [allf[kf]], (fb_, allf[kf], allf.index(fb_[0]) if fb_ and fb_[0] in allf else None))

    # WAV: written by Lantern, read by ffmpeg
    WAVW_JS = r"""var n = %d, k = %d, bits = %d, sr = %d, chs = [], seed = 3; function rnd() { seed = (seed * 1103515245 + 12345) %% 2147483648; return seed / 2147483648 * 2 - 1; }
      for (var c = 0; c < k; c++) { var x = new Float32Array(n); for (var i = 0; i < n; i++) x[i] = 0.7 * Math.sin(2 * Math.PI * (300 + 100 * c) * i / sr) + 0.2 * rnd(); x[0] = 1.2; x[1] = -1.3; chs.push(x); }
      var w = V.riff.writeWav(chs, sr, bits); fs.writeFileSync(%s, w); var o = new Float32Array(n * k); for (var i = 0; i < n; i++) for (var c = 0; c < k; c++) o[i * k + c] = chs[c][i]; save32(%s, o); return w.length;"""
    for k, bits, n, sr in [(1, 16, 48000, 48000), (2, 16, 44100, 44100), (2, 24, 48000, 48000), (2, 32, 48000, 48000), (6, 24, 4800, 48000), (6, 16, 4800, 48000), (1, 24, 4801, 48000), (2, 16, 96000, 96000)]:
        name = "lw_%dch_%d_%d_%d.wav" % (k, bits, n, sr)
        size = run(WAVW_JS % (n, k, bits, sr, J(p(name)), J(p(name + ".f32"))))
        e = errors_of(p(name))
        st = probe(p(name), "-show_streams")["streams"][0]
        x = np.frombuffer(open(p(name + ".f32"), "rb").read(), np.float32).reshape(-1, k).astype(np.float64)
        y = decode_f32(p(name)).astype(np.float64)
        if bits == 32: want_ = x
        else: q = 2 ** (bits - 1); want_ = np.clip(np.floor(x * q + 0.5), -q, q - 1) / q   # JavaScript's Math.round (halves up)
        okv = y.shape == want_.shape and np.abs(y - want_).max() <= 1e-6
        check("WAV written by Lantern, %d ch %d-bit %d Hz: ffmpeg reads %d frames, the values given (clipped for integers)" % (k, bits, sr, n), e == "" and okv and int(st["channels"]) == k and int(st["sample_rate"]) == sr, (e, y.shape, want_.shape, float(np.abs(y - want_).max()) if y.shape == want_.shape else None))
        if (n * k * bits // 8) % 2:
            b = open(p(name), "rb").read()
            check("WAV written by Lantern, %d ch %d-bit %d frames: the odd-length data chunk is padded to an even length as RIFF requires" % (k, bits, n), len(b) % 2 == 0 and int.from_bytes(b[4:8], "little") == len(b) - 8, (len(b), int.from_bytes(b[4:8], "little")))
        if k > 2:
            b = open(p(name), "rb").read()
            check("WAV written by Lantern, %d ch %d-bit: written as WAVE_FORMAT_EXTENSIBLE with a channel mask (which speaker each channel is), as Microsoft asks for more than 2 channels" % (k, bits), int.from_bytes(b[20:22], "little") == 0xFFFE, hex(int.from_bytes(b[20:22], "little")))

    # GIF
    try:
        from PIL import Image, ImageSequence
        ff("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=1", "-f", "rawvideo", "-pix_fmt", "rgba", p("gif_src.rgba"))
        GIF_JS = r"""var w = 320, h = 180, all = fs.readFileSync(%s), n = all.length / (w * h * 4), fr = []; for (var i = 0; i < n; i++) fr.push(new Uint8ClampedArray(all.buffer, all.byteOffset + i * w * h * 4, w * h * 4));
          var out = {}; %s.forEach(function (fp) { var g = V.gifw.start(w, h, true), d = V.gifw.delays(n, fp); d.forEach(function (x) { g.add(fr[x.frame], x.delay, true); });
            fs.writeFileSync(OUT + '/g_' + fp.num + '_' + fp.den + '.gif', g.done()); out[fp.num + '/' + fp.den] = d; }); return out;"""
        rates = [(30, 1), (25, 1), (30000, 1001), (60000, 1001), (12, 1), (24000, 1001), (50, 1)]
        r = run(GIF_JS % (J(p("gif_src.rgba")), J([{"num": a, "den": b} for a, b in rates])))
        src = np.frombuffer(open(p("gif_src.rgba"), "rb").read(), np.uint8).reshape(-1, 180, 320, 4)[..., :3].astype(float)
        for a, b in rates:
            fn = p("g_%d_%d.gif" % (a, b)); d = r["%d/%d" % (a, b)]
            im = Image.open(fn); errs = []; durs = []; frames = []
            for i, f_ in enumerate(ImageSequence.Iterator(im)):
                arr = np.array(f_.convert("RGB")).astype(float); frames.append(arr); durs.append(f_.info.get("duration"))
            errs = [np.abs(frames[i] - src[d[i]["frame"]]).mean() for i in range(min(len(frames), len(d)))]
            total = len(src) * b / a
            check("GIF at %d/%d fps: PIL reads %d frames, each within 4 levels on average of the picture given" % (a, b, len(d)), len(frames) == len(d) and max(errs) < 4, (len(frames), len(d), max(errs) if errs else None))
            check("GIF at %d/%d fps: the delays add up to the clip's length (%.3f s) within 1/100 s, none under 2/100" % (a, b, total), abs(sum(durs) / 1000 - total) <= 0.0101 and min(durs) >= 20, (sum(durs), durs[:8]))
            check("GIF at %d/%d fps: ffmpeg decodes it with no error" % (a, b), errors_of(fn) == "", errors_of(fn))
        lp = open(p("g_30_1.gif"), "rb").read()
        i = lp.find(b"NETSCAPE2.0")
        check("GIF: loops for ever (NETSCAPE2.0 loop count 0), as an exported GIF should", i > 0 and lp[i + 14:i + 16] == b"\x00\x00", lp[i:i + 18])
        # a picture of 64 greys (as a title card or a screen recording has): a GIF can hold it exactly, with no dithering
        r = run(r"""var w = 256, h = 32, px = new Uint8ClampedArray(w * h * 4); for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var i = (y * w + x) * 4, v = Math.floor(x / 4) * 4; px[i] = px[i+1] = px[i+2] = v; px[i+3] = 255; }
            var g = V.gifw.start(w, h, true); g.add(px, 4, false); fs.writeFileSync(OUT + '/greys.gif', g.done()); return 1;""")
        arr = np.array(Image.open(p("greys.gif")).convert("RGB")).astype(int)
        want_ = (np.arange(256) // 4 * 4)[None, :].repeat(32, 0)
        check("GIF: 64 distinct greys (fewer than 256 colours), undithered, come back exactly", (arr[..., 0] == want_).all(), ("max error", int(np.abs(arr[..., 0] - want_).max()), "levels found", len(np.unique(arr[..., 0]))))
        # noise: the LZW code table fills and is cleared many times
        r = run(r"""var w = 200, h = 150, px = new Uint8ClampedArray(w * h * 4), s = 9; for (var i = 0; i < px.length; i += 4) { s = (s * 1103515245 + 12345) % 2147483648; var c = (s >> 8) & 255; px[i] = c; px[i+1] = (c * 7) & 255; px[i+2] = (c * 13) & 255; px[i+3] = 255; }
            var g = V.gifw.start(w, h, true); g.add(px, 10, false); fs.writeFileSync(OUT + '/noise.gif', g.done()); fs.writeFileSync(OUT + '/noise.rgba', Buffer.from(px.buffer)); return 1;""")
        arr = np.array(Image.open(p("noise.gif")).convert("RGB")).astype(int); srcn = np.frombuffer(open(p("noise.rgba"), "rb").read(), np.uint8).reshape(150, 200, 4)[..., :3].astype(int)
        check("GIF: a frame of 256-colour noise (the LZW table cleared again and again) decodes to within 8 levels everywhere", arr.shape == srcn.shape and np.abs(arr - srcn).max() <= 8, int(np.abs(arr - srcn).max()))
    except ImportError:
        pass


# ============================================================================================================
# 3. TIMECODE against SMPTE 12M drop-frame arithmetic done here
# ============================================================================================================
def smpte_tc(frame, num, den, drop):
    neg = frame < 0; frame = abs(frame)
    nom = round(num / den)
    if drop and den == 1001 and nom in (30, 60):
        d = 2 if nom == 30 else 4
        per10 = nom * 600 - 9 * d; per1 = nom * 60 - d
        D, M = divmod(frame, per10)
        frame = frame + 9 * d * D + (d * ((M - d) // per1) if M >= d else 0)
        sep = ";"
    else: sep = ":"
    ff_ = frame % nom; s_ = frame // nom
    return ("-" if neg else "") + "%02d:%02d:%02d%s%02d" % (s_ // 3600, s_ // 60 % 60, s_ % 60, sep, ff_)

if want("time"):
    frames = list(range(0, 36000)) + list(range(36000, 30 * 3600 * 60, 9973))
    r = run(r"""var T = V.time, fr = %s, out = {}, rates = [[30000,1001,true],[60000,1001,true],[30000,1001,false],[24000,1001,false],[25,1,false],[50,1,false],[24,1,false],[60000,1001,false]];
      rates.forEach(function (x) { var r = T.rate(x[0], x[1]), list = [], back = []; fr.forEach(function (f) { var s = T.tc(f, r, x[2]); list.push(s); back.push(T.parseTc(s, r, x[2])); }); out[x.join('/')] = { tc: list, back: back }; });
      var r30 = T.rate(30, 1), r2997 = T.rate(30000, 1001);
      out.neg = [T.tc(-45, r30, false), T.parseTc('-00:00:01:15', r30), T.tc(-1800, r2997, true), T.parseTc('-00:01:00;02', r2997)];
      out.doc = [T.parseTc('00:00:10.5', r30), T.parseTc('+2:00', r30), T.parseTc('1:02:03:04', r30), T.parseTc('150', r30), T.parseTc('10.5', r30)];
      out.bad = [T.parseTc('00:00:00:30', r30), T.parseTc('00:61:00:00', r30), T.parseTc('ab:cd', r30), T.parseTc('', r30)];
      out.fps = [[29.97002997, T.fromFps(29.97002997)], [29.98, T.fromFps(29.98)], [30, T.fromFps(30)], [23.976, T.fromFps(23.976)], [23.98, T.fromFps(23.98)], [24, T.fromFps(24)], [25, T.fromFps(25)], [50, T.fromFps(50)], [59.94, T.fromFps(59.94)], [60, T.fromFps(60)], [120, T.fromFps(120)]];
      out.frameOf = [T.frame(T.sec(107892, r2997), r2997), T.frame(1.0, T.rate(24000, 1001)), T.frame(3600, r2997), T.frame(0.0333666, r2997)];
      return out;""" % J(frames))
    for key, (num, den, drop) in {"30000/1001/true": (30000, 1001, True), "60000/1001/true": (60000, 1001, True), "30000/1001/false": (30000, 1001, False), "24000/1001/false": (24000, 1001, False),
                                  "25/1/false": (25, 1, False), "50/1/false": (50, 1, False), "24/1/false": (24, 1, False), "60000/1001/false": (60000, 1001, False)}.items():
        want_ = [smpte_tc(f, num, den, drop) for f in frames]
        got = r[key]["tc"]
        bad = [(f, a, b) for f, a, b in zip(frames, got, want_) if a != b]
        name = "%s fps %s" % ({30000: "29.97", 60000: "59.94", 24000: "23.976"}.get(num, str(num)), "drop-frame" if drop else "non-drop")
        check("timecode %s: every frame of the first 20 minutes and every 9973rd to 30 hours as SMPTE 12M counts it" % name, not bad, bad[:4])
        back_bad = [(f, b) for f, b in zip(frames, r[key]["back"]) if f != b]
        check("timecode %s: each one typed back gives its own frame" % name, not back_bad, back_bad[:4])
    # the hour marks an EDL and every program start from
    check("timecode: frame 107892 at 29.97 drop-frame is 01:00:00;00, 108000 at 29.97 non-drop is 01:00:00:00, 86400 at 23.976 is 01:00:00:00",
          [r["30000/1001/true"]["tc"][frames.index(107892)] if 107892 in frames else smpte_tc(107892, 30000, 1001, True)] == ["01:00:00;00"], "")
    check("timecode: negative times are written with a minus and read back (-45 at 30 fps, -1800 at 29.97 drop-frame)", r["neg"] == ["-00:00:01:15", -45, "-00:01:00;02", -1800], r["neg"])
    check("timecode typed as the module says it reads it: \"00:00:10.5\" is 10.5 seconds (frame 315 at 30 fps)", r["doc"][0] == 315, r["doc"][0])
    check("timecode typed as the module says it reads it: \"+2:00\" is two seconds (60 frames at 30 fps)", r["doc"][1] == 60, r["doc"][1])
    check("timecode typed: 1:02:03:04 at 30 fps is frame 111694; \"150\" is 150 frames; \"10.5\" is 10.5 s", r["doc"][2:] == [111694, 150, 315], r["doc"][2:])
    check("timecode typed: a frame number past the rate, minutes past 59, letters and nothing are refused", r["bad"] == [None, None, None, None], r["bad"])
    want_fps = {29.97002997: (30000, 1001), 29.98: (30000, 1001), 30: (30, 1), 23.976: (24000, 1001), 23.98: (24000, 1001), 24: (24, 1), 25: (25, 1), 50: (50, 1), 59.94: (60000, 1001), 60: (60, 1), 120: (120, 1)}
    badf = [(f, g) for f, g in r["fps"] if (g["num"], g["den"]) != want_fps[f]]
    check("a measured frame rate named as the standard one it is (29.98 -> 30000/1001, 23.98 -> 24000/1001, 59.94 -> 60000/1001, ...)", not badf, badf)
    check("the frame showing at a time: frame 107892's own start; 1 s at 23.976 is frame 23; 3600 s at 29.97 is 107892; 0.0333666 s (just before frame 1 begins) is frame 0",
          r["frameOf"] == [107892, 23, 107892, 0], r["frameOf"])

# ============================================================================================================
# 4. EDITS: a seeded fuzz of every edit on linked picture+sound, and Premiere's behaviour by hand
# ============================================================================================================
EDIT_LIB = r"""
var S = V.seq, E = V.edit, T = V.time;
var seed = 20261126; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick(a) { return a[ri(0, a.length - 1)]; }
var RATES = [[24000, 1001], [25, 1], [30000, 1001], [30, 1], [60, 1]], MED = { m0: 3.0, m1: 5.5, m2: 10.0, m3: 2.2, m4: 7.77 };
function fps(seq) { return seq.rate.num / seq.rate.den; }
function newProj() { var p = S.project(), seq = p.seqs[p.active], r = pick(RATES); seq.rate = T.rate(r[0], r[1]); for (var k in MED) p.media[k] = { id: k, kind: 'video', dur: MED[k], hasAudio: true }; return p; }
function pair(seq, i, len) {
  var m = pick(Object.keys(MED)), maxF = Math.floor(MED[m] * fps(seq) + 1e-9), dur = ri(1, Math.min(maxF, len || 150)), inF = ri(0, maxF - dur), l = S.uid('l'), si = inF / fps(seq);
  return [{ t: seq.v[i], c: S.clip({ media: m, dur: dur, srcIn: si, link: l }) }, { t: seq.a[i], c: S.clip({ media: m, dur: dur, srcIn: si, link: l }) }];
}
function inv(p, seq) {
  var bad = { overlap: [], bounds: [], src: [], link: [] };
  S.tracks(seq).forEach(function (t) {
    for (var i = 0; i < t.clips.length; i++) {
      var c = t.clips[i];
      if (!(c.dur >= 1) || c.dur !== Math.round(c.dur) || c.start < 0 || c.start !== Math.round(c.start)) bad.bounds.push([t.name, c.start, c.dur]);
      if (i && c.start < t.clips[i - 1].start + t.clips[i - 1].dur) bad.overlap.push([t.name, t.clips[i - 1].start, t.clips[i - 1].dur, c.start, c.dur]);
      var len = S.mediaLen(p, c);
      if (c.hold === null && len !== Infinity && (c.srcIn < -1e-9 || c.srcIn + S.srcSpan(c, seq) > len + 1e-6)) bad.src.push([t.name, +c.srcIn.toFixed(5), +S.srcSpan(c, seq).toFixed(5), len, c.speed, c.reverse]);
    }
  });
  var g = {}; S.all(seq).forEach(function (x) { if (x.c.link) (g[x.c.link] = g[x.c.link] || []).push(x); });
  // each picture of a linked group has its sound beside it (the same start and length), and each sound its picture
  Object.keys(g).forEach(function (k) { var v = g[k].filter(function (x) { return x.t.kind === 'v'; }), a = g[k].filter(function (x) { return x.t.kind === 'a'; });
    if (!v.length || !a.length) return;
    v.forEach(function (x) { if (!a.some(function (y) { return x.c.start === y.c.start && x.c.dur === y.c.dur; })) bad.link.push(['picture', x.c.start, x.c.dur, a.map(function (y) { return [y.c.start, y.c.dur]; })]); });
    a.forEach(function (y) { if (!v.some(function (x) { return x.c.start === y.c.start && x.c.dur === y.c.dur; })) bad.link.push(['sound', y.c.start, y.c.dur, v.map(function (x) { return [x.c.start, x.c.dur]; })]); }); });
  return bad;
}
function partnersOf(seq, c) { return S.partners(seq, c); }
"""
if want("edits"):
    r = run(EDIT_LIB + r"""
var OPS = ['insert', 'overwrite', 'razor', 'rippleDelete', 'rippleDelete2', 'lift', 'extract', 'trimHead', 'trimHeadRipple', 'trimTail', 'trimTailRipple', 'roll', 'slip', 'slide', 'rateStretch', 'setSpeed', 'move', 'moveInsert'];
var KEEPS_LINK = { insert: 1, overwrite: 1, razor: 1, rippleDelete: 1, rippleDelete2: 1, lift: 1, extract: 1, trimHead: 1, trimHeadRipple: 1, trimTail: 1, trimTailRipple: 1, slip: 1, setSpeed: 1, move: 1, moveInsert: 1 };
var st = {}; OPS.forEach(function (o) { st[o] = { n: 0, overlap: 0, bounds: 0, src: 0, link: 0, refusedChanged: 0, ex: {} }; });
for (var run_ = 0; run_ < 120; run_++) {
  var p = newProj(), seq = p.seqs[p.active], f0 = 0;
  for (var k = 0; k < 4; k++) { var it = pair(seq, ri(0, 2)); E.overwrite(seq, f0, it); f0 += it[0].c.dur + ri(0, 1) * ri(0, 20); }
  for (var step = 0; step < 40; step++) {
    var op = pick(OPS), before = JSON.stringify(p), all = S.all(seq), end = S.end(seq), x = all.length ? pick(all) : null, res = null, detail = '';
    if (!x && !/insert|overwrite/.test(op)) continue;
    try {
      if (op === 'insert' || op === 'overwrite') { var f = ri(0, end + 30), items = pair(seq, ri(0, 2)); detail = 'f=' + f; E[op](seq, f, items); }
      else if (op === 'razor') { var f = ri(1, Math.max(1, end - 1)); detail = 'f=' + f; E.razor(seq, f); }
      else if (op === 'rippleDelete') { var ids = [x.c.id].concat(partnersOf(seq, x.c).map(function (y) { return y.c.id; })); E.rippleDelete(seq, ids); }
      else if (op === 'rippleDelete2') { var y2 = pick(all), ids = [x.c.id, y2.c.id]; [x, y2].forEach(function (z) { partnersOf(seq, z.c).forEach(function (q) { if (ids.indexOf(q.c.id) < 0) ids.push(q.c.id); }); }); E.rippleDelete(seq, ids); }
      else if (op === 'lift' || op === 'extract') { var a = ri(0, end), b = ri(a + 1, end + 10); detail = a + '-' + b; E[op](seq, a, b, [seq.v[0], seq.a[0]]); }
      else if (/^trim/.test(op)) {
        var head = /Head/.test(op), mode = /Ripple/.test(op) ? 'ripple' : 'plain', d = ri(-60, 60), parts = partnersOf(seq, x.c); detail = (head ? 'head ' : 'tail ') + mode + ' d=' + d;
        var got = head ? E.trimHead(p, seq, x.t, x.c, d, mode) : E.trimTail(p, seq, x.t, x.c, d, mode); res = got;
        parts.forEach(function (y) { if (head) E.trimHead(p, seq, y.t, y.c, got, mode === 'ripple' ? 'keep' : mode); else E.trimTail(p, seq, y.t, y.c, got, 'plain'); });
      }
      else if (op === 'roll') { var nb = x.t.clips.filter(function (c) { return c.start === x.c.start + x.c.dur; })[0]; if (!nb) continue; var d = ri(-60, 60); detail = 'd=' + d; res = E.roll(p, seq, x.c, nb, d); }
      else if (op === 'slip') { var d = ri(-90, 90); detail = 'd=' + d; res = E.slip(p, seq, x.c, d); partnersOf(seq, x.c).forEach(function (y) { E.slip(p, seq, y.c, d); }); }
      else if (op === 'slide') { var d = ri(-40, 40); detail = 'd=' + d; res = E.slide(p, seq, x.t, x.c, d); }
      else if (op === 'rateStretch') { var nd = ri(1, x.c.dur * 3); detail = 'to ' + nd; E.rateStretch(seq, x.t, x.c, nd); }
      else if (op === 'setSpeed') { var pct = pick([25, 50, 70, 100, 150, 200, 400]), rev = rnd() < 0.3, rip = rnd() < 0.5; detail = pct + '% ' + (rev ? 'rev ' : '') + (rip ? 'ripple' : ''); [x].concat(partnersOf(seq, x.c)).forEach(function (z) { E.setSpeed(p, seq, z.t, z.c, pct, rev, rip); }); }
      else if (op === 'move' || op === 'moveInsert') { var ids = [x.c.id].concat(partnersOf(seq, x.c).map(function (y) { return y.c.id; })), df = ri(-60, 60), dt = ri(-1, 1); detail = 'df=' + df + ' dt=' + dt; E.move(seq, ids, df, dt, op === 'moveInsert'); }
    } catch (e) { st[op].ex.thrown = String(e); }
    st[op].n++;
    var b = inv(p, seq), any = false;
    // every edit starts from a sound state: whatever an edit breaks is counted against it and then undone
    ['overlap', 'bounds', 'src', 'link'].forEach(function (kk) { if (!b[kk].length) return; any = true; if (kk === 'link' && !KEEPS_LINK[op]) return; st[op][kk]++; if (!st[op].ex[kk]) st[op].ex[kk] = { detail: detail, what: b[kk][0] }; });
    if (res === 0 && /trim|roll|slide/.test(op) && JSON.stringify(p) !== before) { st[op].refusedChanged++; any = true; }
    if (any) { p = JSON.parse(before); seq = p.seqs[p.active]; }
  }
}
return st;""")
    names = {"insert": "Insert", "overwrite": "Overwrite", "razor": "Add Edit (razor) on every track", "rippleDelete": "Ripple Delete of a clip and its linked sound", "rippleDelete2": "Ripple Delete of two clips (and their linked sound) at once",
             "lift": "Lift (V1 and A1 targeted)", "extract": "Extract (V1 and A1 targeted)", "trimHead": "a trim of the head (linked sound trimmed with it)", "trimHeadRipple": "a ripple trim of the head (linked sound with it)",
             "trimTail": "a trim of the tail (linked sound with it)", "trimTailRipple": "a ripple trim of the tail (linked sound with it)", "roll": "Roll", "slip": "Slip (linked sound with it)", "slide": "Slide",
             "rateStretch": "Rate Stretch", "setSpeed": "Speed/Duration (linked sound with it)", "move": "a move (overwriting where it lands)", "moveInsert": "a move that inserts"}
    for op, nm in names.items():
        x = r[op]
        check("fuzz (%d random %s edits on linked picture and sound, 5 frame rates): no two clips on a track overlap afterwards" % (x["n"], nm), x["overlap"] == 0, (x["overlap"], x["ex"].get("overlap"), x["ex"].get("thrown")))
        check("fuzz %s: every clip starts on a whole frame at or after 0 and lasts at least a frame" % nm, x["bounds"] == 0, (x["bounds"], x["ex"].get("bounds")))
        check("fuzz %s: no clip shows source before 0 s or past the end of its media" % nm, x["src"] == 0, (x["src"], x["ex"].get("src")))
        if op in ("roll", "slide", "rateStretch"): continue
        check("fuzz %s: a picture and its linked sound still start and end together" % nm, x["link"] == 0, (x["link"], x["ex"].get("link")))
        if op in ("trimHead", "trimHeadRipple", "trimTail", "trimTailRipple"):
            check("fuzz %s: a trim that is refused (0 frames) changes nothing" % nm, x["refusedChanged"] == 0, x["refusedChanged"])
    check("fuzz Roll and Slide: an edit that is refused (0 frames) changes nothing", r["roll"]["refusedChanged"] == 0 and r["slide"]["refusedChanged"] == 0, (r["roll"]["refusedChanged"], r["slide"]["refusedChanged"]))

    # --- by hand, against what Premiere does
    r = run(EDIT_LIB + r"""
var out = {};
function fresh(rate) { var p = S.project(), seq = p.seqs[p.active]; seq.rate = rate || T.rate(30, 1); for (var k in MED) p.media[k] = { id: k, kind: 'video', dur: MED[k] }; p.media.long = { id: 'long', kind: 'video', dur: 100 }; p.media.one = { id: 'one', kind: 'video', dur: 1.0 }; return { p: p, seq: seq }; }
function lay(t) { return t.clips.map(function (c) { return [c.name || c.media, c.start, c.dur]; }); }
function put(seq, t, name, start, dur, srcIn, extra) { var c = S.clip({ media: 'long', start: start, dur: dur, srcIn: srcIn || 0, name: name }); for (var k in extra || {}) c[k] = extra[k]; t.clips.push(c); S.sort(t); return c; }
// H1 Ripple Delete of two clips apart on one track: the two between close up, in order
var h = fresh(), t = h.seq.v[0], A = put(h.seq, t, 'A', 0, 30), B = put(h.seq, t, 'B', 30, 30), C = put(h.seq, t, 'C', 60, 30), D = put(h.seq, t, 'D', 90, 30);
E.rippleDelete(h.seq, [A.id, C.id]); out.h1 = lay(t);
// H2 a ripple trim of a tail where another sync-locked track has a clip across the cut
h = fresh(); var X = put(h.seq, h.seq.v[0], 'X', 0, 60), Y = put(h.seq, h.seq.v[0], 'Y', 60, 60), Z = put(h.seq, h.seq.a[1], 'Z', 0, 100), W = put(h.seq, h.seq.a[1], 'W', 100, 50);
E.trimTail(h.p, h.seq, h.seq.v[0], X, -20, 'ripple'); out.h2 = { v1: lay(h.seq.v[0]), a2: lay(h.seq.a[1]), bad: inv(h.p, h.seq).overlap };
// H2b the same for a ripple trim of a head
h = fresh(); X = put(h.seq, h.seq.v[0], 'X', 0, 60, 5), Y = put(h.seq, h.seq.v[0], 'Y', 60, 60), Z = put(h.seq, h.seq.a[1], 'Z', 0, 100), W = put(h.seq, h.seq.a[1], 'W', 100, 50);
E.trimHead(h.p, h.seq, h.seq.v[0], Y, 20, 'ripple'); out.h2b = { v1: lay(h.seq.v[0]), a2: lay(h.seq.a[1]), bad: inv(h.p, h.seq).overlap };
// H3 Slide into a gap before: the clip must not land on the clip before the gap
h = fresh(); X = put(h.seq, h.seq.v[0], 'X', 0, 30), C = put(h.seq, h.seq.v[0], 'C', 50, 30, 10), N1 = put(h.seq, h.seq.v[0], 'N', 80, 30, 10);
var got3 = E.slide(h.p, h.seq, h.seq.v[0], C, -30); out.h3 = { got: got3, v1: lay(h.seq.v[0]), bad: inv(h.p, h.seq).overlap };
// H4 Slide toward a gap after
h = fresh(); X = put(h.seq, h.seq.v[0], 'X', 0, 30, 10), C = put(h.seq, h.seq.v[0], 'C', 30, 30, 10), Y = put(h.seq, h.seq.v[0], 'Y', 70, 30, 10);
var got4 = E.slide(h.p, h.seq, h.seq.v[0], C, 20); out.h4 = { got: got4, v1: lay(h.seq.v[0]), bad: inv(h.p, h.seq).overlap };
// H5 Roll stops at the media: A (10 s from 0, 90 frames) then B (from 1 s, 60 frames) at 30 fps
h = fresh(); h.p.media.ten = { id: 'ten', kind: 'video', dur: 10 }; h.p.media.four = { id: 'four', kind: 'video', dur: 4 };
var a5 = S.clip({ media: 'ten', start: 0, dur: 90, srcIn: 0 }), b5 = S.clip({ media: 'four', start: 90, dur: 60, srcIn: 1 }); h.seq.v[0].clips.push(a5, b5);
out.h5 = [E.roll(h.p, h.seq, a5, b5, 1000), a5.dur, b5.start, b5.dur, +b5.srcIn.toFixed(6)];
var a5b = S.clip({ media: 'ten', start: 0, dur: 90, srcIn: 0 }), b5b = S.clip({ media: 'four', start: 90, dur: 60, srcIn: 1 }); h.seq.v[1].clips.push(a5b, b5b);
out.h5b = [E.roll(h.p, h.seq, a5b, b5b, -1000), a5b.dur, b5b.start, b5b.dur, +b5b.srcIn.toFixed(6)];
// H6 Insert into the middle of a clip at 25 fps: the right part's in point continues
h = fresh(T.rate(25, 1)); var c6 = S.clip({ media: 'long', start: 0, dur: 100, srcIn: 2 }); h.seq.v[0].clips.push(c6);
E.insert(h.seq, 40, [{ t: h.seq.v[0], c: S.clip({ media: 'm0', dur: 10 }) }]); out.h6 = h.seq.v[0].clips.map(function (c) { return [c.start, c.dur, +c.srcIn.toFixed(6)]; });
// H7 Rate Stretch 60 -> 90 frames: speed 2/3, the same source
h = fresh(); var c7 = put(h.seq, h.seq.v[0], 'R', 0, 60, 1); var span0 = S.srcSpan(c7, h.seq); E.rateStretch(h.seq, h.seq.v[0], c7, 90); out.h7 = [c7.dur, +c7.speed.toFixed(6), +(S.srcSpan(c7, h.seq) - span0).toFixed(9)];
// H8 Speed 50%: twice as long; Ripple moves the next clip, without it the clip stops at the next one
h = fresh(); var c8 = put(h.seq, h.seq.v[0], 'S', 0, 60, 1), n8 = put(h.seq, h.seq.v[0], 'N', 60, 30, 1); E.setSpeed(h.p, h.seq, h.seq.v[0], c8, 50, false, true); out.h8 = lay(h.seq.v[0]);
h = fresh(); c8 = put(h.seq, h.seq.v[0], 'S', 0, 60, 1); n8 = put(h.seq, h.seq.v[0], 'N', 60, 30, 1); var note8 = E.setSpeed(h.p, h.seq, h.seq.v[0], c8, 50, false, false); out.h8b = [lay(h.seq.v[0]), note8];
// H9 Speed 70% of a clip that shows the whole of a 1-second file: still no source past its end
h = fresh(); var c9 = S.clip({ media: 'one', start: 0, dur: 30, srcIn: 0 }); h.seq.v[0].clips.push(c9); E.setSpeed(h.p, h.seq, h.seq.v[0], c9, 70, false, true); out.h9 = [c9.dur, +(c9.srcIn + S.srcSpan(c9, h.seq)).toFixed(6)];
// H10 Extract 10..20 with Sync Lock: everything after moves 10 frames left on every track
h = fresh(); put(h.seq, h.seq.v[0], 'V', 0, 60); put(h.seq, h.seq.a[0], 'A', 0, 60); put(h.seq, h.seq.v[1], 'T', 30, 60); E.extract(h.seq, 10, 20, [h.seq.v[0], h.seq.a[0]]);
out.h10 = [lay(h.seq.v[0]), lay(h.seq.a[0]), lay(h.seq.v[1])];
// H11 Ripple Trim Next Edit to Playhead (W) as the Video tile's own command does it: V1 and A1 targeted (the default), a linked clip under the playhead
function trimTo(p, seq, dir) { var f = seq.playhead; S.tracks(seq).filter(function (t) { return t.target && !t.lock; }).forEach(function (t) { var c = S.at(t, f); if (!c || c.start === f) return;
  if (dir < 0) { var d = f - c.start; E.trimHead(p, seq, t, c, d, 'ripple'); } else { E.trimTail(p, seq, t, c, -(c.start + c.dur - f), 'ripple'); } }); }
h = fresh(); [0, 100, 200].forEach(function (s, i) { var l = 'L' + i; put(h.seq, h.seq.v[0], 'v' + i, s, 100, 0, { link: l }); put(h.seq, h.seq.a[0], 'a' + i, s, 100, 0, { link: l }); });
h.seq.playhead = 60; trimTo(h.p, h.seq, 1); out.h11 = { v1: lay(h.seq.v[0]), a1: lay(h.seq.a[0]), bad: inv(h.p, h.seq) };
h = fresh(); [0, 100, 200].forEach(function (s, i) { var l = 'L' + i; put(h.seq, h.seq.v[0], 'v' + i, s, 100, 0, { link: l }); put(h.seq, h.seq.a[0], 'a' + i, s, 100, 0, { link: l }); });
h.seq.playhead = 140; trimTo(h.p, h.seq, -1); out.h11b = { v1: lay(h.seq.v[0]), a1: lay(h.seq.a[0]), bad: inv(h.p, h.seq) };
// H11c Insert into the middle of a linked picture and sound: each half is linked only to its own half of the sound
h = fresh(); var lv = put(h.seq, h.seq.v[0], 'lv', 0, 90, 0, { link: 'LL' }), la = put(h.seq, h.seq.a[0], 'la', 0, 90, 0, { link: 'LL' });
E.insert(h.seq, 45, [{ t: h.seq.v[1], c: S.clip({ media: 'm0', dur: 20, name: 'ins' }) }]);
out.h11c = S.partners(h.seq, h.seq.v[0].clips[0]).map(function (y) { return [y.t.name, y.c.start, y.c.dur]; });
// H12 Overwrite into the middle of a clip: three pieces, the last one's in point continuing
h = fresh(); put(h.seq, h.seq.v[0], 'base', 0, 90, 3); E.overwrite(h.seq, 30, [{ t: h.seq.v[0], c: S.clip({ media: 'm0', dur: 20, name: 'new' }) }]);
out.h12 = h.seq.v[0].clips.map(function (c) { return [c.name, c.start, c.dur, +c.srcIn.toFixed(6)]; });
// H14 a plain head trim outward stops at the clip before
h = fresh(); put(h.seq, h.seq.v[0], 'P', 0, 40); var q14 = put(h.seq, h.seq.v[0], 'Q', 50, 40, 5); out.h14 = [E.trimHead(h.p, h.seq, h.seq.v[0], q14, -30, 'plain'), q14.start, q14.dur, +q14.srcIn.toFixed(6)];
// H14b a plain head trim outward on the first clip of a track stops at frame 0 of the sequence
h = fresh(); var q14b = put(h.seq, h.seq.v[0], 'Q', 10, 40, 5); out.h14b = [E.trimHead(h.p, h.seq, h.seq.v[0], q14b, -30, 'plain'), q14b.start, q14b.dur];
// H15 a reversed clip's tail lengthened: its first frame is unchanged, its last shows earlier source
h = fresh(); var r15 = S.clip({ media: 'long', start: 0, dur: 60, srcIn: 10, reverse: true }); h.seq.v[0].clips.push(r15); var first0 = S.srcTime(r15, 0, h.seq);
E.trimTail(h.p, h.seq, h.seq.v[0], r15, 30, 'plain'); out.h15 = [+(S.srcTime(r15, 0, h.seq) - first0).toFixed(9), +S.srcTime(r15, r15.dur - 1, h.seq).toFixed(6), r15.dur];
// H16 a move that inserts pushes what is at the drop point along
h = fresh(); var m1 = put(h.seq, h.seq.v[0], 'M1', 0, 30), m2 = put(h.seq, h.seq.v[0], 'M2', 30, 30), m3 = put(h.seq, h.seq.v[0], 'M3', 60, 30); E.move(h.seq, [m3.id], -45, 0, true); out.h16 = lay(h.seq.v[0]);
// H17 Lift on V1/A1 leaves V2 as it was
h = fresh(); put(h.seq, h.seq.v[0], 'V', 0, 60); put(h.seq, h.seq.a[0], 'A', 0, 60); put(h.seq, h.seq.v[1], 'T', 0, 60); E.lift(h.seq, 10, 20, [h.seq.v[0], h.seq.a[0]]); out.h17 = [lay(h.seq.v[0]), lay(h.seq.a[0]), lay(h.seq.v[1])];
// H18 Slip stops where the source ends (both ends)
h = fresh(); var s18 = put(h.seq, h.seq.v[0], 'S', 0, 60, 98); E.slip(h.p, h.seq, s18, 300); var e18 = +(s18.srcIn + S.srcSpan(s18, h.seq)).toFixed(6); E.slip(h.p, h.seq, s18, -10000); out.h18 = [e18, +s18.srcIn.toFixed(6)];
return out;""")
    check("Ripple Delete of two clips apart on a track (A and C of A B C D): B and D close up, in order, at 0 and 30", r["h1"] == [["B", 0, 30], ["D", 30, 30]], r["h1"])
    check("a ripple trim of a tail (-20) while a sync-locked track has a clip across the cut leaves no clips overlapping", not r["h2"]["bad"], r["h2"])
    check("a ripple trim of a head (+20) while a sync-locked track has a clip across the cut leaves no clips overlapping", not r["h2b"]["bad"], r["h2b"])
    check("Slide 30 frames left with a 20-frame gap before the clip: it stops at the clip before the gap (no overlap)", not r["h3"]["bad"], r["h3"])
    check("Slide 20 frames right with a 10-frame gap after the next clip... (no clip after the slid one): no overlap with the clip after the gap", not r["h4"]["bad"], r["h4"])
    check("Roll right by 1000: stops after 59 frames, where the incoming clip would vanish; its in point moves 59 frames", r["h5"] == [59, 149, 149, 1, round(1 + 59 / 30, 6)], r["h5"])
    check("Roll left by 1000: stops after 30 frames, where the incoming clip's media begins (it starts 1 s in)", r["h5b"] == [-30, 60, 60, 90, 0.0], r["h5b"])
    check("Insert into the middle of a clip at 25 fps: the right part continues from 2 + 40/25 = 3.6 s and moves after the new clip", r["h6"] == [[0, 40, 2.0], [40, 10, 0.0], [50, 60, 3.6]], r["h6"])
    check("Rate Stretch 60 -> 90 frames: speed 2/3, the same source span", r["h7"] == [90, round(2 / 3, 6), 0.0], r["h7"])
    check("Speed 50% with Ripple: the clip doubles to 120 frames and the next clip moves to 120", r["h8"] == [["S", 0, 120], ["N", 120, 30]], r["h8"])
    check("Speed 50% without Ripple: the clip stops where the next begins, and says so", r["h8b"][0] == [["S", 0, 60], ["N", 60, 30]] and r["h8b"][1], r["h8b"])
    check("Speed 70% of a clip showing all of a 1-second file: the clip does not show source past 1 s", r["h9"][1] <= 1.0 + 1e-9, r["h9"])
    check("Extract frames 10-20: V1 and A1 lose them (cut at 10), and V2 (sync-locked) moves 10 frames left", r["h10"] == [[["V", 0, 10], ["V", 10, 40]], [["A", 0, 10], ["A", 10, 40]], [["T", 20, 60]]], r["h10"])
    check("Ripple Trim Next Edit to Playhead (W) at frame 60 of a linked clip, V1 and A1 targeted: both clips end at 60 and the rest move left once, 40 frames",
          r["h11"]["v1"] == [["v0", 0, 60], ["v1", 60, 100], ["v2", 160, 100]] and r["h11"]["a1"] == [["a0", 0, 60], ["a1", 60, 100], ["a2", 160, 100]], r["h11"])
    check("Ripple Trim Previous Edit to Playhead (Q) at frame 140, V1 and A1 targeted: both clips lose 40 frames from their head and the rest move left once",
          r["h11b"]["v1"] == [["v0", 0, 100], ["v1", 100, 60], ["v2", 160, 100]] and r["h11b"]["a1"] == [["a0", 0, 100], ["a1", 100, 60], ["a2", 160, 100]], r["h11b"])
    check("Insert into the middle of a linked picture and sound: the left picture's partner is its own sound only (A1 at 0 for 45), not the right halves too", r["h11c"] == [["A1", 0, 45]], r["h11c"])
    check("Overwrite into the middle of a clip: three pieces, the last continuing at 3 + 50/30 s", r["h12"] == [["base", 0, 30, 3.0], ["new", 30, 20, 0.0], ["base", 50, 40, round(3 + 50 / 30, 6)]], r["h12"])
    check("a plain head trim outward by 30 stops at the clip before (10 frames), the in point 10 frames earlier", r["h14"] == [-10, 40, 50, round(5 - 10 / 30, 6)], r["h14"])
    check("a plain head trim outward by 30 of a clip at frame 10 (nothing before it) stops at frame 0 of the sequence", r["h14b"] == [-10, 0, 50], r["h14b"])
    check("a reversed clip's tail lengthened by 30: its first frame unchanged, its last frame 1 s earlier in the source", r["h15"][0] == 0 and abs(r["h15"][1] - 9.0) < 1e-6 and r["h15"][2] == 90, r["h15"])
    check("a move that inserts M3 at frame 15 cuts M1 there and pushes the rest along", r["h16"] == [["M1", 0, 15], ["M3", 15, 30], ["M1", 45, 15], ["M2", 60, 30]], r["h16"])
    check("Lift 10-20 on V1 and A1 leaves a gap there and V2 untouched", r["h17"] == [[["V", 0, 10], ["V", 20, 40]], [["A", 0, 10], ["A", 20, 40]], [["T", 0, 60]]], r["h17"])
    check("Slip stops where the source ends (at 100 s) and where it begins (0 s)", r["h18"] == [100.0, 0.0], r["h18"])

# ============================================================================================================
# 5. KEYFRAMES
# ============================================================================================================
if want("keys"):
    r = run(r"""var K = V.keys, S = V.seq, E = V.edit, T = V.time, out = {};
      var lin = [{ f: 0, v: 0, i: 'linear' }, { f: 10, v: 100 }], ease = [{ f: 0, v: 0, i: 'ease' }, { f: 10, v: 100 }], hold = [{ f: 0, v: 5, i: 'hold' }, { f: 10, v: 100 }];
      out.lin = [0, 2.5, 5, 7.5, 10, -5, 15].map(function (f) { return K.value(lin, f); });
      out.ease = [0, 2.5, 5, 7.5, 10].map(function (f) { return K.value(ease, f); });
      out.hold = [0, 9.99, 10].map(function (f) { return K.value(hold, f); });
      var au = [{ f: 0, v: 0, i: 'auto' }, { f: 10, v: 50, i: 'auto' }, { f: 25, v: 20, i: 'auto' }, { f: 40, v: 80, i: 'auto' }];
      out.auto = []; for (var f = 0; f <= 40; f += 0.25) out.auto.push(K.value(au, f));
      out.autoSlope = [10, 25].map(function (k) { var h = 1e-4; return [(K.value(au, k) - K.value(au, k - h)) / h, (K.value(au, k + h) - K.value(au, k)) / h]; });
      out.text = [K.value([{ f: 0, v: 'a' }, { f: 10, v: 'b' }], 9), K.value([{ f: 0, v: 'a' }, { f: 10, v: 'b' }], 10)];
      var L = []; K.set(L, 10, 1); K.set(L, 0, 0); K.set(L, 10, 2, 'hold'); out.set = JSON.parse(JSON.stringify(L)); K.remove(L, 0); out.rem = L.length;
      // Add Edit through keyframed clips: the value at every frame must not change
      function cut(keys, dur, at, trimTo) { var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1); var c = S.clip({ start: 0, dur: dur, kind: 'matte' }); c.keys = { opacity: JSON.parse(JSON.stringify(keys)) }; seq.v[0].clips.push(c);
        var before = []; for (var f = 0; f < (trimTo || dur); f++) before.push(K.value(keys, f));
        if (trimTo) E.trimTail(p, seq, seq.v[0], c, trimTo - dur, 'plain');
        var r = E.razor(seq, at), after = [], cs = seq.v[0].clips; cs.forEach(function (x) { for (var g = 0; g < x.dur; g++) after.push(K.get(x, 'opacity', g, 100)); });
        var worst = 0, wf = -1; for (var i = 0; i < before.length; i++) { var d = Math.abs(after[i] - before[i]); if (d > worst) { worst = d; wf = i; } } return [worst, wf, cs.length]; }
      out.cutLin = cut([{ f: 0, v: 0, i: 'linear' }, { f: 20, v: 100, i: 'linear' }, { f: 70, v: 40 }], 90, 45);
      out.cutEase = cut([{ f: 0, v: 0, i: 'ease' }, { f: 89, v: 100 }], 90, 30);
      out.cutAuto = cut([{ f: 0, v: 0, i: 'auto' }, { f: 30, v: 80, i: 'auto' }, { f: 89, v: 10, i: 'auto' }], 90, 50);
      out.cutPastEnd = cut([{ f: 0, v: 100, i: 'linear' }, { f: 120, v: 0 }], 120, 45, 90);
      // a head trim through keyframes: the frames that stay keep their values
      function trimH(keys, dur, d) { var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(30, 1); var c = S.clip({ start: 0, dur: dur, kind: 'matte' }); c.keys = { opacity: JSON.parse(JSON.stringify(keys)) }; seq.v[0].clips.push(c);
        E.trimHead(p, seq, seq.v[0], c, d, 'plain'); var worst = 0; for (var f = 0; f < c.dur; f++) worst = Math.max(worst, Math.abs(K.get(c, 'opacity', f, 100) - K.value(keys, f + d))); return worst; }
      out.trimLin = trimH([{ f: 0, v: 0, i: 'linear' }, { f: 60, v: 100 }], 90, 20);
      out.trimEase = trimH([{ f: 0, v: 0, i: 'ease' }, { f: 60, v: 100 }], 90, 20);
      return out;""")
    check("keyframes linear: 0 -> 100 over 10 frames is 25, 50, 75 at 2.5, 5, 7.5; the first value before, the last after", r["lin"] == [0, 25, 50, 75, 100, 0, 100], r["lin"])
    e = [100 * (3 * u * u - 2 * u ** 3) for u in (0, 0.25, 0.5, 0.75, 1)]
    check("keyframes ease: 0 -> 100 follows 3u^2 - 2u^3 (15.625 at a quarter)", max(abs(a - b) for a, b in zip(r["ease"], e)) < 1e-9, r["ease"])
    check("keyframes hold: the value stays until the next keyframe", r["hold"] == [5, 5, 100], r["hold"])
    au = r["auto"]; fs_ = np.arange(0, 40.0001, 0.25)
    through = all(abs(au[int(f * 4)] - v) < 1e-9 for f, v in [(0, 0), (10, 50), (25, 20), (40, 80)])
    slopes = r["autoSlope"]
    check("keyframes Auto Bezier passes through each keyframe", through, [au[int(f * 4)] for f in (0, 10, 25, 40)])
    check("keyframes Auto Bezier has no kink at a keyframe (the slope just before equals the slope just after, within 2%)", all(abs(a - b) <= 0.02 * max(abs(a), abs(b), 1) + 0.05 for a, b in slopes), slopes)
    check("keyframes: a setting that is not a number (text) changes at its keyframe", r["text"] == ["a", "b"], r["text"])
    check("keyframes set/remove: set keeps them in order and replaces one at the same frame", r["set"] == [{"f": 0, "v": 0, "i": "linear"}, {"f": 10, "v": 2, "i": "hold"}] and r["rem"] == 1, (r["set"], r["rem"]))
    check("Add Edit through linear keyframes: every frame of both halves keeps its value", r["cutLin"][0] < 1e-9, r["cutLin"])
    check("Add Edit through an eased keyframe (0 -> 100, Ease): every frame keeps its value (within 0.5)", r["cutEase"][0] <= 0.5, ("worst difference", r["cutEase"][0], "at frame", r["cutEase"][1]))
    check("Add Edit through Auto Bezier keyframes: every frame keeps its value (within 0.5)", r["cutAuto"][0] <= 0.5, ("worst difference", r["cutAuto"][0], "at frame", r["cutAuto"][1]))
    check("Add Edit in a clip whose fade's last keyframe lies past its trimmed end: the right half keeps fading (within 0.5)", r["cutPastEnd"][0] <= 0.5, ("worst difference", r["cutPastEnd"][0], "at frame", r["cutPastEnd"][1]))
    check("a head trim of 20 frames through linear keyframes: the frames that stay keep their values", r["trimLin"] < 1e-9, r["trimLin"])
    check("a head trim of 20 frames through an eased keyframe: the frames that stay keep their values (within 0.5)", r["trimEase"] <= 0.5, r["trimEase"])


# ============================================================================================================
# 6. THE MIXER: resampling, speed, volume, pan, mute/solo, transitions, channels
# ============================================================================================================
MIX_LIB = r"""
var S = V.seq, T = V.time, K = V.keys;
function sine(sr0, f, n, amp, ph) { var d = new Float32Array(n); for (var i = 0; i < n; i++) d[i] = amp * Math.sin(2 * Math.PI * f * i / sr0 + (ph || 0)); return d; }
function noise(n, seedv, amp) { var d = new Float32Array(n), s = seedv; for (var i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; d[i] = amp * (s / 2147483648 * 2 - 1); } return d; }
function proj(rate) { var p = S.project(), seq = p.seqs[p.active]; seq.rate = rate || T.rate(30, 1); return { p: p, seq: seq }; }
function media(p, id, sr0, chans) { V.media.rt[id] = { audio: { sampleRate: sr0, data: chans } }; p.media[id] = { id: id, kind: 'audio', dur: chans[0].length / sr0 }; }
"""
def thdn(y, fo, sr=48000, amp_ref=None):
    k = np.arange(len(y)); A = np.stack([np.sin(2 * np.pi * fo * k / sr), np.cos(2 * np.pi * fo * k / sr)], 1)
    coef, *_ = np.linalg.lstsq(A, y, rcond=None); amp = float(np.hypot(*coef)); res = y - A @ coef
    return 10 * np.log10((res ** 2).mean() / (amp ** 2 / 2)), 20 * np.log10(amp / amp_ref) if amp_ref else amp, float(np.arctan2(coef[1], coef[0]))
def rms_db(x): return 10 * np.log10((np.asarray(x, float) ** 2).mean() + 1e-30)

if want("mix"):
    cases = [(44100, 1000, 1), (44100, 5000, 1), (44100, 10000, 1), (32000, 1000, 1), (22050, 1000, 1), (96000, 1000, 1), (48000, 1000, 0.5), (48000, 5000, 2), (44100, 1000, 1.5), (96000, 30000, 1), (48000, 15000, 2)]
    run(MIX_LIB + r"""var cases = %s;
      cases.forEach(function (x) { var sr0 = x[0], f = x[1], sp = x[2], h = proj(); media(h.p, 'm', sr0, [sine(sr0, f, sr0 * 4, 0.5)]); V.mix.clear();
        var c = S.clip({ media: 'm', start: 0, dur: Math.round(60 / sp), speed: sp }); h.seq.a[0].clips.push(c);
        var o = V.mix.range(h.p, h.seq, 0, Math.round(96000 / sp)); fs.writeFileSync(OUT + '/mix_' + x.join('_') + '.f32', Buffer.from(o[0].buffer)); fs.writeFileSync(OUT + '/mixR_' + x.join('_') + '.f32', Buffer.from(o[1].buffer)); });
      return 1;""" % J(cases))
    for sr0, f, sp in cases:
        y = np.fromfile(p("mix_%d_%d_%s.f32" % (sr0, f, J(sp))), np.float32).astype(float)[4800:-4800]
        fo = f * sp
        if fo < 24000:
            t_, g_, ph = thdn(y, fo, amp_ref=0.5)
            what = "%g kHz at %g Hz%s" % (f / 1000, sr0, "" if sp == 1 else ", speed %g%%" % (sp * 100))
            check("mixer: %s into a 48 kHz sequence: the tone at its right pitch (%g Hz), level (within 0.05 dB) and time (phase within 0.001 rad)" % (what, fo), abs(g_) < 0.05 and abs(ph) < 1e-3, (g_, ph))
            bar = -70
            check("mixer: %s into a 48 kHz sequence: distortion and noise the resampling adds below %d dB (ffmpeg's own resampler: about -100)" % (what, bar), t_ <= bar, "THD+N %.1f dB" % t_)
        else:
            lvl = rms_db(y) - 10 * np.log10(0.125)
            check("mixer: a %g kHz tone that lands above 24 kHz (%g Hz source, speed %g%%) is filtered out, not folded back into hearing (at least 60 dB down)" % (f / 1000, sr0, sp * 100), lvl <= -60, "%.1f dB" % lvl)
    # level, pan, mute, solo, track volume, clip gain, master, keyframed volume
    r = run(MIX_LIB + r"""var h = proj(), out = {}, n = 48000 * 3; media(h.p, 'm', 48000, [sine(48000, 1000, n, 0.25)]); media(h.p, 'st', 48000, [sine(48000, 1000, n, 0.25), sine(48000, 1000, n, 0.25)]);
      function lev(setup) { var h2 = proj(); h2.p.media = h.p.media; var c = S.clip({ media: setup.media || 'm', start: 0, dur: 60 }); h2.seq.a[0].clips.push(c); setup.fn(c, h2.seq, h2); V.mix.clear(); var o = V.mix.range(h2.p, h2.seq, setup.from || 4800, setup.to || 43200);
        function db(x) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i] * x[i]; return 10 * Math.log10(s / x.length / (0.25 * 0.25 / 2) + 1e-30); } return [db(o[0]), db(o[1])]; }
      out.plain = lev({ fn: function () {} });
      out.vol6 = lev({ fn: function (c) { c.vol = -6; } }); out.volp6 = lev({ fn: function (c) { c.vol = 6; } });
      out.gain = lev({ fn: function (c) { c.gain = 3; c.vol = -9; } });
      out.track = lev({ fn: function (c, seq) { seq.a[0].vol = -10; } });
      out.master = lev({ fn: function (c, seq) { seq.masterVol = -3; } });
      out.left = lev({ fn: function (c) { c.pan = -100; } }); out.right = lev({ fn: function (c) { c.pan = 100; } }); out.half = lev({ fn: function (c) { c.pan = -50; } });
      out.trackPan = lev({ fn: function (c, seq) { seq.a[0].pan = 100; } });
      out.mute = lev({ fn: function (c, seq) { seq.a[0].mute = true; } });
      out.solo = lev({ fn: function (c, seq, h2) { var c2 = S.clip({ media: 'm', start: 0, dur: 60 }); seq.a[1].clips.push(c2); c2.vol = -20; seq.a[1].solo = true; } });
      out.off = lev({ fn: function (c) { c.enabled = false; } });
      out.stereo = lev({ media: 'st', fn: function () {} });
      out.chanL = lev({ media: 'st', fn: function (c) { c.chan = 'left'; } });
      out.keyed = lev({ from: 48000 - 480, to: 48000 + 480, fn: function (c) { K.put(c, 'vol', 0, 0, 'linear'); K.put(c, 'vol', 60, -20, 'linear'); } });
      return out;""")
    check("mixer: a mono clip at 0 dB plays at its own level in both ears", all(abs(x) < 0.01 for x in r["plain"]), r["plain"])
    check("mixer: Volume -6 dB and +6 dB are -6 and +6 dB (within 0.01)", abs(r["vol6"][0] + 6) < 0.01 and abs(r["volp6"][0] - 6) < 0.01, (r["vol6"], r["volp6"]))
    check("mixer: Audio Gain +3 dB with Volume -9 dB is -6 dB", abs(r["gain"][0] + 6) < 0.01, r["gain"])
    check("mixer: a track's volume -10 dB and the master -3 dB act as said", abs(r["track"][0] + 10) < 0.01 and abs(r["master"][0] + 3) < 0.01, (r["track"], r["master"]))
    check("mixer: Pan -100 is the left ear only, +100 the right only (the other ear silent)", r["left"][1] < -100 and abs(r["left"][0]) < 0.01 and r["right"][0] < -100 and abs(r["right"][1]) < 0.01, (r["left"], r["right"]))
    check("mixer: a track's Pan +100 puts its clips in the right ear", r["trackPan"][0] < -100 and abs(r["trackPan"][1]) < 0.01, r["trackPan"])
    check("mixer: a muted track, a clip switched off, and a track not soloed while another is, are silent", r["mute"][0] < -100 and r["off"][0] < -100 and abs(r["solo"][0] + 20) < 0.01, (r["mute"], r["off"], r["solo"]))
    check("mixer: a stereo clip keeps its two channels; Left channel only takes the left (a mono clip, in both ears)", all(abs(x) < 0.01 for x in r["stereo"]) and all(abs(x) < 0.01 for x in r["chanL"]), (r["stereo"], r["chanL"]))
    check("mixer: Volume keyframed 0 dB at frame 0 to -20 dB at frame 60 is -10 dB at frame 30 (keyframes in dB, within 0.1)", abs(r["keyed"][0] + 10) < 0.1, r["keyed"])
    # where a clip's sound falls in time, to the sample: a clip at 1 s showing its source from 0.5 s
    r = run(MIX_LIB + r"""var h = proj(T.rate(30, 1)), src = noise(48000 * 4, 77, 0.5); media(h.p, 'n', 48000, [src]); V.mix.clear();
      var c = S.clip({ media: 'n', start: 30, dur: 60, srcIn: 0.5 }); h.seq.a[0].clips.push(c); var o = V.mix.range(h.p, h.seq, 0, 48000 * 3)[0], worst = 0;
      for (var k = 48000 + 10; k < 48000 * 3 - 10; k++) worst = Math.max(worst, Math.abs(o[k] - src[k - 48000 + 24000]));
      var lead = 0; for (k = 0; k < 47990; k++) lead = Math.max(lead, Math.abs(o[k]));
      // reversed: the clip plays its source backwards
      var h2 = proj(T.rate(25, 1)); media(h2.p, 'n', 48000, [src]); V.mix.clear(); var r2 = S.clip({ media: 'n', start: 0, dur: 50, srcIn: 1, reverse: true }); h2.seq.a[0].clips.push(r2);
      var o2 = V.mix.range(h2.p, h2.seq, 0, 96000)[0], rv = 0; for (k = 100; k < 95900; k++) rv = Math.max(rv, Math.abs(o2[k] - src[48000 + 96000 - k]));
      return [worst, lead, rv];""")
    check("mixer: a clip at 1 s showing its source from 0.5 s plays that source sample for sample from 1 s, and nothing before", r[0] < 1e-6 and r[1] < 1e-6, r)
    check("mixer: a reversed clip plays its source backwards, sample for sample", r[2] < 1e-6, r[2])
    # transitions: constant power keeps the level of two unrelated sounds; constant gain keeps a sound joined to its own continuation
    r = run(MIX_LIB + r"""var out = {};
      function xf(type, n, same) { var h = proj(T.rate(30, 1)), a = noise(48000 * 20, 5, 0.3), b = same ? a : noise(48000 * 20, 99, 0.3); media(h.p, 'a', 48000, [a]); media(h.p, 'b', 48000, [b]); V.mix.clear();
        var A = S.clip({ media: 'a', start: 0, dur: 300, srcIn: 2 }), B = S.clip({ media: 'b', start: 300, dur: 300, srcIn: same ? 12 : 7 }); B.tin = { type: type, dur: n, align: 'center' };
        h.seq.a[0].clips.push(A, B); var o = V.mix.range(h.p, h.seq, 48000 * 3, 48000 * 17)[0], w = 2400, lv = []; for (var k = 0; k + w <= o.length; k += w) { var s = 0; for (var i = k; i < k + w; i++) s += o[i] * o[i]; lv.push(10 * Math.log10(s / w / (0.3 * 0.3 / 3))); } return lv; }
      out.cp30 = xf('constantPower', 30, false); out.cg30 = xf('constantGain', 30, true); out.cp90 = xf('constantPower', 90, false); out.cg120 = xf('constantGain', 120, true);
      return out;""")
    for key, label in (("cp30", "Constant Power, 1 s, two unrelated sounds"), ("cg30", "Constant Gain, 1 s, a sound cut and joined to its own continuation"),
                       ("cp90", "Constant Power, 3 s, two unrelated sounds"), ("cg120", "Constant Gain, 4 s, a sound joined to its own continuation")):
        lv = np.array(r[key]); dev = float(np.abs(lv).max())
        check("mixer: audio transition %s: the level through it stays within 1 dB of the sound's own (50 ms windows)" % label, dev <= 1.0, ("worst %.2f dB" % dev, "levels", [round(x, 1) for x in lv[lv.argsort()[:4]]]))
    # a 5.1 file whose dialogue is in the centre channel (as films and many cameras' surround tracks are)
    r = run(MIX_LIB + r"""var h = proj(), n = 48000 * 2, z = function () { return new Float32Array(n); }, d = sine(48000, 500, n, 0.3); media(h.p, 'six', 48000, [z(), z(), d, z(), z(), z()]); V.mix.clear();
      h.seq.a[0].clips.push(S.clip({ media: 'six', start: 0, dur: 60 })); var o = V.mix.range(h.p, h.seq, 0, n); var s = 0; for (var i = 0; i < n; i++) s += o[0][i] * o[0][i] + o[1][i] * o[1][i]; return 10 * Math.log10(s / n / 2 / (0.3 * 0.3 / 2) + 1e-30);""")
    check("mixer: a 5.1 clip with its dialogue in the centre channel is heard (folded down to stereo, ITU-R BS.775 puts the centre at -3 dB in each ear)", abs(r + 3) <= 1.5, "%.1f dB" % r)


# ============================================================================================================
# 7. LOUDNESS (ITU-R BS.1770-4, EBU R 128 / Tech 3341) against ffmpeg's ebur128 and the BS.1770 48 kHz filter
# ============================================================================================================
def bs1770_48k(x):
    """integrated loudness by BS.1770-4 with the Recommendation's own 48 kHz coefficients (x: frames x channels)"""
    from scipy.signal import lfilter
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    ch = x.shape[1]; w = [1.0] * ch
    if ch == 6: w = [1, 1, 1, 0, 1.41, 1.41]
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    n = len(y); L = 19200; H = 4800; z = []
    for st in range(0, n - L + 1, H): z.append(sum(w[c] * (y[st:st + L, c] ** 2).mean() for c in range(ch)))
    z = np.array(z); lj = -0.691 + 10 * np.log10(z + 1e-30)
    g1 = z[lj > -70]; rel = -0.691 + 10 * np.log10(g1.mean()) - 10
    g2 = z[(lj > -70) & (lj > rel)]
    return -0.691 + 10 * np.log10(g2.mean())
def ebur128(f):
    e = subprocess.run([FF, "-hide_banner", "-nostats", "-v", "verbose", "-i", f, "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]); TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])
    frames = [(round(float(t), 1), float(m), float(s_)) for t, m, s_ in re.findall(r"t:\s*([\d.]+)\s+TARGET:\S+ LUFS\s+M:\s*(-?[\d.]+)\s+S:\s*(-?[\d.]+)", e)]
    return I, TP, frames
LOUD_JS = r"""var w = V.riff.readWav(new Uint8Array(fs.readFileSync(%s))), at = %s; return { I: V.loud.integrated(w.data, w.sampleRate), TP: V.loud.truePeak(w.data), P: V.loud.peak(w.data),
  M: at.map(function (t) { return V.loud.momentary(w.data, w.sampleRate, Math.round(t * w.sampleRate)); }), S: at.map(function (t) { return V.loud.shortTerm(w.data, w.sampleRate, Math.round(t * w.sampleRate)); }) };"""
def tone_wav(name, segs, sr=48000, ch=2, f=1000.0):
    """segments of (seconds, dBFS peak) of a 1 kHz sine in every channel, as EBU Tech 3341 builds them"""
    x = []; t0 = 0
    for dur, dbfs in segs:
        n = int(round(dur * sr)); k = np.arange(t0, t0 + n); x.append(10 ** (dbfs / 20) * np.sin(2 * np.pi * f * k / sr)); t0 += n
    x = np.concatenate(x); X = np.repeat(x[:, None], ch, 1).astype(np.float32)
    from scipy.io import wavfile
    wavfile.write(p(name), sr, X)
    return X

if want("loud"):
    tests = [("tech3341_1_stereo_-23", [(20, -23)], -23.0), ("tech3341_2_stereo_-33", [(20, -33)], -33.0), ("tech3341_3_-36_-23_-36", [(10, -36), (60, -23), (10, -36)], -23.0),
             ("tech3341_4_-72_-36_-23_-36_-72", [(10, -72), (10, -36), (60, -23), (10, -36), (10, -72)], -23.0), ("tech3341_5_-26_-20_-26", [(20, -26), (20.1, -20), (20, -26)], -23.0)]
    for name, segs, want_ in tests:
        tone_wav(name + ".wav", segs)
        r = run(LOUD_JS % (J(p(name + ".wav")), J([])))
        check("loudness, EBU Tech 3341 case %s: %.2f LUFS, the test's %.1f within 0.1 LU" % (name.split("_")[1], r["I"], want_), abs(r["I"] - want_) <= 0.1, r["I"])
    # mono at 44.1 kHz; 5.1 pink noise; speech-like bursts; a short loud sound in a long quiet one
    ff("-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100:duration=10,volume=0.1", "-c:a", "pcm_f32le", p("mono441.wav"))
    ff("-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=48000:amplitude=0.25:seed=4:duration=12", "-filter_complex", "[0]asplit=6[a][b][c][d][e][f];[b]adelay=7[b2];[c]adelay=13[c2];[d]adelay=17[d2];[e]adelay=23[e2];[f]adelay=29[f2];[a][b2][c2][d2][e2][f2]join=inputs=6:channel_layout=5.1",
       "-c:a", "pcm_f32le", p("pink51.wav"))
    ff("-f", "lavfi", "-i", "anoisesrc=color=brown:sample_rate=44100:amplitude=0.6:seed=8:duration=15", "-af", "volume='0.2+0.8*gt(sin(2*PI*0.7*t)\\,0.3)':eval=frame,highpass=f=100", "-ac", "2", "-c:a", "pcm_f32le", p("bursts441.wav"))
    ff("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=30,volume='if(between(t\\,10\\,12)\\,1\\,0.003)':eval=frame", "-ac", "2", "-c:a", "pcm_f32le", p("blip.wav"))
    ff("-f", "lavfi", "-i", "anoisesrc=color=white:sample_rate=48000:amplitude=0.9:seed=2:duration=8", "-af", "lowpass=f=15000", "-ac", "2", "-c:a", "pcm_f32le", p("white_hot.wav"))
    for f in ("mono441.wav", "pink51.wav", "bursts441.wav", "blip.wav", "white_hot.wav"):
        I, TP, fr = ebur128(p(f))
        at = [t for t, m, s_ in fr if t >= 3.0 and m > -70 and s_ > -70][::17][:6]
        r = run(LOUD_JS % (J(p(f)), J(at)))
        check("loudness of %s: %.2f LUFS, ffmpeg's ebur128 %.1f (within 0.1 LU)" % (f, r["I"], I), abs(r["I"] - I) <= 0.1, (r["I"], I))
        if f in ("pink51.wav",):
            from scipy.io import wavfile
            x = wavfile.read(p(f))[1].astype(float)
            ref = bs1770_48k(x)
            check("loudness of %s: within 0.1 LU of BS.1770-4 worked here with the Recommendation's 48 kHz filter (%.2f)" % (f, ref), abs(r["I"] - ref) <= 0.1, (r["I"], ref))
        check("true peak of %s: %.2f dBTP, ffmpeg's %.1f (within 0.2 dB), never below the sample peak" % (f, r["TP"], TP), abs(r["TP"] - TP) <= 0.2 and r["TP"] >= r["P"] - 1e-6, (r["TP"], TP, r["P"]))
        fm = {round(t, 1): (m, s_) for t, m, s_ in fr}
        dm = [abs(a - fm[round(t, 1)][0]) for a, t in zip(r["M"], at)]; ds = [abs(a - fm[round(t, 1)][1]) for a, t in zip(r["S"], at)]
        check("momentary and short-term loudness of %s at %d times: within 0.2 LU of ffmpeg's M and S" % (f, len(at)), at and max(dm) <= 0.2 and max(ds) <= 0.2, (list(zip(at, r["M"], [fm[round(t, 1)][0] for t in at]))[:3], list(zip(at, r["S"], [fm[round(t, 1)][1] for t in at]))[:3]))
    # true peak where the samples miss it: a quarter-rate sine sampled 45 degrees off its crests
    from scipy.io import wavfile
    k = np.arange(48000 * 2); x = (0.5 * np.sin(2 * np.pi * 12000 * k / 48000 + np.pi / 4)).astype(np.float32)
    wavfile.write(p("tp_quarter.wav"), 48000, np.stack([x, x], 1))
    y = np.zeros(48000, np.float32); y[24000] = 0.9; wavfile.write(p("tp_click.wav"), 48000, np.stack([y, y], 1))
    k = np.arange(44100 * 2); z = (0.891 * np.sin(2 * np.pi * 997 * k / 44100)).astype(np.float32); wavfile.write(p("tp_997.wav"), 44100, np.stack([z, z], 1))
    for f, want_ in (("tp_quarter.wav", 20 * np.log10(0.5)), ("tp_click.wav", 20 * np.log10(0.9)), ("tp_997.wav", 20 * np.log10(0.891))):
        r = run(LOUD_JS % (J(p(f)), J([])))
        check("true peak of %s: %.2f dBTP, the signal's own %.2f (BS.1770 tolerance +0.2/-0.4 dB)" % (f, r["TP"], want_), -0.4 <= r["TP"] - want_ <= 0.2, (r["TP"], want_, "sample peak", r["P"]))
    r = run(r"""var z = [new Float32Array(48000 * 3), new Float32Array(48000 * 3)]; var q = [new Float32Array(10000), new Float32Array(10000)]; for (var i = 0; i < 10000; i++) q[0][i] = q[1][i] = 0.5 * Math.sin(i / 7);
      return [V.loud.integrated(z, 48000), V.loud.integrated(q, 48000)];""")
    check("loudness of silence and of a sound shorter than one 400 ms block: no number (minus infinity), not a made-up one", r[0] is None or r[0] < -1e300 or r[0] == "-Infinity", r)


# ============================================================================================================
# 8. COLOUR AND EFFECTS against ffmpeg (lut3d, lut1d), SciPy (filters) and the formulas
# ============================================================================================================
IMG_JS = r"""var IW = %d, IH = %d; function load(n) { return { width: IW, height: IH, data: new Uint8ClampedArray(fs.readFileSync(OUT + '/' + (n || 'img.rgba'))) }; }
function save(n, im) { fs.writeFileSync(OUT + '/' + n, Buffer.from(im.data.buffer, im.data.byteOffset, im.data.length)); }
function fx(type, set, n, ctx) { var e = V.fx.make(type); for (var k in set) e.p[k] = set[k]; var im = load(n); V.fx.run(im, e, 0, ctx || { scale: 1 }); return im; }
"""
def write_cube(path, size, fn, header=(), nl="\n", fmt="%.6f %.6f %.6f", dim=3, extra_lines=()):
    lines = list(header) + ["LUT_%dD_SIZE %d" % (dim, size)] + list(extra_lines)
    g = np.linspace(0, 1, size)
    if dim == 3:
        for b in g:
            for gg in g:
                for r_ in g: lines.append(fmt % tuple(fn(r_, gg, b)))
    else:
        for v in g: lines.append(fmt % tuple(fn(v, v, v)))
    open(path, "w", newline="").write(nl.join(lines) + nl)
def trilinear(img, size, fn, lo=(0, 0, 0), hi=(1, 1, 1)):
    """a .cube applied as the Cube LUT Specification describes: input scaled from the domain, clamped, trilinear"""
    g = np.linspace(0, 1, size); T = np.zeros((size, size, size, 3))
    for bi, b in enumerate(g):
        for gi, gg in enumerate(g):
            for ri, r_ in enumerate(g): T[bi, gi, ri] = fn(r_, gg, b)
    x = img[..., :3] / 255.0
    u = np.clip((x - np.array(lo)) / (np.array(hi) - np.array(lo)), 0, 1) * (size - 1)
    i0 = np.minimum(np.floor(u).astype(int), size - 2); f = u - i0
    out = np.zeros(x.shape)
    for db in (0, 1):
        for dg in (0, 1):
            for dr in (0, 1):
                w = (f[..., 0] if dr else 1 - f[..., 0]) * (f[..., 1] if dg else 1 - f[..., 1]) * (f[..., 2] if db else 1 - f[..., 2])
                out += w[..., None] * T[i0[..., 2] + db, i0[..., 1] + dg, i0[..., 0] + dr]
    return out * 255

if want("color"):
    from PIL import Image
    from scipy import ndimage
    H_, W_ = 96, 128
    rng = np.random.default_rng(7); yy, xx = np.mgrid[0:H_, 0:W_]
    base = np.dstack([128 + 110 * np.sin(xx / 11.0) * np.cos(yy / 17.0), 128 + 100 * np.cos(yy / 9.0 + xx / 23.0), (xx * 2 + yy * 3) % 256]) + rng.normal(0, 12, (H_, W_, 3))
    base[10:30, 10:40] = [250, 250, 250]; base[60:80, 90:120] = [8, 8, 8]; base[40:56, 50:70] = [200, 30, 30]; base[70:90, 10:30] = [30, 60, 200]; base[5:20, 90:120] = [140, 200, 90]
    img = np.clip(base, 0, 255).astype(np.uint8)
    rgba = np.dstack([img, np.full((H_, W_), 255, np.uint8)]); open(p("img.rgba"), "wb").write(rgba.tobytes()); Image.fromarray(img).save(p("img.png"))
    X = img.astype(float)
    def got(n): return np.frombuffer(open(p(n), "rb").read(), np.uint8).reshape(H_, W_, 4).astype(float)
    def luma(a): return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    look = lambda r_, g_, b_: (min(1, r_ ** 0.85 * 0.95 + 0.04), min(1, g_ * 0.9 + 0.05 * b_), min(1, max(0, b_ * 0.8 + 0.1 * r_ - 0.02)))
    write_cube(p("look33.cube"), 33, look, header=["TITLE \"Warm look\"", "# made for the review"])
    write_cube(p("look33_resolve.cube"), 33, look, header=["# Resolve-style header", "TITLE \"Warm look\""], extra_lines=["LUT_3D_INPUT_RANGE 0.0 1.0", ""], nl="\r\n", fmt="%.10f\t%.10f\t%.10f")
    write_cube(p("look17_sci.cube"), 17, look, header=["  TITLE \"sci\"  "], fmt="  %.6e %.6e %.6e  ")
    write_cube(p("dom.cube"), 17, look, header=["DOMAIN_MIN 0.1 0.05 0.0", "DOMAIN_MAX 0.9 0.95 0.8"])
    write_cube(p("range_resolve.cube"), 17, look, extra_lines=["LUT_3D_INPUT_RANGE -0.25 1.25"])
    write_cube(p("gamma1d.cube"), 1024, lambda r_, g_, b_: (r_ ** 0.6, g_ ** 0.8, b_ ** 1.3), dim=1)
    write_cube(p("ident2.cube"), 2, lambda r_, g_, b_: (r_, g_, b_))
    open(p("short.cube"), "w").write("LUT_3D_SIZE 17\n0 0 0\n1 1 1\n")
    r = run(IMG_JS % (W_, H_) + r"""var C = V.color, out = {};
      ['look33.cube', 'look33_resolve.cube', 'look17_sci.cube', 'dom.cube', 'range_resolve.cube', 'gamma1d.cube', 'ident2.cube'].forEach(function (n) { try { var lut = C.parseCube(fs.readFileSync(OUT + '/' + n, 'utf8')), im = load(); C.applyCube(im, lut, 1); save('lut_' + n + '.rgba', im); out[n] = { size: lut.size, dim: lut.dim, title: lut.title }; } catch (e) { out[n] = { error: String(e.message) }; save('lut_' + n + '.rgba', { data: new Uint8ClampedArray(IW * IH * 4) }); } });
      try { C.parseCube(fs.readFileSync(OUT + '/short.cube', 'utf8')); out.short = 'accepted'; } catch (e) { out.short = String(e.message); }
      var e = V.fx.make('lumetri'); V.luts.L1 = C.parseCube(fs.readFileSync(OUT + '/look33.cube', 'utf8')); e.p.look = { id: 'L1' }; e.p.lookMix = 50; var im = load(); V.fx.run(im, e, 0, { scale: 1 }); save('lookmix.rgba', im);
      return out;""")
    ff("-i", p("img.png"), "-vf", "lut3d=file=%s:interp=trilinear" % p("look33.cube"), "-pix_fmt", "rgb24", p("ff_look33.png"))
    ref33 = np.array(Image.open(p("ff_look33.png")).convert("RGB")).astype(float)
    d = np.abs(got("lut_look33.cube.rgba")[..., :3] - ref33).max()
    check(".cube 33-point 3D LUT: within 1 level of ffmpeg's lut3d (trilinear)", d <= 1, d)
    d2 = np.abs(got("lut_look33_resolve.cube.rgba")[..., :3] - got("lut_look33.cube.rgba")[..., :3]).max()
    check(".cube written as DaVinci Resolve writes it (CRLF lines, tabs, comments, LUT_3D_INPUT_RANGE 0 1): the same picture as the plain file", d2 <= 0.5 and r["look33_resolve.cube"].get("title") == "Warm look", (d2, r["look33_resolve.cube"]))
    d3 = np.abs(got("lut_look17_sci.cube.rgba")[..., :3] - trilinear(X, 17, look)).max()
    check(".cube with numbers in exponent form and spaces around them: within 1 level of the specification's trilinear lookup", d3 <= 1, (d3, r["look17_sci.cube"]))
    d4 = np.abs(got("lut_dom.cube.rgba")[..., :3] - trilinear(X, 17, look, (0.1, 0.05, 0.0), (0.9, 0.95, 0.8))).max()
    check(".cube with DOMAIN_MIN 0.1 0.05 0 and DOMAIN_MAX 0.9 0.95 0.8: within 1 level of the specification's lookup over that domain", d4 <= 1, d4)
    d5 = np.abs(got("lut_range_resolve.cube.rgba")[..., :3] - trilinear(X, 17, look, (-0.25,) * 3, (1.25,) * 3)).max()
    check(".cube with Resolve's LUT_3D_INPUT_RANGE -0.25 1.25 (its form of the domain): within 1 level of the lookup over that range", d5 <= 1, (d5, r["range_resolve.cube"]))
    ff("-i", p("img.png"), "-vf", "lut1d=file=%s:interp=linear" % p("gamma1d.cube"), "-pix_fmt", "rgb24", p("ff_1d.png"))
    d6 = np.abs(got("lut_gamma1d.cube.rgba")[..., :3] - np.array(Image.open(p("ff_1d.png")).convert("RGB")).astype(float)).max()
    check(".cube 1D LUT of 1024 steps (a different gamma per channel): within 1 level of ffmpeg's lut1d", d6 <= 1, d6)
    check(".cube identity of 2 steps leaves the picture as it was", np.abs(got("lut_ident2.cube.rgba")[..., :3] - X).max() <= 0.5)
    check(".cube that says 17 steps and has 2: refused with a reason, not applied", "not complete" in r["short"], r["short"])
    dm = np.abs(got("lookmix.rgba")[..., :3] - (X + (got("lut_look33.cube.rgba")[..., :3] - X) * 0.5)).max()
    check("Lumetri Look at Intensity 50: halfway between the picture and the LUT's result (within 1)", dm <= 1.01, dm)

    # curves: monotone between points, through every point, never overshooting
    pts_sets = []
    rr = np.random.default_rng(3)
    for k in range(150):
        n = rr.integers(2, 7); xs = np.sort(rr.choice(np.arange(1, 255), n - 2, replace=False)).tolist() if n > 2 else []
        xs = [0] + xs + [255]; ys = np.sort(rr.integers(0, 256, len(xs))).tolist()
        if k % 3 == 0: ys = rr.integers(0, 256, len(xs)).tolist()   # up and down
        pts_sets.append([[int(a), int(b)] for a, b in zip(xs, ys)])
    r = run(r"""return %s.map(function (pts) { return Array.from(V.color.curveLut(pts)); });""" % J(pts_sets))
    mono_bad = over_bad = through_bad = 0
    for pts, lut in zip(pts_sets, r):
        lut = np.array(lut)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            seg = lut[x0:x1 + 1]
            if seg.min() < min(y0, y1) - 0.5 or seg.max() > max(y0, y1) + 0.5: over_bad += 1
            if y1 >= y0 and np.any(np.diff(seg) < 0): mono_bad += 1
            if y1 <= y0 and np.any(np.diff(seg) > 0): mono_bad += 1
        if any(abs(lut[x] - y) > 0.5 for x, y in pts): through_bad += 1
    check("curves (150 random sets of points): each one passes through its points", through_bad == 0, through_bad)
    check("curves: between two points the curve only rises or only falls, as they do (monotone cubic)", mono_bad == 0, mono_bad)
    check("curves: never above or below its two neighbouring points (no overshoot)", over_bad == 0, over_bad)

    # Lumetri: nothing at its defaults; each control in its documented direction
    r = run(IMG_JS % (W_, H_) + r"""function lu(set) { var e = V.fx.make('lumetri'); for (var k in set) e.p[k] = set[k]; var im = load(); V.fx.run(im, e, 0, { scale: 1 }); return im; }
      var list = { def: {}, temp: { temp: 50 }, tint: { tint: 50 }, expm: { exposure: -1 }, con: { contrast: 50 }, hi: { highlights: 60 }, sh: { shadows: 60 }, wh: { whites: 60 }, bl: { blacks: -60 }, sat: { saturation: 150 }, sat0: { saturation: 0 },
        vib: { vibrance: 60 }, fade: { faded: 60 }, vig: { vigAmount: -3 }, sharp: { sharpen: 60 }, liftY: { liftY: 50 }, gainY: { gainY: -50 }, hsl: { hslOn: true, hslHue: 0, hslHueWidth: 40, hslSat: 0, hslSatMin: 30, hslLumMin: 5 } };
      for (var k in list) save('lu_' + k + '.rgba', lu(list[k])); return 1;""")
    L0 = got("lu_def.rgba")[..., :3]
    check("Lumetri at its defaults leaves the picture exactly as it was", np.abs(L0 - X).max() == 0, np.abs(L0 - X).max())
    T_ = got("lu_temp.rgba")[..., :3]
    check("Lumetri Temperature +50: warmer (more red, less blue), brightness kept within 3%", T_[..., 0].mean() > X[..., 0].mean() + 3 and T_[..., 2].mean() < X[..., 2].mean() - 3 and abs(luma(T_).mean() / luma(X).mean() - 1) < 0.03, (T_[..., :3].mean((0, 1)), X.mean((0, 1))))
    T_ = got("lu_tint.rgba")[..., :3]
    gr = lambda a: a[..., 1].mean() / (0.5 * (a[..., 0].mean() + a[..., 2].mean()))
    check("Lumetri Tint +50: towards magenta (green falls against red and blue)", gr(T_) < gr(X) - 0.03, (gr(T_), gr(X)))
    T_ = got("lu_expm.rgba")[..., :3]; lin = np.where(X / 255 <= 0.04045, X / 255 / 12.92, ((X / 255 + 0.055) / 1.055) ** 2.4) * 0.5
    ex = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055) * 255
    check("Lumetri Exposure -1: half the light (through the sRGB curve), within 1 level", np.abs(T_ - ex).max() <= 1.01, np.abs(T_ - ex).max())
    T_ = got("lu_con.rgba")[..., :3]; Y0 = luma(X); Y1 = luma(T_)
    check("Lumetri Contrast +50: brighter above mid-grey, darker below, the spread wider", Y1[Y0 > 170].mean() > Y0[Y0 > 170].mean() and Y1[Y0 < 85].mean() < Y0[Y0 < 85].mean() and Y1.std() > Y0.std(), (Y1.std(), Y0.std()))
    T_ = got("lu_hi.rgba")[..., :3]; Y1 = luma(T_)
    check("Lumetri Highlights +60: bright parts brighter, dark parts unchanged (within 1)", (Y1 - Y0)[Y0 > 200].mean() > 2 and np.abs(Y1 - Y0)[Y0 < 60].max() <= 1, ((Y1 - Y0)[Y0 > 200].mean(), np.abs(Y1 - Y0)[Y0 < 60].max()))
    T_ = got("lu_sh.rgba")[..., :3]; Y1 = luma(T_)
    check("Lumetri Shadows +60: dark parts brighter, bright parts unchanged (within 1)", (Y1 - Y0)[(Y0 > 10) & (Y0 < 60)].mean() > 2 and np.abs(Y1 - Y0)[Y0 > 200].max() <= 1, ((Y1 - Y0)[(Y0 > 10) & (Y0 < 60)].mean(), np.abs(Y1 - Y0)[Y0 > 200].max()))
    T_ = got("lu_wh.rgba")[..., :3]; T2 = got("lu_bl.rgba")[..., :3]
    check("Lumetri Whites +60 brightens the top; Blacks -60 darkens the bottom", (luma(T_) - Y0)[Y0 > 180].mean() > 2 and (luma(T2) - Y0)[(Y0 < 70) & (Y0 > 15)].mean() < -2, ((luma(T_) - Y0)[Y0 > 180].mean(), (luma(T2) - Y0)[(Y0 < 70) & (Y0 > 15)].mean()))
    T_ = got("lu_sat.rgba")[..., :3]
    ch0 = X.max(2) - X.min(2); ch1 = T_.max(2) - T_.min(2); ok_ = (ch0 > 10) & (ch0 < 120) & (T_.max(2) < 255) & (T_.min(2) > 0)
    check("Lumetri Saturation 150: colours stronger, brightness (Rec. 709) kept within 1 where nothing clips", ch1[ok_].mean() > ch0[ok_].mean() * 1.3 and np.abs(luma(T_) - Y0)[ok_].max() <= 1.01, (ch1[ok_].mean() / ch0[ok_].mean(), np.abs(luma(T_) - Y0)[ok_].max()))
    T_ = got("lu_vib.rgba")[..., :3]; ch1 = T_.max(2) - T_.min(2); dull = (ch0 > 5) & (ch0 < 40) & (T_.max(2) < 250); vivid = (ch0 > 150) & (T_.max(2) < 250)
    check("Vibrance +60 raises dull colours more than strong ones", (ch1[dull] / ch0[dull]).mean() > (ch1[vivid] / ch0[vivid]).mean() + 0.05, ((ch1[dull] / ch0[dull]).mean(), (ch1[vivid] / ch0[vivid]).mean()))
    T_ = got("lu_fade.rgba")[..., :3]
    check("Faded Film 60: black is lifted and white lowered", T_[60:80, 90:120].mean() > 8 + 5 and T_[10:30, 10:40].mean() < 250 - 5, (T_[60:80, 90:120].mean(), T_[10:30, 10:40].mean()))
    T_ = got("lu_vig.rgba")[..., :3]
    check("Vignette -3: the corners darker, the centre as it was", luma(T_)[:8, :8].mean() < Y0[:8, :8].mean() - 5 and np.abs(luma(T_) - Y0)[44:52, 60:68].max() <= 1, (luma(T_)[:8, :8].mean(), Y0[:8, :8].mean()))
    T_ = got("lu_sharp.rgba")[..., :3]
    lap = lambda a: np.abs(ndimage.laplace(luma(a))).mean()
    check("Lumetri Sharpen 60: more fine detail (a larger Laplacian)", lap(T_) > lap(X) * 1.2, (lap(T_), lap(X)))
    T_ = got("lu_liftY.rgba")[..., :3]; T2 = got("lu_gainY.rgba")[..., :3]
    check("Colour wheels: Shadows brightness +50 lifts black; Highlights brightness -50 lowers white", T_[60:80, 90:120].mean() > 8 + 5 and T2[10:30, 10:40].mean() < 250 - 10, (T_[60:80, 90:120].mean(), T2[10:30, 10:40].mean()))
    T_ = got("lu_hsl.rgba")[..., :3]
    check("HSL Secondary keyed on red, Saturation 0: the red patch goes grey, the blue patch is untouched", (T_[42:54, 52:68].max(2) - T_[42:54, 52:68].min(2)).mean() < 40 and np.abs(T_[72:88, 12:28] - X[72:88, 12:28]).max() <= 1,
          ((T_[42:54, 52:68].max(2) - T_[42:54, 52:68].min(2)).mean(), np.abs(T_[72:88, 12:28] - X[72:88, 12:28]).max()))

    # filters against SciPy
    r = run(IMG_JS % (W_, H_) + r"""var G = V.filt;
      [0.7, 1.3, 3.3, 9.5, 12].forEach(function (s) { var im = load(); G.gaussian(im, s); save('g' + s + '.rgba', im); }); [15, 30].forEach(function (s) { var im = load(); G.gaussian(im, s); save('g' + s + '.rgba', im); });
      [1, 3, 7].forEach(function (rr) { var im = load(); G.box(im, rr); save('box' + rr + '.rgba', im); });
      [1, 2, 3].forEach(function (rr) { var im = load(); G.median(im, rr); save('med' + rr + '.rgba', im); });
      var im = load(); G.unsharp(im, { amount: 100, radius: 2, threshold: 0 }); save('usm.rgba', im); im = load(); G.unsharp(im, { amount: 150, radius: 1.5, threshold: 12 }); save('usm_t.rgba', im);
      im = load(); G.sobel(im); save('sobel.rgba', im); im = load(); G.emboss(im, 45, 1.5); save('emboss.rgba', im); im = load(); G.emboss(im, -120, 2); save('emboss2.rgba', im);
      return 1;""")
    for s_ in (0.7, 1.3, 3.3, 9.5, 12):
        rad = math.ceil(3 * s_)
        ref = np.dstack([ndimage.gaussian_filter(X[..., c], s_, mode="nearest", truncate=rad / s_) for c in range(3)])
        d = np.abs(got("g%s.rgba" % s_)[..., :3] - ref).max()
        check("Gaussian blur sigma %s against SciPy's (edges repeated, the same 3-sigma reach): within 1 level" % s_, d <= 1.01, d)
    # the big blurs on a 640 x 400 picture (as a 1080p frame in the preview), compared well inside its edges
    BW_, BH_ = 640, 400; yb_, xb_ = np.mgrid[0:BH_, 0:BW_]
    big = np.clip(np.dstack([128 + 120 * np.sin(xb_ / 23.0) * np.cos(yb_ / 31.0), 128 + 110 * np.cos(yb_ / 17.0 + xb_ / 41.0), (xb_ + yb_) % 256]) + np.random.default_rng(1).normal(0, 20, (BH_, BW_, 3)), 0, 255).astype(np.uint8)
    open(p("big.rgba"), "wb").write(np.dstack([big, np.full((BH_, BW_), 255, np.uint8)]).tobytes())
    run(r"""[15, 30, 60].forEach(function (s) { var im = { width: 640, height: 400, data: new Uint8ClampedArray(fs.readFileSync(OUT + '/big.rgba')) }; V.filt.gaussian(im, s); fs.writeFileSync(OUT + '/bg' + s + '.rgba', Buffer.from(im.data.buffer)); }); return 1;""")
    for s_ in (15, 30, 60):
        ref = np.dstack([ndimage.gaussian_filter(big[..., c].astype(float), s_, mode="nearest", truncate=4.0) for c in range(3)])
        gb = np.frombuffer(open(p("bg%d.rgba" % s_), "rb").read(), np.uint8).reshape(BH_, BW_, 4)[..., :3].astype(float)
        m = min(3 * s_, 150)
        d = np.abs(gb[m:-m, m:-m] - ref[m:-m, m:-m]).max()
        check("Gaussian blur sigma %d (three box blurs past sigma 12, Kovesi) against SciPy's true Gaussian on a 640x400 picture: within 5 levels away from the edges (\"a few levels\", as the module says)" % s_, d <= 5, d)
    for rr_ in (1, 3, 7):
        ref = np.dstack([ndimage.uniform_filter(X[..., c], 2 * rr_ + 1, mode="nearest") for c in range(3)])
        d = np.abs(got("box%d.rgba" % rr_)[..., :3] - ref).max()
        check("box blur radius %d against SciPy's uniform filter: within 1 level" % rr_, d <= 1.01, d)
    for rr_ in (1, 2, 3):
        ref = np.dstack([ndimage.median_filter(img[..., c], size=2 * rr_ + 1, mode="nearest") for c in range(3)])
        d = np.abs(got("med%d.rgba" % rr_)[..., :3] - ref).max()
        check("Median radius %d against SciPy's median filter: identical" % rr_, d == 0, d)
    bl = np.dstack([ndimage.gaussian_filter(X[..., c], 2, mode="nearest", truncate=3.0) for c in range(3)])
    ref = np.clip(X + (X - bl) * 1.0, 0, 255)
    d = np.abs(got("usm.rgba")[..., :3] - ref).max()
    check("Unsharp Mask 100%%, radius 2: the picture plus its difference from the blur, within 1.5 levels (%.2f)" % d, d <= 1.5, d)
    bl = np.dstack([ndimage.gaussian_filter(X[..., c], 1.5, mode="nearest", truncate=math.ceil(4.5) / 1.5) for c in range(3)])
    diff = X - np.round(bl); ref = np.where(np.abs(diff) >= 12, np.clip(X + diff * 1.5, 0, 255), X)
    d = np.abs(got("usm_t.rgba")[..., :3] - ref)
    check("Unsharp Mask threshold 12: differences under 12 untouched, the rest sharpened (within 1 level)", d.max() <= 1.01, d.max())
    sx = np.dstack([ndimage.sobel(X[..., c], axis=1, mode="nearest") for c in range(3)]); sy = np.dstack([ndimage.sobel(X[..., c], axis=0, mode="nearest") for c in range(3)])
    ref = np.minimum(255, np.hypot(sx, sy) / 4)
    d = np.abs(got("sobel.rgba")[..., :3] - ref).max()
    check("Sobel edges against SciPy's sobel: within 1 level", d <= 1.01, d)
    for nm, ang, rel in (("emboss", 45, 1.5), ("emboss2", -120, 2)):
        a = ang * np.pi / 180; cx, cy = np.cos(a), np.sin(a)
        kk = np.array([-cx - cy, -cy, cx - cy, -cx, 0, cx, -cx + cy, cy, cx + cy]).reshape(3, 3) * rel
        ref = np.clip(np.dstack([ndimage.correlate(X[..., c], kk, mode="nearest") for c in range(3)]) + 128, 0, 255)
        d = np.abs(got(nm + ".rgba")[..., :3] - ref).max()
        check("Emboss %d degrees, relief %g: its 3x3 kernel through SciPy plus mid-grey, within 1 level" % (ang, rel), d <= 1.01, d)

    # the simple picture effects against their formulas
    r = run(IMG_JS % (W_, H_) + r"""save('inv.rgba', fx('invert', {})); save('inv50.rgba', fx('invert', { blend: 50 })); save('thr.rgba', fx('threshold', { level: 100 })); save('gam.rgba', fx('gamma', { g: 16 }));
      var vl = V.fx.list().filter(function (d) { return d.name === 'Video Limiter' && !d.audio; })[0], limOk = !!vl; if (vl) { var e = V.fx.make(vl.type), im = load(); V.fx.run(im, e, 0, { scale: 1 }); save('lim.rgba', im); }
      save('mix.rgba', fx('channelMixer', { rr: 50, rg: 30, rb: 20, gg: 80, gb: -10, br: 10, bb: 120 })); save('sol.rgba', fx('solarize', { t: 150 }));
      save('pa.rgba', fx('procAmp', { h: 90 })); save('eq.rgba', fx('equalize', { amount: 100 })); save('bc.rgba', fx('brightContrast', { b: 20, c: 40 })); save('tint.rgba', fx('tint', { black: [20, 0, 60], white: [255, 230, 200], amount: 100 }));
      save('crop.rgba', fx('crop', { l: 10, t: 0, r: 25, b: 5 })); save('hflip.rgba', fx('hflip', {})); save('vflip.rgba', fx('vflip', {}));
      return { limOk: limOk, limiterIs: V.fx.defs.limiter ? V.fx.defs.limiter.name : null };""")
    check("Invert: 255 - x; at Blend With Original 50 the picture is mid-grey", np.abs(got("inv.rgba")[..., :3] - (255 - X)).max() <= 1 and np.abs(got("inv50.rgba")[..., :3] - 127.5).max() <= 1)
    check("Threshold 100: white where Rec. 709 brightness >= 100, else black", (got("thr.rgba")[..., 0] == np.where(luma(X) >= 100, 255, 0)).mean() > 0.999)
    check("Gamma Correction 16: 255 (x/255)^1.6", np.abs(got("gam.rgba")[..., :3] - np.round(255 * (X / 255) ** 1.6)).max() <= 1)
    check("Video Limiter is in the Effects panel as a picture effect (its type 'limiter' is not taken by the Hard Limiter sound effect)", r["limOk"], ("the effect called 'limiter' is", r["limiterIs"]))
    if r["limOk"]: check("Video Limiter: every level between 16 and 235", got("lim.rgba")[..., :3].min() >= 16 and got("lim.rgba")[..., :3].max() <= 235 and np.abs(got("lim.rgba")[..., :3] - np.clip(X, 16, 235)).max() == 0)
    M_ = np.array([[50, 30, 20], [0, 80, -10], [10, 0, 120]]) / 100.0
    check("Channel Mixer: each output channel the sum of the inputs by its percentages", np.abs(got("mix.rgba")[..., :3] - np.clip(X @ M_.T, 0, 255)).max() <= 1, np.abs(got("mix.rgba")[..., :3] - np.clip(X @ M_.T, 0, 255)).max())
    check("Solarize 150: levels above 150 turned over (255 - x)", np.abs(got("sol.rgba")[..., :3] - np.where(X > 150, 255 - X, X)).max() <= 0.5)
    PA = got("pa.rgba")[..., :3]; ok_ = (PA.max(2) < 255) & (PA.min(2) > 0)
    check("ProcAmp Hue 90: the brightness (Rec. 709) of each pixel kept within 1 where nothing clips, the colour turned", np.abs(luma(PA) - luma(X))[ok_].max() <= 1.01 and np.abs(PA - X)[ok_].mean() > 10, np.abs(luma(PA) - luma(X))[ok_].max())
    EQ = luma(got("eq.rgba")[..., :3]); cdf = np.sort(EQ.ravel()); ideal = np.linspace(0, 255, len(cdf))
    check("Equalize 100%: the brightness histogram spread out evenly (sorted levels within 20 of a straight ramp)", np.abs(cdf - ideal).max() <= 20 + 0 * cdf[0], np.abs(cdf - ideal).max())
    BC = got("bc.rgba")[..., :3]
    check("Brightness & Contrast (+20, +40): 127.5 + (x + 20 * 1.275 - 127.5) * 1.4", np.abs(BC - np.clip(np.round(127.5 + (X + 25.5 - 127.5) * 1.4), 0, 255)).max() <= 1)
    TN = got("tint.rgba")[..., :3]; yv = luma(X)[..., None] / 255; refT = np.array([20, 0, 60]) + (np.array([255, 230, 200]) - np.array([20, 0, 60])) * yv
    check("Tint: black mapped to one colour, white to another, by brightness", np.abs(TN - refT).max() <= 1, np.abs(TN - refT).max())
    CR = got("crop.rgba")[..., 3]
    check("Crop left 10%, right 25%, bottom 5%: transparent there, the rest untouched", CR[:, :12].max() == 0 and CR[:, 97:].max() == 0 and CR[92:, :].max() == 0 and CR[:91, 13:96].min() == 255 and np.abs(got("crop.rgba")[..., :3] - X).max() == 0,
          (CR[:, :12].max(), CR[:, 97:].max(), CR[92:, :].max(), CR[:91, 13:96].min()))
    check("Horizontal and Vertical Flip mirror the picture exactly", np.abs(got("hflip.rgba")[..., :3] - X[:, ::-1]).max() == 0 and np.abs(got("vflip.rgba")[..., :3] - X[::-1]).max() == 0)

    # Corner Pin: the homography from four points, against a direct linear solve here, and the bent picture against a warp done here
    quads = [[[10, 12], [120, 5], [126, 90], [3, 80]], [[30, 20], [100, 25], [110, 70], [20, 85]], [[0, 0], [128, 10], [128, 86], [0, 96]], [[64, 0], [128, 48], [64, 96], [0, 48]], [[5, 5], [60, 40], [123, 91], [7, 90]]]
    r = run(IMG_JS % (W_, H_) + r"""var Q = %s, out = { H: [] }; Q.forEach(function (q, i) { out.H.push(V.space.homography(q, [[0, 0], [IW, 0], [IW, IH], [0, IH]]));
        var e = V.fx.make('cornerPin'); e.p.ul = q[0]; e.p.ur = q[1]; e.p.lr = q[2]; e.p.ll = q[3]; var im = load(); V.fx.run(im, e, 0, { scale: 1 }); save('cp' + i + '.rgba', im); }); return out;""" % J(quads))
    def dlt(a, b):
        A = []; B = []
        for (x, y), (u, v) in zip(a, b): A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u); A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
        h = np.linalg.solve(np.array(A, float), np.array(B, float)); return np.append(h, 1).reshape(3, 3)
    def bilinear(img_, x, y):
        h_, w_ = img_.shape[:2]; out = np.zeros(x.shape + (img_.shape[2],)); inside = ~((x < -0.5) | (y < -0.5) | (x > w_ - 0.5) | (y > h_ - 0.5))
        xc = np.clip(x, 0, w_ - 1); yc = np.clip(y, 0, h_ - 1); x0 = np.floor(xc).astype(int); y0 = np.floor(yc).astype(int); x1 = np.minimum(w_ - 1, x0 + 1); y1 = np.minimum(h_ - 1, y0 + 1); fx_ = (xc - x0)[..., None]; fy_ = (yc - y0)[..., None]
        v = (img_[y0, x0] * (1 - fx_) + img_[y0, x1] * fx_) * (1 - fy_) + (img_[y1, x0] * (1 - fx_) + img_[y1, x1] * fx_) * fy_
        out[inside] = v[inside]; return out
    for i, q in enumerate(quads):
        Href = dlt(q, [[0, 0], [W_, 0], [W_, H_], [0, H_]]); Hl = np.array(r["H"][i]).reshape(3, 3)
        okH = np.abs(Hl / Hl[2, 2] - Href / Href[2, 2]).max() < 1e-6
        cx_, cy_ = np.meshgrid(np.arange(W_) + 0.5, np.arange(H_) + 0.5); z = Href[2, 0] * cx_ + Href[2, 1] * cy_ + Href[2, 2]
        sx_ = (Href[0, 0] * cx_ + Href[0, 1] * cy_ + Href[0, 2]) / z - 0.5; sy_ = (Href[1, 0] * cx_ + Href[1, 1] * cy_ + Href[1, 2]) / z - 0.5
        sx_ = np.where(z <= 0, -9, sx_); sy_ = np.where(z <= 0, -9, sy_)     # beyond the plane's horizon nothing is shown
        ref = bilinear(rgba.astype(float), sx_, sy_)
        # pixels whose source point falls on the picture's very edge (within 1e-6) go either way by rounding: not counted
        edge = (np.abs(sx_ + 0.5) < 1e-6) | (np.abs(sx_ + 0.5 - W_) < 1e-6) | (np.abs(sy_ + 0.5) < 1e-6) | (np.abs(sy_ + 0.5 - H_) < 1e-6)
        d = np.abs(got("cp%d.rgba" % i) - ref)[~edge].max()
        check("Corner Pin %d: the homography as a direct linear solve gives it, and the bent picture within 1 level of a warp done here" % (i + 1), okH and d <= 1.01, (okH, d))

    # Ultra Key on a green screen and a blue screen: what goes, what stays, the spill
    def screen(bg, seed_):
        rng2 = np.random.default_rng(seed_); yy2, xx2 = np.mgrid[0:120, 0:160]
        im = np.zeros((120, 160, 3)); light = 0.85 + 0.25 * (xx2 / 160) - 0.1 * (yy2 / 120)
        im[:] = np.array(bg)[None, None, :] * light[..., None] + rng2.normal(0, 4, (120, 160, 3))
        face = ((xx2 - 80) / 26) ** 2 + ((yy2 - 45) / 32) ** 2 <= 1; shirt = (yy2 >= 75) & (abs(xx2 - 80) <= 40)
        subj = face | shirt; rim = ndimage.binary_dilation(subj, iterations=2) & ~subj
        im[face] = [224, 172, 140]; im[shirt] = [60, 60, 70]; im[(yy2 >= 90) & (abs(xx2 - 80) <= 8)] = [235, 235, 235]
        bgc = np.array(bg, float); im[rim] = np.array([190, 190, 190]) + 0.35 * (bgc - (0.2126 * bgc[0] + 0.7152 * bgc[1] + 0.0722 * bgc[2]))   # a light edge (hair, a collar), tinted by the backdrop
        return np.clip(im, 0, 255).astype(np.uint8), subj, rim, ~ndimage.binary_dilation(subj, iterations=4)
    for nm, bg in (("green", [40, 175, 70]), ("blue", [30, 70, 190])):
        im, subj, rim, back = screen(bg, 4)
        key = im[back].mean(0).round().astype(int).tolist()
        open(p("scr.rgba"), "wb").write(np.dstack([im, np.full((120, 160), 255, np.uint8)]).tobytes())
        rk = run(r"""var a = new Uint8ClampedArray(fs.readFileSync(OUT + '/scr.rgba')), im = { width: 160, height: 120, data: a }, e = V.fx.make('ultraKey'); e.p.color = %s; V.fx.run(im, e, 0, { scale: 1 }); fs.writeFileSync(OUT + '/key.rgba', Buffer.from(a.buffer)); return e.p;""" % J(key))
        out = np.frombuffer(open(p("key.rgba"), "rb").read(), np.uint8).reshape(120, 160, 4).astype(float)
        inner = ndimage.binary_erosion(subj, iterations=2)
        a_back = (out[..., 3][back] <= 13).mean(); a_subj = (out[..., 3][inner] >= 242).mean()
        check("Ultra Key, %s screen (key colour picked from it, defaults): the backdrop goes (alpha <= 5%% on %.1f%% of it, wanting 99%%)" % (nm, 100 * a_back), a_back >= 0.99, a_back)
        check("Ultra Key, %s screen: the person stays (alpha >= 95%% on %.1f%% of face, shirt and white collar, wanting 99%%)" % (nm, 100 * a_subj), a_subj >= 0.99, a_subj)
        X2 = im.astype(float)
        def cbcr_(a): y_ = luma(a); return np.stack([(a[..., 2] - y_) / 1.8556, (a[..., 0] - y_) / 1.5748], -1)
        kc = cbcr_(np.array(key, float)[None, None, :])[0, 0]; ku = kc / np.linalg.norm(kc)
        def tint(a): return cbcr_(a[..., :3]) @ ku       # how much of the key's own colour a pixel carries (Rec. 709 colour difference)
        check("Ultra Key, %s screen: the backdrop's colour on the edge (spill) is taken down by at least a fifth, the edge's brightness kept within 4%%" % nm,
              tint(X2)[rim].mean() > 5 and tint(out)[rim].mean() < 0.8 * tint(X2)[rim].mean() and abs(luma(out)[rim].mean() / luma(X2)[rim].mean() - 1) < 0.04, (tint(out)[rim].mean(), tint(X2)[rim].mean(), luma(out)[rim].mean() / luma(X2)[rim].mean()))
        check("Ultra Key, %s screen: the face and the shirt keep their colours (within 2 levels)" % nm, np.abs(out[..., :3] - X2)[inner].max() <= 2, np.abs(out[..., :3] - X2)[inner].max())

    # blend modes with see-through layers, against the W3C Compositing and Blending formula with the Photoshop blend functions
    r = run(r"""var B = V.blend, a = [], b = [], s = 5; function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return Math.floor(s / 2147483648 * 256); }
      for (var i = 0; i < 4000; i++) { a.push(rnd(), rnd(), rnd(), [255, 200, 128, 40][i % 4]); b.push(rnd(), rnd(), rnd(), [255, 255, 128, 0, 200][i % 5]); }
      var out = { a: a, b: b }; ['linearBurn', 'linearLight', 'vividLight', 'pinLight', 'hardMix', 'subtract', 'divide', 'darkerColor', 'lighterColor'].forEach(function (m) { var below = { data: new Uint8ClampedArray(b) }, above = { data: new Uint8ClampedArray(a) }; B.pixel(m, below, above, 0.7); out[m] = Array.from(below.data); });
      var below = { data: new Uint8ClampedArray(160000) }, above = { data: new Uint8ClampedArray(160000).fill(255) }; B.pixel('dissolve', below, above, 0.35, 9); var n = 0; for (var q = 3; q < 160000; q += 4) if (below.data[q]) n++; out.diss = n / 40000;
      return out;""")
    A_ = np.array(r["a"], float).reshape(-1, 4) / 255; B_ = np.array(r["b"], float).reshape(-1, 4) / 255
    Cs, as_ = A_[:, :3], A_[:, 3:] * 0.7; Cb, ab = B_[:, :3], B_[:, 3:]
    def burn(b, a): return np.where(a <= 0, 0, np.maximum(0, 1 - (1 - b) / np.maximum(a, 1e-9)))
    def dodge(b, a): return np.where(a >= 1, 1, np.minimum(1, b / np.maximum(1 - a, 1e-9)))
    viv = np.where(Cs <= 0.5, burn(Cb, 2 * Cs), dodge(Cb, 2 * Cs - 1))
    F = {"linearBurn": np.maximum(0, Cs + Cb - 1), "linearLight": np.clip(Cb + 2 * Cs - 1, 0, 1), "vividLight": viv, "pinLight": np.where(Cs <= 0.5, np.minimum(Cb, 2 * Cs), np.maximum(Cb, 2 * Cs - 1)),
         "hardMix": (viv >= 0.5).astype(float), "subtract": np.maximum(0, Cb - Cs), "divide": np.where(Cs <= 0, 1, np.minimum(1, Cb / np.maximum(Cs, 1e-9)))}
    ya = Cs @ [0.2126, 0.7152, 0.0722]; yb = Cb @ [0.2126, 0.7152, 0.0722]
    F["darkerColor"] = np.where((ya < yb)[:, None], Cs, Cb); F["lighterColor"] = np.where((ya > yb)[:, None], Cs, Cb)
    worst = {}
    for m, Bf in F.items():
        Cs2 = (1 - ab) * Cs + ab * Bf; ao = as_ + ab * (1 - as_); co = as_ * Cs2 + ab * Cb * (1 - as_)
        Cr = np.where(ao > 0, co / np.maximum(ao, 1e-9), Cb); keep = (as_[:, 0] > 0)
        out = np.array(r[m], float).reshape(-1, 4)
        refC = np.where(keep[:, None], Cr * 255, Cb * 255); refA = np.where(keep, ao[:, 0] * 255, ab[:, 0] * 255)
        worst[m] = float(max(np.abs(out[:, :3] - refC).max(), np.abs(out[:, 3] - refA).max()))
    check("blend modes with see-through layers (layer alpha 0.16-1 times opacity 0.7, the one below 0-1), against the W3C compositing formula: within 1.5 levels", max(worst.values()) <= 1.5, worst)
    check("blend mode Dissolve at 35%%: about 35%% of the pixels taken (%.1f%%)" % (100 * r["diss"]), abs(r["diss"] - 0.35) < 0.02, r["diss"])


# ============================================================================================================
# 9. AUDIO EFFECTS: the RBJ cookbook biquads, the dynamics, the delay
# ============================================================================================================
def rbj(kind, f0, Q, g, fs):
    """Robert Bristow-Johnson's Audio EQ Cookbook, worked here from its text"""
    A = 10 ** (g / 40); w0 = 2 * np.pi * f0 / fs; c = np.cos(w0); s_ = np.sin(w0); al = s_ / (2 * Q)
    if kind == "lowpass": b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "highpass": b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "notch": b = [1, -2 * c, 1]; a = [1 + al, -2 * c, 1 - al]
    elif kind == "peak": b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    elif kind == "lowshelf":
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]; a = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
    elif kind == "highshelf":
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]; a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    return np.array(b) / a[0], np.array(a) / a[0]

if want("afx"):
    from scipy import signal
    specs = [("lowpass", 80, 0.7071, 0, 48000), ("lowpass", 8000, 2.0, 0, 44100), ("highpass", 80, 0.7071, 0, 48000), ("highpass", 1000, 0.5, 0, 44100), ("peak", 1000, 1.0, 6, 48000), ("peak", 100, 0.5, 12, 44100),
             ("peak", 10000, 4.0, -9, 48000), ("lowshelf", 200, 0.7071, 6, 48000), ("lowshelf", 200, 0.7071, -9, 44100), ("highshelf", 3000, 0.7071, 6, 48000), ("highshelf", 8000, 1.2, -12, 44100), ("notch", 60, 30, 0, 48000)]
    r = run(r"""return %s.map(function (x) { return V.afx.biquad(x[0], x[1], x[2], x[3], x[4]); });""" % J(specs))
    freqs = np.geomspace(20, 20000, 200)
    for spec, c in zip(specs, r):
        b, a = rbj(*spec)
        w_ = 2 * np.pi * freqs / spec[4]
        _, hl = signal.freqz([c["b0"], c["b1"], c["b2"]], [1, c["a1"], c["a2"]], worN=w_); _, hr = signal.freqz(b, a, worN=w_)
        d = np.abs(20 * np.log10(np.abs(hl) + 1e-30) - 20 * np.log10(np.abs(hr) + 1e-30))
        d = d[np.abs(hr) > 1e-4].max()
        check("EQ %s %g Hz Q %g %+g dB at %d Hz: Lantern's response is the Audio EQ Cookbook's at 200 frequencies (within 0.001 dB)" % spec, d < 1e-3, d)
    def resp(c, f, fs): _, h = signal.freqz([c["b0"], c["b1"], c["b2"]], [1, c["a1"], c["a2"]], worN=[2 * np.pi * f / fs]); return 20 * np.log10(abs(h[0]))
    check("EQ: a peak of +6 dB at 1 kHz is +6.00 there; low-pass and high-pass (Q 0.707) are -3.01 dB at their corner; a -9 dB low shelf is -9 dB at 20 Hz; the 60 Hz notch takes out 60 Hz",
          abs(resp(r[4], 1000, 48000) - 6) < 0.01 and abs(resp(r[0], 80, 48000) + 3.01) < 0.02 and abs(resp(r[2], 80, 48000) + 3.01) < 0.02 and abs(resp(r[8], 20, 44100) + 9) < 0.2 and resp(r[11], 60, 48000) < -60,
          (resp(r[4], 1000, 48000), resp(r[0], 80, 48000), resp(r[2], 80, 48000), resp(r[8], 20, 44100), resp(r[11], 60, 48000)))
    # the filter itself against scipy's lfilter
    rng_ = np.random.default_rng(2); x = rng_.normal(0, 0.3, 48000).astype(np.float32); x.tofile(p("afx_in.f32"))
    rr = run(r"""var x = new Float32Array(f32(OUT + '/afx_in.f32')), c = V.afx.biquad('peak', 2500, 1.4, 7.5, 48000); V.afx.filter(x, c); save32(OUT + '/afx_out.f32', x); return c;""")
    y = np.fromfile(p("afx_out.f32"), np.float32); ref = signal.lfilter([rr["b0"], rr["b1"], rr["b2"]], [1, rr["a1"], rr["a2"]], x.astype(float))
    check("EQ: Lantern's filter runs the same difference equation as SciPy's lfilter (within 1e-5 on noise)", np.abs(y - ref).max() < 1e-5, np.abs(y - ref).max())
    # the effects as a clip runs them
    AFX_JS = r"""function run1(type, set, chs, sr) { var e = V.fx.make(type); for (var k in set) e.p[k] = set[k]; var d = V.fx.defs[type]; return d.run(chs, V.fx.values(e, 0), sr || 48000); }
      function sine(f, n, a, sr) { var d = new Float32Array(n); for (var i = 0; i < n; i++) d[i] = a * Math.sin(2 * Math.PI * f * i / (sr || 48000)); return d; }
      function sq(n, a) { var d = new Float32Array(n); for (var i = 0; i < n; i++) d[i] = (Math.floor(i / 24) % 2 ? -a : a); return d; }
      function db(x, from) { var s = 0; for (var i = from || 0; i < x.length; i++) s += x[i] * x[i]; return 10 * Math.log10(s / (x.length - (from || 0))); }
      function pk(x, from) { var m = 0; for (var i = from || 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); return m; }
      var out = {}, n = 48000;
      out.eq = [30, 15000, 1000].map(function (f) { var a = run1('bassTreble', { bass: 6, treble: -6 }, [sine(f, n, 0.3)]); return db(a[0], 24000) - db(sine(f, n, 0.3), 24000); });
      out.notch = [60, 120, 180, 1000].map(function (f) { var a = run1('notch', { f: 60, q: 30 }, [sine(f, n * 2, 0.3)]); return db(a[0], 48000) - db(sine(f, n * 2, 0.3), 48000); });
      var c1 = run1('compressor', { th: -20, ratio: 4, att: 10, rel: 100, makeup: 0 }, [sq(n, 0.5)]); out.comp = 20 * Math.log10(pk(c1[0], 24000));
      var c2 = run1('compressor', { th: -20, ratio: 4, att: 10, rel: 100, makeup: 0 }, [sq(n, 0.05)]); out.compBelow = 20 * Math.log10(pk(c2[0], 24000));
      var c3 = run1('compressor', { th: -20, ratio: 4, att: 10, rel: 100, makeup: 6 }, [sq(n, 0.5)]); out.compMk = 20 * Math.log10(pk(c3[0], 24000));
      var seed = 3, loud = [new Float32Array(n * 4), new Float32Array(n * 4)]; for (var i = 0; i < n * 4; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; var v = (seed / 2147483648 * 2 - 1) * (0.3 + 0.7 * Math.abs(Math.sin(i / 9000))); loud[0][i] = v; loud[1][i] = -0.8 * v; }
      var lim = run1('limiter', { ceil: -1, gain: 12, rel: 80 }, [new Float32Array(loud[0]), new Float32Array(loud[1])]); out.limPeak = 20 * Math.log10(Math.max(pk(lim[0]), pk(lim[1])));
      var quiet = run1('limiter', { ceil: -1, gain: 6, rel: 80 }, [sine(440, n, 0.2)]); var qd = 0, ref = sine(440, n, 0.2); for (i = 0; i < n; i++) qd = Math.max(qd, Math.abs(quiet[0][i] - ref[i] * Math.pow(10, 6 / 20))); out.limQuiet = qd;
      var g = run1('gate', { th: -50, att: 2, rel: 150 }, [sine(300, n * 2, 0.0005)]); out.gateClosed = pk(g[0], 48000);
      var g2 = run1('gate', { th: -50, att: 2, rel: 150 }, [sine(300, n * 2, 0.1)]); out.gateOpen = db(g2[0], 48000) - db(sine(300, n * 2, 0.1), 48000);
      var imp = new Float32Array(n); imp[0] = 1; var dl = run1('delay', { ms: 250, fb: 40, mix: 30 }, [imp]); out.delay = [dl[0][0], dl[0][12000], dl[0][24000], dl[0][36000], dl[0][1], dl[0][12001]];
      var am = run1('amplify', { gain: 6 }, [sine(440, 1000, 0.1)]); out.amp = pk(am[0]) / 0.1;
      var rv = run1('reverb', { size: 60, damp: 40, mix: 30 }, [imp.slice()]); var e1 = 0, e2 = 0, fin = true; for (i = 0; i < n; i++) { if (!isFinite(rv[0][i])) fin = false; if (i > 2400 && i < 12000) e1 += rv[0][i] * rv[0][i]; if (i > 36000) e2 += rv[0][i] * rv[0][i]; } out.reverb = [fin, e1, e2];
      var sw = run1('swap', {}, [sine(100, 10, 1), new Float32Array(10)]), s0 = sine(100, 10, 1); out.swap = [pk(sw[0]), Math.max.apply(null, Array.prototype.map.call(sw[1], function (v, i) { return Math.abs(v - s0[i]); }))];
      return out;"""
    r = run(AFX_JS)
    check("Bass and Treble (+6, -6): +6 dB at 30 Hz, -6 dB at 15 kHz, 1 kHz little changed (within 0.3 and 1 dB)", abs(r["eq"][0] - 6) < 0.3 and abs(r["eq"][1] + 6) < 0.3 and abs(r["eq"][2]) < 1, r["eq"])
    check("Notch Filter at 60 Hz takes 60, 120 and 180 Hz down by 30 dB or more and leaves 1 kHz (within 0.1 dB)", all(x < -30 for x in r["notch"][:3]) and abs(r["notch"][3]) < 0.1, r["notch"])
    check("Dynamics Processing, threshold -20 dB, ratio 4:1: a -6 dB square comes out at -16.5 dB (within 0.3); one below the threshold is unchanged; make-up +6 adds 6",
          abs(r["comp"] + 16.5) < 0.3 and abs(r["compBelow"] - 20 * np.log10(0.05)) < 0.05 and abs(r["compMk"] - r["comp"] - 6) < 0.05, (r["comp"], r["compBelow"], r["compMk"]))
    check("Hard Limiter, ceiling -1 dB, 12 dB of boost on loud noise: no sample above -1 dB (%.3f)" % r["limPeak"], r["limPeak"] <= -1 + 1e-4, r["limPeak"])
    check("Hard Limiter: sound that stays under the ceiling passes untouched but for its boost", r["limQuiet"] < 1e-6, r["limQuiet"])
    check("Noise Gate at -50 dB: a -66 dB hum is shut out; a -20 dB tone passes at its level (within 0.1 dB)", r["gateClosed"] < 1e-6 and abs(r["gateOpen"]) < 0.1, (r["gateClosed"], r["gateOpen"]))
    check("Delay 250 ms, feedback 40%, mix 30%: an impulse comes out at 0.7, then 0.3 at 250 ms, 0.12 at 500 ms, 0.048 at 750 ms", np.allclose(r["delay"], [0.7, 0.3, 0.12, 0.048, 0, 0], atol=1e-6), r["delay"])
    check("Amplify +6 dB multiplies by 1.995", abs(r["amp"] - 10 ** 0.3) < 1e-4, r["amp"])
    check("Reverb: an impulse gives a finite tail that dies away (the last half second far quieter than the first 200 ms)", r["reverb"][0] and r["reverb"][2] < r["reverb"][1] * 0.05, r["reverb"])
    check("Swap Channels puts the left in the right and the right in the left", r["swap"][0] == 0 and r["swap"][1] == 0, r["swap"])

# ============================================================================================================
# 10. EDL, FINAL CUT PRO XML AND CAPTIONS
# ============================================================================================================
XS = r"""var S = V.seq, E = V.edit, T = V.time, X = V.xchg;
function proj(r, drop) { var p = S.project(), seq = p.seqs[p.active]; seq.rate = r; seq.drop = !!drop; seq.name = 'Cut'; return { p: p, seq: seq }; }
function add(p, id, name, dur, fr) { p.media[id] = { id: id, name: name, kind: 'video', dur: dur, w: 1920, h: 1080, fps: fr, hasAudio: true }; }
function lay(seq) { return S.all(seq).map(function (x) { return [x.t.name, x.c.start, x.c.dur, Math.round(x.c.srcIn * 1000) / 1000, x.c.media, +Math.abs(x.c.speed).toFixed(4), !!x.c.reverse]; }).sort(); }
"""
if want("xchg"):
    r = run(XS + r"""var out = {};
      [[24000, 1001, false], [30000, 1001, false], [30000, 1001, true], [25, 1, false], [60000, 1001, false]].forEach(function (x) { var h = proj(T.rate(x[0], x[1]), x[2]); add(h.p, 'a', 'a.mov', 60, h.seq.rate);
        E.place(h.seq, h.seq.v[0], S.clip({ media: 'a', start: 0, dur: 48, srcIn: 0 })); var edl = X.edl(h.p, h.seq).split('\r\n'); out[x.join('/')] = edl.filter(function (l) { return /^001/.test(l); })[0]; });
      return out;""")
    for key, nm, want_ in (("24000/1001/false", "23.976 non-drop", "01:00:00:00"), ("30000/1001/false", "29.97 non-drop", "01:00:00:00"), ("30000/1001/true", "29.97 drop-frame", "01:00:00;00"), ("25/1/false", "25", "01:00:00:00"), ("60000/1001/false", "59.94 non-drop", "01:00:00:00")):
        rec_in = r[key].split()[-2] if r[key] else None
        check("EDL from a %s sequence: the first event's record time starts at %s (the hour every editor starts a program at)" % (nm, want_), rec_in == want_, r[key])
    # reading EDLs written by hand in the standard CMX 3600 form
    edl_23976 = "TITLE: Film cut\r\nFCM: NON-DROP FRAME\r\n\r\n001  AX       V     C        00:00:10:00 00:00:12:00 01:00:00:00 01:00:02:00\r\n* FROM CLIP NAME: a.mov\r\n\r\n002  AX       V     C        00:00:05:00 00:00:06:00 01:00:02:00 01:00:03:00\r\n* FROM CLIP NAME: b.mov\r\n"
    edl_diss = ("TITLE: Dissolve\r\nFCM: NON-DROP FRAME\r\n\r\n001  AX       V     C        00:00:01:00 00:00:05:00 01:00:00:00 01:00:04:00\r\n* FROM CLIP NAME: a.mov\r\n\r\n"
                "002  AX       V     C        00:00:05:00 00:00:05:00 01:00:04:00 01:00:04:00\r\n002  AX       V     D    025 00:00:10:00 00:00:13:00 01:00:04:00 01:00:07:00\r\n* FROM CLIP NAME: a.mov\r\n* TO CLIP NAME: b.mov\r\n")
    edl_b = "TITLE: Both\r\nFCM: NON-DROP FRAME\r\n\r\n001  AX       B     C        00:00:01:00 00:00:03:00 01:00:00:00 01:00:02:00\r\n* FROM CLIP NAME: a.mov\r\n"
    r = run(XS + r"""var out = {};
      var h = proj(T.rate(24000, 1001)); add(h.p, 'a', 'a.mov', 60); add(h.p, 'b', 'b.mov', 60); h.seq.v[0].clips = []; X.readEdl(%s, h.p, h.seq); out.film = lay(h.seq);
      h = proj(T.rate(25, 1)); add(h.p, 'a', 'a.mov', 60); add(h.p, 'b', 'b.mov', 60); X.readEdl(%s, h.p, h.seq); out.diss = lay(h.seq); var c2 = h.seq.v[0].clips.filter(function (c) { return c.start === 100; })[0]; out.dissT = c2 && c2.tin;
      h = proj(T.rate(25, 1)); add(h.p, 'a', 'a.mov', 60); X.readEdl(%s, h.p, h.seq); out.both = lay(h.seq);
      return out;""" % (J(edl_23976), J(edl_diss), J(edl_b)))
    check("EDL read, 23.976 non-drop, record from 01:00:00:00 (as Premiere and Resolve write it): the first clip at frame 0, the second at frame 48", [x[1] for x in r["film"]] == [0, 48], r["film"])
    check("EDL read, a standard dissolve (C to D, FROM a.mov TO b.mov): the incoming clip at 4 s is b.mov from 10 s, with a 25-frame dissolve; a.mov before it",
          ["V1", 100, 75, 10.0, "b"] in [x[:5] for x in r["diss"]] and ["V1", 0, 100, 1.0, "a"] in [x[:5] for x in r["diss"]] and r["dissT"] and r["dissT"]["dur"] == 25, (r["diss"], r["dissT"]))
    check("EDL read, an event on channel B (picture and sound together): a clip on V1 and its sound on A1", sorted(x[0] for x in r["both"]) == ["A1", "V1"], r["both"])
    # Lantern's own EDL: dissolve naming, drop-frame, several tracks, speed, round trip
    r = run(XS + r"""var h = proj(T.rate(30000, 1001), true), out = {}; add(h.p, 'a', 'interview.mp4', 120); add(h.p, 'b', 'broll.mov', 90); add(h.p, 'c', 'music.wav', 300);
      E.place(h.seq, h.seq.v[0], S.clip({ media: 'a', start: 0, dur: 300, srcIn: 300 * 1001 / 30000 })); var cb = S.clip({ media: 'b', start: 300, dur: 150, srcIn: 90 * 1001 / 30000 }); cb.tin = { type: 'crossDissolve', dur: 20, align: 'start' }; E.place(h.seq, h.seq.v[0], cb);
      E.place(h.seq, h.seq.v[1], S.clip({ media: 'b', start: 120, dur: 60, srcIn: 30 * 1001 / 30000 })); E.place(h.seq, h.seq.a[0], S.clip({ media: 'a', start: 0, dur: 450, srcIn: 300 * 1001 / 30000 })); E.place(h.seq, h.seq.a[1], S.clip({ media: 'c', start: 30, dur: 420, srcIn: 0 }));
      var fast = S.clip({ media: 'b', start: 450, dur: 60, srcIn: 0, speed: 2 }); E.place(h.seq, h.seq.v[0], fast);
      var edl = X.edl(h.p, h.seq); out.edl = edl.split('\r\n');
      var q = proj(T.rate(30000, 1001), true); q.p.media = S.clone(h.p.media); S.tracks(q.seq).forEach(function (t) { t.clips = []; }); out.note = X.readEdl(edl, q.p, q.seq); out.orig = lay(h.seq); out.back = lay(q.seq);
      return out;""")
    di = [i for i, l in enumerate(r["edl"]) if "     D    " in l]
    names = r["edl"][di[0] + 1:di[0] + 3] if di else []
    check("Lantern's EDL, a dissolve into broll.mov: 'FROM CLIP NAME' names the outgoing clip (interview.mp4) and 'TO CLIP NAME' the incoming (broll.mov), as CMX 3600 writes a transition",
          "* FROM CLIP NAME: interview.mp4" in names and "* TO CLIP NAME: broll.mov" in names, names)
    okb = len(r["back"]) == len(r["orig"]) and all(a[:5] == b[:5] for a, b in zip(r["orig"], r["back"]))
    check("Lantern's EDL read back: the same clips on the same tracks (V1, V2, A1, A2), places, in points and media", okb, (r["orig"], r["back"]))
    sp = [x for x in r["back"] if x[1] == 450 and x[0] == "V1"]
    check("Lantern's EDL read back: a clip at 200%% comes back at 200%% (within 0.1%%; the EDL's M2 line gives %s)" % [l for l in r["edl"] if l.startswith("M2")][:1], sp and abs(sp[0][5] - 2) < 0.002, sp)
    # Final Cut Pro XML
    xml_trans = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4"><sequence id="s1"><name>Seq</name><duration>200</duration><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate>
<media><video><format><samplecharacteristics><width>1920</width><height>1080</height></samplecharacteristics></format>
<track>
<clipitem id="c1"><name>a.mov</name><duration>1500</duration><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><start>0</start><end>-1</end><in>25</in><out>137</out><file id="f1"><name>a.mov</name><pathurl>file://localhost/a.mov</pathurl></file></clipitem>
<transitionitem><start>100</start><end>125</end><alignment>center</alignment><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><effect><name>Cross Dissolve</name><effectid>Cross Dissolve</effectid><effectcategory>Dissolve</effectcategory><effecttype>transition</effecttype><mediatype>video</mediatype></effect></transitionitem>
<clipitem id="c2"><name>b.mov</name><duration>1500</duration><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><start>-1</start><end>200</end><in>238</in><out>325</out><file id="f2"><name>b.mov</name><pathurl>file://localhost/b.mov</pathurl></file></clipitem>
</track></video><audio></audio></media></sequence></xmeml>"""
    r = run(XS + r"""var out = {}, h = proj(T.rate(25, 1)); add(h.p, 'a', 'a.mov', 60); add(h.p, 'b', 'b.mov', 60); try { var back = X.readFcpxml(%s, h.p); out.trans = lay(back.seq); } catch (e) { out.trans = String(e.message); }
      // Lantern's own XML: links, escaping, speed, 23.976
      var g = proj(T.rate(24000, 1001)); add(g.p, 'x', 'Tom & Jerry <cut> "final".mov', 100); add(g.p, 'y', 'y.mov', 100); var l = 'L1';
      E.place(g.seq, g.seq.v[0], S.clip({ media: 'x', start: 0, dur: 96, srcIn: 2, link: l })); E.place(g.seq, g.seq.a[0], S.clip({ media: 'x', start: 0, dur: 96, srcIn: 2, link: l }));
      E.place(g.seq, g.seq.v[0], S.clip({ media: 'y', start: 96, dur: 48, srcIn: 0, speed: 2 }));
      var xml = X.fcpxml(g.p, g.seq); out.xml = xml; out.links = (xml.match(/<link>/g) || []).length; out.orig = lay(g.seq);
      try { var b2 = X.readFcpxml(xml, g.p); out.back = lay(b2.seq); out.rate = b2.seq.rate; } catch (e) { out.back = String(e.message); out.rate = null; }
      // the same with a plain name, for the round trip itself
      g.p.media.x.name = 'Tom and Jerry final.mov'; var xml2 = X.fcpxml(g.p, g.seq), b3 = X.readFcpxml(xml2, g.p); out.back2 = lay(b3.seq); out.rate2 = b3.seq.rate; g.p.media.x.name = 'Tom & Jerry <cut> "final".mov';
      out.json = (function () { var t = X.save(g.p), p2 = X.load(t); return JSON.stringify(p2) === JSON.stringify(g.p); })();
      return out;""" % J(xml_trans))
    check("Final Cut Pro XML read, two clips with a Cross Dissolve between them (Premiere writes their joining ends as -1): both clips arrive, a.mov at 0 and b.mov ending at 200", isinstance(r["trans"], list) and len(r["trans"]) == 2, r["trans"])
    check("Final Cut Pro XML written by Lantern: a picture and its linked sound carry <link> entries, as the module says", r["links"] >= 2, r["links"])
    import xml.dom.minidom as _md
    try: _md.parseString(r["xml"].encode("utf-8")); wf = ""
    except Exception as e_: wf = str(e_)
    check("Final Cut Pro XML written by Lantern for a file named 'Tom & Jerry <cut> \"final\".mov' is well-formed XML (Python's parser reads it)", wf == "", (wf, [l for l in r["xml"].split("\n") if "pathurl" in l][:1]))
    okx = isinstance(r["back"], list) and [a[:5] for a in r["orig"]] == [b[:5] for b in r["back"]]
    check("Final Cut Pro XML round trip with a name full of & < > and quotes: Lantern reads back its own file", okx, (r["orig"], r["back"]))
    okx = [a[:5] for a in r["orig"]] == [b[:5] for b in r["back2"]] and r["rate2"] == {"num": 24000, "den": 1001}
    check("Final Cut Pro XML round trip at 23.976: the same clips, places, in points and media, the rate 24000/1001", okx, (r["orig"], r["back2"], r["rate2"]))
    sp = [x for x in r["back2"] if x[1] == 96]
    check("Final Cut Pro XML round trip: a clip at 200% (written as Time Remap 200) comes back at 200%", sp and abs(sp[0][5] - 2) < 1e-3, sp)
    check("a Lantern video project saved and opened again is the same, every field", r["json"])
    # captions
    srt_bom = "\ufeff1\r\n00:00:01,000 --> 00:00:03,500\r\n<i>Hello</i> there\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,250\r\nTwo\r\nlines\r\n\r\n"
    srt_noidx = "00:00:01,000 --> 00:00:02,000\nNo number\n\n00:00:02,500 --> 00:00:03,000\nNone here either\n"
    srt_hours = "1\n1:02:03,004 --> 01:02:04.5\nShort hour, dot for comma\n\n2\n100:00:00,000 --> 100:00:01,000\nA hundred hours in\n"
    srt_overlap = "1\n00:00:05,000 --> 00:00:08,000\nLater\n\n2\n00:00:01,000 --> 00:00:06,000\n<font color=\"#ffff00\">Earlier</font> and <b>longer</b>\n"
    vtt = "WEBVTT - a title\n\nNOTE written for the review\nit has two lines\n\nSTYLE\n::cue { color: yellow }\n\nintro\n00:01.000 --> 00:03.500 align:start position:10%\n<v Roger>Fish &amp; chips</v>\n\n00:00:04.000 --> 00:00:05.000\nA &lt;b&gt; that is text\n"
    r = run(r"""var C = V.cap, T = V.time, S = V.seq; var out = { bom: C.parse(%s), noidx: C.parse(%s), hours: C.parse(%s), overlap: C.parse(%s), vtt: C.parse(%s) };
      var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(24000, 1001); var fr = C.toFrames(out.bom.concat(out.overlap), seq); out.srt = C.srt(fr, seq); out.vttOut = C.vtt(fr, seq); out.again = C.parse(out.srt); out.againV = C.parse(out.vttOut); return out;""" % (J(srt_bom), J(srt_noidx), J(srt_hours), J(srt_overlap), J(vtt)))
    check("SubRip with a byte-order mark and CRLF lines: both cues, the tags taken off, two lines kept as two", r["bom"] == [{"start": 1, "end": 3.5, "text": "Hello there"}, {"start": 4, "end": 5.25, "text": "Two\nlines"}], r["bom"])
    check("SubRip without the cue numbers: both cues read", [(c["start"], c["end"], c["text"]) for c in r["noidx"]] == [(1, 2, "No number"), (2.5, 3, "None here either")], r["noidx"])
    check("SubRip with a one-digit hour, a full stop for the comma, and 100 hours: read as times", [(round(c["start"], 3), round(c["end"], 3)) for c in r["hours"]] == [(3723.004, 3724.5), (360000.0, 360001.0)], r["hours"])
    check("SubRip with overlapping cues out of order, a <font> tag: both kept, in time order, the words clean", [(c["start"], c["text"]) for c in r["overlap"]] == [(1, "Earlier and longer"), (5, "Later")], r["overlap"])
    check("WebVTT with a title, a NOTE, a STYLE block, a cue name, settings and a voice: two cues, 'Fish & chips' (its &amp; read as &)", [(c["start"], c["end"], c["text"]) for c in r["vtt"]] == [(1, 3.5, "Fish & chips"), (4, 5, "A <b> that is text")], r["vtt"])
    lines = r["srt"].split("\n")
    check("SubRip written: numbered from 1, times as HH:MM:SS,mmm --> HH:MM:SS,mmm", lines[0] == "1" and re.match(r"^\d\d:\d\d:\d\d,\d\d\d --> \d\d:\d\d:\d\d,\d\d\d$", lines[1]) is not None, lines[:3])
    check("captions written at 23.976 and read again: each cue's times within half a frame, its words the same", len(r["again"]) == 4 and all(abs(a["start"] - b["start"]) <= 0.5 * 1001 / 24000 + 1e-3 and a["text"] == b["text"] for a, b in zip(r["again"], sorted(r["bom"] + r["overlap"], key=lambda c: c["start"]))), r["again"])
    check("WebVTT written begins WEBVTT and reads back the same cues", r["vttOut"].startswith("WEBVTT") and [c["text"] for c in r["againV"]] == [c["text"] for c in r["again"]], r["vttOut"][:80])

# ==== END OF SECTIONS ====
print("%d checks, %d failed" % (N, FAILS))
if os.environ.get("KEEP"): print("media kept in " + OUT)
else: shutil.rmtree(OUT, ignore_errors=True)
sys.exit(1 if FAILS else 0)
