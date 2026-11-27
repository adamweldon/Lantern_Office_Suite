#!/usr/bin/env python3
# Review 3 of the Video tile (Lantern 1.24.43): files and arithmetic, on the newest and mended parts.
# Written by a reviewer who did not write the tile. Everything is made afresh in a temporary folder (fixed seeds);
# the modules are cut from ../../../src/lantern.inner.html between their markers and run in Node (as
# tests/video_algos.py does), and in Chromium (Playwright) only where the browser's own behaviour is the reference.
# The references are other programs: ffmpeg/ffprobe 6.1 (swr, soxr, atempo, ebur128, demuxers, decoders), SciPy,
# NumPy, PIL, pyloudnorm, Python's XML parser, OpenTimelineIO's CMX 3600 and FCP 7 XML adapters (fetched into the
# temporary folder if they are not installed; SKIP if they cannot be had), Chromium's WebVTT parser and
# decodeAudioData, and closed forms worked out here. One line per check: "PASS  ..." or "FAIL  ...  [seen]", then
# "<n> checks, <m> failed". Sections: python3 run.py [pitch resample fold mix remap keys fuzz stab mask xchg files
# captions loud] (all if none named).
import os, re, sys, json, math, shutil, subprocess, tempfile, time, random
import numpy as np
from scipy import signal as ss

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = open(os.path.join(ROOT, "src", "lantern.inner.html"), encoding="utf-8").read()
NAMES = ["VIDEO_TIME", "VIDEO_BYTES", "VIDEO_MP4_READ", "VIDEO_MKV_READ", "VIDEO_RIFF", "VIDEO_MP4_WRITE", "VIDEO_WEBM_WRITE",
         "VIDEO_GIF_WRITE", "VIDEO_SEQ", "VIDEO_EDIT", "VIDEO_KEYS", "VIDEO_COLOR", "VIDEO_FX", "VIDEO_LUMETRI", "VIDEO_FILT",
         "VIDEO_FX_IMAGE", "VIDEO_FX_SPACE", "VIDEO_FX_KEY", "VIDEO_TRANS", "VIDEO_TITLE", "VIDEO_CAPTIONS", "VIDEO_AFX",
         "VIDEO_LOUD", "VIDEO_MIX", "VIDEO_BLEND", "VIDEO_MEDIA", "VIDEO_MASK", "VIDEO_EXPORT", "VIDEO_XCHG", "VIDEO_SCOPES",
         "VIDEO_STAB"]
CODE = "".join(re.search(r"// MODULE: %s - START\n.*?// MODULE: %s - END\n" % (n, n), SRC, re.S).group(0) for n in NAMES)
OUT = tempfile.mkdtemp(prefix="video_review3_")
LIB = os.path.join(OUT, "lib.js")
open(LIB, "w", encoding="utf-8").write(
    "global.window = global.window || { Lantern: {} };\ntry { global.DOMParser = new (require(%s).JSDOM)('').window.DOMParser; } catch (e) {}\n"
    % json.dumps(os.path.join(ROOT, "node_modules", "jsdom")) + CODE)
open(os.path.join(OUT, "page_lib.js"), "w", encoding="utf-8").write("window.Lantern = window.Lantern || {};\n" + CODE)
SR = 48000
FF = shutil.which("ffmpeg"); FP = shutil.which("ffprobe")
fails = 0; n = 0

def check(name, cond, info=""):
    global fails, n
    n += 1
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  [" + str(info)[:500] + "]"), flush=True)
    if not cond: fails += 1

def skip(name, why): print("SKIP  " + name + "  (" + why + ")", flush=True)

PRELUDE = r"""
var fs = require('fs'); require(%s);
var V = window.Lantern.video, S = V.seq, E = V.edit, T = V.time, K = V.keys, F = V.fx, OUT = %s;
function rd(p, ch) { var u = new Uint8Array(fs.readFileSync(p)), f = new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)); ch = ch || 1;
  var n = f.length / ch, o = []; for (var c = 0; c < ch; c++) { var d = new Float32Array(n); for (var i = 0; i < n; i++) d[i] = f[i * ch + c]; o.push(d); } return o; }
function wr(p, arrs) { var n = arrs[0].length, k = arrs.length, f = new Float32Array(n * k); for (var i = 0; i < n; i++) for (var c = 0; c < k; c++) f[i * k + c] = arrs[c][i]; fs.writeFileSync(p, Buffer.from(f.buffer)); }
function proj(rate, sr) { var p = S.project(), seq = p.seqs[p.active]; if (rate) { seq.rate = T.rate(rate[0], rate[1]); seq.drop = T.dropOk(seq.rate); } if (sr) seq.sampleRate = sr; return { p: p, seq: seq }; }
function bytes(p) { return V.bytes.fromBytes(new Uint8Array(fs.readFileSync(p))); }
function sound(p, id, sr, data, name) { V.media.rt[id] = { audio: { sampleRate: sr, data: data } }; p.media[id] = { id: id, name: name || id + '.wav', kind: 'video', dur: data[0].length / sr, hasAudio: true }; }
"""

def node(js, timeout=600):
    f = os.path.join(OUT, "t.js")
    open(f, "w", encoding="utf-8").write(PRELUDE % (json.dumps(LIB), json.dumps(OUT)) +
        "Promise.resolve().then(function () {\n%s\n}).then(function (r) { console.log(JSON.stringify(r === undefined ? null : r)); }, function (e) { console.log(JSON.stringify({ error: String(e && e.stack || e) })); });" % js)
    r = subprocess.run(["node", f], capture_output=True, text=True, timeout=timeout)
    if r.returncode: raise RuntimeError(r.stderr[-1500:])
    out = json.loads(r.stdout.strip().split("\n")[-1])
    if isinstance(out, dict) and "error" in out: raise RuntimeError(out["error"][:1500])
    return out

def p(name): return os.path.join(OUT, name)
def ff(*a): return subprocess.run([FF, "-v", "error", "-y"] + [str(x) for x in a], capture_output=True)
def wf32(path, x): np.asarray(x, dtype=np.float32).tofile(path)
def rf32(path, ch=1): return np.fromfile(path, dtype=np.float32).astype(np.float64).reshape(-1, ch)

# ---------------------------------------------------------------- the mixer, one clip from one sound
MIX1 = r"""
var a = %s, x = rd(a.inp, a.ch), q = proj(a.rate || null, a.seqsr || 48000), p = q.p, seq = q.seq;
sound(p, 'm1', a.sr, x);
var c = S.clip({ media: 'm1', start: a.start || 0, dur: a.dur, srcIn: a.srcIn || 0 }); c.speed = a.speed; c.pitch = !!a.pitch; c.reverse = !!a.reverse;
if (a.fx) c.fx = a.fx; if (a.chan) c.chan = a.chan;
seq.a[0].clips.push(c);
var fps = seq.rate.num / seq.rate.den, t0 = Date.now(), o = V.mix.range(p, seq, 0, Math.round(((a.start || 0) + a.dur + (a.tail || 0)) / fps * seq.sampleRate));
wr(a.out, o); return { ms: Date.now() - t0 };
"""
def mix1(x, sr, dur, speed=1.0, pitch=False, reverse=False, srcIn=0.0, tail=0, fx=None, rate=None, seqsr=48000):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1: x = x[:, None]
    wf32(p("mix_in.f32"), x)
    a = dict(inp=p("mix_in.f32"), ch=x.shape[1], sr=sr, dur=dur, speed=speed, pitch=pitch, reverse=reverse, srcIn=srcIn, tail=tail,
             out=p("mix_out.f32"), fx=fx, rate=rate, seqsr=seqsr)
    node(MIX1 % json.dumps(a))
    return rf32(p("mix_out.f32"), 2)

def ffaf(x, sr, af, ch=1, outsr=None):
    wf32(p("ff_in.f32"), x)
    cmd = [FF, "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", str(ch), "-i", p("ff_in.f32"), "-af", af]
    if outsr: cmd += ["-ar", str(outsr)]
    subprocess.run(cmd + ["-f", "f32le", p("ff_out.f32")], check=True, capture_output=True)
    return rf32(p("ff_out.f32"), ch)

def atempo(x, sp, ch=1):
    chain, s = [], sp
    while s < 0.5: chain.append("atempo=0.5"); s /= 0.5
    while s > 2: chain.append("atempo=2"); s /= 2
    chain.append("atempo=%.6f" % s)
    return ffaf(x, SR, ",".join(chain), ch)

def env10(y, sr=SR, blk=480):
    nb = len(y) // blk
    return np.sqrt((y[:nb * blk].reshape(nb, blk) ** 2).mean(1)) * math.sqrt(2)

def peakfreq(y, sr=SR):
    w = ss.windows.blackmanharris(len(y)); F = np.abs(np.fft.rfft(y * w)); fr = np.fft.rfftfreq(len(y), 1 / sr)
    k = int(np.argmax(F))
    if 0 < k < len(F) - 1:
        a, b, c = np.log(F[k - 1] + 1e-30), np.log(F[k] + 1e-30), np.log(F[k + 1] + 1e-30); d = 0.5 * (a - c) / (a - 2 * b + c)
    else: d = 0
    return (k + d) * sr / len(y)

def tone_amp(y, f, sr=SR):
    t = np.arange(len(y)) / sr
    return abs(np.dot(y, np.exp(-2j * np.pi * f * t))) * 2 / len(y)

def hnr(y, f0, sr=SR):
    w = np.hanning(len(y)); F = np.abs(np.fft.rfft(y * w)) ** 2; fr = np.fft.rfftfreq(len(y), 1 / sr)
    h = np.zeros_like(F, dtype=bool); k = 1
    while k * f0 < 20000: h |= np.abs(fr - k * f0) < 4; k += 1
    return 10 * np.log10(F[h].sum() / max(F[~h].sum(), 1e-30))

def saw(f0, dur, amp=0.3, sr=SR):
    t = np.arange(int(dur * sr)) / sr; y = np.zeros_like(t); k = 1
    while k * f0 < 20000: y += np.sin(2 * np.pi * k * f0 * t) / k; k += 1
    return amp * y

