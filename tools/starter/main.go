// Lantern starter (1.24.19): the one program a person runs to get Lantern.
//
// Adam (2026-11-13): "I share a link to someone and when they click it it
// downloads an executable that checks what system it is on and downloads [and]
// runs everything else automatically ... in a way that allows the user to use
// lantern (which works without an ai) but could give a progress of ai
// downloading and wikipedia downloading etc. in the background."
//
// What it does, in order:
//  1. Finds Lantern: the folder it is in (a USB stick, or after it installed
//     itself), else ~/Lantern; if there is none, it downloads Lantern.zip (the
//     newest release) and unpacks it there, copies itself in, and makes a
//     desktop icon.
//  2. Serves Lantern at http://127.0.0.1:8080 at once and opens it in the
//     browser. Everything that needs no AI works from the first minute.
//  3. In the background, with the kit's own setup script (setup-kit.ps1 on
//     Windows, setup-kit.sh elsewhere -- every download, check and resume is
//     the kit's): the AI engine, the small model (0.5 GB), then the model this
//     computer's memory suits. The AI starts (the kit's start-lantern, on port
//     8090 behind this one) as soon as there is a model, and again when the
//     better one is in. The encyclopedia and the other books are offered
//     inside Lantern, with their sizes, and fetched when chosen.
//  4. /lantern-setup/status tells the page what is happening (Lantern's
//     LANTERN_SETUP module shows it); the computer is kept awake while
//     anything downloads; when no Lantern page has been open for a while and
//     nothing is downloading, it stops, and the AI's memory is given back.
//
// Run with --help for the options (used by the tests and the bench workflow).
package main

import (
	"archive/zip"
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	starterVersion = "1.24.19"
	defaultZip     = "https://github.com/adamweldon/Lantern_Office_Suite/releases/latest/download/Lantern.zip"
)

var (
	flagHome      = flag.String("home", "", "where to put Lantern when it is not beside this program (default: ~/Lantern)")
	flagZip       = flag.String("zip", "", "Lantern.zip to install from: a path or an address (default: the newest release; env LANTERN_ZIP)")
	flagPort      = flag.Int("port", 8080, "the address Lantern is served on (127.0.0.1:port)")
	flagEngine    = flag.Int("engine-port", 8090, "the port the AI engine listens on, behind this one")
	flagWatch     = flag.Int("watch-port", 8082, "Lantern Watch's status port (the kit's model-loading watcher)")
	flagNoBrowser = flag.Bool("no-browser", false, "do not open the browser")
	flagNoIcons   = flag.Bool("no-shortcuts", false, "make no desktop or menu icon")
	flagPlan      = flag.String("plan", "auto", "auto: the small model, then the one this computer's memory suits; small: the small model only")
	flagIdle      = flag.Duration("idle", 20*time.Minute, "stop when no Lantern page has been open this long and nothing is downloading")
	flagReady     = flag.Bool("exit-when-ready", false, "for tests: stop once the AI answers, after the downloads of the plan")
	flagLog       = flag.String("log", "", "log file (default: kit/logs/starter.log)")
)

// ---------------------------------------------------------------------------
// the state the page is shown

type Job struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	GB     float64 `json:"gb"`
	State  string  `json:"state"` // queued, running, done, failed, waiting
	File   string  `json:"file,omitempty"`
	Bytes  int64   `json:"bytes"`
	Total  int64   `json:"total"`
	Rate   float64 `json:"rate"`   // bytes a second, over the last half minute
	LeftMs int64   `json:"leftMs"` // -1 unknown
	Err    string  `json:"error,omitempty"`
	Why    string  `json:"why,omitempty"` // what it is for, in a few words

	args       []string
	restart    bool // start the AI again when it is done
	part       string
	from       string
	samples    []sample
	tries      int
	finishedAt time.Time
}

type sample struct {
	t time.Time
	n int64
}

type Offer struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	GB   float64 `json:"gb"`
	What string  `json:"what"`
}

type Status struct {
	V        int      `json:"v"`
	Starter  string   `json:"starter"`
	Lantern  string   `json:"lantern"`
	Folder   string   `json:"folder"`
	OS       string   `json:"os"`
	MemMB    int      `json:"memMB"`
	FreeGB   float64  `json:"freeGB"`
	AI       AIState  `json:"ai"`
	Jobs     []*Job   `json:"jobs"`
	Offers   []Offer  `json:"offers"`
	Watch    int      `json:"watch"`
	Awake    bool     `json:"awake"`
	Message  string   `json:"message"`
	Busy     bool     `json:"busy"`
	Stopping bool     `json:"stopping"`
	Notes    []string `json:"notes,omitempty"`
}

