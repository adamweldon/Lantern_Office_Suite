# structure.py [inner.html] -- marker balance, size gate, rule 1/6/8 checks, node --check
import re, sys, subprocess, tempfile, os
txt = open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'src', 'lantern.inner.html'), encoding='utf-8').read()
m = re.search(r'<script>\n(.*?)\n</script>', txt, re.S)
js = m.group(1)
starts = re.findall(r'// MODULE: ([A-Z0-9_]+) - START', js)
ends = re.findall(r'// MODULE: ([A-Z0-9_]+) - END', js)
print(f"modules: {len(starts)} START / {len(ends)} END; balanced={sorted(starts)==sorted(ends)}; dupes={[s for s in set(starts) if starts.count(s)>1] or 'none'}")
blocks = re.findall(r'// MODULE: ([A-Z0-9_]+) - START\n(.*?)// MODULE: \1 - END', js, re.S)
over = [(n, len(b.split())) for n, b in blocks if len(b.split()) > 1500]
print("over 1,500-word gate:", over or "none")
# code outside modules (rule 1)
stripped = re.sub(r'// MODULE: ([A-Z0-9_]+) - START\n.*?// MODULE: \1 - END\n?', '', js, flags=re.S)
outside = [l for l in stripped.split('\n') if l.strip() and not l.strip().startswith('//')]
print("non-comment lines outside modules:", len(outside), outside[:3])
# blank-line rule (rule 8)
print("runs of 4+ blank lines:", len(re.findall(r'\n\s*\n\s*\n\s*\n\s*\n', js)))
# rule 6: modern syntax
def mods_with(pat):
    return sorted({n for n, b in blocks if re.search(pat, b)})
print("optional chaining ?. :", mods_with(r'\?\.[A-Za-z_$\[(]'))
print("nullish ?? :", mods_with(r'\?\?'))
print("arrow => :", mods_with(r'\)\s*=>|\b\w+\s*=>'))
print("template literals:", mods_with(r'`'))
print("let/const:", mods_with(r'^\s*(let|const)\s', ) if False else mods_with(r'(?m)^\s*(let|const)\s'))
# rule 5 / 11: style tags
print("modules creating <style>:", mods_with(r'createElement\("style"\)|<style'))
# BOOT position
names = [n for n, _ in blocks]
print("BOOT index:", names.index('BOOT') if 'BOOT' in names else None, "of", len(names), "-> modules after BOOT:", len(names) - names.index('BOOT') - 1)
# syntax
fd, p = tempfile.mkstemp(suffix='.js'); os.write(fd, js.encode()); os.close(fd)
r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
print("node --check:", "OK" if r.returncode == 0 else r.stderr[:400]); os.unlink(p)