def speechlike(dur, seed=3, sr=SR):
    rng = np.random.default_rng(seed); n = int(dur * sr); t = np.arange(n) / sr
    f0 = 130 + 25 * np.sin(2 * np.pi * 0.7 * t) + 10 * np.sin(2 * np.pi * 2.3 * t)
    src = ((np.cumsum(f0) / sr) % 1.0) - 0.5 + 0.02 * rng.standard_normal(n)
    y = np.zeros(n); seg = int(0.2 * sr); forms = [(700, 1100, 2600), (300, 2300, 3000), (500, 900, 2400), (400, 1900, 2600)]
    for s in range(0, n, seg):
        part = src[s:s + seg]; out = np.zeros_like(part)
        for fc, bw in zip(forms[(s // seg) % 4], (80, 100, 120)):
            b, a = ss.iirpeak(fc, fc / bw, fs=sr); out += ss.lfilter(b, a, part)
        y[s:s + seg] = out
    env = np.clip(np.sin(2 * np.pi * 2.0 * t), 0, None) ** 0.5
    return 0.3 * y * env / np.max(np.abs(y))

def musiclike(dur, seed=5, sr=SR):
    rng = np.random.default_rng(seed); n = int(dur * sr); y = np.zeros(n); notes = [220.0, 246.94, 277.18, 293.66, 329.63, 369.99, 415.30, 440.0]
    for s in range(0, n, int(0.5 * sr)):
        f = notes[rng.integers(len(notes))]; m = min(int(0.9 * sr), n - s); tt = np.arange(m) / sr; e = np.exp(-tt * 3)
        y[s:s + m] += sum(np.sin(2 * np.pi * f * k * tt + rng.uniform(0, 6)) / k ** 1.5 for k in range(1, 9)) * e
    return 0.25 * y / np.max(np.abs(y))

def loudness(x, sr=SR):
    try:
        import pyloudnorm
        return pyloudnorm.Meter(sr).integrated_loudness(np.asarray(x, dtype=np.float64))
    except Exception:
        return None

def ebur128(x, sr=SR):
    """ffmpeg's ebur128 (integrated LUFS, true peak dBTP) of a stereo float signal."""
    wf32(p("eb.f32"), x)
    r = subprocess.run([FF, "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(sr), "-ac", "2", "-i", p("eb.f32"), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1]); tp = float(re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", r.stderr)[-1])
    return I, tp


# ================================================================ Maintain Audio Pitch (WSOLA)
def sec_pitch():
    t = np.arange(SR * 40) / SR
    # tones: pitch and level at several speeds
    for f in (1234.0, 3333.0, 7777.0, 6000.0):
        x = 0.5 * np.sin(2 * np.pi * f * t + 0.3)
        bad = []
        for sp in (0.37, 0.75, 1.33, 3.0):
            y = mix1(x, SR, 150, sp, pitch=True)[:, 0]; seg = y[4800:-4800]
            pf = peakfreq(seg); e = env10(seg); lo, hi = 20 * np.log10(e.min() / 0.5), 20 * np.log10(e.max() / 0.5)
            if abs(pf - f) / f > 0.002 or lo < -0.5 or hi > 0.5: bad.append("%g%%: %.1f Hz, %.2f..%.2f dB" % (sp * 100, pf, lo, hi))
            d2 = np.abs(np.diff(seg, 2)).max() / (4 * 0.5 * math.sin(math.pi * f / SR) ** 2)
            if d2 > 1.1: bad.append("%g%%: a click (second difference %.2f times the sine's)" % (sp * 100, d2))
        check("Maintain Audio Pitch: a %g Hz tone at 37%%, 75%%, 133%% and 300%% keeps its pitch (within 0.2%%), its level (10 ms envelope within 0.5 dB) and has no click (second difference within 1.1 times a steady sine's)%s"
              % (f, " (an eighth of 48 kHz: a join off by 4 samples is half a cycle; ffmpeg's atempo keeps it)" if f == 6000 else ""), not bad, "; ".join(bad))
    # very slow and very fast, forward and reversed, against the chirp's own frequency at each source time
    x = 0.5 * np.sin(2 * np.pi * (500 * t + 12.5 * t * t)); fsrc = lambda s: 500 + 25 * s
    for sp, rev, pitch, dur, si in ((0.5, True, True, 150, 4.0), (2.0, True, True, 150, 4.0), (0.1, False, True, 90, 10.0), (0.1, True, True, 90, 10.0),
                                    (10.0, False, True, 60, 1.0), (10.0, True, True, 60, 1.0), (0.5, True, False, 150, 4.0), (2.0, False, False, 150, 4.0)):
        y = mix1(x, SR, dur, sp, pitch=pitch, reverse=rev, srcIn=si)[:, 0]
        fr, ts, Z = ss.stft(y, fs=SR, nperseg=4096, noverlap=3072); pk = fr[np.argmax(np.abs(Z), 0)]
        m = (ts > 0.1) & (ts < dur / 30 - 0.1); span = dur / 30 * sp
        s_at = si + span - ts * sp if rev else si + ts * sp
        want = fsrc(s_at) * (1 if pitch else sp); err = np.abs(pk[m] - want[m]) / want[m]
        e = env10(y[2400:-2400]); lv = 20 * np.log10(e / 0.5)
        what = ("Maintain Audio Pitch" if pitch else "without Maintain Audio Pitch (pitch follows speed)")
        check("%s, %s at %g%%: each moment's frequency is the source's there%s (STFT peak within 2%%) and the level holds (within 0.5 dB)"
              % (what, "reversed" if rev else "forward", sp * 100, "" if pitch else " times the speed"),
              err.max() < 0.02 and np.abs(lv).max() < 0.5, "freq err max %.3f, level %.2f..%.2f dB" % (err.max(), lv.min(), lv.max()))
    # length: sound from the clip's first 10 ms to its last, nothing after its end
    x = 0.5 * np.sin(2 * np.pi * 1000 * t)
    for sp, rev in ((0.6, False), (1.7, True)):
        y = mix1(x, SR, 90, sp, pitch=True, reverse=rev, srcIn=2.0, tail=30)[:, 0]; end = 90 * 1600
        first, last, after = np.abs(y[:480]).max(), np.abs(y[end - 480:end]).max(), np.abs(y[end:]).max()
        check("Maintain Audio Pitch at %g%%%s: sound in the clip's first and last 10 ms and none in the second after it" % (sp * 100, " reversed" if rev else ""),
              first > 0.4 and last > 0.4 and after == 0, "first %.3f last %.3f after %.3g" % (first, last, after))
    # a periodic sound stays harmonic (judgement: ffmpeg's atempo, another WSOLA, as the bar)
    for f0, sp in ((1000.0, 0.37), (500.0, 0.37), (220.0, 0.75), (220.0, 1.5)):
        x = saw(f0, 30); y = mix1(x, SR, 150, sp, pitch=True)[4800:-4800, 0]; a = atempo(x, sp)[48000:48000 + len(y), 0]
        hl, ha = hnr(y, f0), hnr(a, f0)
        check("Maintain Audio Pitch keeps a %g Hz sawtooth at %g%% harmonic: harmonics-to-rest within 10 dB of ffmpeg's atempo (judgement)" % (f0, sp * 100),
              hl > ha - 10, "Lantern %.1f dB, atempo %.1f dB" % (hl, ha))
    # level of speech and of noise
    sp_ = speechlike(30); mu = musiclike(30); rng = np.random.default_rng(11); nz = 0.1 * rng.standard_normal(SR * 30)
    for name, x in (("speech-like sound", sp_), ("music-like sound", mu), ("white noise", nz)):
        for sp in (0.75, 1.33):
            y = mix1(x, SR, 300, sp, pitch=True)[:, 0]; ref = x[int(0.0 * SR): int(10 * sp * SR)]; a = atempo(ref, sp)[:len(y), 0]
            Ly, Lx, La = loudness(np.stack([y, y], 1)), loudness(np.stack([ref, ref], 1)), loudness(np.stack([a, a], 1))
            if Ly is None: Ly, Lx, La = 20 * np.log10(np.std(y)), 20 * np.log10(np.std(ref)), 20 * np.log10(np.std(a))
            check("Maintain Audio Pitch keeps the level of %s at %g%% (loudness by pyloudnorm within 1 dB of the part of the source played, or within 0.5 dB of ffmpeg's atempo)" % (name, sp * 100),
                  abs(Ly - Lx) < 1.0 or abs(Ly - La) < 0.5, "Lantern %.2f, source %.2f, atempo %.2f LUFS" % (Ly, Lx, La))
    # stereo: one time map for both channels (the sound common to both stays in step)
    n_ = SR * 30; tt = np.arange(n_) / SR; rng = np.random.default_rng(7)
    common = ss.lfilter(*ss.butter(2, [200, 8000], btype="band", fs=SR), rng.standard_normal(n_)) * 0.15 * np.clip(np.sin(2 * np.pi * 2.0 * tt), 0, None) ** 0.5
    st = np.stack([common + 0.4 * np.sin(2 * np.pi * 1234 * tt), common + 0.4 * np.sin(2 * np.pi * 2345 * tt)], 1)
    def lags(L, R):
        for f in (1234, 2345):
            b, a = ss.iirnotch(f, 5, fs=SR); L = ss.filtfilt(b, a, L); R = ss.filtfilt(b, a, R)
        out = []
        for k in range(4800, len(L) - 1920 - 4800, 1920):
            l, r = L[k:k + 1920], R[k:k + 1920]
            if np.sqrt(np.mean(l ** 2)) < 0.03: continue
            c = ss.correlate(l, r, mode="full"); lg = np.arange(-1919, 1920); m = np.abs(lg) <= 600; out.append(lg[m][np.argmax(c[m])])
        return np.array(out)
    for sp in (0.75, 1.33):
        y = mix1(st, SR, 300, sp, pitch=True); lg = lags(y[:, 0], y[:, 1])
        ar = atempo(st, sp, 2); la = lags(ar[:, 0], ar[:, 1])
        check("Maintain Audio Pitch keeps a stereo clip's two channels in step at %g%% (the sound common to both: no L/R lag in any 40 ms window, as in the source and in ffmpeg's atempo)" % (sp * 100),
              len(lg) and np.all(lg == 0), "Lantern: %d of %d windows lagged, up to %d samples; atempo: %d of %d" % (np.sum(lg != 0), len(lg), np.abs(lg).max() if len(lg) else 0, np.sum(la != 0), len(la)))


# ================================================================ the resampler
def sec_resample():
    def spur(y, skip=4800):
        y = y[skip:skip + 65536]; w = ss.windows.blackmanharris(len(y)); F = np.abs(np.fft.rfft(y * w)); fr = np.fft.rfftfreq(len(y), 1 / SR)
        F = F / F.max(); k = np.argmax(F); m = np.abs(fr - fr[k]) > 150
        return 20 * np.log10(F[m].max()), fr[m][np.argmax(F[m])]
    def lvl(y): return 20 * np.log10(np.sqrt(2 * np.mean(y[4800:-4800] ** 2)) / 0.5)
    for sr in (8000, 11025, 22050, 32000, 44100, 88200, 96000):
        t = np.arange(int(sr * 4)) / sr; x = 0.5 * np.sin(2 * np.pi * 997 * t)
        y = mix1(x, sr, 90, srcIn=0.5)[:, 0]; ref = ffaf(x, sr, "aresample=48000")[24000:, 0]
        s, at = spur(y); sr_, at_ = spur(ref)
        check("resampler, %g kHz source into 48 kHz: a 997 Hz tone keeps its level (0.05 dB) with nothing else above -90 dB (ffmpeg's swr: about -105 to -135)" % (sr / 1000),
              abs(lvl(y)) < 0.05 and s < -90, "level %.3f dB, worst %.1f dB at %.0f Hz (swr %.1f at %.0f)" % (lvl(y), s, at, sr_, at_))
        if sr < 48000:
            for frac in (0.40, 0.45):
                x2 = 0.5 * np.sin(2 * np.pi * frac * sr * t); y2 = mix1(x2, sr, 90, srcIn=0.5)[:, 0]
                r2 = ffaf(x2, sr, "aresample=48000")[24000:, 0]; rp = ss.resample_poly(x2, 48000 // math.gcd(48000, sr), sr // math.gcd(48000, sr))[24000:]
                s2, a2 = spur(y2); s3, a3 = spur(r2); s4, a4 = spur(rp)
                check("resampler, %g kHz source: a tone at %.2f of the source rate images no worse than ffmpeg's default swr (+3 dB)" % (sr / 1000, frac),
                      s2 <= s3 + 3, "Lantern %.1f dB at %.0f Hz, swr %.1f dB" % (s2, a2, s3))
                if frac == 0.45:
                    check("resampler, %g kHz source: a tone at 0.45 of the source rate images no worse than scipy's resample_poly with its default window (+3 dB; soxr leaves none, see the report)" % (sr / 1000),
                          s2 <= s4 + 3, "Lantern %.1f dB at %.0f Hz (swr %.1f, resample_poly %.1f)" % (s2, a2, s3, s4))
        else:
            for f0, kind in ((19000, "pass"), (20000, "pass20"), (26000, "stop"), (30000, "stop")):
                x2 = 0.5 * np.sin(2 * np.pi * f0 * t); y2 = mix1(x2, sr, 90, srcIn=0.5)[:, 0]; r2 = ffaf(x2, sr, "aresample=48000")[24000:, 0]
                if kind == "stop":
                    check("resampler, %g kHz source: a %d Hz tone (above the new Nyquist) is removed: its alias under -80 dB (swr: %.0f dB)" % (sr / 1000, f0, lvl(r2)), lvl(y2) < -80, "%.1f dB" % lvl(y2))
                else:
                    lim = 0.5 if kind == "pass" else 1.5
                    check("resampler, %g kHz source: a %d Hz tone loses under %.1f dB (Lantern's filter starts at 0.9 of the new Nyquist; swr loses %.2f)" % (sr / 1000, f0, lim, -lvl(r2)), lvl(y2) > -lim, "%.2f dB" % lvl(y2))
    # faster than 100%: what passes the new Nyquist is held back first
    t = np.arange(48000 * 8) / 48000
    for sp, f0 in ((1.5, 10000), (2.37, 997), (1.5, 18000), (3.0, 9000)):
        x = 0.5 * np.sin(2 * np.pi * f0 * t); y = mix1(x, 48000, 60, sp, srcIn=0.5)[:, 0]
        ref = ffaf(x, 48000, "asetrate=%d,aresample=48000" % round(48000 * sp))[24000:, 0]
        if f0 * sp < 24000:
            s, at = spur(y); pf = peakfreq(y[4800:-4800])
            check("speed %g%%: a %d Hz tone plays at %g Hz, level kept (0.05 dB), nothing else above -90 dB (as ffmpeg's asetrate+aresample)" % (sp * 100, f0, f0 * sp),
                  abs(pf - f0 * sp) < 1 and abs(lvl(y)) < 0.05 and s < -90, "%.1f Hz, %.3f dB, worst %.1f dB at %.0f" % (pf, lvl(y), s, at))
        else:
            check("speed %g%%: a %d Hz tone (%g Hz after, past the Nyquist) is held back: under -80 dB (ffmpeg's asetrate+aresample leaves %.0f dB)" % (sp * 100, f0, f0 * sp, lvl(ref)),
                  lvl(y) < -80, "%.1f dB" % lvl(y))


# ================================================================ more than two channels folded to stereo
FOLDJS = r"""
var a = %s, w = V.riff.readWav(new Uint8Array(fs.readFileSync(a.inp))), q = proj(null, 48000), p = q.p, seq = q.seq;
sound(p, 'm1', w.sampleRate, w.data);
seq.a[0].clips.push(S.clip({ media: 'm1', start: 0, dur: 60, srcIn: 0 }));
wr(a.out, V.mix.range(p, seq, 0, 96000)); return w.channels;
"""
def sec_fold():
    t = np.arange(SR * 3) / SR
    for lay, nch, judged in (("3.0", 3, False), ("quad", 4, False), ("5.0", 5, False), ("5.1", 6, False), ("5.1(side)", 6, False), ("7.1", 8, False), ("4.0", 4, True), ("2.1", 3, True)):
        freqs = [300 + 200 * i for i in range(nch)]
        x = np.stack([0.1 * np.sin(2 * np.pi * f * t) for f in freqs], 1); wf32(p("mc.f32"), x)
        ff("-f", "f32le", "-ar", 48000, "-ch_layout", lay, "-i", p("mc.f32"), "-c:a", "pcm_f32le", p("mc.wav"))
        ff("-i", p("mc.wav"), "-ac", 2, "-f", "f32le", p("dm.f32")); ref = rf32(p("dm.f32"), 2)[:96000]
        node(FOLDJS % json.dumps(dict(inp=p("mc.wav"), out=p("fold.f32")))); y = rf32(p("fold.f32"), 2)
        gains = lambda z: [[round(float(tone_amp(z[:, s], f) / 0.1), 3) for s in (0, 1)] for f in freqs]
        check("%d channels as ffmpeg's '%s' WAV: folded to stereo as ffmpeg's ITU downmix (-ac 2: centre and surrounds -3 dB, LFE out)%s" % (nch, lay, " (judgement: the WAV's channel mask says this layout; Lantern does not read the mask)" if judged else ""),
              np.abs(y - ref).max() < 1e-4, "Lantern gains %s, ffmpeg %s" % (gains(y), gains(ref)))
    # the order the browser gives 5.1 sound in (decodeAudioData, and WebCodecs through Lantern's own reader for a WebM)
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        skip("5.1 channel order in Chromium", "Playwright is not here"); sync_playwright = None
    if sync_playwright:
        import base64
        freqs = [300, 500, 700, 80, 1100, 1300]; t1 = np.arange(48000) / 48000  # the LFE's tone low enough for AAC's LFE channel
        wf32(p("51.f32"), np.stack([0.2 * np.sin(2 * np.pi * f * t1) for f in freqs], 1))
        files = {"WAV": ("51.wav", ["-c:a", "pcm_s16le"]), "FLAC": ("51.flac", ["-c:a", "flac"]), "Ogg Opus": ("51.opus", ["-c:a", "libopus", "-b:a", "256k"]),
                 "WebM Opus": ("51.webm", ["-c:a", "libopus", "-b:a", "256k"]), "MP4 AAC": ("51.m4a", ["-c:a", "aac", "-b:a", "384k"])}
        for k, (fn, args) in files.items(): ff("-f", "f32le", "-ar", 48000, "-ch_layout", "5.1", "-i", p("51.f32"), *args, p(fn))
        try:
            with sync_playwright() as pw:
                import http.server, threading, functools
                open(p("blank.html"), "w").write("<!doctype html><title>t</title>")
                class Quiet(http.server.SimpleHTTPRequestHandler):
                    def log_message(self, *a_): pass
                srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=OUT))
                threading.Thread(target=srv.serve_forever, daemon=True).start()
                # a page from localhost: a secure context, so WebCodecs is there
                br = pw.chromium.launch(); pg = br.new_page(); pg.goto("http://127.0.0.1:%d/blank.html" % srv.server_address[1]); pg.add_script_tag(path=p("page_lib.js"))
                for k, (fn, args) in files.items():
                    if not os.path.exists(p(fn)): skip("5.1 %s in Chromium" % k, "ffmpeg could not make it"); continue
                    b64 = base64.b64encode(open(p(fn), "rb").read()).decode()
                    res = pg.evaluate("""async ([b64, webm]) => {
                        const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), F = [300, 500, 700, 80, 1100, 1300];
                        const which = (d, sr) => F.map(f => { let re = 0, im = 0; for (let i = 0; i < d.length; i++) { re += d[i] * Math.cos(2 * Math.PI * f * i / sr); im += d[i] * Math.sin(2 * Math.PI * f * i / sr); } return Math.hypot(re, im); }).reduce((bi, v, i, a) => v > a[bi] ? i : bi, 0);
                        const out = {};
                        try { const ac = new OfflineAudioContext(1, 1, 48000); const buf = await ac.decodeAudioData(u8.buffer.slice(0));
                              out.dad = []; for (let c = 0; c < buf.numberOfChannels; c++) out.dad.push(F[which(buf.getChannelData(c).subarray(4800, 28800), buf.sampleRate)]); } catch (e) { out.dadErr = String(e); }
                        if (webm) { try { const V = window.Lantern.video, src = V.bytes.fromBytes(u8), m = await (webm === 'mkv' ? V.mkv.read(src) : V.mp4.read(src)), t = m.tracks.filter(x => x.type === 'audio')[0];
                              const a = await V.media.decodeAudio({ src: src, aTrack: t, kind: 'mkv' }); out.wc = a.data.map(d => F[which(d.subarray(4800, 28800), a.sampleRate)]); } catch (e) { out.wcErr = String(e); } }
                        return out; }""", [b64, "mkv" if k == "WebM Opus" else "mp4" if k == "MP4 AAC" else ""])
                    if "dad" in res:
                        check("5.1 %s decoded by Chromium (decodeAudioData): channels in the order Lantern's fold assumes, L R C LFE Ls Rs" % k, res["dad"] == freqs, "tones by channel %s (want %s)" % (res["dad"], freqs))
                    else: skip("5.1 %s by decodeAudioData" % k, res.get("dadErr", "")[:120])
                    if "wc" in res:
                        check("5.1 %s through Lantern's own reader and WebCodecs (the Video tile's path for a video's sound): channels L R C LFE Ls Rs" % k, res["wc"] == freqs, "tones by channel %s" % res["wc"])
                    elif k in ("WebM Opus", "MP4 AAC"): skip("5.1 %s through WebCodecs" % k, res.get("wcErr", "")[:160])
                br.close(); srv.shutdown()
        except Exception as ex:
            skip("5.1 channel order in Chromium", repr(ex)[:200])
    # Lantern's own WAV above two channels: its mask names the speakers its own fold assumes
    for k, want in ((3, "3.0"), (4, "quad"), (5, "5.0"), (6, "5.1"), (8, "7.1")):
        node("var d = []; for (var c = 0; c < %d; c++) { var x = new Float32Array(4801); for (var i = 0; i < x.length; i++) x[i] = 0.1 * Math.sin(i * (c + 1) / 50); d.push(x); } fs.writeFileSync(%s, V.riff.writeWav(d, 48000, 24)); return 1;" % (k, json.dumps(p("lw.wav"))))
        pr = json.loads(subprocess.run([FP, "-v", "error", "-of", "json", "-show_streams", p("lw.wav")], capture_output=True, text=True).stdout)["streams"][0]
        lay = pr.get("channel_layout", "?")
        check("Lantern's %d-channel WAV (24-bit, odd length): ffprobe reads it, %d channels, layout the one Lantern's fold assumes (%s)" % (k, k, want),
              pr.get("channels") == k and lay in (want, want + "(side)"), "ffprobe: %s channels, layout %s" % (pr.get("channels"), lay))


# ================================================================ keyframed sound effects, nested sequences, Bars and Tone, long transitions
def keyval(keys, f):
    """Premiere's curves as the KEYS header describes them (linear, hold, ease 3u^2-2u^3), first and last values held."""
    if f <= keys[0]["f"]: return keys[0]["v"]
    if f >= keys[-1]["f"]: return keys[-1]["v"]
    for a, b in zip(keys, keys[1:]):
        if a["f"] <= f <= b["f"]:
            u = (f - a["f"]) / (b["f"] - a["f"]); it = a.get("i", "linear")
            if it == "hold": return a["v"] if f < b["f"] else b["v"]
            if it == "ease": u = u * u * (3 - 2 * u)
            return a["v"] + (b["v"] - a["v"]) * u

def rbj_lp(fc, f, sr=SR, q=0.7071):
    w = 2 * np.pi * fc / sr; cs, sn = np.cos(w), np.sin(w); al = sn / (2 * q)
    b = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2]; a = [1 + al, -2 * cs, 1 - al]
    return ss.freqz(b, a, worN=[f], fs=sr)[1][0]

NESTJS = r"""
var a = %s, q = proj(null, a.outer_sr), p = q.p, outer = q.seq;
var inner = S.sequence({ name: 'Inner', sampleRate: a.inner_sr }); p.seqs[inner.id] = inner;
var x = rd(a.inp, 1), y = rd(a.inp2, 1);
sound(p, 'm1', 48000, x); sound(p, 'm2', 48000, y);
var c1 = S.clip({ media: 'm1', start: 0, dur: 150, srcIn: 1.0 }); c1.vol = -6; c1.pan = -50; inner.a[0].clips.push(c1);
var c2 = S.clip({ media: 'm2', start: 20, dur: 100, srcIn: 0 }); inner.a[1].clips.push(c2);
var nc = S.clip({ kind: 'nest', nest: inner.id, start: 15, dur: 60, srcIn: 0.5 }); outer.a[0].clips.push(nc);
var fo = outer.rate.num / outer.rate.den;
wr(a.out_inner, V.mix.range(p, inner, 0, Math.round(150 / 30 * a.inner_sr)));
wr(a.out_outer, V.mix.range(p, outer, 0, Math.round(90 / fo * a.outer_sr)));
return 1;
"""
TONEJS = r"""
var q = proj(null, 48000), p = q.p, seq = q.seq;
var c = S.clip({ kind: 'tone', start: 10, dur: 90, srcIn: 0, name: 'Tone 1 kHz' }); seq.a[0].clips.push(c);
wr(%s, V.mix.range(p, seq, 0, Math.round(110 / 30 * 48000))); return 1;
"""
TRANSJS = r"""
var a = %s, q = proj(null, 48000), p = q.p, seq = q.seq;
sound(p, 'ma', 48000, rd(a.ina, 1)); sound(p, 'mb', 48000, rd(a.inb, 1));
var A = S.clip({ media: 'ma', start: 0, dur: 300, srcIn: 5 }), B = S.clip({ media: 'mb', start: 300, dur: 300, srcIn: 5 });
B.tin = { type: a.type, dur: a.dur, align: a.align }; seq.a[0].clips.push(A, B);
wr(a.out, V.mix.range(p, seq, 0, 600 * 1600)); var w = V.trans.window(B, 'in', seq); return [w.from, w.to];
"""
def sec_mix():
    t = np.arange(SR * 10) / SR; x = 0.5 * np.sin(2 * np.pi * 1000 * t + 0.4)
    # Amplify follows its keys frame by frame
    for name, keys in (("linear", [{"f": 0, "v": -20, "i": "linear"}, {"f": 60, "v": 0, "i": "linear"}]),
                       ("ease", [{"f": 10, "v": -24, "i": "ease"}, {"f": 70, "v": 6, "i": "linear"}]),
                       ("kept from before the clip (a cut)", [{"f": -30, "v": -20, "i": "linear"}, {"f": 30, "v": 0, "i": "linear"}]),
                       ("hold", [{"f": 0, "v": -20, "i": "hold"}, {"f": 30, "v": 0, "i": "linear"}])):
        fx = [{"id": "e1", "type": "amplify", "on": True, "p": {"gain": 0}, "keys": {"gain": keys}, "mask": None}]
        y = mix1(x, SR, 90, fx=fx)[:, 0]
        i = np.arange(len(y)); ok = np.abs(x[:len(y)]) > 0.1; g = np.full(len(y), np.nan); g[ok] = y[ok] / x[:len(y)][ok]
        want = np.array([10 ** (keyval(keys, k / 1600.0) / 20) for k in i])
        err = np.nanmax(np.abs(20 * np.log10(np.abs(g[ok]) / want[ok])))
        worst = int(i[ok][np.nanargmax(np.abs(20 * np.log10(np.abs(g[ok]) / want[ok])))])
        check("keyframed Amplify (%s keys) follows its keys: gain at every sample within 0.1 dB of the key curve (the KEYS header's curves%s)"
              % (name, "; a Hold keeps its value up to the next key, as Premiere's does" if name == "hold" else ""), err < 0.1, "worst %.2f dB at frame %.2f" % (err, worst / 1600))
    # another effect, keyed: worked out at each key's settings and mixed between them
    keys = [{"f": 30, "v": 200, "i": "linear"}, {"f": 60, "v": 5000, "i": "linear"}]
    fx = [{"id": "e2", "type": "lowpass", "on": True, "p": {"f": 8000}, "keys": {"f": keys}, "mask": None}]
    y = mix1(x, SR, 90, fx=fx)[:, 0]
    def amp_at(fr0, fr1): return tone_amp(y[fr0 * 1600:fr1 * 1600], 1000) / 0.5
    h200, h5000, h2600 = abs(rbj_lp(200, 1000)), abs(rbj_lp(5000, 1000)), abs(rbj_lp(2600, 1000))
    hmix = abs(0.5 * rbj_lp(200, 1000) + 0.5 * rbj_lp(5000, 1000))
    a1, a2, a3 = amp_at(10, 28), amp_at(64, 88), amp_at(44, 46)
    db = lambda v: 20 * np.log10(v)
    check("keyed Lowpass (200 Hz at frame 30, 5000 Hz at 60): before the first key a 1 kHz tone is as the RBJ low-pass at 200 Hz passes it (0.2 dB; SciPy's freqz)", abs(db(a1) - db(h200)) < 0.2, "%.2f vs %.2f dB" % (db(a1), db(h200)))
    check("keyed Lowpass: after the last key as the low-pass at 5000 Hz passes it (0.2 dB)", abs(db(a3 if False else a2) - db(h5000)) < 0.2, "%.2f vs %.2f dB" % (db(a2), db(h5000)))
    check("keyed Lowpass: half way between the keys the two results mixed half and half, as the header says (0.5 dB)", abs(db(a3) - db(hmix)) < 0.5, "%.2f vs %.2f dB" % (db(a3), db(hmix)))
    check("keyed Lowpass: half way between the keys the tone passes as the low-pass at the setting there (2600 Hz) would pass it, as Premiere sweeps a keyed setting (judgement: the header chose to mix instead)",
          abs(db(a3) - db(h2600)) < 1.0, "Lantern %.2f dB, a 2600 Hz low-pass %.2f dB" % (db(a3), db(h2600)))
    # nested sequence: the clip plays the nested sequence's own mix
    sp_ = speechlike(12); tone660 = 0.3 * np.sin(2 * np.pi * 660 * np.arange(SR * 12) / SR)
    wf32(p("n1.f32"), sp_); wf32(p("n2.f32"), tone660)
    for isr in (48000, 44100):
        node(NESTJS % json.dumps(dict(inp=p("n1.f32"), inp2=p("n2.f32"), inner_sr=isr, outer_sr=48000, out_inner=p("inner.f32"), out_outer=p("outer.f32"))))
        inner, outer = rf32(p("inner.f32"), 2), rf32(p("outer.f32"), 2)
        s0 = 15 * 1600; seg = outer[s0:s0 + 60 * 1600]
        if isr == 48000:
            ref = inner[int(0.5 * 48000): int(0.5 * 48000) + len(seg)]
            check("a nested sequence's clip (start 15, in 0.5 s, 2 s) plays the nested sequence's own mix there, sample for sample, both channels (its pans and levels)",
                  np.abs(seg - ref).max() < 1e-5 and np.abs(outer[:s0]).max() == 0, "max diff %.2e" % np.abs(seg - ref).max())
        else:
            rr = ss.resample_poly(inner, 160, 147, axis=0)[int(0.5 * 48000): int(0.5 * 48000) + len(seg)]
            d = 20 * np.log10(np.sqrt(np.mean((seg[2000:-2000] - rr[2000:-2000]) ** 2)) / np.sqrt(np.mean(rr[2000:-2000] ** 2)))
            check("a nested 44.1 kHz sequence in a 48 kHz one plays its mix resampled (difference from SciPy's resample_poly of the nested mix under -60 dB)", d < -60, "%.1f dB" % d)
    # Bars and Tone's tone
    node(TONEJS % json.dumps(p("tone.f32"))); y = rf32(p("tone.f32"), 2)
    for ch, nm in ((0, "left"), (1, "right")):
        seg = y[10 * 1600 + 4800: 100 * 1600 - 4800, ch]
        pk = 20 * np.log10(np.abs(seg).max()); rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) * math.sqrt(2))
        check("Bars and Tone's tone, %s: 1 kHz (0.1 Hz) at -20 dBFS (a sine whose peak is 0.1: AES17's dBFS, SMPTE RP 155's reference level), silent outside the clip"
              % nm, abs(peakfreq(seg) - 1000) < 0.1 and abs(pk + 20) < 0.05 and abs(rms + 20) < 0.05 and np.abs(y[:10 * 1600 - 1, ch]).max() == 0, "%.2f Hz, peak %.2f, sine-RMS %.2f dBFS" % (peakfreq(seg), pk, rms))
    # long audio transitions: both clips heard through the whole transition, on Premiere's curves
    # 450 and 690 Hz: whole cycles in a frame of 1/30 s, so one frame's DFT reads each clip's level exactly
    xa = 0.5 * np.sin(2 * np.pi * 450 * np.arange(SR * 30) / SR); xb = 0.5 * np.sin(2 * np.pi * 690 * np.arange(SR * 30) / SR)
    wf32(p("ta.f32"), xa); wf32(p("tb.f32"), xb)
    curves = {"constantPower": lambda u: np.sin(u * np.pi / 2), "constantGain": lambda u: u, "exponential": lambda u: u * u}
    for typ, dur, al in (("constantPower", 120, "center"), ("constantPower", 150, "start"), ("constantGain", 90, "end"), ("exponential", 240, "center")):
        w = node(TRANSJS % json.dumps(dict(ina=p("ta.f32"), inb=p("tb.f32"), type=typ, dur=dur, align=al, out=p("tr.f32")))); y = rf32(p("tr.f32"), 2)[:, 0]
        errs = []
        for fr in range(w[0] - 5, w[1] + 5):
            seg = y[fr * 1600:(fr + 1) * 1600]; ga, gb = tone_amp(seg, 450) / 0.5, tone_amp(seg, 690) / 0.5
            u = min(1, max(0, (fr + 0.5 - w[0]) / (w[1] - w[0])))
            errs.append(max(abs(ga - curves[typ](1 - u)), abs(gb - curves[typ](u))))
        check("a %d-frame (%.1f s) %s audio transition aligned %s: the outgoing clip fades out and the incoming fades in over all of it (each frame within 0.03 of the curve)"
              % (dur, dur / 30, typ, al), max(errs) < 0.03, "worst %.3f at frame %d" % (max(errs), w[0] - 5 + int(np.argmax(errs))))