type AIState struct {
	State string `json:"state"` // none, downloading, starting, ready, stopped
	Model string `json:"model,omitempty"`
	Next  string `json:"next,omitempty"`
}

type Starter struct {
	mu       sync.Mutex
	root     string // the Lantern folder
	kit      string
	site     string
	jobs     []*Job
	chosen   map[string]bool
	engine   *exec.Cmd
	engDone  chan struct{}
	aiState  string
	aiModel  string
	lastSeen time.Time
	awake    bool
	stopping bool
	notes    []string
	wake     chan struct{}
	memMB    int
	quit     chan struct{}
	quitOnce sync.Once
}

// ---------------------------------------------------------------------------
// the plan: what is fetched without asking, and what is offered

type tier struct {
	id, pat, name string
	gb            float64
	mem           int
}

// as in setup-kit's $Tiers / TIERS (its download sizes; memory in MB)
var tiers = []tier{
	{"xl", "35B-A3B", "Qwen3.5 35B-A3B", 17.5, 28000},
	{"big", "9B", "Qwen3.5 9B", 5.7, 15000},
	{"laptop", "4B", "Qwen3.5 4B", 2.7, 7000},
	{"2b", "2B", "Qwen3.5 2B", 1.3, 5000},
	{"0.8b", "0.8B", "Qwen3.5 0.8B", 0.55, 0},
}

func tierByID(id string) tier {
	for _, t := range tiers {
		if t.id == id {
			return t
		}
	}
	return tier{}
}

// the model fetched without asking after the small one: the best this memory
// suits, up to the 9B (the 35B, 17.5 GB, is offered instead)
func autoTier(mem int) (tier, bool) {
	for _, t := range tiers {
		if t.id == "xl" || t.id == "0.8b" {
			continue
		}
		if mem >= t.mem {
			return t, true
		}
	}
	return tier{}, false
}

var offerList = []Offer{
	{"library", "The encyclopedia", 12, "Wikipedia: the first part of every article, for the AI to read and quote (a smaller one, 2.5 GB, on a drive without room)"},
	{"shelves", "Medicine, repair, travel and science books", 5, "WikiMed, iFixit repair guides, Wikivoyage and PhET science simulations"},
	{"xl", "The strongest AI model", 17.5, "Qwen3.5 35B-A3B, for a computer with 32 GB of memory"},
}

// ---------------------------------------------------------------------------

func main() {
	flag.Parse()
	if *flagZip == "" {
		*flagZip = os.Getenv("LANTERN_ZIP")
	}
	s := &Starter{chosen: map[string]bool{}, lastSeen: time.Now(), wake: make(chan struct{}, 1), quit: make(chan struct{}), aiState: "none"}

	// another starter already serving Lantern: open it and stop
	if alreadyRunning(*flagPort) {
		if !*flagNoBrowser {
			openBrowser(fmt.Sprintf("http://127.0.0.1:%d/", *flagPort))
		}
		return
	}

	root, err := findOrInstall()
	if err != nil {
		fatal("Lantern could not be set up", err)
	}
	s.root, s.kit, s.site = root, filepath.Join(root, "kit"), filepath.Join(root, "site")
	logTo(s)
	log.Printf("Lantern starter %s: Lantern %s in %s", starterVersion, siteVersion(s.site), root)
	s.memMB = memMB()

	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *flagPort))
	if err != nil {
		fatal(fmt.Sprintf("Lantern could not use 127.0.0.1:%d (another program has it)", *flagPort), err)
	}
	s.plan()
	go s.worker()
	go s.idleWatch()
	srv := &http.Server{Handler: s, ReadHeaderTimeout: 30 * time.Second}
	go func() { _ = srv.Serve(ln) }()
	if !*flagNoBrowser {
		openBrowser(fmt.Sprintf("http://127.0.0.1:%d/", *flagPort))
	}
	if s.haveEngine() && s.anyModel() != "" {
		s.startEngine()
	}
	<-s.quit
	s.stopEngine()
	setAwake(false)
	_ = srv.Close()
	log.Printf("stopped")
}

func (s *Starter) stop(why string) {
	s.quitOnce.Do(func() {
		log.Printf("stopping: %s", why)
		s.mu.Lock()
		s.stopping = true
		s.mu.Unlock()
		close(s.quit)
	})
}

// ---------------------------------------------------------------------------
// finding or installing Lantern

