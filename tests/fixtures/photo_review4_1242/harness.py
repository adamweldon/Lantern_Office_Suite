# harness.py -- what run_review.py drives the Photo tile with: a tiny HTTP server for the build and the inputs,
# Chromium through Playwright, and the person's actions (menus, tools, drags, keys, dialogs, panels, drops).
# Reads of the state (Lantern.photo.api.d, compose.all, compose.render) are used only to check results.
# (Started from photo_review2_1242/harness.py, a reviewer's own; extended here for groups, drops and swatches.)
import os, sys, io, json, re, threading, http.server, socketserver, tempfile, hashlib
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BUILD = "/tmp/claude-0/-home-claude/8fe5716b-4972-5db8-b0b2-1be8e4947466/scratchpad/photo_r3/index.html"


class Serve:
    def __init__(self, build, dirs):
        build = os.path.abspath(build); dirs = [os.path.abspath(x) for x in dirs]
        class Hd(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
            def translate_path(self, p):
                p = p.split("?")[0].split("#")[0]
                if p in ("/", "/index.html"): return build
                for dd in dirs:
                    f = os.path.join(dd, p.lstrip("/"))
                    if os.path.exists(f): return f
                return os.path.join(dirs[0], p.lstrip("/"))
        socketserver.TCPServer.allow_reuse_address = True
        self.srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Hd)
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()


