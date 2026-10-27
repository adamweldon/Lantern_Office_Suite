#!/usr/bin/env python3
# lantern-kit.py -- Lantern's own window for the laptop / USB kit on Linux:
# install and start Lantern's AI with buttons and popups instead of commands.
#   python3 kit/lantern-kit.py install   engine, model, then the extras you pick (setup-kit.sh)
#   python3 kit/lantern-kit.py start     start the AI and open Lantern (start-lantern.sh)
# "Install Lantern (Linux).desktop" and "Start Lantern (Linux).desktop" open it
# through kit/lantern-kit.sh. It runs the kit's own scripts with LANTERN_UI=1:
# they print @@ lines (steps, files being fetched, questions) and this window
# answers their questions on stdin, so the downloads, checks and choices are
# exactly the ones the scripts make from a terminal.
# Needs Python 3.6+ with Tk (python3-tk, part of Raspberry Pi OS).
# For tests: LANTERN_KIT_AUTO="install,yes,never,close" presses those buttons
# in turn as they appear (after LANTERN_KIT_AUTO_DELAY ms); LANTERN_KIT_TRACE=file
# logs each page and question.
import os, re, sys, time, signal, shutil, threading, queue, subprocess, urllib.request, urllib.error, webbrowser

try:
    import tkinter as tk
    from tkinter import ttk, font as tkfont
except ImportError:
    sys.stderr.write("Python's Tk (python3-tk) is missing\n")
    sys.exit(3)

KIT = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(KIT)
SETUP = os.path.join(KIT, "setup-kit.sh")
START = os.path.join(KIT, "start-lantern.sh")
PORT = os.environ.get("PORT", "8080")
ICON = next((p for p in (os.path.join(KIT, "site", "icons", "icon-192.png"), os.path.join(ROOT, "site", "icons", "icon-192.png"))
             if os.path.exists(p)), "")

SLATE, SLATE2, AMBER, AMBER_DARK = "#1e293b", "#334155", "#fbbf24", "#d97706"
PAPER, INK, MUTED, GOOD, BAD = "#f8fafc", "#0f172a", "#475569", "#15803d", "#b91c1c"

AUTO = [a.strip() for a in os.environ.get("LANTERN_KIT_AUTO", "").split(",") if a.strip()]
AUTO_DELAY = int(os.environ.get("LANTERN_KIT_AUTO_DELAY", "700"))
ASK_TIMEOUT = int(os.environ.get("LANTERN_KIT_ASK_TIMEOUT", "60"))   # Start window: a question answers Not now by itself
TRACE = os.environ.get("LANTERN_KIT_TRACE", "")


def trace(text):
    if TRACE:
        with open(TRACE, "a") as f:
            f.write(text + "\n")


# --- reading the scripts' output ---------------------------------------------
def human_size(tok):
    """curl's sizes (2763M, 6328k, 1.2G, 512) as people read them."""
    m = re.match(r"^([\d.]+)([kMGTP]?)$", tok or "")
    if not m:
        return ""
    n = float(m.group(1)) * {"": 1, "k": 1 << 10, "M": 1 << 20, "G": 1 << 30, "T": 1 << 40, "P": 1 << 50}[m.group(2)]
    if n == 0:
        return ""
    if n >= 1 << 30:
        return "%.1f GB" % (n / (1 << 30))
    if n >= 1 << 20:
        return "%.0f MB" % (n / (1 << 20))
    return "%.0f kB" % (n / (1 << 10))


def human_left(tok):
    """curl's time left (0:03:39, 1d 02h, --:--:--) as people read it."""
    m = re.match(r"^(\d+):(\d\d):(\d\d)$", tok or "")
    if not m:
        return "more than a day" if re.match(r"^\d+d", tok or "") else ""
    secs = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
    if secs < 60:
        return "under a minute"
    if secs < 5400:
        return "about %d minutes" % max(1, round(secs / 60.0))
    return "about %.1f hours" % (secs / 3600.0)


def curl_meter(line):
    """One line of curl's progress meter -> (percent, received, total, speed, left), or None."""
    t = line.split()
    if len(t) != 12 or not (t[0].isdigit() and t[2].isdigit() and t[4].isdigit()):
        return None
    return int(t[0]), human_size(t[3]), human_size(t[1]), human_size(t[11]), human_left(t[10])


def reflow(lines):
    """The scripts wrap their questions for an 80-column terminal; a window reflows them."""
    return " ".join(l.strip() for l in lines if l.strip())


def pretty_model(name):
    name = re.sub(r"\.gguf$", "", name or "")
    name = re.sub(r"-(UD-)?(I?Q\d\w*|F16|BF16)$", "", name)
    return name.replace("-", " ").replace("Qwen3.5 ", "Qwen3.5 ")


class Child:
    """A kit script run with LANTERN_UI=1; its output and exit go to a queue."""

    def __init__(self, argv, events, extra_env=None):
        env = dict(os.environ)
        env.update({"LANTERN_UI": "1", "LANTERN_NO_PAUSE": "1"})
        env.update(extra_env or {})
        env.pop("LANTERN_POPUP", None)
        self.events = events
        self.proc = subprocess.Popen(argv, cwd=KIT, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, start_new_session=True)
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        fd, carry = self.proc.stdout.fileno(), ""
        while True:
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                chunk = b""
            if not chunk:
                break
            carry += chunk.decode("utf-8", "replace")
            parts = re.split(r"(\r\n|\r|\n)", carry)
            carry = parts.pop()  # an unfinished line
            for i in range(0, len(parts), 2):
                self.events.put(("line", parts[i], parts[i + 1] == "\r", self))
        if carry:
            self.events.put(("line", carry, False, self))
        self.events.put(("exit", self.proc.wait(), None, self))

    def answer(self, text):
        try:
            self.proc.stdin.write((text + "\n").encode())
            self.proc.stdin.flush()
        except (OSError, ValueError):
            pass

    def running(self):
        return self.proc.poll() is None

    def stop(self, whole_group=True, wait=8.0):
        """SIGTERM the script (start-lantern.sh then stops its servers); the whole
        process group when asked, or when the script has not gone after wait s."""
        if not self.running():
            return
        try:   # a question it may still be asking reads the end of its input: Not now
            self.proc.stdin.close()
        except (OSError, ValueError):
            pass
        try:
            if whole_group:
                os.killpg(self.proc.pid, signal.SIGTERM)
            else:
                self.proc.send_signal(signal.SIGTERM)
        except OSError:
            pass
        end = time.time() + wait
        while time.time() < end and self.running():
            time.sleep(0.1)
        if self.running():
            for sig in (signal.SIGTERM, signal.SIGKILL):
                try:
                    os.killpg(self.proc.pid, sig)
                except OSError:
                    pass
                time.sleep(0.5)


LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))   # 127.0.0.1 never goes through a proxy


def health():
    """'ready', 'loading' (the server answers, the model is loading), or '' (nothing there)."""
    try:
        with LOCAL.open("http://127.0.0.1:%s/health" % PORT, timeout=1.5) as r:
            return "ready" if r.status == 200 else "loading"
    except urllib.error.HTTPError as e:
        return "loading" if e.code == 503 else "ready"
    except Exception:
        return ""


def computer_name():
    for p in ("/proc/device-tree/model", "/sys/devices/virtual/dmi/id/product_name"):
        try:
            s = open(p, "rb").read().decode("utf-8", "replace").strip("\x00 \n")
            if s and "To be filled" not in s:
                return s
        except OSError:
            pass
    return os.uname().nodename


def os_name():
    try:
        for line in open("/etc/os-release"):
            if line.startswith("PRETTY_NAME="):
                return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return "Linux"


def kit_info():
    try:
        out = subprocess.run(["sh", SETUP, "info"], cwd=KIT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             timeout=30, universal_newlines=True).stdout
        return dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
    except Exception:
        return {}


def desktop_quote(path):
    """A path as one argument of a desktop entry's Exec line (freedesktop rules)."""
    p = path.replace("\\", "\\\\\\\\").replace('"', '\\\\"').replace("$", "\\\\$").replace("`", "\\\\`")
    return '"%s"' % p


def desktop_dir():
    try:
        for line in open(os.path.expanduser("~/.config/user-dirs.dirs")):
            m = re.match(r'^XDG_DESKTOP_DIR="(.*)"', line.strip())
            if m:
                return m.group(1).replace("$HOME", os.path.expanduser("~"))
    except OSError:
        pass
    return os.path.expanduser("~/Desktop")


def on_removable_drive():
    return KIT.startswith(("/media/", "/run/media/", "/mnt/"))


def failure_advice(text, fail):
    """What went wrong and what to do, from the script's FAIL mark and last lines."""
    low = text.lower()
    if fail == "fat32":
        return ("This drive is FAT32, and Linux cannot start programs from a FAT32 drive.",
                "Reformat the USB stick as exFAT, or copy the whole Lantern folder onto this computer, then run Install Lantern again.")
    if fail == "tools":
        return ("Building the AI engine needs the build tools, and they are not on this computer.",
                "Open a terminal and type:  sudo apt install build-essential cmake  -- then run Install Lantern again.")
    if fail == "build":
        return ("Building the AI engine stopped before it finished.",
                "Choose Try again: the build carries on where it stopped. The details below show what happened.")
    if fail == "engine":
        return ("The AI engine cannot start on this computer yet.",
                "Choose Try again and then Build it, to make an engine for this computer (10 to 20 minutes on a Raspberry Pi 5).")
    if fail == "net" or re.search(r"curl: \((5|6|7|28|35|52|56)\)|could not resolve|failed to connect|network is unreachable", low):
        return ("Lantern could not reach the internet.",
                "Check the Wi-Fi or network cable, then choose Try again. Downloads carry on where they stopped.")
    if "no space left" in low or "curl: (23)" in low:
        return ("The drive is full.",
                "Free some space (or use a bigger drive), then choose Try again. Downloads carry on where they stopped.")
    if "curl: (22)" in low:
        return ("A download site answered with an error.",
                "Wait a few minutes and choose Try again. If it keeps happening, the details below say which file.")
    return ("Setup stopped before it finished.", "Choose Try again. The details below show the last thing it did.")