func isLantern(dir string) bool {
	_, e1 := os.Stat(filepath.Join(dir, "site", "index.html"))
	_, e2 := os.Stat(filepath.Join(dir, "kit"))
	return e1 == nil && e2 == nil
}

func homeDir() string {
	if *flagHome != "" {
		return *flagHome
	}
	h, err := os.UserHomeDir()
	if err != nil || h == "" {
		h = "."
	}
	return filepath.Join(h, "Lantern")
}

func findOrInstall() (string, error) {
	if exe, err := os.Executable(); err == nil {
		d := filepath.Dir(exe)
		if isLantern(d) {
			return d, nil
		}
		if isLantern(filepath.Join(d, "Lantern")) {
			return filepath.Join(d, "Lantern"), nil
		}
	}
	root := homeDir()
	if isLantern(root) {
		return root, nil
	}
	src := *flagZip
	if src == "" {
		src = defaultZip
	}
	tmp, err := os.MkdirTemp("", "lantern-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmp)
	zp := filepath.Join(tmp, "Lantern.zip")
	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		if err := download(src, zp); err != nil {
			return "", fmt.Errorf("downloading Lantern: %w (is there internet?)", err)
		}
	} else if err := copyFile(src, zp); err != nil {
		return "", err
	}
	if err := unzipLantern(zp, root); err != nil {
		return "", err
	}
	if !isLantern(root) {
		return "", errors.New("the downloaded Lantern.zip has no Lantern in it")
	}
	if exe, err := os.Executable(); err == nil {
		dst := filepath.Join(root, selfName())
		if err := copyFile(exe, dst); err == nil {
			_ = os.Chmod(dst, 0o755)
		}
		if !*flagNoIcons {
			if err := makeShortcuts(root, dst); err != nil {
				log.Printf("no desktop icon: %v", err)
			}
		}
	}
	return root, nil
}

func download(u, dst string) error {
	resp, err := http.Get(u)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("%s: %s", u, resp.Status)
	}
	f, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

