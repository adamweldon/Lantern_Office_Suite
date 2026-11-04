# gms_e2e.py -- a song saved as a Generative Music Studio project opens in GMS (1.24.0). Lantern (served from site/) makes the
# projects -- Ode to Joy for a rock band (tune, chords, bass, drums) and the Little waltz example -- and the standalone
# Generative_Music_Studio.html (Adam's GMS repository) loads each with its own Load path (ProjectPersist.importFromFile): every
# track there, every note's sound made (none missing), the pattern the song's length, and its mix not silent.
# Usage: python3 tests/browser/gms_e2e.py [path to Generative_Music_Studio.html]   (default: ../generative_music_studio/ beside this
# repository, or $GMS_HTML; without it the test says so and passes nothing)
import json, os, sys, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# (a folder given -- the screenshot folder the other browser tests take -- is passed over)
ARG = [a for a in sys.argv[1:] if a.lower().endswith(".html")]
GMS = ARG[0] if ARG else os.environ.get("GMS_HTML") or os.path.join(os.path.dirname(os.path.dirname(ROOT)), "generative_music_studio", "Generative_Music_Studio.html")
if not os.path.exists(GMS):
    GMS = os.path.join(os.path.dirname(ROOT), "generative_music_studio", "Generative_Music_Studio.html")
PORT = 8126
fails = []
def ok(name, cond, info=""):
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "  " + json.dumps(info)[:600]), flush=True)
    if not cond: fails.append(name)
if not os.path.exists(GMS):
    print("NO GMS: Generative_Music_Studio.html not found (give its path) -- nothing tested")
    sys.exit(1)
ODE = ["key C major", "tempo 100", "chords C | G7 | C | G | C | G7 | C | G C | G C | G7 C | G7 E7/G# | Am G",
       "melody E4 E F G | G F E D | C C D E | E - - D D - r - | E E F G | G F E D | C C D E | D - - C C - r - | D D E C | D - E F E - C - | D - E F E - D - | C D r -", "style rock"]
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "site"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page()
        pg.goto("http://127.0.0.1:%d/index.html#music" % PORT)
        pg.wait_for_function("!!(window.Lantern && Lantern.musicGms && Lantern.musicSong)", timeout=30000)
        made = pg.evaluate("""(ode) => {
          const L = window.Lantern, out = {};
          out.ode = L.musicGms.json(L.musicSong.make({ title: 'Ode to Joy', lines: ode }).plan);
          const w = L.musicDocs.EXAMPLES[1][1].split('\\n');
          out.waltz = L.musicGms.json(L.musicSong.make({ title: '', lines: w }).plan);
          return out; }""", ODE)
        pg.close()
        for name, text in sorted(made.items()):
            want = json.loads(text)
            g = b.new_page(); errs = []
            g.on("pageerror", lambda e: errs.append(str(e)[:200]))
            g.goto("file://" + os.path.abspath(GMS))
            g.wait_for_function("typeof ProjectPersist !== 'undefined' && typeof Config !== 'undefined' && !!document.getElementById('btn-play')", timeout=60000)
            time.sleep(0.8)
            r = g.evaluate("""async (text) => {
              await ProjectPersist.importFromFile(new File([text], 'song_GMS.json', { type: 'application/json' }), () => {});
              const missing = await ProjectPersist.countMissingBakes();
              let notes = 0; Config.tracks.forEach(t => t.pattern.forEach(s => { notes += (s.notes || []).length; }));
              const mix = await WavExport.mixPatternStereo(Config.tracks, Config.tempo, Playback.audioCtx.sampleRate);
              let sum = 0; for (let i = 0; i < mix.left.length; i++) sum += mix.left[i] * mix.left[i];
              return { tracks: Config.tracks.map(t => t.name + '/' + t.preset), notes, missing, tempo: Config.tempo, steps: TrackManager.getMaxPatternLength(), rms: Math.sqrt(sum / mix.left.length) };
            }""", text)
            n = sum(len(s["notes"]) for t in want["tracks"] for s in t["pattern"])
            ok("%s: GMS loads it -- %s, %d notes, every note's sound made, the pattern %d sixteenths at %d a minute, its mix not silent" % (name, ", ".join(r["tracks"]), n, want["patternLength"], want["tempo"]),
               r["tracks"] == [t["name"] + "/" + t["preset"] for t in want["tracks"]] and r["notes"] == n and r["missing"] == 0 and r["steps"] == want["patternLength"] and
               r["tempo"] == want["tempo"] and r["rms"] > 0.01 and not errs, [r, errs])
            g.close()
        b.close()
finally:
    srv.terminate()
print("ALL GMS BROWSER TESTS PASS" if not fails else "%d GMS BROWSER FAILURES" % len(fails))
sys.exit(1 if fails else 0)