# --- the window ----------------------------------------------------------------
class App(tk.Tk):
    STEPS = [("lantern", "Lantern"), ("engine", "AI engine"), ("model", "AI model"), ("more", "Extras you choose"), ("done", "Ready")]

    def __init__(self, mode):
        super().__init__()
        self.mode = mode
        self.events = queue.Queue()
        self.child = None
        self.buttons = {}      # name -> button on the current page (for LANTERN_KIT_AUTO)
        self.ask_buf = None    # an @@ASK being collected
        self.fail = ""
        self.lines = []        # the last output lines
        self.stopping = False
        self.share = False
        self.url = "http://127.0.0.1:%s/" % PORT
        self.phones = []
        self.health_state = ""
        self.title("Lantern")
        self.geometry("700x540")
        self.minsize(560, 440)
        self.configure(bg=PAPER)
        if ICON:
            try:
                self.icon_img = tk.PhotoImage(file=ICON)
                self.iconphoto(True, self.icon_img)
                self.head_img = self.icon_img.subsample(4, 4)
            except tk.TclError:
                self.head_img = None
        else:
            self.head_img = None
        self._style()
        self._header()
        self.body = tk.Frame(self, bg=PAPER)
        self.body.pack(fill="both", expand=True, padx=26, pady=(18, 18))
        self.protocol("WM_DELETE_WINDOW", self.on_close)
        self.after(80, self.poll)
        if mode == "start":
            self.start_lantern()
        else:
            self.page_welcome()

    # look ------------------------------------------------------------------
    def _style(self):
        base = tkfont.nametofont("TkDefaultFont")
        base.configure(size=11)
        for name in ("TkTextFont", "TkMenuFont"):
            try:
                tkfont.nametofont(name).configure(size=11)
            except tk.TclError:
                pass
        fam = base.actual("family")
        self.f_title = tkfont.Font(family=fam, size=17, weight="bold")
        self.f_head = tkfont.Font(family=fam, size=13, weight="bold")
        self.f_bold = tkfont.Font(family=fam, size=11, weight="bold")
        self.f_small = tkfont.Font(family=fam, size=10)
        st = ttk.Style(self)
        try:
            st.theme_use("clam")
        except tk.TclError:
            pass
        st.configure("TFrame", background=PAPER)
        st.configure("TLabel", background=PAPER, foreground=INK)
        st.configure("TCheckbutton", background=PAPER, foreground=INK, indicatorbackground="white", indicatorforeground=SLATE)
        st.map("TCheckbutton", background=[("active", PAPER)])
        st.configure("Primary.TButton", background=AMBER, foreground=SLATE, font=self.f_bold, padding=(18, 9), borderwidth=0)
        st.map("Primary.TButton", background=[("active", "#f59e0b"), ("disabled", "#e2e8f0")])
        st.configure("TButton", padding=(14, 8), background="#e2e8f0", foreground=INK, borderwidth=0)
        st.map("TButton", background=[("active", "#cbd5e1")])
        st.configure("Link.TButton", background=PAPER, foreground=MUTED, padding=(6, 8), borderwidth=0)
        st.map("Link.TButton", background=[("active", PAPER)], foreground=[("active", INK)])
        st.configure("Horizontal.TProgressbar", troughcolor="#e2e8f0", background=AMBER, bordercolor="#e2e8f0",
                     lightcolor=AMBER, darkcolor=AMBER_DARK, thickness=14)

    def _header(self):
        bar = tk.Frame(self, bg=SLATE, height=64)
        bar.pack(fill="x")
        if self.head_img:
            tk.Label(bar, image=self.head_img, bg=SLATE).pack(side="left", padx=(18, 8), pady=8)
        tk.Label(bar, text="Lantern", bg=SLATE, fg="white", font=self.f_head).pack(side="left", pady=8,
                                                                                   padx=(0 if self.head_img else 20, 0))
        self.head_note = tk.Label(bar, text="", bg=SLATE, fg="#cbd5e1", font=self.f_small)
        self.head_note.pack(side="right", padx=18)

    def clear(self, name):
        for w in self.body.winfo_children():
            w.destroy()
        self.buttons = {}
        self.page = name
        trace("page " + name)

    def text(self, parent, s, font=None, fg=INK, pady=(0, 8), wrap=True):
        lab = ttk.Label(parent, text=s, foreground=fg, font=font or tkfont.nametofont("TkDefaultFont"), justify="left")
        lab.pack(anchor="w", fill="x", pady=pady)
        if wrap:
            lab.bind("<Configure>", lambda e: lab.configure(wraplength=max(200, e.width - 4)))
        return lab

    def button_row(self, specs):
        """specs: (name, label, command, kind) -- kind primary / plain / link; link ones sit on the left."""
        row = ttk.Frame(self.body)
        row.pack(side="bottom", fill="x", pady=(12, 0))
        first = None
        for name, label, cmd, kind in specs:
            style = {"primary": "Primary.TButton", "link": "Link.TButton"}.get(kind, "TButton")
            b = ttk.Button(row, text=label, command=cmd, style=style)
            b.pack(side="left" if kind == "link" else "right", padx=(0, 8) if kind == "link" else (8, 0))
            self.buttons[name] = b
            if kind == "primary" and first is None:
                first = b
        if first is not None:
            first.focus_set()
            self.bind("<Return>", lambda e: first.invoke())
        else:
            self.unbind("<Return>")
        self.auto_press()
        return row

    def auto_press(self):
        if AUTO and AUTO[0] in self.buttons:
            name = AUTO.pop(0)
            self.after(AUTO_DELAY, lambda: self.buttons.get(name) and self.buttons[name].invoke())

    def bullets(self, items):
        box = ttk.Frame(self.body)
        box.pack(fill="x", pady=(0, 4))
        box.columnconfigure(1, weight=1)
        for i, item in enumerate(items):
            ttk.Label(box, text="•").grid(row=i, column=0, sticky="nw", padx=(2, 8), pady=1)
            lab = ttk.Label(box, text=item, justify="left")
            lab.grid(row=i, column=1, sticky="ew", pady=1)
            lab.bind("<Configure>", lambda e, l=lab: l.configure(wraplength=max(150, e.width - 4)))

    def facts_box(self, rows):
        box = tk.Frame(self.body, bg="#eef2f7", highlightthickness=0)
        box.pack(fill="x", pady=(6, 10))
        for k, v in rows:
            r = tk.Frame(box, bg="#eef2f7")
            r.pack(fill="x", padx=14, pady=3)
            tk.Label(r, text=k, bg="#eef2f7", fg=MUTED, font=self.f_small, width=14, anchor="w").pack(side="left")
            v_lab = tk.Label(r, text=v, bg="#eef2f7", fg=INK, anchor="w", justify="left")
            v_lab.pack(side="left", fill="x", expand=True)
            v_lab.bind("<Configure>", lambda e, l=v_lab: l.configure(wraplength=max(150, e.width - 4)))
        tk.Frame(box, bg="#eef2f7", height=6).pack()

    def warn(self, s):
        f = tk.Frame(self.body, bg="#fef3c7")
        f.pack(fill="x", pady=(0, 8))
        lab = tk.Label(f, text=s, bg="#fef3c7", fg="#78350f", justify="left", anchor="w")
        lab.pack(fill="x", padx=12, pady=8)
        lab.bind("<Configure>", lambda e: lab.configure(wraplength=max(200, e.width - 4)))

    # install: welcome --------------------------------------------------------
    def page_welcome(self):
        self.clear("welcome")
        self.head_note.configure(text="Install")
        info = kit_info()
        mem_gb = int(info.get("mem_mb", "0") or 0) / 1024.0
        installed = info.get("have_base") == "1" and info.get("engine") == "ok" and info.get("have_site") == "1"
        free = info.get("free_gb", "")
        try:
            size = float(info.get("base_gb", "0")) + float(info.get("vision_gb", "0"))
        except ValueError:
            size = 0
        if installed:
            self.text(self.body, "Lantern is installed here", self.f_title, pady=(0, 6))
            self.text(self.body, "Everything Lantern needs is in this folder. Start Lantern to use it, or check for "
                                 "anything missing and the extras this computer can use.", fg=MUTED)
        else:
            self.text(self.body, "Install Lantern", self.f_title, pady=(0, 6))
            self.text(self.body, "Lantern and its AI run on this computer and need no internet after this. "
                                 "This sets them up once, by itself:", fg=MUTED)
            self.bullets(([] if info.get("have_site") == "1" else ["Lantern itself (about 10 MB, from GitHub)"]) +
                         ["The AI engine (llama.cpp)",
                          "%s, the AI model that suits %s of memory%s" % (
                              info.get("base", "the AI model"), ("%.0f GB" % mem_gb) if mem_gb else "this computer's amount",
                              (" (about %.1f GB)" % size) if size else ""),
                          "Then you choose: a stronger model if this computer can run one, and an offline encyclopedia"])
        rows = [("This computer", "%s · %s%s" % (computer_name(), ("%.0f GB memory · " % mem_gb) if mem_gb else "", os_name()))]
        rows.append(("Saved in", "%s%s" % (KIT, ("  ·  %s GB free" % free) if free else "")))
        if installed and info.get("best"):
            rows.append(("AI model", info["best"]))
        self.facts_box(rows)
        fs = info.get("fs", "").lower()
        if fs.startswith(("msdos", "vfat", "fat")):
            self.warn("This drive is FAT32. Linux cannot start programs from it and it cannot hold files over 4 GB. "
                      "Reformat the stick as exFAT, or copy the Lantern folder onto this computer first.")
        elif free and size:
            try:
                if float(free) < size + 1:
                    self.warn("This drive has %s GB free; the AI needs about %.0f GB. Free some space first." % (free, size + 1))
            except ValueError:
                pass
        eng = info.get("engine", "ok")
        if eng not in ("ok", "it is not in the kit", ""):
            self.warn("The AI engine in this folder does not start on this computer (%s). The installer will offer to "
                      "build one for this computer instead." % eng)
        if not installed:
            self.text(self.body, "It needs the internet now. If a download stops, it carries on where it stopped next time.",
                      font=self.f_small, fg=MUTED, pady=(6, 0))
            self.button_row([("install", "Install", self.run_setup, "primary"), ("close", "Cancel", self.destroy, "plain")])
        else:
            self.button_row([("start", "Start Lantern", self.start_lantern, "primary"),
                             ("install", "Check for extras", self.run_setup, "plain"), ("close", "Close", self.destroy, "link")])

    # install: working --------------------------------------------------------
    def run_setup(self):
        self.clear("work")
        self.head_note.configure(text="Installing")
        self.fail, self.lines, self.step_i, self.stopping, self.warnings = "", [], -1, False, []
        self.text(self.body, "Installing Lantern", self.f_title, pady=(0, 10))
        steps = ttk.Frame(self.body)
        steps.pack(fill="x", pady=(0, 12))
        self.step_labels = []
        for i, (sid, label) in enumerate(self.STEPS):
            f = ttk.Frame(steps)
            f.pack(side="left", padx=(0, 18))
            dot = tk.Label(f, text="○", bg=PAPER, fg=MUTED, font=self.f_head)
            dot.pack(side="left")
            lab = tk.Label(f, text=label, bg=PAPER, fg=MUTED)
            lab.pack(side="left", padx=(4, 0))
            self.step_labels.append((dot, lab))
        self.now = self.text(self.body, "Starting…", self.f_bold, pady=(4, 6))
        self.bar = ttk.Progressbar(self.body, mode="indeterminate", style="Horizontal.TProgressbar")
        self.bar.pack(fill="x", pady=(0, 6))
        self.bar.start(12)
        self.bar_mode = "indeterminate"
        self.detail = self.text(self.body, " ", self.f_small, fg=MUTED, pady=(0, 8))
        self.log_box = None
        tog = ttk.Button(self.body, text="Show details", style="Link.TButton", command=self.toggle_log)
        tog.pack(anchor="w")
        self.log_toggle = tog
        self.log_frame = ttk.Frame(self.body)
        self.button_row([("stop", "Stop", self.stop_setup, "plain")])
        self.set_step("lantern")
        self.child = Child(["sh", SETUP], self.events)

    def toggle_log(self):
        if self.log_box is None:
            self.log_frame.pack(fill="both", expand=True, pady=(4, 0))
            self.log_box = tk.Text(self.log_frame, height=8, bg="#0f172a", fg="#e2e8f0", font=("monospace", 9),
                                   relief="flat", wrap="word", padx=8, pady=6)
            sb = ttk.Scrollbar(self.log_frame, command=self.log_box.yview)
            self.log_box.configure(yscrollcommand=sb.set)
            sb.pack(side="right", fill="y")
            self.log_box.pack(side="left", fill="both", expand=True)
            self.log_box.insert("end", "\n".join(self.lines[-300:]) + "\n")
            self.log_box.see("end")
            self.log_box.configure(state="disabled")
            self.log_toggle.configure(text="Hide details")
        else:
            self.log_frame.pack_forget()
            self.log_box.destroy()
            self.log_box = None
            for w in self.log_frame.winfo_children():
                w.destroy()
            self.log_toggle.configure(text="Show details")

    def set_step(self, sid):
        ids = [s for s, _ in self.STEPS]
        if sid in ("library",):
            sid = "more"
        if sid == "build":
            sid = "engine"
        if sid not in ids:
            return
        i = ids.index(sid)
        if i < self.step_i:
            return
        self.step_i = i
        for j, (dot, lab) in enumerate(self.step_labels):
            if j < i:
                dot.configure(text="✔", fg=GOOD)
                lab.configure(fg=INK)
            elif j == i:
                dot.configure(text="●", fg=AMBER_DARK)
                lab.configure(fg=INK, font=self.f_bold)
            else:
                dot.configure(text="○", fg=MUTED)
                lab.configure(fg=MUTED)

    def progress(self, pct=None):
        if pct is None:
            if self.bar_mode != "indeterminate":
                self.bar.configure(mode="indeterminate")
                self.bar.start(12)
                self.bar_mode = "indeterminate"
        else:
            if self.bar_mode != "determinate":
                self.bar.stop()
                self.bar.configure(mode="determinate", maximum=100)
                self.bar_mode = "determinate"
            self.bar["value"] = max(0, min(100, pct))

    def stop_setup(self):
        if self.ask_yes_no("Stop the installation?", "Downloads that stop now carry on where they stopped the next "
                           "time you run Install Lantern.", "Stop", "Keep going"):
            if self.child and self.child.running():   # it may have finished while this was asked
                self.stopping = True
                threading.Thread(target=self.child.stop, daemon=True).start()

    # install: finished -------------------------------------------------------
    def page_done(self):
        self.clear("done")
        self.head_note.configure(text="Ready")
        info = kit_info()
        self.text(self.body, "Lantern is ready", self.f_title, pady=(0, 6))
        self.text(self.body, "Lantern's AI is installed%s. It works without internet from now on." %
                  ((" with " + info["best"]) if info.get("best") else ""), fg=MUTED)
        self.text(self.body, "To start it later, double-click “Start Lantern” in the Lantern folder.", pady=(4, 10))
        for w in getattr(self, "warnings", []):
            self.warn(w)
        removable = on_removable_drive()
        self.want_menu = tk.BooleanVar(value=not removable)
        self.want_desk = tk.BooleanVar(value=not removable)
        ttk.Checkbutton(self.body, text="Add Lantern to the applications menu", variable=self.want_menu).pack(anchor="w", pady=2)
        ttk.Checkbutton(self.body, text="Put a Lantern icon on the desktop", variable=self.want_desk).pack(anchor="w", pady=2)
        if removable:
            self.text(self.body, "This folder is on a removable drive, so a menu entry or icon would only work while "
                                 "the drive is plugged in.", self.f_small, fg=MUTED, pady=(6, 0))
        self.button_row([("start", "Start Lantern now", lambda: (self.make_shortcuts(), self.start_lantern()), "primary"),
                         ("close", "Close", lambda: (self.make_shortcuts(), self.destroy()), "plain")])

    def make_shortcuts(self):
        entry = ("[Desktop Entry]\nType=Application\nVersion=1.0\nName=Lantern\nComment=Lantern Office Suite with its "
                 "offline AI\nExec=sh %s start\n%sTerminal=false\nCategories=Education;Office;\nStartupNotify=true\n"
                 % (desktop_quote(os.path.join(KIT, "lantern-kit.sh")), ("Icon=%s\n" % ICON) if ICON else ""))
        made = []
        if getattr(self, "want_menu", None) is not None and self.want_menu.get():
            d = os.path.expanduser("~/.local/share/applications")
            try:
                os.makedirs(d, exist_ok=True)
                with open(os.path.join(d, "lantern-kit.desktop"), "w") as f:
                    f.write(entry)
                made.append("menu")
            except OSError:
                pass
        if getattr(self, "want_desk", None) is not None and self.want_desk.get():
            d = desktop_dir()
            if os.path.isdir(d):
                p = os.path.join(d, "Lantern.desktop")
                try:
                    with open(p, "w") as f:
                        f.write(entry)
                    os.chmod(p, 0o755)
                    if shutil.which("gio"):   # GNOME launches desktop icons only when trusted
                        subprocess.run(["gio", "set", p, "metadata::trusted", "true"], stdout=subprocess.DEVNULL,
                                       stderr=subprocess.DEVNULL)
                    made.append("desktop")
                except OSError:
                    pass
        trace("shortcuts " + ",".join(made))

    def page_failed(self, retry, title, what, todo):
        self.clear("failed")
        self.head_note.configure(text="Stopped")
        self.text(self.body, title, self.f_title, pady=(0, 6))
        self.text(self.body, what, self.f_bold, fg=BAD)
        self.text(self.body, todo)
        tail = [l for l in self.lines if l.strip()][-12:]
        if tail:
            box = tk.Text(self.body, height=7, bg="#0f172a", fg="#e2e8f0", font=("monospace", 9), relief="flat",
                          wrap="word", padx=8, pady=6)
            box.insert("end", "\n".join(tail))
            box.configure(state="disabled")
            box.pack(fill="both", expand=True, pady=(6, 0))
        self.button_row([("retry", "Try again", retry, "primary"), ("close", "Close", self.destroy, "plain")])

    # start: Lantern running ---------------------------------------------------
    def start_lantern(self):
        state = health()
        if state:
            self.clear("already")
            self.head_note.configure(text="Running")
            self.text(self.body, "Lantern is already running", self.f_title, pady=(0, 6))
            self.text(self.body, "Its AI is already started on this computer (perhaps from another window). "
                                 "Open Lantern to use it.", fg=MUTED)
            self.button_row([("open", "Open Lantern", lambda: webbrowser.open(self.url), "primary"),
                             ("close", "Close", self.destroy, "plain")])
            return
        self.clear("run")
        self.head_note.configure(text="Starting")
        self.lines, self.fail, self.phones, self.model = [], "", [], ""
        self.health_state, self.ready_at, self.t0 = "", 0, time.time()
        self.run_title = self.text(self.body, "Starting Lantern", self.f_title, pady=(0, 6))
        self.run_model = self.text(self.body, "Finding the best AI model for this computer…", fg=MUTED)
        self.now = self.text(self.body, "Starting the AI…", self.f_bold, pady=(6, 6))
        self.bar = ttk.Progressbar(self.body, mode="indeterminate", style="Horizontal.TProgressbar")
        self.bar.pack(fill="x", pady=(0, 6))
        self.bar.start(12)
        self.bar_mode = "indeterminate"
        self.detail = self.text(self.body, "Lantern opens in your web browser by itself. A big model takes a minute "
                                           "or two to load (longer from a USB stick).", self.f_small, fg=MUTED)
        self.addr = self.text(self.body, "", pady=(8, 0))
        self.bg = self.text(self.body, "", self.f_small, fg=MUTED, pady=(2, 0))
        self.text(self.body, "Keep this window open while you use Lantern: closing it stops the AI.",
                  self.f_small, fg=MUTED, pady=(10, 0))
        self.button_row([("open", "Open Lantern", lambda: webbrowser.open(self.url), "primary"),
                         ("share", "Stop sharing" if self.share else "Share with phones…", self.toggle_share, "plain"),
                         ("stop", "Stop Lantern", self.stop_lantern, "plain")])
        self.stopping = False
        self.child = Child(["sh", START] + (["share"] if self.share else []), self.events)
        self.after(1000, self.watch_health)

    def watch_health(self):
        if self.page != "run" or not self.child or not self.child.running():
            return

        def check():
            s = health()
            self.events.put(("health", s))
        threading.Thread(target=check, daemon=True).start()
        self.after(1500, self.watch_health)

    def on_health(self, s):
        if self.page != "run":
            return
        if s == "loading":
            secs = int(time.time() - self.t0)
            self.now.configure(text="Loading the AI model… (%d s)" % secs)
        elif s == "ready" and self.health_state != "ready":
            self.head_note.configure(text="Running")
            self.run_title.configure(text="Lantern is running")
            self.now.configure(text="The AI is ready.", foreground=GOOD)
            self.bar.stop()
            self.bar.configure(mode="determinate", maximum=100)
            self.bar["value"] = 100
            self.detail.configure(text="Lantern is open in your web browser. If you closed it, choose Open Lantern.")
            trace("ready")
        self.health_state = s or self.health_state
        self.show_addr()

    def show_addr(self):
        s = "Lantern: " + self.url.split("?")[0]
        if self.phones:
            s += "\nPhones and tablets on this Wi-Fi: open " + "  or  ".join(self.phones)
        self.addr.configure(text=s)

    def toggle_share(self):
        if not self.share:
            if not self.ask_yes_no("Share with phones?", "Phones, tablets and other computers on the same Wi-Fi (or this "
                                   "computer's hotspot) can then use Lantern and its AI from their web browsers, with "
                                   "no internet. Lantern restarts to do this.", "Share", "Cancel"):
                return
        self.share = not self.share
        self.restart_lantern()

    def restart_lantern(self):
        self.stopping = True
        child = self.child

        def go():
            if child:
                child.stop(whole_group=False)
            end = time.time() + 10   # until the old server has let go of the address
            while health() and time.time() < end:
                time.sleep(0.3)
            self.events.put(("restart", None))
        threading.Thread(target=go, daemon=True).start()
        self.now.configure(text="Restarting…")

    def stop_lantern(self):
        self.stopping = True
        self.now.configure(text="Stopping…")
        child = self.child

        def go():
            if child:
                child.stop(whole_group=False)
            self.events.put(("stopped", None))
        threading.Thread(target=go, daemon=True).start()

    def page_stopped(self):
        self.clear("stopped")
        self.head_note.configure(text="Stopped")
        self.text(self.body, "Lantern's AI has stopped", self.f_title, pady=(0, 6))
        self.text(self.body, "Lantern pages still open in the browser keep working, but their AI needs Lantern "
                             "started again.", fg=MUTED)
        self.button_row([("start", "Start again", self.start_lantern, "primary"), ("close", "Close", self.destroy, "plain")])

    # questions ---------------------------------------------------------------
    def dialog(self, title, text, buttons, name="ask", timeout=0):
        """buttons: (key, label, kind) -- returns the key pressed (Escape / closing = Not now / No).
        timeout: seconds after which it answers Not now by itself (counted down on it)."""
        trace("%s %s" % (name, title))
        d = tk.Toplevel(self)
        d.title(title)
        d.configure(bg=PAPER)
        d.transient(self)
        d.resizable(False, False)
        res = {"k": None}
        keys = [b[0] for b in buttons]
        cancel = "notnow" if "notnow" in keys else ("no" if "no" in keys else keys[-1])
        frame = tk.Frame(d, bg=PAPER)
        frame.pack(fill="both", expand=True)
        tk.Frame(frame, bg=AMBER, width=6).pack(side="left", fill="y")
        inner = tk.Frame(frame, bg=PAPER)
        inner.pack(side="left", fill="both", expand=True, padx=22, pady=18)
        tk.Label(inner, text=title, bg=PAPER, fg=INK, font=self.f_head, anchor="w", justify="left",
                 wraplength=440).pack(anchor="w", pady=(0, 8))
        tk.Label(inner, text=text, bg=PAPER, fg=INK, anchor="w", justify="left", wraplength=440).pack(anchor="w")
        count = None
        if timeout:
            count = tk.Label(inner, text="", bg=PAPER, fg=MUTED, font=self.f_small, anchor="w")
            count.pack(anchor="w", pady=(8, 0))
        row = tk.Frame(inner, bg=PAPER)
        row.pack(fill="x", pady=(18, 0))
        made = {}

        def press(k):
            res["k"] = k
            d.destroy()
        for key, label, kind in buttons:
            style = {"primary": "Primary.TButton", "link": "Link.TButton"}.get(kind, "TButton")
            b = ttk.Button(row, text=label, style=style, command=lambda k=key: press(k))
            b.pack(side="left" if kind == "link" else "right", padx=(0, 6) if kind == "link" else (6, 0))
            made[key] = b
            if kind == "primary":
                b.focus_set()
                d.bind("<Return>", lambda e, b=b: b.invoke())
        d.bind("<Escape>", lambda e: press(cancel))
        d.protocol("WM_DELETE_WINDOW", lambda: press(cancel))
        d.update_idletasks()
        x = self.winfo_rootx() + max(0, (self.winfo_width() - d.winfo_reqwidth()) // 2)
        y = self.winfo_rooty() + max(0, (self.winfo_height() - d.winfo_reqheight()) // 3)
        d.geometry("+%d+%d" % (x, y))
        try:
            d.grab_set()
        except tk.TclError:
            pass
        if AUTO and AUTO[0] in made:
            k = AUTO.pop(0)
            d.after(AUTO_DELAY, lambda: made[k].invoke())
        if timeout:
            end = time.time() + timeout

            def tick():
                if not d.winfo_exists():
                    return
                left = int(end - time.time() + 0.99)
                if left <= 0:
                    trace("timeout " + title)
                    press(cancel)
                    return
                count.configure(text="If you do not choose, Lantern starts without it in %d s." % left)
                d.after(500, tick)
            tick()
        self.wait_window(d)
        self.after(50, self.auto_press)   # tests: the page's next button
        return res["k"] or cancel

    def ask_yes_no(self, title, text, yes, no):
        return self.dialog(title, text, [("yes", yes, "primary"), ("no", no, "plain")], "confirm") == "yes"

    def answer_question(self, kind, title, lines):
        text = reflow(lines)
        if kind == "build":
            buttons = [("yes", "Build it", "primary"), ("notnow", "Not now", "plain")]
        elif kind == "optin":   # the very large one: Not now is the default
            buttons = [("notnow", "Not now", "primary"), ("yes", "Download it", "plain"), ("never", "No, don't ask again", "link")]
        else:
            buttons = [("yes", "Download it", "primary"), ("notnow", "Not now", "plain"), ("never", "No, don't ask again", "link")]
        k = self.dialog(title, text, buttons, timeout=ASK_TIMEOUT if self.page == "run" else 0)
        if self.child:
            self.child.answer({"yes": "y", "never": "n"}.get(k, ""))
        if hasattr(self, "now") and self.page == "work":
            self.now.configure(text={"yes": "Getting it…", "never": "Skipped — not asking again."}.get(k, "Skipped for now."))

    # events from the scripts -------------------------------------------------
    def poll(self):
        try:
            while True:
                ev = self.events.get_nowait()
                kind = ev[0]
                if kind in ("line", "exit") and ev[3] is not self.child:
                    continue   # from a script already stopped (a restart)
                if kind == "line":
                    self.on_line(ev[1], ev[2])
                elif kind == "exit":
                    self.on_exit(ev[1])
                elif kind == "health":
                    self.on_health(ev[1])
                elif kind == "restart":
                    self.start_lantern()
                elif kind == "stopped":
                    self.page_stopped()
                if self.ask_buf is not None and self.ask_buf.get("done"):
                    a, self.ask_buf = self.ask_buf, None
                    self.answer_question(a["kind"], a["title"], a["lines"])
        except queue.Empty:
            pass
        self.after(80, self.poll)

    def on_line(self, line, is_cr):
        if self.ask_buf is not None:
            if line.startswith("@@Q "):
                self.ask_buf["lines"].append(line[4:])
                return
            if line.startswith("@@END"):
                self.ask_buf["done"] = True
                return
        if line.startswith("@@"):
            cmd, _, rest = line[2:].partition(" ")
            self.on_mark(cmd, rest)
            return
        m = curl_meter(line)
        if m:
            if self.page == "work":
                pct, got, total, speed, left = m
                self.progress(pct)
                bits = [b for b in ("%s of %s" % (got, total) if total else "", ("%s/s" % speed) if speed else "",
                                    (left + " left") if left and pct < 100 else "") if b]
                self.detail.configure(text="  ·  ".join(bits))
            return
        if is_cr or line.lstrip().startswith(("% Total", "Dload", "#")):
            return
        self.lines.append(line)
        del self.lines[:-2000]
        if self.log_box_ok():
            self.log_box.configure(state="normal")
            self.log_box.insert("end", line + "\n")
            self.log_box.see("end")
            self.log_box.configure(state="disabled")
        b = re.match(r"^\[\s*(\d+)%\]", line)
        if b and self.page == "work":
            self.progress(int(b.group(1)))
            self.detail.configure(text="Building: %s%%" % b.group(1))
            return
        if self.page == "work":
            self.status_from(line.strip())
        elif self.page == "run":
            if line.startswith("Library: "):
                self.detail.configure(text="Offline library: " + line[9:].split("(")[0].strip())
            elif "Downloading in the background" in line:
                self.bg.configure(text="A download you chose carries on in the background (its log is in the kit's "
                                       "models folder). Start Lantern again when it is done to use it.")

    def log_box_ok(self):
        return getattr(self, "log_box", None) is not None and self.page == "work"

    def status_from(self, s):
        m = re.match(r"^have (.+)$", s)
        if m:
            self.now.configure(text="Already in the kit: " + m.group(1))
            return
        for pat, out in ((r"^checking (\S+) \(SHA-256\)", "Checking %s"), (r"^getting cmake", "Getting the build tool (cmake)…"),
                         (r"^building llama-server with (\d+) of (\d+) cores", "Building the AI engine on this computer…"),
                         (r"^engine for \w+ ready$", "The AI engine is in the kit."), (r"^the engine starts on this computer", "The AI engine works on this computer."),
                         (r"^engine built for this computer", "The AI engine is built."), (r"^checksum OK", "Checked."),
                         (r"^kiwix-serve ready", "The library reader is in the kit."),
                         (r"^Lantern(?: \S+)? is in (?:the kit|place)", "Lantern is in place."), (r"^have Lantern", "Lantern is already here.")):
            m = re.match(pat, s)
            if m:
                self.now.configure(text=out % m.groups() if "%s" in out else out)
                if pat.startswith("^building"):
                    self.progress(0)
                    self.detail.configure(text="This takes a while (10 to 20 minutes on a Raspberry Pi 5). You can leave it running.")
                return

    def on_mark(self, cmd, rest):
        if cmd == "ASK":
            kind, _, title = rest.partition(" ")
            self.ask_buf = {"kind": kind, "title": title or "Lantern", "lines": [], "done": False}
        elif cmd == "STEP" and self.page == "work":
            sid, _, text = rest.partition(" ")
            self.set_step(sid)
            self.now.configure(text=text + "…")
            self.progress(None)
            self.detail.configure(text=" ")
        elif cmd == "GET" and self.page == "work":
            self.now.configure(text="Downloading " + rest)
            self.progress(0)
            self.detail.configure(text="Connecting…")
        elif cmd == "DONE" and self.page == "work":
            self.set_step("done")
        elif cmd == "FAIL":
            self.fail = rest.strip()
        elif cmd == "WARN":
            if rest.strip() and rest.strip() not in getattr(self, "warnings", []):
                self.warnings = getattr(self, "warnings", []) + [rest.strip()]
        elif cmd == "MODEL" and self.page == "run":
            self.model = rest.strip()
            self.run_model.configure(text="AI model: " + pretty_model(self.model))
        elif cmd == "URL":
            self.url = rest.strip()
        elif cmd == "PHONE":
            if rest.strip() not in self.phones:
                self.phones.append(rest.strip())
            if self.page == "run":
                self.show_addr()

    def on_exit(self, code):
        if self.page == "work":
            self.child = None
            if self.stopping:
                self.stopping = False
                self.page_welcome()
            elif code == 0:
                self.page_done()
            else:
                what, todo = failure_advice("\n".join(self.lines[-40:]), self.fail)
                self.page_failed(self.run_setup, "Setup stopped", what, todo)
        elif self.page == "run":
            self.child = None
            if self.stopping:
                return  # a restart or a stop: its own event follows
            text = "\n".join(self.lines[-60:])
            if self.fail == "nosite":
                what = "Lantern itself is not in this folder yet."
                todo = "Choose Install Lantern: it downloads Lantern and its AI (it needs the internet once), then start Lantern again."
                self.page_failed(lambda: self.goto_install(), "Lantern could not start", what, todo)
                self.buttons["retry"].configure(text="Install Lantern")
            elif self.fail == "noengine" or self.fail == "nomodel":
                what = "Lantern's AI is not installed in this folder yet."
                todo = "Double-click “Install Lantern” first (it needs the internet once), then start Lantern again."
                self.page_failed(lambda: self.goto_install(), "Lantern could not start", what, todo)
                self.buttons["retry"].configure(text="Install Lantern")
            elif re.search(r"GLIBC|GLIBCXX|cannot execute|Exec format", text):
                self.page_failed(lambda: self.goto_install(), "Lantern could not start",
                                 "The AI engine in this folder cannot start on this computer.",
                                 "Choose Install Lantern: it can build an engine made for this computer.")
                self.buttons["retry"].configure(text="Install Lantern")
            elif re.search(r"address already in use|couldn't bind|failed to bind|bind failed", text.lower()):
                self.page_failed(self.start_lantern, "Lantern could not start",
                                 "Another program is using Lantern's address (port %s)." % PORT,
                                 "Close the other Lantern window, or restart the computer, then choose Try again.")
            else:
                self.page_failed(self.start_lantern, "Lantern's AI stopped",
                                 "The AI engine stopped (code %s)." % code,
                                 "Choose Try again. If it stops again, the details below say why.")

    def goto_install(self):
        self.mode = "install"
        self.page_welcome()

    def on_close(self):
        if self.child and self.child.running():
            if self.page == "work":
                if not self.ask_yes_no("Stop the installation?", "Downloads that stop now carry on where they stopped "
                                       "the next time you run Install Lantern.", "Stop and close", "Keep going"):
                    return
                self.child.stop(whole_group=True)
            else:
                if not self.ask_yes_no("Stop Lantern?", "Closing this window stops Lantern's AI. Pages still open in "
                                       "the browser keep working without it.", "Stop and close", "Keep it running"):
                    return
                self.stopping = True
                self.withdraw()
                self.child.stop(whole_group=False)
        self.destroy()


def one_window():
    """One kit window per folder at a time: two installers would fetch into the same files.
    Returns the held lock, True when no lock can be had here, or None when another window has it."""
    try:
        import fcntl
        f = open(os.path.join(KIT, ".lantern-kit.lock"), "a")
    except (ImportError, OSError):
        return True
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return f
    except BlockingIOError:
        return None
    except OSError:
        return True


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "install"
    if mode not in ("install", "start"):
        sys.stderr.write("usage: lantern-kit.py install|start\n")
        return 2
    lock = one_window()
    if lock is None:
        try:
            r = tk.Tk()
            r.title("Lantern")
            r.configure(bg=PAPER)
            tk.Label(r, text="Lantern's window is already open (it may be behind other windows). Use that one, "
                             "or close it first.", bg=PAPER, fg=INK, wraplength=380, justify="left").pack(padx=24, pady=(20, 12))
            ttk.Button(r, text="OK", command=r.destroy).pack(pady=(0, 18))
            trace("page busy-window")
            if AUTO and AUTO[0] == "ok":
                AUTO.pop(0)
                r.after(AUTO_DELAY, r.destroy)
            r.mainloop()
        except tk.TclError:
            sys.stderr.write("Lantern's window is already open\n")
        return 0
    try:
        app = App(mode)
    except tk.TclError as e:   # no display: the launcher falls back to a terminal
        sys.stderr.write("cannot open a window: %s\n" % e)
        return 3
    app.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