func copyFile(a, b string) error {
	in, err := os.Open(a)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(b)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// unzipLantern: the zip holds one folder, Lantern; its contents go into root
func unzipLantern(zp, root string) error {
	z, err := zip.OpenReader(zp)
	if err != nil {
		return fmt.Errorf("Lantern.zip is damaged: %w", err)
	}
	defer z.Close()
	for _, f := range z.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		if i := strings.Index(name, "/"); i >= 0 && strings.EqualFold(name[:i], "Lantern") {
			name = name[i+1:]
		}
		if name == "" || strings.Contains(name, "..") {
			continue
		}
		dst := filepath.Join(root, filepath.FromSlash(name))
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(dst, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		mode := os.FileMode(0o644)
		if f.Mode()&0o111 != 0 || strings.HasSuffix(name, ".sh") || strings.HasSuffix(name, ".command") || strings.HasSuffix(name, ".desktop") {
			mode = 0o755
		}
		out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

var verRe = regexp.MustCompile(`version: "([0-9][0-9.]*)"`)

func siteVersion(site string) string {
	b, err := os.ReadFile(filepath.Join(site, "index.html"))
	if err != nil {
		return "?"
	}
	if m := verRe.FindSubmatch(b); m != nil {
		return string(m[1])
	}
	return "?"
}

// ---------------------------------------------------------------------------
// what the kit has

func (s *Starter) modelsDir() string { return filepath.Join(s.kit, "models") }

func (s *Starter) haveModel(pat string) bool {
	ents, _ := os.ReadDir(s.modelsDir())
	for _, e := range ents {
		n := e.Name()
		if strings.HasSuffix(strings.ToLower(n), ".gguf") && !strings.Contains(strings.ToLower(n), "mmproj") && strings.Contains(n, "-"+pat+"-") {
			if fi, err := e.Info(); err == nil && fi.Size() > 0 {
				return true
			}
		}
	}
	return false
}

func (s *Starter) anyModel() string {
	for _, t := range tiers {
		if s.haveModel(t.pat) {
			return t.name
		}
	}
	return ""
}

func (s *Starter) haveEngine() bool {
	name := "llama-server"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	ents, _ := os.ReadDir(filepath.Join(s.kit, "engine"))
	for _, e := range ents {
		if !e.IsDir() {
			continue
		}
		dir := e.Name()
		ok := (runtime.GOOS == "windows" && dir == "windows") || (runtime.GOOS == "darwin" && dir == "mac") ||
			(runtime.GOOS == "linux" && (dir == "linux" || strings.HasPrefix(dir, "linux-")))
		if !ok {
			continue
		}
		if _, err := os.Stat(filepath.Join(s.kit, "engine", dir, name)); err == nil {
			return true
		}
	}
	return false
}

func (s *Starter) haveLibrary() bool {
	ents, _ := os.ReadDir(filepath.Join(s.kit, "library"))
	for _, e := range ents {
		if strings.HasSuffix(e.Name(), ".zim") {
			return true
		}
	}
	return false
}

// plan(): the jobs fetched without asking
func (s *Starter) plan() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.haveEngine() {
		s.jobs = append(s.jobs, &Job{ID: "engine", Name: "The AI engine (llama.cpp)", GB: 0.05, State: "queued", args: []string{"engine"}, LeftMs: -1, Why: "runs the AI on this computer"})
	}
	if s.anyModel() == "" {
		s.jobs = append(s.jobs, &Job{ID: "0.8b", Name: "A small AI model (Qwen3.5 0.8B)", GB: 0.55, State: "queued", args: []string{"0.8b"}, restart: true, LeftMs: -1, Why: "Chat and the AI start working"})
	}
	if *flagPlan != "small" {
		if t, ok := autoTier(s.memMB); ok && !s.haveModel(t.pat) {
			s.jobs = append(s.jobs, &Job{ID: t.id, Name: "A stronger AI model (" + t.name + ")", GB: t.gb + visionGB(t.id), State: "queued", args: []string{t.id}, restart: true, LeftMs: -1,
				Why: "the one this computer's memory suits"})
		}
	}
	s.kick()
}

func visionGB(id string) float64 {
	if id == "laptop" || id == "big" || id == "xl" {
		return 0.8
	}
	return 0
}

func (s *Starter) kick() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// choose(id): an offer the person took
func (s *Starter) choose(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var o *Offer
	for i := range offerList {
		if offerList[i].ID == id {
			o = &offerList[i]
		}
	}
	if o == nil {
		return fmt.Errorf("no such offer: %s", id)
	}
	if s.chosen[id] {
		return nil
	}
	s.chosen[id] = true
	j := &Job{ID: id, Name: o.Name, GB: o.GB, State: "queued", args: []string{id}, restart: true, LeftMs: -1, Why: "you chose it"}
	if id == "xl" {
		j.GB += visionGB("xl")
	}
	s.jobs = append(s.jobs, j)
	s.kick()
	return nil
}

func (s *Starter) offers() []Offer {
	out := []Offer{}
	for _, o := range offerList {
		if s.chosen[o.ID] {
			continue
		}
		switch o.ID {
		case "library":
			if s.haveLibrary() {
				continue
			}
		case "shelves":
			if !s.haveLibrary() && !s.chosen["library"] {
				// offered beside the encyclopedia; asked for alone it still comes
			}
		case "xl":
			if s.memMB < 28000 || s.haveModel("35B-A3B") {
				continue
			}
		}
		out = append(out, o)
	}
	return out
}

// ---------------------------------------------------------------------------
// the worker: one setup run at a time, the kit's own script

func (s *Starter) worker() {
	for {
		j := s.next()
		if j == nil {
			select {
			case <-s.wake:
				continue
			case <-s.quit:
				return
			case <-time.After(30 * time.Second):
				continue
			}
		}
		setAwake(true)
		s.mu.Lock()
		s.awake = true
		j.State, j.Err = "running", ""
		s.mu.Unlock()
		err := s.runSetup(j)
		s.mu.Lock()
		if err != nil {
			j.tries++
			j.Err = err.Error()
			j.finishedAt = time.Now()
			if j.tries < 30 {
				j.State = "waiting" // no internet, most often: tried again in a minute
			} else {
				j.State = "failed"
			}
		} else {
			j.State, j.Bytes, j.LeftMs, j.finishedAt = "done", j.Total, 0, time.Now()
		}
		restart := err == nil && j.restart
		busy := s.busyLocked()
		s.awake = busy
		s.mu.Unlock()
		if !busy {
			setAwake(false)
		}
		if restart || (err == nil && j.ID == "engine") {
			if s.haveEngine() && s.anyModel() != "" {
				s.startEngine()
			}
		}
		if err != nil {
			log.Printf("%s stopped: %v", j.ID, err)
		}
		if *flagReady && s.planDone() {
			go s.readyThenQuit()
		}
	}
}

func (s *Starter) next() *Job {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, j := range s.jobs {
		if j.State == "queued" {
			return j
		}
	}
	for _, j := range s.jobs {
		if j.State == "waiting" && time.Since(j.finishedAt) > time.Minute {
			return j
		}
	}
	return nil
}

func (s *Starter) busyLocked() bool {
	for _, j := range s.jobs {
		if j.State == "queued" || j.State == "running" || j.State == "waiting" {
			return true
		}
	}
	return false
}

func (s *Starter) planDone() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.busyLocked()
}

var markRe = regexp.MustCompile(`^@@(\w+)\s?(.*)$`)

func (s *Starter) runSetup(j *Job) error {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("powershell", append([]string{"-NoProfile", "-ExecutionPolicy", "Bypass", "-File", filepath.Join(s.kit, "setup-kit.ps1")}, j.args...)...)
	} else {
		cmd = exec.Command("sh", append([]string{filepath.Join(s.kit, "setup-kit.sh")}, j.args...)...)
	}
	cmd.Dir = s.kit
	cmd.Env = append(os.Environ(), "LANTERN_UI=1", "LANTERN_NO_PAUSE=1", "LANTERN_AUTO_DOWNLOAD=0")
	hideWindow(cmd)
	stderr, _ := cmd.StderrPipe()
	stdout, _ := cmd.StdoutPipe()
	log.Printf("setup %v", j.args)
	if err := cmd.Start(); err != nil {
		return err
	}
	var last []string
	var lmu sync.Mutex
	keep := func(line string) {
		lmu.Lock()
		last = append(last, line)
		if len(last) > 12 {
			last = last[len(last)-12:]
		}
		lmu.Unlock()
	}
	done := make(chan struct{})
	go func() {
		sc := bufio.NewScanner(stdout)
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		for sc.Scan() {
			line := strings.TrimRight(sc.Text(), "\r")
			if strings.TrimSpace(line) != "" {
				log.Printf("  %s", line)
				keep(strings.TrimSpace(line))
			}
		}
		done <- struct{}{}
	}()
	go func() {
		r := bufio.NewReader(stderr)
		for {
			line, err := r.ReadString('\n')
			for _, part := range strings.Split(line, "\r") { // curl's meter rewrites one line
				part = strings.TrimSpace(part)
				if m := markRe.FindStringSubmatch(part); m != nil {
					s.mark(j, m[1], m[2])
				}
			}
			if err != nil {
				break
			}
		}
		done <- struct{}{}
	}()
	tick := time.NewTicker(time.Second)
	defer tick.Stop()
	finished := make(chan error, 1)
	go func() { <-done; <-done; finished <- cmd.Wait() }()
	for {
		select {
		case err := <-finished:
			s.measure(j)
			if err != nil {
				lmu.Lock()
				tail := strings.Join(last, " | ")
				lmu.Unlock()
				return fmt.Errorf("%v: %s", err, tail)
			}
			return nil
		case <-tick.C:
			s.measure(j)
		case <-s.quit:
			killTree(cmd)
			return errors.New("Lantern was stopped")
		}
	}
}