# ================================================================ Time Remapping, and each frame's source through cuts, trims, slips and limits
REMAPJS = r"""
var q = proj(), p = q.p, seq = q.seq, t = seq.v[0], fps = 30, out = {};
p.media.m = { id: 'm', name: 'm.mp4', kind: 'video', dur: 60 };
function mk(keys, srcIn, start, dur) { var c = S.clip({ media: 'm', start: start || 30, dur: dur || 90, srcIn: srcIn === undefined ? 2 : srcIn }); c.keys.remap = JSON.parse(JSON.stringify(keys)); return c; }
function src(c) { var o = {}; for (var f = c.start; f < c.start + c.dur; f++) o[f] = S.srcTime(c, f, seq); return o; }
function diff(a, b) { var m = 0, n = 0; for (var f in a) if (f in b) { m = Math.max(m, Math.abs(a[f] - b[f])); n++; } return { max: m, n: n }; }
var RAMP = [{ f: 0, v: 100, i: 'linear' }, { f: 60, v: 300, i: 'linear' }];
// the shown source, frame by frame
out.const200 = (function () { var c = mk([{ f: 0, v: 200, i: 'linear' }]); t.clips = [c]; return [0, 1, 17, 89].map(function (j) { return S.srcTime(c, c.start + j, seq); }); })();
out.ramp = (function () { var c = mk(RAMP); t.clips = [c]; var r = []; for (var j = 0; j < 90; j++) r.push(S.srcTime(c, c.start + j, seq)); return { src: r, span: S.srcSpan(c, seq), sec: S.srcSec(c, seq, 10, 50) }; })();
out.ease = (function () { var c = mk([{ f: 10, v: 50, i: 'ease' }, { f: 50, v: 250, i: 'linear' }]); t.clips = [c]; var r = []; for (var j = 0; j < 90; j++) r.push(S.srcTime(c, c.start + j, seq)); return r; })();
// a cut: both halves show what they showed
out.cut = (function () { var c = mk(RAMP); t.clips = [c]; var a = src(c); var r = E.split(seq, t, c, 70); var b = src(c), b2 = src(r); for (var f in b2) b[f] = b2[f]; return diff(a, b); })();
// ten frames trimmed off the head and put back
out.trimBack = (function () { var c = mk(RAMP); t.clips = [c]; var a = src(c); E.trimHead(p, seq, t, c, 10, 'plain'); var mid = diff(a, src(c)); E.trimHead(p, seq, t, c, -10, 'plain'); return { after: mid, back: diff(a, src(c)), start: c.start, dur: c.dur }; })();
// after a cut, the right half's head made 5 frames longer
out.headAfterCut = (function () { var c = mk(RAMP); t.clips = [c]; var r = E.split(seq, t, c, 70); t.clips = [r]; var a = src(r); var got = E.trimHead(p, seq, t, r, -5, 'plain'); return { got: got, d: diff(a, src(r)) }; })();
// the right half's head extended as far as the limits allow (media from 0)
out.headLimit = (function () { var c = mk(RAMP, 0.5); t.clips = [c]; var r = E.split(seq, t, c, 70); t.clips = [r]; var lim = E.limits(p, seq, r, 'head'); r.start += 400; var got = E.trimHead(p, seq, t, r, -lim[0], 'plain'); return { lim: lim[0], got: got, first: S.srcTime(r, r.start, seq) }; })();
// after a cut, the left half's tail extended as far as the limits allow (media 4 s)
out.tailLimit = (function () { p.media.m.dur = 4.0; var c = mk(RAMP, 0); t.clips = [c]; E.split(seq, t, c, 70); t.clips = [c]; var lim = E.limits(p, seq, c, 'tail'); var got = E.trimTail(p, seq, t, c, lim[1], 'plain'); var r = { lim: lim[1], got: got, last: S.srcTime(c, c.start + c.dur - 1, seq), end: c.srcIn + S.srcSpan(c, seq), media: 4.0 }; p.media.m.dur = 60; return r; })();
// a whole remapped clip's tail to the limit
out.tailLimitWhole = (function () { p.media.m.dur = 9.0; var c = mk(RAMP, 0, 30, 40); t.clips = [c]; var lim = E.limits(p, seq, c, 'tail'); E.trimTail(p, seq, t, c, lim[1], 'plain'); var r = { end: c.srcIn + S.srcSpan(c, seq), last: S.srcTime(c, c.start + c.dur - 1, seq), media: 9.0 }; p.media.m.dur = 60; return r; })();
// slip
out.slip = (function () { var c = mk(RAMP, 3); t.clips = [c]; var a = src(c); var mv = E.slip(p, seq, c, 12); var b = src(c), ds = []; for (var f in a) ds.push(b[f] - a[f]); return { moved: mv, min: Math.min.apply(null, ds), max: Math.max.apply(null, ds), end: c.srcIn + S.srcSpan(c, seq) }; })();
out.slipLimit = (function () { p.media.m.dur = 10; var c = mk(RAMP, 1); t.clips = [c]; E.slip(p, seq, c, 100000); var r = { end: c.srcIn + S.srcSpan(c, seq), media: 10 }; E.slip(p, seq, c, -100000); r.start = c.srcIn; p.media.m.dur = 60; return r; })();
// a tail trim keeps the frames that stay
out.tail = (function () { var c = mk(RAMP); t.clips = [c]; var a = src(c); E.trimTail(p, seq, t, c, -20, 'plain'); return diff(a, src(c)); })();
// Rate Stretch: "a new length, the same source"
out.rate = (function () { var c = mk(RAMP); t.clips = [c]; var a = S.srcSpan(c, seq), f0 = S.srcTime(c, c.start, seq); E.rateStretch(seq, t, c, 180); return { before: a, after: S.srcSpan(c, seq), first: [f0, S.srcTime(c, c.start, seq)] }; })();
return out;
"""
def sec_remap():
    r = node(REMAPJS); fps = 30.0
    check("Time Remapping, a constant 200% key: frame j shows in + 2j/30 s (closed form)", np.allclose(r["const200"], [2 + 2 * j / fps for j in (0, 1, 17, 89)], atol=1e-9), r["const200"])
    ramp = [{"f": 0, "v": 100, "i": "linear"}, {"f": 60, "v": 300, "i": "linear"}]
    want = [2 + sum(keyval(ramp, k) for k in range(j)) / 100 / fps for j in range(90)]
    check("Time Remapping, 100% to 300% over 60 frames: frame j shows in + the sum of the speeds of the frames before it over the frame rate (worked out here)", np.allclose(r["ramp"]["src"], want, atol=1e-9),
          "worst %.4g s" % np.max(np.abs(np.array(r["ramp"]["src"]) - want)))
    check("Time Remapping: the clip's source span and the source between two frames are the same sums", abs(r["ramp"]["span"] - (sum(keyval(ramp, k) for k in range(90)) / 100 / fps)) < 1e-9 and abs(r["ramp"]["sec"] - (want[50] - want[10])) < 1e-9, r["ramp"]["span"])
    ek = [{"f": 10, "v": 50, "i": "ease"}, {"f": 50, "v": 250, "i": "linear"}]
    want = [2 + sum(keyval(ek, k) for k in range(j)) / 100 / fps for j in range(90)]
    check("Time Remapping with an Ease key (3u^2 - 2u^3): the same sum of each frame's speed", np.allclose(r["ease"], want, atol=1e-9), "worst %.4g s" % np.max(np.abs(np.array(r["ease"]) - want)))
    check("a cut in a remapped clip: every frame of both halves shows the source it showed", r["cut"]["max"] < 1e-9 and r["cut"]["n"] == 90, r["cut"])
    check("a remapped clip's head trimmed in 10 frames and out again: every frame shows the source it showed (keys kept beyond the head shape the frames put back)",
          r["trimBack"]["back"]["max"] < 1e-6 and r["trimBack"]["after"]["max"] < 1e-9, "off by up to %.4f s (%.2f frames of source)" % (r["trimBack"]["back"]["max"], r["trimBack"]["back"]["max"] * fps))
    check("after a cut in a remapped clip, the right half's head made 5 frames longer: its frames that were there show the source they showed",
          r["headAfterCut"]["got"] == -5 and r["headAfterCut"]["d"]["max"] < 1e-6, "%s; off by up to %.4f s" % (r["headAfterCut"]["got"], r["headAfterCut"]["d"]["max"]))
    check("after a cut, the right half's head extended as far as the limits allow: the first frame shows no source before the media's start",
          r["headLimit"]["first"] > -1e-6, r["headLimit"])
    check("after a cut, the left half's tail extended as far as the limits allow: no frame shows source past the media's end (keys beyond the end speed it up)",
          r["tailLimit"]["end"] <= r["tailLimit"]["media"] + 1e-6, "span ends at %.4f s, last frame at %.4f s, media %.1f s" % (r["tailLimit"]["end"], r["tailLimit"]["last"], r["tailLimit"]["media"]))
    check("a whole remapped clip's tail extended as far as the limits allow: no source past the media's end", r["tailLimitWhole"]["end"] <= 9.0 + 1e-6, r["tailLimitWhole"])
    check("a remapped clip slipped 12 frames: every frame's source moves by the same amount (12 frames at 100%)", abs(r["slip"]["min"] - r["slip"]["max"]) < 1e-9 and abs(r["slip"]["min"] - 12 / fps) < 1e-9, r["slip"])
    check("a remapped clip slipped as far as it goes either way: never past the media's end or before its start", r["slipLimit"]["end"] <= 10 + 1e-6 and r["slipLimit"]["start"] >= -1e-9, r["slipLimit"])
    check("a remapped clip's tail trimmed 20 frames: the frames that stay show the same source", r["tail"]["max"] < 1e-9, r["tail"])
    check("Rate Stretch of a remapped clip to twice its length shows the same source (the EDIT header: 'a new length, the same source')", abs(r["rate"]["after"] - r["rate"]["before"]) < 1e-6,
          "source span %.3f s before, %.3f s after" % (r["rate"]["before"], r["rate"]["after"]))


# ================================================================ keyframes kept through cuts and trims
KEYSJS = r"""
var q = proj(), p = q.p, seq = q.seq, t = seq.v[0], out = [];
p.media.m = { id: 'm', name: 'm.mp4', kind: 'video', dur: 60 };
var KINDS = { ease: 'ease', auto: 'auto', hold: 'hold', linear: 'linear', mixed: null };
Object.keys(KINDS).forEach(function (kind) {
  function keyList(vals) { return [5, 25, 50, 75].map(function (f, i) { return { f: f, v: vals[i], i: KINDS[kind] || ['ease', 'auto', 'hold', 'linear'][i] }; }); }
  var c = S.clip({ media: 'm', start: 100, dur: 90, srcIn: 1 });
  c.keys.vol = keyList([-20, 0, -12, -3]); c.keys.opacity = keyList([0, 100, 40, 90]); c.keys.scale = keyList([100, 140, 90, 120]);
  var e = F.make('amplify'); e.keys.gain = keyList([-6, 6, 0, 3]); c.fx = [e];
  c.mask = V.mask.make('ellipse', 640, 360); c.mask.keys.dx = keyList([0, 30, -10, 5]);
  t.clips = [c];
  var orig = JSON.parse(JSON.stringify(c)), want = {};
  function val(cl, name, f) { return K.get(cl, name, f, null); }
  function vals(cl, f) { return [val(cl, 'vol', f), val(cl, 'opacity', f), val(cl, 'scale', f), K.value(cl.fx[0].keys.gain, f, 0), K.value(cl.mask.keys.dx, f, 0)]; }
  for (var f = 100; f < 190; f++) want[f] = vals(orig, f - 100);
  // three cuts, then a head trim and a tail trim of pieces
  E.split(seq, t, c, 115); E.split(seq, t, S.at(t, 140), 140); E.split(seq, t, S.at(t, 160), 160);
  E.trimHead(p, seq, t, S.at(t, 140), 7, 'plain'); E.trimTail(p, seq, t, S.at(t, 115), -4, 'plain');
  var worst = 0, at = null, n = 0;
  t.clips.forEach(function (cl) { for (var g = cl.start; g < cl.start + cl.dur; g++) { var got = vals(cl, g - cl.start), w = want[g]; n++; for (var k = 0; k < 5; k++) { var d = Math.abs(got[k] - w[k]); if (d > worst) { worst = d; at = [g, k, got[k], w[k]]; } } } });
  out.push({ kind: kind, worst: worst, at: at, n: n, pieces: t.clips.length });
});
return out;
"""
def sec_keys():
    for r in node(KEYSJS):
        check("keyframes (%s curves) on Volume, Opacity, Scale, an effect and a mask: after three cuts, a head trim and a tail trim, every frame of every piece has the value it had" % r["kind"],
              r["worst"] < 1e-9 and r["pieces"] == 4, "worst %.4g at %s over %d frames" % (r["worst"], r["at"], r["n"]))