class Tile:
    """One page with the Photo tile open."""
    def __init__(self, browser, port, inputs, out, viewport=(1400, 900)):
        self.inputs, self.out, self.port = inputs, out, port
        self.ctx = browser.new_context(accept_downloads=True, viewport={"width": viewport[0], "height": viewport[1]})
        self.pg = self.ctx.new_page(); self.errs = []; self.console = []
        self.pg.on("pageerror", lambda e: self.errs.append(str(e)[:300]))
        self.pg.on("console", lambda m: self.console.append((m.type, m.text[:300])) if m.type in ("error",) else None)
        self.pg.on("dialog", lambda d: d.dismiss())
        self.pg.goto("http://127.0.0.1:%d/index.html#photo" % port)
        self.pg.wait_for_function("!!(window.Lantern && Lantern.photo && Lantern.photo.api)", timeout=90000)
        self.pg.wait_for_selector("text=Open a picture", timeout=30000)

    def close(self):
        try: self.ctx.close()
        except Exception: pass

    # --- reading state (for checks only) ---
    def J(self, s, a=None):
        return self.pg.evaluate(s, a) if a is not None else self.pg.evaluate(s)

    def doc(self):
        return self.J("(() => { var d = Lantern.photo.api.d; if (!d) return null; return {w: d.w, h: d.h, n: d.layers.length, active: d.active, sel: !!d.sel, name: d.name,"
                      " layers: d.layers.map(function (l) { return {name: l.name, kind: l.kind, id: l.id, gid: l.gid == null ? null : l.gid, open: l.open, ph: !!l.previewHidden, x: l.x, y: l.y, w: l.cv ? l.cv.width : null, h: l.cv ? l.cv.height : null, vis: l.visible, op: l.opacity, blend: l.blend, mask: !!l.mask, maskOn: l.mask ? l.mask.on !== false : null, clip: l.clip, lockAlpha: l.lockAlpha, locked: l.locked, fx: !!l.fx}; }),"
                      " hist: d.hist.map(function (h) { return h.label; }), redo: d.redoStack.length}; })()")

    def hist(self):
        return self.J("Lantern.photo.api.d.hist.map(function (h) { return h.label; })")

    def flat(self, x, y):
        return self.J("([x, y]) => Array.prototype.slice.call(Lantern.photo.compose.all(Lantern.photo.api.d).getContext('2d').getImageData(x, y, 1, 1).data)", [x, y])

    def pix(self, x, y, layer=None):
        return self.J("([x, y, i]) => { var d = Lantern.photo.api.d, l = i == null ? d.layers[d.active] : d.layers[i], c = Lantern.photo.compose.render(d, l); return Array.prototype.slice.call(c.getContext('2d').getImageData(x, y, 1, 1).data); }", [x, y, layer])

    def flat_hash(self):
        """a hash of the flattened picture's pixels and its size"""
        return self.J("(() => { var d = Lantern.photo.api.d, c = Lantern.photo.compose.all(d), a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, h1 = 2166136261 >>> 0, h2 = 0; "
                      "for (var i = 0; i < a.length; i++) { h1 = Math.imul(h1 ^ a[i], 16777619) >>> 0; h2 = (h2 + a[i] * (i % 251 + 1)) >>> 0; } return c.width + 'x' + c.height + ':' + h1.toString(16) + ':' + h2.toString(16); })()")

    def layers_hash(self):
        """a hash of every layer as drawn, plus masks and the selection: to tell 'exactly as before'"""
        return self.J("(() => { var d = Lantern.photo.api.d, P = Lantern.photo; function hh(c) { if (!c) return '-'; var a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, h = 2166136261 >>> 0; for (var i = 0; i < a.length; i += 1) h = Math.imul(h ^ a[i], 16777619) >>> 0; return c.width + 'x' + c.height + ':' + h.toString(16); } "
                      "return d.w + 'x' + d.h + '|' + d.layers.map(function (l) { return l.name + '/' + l.kind + '/' + (l.cv ? hh(l.cv) + '@' + l.x + ',' + l.y : '') + '/m:' + (l.mask ? hh(l.mask.cv) + '@' + l.mask.x + ',' + l.mask.y + (l.mask.on === false ? 'off' : '') : '-') + '/' + l.opacity + l.blend + (l.visible ? 'v' : 'h') + (l.adj ? JSON.stringify(l.adj) : ''); }).join(';') + '|sel:' + hh(d.sel); })()")

    def sel_bounds(self):
        return self.J("(() => { var d = Lantern.photo.api.d; if (!d.sel) return null; return Lantern.photo.sel.bounds(Lantern.photo.doc.selMask(d), d.w, d.h); })()")

    def sel_at(self, x, y):
        return self.J("([x, y]) => { var d = Lantern.photo.api.d; if (!d.sel) return 255; return d.sel.getContext('2d').getImageData(x, y, 1, 1).data[3]; }", [x, y])

    def sel_count(self):
        return self.J("(() => { var d = Lantern.photo.api.d; if (!d.sel) return d.w * d.h; var m = Lantern.photo.doc.selMask(d), n = 0; for (var j = 0; j < m.length; j++) if (m[j] > 127) n++; return n; })()")

    def status(self):
        return self.J("(() => { var s = document.querySelectorAll('.ph-status'); return Array.prototype.map.call(s, function (x) { return x.textContent; }).join(' | '); })()")

    def tool_id(self):
        return self.J("Lantern.photo.api.view.tool && Lantern.photo.api.view.tool.id")

    # --- acting as a person ---
    def open(self, name, timeout=60000):
        path = name if os.path.isabs(name) else os.path.join(self.inputs, name)
        base = re.sub(r"\.[A-Za-z0-9]+$", "", os.path.basename(path))
        prev = self.J("Lantern.photo.api.d ? Lantern.photo.api.d.layers[0].id : -1")
        if self.J("!!Lantern.photo.api.d"):
            self.menu("File", "Open…")
        self.pg.set_input_files("input[type=file][accept*=psd]", path)
        self.pg.wait_for_function("(p) => Lantern.photo.api.d && Lantern.photo.api.d.layers[0].id !== p && Lantern.photo.api.d.name === %s" % json.dumps(base), arg=prev, timeout=timeout)
        self.pg.wait_for_timeout(350)

    def new(self, w, h, bg="white"):
        if not self.J("!!Lantern.photo.api.d"):   # the start screen's New... button throws (a finding): reach File > New through a picture
            self.open("one_pixel.png"); self.menu("File", "New…")
        else:
            self.menu("File", "New…")
        self.dlg_set({"w": w, "h": h})
        if bg != "white": self.dlg_select("Background", bg)
        self.ok()

    def scr(self, x, y):
        return self.J("([x, y]) => { var v = Lantern.photo.api.view, r = v.cv.getBoundingClientRect(), s = v.toScreen(x, y); return [r.left + s[0], r.top + s[1]]; }", [x, y])

    def mods_down(self, mods):
        for m in mods or []: self.pg.keyboard.down(m)

    def mods_up(self, mods):
        for m in reversed(mods or []): self.pg.keyboard.up(m)

    def drag(self, a, b, steps=8, mods=None, mods_after_down=None, wait=150, via=None):
        p0 = self.scr(*a); p1 = self.scr(*b)
        self.mods_down(mods)
        self.pg.mouse.move(*p0); self.pg.mouse.down()
        self.mods_down(mods_after_down)
        for v in via or []:
            pv = self.scr(*v); self.pg.mouse.move(*pv, steps=steps)
        self.pg.mouse.move(*p1, steps=steps); self.pg.mouse.up()
        self.mods_up(mods_after_down); self.mods_up(mods)
        self.pg.wait_for_timeout(wait)

    def click(self, pt, mods=None, wait=150, count=1):
        p0 = self.scr(*pt)
        self.mods_down(mods)
        self.pg.mouse.click(*p0, click_count=count)
        self.mods_up(mods)
        self.pg.wait_for_timeout(wait)

    def dbl(self, pt, wait=200):
        p0 = self.scr(*pt); self.pg.mouse.dblclick(*p0); self.pg.wait_for_timeout(wait)

    def key(self, k, wait=150):
        self.pg.keyboard.press(k); self.pg.wait_for_timeout(wait)

    def tool(self, i):
        self.pg.click(".ph-tool[data-id=%s]" % i); self.pg.wait_for_timeout(80)

    def menu(self, *path, wait=200):
        self.pg.click(".ph-mbtn:text-is(%s)" % json.dumps(path[0]))
        sel = ".ph-menubar > .ph-menu"
        for p_ in path[1:]:
            self.pg.click(sel + " > .ph-mitem:has(span:text-is(%s))" % json.dumps(p_, ensure_ascii=False))
            sel = sel + " > .ph-sub"
        self.pg.wait_for_timeout(wait)

    def menu_items(self, top):
        self.pg.click(".ph-mbtn:text-is(%s)" % json.dumps(top))
        items = self.J("Array.prototype.map.call(document.querySelectorAll('.ph-menu > .ph-mitem'), function (b) { return [b.children[0].textContent, b.children[1].textContent]; })")
        self.pg.keyboard.press("Escape"); self.pg.mouse.click(5, 5); self.pg.wait_for_timeout(80)
        return items

    def dialog_open(self):
        return self.J("!!document.querySelector('.ph-dialog')")

    def dlg_fields(self):
        return self.J("Array.prototype.map.call(document.querySelectorAll('.ph-dialog .ph-drow'), function (r) { return r.textContent.slice(0, 60); })")

    def dlg_set(self, vals):
        """set dialog fields by the order of their keys in the box: vals is {label-substring or key: value}. Uses the label text."""
        for k, v in vals.items():
            ok = self.J("""([k, v]) => {
              var rows = document.querySelectorAll('.ph-dialog .ph-drow'), lab = {w: 'Width', h: 'Height'}[k] || k;
              for (var i = 0; i < rows.length; i++) {
                var t = rows[i].textContent;
                if (t.toLowerCase().indexOf(String(lab).toLowerCase()) < 0) continue;
                var inp = rows[i].querySelector('input[type=number]') || rows[i].querySelector('input[type=range]') || rows[i].querySelector('input[type=text]') || rows[i].querySelector('select');
                if (!inp) continue;
                if (inp.type === 'checkbox') { inp.checked = !!v; inp.dispatchEvent(new Event('change', {bubbles: true})); return true; }
                inp.value = v; inp.dispatchEvent(new Event('input', {bubbles: true})); inp.dispatchEvent(new Event('change', {bubbles: true})); return true;
              } return false; }""", [k, v])
            if not ok: raise RuntimeError("no dialog field like %r in %r" % (k, self.dlg_fields()))
        self.pg.wait_for_timeout(250)

    def dlg_type(self, label, value):
        """type into a number box as a person: click it, select all, type, Tab"""
        loc = self.pg.locator(".ph-dialog .ph-drow", has_text=label).locator("input[type=number]").first
        loc.click(); loc.press("Control+a"); loc.type(str(value)); loc.press("Tab"); self.pg.wait_for_timeout(250)

    def dlg_select(self, label, value):
        loc = self.pg.locator(".ph-dialog .ph-drow", has_text=label).locator("select").first
        loc.select_option(value); self.pg.wait_for_timeout(250)

    def dlg_check(self, label, on=True):
        loc = self.pg.locator(".ph-dialog .ph-drow", has_text=label).locator("input[type=checkbox]").first
        if loc.is_checked() != on: loc.click()
        self.pg.wait_for_timeout(200)

    def preview(self, on=True):
        loc = self.pg.locator(".ph-dialog input[type=checkbox]").last
        lab = self.J("Array.prototype.map.call(document.querySelectorAll('.ph-dialog .ph-dfoot label, .ph-dialog .ph-dfoot'), function (x) { return x.textContent; }).join('|')")
        box = self.pg.locator(".ph-dialog .ph-dfoot input[type=checkbox]")
        if box.count():
            if box.first.is_checked() != on: box.first.click()
        self.pg.wait_for_timeout(300)

    def ok(self, wait=350):
        self.pg.click(".ph-dialog button:text-is('OK')"); self.pg.wait_for_timeout(wait)

    def cancel(self, wait=300):
        self.pg.click(".ph-dialog button:text-is('Cancel')"); self.pg.wait_for_timeout(wait)

    def setopt_ui(self, label, value, blur=True):
        """set a value on the options bar by its label, as a person types into it"""
        loc = self.pg.locator(".ph-opts label", has_text=label)
        if loc.count() == 0: raise RuntimeError("no option %r; bar: %r" % (label, self.pg.inner_text(".ph-opts")))
        sel = loc.first.locator("select")
        if sel.count():
            sel.select_option(str(value)); self.pg.wait_for_timeout(100)
            if blur: self.focus_away()
            return
        cb = loc.first.locator("input[type=checkbox]")
        if cb.count():
            if cb.is_checked() != bool(value): cb.click()
            if blur: self.focus_away()
            return
        n = loc.first.locator("input[type=number]")
        n.click(); n.press("Control+a"); n.type(str(value)); n.press("Tab"); self.pg.wait_for_timeout(100)
        if blur: self.focus_away()

    def pick_layer(self, i):
        """click layer i (0 = bottom) in the Layers panel, on its name"""
        n = self.J("Lantern.photo.api.d.layers.length")
        self.pg.locator(".ph-lrow").nth(n - 1 - i).locator(".ph-lname").click(); self.pg.wait_for_timeout(120)

    def focus_away(self):
        """click the status line under the picture, as a person clicks an empty spot, so keys go to the tile again"""
        self.pg.locator(".ph-center .ph-status").click(position={"x": 300, "y": 5}); self.pg.wait_for_timeout(60)

    def opts_text(self):
        return self.pg.inner_text(".ph-opts")

    def set_colour(self, rgb, which="Foreground"):
        """pick a colour in the swatch's colour box (as the colour picker does: an input event)"""
        hx = "#%02x%02x%02x" % tuple(rgb)
        self.J("([w, h]) => { var i = document.querySelector('.ph-swatch input[aria-label=\\'' + w + ' colour\\']'); i.value = h; i.dispatchEvent(new Event('input', {bubbles: true})); i.dispatchEvent(new Event('change', {bubbles: true})); }", [which, hx])

    def fg(self):
        return self.J("Lantern.photo.api.d.fg.slice()")

    def bg(self):
        return self.J("Lantern.photo.api.d.bg.slice()")

    def open_panels(self):
        self.J("Array.prototype.forEach.call(document.querySelectorAll('.ph-side details'), function (x) { x.open = true; })")

    def shot(self, name, full=False):
        p = os.path.join(HERE, "evidence", name)
        self.pg.screenshot(path=p, full_page=full); return p

    def download(self, fn, timeout=60000):
        with self.pg.expect_download(timeout=timeout) as dl:
            fn()
        d = dl.value; p = os.path.join(self.out, d.suggested_filename); d.save_as(p); return p


    # --- added for this review ---
    def rows(self):
        """the Layers panel as shown: [name text, indent px, chosen, twist text or None]"""
        return self.J("""Array.prototype.map.call(document.querySelectorAll('.ph-lrow'), function (r) { var n = r.querySelector('.ph-lname'), t = r.querySelector('.ph-twist');
            return [n ? n.textContent : '', parseInt(r.style.paddingLeft || '0', 10) || 0, r.classList.contains('on'), t ? t.textContent : null]; })""")

    def row_loc(self, name):
        """the Layers panel row whose name is exactly name (a type layer's row adds '  T', a styled one '  fx')"""
        return self.pg.locator(".ph-lrow").filter(has=self.pg.locator(".ph-lname", has_text=re.compile("^" + re.escape(name) + r"(  |$)"))).first

    def row_click(self, name, wait=120):
        """click a layer's name in the Layers panel (as a person picks a layer)"""
        self.row_loc(name).locator(".ph-lname").click(); self.pg.wait_for_timeout(wait)

    def twist(self, name, wait=150):
        self.row_loc(name).locator(".ph-twist").click(); self.pg.wait_for_timeout(wait)

    def lbtn(self, title, wait=200):
        """a button under the Layers list, by its title"""
        self.pg.locator(".ph-lbar button[title=%s]" % json.dumps(title)).click(); self.pg.wait_for_timeout(wait)

    def active_name(self):
        return self.J("(() => { var d = Lantern.photo.api.d; return d.layers[d.active] ? d.layers[d.active].name : null; })()")

    def names(self):
        return self.J("Lantern.photo.api.d.layers.map(function (l) { return l.name; })")

    def struct(self):
        """the layers bottom first as 'name' or 'name<group' (the group holding it)"""
        return self.J("(() => { var d = Lantern.photo.api.d; function nm(id) { for (var k = 0; k < d.layers.length; k++) if (d.layers[k].id === id) return d.layers[k].name; return '?'; } return d.layers.map(function (l) { return l.name + (l.kind === 'group' ? '[G' + (l.open === false ? ' shut' : '') + ']' : '') + (l.gid != null ? '<' + nm(l.gid) : ''); }); })()")

    def center_status(self):
        return self.J("(() => { var s = document.querySelector('.ph-center .ph-status'); return s ? s.textContent : (document.querySelector('.ph-status') || {}).textContent || ''; })()")

    def flat_np(self):
        """the flattened picture as a numpy array (h, w, 4)"""
        import numpy as np, base64
        b64 = self.J("(() => { var c = Lantern.photo.compose.all(Lantern.photo.api.d); return c.toDataURL('image/png').split(',')[1]; })()")
        from PIL import Image
        return np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")).astype(int)

    def sel_np(self):
        import numpy as np
        a = self.J("(() => { var d = Lantern.photo.api.d; if (!d.sel) return null; var m = Lantern.photo.doc.selMask(d); return Array.prototype.slice.call(m); })()")
        if a is None: return None
        w, h = self.J("[Lantern.photo.api.d.w, Lantern.photo.api.d.h]")
        return np.array(a, dtype=np.uint8).reshape(h, w)

    def dt_file(self, url, name, typ):
        self.J("async () => { const r = await fetch(%s); const b = await r.blob(); const f = new File([b], %s, {type: %s}); const dt = new DataTransfer(); dt.items.add(f); window.__dt = dt; return f.size; }" % (json.dumps(url), json.dumps(name), json.dumps(typ)))

    def drop_on(self, selector, url, name, typ, wait=900):
        """a file dragged from the desktop and let go over selector: returns [dragover cancelled, drop cancelled]"""
        self.dt_file(url, name, typ)
        r = self.J("""(sel) => { var z = document.querySelector(sel); if (!z) return null; var r = z.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 20);
            var e1 = new DragEvent('dragenter', {dataTransfer: window.__dt, bubbles: true, cancelable: true, clientX: x, clientY: y}); z.dispatchEvent(e1);
            var e2 = new DragEvent('dragover', {dataTransfer: window.__dt, bubbles: true, cancelable: true, clientX: x, clientY: y}); z.dispatchEvent(e2);
            var e3 = new DragEvent('drop', {dataTransfer: window.__dt, bubbles: true, cancelable: true, clientX: x, clientY: y}); z.dispatchEvent(e3);
            return [e2.defaultPrevented, e3.defaultPrevented]; }""", selector)
        self.pg.wait_for_timeout(wait)
        return r

    def rename(self, old, new):
        """double-click a layer's name in the Layers panel, type the new one, Enter (as a person renames a layer)"""
        loc = self.row_loc(old).locator(".ph-lname")
        loc.dblclick(); self.pg.wait_for_timeout(120)
        inp = self.pg.locator(".ph-lrow input[type=text]")
        inp.press("Control+a"); inp.type(new); inp.press("Enter"); self.pg.wait_for_timeout(150)

    def layer_hash(self, i):
        """a hash of layer i as drawn alone (bottom = 0)"""
        return self.J("(i) => { var d = Lantern.photo.api.d, c = Lantern.photo.compose.render(d, d.layers[i]), a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, h = 2166136261 >>> 0; for (var k = 0; k < a.length; k++) h = Math.imul(h ^ a[k], 16777619) >>> 0; return h.toString(16); }", i)

    def dlg_title(self):
        return self.J("(() => { var t = document.querySelector('.ph-dialog .ph-dtitle'); return t ? t.textContent : null; })()")

    def opt_value(self, label):
        """the number shown on the options bar beside a label"""
        return self.J("(lab) => { var ls = document.querySelectorAll('.ph-opts label'); for (var i = 0; i < ls.length; i++) if (ls[i].textContent.trim().indexOf(lab) === 0) { var n = ls[i].querySelector('input[type=number]') || ls[i].querySelector('select'); return n ? n.value : null; } return null; }", label)

    def place(self, name):
        """File > Place... (as a layer) and choose the file"""
        path = name if os.path.isabs(name) else os.path.join(self.inputs, name)
        n = self.J("Lantern.photo.api.d.layers.length")
        self.menu("File", "Place\u2026 (as a layer)")
        self.pg.set_input_files("input[type=file][accept*=psd]", path)
        self.pg.wait_for_function("(n) => Lantern.photo.api.d.layers.length > n", arg=n, timeout=30000); self.pg.wait_for_timeout(200)

    def dlg_slider(self, label, value):
        """set the slider (or number) whose row's label is exactly label, as a person moves it (input event)"""
        ok = self.J("""([lab, v]) => { var rows = document.querySelectorAll('.ph-dialog .ph-drow');
            for (var i = 0; i < rows.length; i++) { var sp = rows[i].querySelector('span'); if (!sp || sp.textContent.trim() !== lab) continue;
              var inp = rows[i].querySelector('input[type=range]') || rows[i].querySelector('input[type=number]'); if (!inp) continue;
              inp.value = v; inp.dispatchEvent(new Event('input', {bubbles: true})); inp.dispatchEvent(new Event('change', {bubbles: true})); return true; } return false; }""", [label, value])
        if not ok: raise RuntimeError("no slider %r in %r" % (label, self.dlg_fields()))
        self.pg.wait_for_timeout(250)