// mark(): a line of the kit's own protocol ("@@GET file", "@@FROM url path")
func (s *Starter) mark(j *Job, cmd, rest string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	switch cmd {
	case "GET":
		j.File = rest
	case "FROM":
		sp := strings.SplitN(rest, " ", 2)
		if len(sp) == 2 {
			j.from, j.part = sp[0], sp[1]
			j.samples = nil
			go s.sizeOf(j, sp[0], sp[1])
		}
	}
}

var sizeCache sync.Map

// sizeOf(): the file's whole size, asked of the server (one byte of it, which
// works where a HEAD is refused: Hugging Face's file store)
func (s *Starter) sizeOf(j *Job, u, part string) {
	var n int64
	if v, ok := sizeCache.Load(u); ok {
		n = v.(int64)
	} else {
		req, _ := http.NewRequest("GET", u, nil)
		req.Header.Set("Range", "bytes=0-0")
		req.Header.Set("User-Agent", "lantern-starter")
		cl := &http.Client{Timeout: 30 * time.Second}
		if resp, err := cl.Do(req); err == nil {
			if cr := resp.Header.Get("Content-Range"); cr != "" {
				if i := strings.LastIndex(cr, "/"); i >= 0 {
					n, _ = strconv.ParseInt(strings.TrimSpace(cr[i+1:]), 10, 64)
				}
			} else if resp.StatusCode == 200 {
				n = resp.ContentLength
			}
			resp.Body.Close()
		}
		if n > 0 {
			sizeCache.Store(u, n)
		}
	}
	s.mu.Lock()
	if j.part == part {
		j.Total = n
	}
	s.mu.Unlock()
}