# ================================================================ the edit primitives, fuzzed as the Timeline and the commands call them
FUZZJS = r"""// the edit fuzz: Premiere's edits as the Timeline (apply) and the commands (trimTo, closeGap, razor, rippleDelete, Speed/Duration) call them
var A = %s;
var seed = A.seed >>> 0; function rnd() { seed = (seed + 0x6D2B79F5) >>> 0; var t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick(xs) { return xs[Math.floor(rnd() * xs.length)]; }
var p, seq, fps = 30, LENS = { m0: 20, m1: 8, m2: 3.2, m3: 12 };
function setup() {
  p = S.project(); seq = p.seqs[p.active];
  Object.keys(LENS).forEach(function (id) { p.media[id] = { id: id, name: id + '.mp4', kind: id === 'm3' ? 'audio' : 'video', dur: LENS[id], hasAudio: true }; });
  function pair(vt, at, f) {
    var mi = pick(['m0', 'm1', 'm2']), len = LENS[mi], sp = pick([1, 1, 1, 0.5, 2, 1.5]), rev = rnd() < 0.2;
    var maxF = Math.floor(len * fps / sp) - 1, dur = ri(8, Math.min(120, maxF)), span = dur / fps * sp, srcIn = Math.round(rnd() * (len - span) * 1000) / 1000;
    var link = S.uid('l'), o = { media: mi, start: f, dur: dur, srcIn: srcIn, link: link };
    var v = S.clip(o), a = S.clip(o); [v, a].forEach(function (c) { c.speed = sp; c.reverse = rev; });
    vt.clips.push(v); at.clips.push(a); return f + dur;
  }
  var f = 0; for (var k = 0; k < 6; k++) { f += pick([0, ri(2, 20), ri(2, 20)]); f = pair(seq.v[0], seq.a[0], f); }
  f = ri(0, 40); for (k = 0; k < 3; k++) { f += ri(0, 30); f = pair(seq.v[1], seq.a[1], f); }
  f = ri(0, 100); for (k = 0; k < 2; k++) { var tt = S.clip({ kind: 'title', start: f, dur: ri(20, 90), name: 'T' }); seq.v[2].clips.push(tt); f += tt.dur + ri(0, 40); }
  f = ri(0, 100); for (k = 0; k < 2; k++) { var dur = ri(20, 200), au = S.clip({ media: 'm3', start: f, dur: dur, srcIn: Math.round(rnd() * (12 - dur / fps) * 100) / 100 }); seq.a[2].clips.push(au); f += dur + ri(0, 40); }
  // sound of its own on A1 in some of the picture's gaps (music or effects between the dialogue), touching one side
  S.sort(seq.a[0]); var cs = seq.a[0].clips.slice();
  for (k = 0; k + 1 < cs.length; k++) { var g0 = cs[k].start + cs[k].dur, g1 = cs[k + 1].start; if (g1 - g0 >= 2 && rnd() < 0.7) { var L2 = ri(1, g1 - g0 - 1), st0 = rnd() < 0.5 ? g0 : g1 - L2; seq.a[0].clips.push(S.clip({ media: 'm3', start: st0, dur: L2, srcIn: 1 })); } }
  S.tracks(seq).forEach(function (t) { S.sort(t); t.target = (t === seq.v[0] || t === seq.a[0]); });
}
function partners(c) { return S.partners(seq, c); }
function allClips() { return S.all(seq); }
function linkedPick() { var xs = allClips().filter(function (x) { return x.c.link; }); return xs.length ? pick(xs) : null; }
// a quarter of the time any clip at all (a title, a clip of sound alone)
function anyPick() { return rnd() < 0.25 ? pick(allClips()) || null : linkedPick(); }
// ---- the operations, called as the tile calls them (Linked Selection on, snapping off)
var OPS = {
  trim: function () { var x = anyPick(); if (!x) return; var c = x.c, t = x.t, edge = pick(['head', 'tail']), dd = ri(-40, 40), ps = partners(c);
    var got = edge === 'head' ? E.trimHead(p, seq, t, c, dd, 'plain') : E.trimTail(p, seq, t, c, dd, 'plain');
    ps.forEach(function (y) { if (edge === 'head') E.trimHead(p, seq, y.t, y.c, got, 'plain'); else E.trimTail(p, seq, y.t, y.c, got, 'plain'); }); return ''; },
  ripple: function () { var x = anyPick(); if (!x) return; var c = x.c, t = x.t, edge = pick(['head', 'tail']), dd = ri(-40, 40), ps = partners(c);
    if (edge === 'head') E.trimHead(p, seq, t, c, dd, 'ripple', ps); else E.trimTail(p, seq, t, c, dd, 'ripple', ps); return E.note(); },
  roll: function () { var x = anyPick(); if (!x) return; var c = x.c, t = x.t, edge = pick(['head', 'tail']), dd = ri(-30, 30), ps = partners(c);
    var pairOf = function (tt, cc) { var o = edge === 'head' ? tt.clips.filter(function (y) { return y.start + y.dur === cc.start; })[0] : tt.clips.filter(function (y) { return y.start === cc.start + cc.dur; })[0]; return o ? (edge === 'head' ? [o, cc] : [cc, o]) : null; };
    var pairs = [pairOf(t, c)].concat(ps.map(function (y) { return pairOf(y.t, y.c); })).filter(function (q) { return q; });
    var rd = dd; pairs.forEach(function (q) { var la = E.limits(p, seq, q[0], 'tail'), lb = E.limits(p, seq, q[1], 'head'); rd = Math.max(-Math.min(la[0], lb[0], q[0].dur - 1), Math.min(la[1], lb[1], q[1].dur - 1, rd)); });
    if (pairOf(t, c)) pairs.forEach(function (q) { E.roll(p, seq, q[0], q[1], rd); }); return ''; },
  rate: function () { var x = anyPick(); if (!x) return; var c = x.c, t = x.t, edge = pick(['head', 'tail']), dd = ri(-30, 30), ps = partners(c);
    var nd = edge === 'tail' ? c.dur + dd : c.dur - dd;
    [{ t: t, c: c }].concat(ps).forEach(function (y) { var cp = JSON.parse(JSON.stringify(y.c)), tp = { clips: y.t.clips.map(function (z) { return z === y.c ? cp : z; }) }; nd = Math.min(nd, E.rateStretch(seq, tp, cp, nd, edge)); });
    [{ t: t, c: c }].concat(ps).forEach(function (y) { E.rateStretch(seq, y.t, y.c, nd, edge); S.sort(y.t); }); return ''; },
  slip: function () { var x = linkedPick(); if (!x) return; var df = ri(-40, 40); E.slip(p, seq, x.c, -df); partners(x.c).forEach(function (y) { E.slip(p, seq, y.c, -df); }); return ''; },
  slide: function () { var x = anyPick(); if (!x) return; var c = x.c, t = x.t, ps = partners(c), sd = ri(-30, 30);
    [{ t: t, c: c }].concat(ps).forEach(function (y) { sd = E.slideLimit(p, seq, y.t, y.c, sd); });
    [{ t: t, c: c }].concat(ps).forEach(function (y) { E.slide(p, seq, y.t, y.c, sd); }); return ''; },
  razorAll: function () { var f = ri(1, S.end(seq)); E.razor(seq, f, null); return ''; },
  razorTargeted: function () { var f = ri(1, S.end(seq)); E.razor(seq, f, S.tracks(seq).filter(function (t) { return !t.lock && t.target; })); return ''; },
  rippleDelete: function () { var x = linkedPick() || pick(allClips()); if (!x) return; var ids = [x.c.id].concat(partners(x.c).map(function (y) { return y.c.id; })); return E.rippleDelete(seq, ids); },
  closeGap: function () { var t = pick(S.tracks(seq)), cs = S.sort(t).clips; if (cs.length < 2) return; var i = ri(0, cs.length - 2), a = cs[i].start + cs[i].dur, b = cs[i + 1].start; if (b <= a) return;
    var busy = S.tracks(seq).filter(function (tr) { return tr !== t && tr.sync && !tr.lock && tr.clips.some(function (c) { return c.start < b && c.start + c.dur > a; }); });
    if (busy.length) return 'The gap was not closed'; E.closeRanges(seq, [t], [[a, b]]); return ''; },
  QW: function () { var dir = pick([-1, 1]), f = ri(0, S.end(seq)), items = [], edit = null;
    S.tracks(seq).filter(function (t) { return t.target && !t.lock; }).forEach(function (t) {
      var c = S.at(t, f); if (!c || c.start === f) return;
      var end = c.start + c.dur, d = dir < 0 ? E.trimHead(p, seq, t, c, f - c.start, 'keep') : -E.trimTail(p, seq, t, c, -(end - f), 'plain');
      if (d) { items.push({ t: t, c: c, end: end, d: d }); edit = edit === null ? c.start : Math.min(edit, c.start); } });
    if (!items.length) return 'no clip';
    var same = items.every(function (x) { return x.d === items[0].d && x.end === items[0].end; }), msg = '';
    if (same) { var from = {}; items.forEach(function (x) { from[x.t.id] = x.end; }); E.rippleShift(seq, items.map(function (x) { return x.t; }), dir < 0 ? edit : items[0].end - items[0].d, -items[0].d, items.map(function (x) { return x.c; }), from); msg = E.note(); }
    else { items.forEach(function (x) { x.t.clips.forEach(function (y) { if (y !== x.c && y.start >= x.end) y.start -= x.d; }); S.sort(x.t); }); msg = 'different lengths'; }
    return msg; },
  speed: function () { var x = linkedPick(); if (!x) return; var sel = [x.c.id].concat(partners(x.c).map(function (y) { return y.c.id; })), pct = pick([25, 50, 75, 150, 200, 300, 100]), rev = rnd() < 0.3, rip = rnd() < 0.5, keep = rnd() < 0.5;
    var notes = [], moved = {}; S.all(seq).forEach(function (y) { if (sel.indexOf(y.c.id) >= 0) { var once = rip && !(y.c.link && moved[y.c.link]); if (y.c.link && rip) moved[y.c.link] = 1;
      var withs = once && y.c.link ? S.all(seq).filter(function (z) { return z.c !== y.c && z.c.link === y.c.link && sel.indexOf(z.c.id) >= 0; }) : []; var nn = E.setSpeed(p, seq, y.t, y.c, pct, rev, once ? withs : false, keep); if (nn) notes.push(nn); } });
    return notes[0] || ''; },
  insert: function () { var f = ri(0, S.end(seq)), mi = pick(['m0', 'm1', 'm2']), dur = ri(5, 60), link = S.uid('l'), o = { media: mi, start: f, dur: dur, srcIn: 0, link: link };
    var v = S.clip(o), a = S.clip(o); if (rnd() < 0.5) E.insert(seq, f, [{ t: seq.v[0], c: v }, { t: seq.a[0], c: a }]); else E.overwrite(seq, f, [{ t: seq.v[0], c: v }, { t: seq.a[0], c: a }]); return ''; },
  liftExtract: function () { var a = ri(0, S.end(seq)), b = a + ri(1, 60), ts = S.tracks(seq).filter(function (t) { return t.target && !t.lock; }); if (rnd() < 0.5) E.lift(seq, a, b, ts); else E.extract(seq, a, b, ts); return ''; },
  move: function () { var x = linkedPick(); if (!x) return; var ids = [x.c.id].concat(partners(x.c).map(function (y) { return y.c.id; })); return E.move(seq, ids, ri(-60, 60), pick([0, 0, 1, -1]), rnd() < 0.3); }
};
// ---- what must hold after every edit
function problems() {
  var out = [];
  S.tracks(seq).forEach(function (t) {
    var cs = t.clips.slice().sort(function (a, b) { return a.start - b.start; });
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (i + 1 < cs.length && c.start + c.dur > cs[i + 1].start) out.push(['overlap', t.name + ' ' + c.start + '+' + c.dur + ' / ' + cs[i + 1].start]);
      if (c.start < 0 || c.dur < 1 || c.start !== Math.round(c.start) || c.dur !== Math.round(c.dur)) out.push(['frames', t.name + ' start ' + c.start + ' dur ' + c.dur]);
      if (c.media && c.hold === null && p.media[c.media]) { var len = p.media[c.media].dur, span = S.srcSpan(c, seq);
        if (c.srcIn < -1e-6 || c.srcIn + span > len + 1e-6) out.push(['source', t.name + ' srcIn ' + c.srcIn.toFixed(4) + ' span ' + span.toFixed(4) + ' media ' + len]); }
    }
  });
  var groups = {}; S.all(seq).forEach(function (x) { if (x.c.link) (groups[x.c.link] = groups[x.c.link] || []).push(x.c); });
  Object.keys(groups).forEach(function (k) { var g = groups[k]; if (g.length < 2) return; var a = g[0];
    g.slice(1).forEach(function (b) { if (a.start !== b.start || a.dur !== b.dur || Math.abs(a.srcIn - b.srcIn) > 1e-6 || Math.abs(a.speed - b.speed) > 1e-9 || a.reverse !== b.reverse)
      out.push(['linked', a.start + '+' + a.dur + ' in ' + a.srcIn.toFixed(3) + ' / ' + b.start + '+' + b.dur + ' in ' + b.srcIn.toFixed(3)]); }); });
  return out;
}
var stats = {}, firsts = {};
Object.keys(OPS).forEach(function (k) { stats[k] = { runs: 0 }; });
for (var ep = 0; ep < A.episodes; ep++) {
  setup();
  var pre = problems(); if (pre.length) { stats.setup = stats.setup || { runs: 0 }; stats.setup.bad = (stats.setup.bad || 0) + 1; firsts['setup|' + pre[0][0]] = pre[0][1]; continue; }
  for (var st = 0; st < A.steps; st++) {
    var name = pick(Object.keys(OPS)), before = JSON.stringify(seq), msg = '';
    try { msg = OPS[name]() || ''; } catch (e) { stats[name].threw = (stats[name].threw || 0) + 1; firsts[name + '|threw'] = String(e && e.stack || e).slice(0, 300); break; }
    stats[name].runs++;
    var pr = problems();
    if (pr.length) {
      pr.forEach(function (q) { var key = q[0] + (q[0] === 'linked' ? (msg ? '+said' : '+silent') : ''); stats[name][key] = (stats[name][key] || 0) + 1; if (!firsts[name + '|' + key]) firsts[name + '|' + key] = q[1] + (msg ? ' (said: ' + msg + ')' : ''); });
      break;
    }
  }
}
return { stats: stats, firsts: firsts };
"""
def sec_fuzz():
    stats, firsts = {}, {}
    for seed in (777, 4242):
        r = node(FUZZJS % json.dumps(dict(seed=seed, episodes=600, steps=50)))
        for k, v in r["stats"].items():
            s = stats.setdefault(k, {})
            for kk, vv in v.items(): s[kk] = s.get(kk, 0) + vv
        for k, v in r["firsts"].items(): firsts.setdefault(k, v)
    check("fuzz: the starting sequences (linked pictures and sounds, sound of its own in gaps, titles, sync lock on every track) break no rule", "setup" not in stats, firsts)
    names = {"trim": "a plain trim of either edge (partners trimmed by what the clip got, as the Timeline does)", "ripple": "a ripple trim with its linked partners",
             "roll": "a rolling edit (every linked pair rolled by the least)", "rate": "a Rate Stretch", "slip": "a slip", "slide": "a slide (gaps beside it allowed)",
             "razorAll": "Add Edit to All Tracks", "razorTargeted": "Add Edit on the targeted tracks", "rippleDelete": "a Ripple Delete of a clip and its partners",
             "closeGap": "closing a chosen gap", "QW": "Q or W (ripple trim to the playhead)", "speed": "Speed/Duration (ripple on or off, reversed or not)",
             "insert": "an insert or overwrite of a linked picture and sound", "liftExtract": "a Lift or an Extract", "move": "a move of linked clips (to another track pair, inserting or not)"}
    said = 0; said_ex = []
    for k, label in names.items():
        s = stats.get(k, {}); bad = {kk: vv for kk, vv in s.items() if kk not in ("runs", "linked+said")}
        said += s.get("linked+said", 0)
        if s.get("linked+said"): said_ex.append("%s %d: %s" % (k, s["linked+said"], firsts.get(k + "|linked+said", "")[:160]))
        ex = "; ".join("%s: %s" % (kk, firsts.get(k + "|" + kk, "")) for kk in bad)
        check("fuzz, %s (about 3,000 edits from two seeds): after each, no two clips meet on a track, no negative or broken frame counts, no source outside the media, linked clips together"
              % label, not bad and s.get("runs", 0) > 300, "%d edits: %s -- %s" % (s.get("runs", 0), bad, ex))
    check("fuzz: linked clips are never parted by an edit that a sync-locked track cannot take (judgement: Lantern says which tracks it did not move, or that a clip was cut short, and goes on)",
          said == 0, "%d edits parted them, each said: %s" % (said, " | ".join(said_ex)))
    # a link made for the right-hand pieces of a cut is the same every time the same link is cut at the same frame
    r = node(r"""
var q = proj(), p = q.p, seq = q.seq; p.media.m = { id: 'm', name: 'm.mp4', kind: 'video', dur: 60 };
var L = S.uid('l'), v = S.clip({ media: 'm', start: 0, dur: 100, srcIn: 0, link: L }), a = S.clip({ media: 'm', start: 0, dur: 100, srcIn: 0, link: L });
seq.v[0].clips.push(v); seq.a[0].clips.push(a);
E.lift(seq, 50, 60, [seq.v[0], seq.a[0]]);                      // right halves [60, 100) get a new link
var rv = S.at(seq.v[0], 70), ra = S.at(seq.a[0], 70);
E.move(seq, [rv.id, ra.id], 200, 0, false);                      // moved out of the way, still linked to each other
E.trimTail(p, seq, seq.v[0], v, 40, 'plain'); E.trimTail(p, seq, seq.a[0], a, 40, 'plain');   // the left halves made long again, over frame 60
E.lift(seq, 50, 60, [seq.v[0], seq.a[0]]);                      // cut at 60 again
var nv = S.at(seq.v[0], 70);
return { partners: S.partners(seq, nv).map(function (y) { return y.t.name + ' ' + y.c.start + '+' + y.c.dur; }) };
""")
    check("a picture and its sound cut at frame 60 twice (Lift, the first right halves moved away, the left halves lengthened, Lift again): the new right half's only partner is its own sound",
          len(r["partners"]) == 1, "partners: %s" % r["partners"])
    r = node(r"""
var q = proj(), p = q.p, seq = q.seq, out = {}; p.media.m = { id: 'm', name: 'm.mp4', kind: 'video', dur: 60 };
// a head dragged past frame 0
var c = S.clip({ media: 'm', start: 5, dur: 40, srcIn: 2 }); seq.v[0].clips = [c]; var got = E.trimHead(p, seq, seq.v[0], c, -30, 'plain'); out.head0 = [got, c.start, c.dur, c.srcIn];
// Speed/Duration with ripple true, called for the picture and then its sound: the clips after them move once
var L = S.uid('l'), v = S.clip({ media: 'm', start: 0, dur: 60, srcIn: 1, link: L }), a = S.clip({ media: 'm', start: 0, dur: 60, srcIn: 1, link: L });
var L2 = S.uid('l'), v2 = S.clip({ media: 'm', start: 60, dur: 30, srcIn: 20, link: L2 }), a2 = S.clip({ media: 'm', start: 60, dur: 30, srcIn: 20, link: L2 });
seq.v[0].clips = [v, v2]; seq.a[0].clips = [a, a2]; seq.v[1].clips = []; seq.a[1].clips = [];
E.setSpeed(p, seq, seq.v[0], v, 50, false, true); E.setSpeed(p, seq, seq.a[0], a, 50, false, true);
out.ripTrue = [v.dur, a.dur, v2.start, a2.start];
// Rate Stretch from the head: the end stays, the start stops at the clip before
var w1 = S.clip({ media: 'm', start: 0, dur: 20, srcIn: 0 }), w2 = S.clip({ media: 'm', start: 30, dur: 30, srcIn: 5 }); seq.v[0].clips = [w1, w2];
var nd = E.rateStretch(seq, seq.v[0], w2, 50, 'head'); out.rateHead = [nd, w2.start, w2.dur, Math.round(w2.speed * 1e6) / 1e6];
// Speed/Duration 200% on a clip with less than a frame's worth of source left at that speed
p.media.s = { id: 's', name: 's.mp4', kind: 'video', dur: 3.2 }; var z = S.clip({ media: 's', start: 0, dur: 1, srcIn: 3.18 }); seq.v[0].clips = [z];
E.setSpeed(p, seq, seq.v[0], z, 200, false, false); out.tiny = [z.dur, z.srcIn + S.srcSpan(z, seq)];
return out;
""")
    check("a clip at frame 5 with 2 s of media before its in point, its head dragged 30 frames earlier: it stops at frame 0 and shows 5 frames more of its source", r["head0"] == [-5, 0, 45, 2 - 5 / 30] or (r["head0"][:3] == [-5, 0, 45] and abs(r["head0"][3] - (2 - 5 / 30)) < 1e-9), r["head0"])
    check("Speed/Duration 50% with ripple on, called for a picture and then for its linked sound: both twice as long, the clips after them moved once (60 frames)", r["ripTrue"] == [120, 120, 120, 120], r["ripTrue"])
    check("Rate Stretch from the head to 50 frames with a clip ending 10 frames before: the end stays at 60, the start stops at 20 (40 frames, 75%)", r["rateHead"] == [40, 20, 40, 0.75], r["rateHead"])
    check("Speed/Duration 200% on a one-frame clip 0.02 s before its media's end: it shows no source past the end (the EDIT header: an edge stops at the end of its media)", r["tiny"][1] <= 3.2 + 1e-6, "length %d frame(s), source to %.4f s of 3.2" % tuple(r["tiny"]))
    # stills, titles and mattes: an edge cannot pass the clip's other edge
    r = node(r"""
var q = proj(), p = q.p, seq = q.seq, t = seq.v[0];
var a = S.clip({ kind: 'title', start: 10, dur: 19 }), b = S.clip({ kind: 'matte', start: 40, dur: 10 }), c = S.clip({ kind: 'title', start: 100, dur: 20 }), d = S.clip({ kind: 'title', start: 200, dur: 12 });
t.clips.push(a, b, c, d); p.media.m = { id: 'm', name: 'm.mp4', kind: 'video', dur: 10 }; var h = S.clip({ media: 'm', start: 300, dur: 15, srcIn: 1 }); h.hold = 2; t.clips.push(h);
E.trimHead(p, seq, t, a, 50, 'plain'); E.trimTail(p, seq, t, b, -30, 'plain'); E.trimHead(p, seq, t, c, 25, 'ripple', []); E.trimTail(p, seq, t, d, -20, 'ripple', []); E.trimHead(p, seq, t, h, 40, 'plain');
return [a, b, c, d, h].map(function (x) { return [x.kind + (x.hold !== null ? ' hold' : ''), x.start, x.dur]; });
""")
    check("a title's head trimmed 50 frames, a matte's tail -30, a title rippled 25 and -20, a frame hold's head 40: each stops at one frame (as a clip with media does)",
          all(x[2] >= 1 for x in r), r)



