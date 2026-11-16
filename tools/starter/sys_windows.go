//go:build windows

// The Windows parts of the Lantern starter: no black windows, a desktop icon,
// the computer kept awake while downloading, a message box when it cannot go on.
package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
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

// makeShortcuts: "Lantern" on the desktop and in the Start menu, made by Windows's own shell-link object.
// (1.24.21, Adam's laptop: Windows Defender quarantined the starter as a Trojan. It had made these with PowerShell,
// run hidden with its execution policy bypassed, straight after copying itself into the user folder: what a dropper
// does. No PowerShell for them now.)
func makeShortcuts(root, exe string) error {
	var errs []string
	for _, id := range []*guid{&folderDesktop, &folderPrograms} {
		d := knownFolder(id)
		if d == "" {
			continue
		}
		if err := writeShortcut(filepath.Join(d, "Lantern.lnk"), exe, root, "Lantern: an offline office and learning suite with its own AI"); err != nil {
			errs = append(errs, err.Error())
		}
	}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

// shortcutTest: for the tests, the icon made in dir (dir\Lantern.lnk, to this program)
func shortcutTest(dir string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return writeShortcut(filepath.Join(dir, "Lantern.lnk"), exe, filepath.Dir(exe), "Lantern: an offline office and learning suite with its own AI")
}

type guid struct {
	d1     uint32
	d2, d3 uint16
	d4     [8]byte
}

var (
	ole32   = syscall.NewLazyDLL("ole32.dll")
	shell32 = syscall.NewLazyDLL("shell32.dll")

	clsidShellLink = guid{0x00021401, 0, 0, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidShellLinkW  = guid{0x000214F9, 0, 0, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	iidPersistFile = guid{0x0000010B, 0, 0, [8]byte{0xC0, 0, 0, 0, 0, 0, 0, 0x46}}
	folderDesktop  = guid{0xB4BFCC3A, 0xDB2C, 0x424C, [8]byte{0xB0, 0x29, 0x7F, 0xE9, 0x9A, 0x87, 0xC6, 0x41}}
	folderPrograms = guid{0xA77F5D77, 0x2E2B, 0x44C3, [8]byte{0xA6, 0xA2, 0xAB, 0xA6, 0x01, 0x05, 0x4A, 0x51}}
)

// comCall: method idx of a COM object's table (IUnknown's three first)
func comCall(obj uintptr, idx int, args ...uintptr) uintptr {
	// obj is the object's address; its first word, the address of its table of methods
	vtbl := **(***[32]uintptr)(unsafe.Pointer(&obj))
	fn := vtbl[idx]
	r, _, _ := syscall.SyscallN(fn, append([]uintptr{obj}, args...)...)
	return r
}

func failed(hr uintptr) bool { return int32(uint32(hr)) < 0 }

// knownFolder: SHGetKnownFolderPath (the desktop, the Start menu's programs) for this person
func knownFolder(id *guid) string {
	var p *uint16
	hr, _, _ := shell32.NewProc("SHGetKnownFolderPath").Call(uintptr(unsafe.Pointer(id)), 0, 0, uintptr(unsafe.Pointer(&p)))
	if failed(hr) || p == nil {
		return ""
	}
	defer ole32.NewProc("CoTaskMemFree").Call(uintptr(unsafe.Pointer(p)))
	var u []uint16
	for i := 0; i < 32768; i++ {
		c := *(*uint16)(unsafe.Add(unsafe.Pointer(p), i*2))
		if c == 0 {
			break
		}
		u = append(u, c)
	}
	return syscall.UTF16ToString(u)
}

// writeShortcut: a .lnk to target, starting in dir, through IShellLinkW and IPersistFile
func writeShortcut(lnk, target, dir, desc string) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	hr, _, _ := ole32.NewProc("CoInitializeEx").Call(0, 0x2) // COINIT_APARTMENTTHREADED
	if !failed(hr) {
		defer ole32.NewProc("CoUninitialize").Call()
	}
	var sl uintptr
	hr, _, _ = ole32.NewProc("CoCreateInstance").Call(uintptr(unsafe.Pointer(&clsidShellLink)), 0, 1, uintptr(unsafe.Pointer(&iidShellLinkW)), uintptr(unsafe.Pointer(&sl)))
	if failed(hr) || sl == 0 {
		return fmt.Errorf("the shell link object: 0x%08x", uint32(hr))
	}
	defer comCall(sl, 2)
	t, _ := syscall.UTF16PtrFromString(target)
	d, _ := syscall.UTF16PtrFromString(dir)
	ds, _ := syscall.UTF16PtrFromString(desc)
	l, _ := syscall.UTF16PtrFromString(lnk)
	for _, c := range []struct {
		idx int
		arg *uint16
		say string
	}{{20, t, "SetPath"}, {9, d, "SetWorkingDirectory"}, {7, ds, "SetDescription"}} {
		if hr := comCall(sl, c.idx, uintptr(unsafe.Pointer(c.arg))); failed(hr) {
			return fmt.Errorf("%s: 0x%08x", c.say, uint32(hr))
		}
	}
	_ = comCall(sl, 17, uintptr(unsafe.Pointer(t)), 0) // SetIconLocation: the program's own
	var pf uintptr
	if hr := comCall(sl, 0, uintptr(unsafe.Pointer(&iidPersistFile)), uintptr(unsafe.Pointer(&pf))); failed(hr) || pf == 0 {
		return fmt.Errorf("IPersistFile: 0x%08x", uint32(hr))
	}
	defer comCall(pf, 2)
	if hr := comCall(pf, 6, uintptr(unsafe.Pointer(l)), 1); failed(hr) {
		return fmt.Errorf("saving %s: 0x%08x", lnk, uint32(hr))
	}
	runtime.KeepAlive(t)
	runtime.KeepAlive(d)
	runtime.KeepAlive(ds)
	runtime.KeepAlive(l)
	return nil
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

func showError(title, msg string) { messageBox(title, msg, 0x30) } // MB_ICONWARNING

func showInfo(title, msg string) { messageBox(title, msg, 0x40) } // MB_ICONINFORMATION

func messageBox(title, msg string, kind uintptr) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(msg)
	_, _, _ = user32.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), kind)
	runtime.KeepAlive(t)
	runtime.KeepAlive(m)
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