// measure(): how far the file being fetched has come, how fast, how long left
func (s *Starter) measure(j *Job) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if j.part == "" {
		return
	}
	var n int64
	if fi, err := os.Stat(j.part); err == nil {
		n = fi.Size()
	} else if fi, err := os.Stat(strings.TrimSuffix(j.part, ".part")); err == nil {
		n = fi.Size()
	}
	now := time.Now()
	j.Bytes = n
	j.samples = append(j.samples, sample{now, n})
	for len(j.samples) > 2 && now.Sub(j.samples[0].t) > 30*time.Second {
		j.samples = j.samples[1:]
	}
	j.Rate, j.LeftMs = 0, -1
	if len(j.samples) > 1 {
		a, b := j.samples[0], j.samples[len(j.samples)-1]
		if dt := b.t.Sub(a.t).Seconds(); dt > 1.5 && b.n > a.n {
			j.Rate = float64(b.n-a.n) / dt
			if j.Total > n {
				j.LeftMs = int64(float64(j.Total-n) / j.Rate * 1000)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// the AI engine: the kit's start-lantern, behind this server

var modelLine = regexp.MustCompile(`^Lantern: (.+) with \d+ MB memory`)

func (s *Starter) startEngine() {
	s.stopEngine()
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		// by its name in the kit folder (cmd.Dir): cmd's own rules for quotes go
		// wrong on a path with "&" or "()" in it, as a user folder can have
		cmd = exec.Command("cmd", "/d", "/c", "start-lantern.bat", "nodownload")
	} else {
		cmd = exec.Command("sh", filepath.Join(s.kit, "start-lantern.sh"), "nodownload")
	}
	cmd.Dir = s.kit
	cmd.Env = append(os.Environ(), fmt.Sprintf("PORT=%d", *flagEngine), fmt.Sprintf("LANTERN_WATCH_PORT=%d", *flagWatch),
		"NO_BROWSER=1", "LANTERN_NO_PAUSE=1", "LANTERN_AUTO_DOWNLOAD=0", "LANTERN_UI=1")
	hideWindow(cmd)
	newGroup(cmd)
	out, _ := cmd.StdoutPipe()
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		log.Printf("the AI did not start: %v", err)
		return
	}
	done := make(chan struct{})
	s.mu.Lock()
	s.engine, s.engDone, s.aiState, s.aiModel = cmd, done, "starting", ""
	s.mu.Unlock()
	log.Printf("AI starting (pid %d)", cmd.Process.Pid)
	go func() {
		sc := bufio.NewScanner(out)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" {
				continue
			}
			log.Printf("  ai: %s", line)
			if m := modelLine.FindStringSubmatch(line); m != nil {
				s.setModel(m[1])
			} else if mm := markRe.FindStringSubmatch(line); mm != nil && mm[1] == "MODEL" {
				s.setModel(mm[2])
			}
		}
		_ = cmd.Wait()
		s.mu.Lock()
		if s.engine == cmd {
			s.engine, s.aiState = nil, "stopped"
		}
		s.mu.Unlock()
		close(done)
	}()
	go s.watchReady(cmd)
}

func (s *Starter) setModel(p string) {
	b := filepath.Base(strings.ReplaceAll(p, "\\", "/"))
	b = strings.TrimSuffix(b, ".gguf")
	s.mu.Lock()
	s.aiModel = b
	s.mu.Unlock()
}

// watchReady(): asks the engine for its model list until it answers
func (s *Starter) watchReady(cmd *exec.Cmd) {
	cl := &http.Client{Timeout: 5 * time.Second}
	for i := 0; i < 1800; i++ {
		s.mu.Lock()
		cur := s.engine == cmd
		s.mu.Unlock()
		if !cur {
			return
		}
		resp, err := cl.Get(fmt.Sprintf("http://127.0.0.1:%d/v1/models", *flagEngine))
		if err == nil {
			ok := resp.StatusCode == 200
			resp.Body.Close()
			if ok {
				s.mu.Lock()
				if s.engine == cmd {
					s.aiState = "ready"
				}
				s.mu.Unlock()
				log.Printf("AI ready")
				if *flagReady && s.planDone() {
					go s.readyThenQuit()
				}
				return
			}
		}
		time.Sleep(time.Second)
	}
}

func (s *Starter) stopEngine() {
	s.mu.Lock()
	cmd, done := s.engine, s.engDone
	s.engine = nil
	s.mu.Unlock()
	if cmd == nil || cmd.Process == nil {
		return
	}
	killTree(cmd)
	select {
	case <-done:
	case <-time.After(10 * time.Second):
	}
}

