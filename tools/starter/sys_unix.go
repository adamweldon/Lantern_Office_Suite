//go:build !windows

// The Mac and Linux parts of the Lantern starter.
package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

func selfName() string { return "Lantern" }

func hideWindow(cmd *exec.Cmd) {}

func newGroup(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setpgid = true
}

// killTree: the start script and what it started (its process group)
func killTree(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	pid := cmd.Process.Pid
	if cmd.SysProcAttr != nil && cmd.SysProcAttr.Setpgid {
		_ = syscall.Kill(-pid, syscall.SIGTERM)
		go func() { time.Sleep(4 * time.Second); _ = syscall.Kill(-pid, syscall.SIGKILL) }()
	} else {
		_ = cmd.Process.Signal(syscall.SIGTERM)
		go func() { time.Sleep(4 * time.Second); _ = cmd.Process.Kill() }()
	}
}

func openBrowser(u string) {
	var c *exec.Cmd
	if runtime.GOOS == "darwin" {
		c = exec.Command("open", u)
	} else {
		c = exec.Command("xdg-open", u)
	}
	if err := c.Start(); err != nil {
		log.Printf("no browser: %v", err)
		return
	}
	go func() { _ = c.Wait() }()
}

// makeShortcuts: Linux, a menu entry and a desktop icon; a Mac, none yet
func makeShortcuts(root, exe string) error {
	if runtime.GOOS != "linux" {
		return nil
	}
	h, _ := os.UserHomeDir()
	entry := fmt.Sprintf("[Desktop Entry]\nType=Application\nName=Lantern\nComment=An offline office and learning suite with its own AI\nExec=\"%s\"\nPath=%s\nTerminal=false\nCategories=Office;Education;\n", exe, root)
	var errs []string
	for _, d := range []string{filepath.Join(h, ".local", "share", "applications"), filepath.Join(h, "Desktop")} {
		if fi, err := os.Stat(d); err != nil || !fi.IsDir() {
			if strings.HasSuffix(d, "applications") {
				_ = os.MkdirAll(d, 0o755)
			} else {
				continue
			}
		}
		p := filepath.Join(d, "lantern.desktop")
		if err := os.WriteFile(p, []byte(entry), 0o755); err != nil {
			errs = append(errs, err.Error())
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("%s", strings.Join(errs, "; "))
	}
	return nil
}

// setAwake: caffeinate on a Mac, systemd-inhibit on Linux (when there)
var (
	awakeMu  sync.Mutex
	awakeCmd *exec.Cmd
)

func setAwake(on bool) {
	awakeMu.Lock()
	defer awakeMu.Unlock()
	if on == (awakeCmd != nil) {
		return
	}
	if !on {
		_ = awakeCmd.Process.Kill()
		awakeCmd = nil
		return
	}
	var c *exec.Cmd
	if runtime.GOOS == "darwin" {
		c = exec.Command("caffeinate", "-i", "-w", strconv.Itoa(os.Getpid()))
	} else if p, err := exec.LookPath("systemd-inhibit"); err == nil {
		c = exec.Command(p, "--what=sleep:idle", "--who=Lantern", "--why=Downloading Lantern's AI and books", "--mode=block", "sleep", "86400")
	} else {
		return
	}
	if err := c.Start(); err != nil {
		return
	}
	go func() { _ = c.Wait() }()
	awakeCmd = c
}

func showError(title, msg string) {
	fmt.Fprintln(os.Stderr, title+": "+msg)
	if runtime.GOOS == "darwin" {
		_ = exec.Command("osascript", "-e", fmt.Sprintf("display dialog %q with title %q buttons {\"OK\"} with icon caution", msg, title)).Run()
	} else if p, err := exec.LookPath("zenity"); err == nil && os.Getenv("DISPLAY")+os.Getenv("WAYLAND_DISPLAY") != "" {
		_ = exec.Command(p, "--error", "--title="+title, "--text="+msg).Run()
	}
}

func sysMemMB() int {
	if runtime.GOOS == "darwin" {
		out, err := exec.Command("sysctl", "-n", "hw.memsize").Output()
		if err == nil {
			if n, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64); err == nil {
				return int(n / (1024 * 1024))
			}
		}
		return 8000
	}
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 8000
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fs := strings.Fields(sc.Text())
		if len(fs) >= 2 && fs[0] == "MemTotal:" {
			if kb, err := strconv.Atoi(fs[1]); err == nil {
				return kb / 1024
			}
		}
	}
	return 8000
}

func freeGB(path string) float64 {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0
	}
	return float64(st.Bavail) * float64(st.Bsize) / 1e9
}