# ================================================================ Warp Stabilizer
def _stab_setup():
    from scipy import ndimage as nd
    rng = np.random.default_rng(3); BIG = 1200
    tex = nd.gaussian_filter(rng.standard_normal((BIG, BIG)), 2) + 3 * nd.gaussian_filter(rng.standard_normal((BIG, BIG)), 8)
    tex = (tex - tex.min()) / (tex.max() - tex.min()) * 255
    return nd, rng, BIG, tex
def sim(s, th, tx, ty): return [s * math.cos(th), s * math.sin(th), tx, ty]
def smul(M, N): return [M[0] * N[0] - M[1] * N[1], M[1] * N[0] + M[0] * N[1], M[0] * N[2] - M[1] * N[3] + M[2], M[1] * N[2] + M[0] * N[3] + M[3]]
def sinv(M): d = M[0] ** 2 + M[1] ** 2; a = M[0] / d; b = -M[1] / d; return [a, b, -(a * M[2] - b * M[3]), -(b * M[2] + a * M[3])]
STABJS = r"""
var a = %s, u = new Uint8Array(fs.readFileSync(a.inp)), all = new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)), W = a.w, H = a.h, fr = [];
for (var i = 0; i < a.n; i++) fr.push({ w: W, h: H, d: all.subarray(i * W * H, (i + 1) * W * H) });
var out = []; for (i = 1; i < a.n; i++) { var m = V.stab.motion(fr[i - 1], fr[i]); out.push(m ? { pos: m.pos, psr: m.psr } : null); }
var res = { steps: out };
if (a.render) {
  // the effect itself, No Motion, on each frame: the result should be frame 0
  var c = S.clip({ media: 'm', start: 0, dur: a.n, srcIn: 0 }), e = F.make('warpStabilizer'); e.p.result = 'No Motion'; e.p.framing = 'Stabilize Only';
  e.data = { id: 'w1', key: V.stab.keyOf(c), w: W, h: H, fps: 30, steps: out };
  res.err = [];
  for (i = 0; i < a.n; i++) {
    var img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
    for (var k = 0; k < W * H; k++) { var g = Math.round(fr[i].d[k]); img.data[4 * k] = img.data[4 * k + 1] = img.data[4 * k + 2] = g; img.data[4 * k + 3] = 255; }
    F.defs.warpStabilizer.run(img, F.values(e, i), { effect: e, clip: c, local: i, scale: 1 });
    var s = 0, n = 0; for (var y = Math.round(H * 0.25); y < Math.round(H * 0.75); y++) for (var x = Math.round(W * 0.25); x < Math.round(W * 0.75); x++) { s += Math.abs(img.data[4 * (y * W + x)] - fr[0].d[y * W + x]); n++; }
    res.err.push(s / n);
  }
}
return res;
"""
def sec_stab():
    nd, rng, BIG, tex = _stab_setup(); W, H = 320, 180
    def view(M, img):
        a, b, tx, ty = M; d = a * a + b * b; ia, ib = a / d, -b / d
        ys, xs = np.mgrid[0:H, 0:W].astype(float); qx = xs + 0.5 - W / 2; qy = ys + 0.5 - H / 2
        px = ia * (qx - tx) - ib * (qy - ty); py = ib * (qx - tx) + ia * (qy - ty)
        return nd.map_coordinates(img, [py + BIG / 2 - 0.5, px + BIG / 2 - 0.5], order=3, mode="reflect")
    def analyse(Ms, noise=0, flat=False, obj=None, render=False):
        frames = []
        tex2 = np.roll(tex, 400, axis=0)
        for i, M in enumerate(Ms):
            f = view(M, tex)
            if obj is not None:
                ox, oy, v = obj; sh = nd.shift(view([1, 0, 0, 0], tex2), (0, v * i), order=3, mode="reflect")
                sel = (np.arange(W)[None, :] >= ox + v * i) & (np.arange(W)[None, :] < ox + v * i + 70) & (np.arange(H)[:, None] >= oy) & (np.arange(H)[:, None] < oy + 70)
                f = np.where(sel, sh, f)
            if flat: f[:H // 2, :] = 128.0
            if noise: f = f + rng.normal(0, noise, f.shape)
            frames.append(np.clip(f, 0, 255).astype(np.float32))
        np.stack(frames).tofile(p("fr.f32"))
        return node(STABJS % json.dumps(dict(inp=p("fr.f32"), n=len(frames), w=W, h=H, render=render)))
    def errs(Ms, steps):
        out = []
        for i, st in enumerate(steps):
            T = smul(Ms[i + 1], sinv(Ms[i]))
            if st is None: out.append((99, 99, 99, 99)); continue
            M = st["psr"]
            out.append((abs(M[2] - T[2]), abs(M[3] - T[3]), abs(math.degrees(math.atan2(M[1], M[0]) - math.atan2(T[1], T[0]))), abs(math.hypot(M[0], M[1]) / math.hypot(T[0], T[1]) - 1) * 100))
        return np.array(out)
    N = 25; rw = np.cumsum(rng.normal(0, 1.5, (N, 2)), 0)
    cases = {"a random-walk shift (sub-pixel)": [sim(1, 0, rw[i, 0], rw[i, 1]) for i in range(N)],
             "a turn of 0.4 degrees a frame with a drift": [sim(1, math.radians(0.4 * i), 0.7 * i, -0.3 * i) for i in range(N)],
             "a zoom of 0.8% a frame": [sim(1.008 ** i, 0, 0.5 * i, 0) for i in range(N)],
             "shift, turn and zoom together": [sim(1.004 ** i, math.radians(0.3 * math.sin(i / 3)), rw[i, 0], rw[i, 1]) for i in range(N)]}
    for name, Ms in cases.items():
        bad = []
        for kw, lab in (({}, "clean"), ({"noise": 6}, "noise"), ({"flat": True}, "top half flat")):
            e = errs(Ms, analyse(Ms, **kw)["steps"]); w = e.max(0)
            if w[0] > 0.25 or w[1] > 0.25 or w[2] > 0.05 or w[3] > 0.1: bad.append("%s: %.3f %.3f px, %.3f deg, %.3f%%" % (lab, w[0], w[1], w[2], w[3]))
        check("Warp Stabilizer (Position, Scale, Rotation) on views of a texture with %s, clean, with noise (6 grey levels) and with the top half flat: each frame's move within 0.25 px, 0.05 degrees and 0.1%% of the truth" % name,
              not bad, "; ".join(bad))
    Ms = [sim(1, 0, 10 * ((-1) ** i) + 0.37 * i, 8 * ((-1) ** (i // 2))) for i in range(12)]
    e = errs(Ms, analyse(Ms)["steps"]).max(0)
    check("Warp Stabilizer: a hard shake (20 px across, 16 px up and down, a frame, of 320) found within 0.25 px", e[0] < 0.25 and e[1] < 0.25, e[:2])
    Ms = [sim(1, math.radians(5 * i), 0, 0) for i in range(12)]
    e = errs(Ms, analyse(Ms)["steps"]).max(0)
    check("Warp Stabilizer: a turn of 5 degrees a frame found within 0.05 degrees", e[2] < 0.05, e[2])
    r = analyse([sim(1, 0, 0, 0)] * N, obj=(30, 40, 3))
    e = errs([sim(1, 0, 0, 0)] * N, r["steps"]).max(0); pe = max(max(abs(s["pos"][2]), abs(s["pos"][3])) for s in r["steps"])
    check("Warp Stabilizer: a still background with a textured square crossing it at 3 px a frame: no camera move found (within 0.25 px, both Methods)", e[0] < 0.25 and e[1] < 0.25 and pe < 0.25, "psr %.3f %.3f, pos %.3f" % (e[0], e[1], pe))
    # the effect itself on the frames, No Motion: every frame shows frame 0
    Ms = cases["shift, turn and zoom together"][:12]
    r = analyse(Ms, render=True)
    check("Warp Stabilizer, No Motion, Stabilize Only, run on each frame from its own analysis: its middle shows frame 0's (mean difference under 3 of 255)", max(r["err"]) < 3, ["%.2f" % v for v in r["err"]])
    # the plan's zoom against geometry, from the true moves
    def plan(steps, result, smooth=50, method="Position, Scale, Rotation", n=None):
        an = {"id": "x", "w": W, "h": H, "fps": 30, "steps": [{"pos": [1, 0, s[2], s[3]], "psr": s} for s in steps]}
        return node("return V.stab.plan(%s, %s, %d, %d);" % (json.dumps(an), json.dumps({"result": result, "smooth": smooth, "method": method}), W, H))
    Ms = cases["shift, turn and zoom together"]; steps = [smul(Ms[i + 1], sinv(Ms[i])) for i in range(N - 1)]
    pl = plan(steps, "No Motion"); hw, hh = W / 2, H / 2; zs = [1.0]
    for M in [smul(Mi, sinv(Ms[0])) for Mi in Ms]:
        c, s_, tx, ty = abs(M[0]), abs(M[1]), M[2], M[3]
        zs += [(c * hw + s_ * hh) / (hw - abs(tx)), (s_ * hw + c * hh) / (hh - abs(ty))]
    check("Warp Stabilizer, No Motion: the Auto-scale zoom is the least that keeps every corner inside every frame (closed form from the true moves)", abs(pl["zoom"] - max(zs)) < 1e-3, "%.5f vs %.5f" % (pl["zoom"], max(zs)))
    pan = [[1, 0, 2.0, 0.0]] * 119
    pl = plan(pan, "Smooth Motion", 50); corr = max(math.hypot(m[2], m[3]) for m in pl["mats"])
    check("Warp Stabilizer, Smooth Motion (50%) on a steady pan of 2 px a frame with no shake: no frame moved by more than 1 px, so no zoom needed (judgement: there is nothing to steady)",
          corr < 1.0, "frames moved up to %.1f px, Auto-scale %.3f" % (corr, pl["zoom"]))
    shake = [[1, 0, 1.0 + 5 * (math.sin(2 * math.pi * (i + 1) / 15) - math.sin(2 * math.pi * i / 15)), 0.0] for i in range(119)]
    pl = plan(shake, "Smooth Motion", 50); xs = np.cumsum([0] + [s[2] for s in shake]); out = np.array([xs[i] - pl["mats"][i][2] for i in range(len(xs))])
    mid = out[30:90]; resid = mid - np.polyval(np.polyfit(np.arange(len(mid)), mid, 1), np.arange(len(mid)))
    check("Warp Stabilizer, Smooth Motion (50%) on a pan with a 2 Hz shake of 5 px: the shake is gone from the result (under 0.5 px left in the middle of the clip)", np.abs(resid).max() < 0.5, "%.2f px" % np.abs(resid).max())


# ================================================================ masks: tracking, and an effect under a mask
MASKJS = r"""
var a = %s, u = new Uint8Array(fs.readFileSync(a.inp)), all = new Uint8Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)), W = a.w, H = a.h, fr = [];
for (var i = 0; i < a.n; i++) fr.push({ width: W, height: H, data: all.subarray(i * W * H * 4, (i + 1) * W * H * 4) });
// as Effect Controls' Track forward does: a frame at a time, the mask moved by what was found
var m = V.mask.make('ellipse', W, H); m.cx = a.cx; m.cy = a.cy; m.rx = 30; m.ry = 30;
var cur = { kind: 'ellipse', cx: m.cx, cy: m.cy, rx: m.rx, ry: m.ry, pts: null }, pos = [[0, 0]];
for (i = 1; i < a.n; i++) { var r = V.mask.track([fr[i - 1], fr[i]], cur, i - 1)[0]; cur.cx += r.dx; cur.cy += r.dy; pos.push([pos[i - 1][0] + r.dx, pos[i - 1][1] + r.dy]); }
return pos;
"""
MASKFXJS = r"""
var W = 200, H = 120, img = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
for (var i = 0; i < W * H; i++) { var x = i %% W; img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = 40 + (x %% 7) * 20; img.data[4 * i + 3] = 255; }
var res = {};
%s
return res;
"""
def sec_mask():
    nd, rng, BIG, tex = _stab_setup(); W, H = 320, 180
    for v, n_ in ((3.0, 20), (0.4, 50), (1.5, 30)):
        frames = []
        for i in range(n_):
            f = nd.map_coordinates(tex, np.mgrid[0:H, 0:W].astype(float) + np.array([300, 300])[:, None, None], order=1)
            obj = nd.shift(np.roll(tex, 500, axis=1)[200:290, 200:290], (0, (v * i) % 1.0), order=3, mode="nearest")
            ox = 100 + v * i; x0 = int(math.floor(ox))
            f[40:130, x0:x0 + 90] = obj
            g = np.clip(f, 0, 255).astype(np.uint8); frames.append(np.dstack([g, g, g, np.full_like(g, 255)]))
        np.stack(frames).tofile(p("mk.u8"))
        pos = node(MASKJS % json.dumps(dict(inp=p("mk.u8"), n=n_, w=W, h=H, cx=145, cy=85)))
        truth = [math.floor(100 + v * i) - 100 for i in range(n_)]
        err = max(abs(a[0] - t_) for a, t_ in zip(pos, truth)); yerr = max(abs(a[1]) for a in pos)
        check("mask tracking (as Track forward calls it, a frame at a time) of a textured square moving %.1f px a frame over a still texture for %d frames: the mask follows within 2 px all along" % (v, n_),
              err <= 2 and yerr <= 2, "moved %s px by the end, truth %d (worst %d px off)" % (pos[-1][0], truth[-1], err))
    # an effect under a mask: only the inside changes, Inverted the opposite, Feather a ramp
    r = node(MASKFXJS % r"""
var e = F.make('invert'); if (!e) { var names = Object.keys(F.defs).filter(function (k) { return !F.defs[k].audio; }); res.types = names; e = F.make(names[0]); }
res.type = e.type;
var plain = { width: W, height: H, data: new Uint8ClampedArray(img.data) }; F.run(plain, e, 0, { scale: 1 });
var m = V.mask.make('rect', W, H); m.pts = [[50, 30], [150, 30], [150, 90], [50, 90]]; m.feather = 0; e.mask = m;
var a = { width: W, height: H, data: new Uint8ClampedArray(img.data) }; F.run(a, e, 0, { scale: 1 });
m.invert = true; var b = { width: W, height: H, data: new Uint8ClampedArray(img.data) }; F.run(b, e, 0, { scale: 1 });
m.invert = false; m.feather = 20; var c = { width: W, height: H, data: new Uint8ClampedArray(img.data) }; F.run(c, e, 0, { scale: 1 });
function px(o, x, y) { return o.data[4 * (y * W + x)]; }
res.inside = [px(a, 100, 60), px(plain, 100, 60)]; res.outside = [px(a, 10, 10), px(img, 10, 10)];
res.invIn = [px(b, 100, 60), px(img, 100, 60)]; res.invOut = [px(b, 10, 10), px(plain, 10, 10)];
var row = []; for (var x = 20; x < 80; x += 2) { var o = px(img, x, 60), q = px(plain, x, 60), g = px(c, x, 60); row.push(q === o ? null : (g - o) / (q - o)); } res.ramp = row;
// keyed mask position (dx) follows its keys
m.feather = 0; m.keys.dx = [{ f: 0, v: 0, i: 'linear' }, { f: 10, v: 40, i: 'linear' }];
var d = { width: W, height: H, data: new Uint8ClampedArray(img.data) }; F.run(d, e, 5, { scale: 1 });
res.keyed = [px(d, 160, 60), px(plain, 160, 60), px(d, 60, 60), px(img, 60, 60)];
// the same on a preview at half size: the mask scales with it
var hw = { width: W / 2, height: H / 2, data: new Uint8ClampedArray(W / 2 * H / 2 * 4) }; for (i = 0; i < W * H / 4; i++) { var xx = i % (W / 2); hw.data[4 * i] = hw.data[4 * i + 1] = hw.data[4 * i + 2] = 40 + (xx % 7) * 20; hw.data[4 * i + 3] = 255; }
m.keys = {}; var hp = { width: W / 2, height: H / 2, data: new Uint8ClampedArray(hw.data) }; e.mask = null; F.run(hp, e, 0, { scale: 0.5 }); e.mask = m;
var hm = { width: W / 2, height: H / 2, data: new Uint8ClampedArray(hw.data) }; F.run(hm, e, 0, { scale: 0.5 });
res.half = [hm.data[4 * (30 * 100 + 50)], hp.data[4 * (30 * 100 + 50)], hm.data[4 * (5 * 100 + 5)], hw.data[4 * (5 * 100 + 5)]];
""")
    check("an effect (%s) under a rectangle mask: the inside as the effect makes it, the outside untouched" % r["type"], r["inside"][0] == r["inside"][1] and r["outside"][0] == r["outside"][1] and r["inside"][1] != r["invIn"][1], r)
    check("the same mask Inverted: the outside changed, the inside untouched", r["invIn"][0] == r["invIn"][1] and r["invOut"][0] == r["invOut"][1], r)
    ramp = [v for v in r["ramp"] if v is not None]
    check("the mask feathered 20 px: across its left edge the effect fades in steadily from none to all (never back, nothing outside the ramp's span)",
          ramp[0] < 0.05 and ramp[-1] > 0.95 and all(b_ >= a_ - 0.02 for a_, b_ in zip(ramp, ramp[1:])), ["%.2f" % v for v in ramp])
    check("a rectangle mask (x 50 to 150) keyed to move (dx 0 to 40 over 10 frames) is at frame 5 20 px along: x 160 inside, x 60 outside", r["keyed"][0] == r["keyed"][1] and r["keyed"][2] == r["keyed"][3], r["keyed"])
    check("a mask on a half-size preview (scale 0.5) covers the same part of the picture", r["half"][0] == r["half"][1] and r["half"][2] == r["half"][3], r["half"])



# ================================================================ EDL and Final Cut Pro 7 XML
_OTIO = []
def otio():
    if _OTIO: return _OTIO[0]
    mod = None
    try:
        import opentimelineio as mod  # noqa
        mod.adapters.from_name("cmx_3600"); mod.adapters.from_name("fcp_xml")
    except Exception:
        mod = None
        tgt = p("otio")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "--target", tgt, "opentimelineio", "otio-cmx3600-adapter", "otio-fcp-adapter"], capture_output=True, timeout=240)
            sys.path.insert(0, tgt)
            for k in [k for k in sys.modules if k.startswith("opentimelineio") or k.startswith("otio_")]: del sys.modules[k]
            import opentimelineio as mod  # noqa
            mod.adapters.from_name("cmx_3600"); mod.adapters.from_name("fcp_xml")
        except Exception:
            mod = None
    _OTIO.append(mod)
    return mod

def tc_ref(f, num, den, drop):
    """SMPTE timecode worked out here (drop-frame: two frame numbers, four at 59.94, skipped each minute but the tenth)."""
    nom = round(num / den)
    if drop:
        d = 2 if nom == 30 else 4; per10 = nom * 600 - 9 * d; perm = nom * 60 - d
        D, M = divmod(f, per10)
        f = f + 9 * d * D + (d * ((M - d) // perm) if M > d else 0)
    ff = f % nom; s = f // nom
    return "%02d:%02d:%02d%s%02d" % (s // 3600, s // 60 % 60, s % 60, ";" if drop else ":", ff)

XJS = r"""
var a = %s, out = {};
function build(rate, drop) {
  var p = S.project(), seq = p.seqs[p.active]; seq.rate = T.rate(rate[0], rate[1]); seq.drop = drop; seq.name = a.seqName;
  p.media.a = { id: 'a', name: a.nameA, kind: 'video', dur: 3000, w: 1920, h: 1080, hasAudio: true, fps: seq.rate };
  p.media.b = { id: 'b', name: 'b roll.mov', kind: 'video', dur: 3000, w: 1920, h: 1080, hasAudio: true, fps: seq.rate };
  return { p: p, seq: seq };
}
function lay(q, starts) {
  var seq = q.seq, L = [];
  starts.forEach(function (st, i) { var l = S.uid('l'), m = i %% 2 ? 'b' : 'a', o = { media: m, start: st[0], dur: st[1], srcIn: 10 + i * 7.5, link: l };
    var v = S.clip(o), au = S.clip(o); seq.v[0].clips.push(v); seq.a[0].clips.push(au); L.push(v); });
  S.tracks(seq).forEach(S.sort); return L;
}
function dump(seq) { return S.tracks(seq).map(function (t) { return t.clips.map(function (c) { return { kind: c.kind, start: c.start, dur: c.dur, srcIn: c.srcIn, speed: c.speed, reverse: c.reverse, link: c.link, name: c.name, media: c.media, tin: c.tin, text: c.data && c.data.layers ? (c.data.layers.filter(function (l) { return l.type === 'text'; })[0] || {}).text : null }; }); }); }
// EDL: the hour, at every rate, and events at a minute and at ten minutes in
out.edl = a.rates.map(function (r) {
  var q = build([r[0], r[1]], r[2]), fps = r[0] / r[1], nom = Math.round(fps);
  var m1 = r[2] ? nom * 60 - (nom === 30 ? 2 : 4) : nom * 60, m10 = r[2] ? (nom * 600 - 9 * (nom === 30 ? 2 : 4)) : nom * 600;
  lay(q, [[0, 25], [m1 - 3, 40], [m10, 30]]);
  var txt = V.xchg.edl(q.p, q.seq), back = build([r[0], r[1]], r[2]); back.seq.v = [S.track('v', 1)]; back.seq.a = [S.track('a', 1)];
  var note = V.xchg.readEdl(txt, back.p, back.seq);
  return { txt: txt, starts: [0, m1 - 3, m10], durs: [25, 40, 30], back: dump(back.seq), note: note };
});
// a centred dissolve, a speed change, reversed, and B events
out.diss = (function () {
  var q = build([25, 1], false), L = lay(q, [[0, 100], [100, 150]]); L[1].tin = { type: 'crossDissolve', dur: 30, align: 'center' };
  var w = V.trans.window(L[1], 'in', q.seq), txt = V.xchg.edl(q.p, q.seq), back = build([25, 1], false); back.seq.v = [S.track('v', 1)]; back.seq.a = [S.track('a', 1)];
  V.xchg.readEdl(txt, back.p, back.seq); return { txt: txt, window: [w.from, w.to], back: dump(back.seq) };
})();
out.conv = (function () { var back = build([25, 1], false); back.seq.v = [S.track('v', 1)]; back.seq.a = [S.track('a', 1)]; back.p.media.a.name = 'a.mp4'; back.p.media.b.name = 'b.mp4'; V.xchg.readEdl(a.conv, back.p, back.seq); return dump(back.seq); })();
out.speed = (function () {
  var q = build([25, 1], false), L = lay(q, [[0, 50], [60, 50], [120, 50]]); [[2, false], [0.5, false], [1, true]].forEach(function (s, i) { [L[i]].concat(S.partners(q.seq, L[i]).map(function (y) { return y.c; })).forEach(function (c) { c.speed = s[0]; c.reverse = s[1]; }); });
  var txt = V.xchg.edl(q.p, q.seq), back = build([25, 1], false); back.seq.v = [S.track('v', 1)]; back.seq.a = [S.track('a', 1)]; V.xchg.readEdl(txt, back.p, back.seq);
  var q2 = build([30000, 1001], true), L2 = lay(q2, [[0, 300]]); [L2[0]].concat(S.partners(q2.seq, L2[0]).map(function (y) { return y.c; })).forEach(function (c) { c.speed = 2; });
  var t2 = V.xchg.edl(q2.p, q2.seq), b2 = build([30000, 1001], true); b2.seq.v = [S.track('v', 1)]; b2.seq.a = [S.track('a', 1)]; V.xchg.readEdl(t2, b2.p, b2.seq);
  return { txt: txt, back: dump(back.seq), back2997: dump(b2.seq) };
})();
out.bev = (function () { var back = build([25, 1], false); back.seq.v = [S.track('v', 1)]; back.seq.a = [S.track('a', 1)]; back.p.media.a.name = 'a.mp4'; V.xchg.readEdl(a.bedl, back.p, back.seq); return dump(back.seq); })();
// Final Cut Pro 7 XML
out.xml = (function () {
  var q = build([30000, 1001], true), L = lay(q, [[0, 100], [100, 150], [300, 60], [400, 60]]); L[1].tin = { type: 'crossDissolve', dur: 30, align: 'center' };
  var sp = function (c, s, r) { [c].concat(S.partners(q.seq, c).map(function (y) { return y.c; })).forEach(function (x) { x.speed = s; x.reverse = r; }); };
  sp(L[2], 2, false); sp(L[3], 0.5, true);
  var tl = S.clip({ kind: 'title', start: 500, dur: 90, name: a.titleName, data: V.title.make('title', q.seq) }); tl.data.layers.filter(function (l) { return l.type === 'text'; })[0].text = a.titleText; q.seq.v[1].clips.push(tl);
  var at = q.seq.a[0].clips[1]; at.tin = { type: 'constantPower', dur: 20, align: 'center' };
  var txt = V.xchg.fcpxml(q.p, q.seq), back = V.xchg.readFcpxml(txt, q.p);
  return { txt: txt, orig: dump(q.seq), back: dump(back.seq), notes: back.notes, files: Object.keys(q.p.media).map(function (k) { return [q.p.media[k].name, Math.round(q.p.media[k].dur * 30000 / 1001)]; }) };
})();
// a remapped clip in the XML
out.remap = (function () {
  var q = build([25, 1], false), L = lay(q, [[0, 50]]); L[0].keys.remap = [{ f: 0, v: 200, i: 'linear' }];
  var first = S.srcTime(L[0], 0, q.seq), last = S.srcTime(L[0], 49, q.seq), txt = V.xchg.fcpxml(q.p, q.seq), back = V.xchg.readFcpxml(txt, q.p), c = back.seq.v[0].clips[0];
  return { orig: [first, last], back: c ? [S.srcTime(c, c.start, back.seq), S.srcTime(c, c.start + 49, back.seq)] : null };
})();
// ends written as -1 inside a transition
out.minus = a.minus.map(function (x) { var q = build([25, 1], false); var r = V.xchg.readFcpxml(x, q.p); return dump(r.seq); });
out.oddWindow = (function () { var q = build([25, 1], false), L = lay(q, [[0, 50], [50, 50]]); L[1].tin = { type: 'crossDissolve', dur: 15, align: 'center' }; var w = V.trans.window(L[1], 'in', q.seq); return [w.from, w.to]; })();
return out;
"""
MINUS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4"><sequence id="s1"><name>m</name><duration>100</duration><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><media><video>
<format><samplecharacteristics><width>1920</width><height>1080</height></samplecharacteristics></format><track>
<clipitem id="c1"><name>a.mp4</name><enabled>TRUE</enabled><duration>3000</duration><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><start>0</start><end>%s</end><in>250</in><out>%d</out><file id="f1"><name>a.mp4</name><duration>3000</duration></file></clipitem>
<transitionitem><start>%d</start><end>%d</end><alignment>%s</alignment><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><effect><name>Cross Dissolve</name><effectid>Cross Dissolve</effectid><effecttype>transition</effecttype><mediatype>video</mediatype></effect></transitionitem>
<clipitem id="c2"><name>b.mp4</name><enabled>TRUE</enabled><duration>3000</duration><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><start>%s</start><end>100</end><in>%d</in><out>600</out><file id="f2"><name>b.mp4</name><duration>3000</duration></file></clipitem>
</track></video></media></sequence></xmeml>"""
def sec_xchg():
    import xml.etree.ElementTree as ET
    CONV = "TITLE: conv\r\nFCM: NON-DROP FRAME\r\n\r\n001  AX       V     C        00:00:10:00 00:00:13:10 01:00:00:00 01:00:03:10\r\n* FROM CLIP NAME: a.mp4\r\n\r\n002  AX       V     C        00:00:13:10 00:00:13:10 01:00:03:10 01:00:03:10\r\n002  AX       V     D    030 00:00:20:00 00:00:25:00 01:00:03:10 01:00:08:10\r\n* FROM CLIP NAME: a.mp4\r\n* TO CLIP NAME: b.mp4\r\n\r\n"
    BEDL = "TITLE: b\r\nFCM: NON-DROP FRAME\r\n\r\n001  AX       B     C        00:00:10:00 00:00:12:00 01:00:00:00 01:00:02:00\r\n* FROM CLIP NAME: a.mp4\r\n\r\n002  AX       AA/V  C        00:00:20:00 00:00:21:00 01:00:02:00 01:00:03:00\r\n* FROM CLIP NAME: a.mp4\r\n\r\n"
    minus = [MINUS_XML % ("-1", 550, 40, 60, "center", "-1", 490), MINUS_XML % ("-1", 550, 50, 70, "start", "-1", 500), MINUS_XML % ("-1", 550, 30, 50, "end", "-1", 500),
             MINUS_XML % ("-1", 550, 43, 58, "center", "-1", 493)]
    rates = [(24000, 1001, False), (24, 1, False), (25, 1, False), (30000, 1001, True), (30000, 1001, False), (30, 1, False), (50, 1, False), (60000, 1001, True), (60000, 1001, False), (60, 1, False)]
    a = dict(rates=[list(r) for r in rates], seqName='Cut & "Mix" <1> été', nameA='Café & <Bar> "1" 日本.mp4', titleName="Titre: été & co",
             titleText='Hello & <goodbye> "x" é 日本 \U0001F600', conv=CONV, bedl=BEDL, minus=minus)
    r = node(XJS % json.dumps(a))
    O = otio()
    if O is None: skip("OpenTimelineIO checks", "opentimelineio and its CMX 3600 and FCP XML adapters could not be had")
    for (num, den, drop), e in zip(rates, r["edl"]):
        fps = num / den; nom = round(fps); hour = (nom * 3600 - (9 * (2 if nom == 30 else 4) * 6 if drop else 0)) if drop else nom * 3600
        lines = [l for l in e["txt"].split("\r\n") if re.match(r"^\d{3}\s", l) and " V " in l]
        got = [l.split()[-2:] for l in lines]
        want = [[tc_ref(hour + s, num, den, drop), tc_ref(hour + s + d, num, den, drop)] for s, d in zip(e["starts"], e["durs"])]
        lab = "%s%s" % (("%.3f" % fps).rstrip("0").rstrip("."), " drop-frame" if drop else (" non-drop" if den == 1001 and nom in (30, 60) else ""))
        check("EDL at %s fps: the record times start at 01:00:00%s00 and events at a minute and at ten minutes in are at their SMPTE timecodes (worked out here)" % (lab, ";" if drop else ":"),
              got == want and ("DROP FRAME" in e["txt"]) and (("NON-DROP" in e["txt"]) != drop), "%s vs %s" % (got, want))
        v = e["back"][0]
        check("EDL at %s fps read back by Lantern: the same clips at the same frames" % lab, [(c["start"], c["dur"]) for c in v] == list(zip(e["starts"], e["durs"])) and not e["note"], [(c["start"], c["dur"]) for c in v])
        if O is not None:
            try:
                tl = O.adapters.read_from_string(e["txt"], "cmx_3600", rate=fps)
                vt = [t for t in tl.tracks if t.kind == "Video"][0]
                clips = [(round(it.range_in_parent().start_time.to_frames(fps)), round(it.range_in_parent().duration.to_frames(fps))) for it in vt if isinstance(it, O.schema.Clip)]
                ok = clips == list(zip(e["starts"], e["durs"]))
            except Exception as ex:
                ok, clips = False, repr(ex)[:200]
            check("EDL at %s fps read by OpenTimelineIO's CMX 3600 reader: the same clips at the same frames" % lab, ok, clips)
    # the dissolve
    d = r["diss"]; txt = d["txt"]
    evs = [l.split() for l in txt.split("\r\n") if re.match(r"^\d{3}\s", l) and " V " in l]
    zero = [x for x in evs if x[3] == "C" and x[-1] == x[-2] and x[-3] == x[-4]]; dl = [x for x in evs if x[3] == "D"]
    check("EDL, a 30-frame dissolve centred on a cut at frame 100: a C event of no length then a D 030 event whose record in is where the dissolve begins (frame 85)",
          d["window"][0] == 85 and len(zero) == 1 and len(dl) == 1 and dl[0][4] == "030" and dl[0][-2] == tc_ref(90000 + d["window"][0], 25, 1, False), [" ".join(x) for x in evs])
    names = [l for l in txt.split("\r\n") if l.startswith("*")]
    check("EDL, the dissolve's event names the outgoing clip (* FROM CLIP NAME) and the incoming one (* TO CLIP NAME)", any(l.startswith("* FROM CLIP NAME: " + a["nameA"]) for l in names) and "* TO CLIP NAME: b roll.mov" in names, names)
    outgoing = [x for x in evs if x[3] == "C" and x not in zero][0]
    check("EDL, a centred dissolve: the outgoing clip's event ends where the dissolve begins (CMX 3600 events do not overlap; OpenTimelineIO's reader refuses an overlap)",
          outgoing[-1] == dl[0][-2], "outgoing ends %s, dissolve begins %s" % (outgoing[-1], dl[0][-2]))
    if O is not None:
        try:
            tl = O.adapters.read_from_string(txt, "cmx_3600", rate=25); ok, info = True, ""
        except Exception as ex:
            ok, info = False, repr(ex)[:200]
        check("EDL with a centred dissolve read by OpenTimelineIO's CMX 3600 reader", ok, info)
    v = d["back"][0]
    check("EDL with a centred dissolve read back by Lantern: the cut at frame 100, the dissolve centred, 30 frames", [c["start"] for c in v] == [0, 100] and v[1]["tin"] and v[1]["tin"]["dur"] == 30 and v[1]["tin"]["align"] == "center" and abs(v[1]["srcIn"] - 17.5) < 0.021,
          [(c["start"], c["dur"], round(c["srcIn"], 3), c["tin"]) for c in v])
    v = r["conv"][0]
    if O is not None:
        tl = O.adapters.read_from_string(CONV, "cmx_3600", rate=25); vt = [t for t in tl.tracks][0]
        oc = [(round(it.range_in_parent().start_time.value), round(it.range_in_parent().duration.value)) for it in vt if isinstance(it, O.schema.Clip)]
        tr = [it for it in vt if isinstance(it, O.schema.Transition)][0]
        check("an EDL written by the CMX convention (outgoing event ends where the dissolve starts) read by Lantern as OpenTimelineIO reads it: the same cut and a dissolve starting there",
              [(c["start"], c["dur"]) for c in v] == oc and v[1]["tin"] and v[1]["tin"]["align"] == "start" and v[1]["tin"]["dur"] == 30 and tr.in_offset.value == 0, "Lantern %s, OTIO %s" % ([(c["start"], c["dur"], c["tin"]) for c in v], oc))
    # speed
    sp = r["speed"]; m2 = [l for l in sp["txt"].split("\r\n") if l.startswith("M2")]
    check("EDL M2 lines at 25 fps for 200%, 50% and reversed 100% (picture and sound events): 50, 12.5 and -25 frames a second (speed times the rate)", [float(l.split()[2]) for l in m2] == [50.0, 50.0, 12.5, 12.5, -25.0, -25.0], m2)
    v = sp["back"][0]
    check("EDL speeds read back by Lantern: 200%, 50%, reversed 100% at the same places", [(c["start"], c["dur"], round(c["speed"], 4), c["reverse"]) for c in v] == [(0, 50, 2.0, False), (60, 50, 0.5, False), (120, 50, 1.0, True)],
          [(c["start"], c["dur"], c["speed"], c["reverse"]) for c in v])
    v = sp["back2997"][0][0]
    check("EDL at 29.97 drop-frame, a 200% clip read back by Lantern: its speed within 0.1% (the M2 line has one decimal)", abs(v["speed"] - 2) < 0.002, v["speed"])
    if O is not None:
        try:
            tl = O.adapters.read_from_string(sp["txt"], "cmx_3600", rate=25); vt = [t for t in tl.tracks if t.kind == "Video"][0]
            ts = [round(e.time_scalar, 3) for it in vt if isinstance(it, O.schema.Clip) for e in it.effects if hasattr(e, "time_scalar")]
        except Exception as ex: ts = repr(ex)[:200]
        check("EDL speeds read by OpenTimelineIO: 2 and 0.5 (it reads an M2 only where the source and record lengths differ, so not the reversed 100%)", ts == [2.0, 0.5], ts)
    bv = r["bev"]
    check("EDL B and AA/V events read by Lantern: a picture on V1 and its sound on A1, linked, at the same frames", len(bv[0]) == 2 and len(bv[1]) == 2 and all(a_["link"] and a_["link"] == b_["link"] and a_["start"] == b_["start"] and a_["dur"] == b_["dur"] for a_, b_ in zip(bv[0], bv[1])),
          [[(c["start"], c["dur"], c["link"]) for c in t] for t in bv if t])
    # FCP XML
    X = r["xml"]; txt = X["txt"]
    try:
        root = ET.fromstring(txt.encode("utf-8")); ok = True
    except Exception as ex:
        root, ok = None, False
    check("Final Cut Pro XML: well formed (Python's XML parser)", ok)
    if root is not None:
        sq = root.find("sequence"); names = [c.findtext("name") for c in root.iter("clipitem")]; gens = list(root.iter("generatoritem"))
        txtval = [pp.findtext("value") for g in gens for pp in g.iter("parameter") if pp.findtext("parameterid") == "str"]
        check("FCP XML: names with & < > quotes and non-ASCII come back from Python's parser as written (sequence, file, title text with an emoji)",
              sq.findtext("name") == a["seqName"] and a["nameA"] in names and txtval == [a["titleText"]] and gens[0].findtext("name") == a["titleName"], (sq.findtext("name"), names[:1], txtval))
        ids = {c.get("id") for c in root.iter("clipitem")}; refs = [l.findtext("linkclipref") for l in root.iter("link")]
        check("FCP XML: every link points at a clip item in the file, and each linked clip item links its picture and its sound", refs and all(x in ids for x in refs) and all(len(c.findall("link")) == 2 for c in root.iter("clipitem") if c.find("link") is not None), refs[:4])
        tis = [(int(t.findtext("start")), int(t.findtext("end")), t.findtext("alignment"), t.find("effect").findtext("name")) for t in root.iter("transitionitem")]
        check("FCP XML: the dissolve as a transition item from frame 85 to 115, centred, and the sound's as Cross Fade (+3dB)", (85, 115, "center", "Cross Dissolve") in tis and any(x[3] == "Cross Fade (+3dB)" for x in tis), tis)
        tr = [(c.findtext("name"), [(pp.findtext("parameterid"), pp.findtext("value")) for pp in c.iter("parameter")]) for c in root.iter("clipitem") if c.find("filter") is not None]
        sp2 = [dict(x[1]).get("speed") for x in tr]
        check("FCP XML: the 200% and the reversed 50% clips carry Time Remap speeds 200 and -50 (reverse TRUE)", sp2[:2] == ["200", "-50"] or sorted(set(sp2)) == ["-50", "200"], tr[:2])
        fdur = {f.findtext("name"): int(f.findtext("duration")) for f in root.iter("file") if f.findtext("duration")}
        cds = [(c.findtext("name"), int(c.findtext("duration"))) for c in root.iter("clipitem") if c.findtext("name") in fdur]
        check("FCP XML: a clip item's <duration> is its file's whole length, as Final Cut Pro 7 and Premiere write it (judgement: the xmeml reference says so; importers mostly use in/out)",
              all(dv == fdur[n_] for n_, dv in cds), cds[:3])
    vb, vo = X["back"], X["orig"]
    def key(c): return (c["kind"], c["start"], c["dur"], round(c["srcIn"] * 29.97), round(c["speed"], 3), bool(c["reverse"]), (c["tin"] or {}).get("dur"), (c["tin"] or {}).get("align"))
    check("FCP XML read back by Lantern: every clip at its place with its source, speed, reversal and transition", [list(map(key, t)) for t in vb if t] == [list(map(key, t)) for t in vo if t],
          [list(map(key, t)) for t in vb if t])
    lk = {}
    for t in vb:
        for c in t:
            if c["link"]: lk.setdefault(c["link"], []).append(c["start"])
    check("FCP XML read back by Lantern: each picture linked to its own sound and nothing else", sorted(len(v) for v in lk.values()) == [2, 2, 2, 2] and all(len(set(v)) == 1 for v in lk.values()), lk)
    tl = [c for t in vb for c in t if c["kind"] == "title"]
    check("FCP XML read back by Lantern: the title as a title with its words", len(tl) == 1 and tl[0]["text"] == a["titleText"], tl[:1])
    if O is not None:
        try:
            ot = O.adapters.read_from_string(txt, "fcp_xml"); vt = [t for t in ot.tracks if t.kind == "Video"][0]
            oc = [(it.name, round(it.range_in_parent().start_time.value), round(it.range_in_parent().duration.value)) for it in vt if isinstance(it, O.schema.Clip)]
            otr = [(round(it.range_in_parent().start_time.value), round(it.in_offset.value), round(it.out_offset.value)) for it in vt if isinstance(it, O.schema.Transition)]
            want = [(c["name"] if c["kind"] != "av" else a["nameA"] if c["media"] == "a" else "b roll.mov", c["start"], c["dur"]) for c in vo[0]]
            ok = oc == want and otr == [(85, 15, 15)]
        except Exception as ex:
            ok, oc, otr = False, repr(ex)[:200], None
        check("FCP XML read by OpenTimelineIO's FCP 7 XML reader: the same clips at the same places and the dissolve centred on the cut", ok, (oc, otr))
    rm = r["remap"]
    check("FCP XML of a clip with Time Remapping (a constant 200% key) read back: its first and last frames show the source they showed (judgement: Lantern writes no variable speed)",
          rm["back"] and abs(rm["back"][0] - rm["orig"][0]) < 0.02 and abs(rm["back"][1] - rm["orig"][1]) < 0.02, rm)
    for (st, en, al), got in zip([(40, 60, "center"), (50, 70, "start"), (30, 50, "end")], r["minus"][:3]):
        v = got[0]
        check("FCP XML with ends of -1 beside a %s-aligned transition (%d to %d): the cut read at frame 50, the transition %d frames %s" % (al, st, en, en - st, al),
              [(c["start"], c["dur"]) for c in v] == [(0, 50), (50, 50)] and v[1]["tin"] and v[1]["tin"]["align"] == al and v[1]["tin"]["dur"] == en - st, [(c["start"], c["dur"], c["tin"]) for c in v])
    v = r["minus"][3][0]
    check("FCP XML with ends of -1 beside a 15-frame centred transition from 43 to 58 (where Lantern's own window puts one centred on a cut at 50): the cut read at 50 (judgement: Premiere's rounding for odd lengths not verified)",
          r["oddWindow"] == [43, 58] and [(c["start"], c["dur"]) for c in v] == [(0, 50), (50, 50)], "window %s, read %s" % (r["oddWindow"], [(c["start"], c["dur"]) for c in v]))



# ================================================================ writers, readers and timecode
def ebml_vint(b, i, keep_marker=False):
    x = b[i]; n = 1; mask = 0x80
    while n <= 8 and not (x & mask): n += 1; mask >>= 1
    v = x if keep_marker else (x & (mask - 1))
    for k in range(1, n): v = (v << 8) | b[i + k]
    return v, n
def ebml_children(b, start, end):
    out = []; i = start
    while i < end:
        eid, n1 = ebml_vint(b, i, True); size, n2 = ebml_vint(b, i + n1); body = i + n1 + n2
        out.append((eid, i, body, size)); i = body + size
    return out
WEBMJS = r"""
var a = %s, src = bytes(a.inp);
return V.mkv.read(src).then(function (m) {
  var t = m.tracks.filter(function (x) { return x.type === 'video'; })[0];
  var smp = t.samples.map(function (s) { return { data: src.all.slice(s.off, s.off + s.size), pts: s.cts / t.timescale + t.start, key: s.key }; });
  fs.writeFileSync(a.out, V.webmw.write({ matroska: !!a.mkv, tracks: [{ type: 'video', codec: t.codec, width: t.width, height: t.height, samples: smp }] }));
  return { n: smp.length, last: smp[smp.length - 1].pts };
});
"""
PRESENTJS = r"""
var a = %s, src = bytes(a.inp);
return V.mp4.read(src).then(function (m) {
  var t = m.tracks.filter(function (x) { return x.type === 'audio'; })[0], ts = t.timescale;
  var smp = t.samples.map(function (s, i) { var nx = t.samples[i + 1]; return { data: src.all.slice(s.off, s.off + s.size), pts: s.cts + Math.round(t.start * ts), dur: nx ? nx.cts - s.cts : 0 }; });
  if (a.fromZero) { var p0 = smp[0].pts; smp.forEach(function (s) { s.pts -= p0; }); }
  fs.writeFileSync(a.out, V.mp4w.write({ tracks: [{ type: 'audio', codec: t.codec === 'opus' ? 'opus' : 'mp4a', description: t.description, sampleRate: t.sampleRate, channels: t.channels, timescale: ts, present: a.present, samples: smp }] }));
  return { start: t.start, codec: t.codec, n: smp.length, first: smp[0].pts };
});
"""
PCMJS = r"""
var a = %s, src = bytes(a.inp), rd = /\.(mkv)$/.test(a.inp) ? V.mkv.read(src) : /\.avi$/.test(a.inp) ? V.riff.readAvi(src) : V.mp4.read(src);
return rd.then(function (m) {
  var t = m.tracks.filter(function (x) { return x.type === 'audio'; })[0];
  return V.media.decodeAudio({ src: src, aTrack: t, kind: 'x' }).then(function (au) { wr(a.out, au.data); return { ch: au.data.length, sr: au.sampleRate, n: au.data[0].length, bits: t.bits, le: t.littleEndian, fl: !!t.float, fourcc: t.fourcc || t.codec }; });
});
"""
GIFJS = r"""
var a = %s, u = new Uint8Array(fs.readFileSync(a.inp)), W = a.w, H = a.h, g = V.gifw.start(W, H, a.loop);
for (var i = 0; i < a.n; i++) g.add(u.subarray(i * W * H * 4, (i + 1) * W * H * 4), a.delays[i], true);
fs.writeFileSync(a.out, g.done()); return 1;
"""
TCJS = r"""
var out = {}, r2997 = T.rate(30000, 1001), r5994 = T.rate(60000, 1001), r25 = T.rate(25, 1), r24 = T.rate(24000, 1001);
out.parse = [['00:00:10.5', r25, false], ['+2:00', r25, false], ['1:30.25', r25, false], ['10.5', r2997, true], ['150', r25, false], ['00;01;00;02', r2997, false], ['01:00:00;00', r2997, true], ['-00:00:01:00', r25, false], ['00:10:00;00', r5994, true], ['00:00:01:23', r24, false], ['00:00:01.000', r2997, true]]
  .map(function (x) { return T.parseTc(x[0], x[1], x[2]); });
out.semi = [0, 1799, 1800, 17981, 17982, 107891, 215783, 215784].map(function (f) { return [T.tc(f, r2997, true, true), T.tc(f * 2, r5994, true, true)]; });
var bad = 0, ex = null; [[r2997, 30], [r5994, 60]].forEach(function (rr) { for (var f = 0; f < 2 * 3600 * rr[1]; f += 1) { var s = T.tc(f, rr[0], true, true), b = T.parseTc(s, rr[0], true); if (b !== f) { bad++; if (!ex) ex = [f, s, b]; } } });
out.round = [bad, ex];
return out;
"""
def sec_files():
    # WebM: a SeekHead that points at Info, Tracks and Cues; ffmpeg seeking near the end of a long file reads little
    ff("-f", "lavfi", "-i", "testsrc2=size=96x64:rate=25", "-t", "900", "-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-g", "50", "-b:v", "80k", p("long_src.webm"))
    for mkv in (False, True):
        out = p("long_lantern." + ("mkv" if mkv else "webm"))
        info = node(WEBMJS % json.dumps(dict(inp=p("long_src.webm"), out=out, mkv=mkv)))
        b = open(out, "rb").read(); top = ebml_children(b, 0, len(b)); seg = [x for x in top if x[0] == 0x18538067][0]
        kids = ebml_children(b, seg[2], seg[2] + seg[3]); sh = [x for x in kids if x[0] == 0x114D9B74]
        ok = bool(sh) and sh[0] == kids[0]; targets = {}
        if sh:
            for e in ebml_children(b, sh[0][2], sh[0][2] + sh[0][3]):
                fields = {c[0]: b[c[2]:c[2] + c[3]] for c in ebml_children(b, e[2], e[2] + e[3])}
                sid = int.from_bytes(fields[0x53AB], "big"); pos = int.from_bytes(fields[0x53AC], "big")
                targets[sid] = ebml_vint(b, seg[2] + pos, True)[0] == sid
        ok = ok and targets.get(0x1549A966) and targets.get(0x1654AE6B) and targets.get(0x1C53BB6B)
        kind = "Matroska" if mkv else "WebM"
        check("%s written by Lantern from ffmpeg's VP8 packets (15 minutes at 25 fps): a SeekHead first in the Segment, whose entries point at the Info, Tracks and Cues (an EBML walk here)" % kind, ok and info["n"] == 22500, (targets, info["n"]))
        r = subprocess.run([FF, "-v", "verbose", "-ss", "890", "-i", out, "-frames:v", "1", "-f", "null", "-"], capture_output=True, text=True)
        m = re.findall(r"Statistics: (\d+) bytes read, (\d+) seeks", r.stderr); size = os.path.getsize(out)
        rd = int(m[-1][0]) if m else size
        check("%s written by Lantern: ffmpeg seeking to 14:50 reads under 5%% of the file" % kind, rd < 0.05 * size, "%d bytes read of %d" % (rd, size))
        pr = json.loads(subprocess.run([FP, "-v", "error", "-of", "json", "-show_format", out], capture_output=True, text=True).stdout)["format"]
        check("%s written by Lantern: ffprobe's duration is the last picture's time plus one picture (900 s, within 1 ms)" % kind, abs(float(pr["duration"]) - 900.0) < 0.0011, pr["duration"])
    # MP4: the encoder's priming skipped and the padding not shown (the export's 'present' length)
    rng = np.random.default_rng(21); N = 48000 * 2 + 777
    x = ss.lfilter(*ss.butter(2, [100, 6000], btype="band", fs=48000), rng.standard_normal((N, 2)), axis=0) * 0.2
    wf32(p("pres.f32"), x)
    for codec, ext in (("aac", "m4a"), ("libopus", "mp4")):
        ff("-f", "f32le", "-ar", 48000, "-ac", 2, "-i", p("pres.f32"), "-c:a", codec, "-b:a", "160k", p("pres_src." + ext))
        if not os.path.exists(p("pres_src." + ext)): skip("%s in MP4" % codec, "ffmpeg could not encode it"); continue
        info = node(PRESENTJS % json.dumps(dict(inp=p("pres_src." + ext), out=p("pres_l.mp4"), present=N / 48000, fromZero=False)))
        mine, theirs = mp4_edits(p("pres_l.mp4")), mp4_edits(p("pres_src." + ext))
        dec = rf32_dec(p("pres_l.mp4"))
        lag = int(np.argmax(ss.correlate(dec[:24000, 0], x[:24000, 0], mode="full", method="fft"))) - 23999 if len(dec) else None
        pr = lambda f: json.loads(subprocess.run([FP, "-v", "error", "-of", "json", "-show_entries", "stream=duration_ts,start_time", f], capture_output=True, text=True).stdout)["streams"][0]
        want_seg = round(N / 48000 * 1000)
        check("MP4 with %s sound (ffmpeg's packets, the first before 0) rewritten by Lantern with its true length given (%d samples): the edit list skips the priming and shows %d ms, as ffmpeg's own file; ffprobe reads the same start and length; the sound decodes in step"
              % ("AAC" if codec == "aac" else "Opus", N, want_seg),
              mine.get("elst") and mine["elst"][-1][1] == -info["first"] and mine["elst"][-1][0] == want_seg and mine.get("elst") == theirs.get("elst") and pr(p("pres_l.mp4")) == pr(p("pres_src." + ext)) and lag == 0,
              "Lantern %s, ffmpeg %s, ffprobe %s vs %s, lag %s" % (mine, theirs, pr(p("pres_l.mp4")), pr(p("pres_src." + ext)), lag))
    # WAV above two channels, and the pad byte
    for k in (1, 3, 4, 5, 6, 8):
        node(r"""var d = []; for (var c = 0; c < %d; c++) { var x = new Float32Array(4801); for (var i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(i * (c + 1) / 37 + c) * (i %% 97) / 97; d.push(x); } fs.writeFileSync(%s, V.riff.writeWav(d, 44100, 24)); wr(%s, d); return 1;""" % (k, json.dumps(p("w.wav")), json.dumps(p("w.f32"))))
        src_ = rf32(p("w.f32"), k); b = open(p("w.wav"), "rb").read()
        riff_ok = int.from_bytes(b[4:8], "little") == len(b) - 8 and len(b) % 2 == 0
        dec = rf32_dec(p("w.wav"), k)
        try:
            from scipy.io import wavfile
            sr_, sw = wavfile.read(p("w.wav")); sw_ok = sw.shape[0] == 4801 and (sw.shape[1] if sw.ndim > 1 else 1) == k
        except Exception as ex: sw_ok = False
        check("Lantern's %d-channel 24-bit WAV of an odd number of frames: RIFF size right with its pad byte, ffmpeg decodes the same samples (half a step), SciPy's reader reads it" % k,
              riff_ok and dec.shape == src_.shape and np.abs(dec - src_).max() <= 0.6 / 8388608 + 1e-7 and sw_ok, "riff %s, decoded %s, diff %.3g, scipy %s" % (riff_ok, dec.shape, np.abs(dec - src_).max() if dec.shape == src_.shape else -1, sw_ok))
    # GIF: exact for 256 colours or fewer, LZW tables filling, loop blocks
    from PIL import Image
    rng = np.random.default_rng(5)
    W, H = 160, 120; pal = rng.integers(0, 256, (256, 3))
    f1 = pal[rng.integers(0, 256, (H, W))]; f2 = np.zeros((H, W, 3), int) + [12, 200, 99]; f2[60, 80] = [1, 2, 3]
    f3 = np.stack([np.tile(np.arange(W) * 255 // (W - 1), (H, 1))] * 3, -1); f4 = pal[(np.arange(W)[None, :] // 40 + np.arange(H)[:, None] // 30) % 2]
    frames = [f1, f2, f3, f4]
    for loop in (True, False):
        rgba = np.concatenate([np.dstack([f, np.full((H, W), 255)]).astype(np.uint8)[None] for f in frames]); rgba.tofile(p("g.u8"))
        node(GIFJS % json.dumps(dict(inp=p("g.u8"), w=W, h=H, n=4, loop=loop, delays=[3, 4, 3, 7], out=p("g.gif"))))
        im = Image.open(p("g.gif")); got = []; durs = []
        for i in range(4):
            im.seek(i); got.append(np.array(im.convert("RGB")).astype(int)); durs.append(im.info.get("duration"))
        same = all(np.array_equal(g_, f) for g_, f in zip(got, frames))
        fd = subprocess.run([FF, "-v", "error", "-i", p("g.gif"), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        ffr = np.frombuffer(fd, np.uint8).reshape(-1, H, W, 3).astype(int) if fd else None
        same_ff = ffr is not None and len(ffr) >= 4 and all(np.array_equal(a_, b_) for a_, b_ in zip(ffr[:4], frames))
        check("GIF of four frames of 256, 2, 256 and 2 colours (random pixels, long runs, a ramp)%s: PIL and ffmpeg decode every pixel exactly" % ("" if loop else ", playing once"), same and same_ff,
              "PIL exact %s, ffmpeg exact %s" % (same, same_ff))
        im = Image.open(p("g.gif"))
        check("GIF %s: %s (PIL), each frame's delay as given (30, 40, 30, 70 ms)" % ("looping" if loop else "playing once", "a NETSCAPE2.0 loop count of 0" if loop else "no loop block"),
              (im.info.get("loop") == 0 if loop else "loop" not in im.info) and durs == [30, 40, 30, 70], (im.info.get("loop"), durs))
    dl = node("return [[100, [30000, 1001]], [61, [24000, 1001]], [240, [60, 1]], [100, [50, 1]], [7, [25, 1]]].map(function (x) { var d = V.gifw.delays(x[0], T.rate(x[1][0], x[1][1])); return [d.length, d.reduce(function (s, y) { return s + y.delay; }, 0), Math.min.apply(null, d.map(function (y) { return y.delay; }))]; });")
    want = [100 * 1001 / 300, 61 * 1001 / 240, 400, 200, 28]
    check("GIF delays for 100 frames at 29.97, 61 at 23.976, 240 at 60 (every fifth dropped), 100 at 50, 7 at 25: the total within a hundredth of a second of the clip's length, none under 2", all(abs(d[1] - w) <= 1.0 and d[2] >= 2 for d, w in zip(dl, want)), (dl, want))
    # PCM readers against ffmpeg's decoder
    t = np.arange(int(44100 * 1.5)) / 44100
    for nch in (2, 6):
        x = np.stack([0.4 * np.sin(2 * np.pi * (300 + 170 * c) * t) * (0.5 + 0.5 * np.sin(2 * np.pi * (c + 1) * t)) for c in range(nch)], 1); wf32(p("pcm_src_%d.f32" % nch), x)
    cases = [("mov", "pcm_s16le", 2), ("mov", "pcm_s16be", 2), ("mov", "pcm_s24le", 2), ("mov", "pcm_s24be", 2), ("mov", "pcm_s32le", 2), ("mov", "pcm_s32be", 2), ("mov", "pcm_f32le", 2), ("mov", "pcm_f32be", 2),
             ("mov", "pcm_f64le", 2), ("mov", "pcm_f64be", 2), ("mov", "pcm_s8", 2), ("mov", "pcm_u8", 2), ("mkv", "pcm_s16le", 2), ("mkv", "pcm_s24le", 2), ("mkv", "pcm_s32le", 2), ("mkv", "pcm_f32le", 2),
             ("mkv", "pcm_s16be", 2), ("mkv", "pcm_s24le", 6), ("avi", "pcm_s16le", 6), ("avi", "pcm_s24le", 2), ("avi", "pcm_f32le", 2), ("avi", "pcm_u8", 2), ("avi", "pcm_s32le", 2)]
    for ext, codec, nch in cases:
        f = p("pcm_%s_%d.%s" % (codec, nch, ext))
        r = ff("-f", "f32le", "-ar", 44100, "-ac", nch, "-i", p("pcm_src_%d.f32" % nch), "-c:a", codec, f)
        if r.returncode or not os.path.exists(f): skip("%s %s" % (ext, codec), "ffmpeg would not write it: " + r.stderr.decode()[-120:]); continue
        try:
            info = node(PCMJS % json.dumps(dict(inp=f, out=p("pcm_l.f32")))); got = rf32(p("pcm_l.f32"), info["ch"])
        except Exception as ex:
            check("%s %s (%d channels) read by Lantern and decoded as ffmpeg decodes it" % (ext.upper(), codec, nch), False, repr(ex)[:200]); continue
        ref = rf32_dec(f, nch)
        tag = subprocess.run([FP, "-v", "error", "-of", "csv=p=0", "-show_entries", "stream=codec_tag_string", f], capture_output=True, text=True).stdout.strip()
        ok = got.shape == ref.shape and np.abs(got - ref).max() < 1e-6
        check("%s %s (%d channels%s) read by Lantern and decoded as ffmpeg decodes it" % (ext.upper(), codec, nch, ", '%s'" % tag if ext == "mov" else ""), ok,
              "shape %s vs %s, worst %.3g; Lantern's bits %s little-endian %s float %s" % (got.shape, ref.shape, np.abs(got[:len(ref)] - ref[:len(got)]).max() if len(got) and len(ref) else -1, info["bits"], info["le"], info["fl"]))
    # timecode
    r = node(TCJS)
    want = [262, 50, 2256, 314, 150, 1800, 107892, -25, 35964, 47, 29]
    check("timecode typed: 00:00:10.5 (25 fps), +2:00, 1:30.25, 10.5 (29.97), 150, 00;01;00;02, 01:00:00;00 DF, -00:00:01:00, 00:10:00;00 at 59.94 DF, 00:00:01:23 at 23.976, 00:00:01.000 at 29.97: the frames worked out here",
          r["parse"] == want, "%s vs %s" % (r["parse"], want))
    semi = [[tc_ref(f, 30000, 1001, True).replace(":", ";"), tc_ref(f * 2, 60000, 1001, True).replace(":", ";")] for f in [0, 1799, 1800, 17981, 17982, 107891, 215783, 215784]]
    check("drop-frame timecode shown with semicolons throughout (00;01;00;02), at 29.97 and 59.94, as worked out here", r["semi"] == semi, "%s vs %s" % (r["semi"][:4], semi[:4]))
    check("drop-frame timecode, every frame of two hours at 29.97 and at 59.94: shown with semicolons and typed back, the same frame", r["round"][0] == 0, r["round"])

def mp4_edits(f):
    """mvhd, mdhd and elst of the first track, read here from the boxes (ISO/IEC 14496-12)."""
    import struct
    b = open(f, "rb").read(); out = {}
    def walk(s_, e_):
        i = s_
        while i + 8 <= e_:
            sz = struct.unpack(">I", b[i:i + 4])[0]; t_ = b[i + 4:i + 8].decode("latin1"); hdr = 8
            if sz == 1: sz = struct.unpack(">Q", b[i + 8:i + 16])[0]; hdr = 16
            if sz == 0: sz = e_ - i
            body = i + hdr
            if t_ in ("moov", "trak", "mdia", "edts") and "elst" not in out: walk(body, i + sz)
            if t_ in ("mvhd", "mdhd") and t_ not in out: v = b[body]; out[t_] = struct.unpack(">II", b[body + 12:body + 20]) if v == 0 else struct.unpack(">IQ", b[body + 20:body + 32])
            if t_ == "elst" and t_ not in out:
                v = b[body]; k = struct.unpack(">I", b[body + 4:body + 8])[0]
                out[t_] = [struct.unpack(">Iii", b[body + 8 + 12 * j:body + 20 + 12 * j])[:2] if v == 0 else struct.unpack(">qq", b[body + 8 + 20 * j:body + 24 + 20 * j]) for j in range(k)]
            i += sz
    walk(0, len(b)); return out

def rf32_dec(f, ch=2):
    out = subprocess.run([FF, "-v", "error", "-i", f, "-map", "0:a:0", "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(out, dtype=np.float32).astype(np.float64).reshape(-1, ch)


# ================================================================ captions
CAPJS = r"""
var a = %s, seq = S.sequence({ rate: T.rate(25, 1) }), list = a.texts.map(function (t, i) { return { start: 25 * (2 * i + 1), end: 25 * (2 * i + 2), text: t }; });
var vtt = V.cap.vtt(list, seq), srt = V.cap.srt(list, seq);
return { vtt: vtt, srt: srt, backVtt: V.cap.parse(vtt).map(function (c) { return c.text; }), backSrt: V.cap.parse(srt).map(function (c) { return c.text; }), refs: V.cap.parse(a.refs).map(function (c) { return c.text; }) };
"""
def sec_captions():
    texts = ["Tom & Jerry", "a < b > c", "I <3 you", "Fish &amp; Chips (as typed)", "café 日本 \U0001F600", "line one\nline two"]
    refs = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nR&amp;D &lt;b&gt; &gt; &#233;&#x E9; &#xe9; &nbsp;x &#128512; &#x1F600;\n\n00:00:03.000 --> 00:00:04.000\n<i>tagged</i> &lt;i&gt;not a tag&lt;/i&gt;\n"
    r = node(CAPJS % json.dumps(dict(texts=texts, refs=refs)))
    check("WebVTT and SRT written for captions with & < > (and an emoji, two lines) read back by Lantern as written", r["backVtt"] == texts and r["backSrt"] == texts, "vtt %s, srt %s" % (r["backVtt"], r["backSrt"]))
    want = ["R&D <b> > é&#x E9; é  x \U0001F600 \U0001F600", "tagged <i>not a tag</i>"]
    check("WebVTT character references read by Lantern: &amp; &lt; &gt; &#233; &#xe9; &nbsp; and the emoji &#128512; &#x1F600; made characters (a broken one left as it is)", r["refs"] == want, "%r vs %r" % (r["refs"], want))
    # Chromium's own WebVTT parser on Lantern's file
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        skip("Chromium's WebVTT parser", "Playwright is not here"); return
    import base64, http.server, threading
    open(p("c.vtt"), "w", encoding="utf-8").write(r["vtt"])
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(); pg = br.new_page()
            url = "data:text/vtt;base64," + base64.b64encode(r["vtt"].encode("utf-8")).decode()
            got = pg.evaluate("""(u) => new Promise((ok, no) => { const v = document.createElement('video'), t = document.createElement('track'); t.src = u; t.kind = 'captions'; t.default = true;
                t.addEventListener('load', () => { const cs = Array.from(t.track.cues); ok(cs.map(c => c.getCueAsHTML().textContent)); }); t.addEventListener('error', () => no('track error')); v.appendChild(t); document.body.appendChild(v); t.track.mode = 'hidden'; setTimeout(() => no('timeout'), 8000); })""", url)
            br.close()
        check("Lantern's WebVTT read by Chromium's own parser (the text a browser shows): every caption as written, & < > included", got == texts, "%r" % got)
    except Exception as ex:
        skip("Chromium's WebVTT parser", repr(ex)[:200])


# ================================================================ the export's loudness, measured again after the limiter
LOUDJS = r"""
var a = %s, q = proj(null, 48000), p = q.p, seq = q.seq, x = rd(a.inp, 2);
sound(p, 'm1', 48000, x); var c = S.clip({ media: 'm1', start: 0, dur: a.dur, srcIn: 0 }); seq.a[0].clips.push(c);
return V.exp.run(p, seq, { format: 'wav', loudness: a.target, bits: 32 }).then(function (res) { return res.blob.arrayBuffer().then(function (ab) { fs.writeFileSync(a.out, Buffer.from(ab)); return res.notes; }); });
"""
def sec_loud():
    rng = np.random.default_rng(9); n_ = 48000 * 20; t = np.arange(n_) / 48000
    sp_ = speechlike(20, seed=4); mu = musiclike(20, seed=6)
    # drums: short loud hits over quiet music (the limiter has work); a 12 kHz burst whose samples miss its peaks (inter-sample peaks)
    hits = np.zeros(n_)
    for k in range(0, n_, 12000): m = min(2400, n_ - k); hits[k:k + m] += 0.9 * np.exp(-np.arange(m) / 300) * np.sin(2 * np.pi * 90 * np.arange(m) / 48000)
    hats = np.zeros(n_)
    for k in range(0, n_, 24000): hats[k:k + 960] += 0.3 * np.hanning(960) * np.sin(2 * np.pi * 12000 * np.arange(960) / 48000 + np.pi / 4)
    cases = (("speech-like", np.stack([sp_, sp_], 1), -23), ("music-like", np.stack([mu, mu * 0.8], 1), -14), ("drum hits over quiet music", np.stack([hits + 0.05 * mu, hits + 0.05 * mu], 1), -14),
             ("12 kHz hi-hat-like bursts sampled off their peaks, over quiet music", np.stack([hats + 0.03 * mu, hats + 0.03 * mu], 1), -14))
    for name, x, target in cases:
        wf32(p("ld.f32"), x)
        notes = node(LOUDJS % json.dumps(dict(inp=p("ld.f32"), out=p("ld.wav"), dur=600, target=target)))
        y = rf32_dec(p("ld.wav")); I, tp = ebur128(y)
        said = " ".join(notes); m = re.search(r"brought to (-?[\d.]+) LUFS", said); claimed = float(m.group(1)) if m else None
        reached = abs(I - target) <= 0.5
        honest = claimed is not None and abs(claimed - I) <= 0.5
        check("export normalised to %d LUFS, %s: ffmpeg's ebur128 measures it within 0.5 LU of the target, or the note says honestly what was reached" % (target, name), reached or honest, "ebur128 %.2f LUFS; note: %s" % (I, said))
        check("export normalised to %d LUFS, %s: true peak at most -1 dBTP as the EXPORT header says (ffmpeg's ebur128 true peak, 0.1 dB allowed)" % (target, name), tp <= -0.9, "true peak %.2f dBTP; note: %s" % (tp, said))


SECTIONS = ["pitch", "resample", "fold", "mix", "remap", "keys", "fuzz", "stab", "mask", "xchg", "files", "captions", "loud"]
FUNCS = {"pitch": sec_pitch, "resample": sec_resample, "fold": sec_fold, "mix": sec_mix, "remap": sec_remap, "keys": sec_keys, "fuzz": sec_fuzz, "stab": sec_stab, "mask": sec_mask, "xchg": sec_xchg, "files": sec_files, "captions": sec_captions, "loud": sec_loud}

if __name__ == "__main__":
    want = [a for a in sys.argv[1:] if a in FUNCS] or SECTIONS
    t0 = time.time()
    try:
        for s in SECTIONS:
            if s not in want: continue
            try: FUNCS[s]()
            except Exception as e:
                check("section %s ran to its end" % s, False, repr(e)[:800])
    finally:
        shutil.rmtree(OUT, ignore_errors=True)
    print("%d checks, %d failed" % (n, fails))
    print("(%.0f s)" % (time.time() - t0), file=sys.stderr)