func (s *Starter) readyThenQuit() {
	for i := 0; i < 600; i++ {
		s.mu.Lock()
		st := s.aiState
		s.mu.Unlock()
		if st == "ready" {
			time.Sleep(time.Duration(envInt("LANTERN_READY_HOLD", 0)) * time.Second)
			s.stop("ready (--exit-when-ready)")
			return
		}
		time.Sleep(time.Second)
	}
	s.stop("the AI did not become ready")
}

func envInt(k string, d int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil {
		return v
	}
	return d
}

// ---------------------------------------------------------------------------
// stopping when nobody uses it

func (s *Starter) idleWatch() {
	for {
		select {
		case <-s.quit:
			return
		case <-time.After(30 * time.Second):
		}
		s.mu.Lock()
		idle := time.Since(s.lastSeen)
		busy := s.busyLocked()
		s.mu.Unlock()
		if !busy && idle > *flagIdle && !*flagReady {
			s.stop(fmt.Sprintf("no Lantern page for %s and nothing downloading", idle.Round(time.Minute)))
			return
		}
	}
}

// ---------------------------------------------------------------------------
// the server: Lantern's files, the AI behind it, and /lantern-setup/

var apiPrefixes = []string{"/v1/", "/health", "/props", "/completion", "/completions", "/chat/completions", "/tokenize", "/detokenize",
	"/embedding", "/embeddings", "/slots", "/infill", "/apply-template", "/models", "/metrics", "/rerank", "/reranking"}

// ownHost: Lantern is asked for by this computer's own names for itself (a
// web address made to point at 127.0.0.1 brings its own name, and is refused)
func ownHost(h string) bool {
	port := strconv.Itoa(*flagPort)
	return h == "127.0.0.1:"+port || h == "localhost:"+port || h == "[::1]:"+port
}

// ownOrigin: a change (Add, Stop) comes from Lantern's own page, or from no page
// at all; another site's page open in the browser may not stop Lantern or start
// a 12 GB download (a browser names the page a POST comes from)
func ownOrigin(o string) bool {
	if o == "" {
		return true
	}
	return o == "http://"+"127.0.0.1:"+strconv.Itoa(*flagPort) || o == "http://localhost:"+strconv.Itoa(*flagPort) || o == "http://[::1]:"+strconv.Itoa(*flagPort)
}

func (s *Starter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !ownHost(r.Host) || (strings.HasPrefix(r.URL.Path, "/lantern-setup/") && r.Method != "GET" && !ownOrigin(r.Header.Get("Origin"))) {
		http.Error(w, "Lantern answers only its own pages", http.StatusForbidden)
		return
	}
	s.mu.Lock()
	s.lastSeen = time.Now()
	s.mu.Unlock()
	p := r.URL.Path
	switch {
	case p == "/lantern-setup/status":
		s.serveStatus(w)
		return
	case p == "/lantern-setup/choose" && r.Method == "POST":
		var body struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body)
		if err := s.choose(body.ID); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		s.serveStatus(w)
		return
	case p == "/lantern-setup/stop" && r.Method == "POST":
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
		go func() { time.Sleep(300 * time.Millisecond); s.stop("Stop Lantern, from the page") }()
		return
	}
	for _, a := range apiPrefixes {
		if p == a || strings.HasPrefix(p, a) {
			s.proxy(w, r)
			return
		}
	}
	s.serveFile(w, r)
}

func (s *Starter) proxy(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	running := s.engine != nil
	s.mu.Unlock()
	if !running {
		// no engine yet: as a server with no model (the page's AI_SERVER_WAIT
		// then waits for nothing; LANTERN_SETUP tells it when the AI comes)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(404)
		_, _ = w.Write([]byte(`{"error":{"code":404,"message":"Lantern's AI is still being downloaded","type":"not_found_error"}}`))
		return
	}
	target, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", *flagEngine))
	rp := httputil.NewSingleHostReverseProxy(target)
	rp.FlushInterval = -1 // stream the AI's words as they come
	rp.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		// started, not answering yet: as llama-server while it loads
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(503)
		_, _ = w.Write([]byte(`{"error":{"code":503,"message":"Loading model","type":"unavailable_error"}}`))
	}
	rp.ServeHTTP(w, r)
}

