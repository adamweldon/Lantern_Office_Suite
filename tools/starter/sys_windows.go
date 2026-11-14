//go:build windows

// The Windows parts of the Lantern starter: no black windows, a desktop icon,
// the computer kept awake while downloading, a message box when it cannot go on.
package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"syscall"
	"unsafe"
)

var (
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	user32   = syscall.NewLazyDLL("user32.dll")
)

const (
	createNoWindow        = 0x08000000
	createNewProcessGroup = 0x00000200
)

func selfName() string { return "Lantern.exe" }

func hideWindow(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= createNoWindow
}

func newGroup(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.CreationFlags |= createNewProcessGroup
}

// killTree: the start script, the engine, the library server and Lantern Watch
func killTree(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	k := exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid))
	hideWindow(k)
	_ = k.Run()
}

func openBrowser(u string) {
	c := exec.Command("rundll32", "url.dll,FileProtocolHandler", u)
	hideWindow(c)
	if err := c.Start(); err != nil {
		log.Printf("no browser: %v", err)
	}
}

// makeShortcuts: "Lantern" on the desktop and in the Start menu
func makeShortcuts(root, exe string) error {
	ps := fmt.Sprintf(`$w = New-Object -ComObject WScript.Shell
foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
  if ($d) { $s = $w.CreateShortcut((Join-Path $d 'Lantern.lnk')); $s.TargetPath = '%s'; $s.WorkingDirectory = '%s'; $s.Description = 'Lantern: an offline office and learning suite with its own AI'; $s.Save() }
}`, psQuote(exe), psQuote(root))
	c := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps)
	hideWindow(c)
	out, err := c.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v: %s", err, out)
	}
	return nil
}

func psQuote(s string) string {
	r := ""
	for _, ch := range s {
		if ch == '\'' {
			r += "''"
		} else {
			r += string(ch)
		}
	}
	return r
}

// setAwake: SetThreadExecutionState holds for the thread that called it, so one
// thread, kept for this, does the asking
var awakeCh = make(chan bool, 4)

func init() {
	go func() {
		runtime.LockOSThread()
		proc := kernel32.NewProc("SetThreadExecutionState")
		const esContinuous, esSystemRequired = 0x80000000, 0x00000001
		for on := range awakeCh {
			if on {
				_, _, _ = proc.Call(uintptr(esContinuous | esSystemRequired))
			} else {
				_, _, _ = proc.Call(uintptr(esContinuous))
			}
		}
	}()
}

func setAwake(on bool) {
	select {
	case awakeCh <- on:
	default:
	}
}

func showError(title, msg string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(msg)
	_, _, _ = user32.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x30)
}

type memStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

func sysMemMB() int {
	var m memStatusEx
	m.Length = uint32(unsafe.Sizeof(m))
	r, _, _ := kernel32.NewProc("GlobalMemoryStatusEx").Call(uintptr(unsafe.Pointer(&m)))
	if r == 0 {
		return 8000
	}
	return int(m.TotalPhys / (1024 * 1024))
}

func freeGB(path string) float64 {
	p, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0
	}
	var free, total, totalFree uint64
	r, _, _ := kernel32.NewProc("GetDiskFreeSpaceExW").Call(uintptr(unsafe.Pointer(p)), uintptr(unsafe.Pointer(&free)), uintptr(unsafe.Pointer(&total)), uintptr(unsafe.Pointer(&totalFree)))
	if r == 0 {
		return 0
	}
	return float64(free) / 1e9
}

var _ = os.Getenv