func (s *Starter) serveFile(w http.ResponseWriter, r *http.Request) {
	p := path.Clean("/" + r.URL.Path) // the address's own slashes (filepath.Clean gives "\\" on Windows: found 1.24.19 on GitHub's Windows)
	if p == "/" {
		p = "/index.html"
	}
	f := filepath.Join(s.site, filepath.FromSlash(p))
	if !strings.HasPrefix(f, filepath.Clean(s.site)+string(os.PathSeparator)) {
		http.NotFound(w, r)
		return
	}
	if fi, err := os.Stat(f); err != nil || fi.IsDir() {
		http.NotFound(w, r)
		return
	}
	if strings.HasSuffix(p, ".html") || strings.HasSuffix(p, "lantern-sw.js") {
		w.Header().Set("Cache-Control", "no-cache")
	}
	if strings.HasSuffix(p, ".wasm") {
		w.Header().Set("Content-Type", "application/wasm")
	}
	http.ServeFile(w, r, f)
}

func (s *Starter) serveStatus(w http.ResponseWriter) {
	st := s.status()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(st)
}

func (s *Starter) status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := Status{V: 1, Starter: starterVersion, Lantern: siteVersion(s.site), Folder: s.root, OS: runtime.GOOS, MemMB: s.memMB,
		FreeGB: freeGB(s.kit), Jobs: s.jobs, Offers: s.offers(), Watch: *flagWatch, Awake: s.awake, Busy: s.busyLocked(), Stopping: s.stopping, Notes: s.notes}
	if st.Jobs == nil {
		st.Jobs = []*Job{}
	}
	ai := s.aiState
	if s.engine == nil && ai != "stopped" {
		ai = "none"
		for _, j := range s.jobs {
			if (j.ID == "engine" || j.ID == "0.8b") && j.State != "done" {
				ai = "downloading"
			}
		}
	}
	st.AI = AIState{State: ai, Model: s.aiModel}
	for _, j := range s.jobs {
		if j.restart && j.State != "done" && j.State != "failed" && j.ID != "0.8b" {
			st.AI.Next = j.Name
			break
		}
	}
	st.Message = s.messageLocked(st)
	return st
}

func gb(n int64) string { return strconv.FormatFloat(float64(n)/1e9, 'f', 1, 64) + " GB" }

func left(ms int64) string {
	if ms < 0 {
		return ""
	}
	m := (ms + 30000) / 60000
	if m < 1 {
		return "less than a minute left"
	}
	if m < 90 {
		return fmt.Sprintf("about %d min left", m)
	}
	return fmt.Sprintf("about %.1f hours left", float64(m)/60)
}

func (s *Starter) messageLocked(st Status) string {
	var run *Job
	for _, j := range s.jobs {
		if j.State == "running" {
			run = j
			break
		}
	}
	waiting := false
	for _, j := range s.jobs {
		if j.State == "waiting" {
			waiting = true
		}
	}
	switch {
	case run != nil:
		pct := ""
		if run.Total > 0 {
			pct = fmt.Sprintf(": %d%%", run.Bytes*100/run.Total)
			if l := left(run.LeftMs); l != "" {
				pct += ", " + l
			}
		}
		return "Getting " + strings.ToLower(run.Name[:1]) + run.Name[1:] + pct + "."
	case waiting:
		return "No internet just now: Lantern tries again every minute."
	case st.AI.State == "starting":
		return "Lantern's AI is starting."
	case st.AI.State == "ready":
		return "Everything Lantern needs is here."
	}
	return ""
}

// ---------------------------------------------------------------------------
// small things

func alreadyRunning(port int) bool {
	cl := &http.Client{Timeout: 2 * time.Second}
	resp, err := cl.Get(fmt.Sprintf("http://127.0.0.1:%d/lantern-setup/status", port))
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var st Status
	return resp.StatusCode == 200 && json.NewDecoder(resp.Body).Decode(&st) == nil && st.V == 1 && st.Starter != ""
}

func logTo(s *Starter) {
	p := *flagLog
	if p == "" {
		_ = os.MkdirAll(filepath.Join(s.kit, "logs"), 0o755)
		p = filepath.Join(s.kit, "logs", "starter.log")
	}
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return
	}
	log.SetOutput(io.MultiWriter(f, os.Stderr))
}

func fatal(what string, err error) {
	msg := what + ".\n\n" + err.Error()
	log.Printf("%s", msg)
	showError("Lantern", msg)
	os.Exit(1)
}

func memMB() int {
	if v := envInt("LANTERN_MEM_MB", 0); v > 0 {
		return v
	}
	return sysMemMB()
}

// sortJobs is kept for a stable order in the status (queued after done)
var _ = sort.Slice
