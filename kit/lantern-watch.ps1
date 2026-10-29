<#
lantern-watch.ps1 -- Lantern Watch for Windows (Lantern's kit).

Keeps the person at the computer told the truth while the AI model loads,
and keeps the load from freezing the computer.

  plan   before the engine starts: is there room in FREE memory (not just
         total) for the model start-lantern picked? If not, it asks whether
         to use a smaller model, load anyway, or stop so programs can be
         closed. Prints KEY=VALUE lines for start-lantern.bat:
           PICK=<file name in models\>   use this model instead
           (no ARGS on Windows: llama.cpp's --prio -1 keeps Windows 11 power
           throttling on for its threads, which parks them on slow cores.
           LANTERN_PRIO=1 makes the watcher lower the engine's priority
           class instead, which keeps the throttling opt-out.)
           STOP=1                        the person chose to stop
  watch  while the engine runs: measures what is really happening -- bytes
         read from the model's drive, free memory, Windows paging other
         programs out -- and tells it plainly: in the console title, as
         occasional lines in the black window, and as JSON at
         http://127.0.0.1:<StatusPort>/status for Lantern's loading screen.
         Writes a one-line-per-second log of every load to kit\logs.
  selftest  prints what this computer lets the watcher read, then exits.

Only built-in Windows parts (PowerShell 5.1, CIM performance classes,
Windows Forms). No admin rights. Nothing here changes the computer apart
from the log files. If anything fails, Lantern starts exactly as before.

  -Simulate <fixture.json> -Fast   replays recorded readings instead of
                                   reading Windows (tests; any OS with pwsh)
#>
param(
  [Parameter(Position = 0)][ValidateSet('plan', 'watch', 'selftest')][string]$Mode = 'watch',
  [string]$Model = '',
  [string]$MmProj = '',
  [string]$Models = '',
  [switch]$NoVision,
  [switch]$Forced,
  [int]$Port = 8080,
  [int]$StatusPort = 8082,
  [string]$LogDir = '',
  [string]$Simulate = '',
  [switch]$Fast
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # the Storage module draws progress bars over the shared console
$LW_VERSION = '1.1'
$INV = [Globalization.CultureInfo]::InvariantCulture
# A path typed by hand can be relative (kit\models\...). The drive letter is
# what finds the drive's read counter, so every path is made full here.
function Full-Path([string]$p) {
  if (-not $p -or $Simulate) { return $p }
  try { return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($p) } catch { return $p }
}
$Model = Full-Path $Model; $MmProj = Full-Path $MmProj; $Models = Full-Path $Models; $LogDir = Full-Path $LogDir

# ---- tuning (first guesses; the load logs are there to refine them) --------
$ENGINE_OVERHEAD_MB = 1200  # KV cache for -c 8192 plus compute buffers
$PUSH_OUT_OK_MB     = 1500  # Windows may push out this much of idle programs without a freeze worth asking about
$CHOICE_SECONDS     = 60    # the question answers itself after this
$SLOW_MBPS          = 45    # below this the drive or port is called slow
$TIGHT_AVAIL_MB     = 1200
$HEAVY_AVAIL_MB     = 500
$TIGHT_PAGING_PS    = 250   # pages a second written out to the page file
$HEAVY_PAGING_PS    = 1000
$PAGING_AVAIL_MB    = 4096  # paging with more than this free is Windows tidying up, not a shortage (1.1)
$HEAVY_COMMIT_PCT   = 97
$PREPARE_TAIL_MS    = 6000  # after the last byte is read, until it answers
$KEEP_LOGS          = 20
$READY_INTERVAL_MS  = 10000 # after ready: a reading every 10 s (the engine needs the computer)
$NO_ENGINE_MS       = 30000 # no engine process by then: give up (another Lantern already running, or it failed)
$LOG_FLUSH_MS       = 30000 # log rows go to the drive every 30 s, not every second (cheap sticks have no write cache)
$CIM_TIMEOUT_S      = 5

$script:Sim = $null
if ($Simulate) { $script:Sim = Get-Content -Raw -LiteralPath $Simulate | ConvertFrom-Json }

function Say([string]$text) { try { [Console]::Error.WriteLine($text) } catch { } }
function Out-Key([string]$k, [string]$v) { [Console]::Out.WriteLine($k + '=' + $v) }
function F1([double]$x) { return $x.ToString('0.0', $INV) }
function F0([double]$x) { return $x.ToString('0', $INV) }
function Gb([double]$mb) { return (F1 ($mb / 1024)) + ' GB' }
function Nice-Name([string]$path) { return ([IO.Path]::GetFileNameWithoutExtension($path)) }
function Now-Ms { return [DateTimeOffset]::Now.ToUnixTimeMilliseconds() }
function Clock([double]$ms) {
  $s = [Math]::Max(0.0, [Math]::Round($ms / 1000))
  if ($s -lt 60) { return (F0 $s) + ' s' }
  $m = [Math]::Floor($s / 60); $r = $s - 60 * $m
  if ($m -lt 60) { return (F0 $m) + ' min ' + (F0 $r).PadLeft(2, '0') + ' s' }
  return (F0 ([Math]::Floor($m / 60))) + ' h ' + (F0 ($m % 60)) + ' min'
}

# ---- where the logs go -----------------------------------------------------
function Get-LogDir {
  if ($script:Sim -and -not $LogDir) { return $null }   # replays never write unless asked
  $d = $LogDir
  if (-not $d) { $d = Join-Path $PSScriptRoot 'logs' }
  try {
    if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    $probe = Join-Path $d '.write-test'
    [IO.File]::WriteAllText($probe, 'ok'); Remove-Item -LiteralPath $probe -Force
    return $d
  } catch {
    $t = Join-Path ([IO.Path]::GetTempPath()) 'Lantern-logs'
    try { if (-not (Test-Path -LiteralPath $t)) { New-Item -ItemType Directory -Path $t -Force | Out-Null }; return $t } catch { return $null }
  }
}

# ---- the model and its vision part ------------------------------------------
# Same rule as start-lantern.bat: mmproj-<base>[-F16|-BF16|-F32].gguf belongs
# to a model whose file name starts with "<base>-".
function Find-MmProj([string]$modelPath, [string]$dir) {
  if ($NoVision -or -not $dir -or -not (Test-Path -LiteralPath $dir)) { return $null }
  $mn = [IO.Path]::GetFileName($modelPath); $hit = $null
  foreach ($v in (Get-ChildItem -LiteralPath $dir -Filter 'mmproj-*.gguf' -File -ErrorAction SilentlyContinue)) {
    $b = $v.BaseName -replace '^mmproj-', ''
    $b = $b.Replace('-BF16', '').Replace('-F16', '').Replace('-F32', '')
    if ($mn.StartsWith($b + '-', [StringComparison]::OrdinalIgnoreCase)) { $hit = $v.FullName }
  }
  return $hit
}
function File-Bytes([string]$p) {
  if ($script:Sim) {
    $n = [IO.Path]::GetFileName($p)
    foreach ($m in $script:Sim.models) { if ($m.name -eq $n) { return [double]$m.bytes } }
    return 0
  }
  if ($p -and (Test-Path -LiteralPath $p)) { return [double](Get-Item -LiteralPath $p).Length }
  return 0
}
function Need-Mb([double]$modelBytes, [double]$visionBytes) {
  return ($modelBytes + $visionBytes) / 1MB + $ENGINE_OVERHEAD_MB
}
# Fits when Windows needs to push out no more than PUSH_OUT_OK_MB to make room.
function Fits([double]$needMb, [double]$availMb) { return ($needMb - $availMb) -le $PUSH_OUT_OK_MB }
function Get-Candidates([string]$dir) {
  $list = @()
  if ($script:Sim) {
    foreach ($m in $script:Sim.models) {
      if ($m.name -notmatch 'mmproj') { $list += [pscustomobject]@{ Name = $m.name; Path = (Join-Path $dir $m.name); Bytes = [double]$m.bytes; Vision = [double]$m.vbytes } }
    }
  } elseif ($dir -and (Test-Path -LiteralPath $dir)) {
    foreach ($f in (Get-ChildItem -LiteralPath $dir -Filter '*.gguf' -File -ErrorAction SilentlyContinue)) {
      if ($f.Name -match 'mmproj') { continue }
      $vp = Find-MmProj $f.FullName $dir
      $list += [pscustomobject]@{ Name = $f.Name; Path = $f.FullName; Bytes = [double]$f.Length; Vision = (File-Bytes $vp) }
    }
  }
  return @($list | Sort-Object Bytes -Descending)
}

# ---- memory right now ---------------------------------------------------------
function Get-MemoryNow {
  if ($script:Sim) { return [pscustomobject]@{ TotalMb = [double]$script:Sim.plan.totalMb; AvailMb = [double]$script:Sim.plan.availMb } }
  $total = 0; $avail = 0
  # Win32_OperatingSystem answers at once; the performance classes can take
  # seconds the first time after a boot (exactly when memory is short)
  try { $os = Get-CimInstance Win32_OperatingSystem -Property FreePhysicalMemory, TotalVisibleMemorySize -OperationTimeoutSec $CIM_TIMEOUT_S; $avail = [double]$os.FreePhysicalMemory / 1KB; $total = [double]$os.TotalVisibleMemorySize / 1KB } catch { }
  try { $t = [double](Get-CimInstance Win32_ComputerSystem -Property TotalPhysicalMemory -OperationTimeoutSec $CIM_TIMEOUT_S).TotalPhysicalMemory / 1MB; if ($t -gt 0) { $total = $t } } catch { }
  if ($env:LANTERN_AVAIL_MB) { $avail = [double]$env:LANTERN_AVAIL_MB }   # pretend, for testing
  if ($env:LANTERN_MEM_MB) { $total = [double]$env:LANTERN_MEM_MB }
  return [pscustomobject]@{ TotalMb = $total; AvailMb = $avail }
}

# ---- the question, as a small window with plain buttons --------------------
# Returns the index of the button pressed; the default when time runs out or
# the window is closed.
function Ask-Choice([string]$title, [string]$text, [string[]]$labels, [int]$default) {
  if ($script:Sim) { if ($null -ne $script:Sim.plan.answer) { return [int]$script:Sim.plan.answer } else { return $default } }
  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $f = New-Object System.Windows.Forms.Form
    $f.Text = $title; $f.TopMost = $true; $f.StartPosition = 'CenterScreen'
    $f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.MinimizeBox = $false
    $f.AutoSize = $true; $f.AutoSizeMode = 'GrowAndShrink'
    $f.Padding = New-Object System.Windows.Forms.Padding(16)
    $f.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $f.Tag = $default
    $p = New-Object System.Windows.Forms.FlowLayoutPanel
    $p.FlowDirection = 'TopDown'; $p.WrapContents = $false; $p.AutoSize = $true
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $text; $l.AutoSize = $true; $l.MaximumSize = New-Object System.Drawing.Size(560, 0)
    $l.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 12)
    $p.Controls.Add($l)
    $btns = @()
    for ($i = 0; $i -lt $labels.Count; $i++) {
      $b = New-Object System.Windows.Forms.Button
      $b.Text = $labels[$i]; $b.Tag = $i; $b.AutoSize = $true
      $b.MinimumSize = New-Object System.Drawing.Size(560, 36); $b.TextAlign = 'MiddleLeft'
      $b.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 6)
      $b.Add_Click({ param($s, $e) $fm = $s.FindForm(); $fm.Tag = [int]$s.Tag; $fm.Close() })
      $p.Controls.Add($b); $btns += $b
    }
    $c = New-Object System.Windows.Forms.Label
    $c.AutoSize = $true; $c.ForeColor = [System.Drawing.Color]::DimGray
    $c.Margin = New-Object System.Windows.Forms.Padding(0, 6, 0, 0)
    $p.Controls.Add($c)
    $f.Controls.Add($p)
    $f.AcceptButton = $btns[$default]
    $state = @{ left = $CHOICE_SECONDS; form = $f; note = $c; what = $labels[$default] }
    $c.Text = 'If nobody chooses, Lantern takes the first choice in ' + $state.left + ' s.'
    $t = New-Object System.Windows.Forms.Timer
    $t.Interval = 1000
    $t.Add_Tick({
      $state.left = $state.left - 1
      if ($state.left -le 0) { $state.form.Close() }
      else { $state.note.Text = 'If nobody chooses, Lantern takes the first choice in ' + $state.left + ' s.' }
    }.GetNewClosure())
    $f.Add_Shown({ $state.form.Activate() }.GetNewClosure())
    $t.Start()
    [void]$f.ShowDialog()
    $t.Stop(); $t.Dispose()
    $r = [int]$f.Tag
    $f.Dispose()
    return $r
  } catch {
    Say ('  (Lantern could not show its question window: ' + $_.Exception.Message + ')')
    return $default
  }
}

# =============================================================================
# plan
# =============================================================================
function Invoke-Plan {
  if (-not $Model) { return }
  $dir = $Models; if (-not $dir) { $dir = Split-Path -Parent $Model }
  $mem = Get-MemoryNow
  if ($mem.AvailMb -le 0) { Say '  Lantern Watch: could not read free memory; starting as before.'; return }
  $mb = File-Bytes $Model
  $vb = File-Bytes (Find-MmProj $Model $dir)
  if ($script:Sim) { foreach ($m in $script:Sim.models) { if ($m.name -eq [IO.Path]::GetFileName($Model)) { $vb = [double]$m.vbytes } } }
  if ($NoVision) { $vb = 0 }
  $need = Need-Mb $mb $vb
  $name = Nice-Name $Model
  $plan = [ordered]@{ v = 1; t = (Now-Ms); wanted = [IO.Path]::GetFileName($Model); picked = [IO.Path]::GetFileName($Model); totalMb = [Math]::Round($mem.TotalMb); availMb = [Math]::Round($mem.AvailMb); needMb = [Math]::Round($need); choice = 'fits'; reason = '' }
  # The drive's kind is worked out now, before the engine starts and while
  # the drive is idle; the watcher reads it from last-plan.json.
  if (-not $script:Sim) {
    $dq = Get-QuickDrive $Model $null
    if ($dq.name -and $dq.kind -eq 'drive') { $dq = Get-DriveInfo $Model }
    $plan.drive = [ordered]@{ name = $dq.name; kind = $dq.kind }
  }
  Say ('Lantern Watch: ' + (Gb $mem.AvailMb) + ' of ' + (Gb $mem.TotalMb) + ' memory is free; ' + $name + ' needs about ' + (Gb $need) + '.')
  if (Fits $need $mem.AvailMb) {
    if ($mem.AvailMb -lt $need) { Say '  A little short: Windows will make room by moving idle programs out. Please do not open other programs while it loads.' }
    Save-Plan $plan; return
  }

  $everNeed = $need -gt ($mem.TotalMb - 2500)   # would not fit even with everything else closed
  $cands = Get-Candidates $dir
  $alt = $null
  foreach ($c in $cands) {
    if ($c.Bytes -ge $mb) { continue }
    $cv = $c.Vision; if ($NoVision) { $cv = 0 }
    if (Fits (Need-Mb $c.Bytes $cv) $mem.AvailMb) { $alt = $c; break }
  }
  $altTight = $false
  if (-not $alt) {
    $smaller = @($cands | Where-Object { $_.Bytes -lt $mb })
    if ($smaller.Count -gt 0) { $alt = $smaller[$smaller.Count - 1]; $altTight = $true }
  }
  $usedBy = [Math]::Max(0.0, $mem.TotalMb - $mem.AvailMb)
  if ($Forced) {
    Say ('  Free memory is short for ' + $name + ' (asked for by name). Loading it anyway; the computer may be slow while it loads.')
    $plan.choice = 'forced'; $plan.reason = 'short'; Save-Plan $plan; return
  }
  $why = 'Lantern was about to load ' + $name + ', which needs about ' + (Gb $need) + ' of free memory.' + "`r`n`r`n"
  if ($everNeed) {
    $why += 'This computer has ' + (Gb $mem.TotalMb) + ' in all, which is not enough for that model even with every other program closed.'
  } else {
    $why += 'This computer has ' + (Gb $mem.TotalMb) + ', but only ' + (Gb $mem.AvailMb) + ' is free right now: other programs are using about ' + (Gb $usedBy) + '. Closing some of them (browser tabs especially) frees memory.'
  }
  $why += "`r`n`r`n" + 'Loading it now makes Windows push other programs out to the disk, and the whole computer can freeze or crawl for several minutes.'
  if ($alt) {
    $an = Nice-Name $alt.Name
    $first = 'Use ' + $an + ' now (fits in free memory) - recommended'
    if ($altTight) { $first = 'Use ' + $an + ' now (the smallest model here; still a tight fit)' }
    $labels = @($first, ('Load ' + $name + ' anyway (the computer may freeze for a few minutes)'))
    if (-not $everNeed) { $labels += 'Stop, so I can close other programs, then start Lantern again' }
    $r = Ask-Choice 'Lantern: not enough free memory right now' ($why + "`r`n`r`nWhat should Lantern do?") $labels 0
    if ($r -eq 0) {
      Say ('  Using ' + $an + ' instead (free memory).'); Out-Key 'PICK' $alt.Name
      $plan.picked = $alt.Name; $plan.choice = 'smaller'; $plan.reason = $(if ($everNeed) { 'total' } else { 'busy' })
    } elseif ($r -eq 2) {
      Say '  Stopped, so other programs can be closed first.'; Out-Key 'STOP' '1'
      $plan.choice = 'stop'; $plan.reason = 'busy'
    } else {
      Say ('  Loading ' + $name + ' anyway. The computer may be slow until it has loaded: please wait and do not open other programs meanwhile.')
      $plan.choice = 'anyway'; $plan.reason = $(if ($everNeed) { 'total' } else { 'busy' })
    }
  } else {
    $labels = @(('Load ' + $name + ' anyway (the computer may be slow for a few minutes)'))
    if (-not $everNeed) { $labels += 'Stop, so I can close other programs, then start Lantern again' }
    $r = Ask-Choice 'Lantern: memory is tight' ($why + "`r`n`r`nThere is no smaller model in the kit. What should Lantern do?") $labels 0
    if ($r -eq 1) { Say '  Stopped, so other programs can be closed first.'; Out-Key 'STOP' '1'; $plan.choice = 'stop' }
    else { Say ('  Loading ' + $name + ' anyway; please wait and do not open other programs meanwhile.'); $plan.choice = 'anyway' }
    $plan.reason = $(if ($everNeed) { 'total' } else { 'busy' })
  }
  Save-Plan $plan
}
function Save-Plan($plan) {
  $d = Get-LogDir; if (-not $d) { return }
  try { [IO.File]::WriteAllText((Join-Path $d 'last-plan.json'), ($plan | ConvertTo-Json -Compress)) } catch { }
}

# =============================================================================
# readings (Windows, or the -Simulate fixture)
# =============================================================================
# Normalised sample: t (ms since start), engine (bool), health (0/200/503/..),
# readBytes (cumulative from the model's drive, or $null), availMb, totalMb,
# commitPct, pagingPs (pages/s written to the page file), cpuPct,
# engineCpuPct, engineWsMb, enginePrivMb.
$script:prev = $null
$script:proc = $null
$script:watchStart = Get-Date
$script:simIndex = 0
$script:sources = [ordered]@{ memory = $false; drive = $false; paging = $false; cpu = $false; engine = $false }

function Get-Health {
  try {
    $req = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:' + $Port + '/health')
    $req.Timeout = 1500; $req.ReadWriteTimeout = 1500; $req.Proxy = $null; $req.KeepAlive = $false
    $res = $req.GetResponse(); $code = [int]$res.StatusCode; $res.Close(); return $code
  } catch [System.Net.WebException] {
    $r = $_.Exception.Response
    if ($r) { $code = [int]$r.StatusCode; $r.Close(); return $code }
    return 0
  } catch { return 0 }
}
function Find-Engine {
  if ($script:proc) {
    try { $script:proc.Refresh(); if (-not $script:proc.HasExited) { return $script:proc } } catch { }
    return $null
  }
  try {
    $cut = $script:watchStart.AddSeconds(-60)   # PowerShell can take seconds to start on a cold boot
    $p = Get-Process -Name 'llama-server' -ErrorAction SilentlyContinue | Where-Object { try { $_.StartTime -ge $cut } catch { $false } } | Sort-Object StartTime -Descending | Select-Object -First 1
    if ($p) {
      $script:proc = $p
      if ($env:LANTERN_PRIO -eq '1') { try { $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal; Say '  Lantern Watch: engine set to below-normal priority (LANTERN_PRIO=1).' } catch { } }
    }
    return $p
  } catch { return $null }
}
function Read-Sample([string]$driveName, [string]$sysName) {
  if ($script:Sim) {
    $arr = @($script:Sim.samples)
    if ($script:simIndex -ge $arr.Count) { return $null }
    $x = $arr[$script:simIndex]; $script:simIndex++
    $o = [ordered]@{ t = [double]$script:simIndex * 1000 - 1000; engine = $true; health = 0; readBytes = $null; availMb = $null; totalMb = [double]$script:Sim.plan.totalMb; commitPct = $null; pagingPs = $null; psiSome = $null; psiFull = $null; cpuPct = $null; engineCpuPct = $null; engineWsMb = $null; enginePrivMb = $null }
    foreach ($k in @($x.PSObject.Properties.Name)) { $o[$k] = $x.$k }
    return [pscustomobject]$o
  }
  $now = [Diagnostics.Stopwatch]::GetTimestamp()
  $s = [ordered]@{ t = ((Get-Date) - $script:watchStart).TotalMilliseconds; engine = $false; health = 0; readBytes = $null; availMb = $null; totalMb = $null; commitPct = $null; pagingPs = $null; psiSome = $null; psiFull = $null; cpuPct = $null; engineCpuPct = $null; engineWsMb = $null; enginePrivMb = $null }
  $raw = @{}
  try {
    $m = Get-CimInstance Win32_PerfRawData_PerfOS_Memory -Property AvailableBytes, CommittedBytes, CommitLimit, PagesOutputPersec -OperationTimeoutSec $CIM_TIMEOUT_S
    $s.availMb = [double]$m.AvailableBytes / 1MB
    if ([double]$m.CommitLimit -gt 0) { $s.commitPct = 100.0 * [double]$m.CommittedBytes / [double]$m.CommitLimit }
    $raw.pagesOut = [double]$m.PagesOutputPersec
    $script:sources.memory = $true
  } catch {
    try { $os = Get-CimInstance Win32_OperatingSystem -Property FreePhysicalMemory -OperationTimeoutSec $CIM_TIMEOUT_S; $s.availMb = [double]$os.FreePhysicalMemory / 1KB; $script:sources.memory = $true } catch { }
  }
  if ($driveName) {
    try {
      $flt = "Name='" + $driveName + "'"
      if ($sysName -and $sysName -ne $driveName) { $flt += " OR Name='" + $sysName + "'" }
      foreach ($d in @(Get-CimInstance Win32_PerfRawData_PerfDisk_LogicalDisk -Filter $flt -Property Name, DiskReadBytesPersec -OperationTimeoutSec $CIM_TIMEOUT_S)) {
        if ($d.Name -eq $driveName) { $raw.read = [double]$d.DiskReadBytesPersec }
      }
      if ($null -ne $raw.read) { $script:sources.drive = $true }
    } catch { }
  }
  try {
    $c = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -Property PercentProcessorTime -OperationTimeoutSec $CIM_TIMEOUT_S
    $s.cpuPct = [double]$c.PercentProcessorTime; $script:sources.cpu = $true
  } catch { }
  $p = Find-Engine
  if ($p) {
    $s.engine = $true; $script:sources.engine = $true
    try { $raw.cpuSec = $p.TotalProcessorTime.TotalSeconds } catch { }
    try { $s.engineWsMb = [double]$p.WorkingSet64 / 1MB; $s.enginePrivMb = [double]$p.PrivateMemorySize64 / 1MB } catch { }
  }
  $s.health = Get-Health
  if ($script:prev) {
    $dt = ($now - $script:prev.ts) / [Diagnostics.Stopwatch]::Frequency
    if ($dt -gt 0) {
      if ($null -ne $raw.pagesOut -and $null -ne $script:prev.pagesOut) { $s.pagingPs = [Math]::Max(0.0, ($raw.pagesOut - $script:prev.pagesOut) / $dt); $script:sources.paging = $true }
      if ($null -ne $raw.cpuSec -and $null -ne $script:prev.cpuSec) { $s.engineCpuPct = [Math]::Max(0.0, 100.0 * ($raw.cpuSec - $script:prev.cpuSec) / $dt / [Environment]::ProcessorCount) }
    }
  }
  if ($null -ne $raw.read) {
    if ($null -eq $script:readBase) { $script:readBase = $raw.read }
    $s.readBytes = [Math]::Max(0.0, $raw.read - $script:readBase)
  }
  $script:prev = @{ ts = $now; pagesOut = $raw.pagesOut; cpuSec = $raw.cpuSec }
  return [pscustomobject]$s
}
$script:readBase = $null

function Get-DriveInfo([string]$path) {
  $info = [ordered]@{ name = $null; kind = 'drive'; word = "this computer's drive" }
  if ($script:Sim) {
    $k = [string]$script:Sim.drive
    if ($k -eq 'usb') { $info.kind = 'usb'; $info.word = 'the USB stick' } elseif ($k -eq 'network') { $info.kind = 'network'; $info.word = 'the network drive' }
    $info.name = 'E:'; return [pscustomobject]$info
  }
  if ($path -match '^\\\\') { $info.kind = 'network'; $info.word = 'the network drive'; return [pscustomobject]$info }
  if ($path -match '^([A-Za-z]):') {
    $letter = $Matches[1].ToUpper(); $info.name = $letter + ':'
    try {
      $bus = (Get-Partition -DriveLetter $letter -ErrorAction Stop | Get-Disk -ErrorAction Stop).BusType
      if ([string]$bus -eq 'USB') { $info.kind = 'usb'; $info.word = 'the USB stick' }
    } catch {
      try {
        $ld = Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='" + $info.name + "'") -Property DriveType -OperationTimeoutSec $CIM_TIMEOUT_S
        if ([int]$ld.DriveType -eq 2) { $info.kind = 'usb'; $info.word = 'the USB stick' }
        elseif ([int]$ld.DriveType -eq 4) { $info.kind = 'network'; $info.word = 'the network drive' }
      } catch { }
    }
  }
  return [pscustomobject]$info
}
# Get-QuickDrive: the drive while the model loads. Its letter comes from the
# path, its kind from the plan (worked out before the engine started) or from
# Windows' instant drive type. Get-DriveInfo's storage queries are not used
# while the model loads: on Adam's laptop (the 35B from a USB stick,
# 2026-10-29) the watcher's start-up took 125 s and its first reading came
# only as the model was ready.
function Get-QuickDrive([string]$path, $plan) {
  if ($script:Sim) { return Get-DriveInfo $path }
  $info = [ordered]@{ name = $null; kind = 'drive'; word = "this computer's drive" }
  if ($path -match '^\\\\') { $info.kind = 'network'; $info.word = 'the network drive'; return [pscustomobject]$info }
  if (-not ($path -match '^([A-Za-z]):')) { return [pscustomobject]$info }
  $info.name = $Matches[1].ToUpper() + ':'
  $k = $null
  try { if ($plan -and $plan.drive -and ([string]$plan.drive.name -eq $info.name)) { $k = [string]$plan.drive.kind } } catch { }
  if (-not $k) {
    try {
      $t = [string](New-Object System.IO.DriveInfo($info.name)).DriveType
      if ($t -eq 'Removable') { $k = 'usb' } elseif ($t -eq 'Network') { $k = 'network' }
    } catch { }
  }
  if ($k -eq 'usb') { $info.kind = 'usb'; $info.word = 'the USB stick' } elseif ($k -eq 'network') { $info.kind = 'network'; $info.word = 'the network drive' }
  return [pscustomobject]$info
}

# =============================================================================
# watch: the story
# =============================================================================
function New-State([string]$model, [string]$mmproj) {
  $mb = File-Bytes $model; $vb = 0
  if ($mmproj) { $vb = File-Bytes $mmproj }
  if ($script:Sim -and $script:Sim.models) { foreach ($m in $script:Sim.models) { if ($m.name -eq [IO.Path]::GetFileName($model)) { $vb = [double]$m.vbytes } } }
  return @{
    model = [IO.Path]::GetFileName($model); bytes = $mb + $vb; startedMs = (Now-Ms)
    phase = 'starting'; pressure = 'ok'; upRun = 0; downRun = 0
    rates = New-Object System.Collections.ArrayList; paging = New-Object System.Collections.ArrayList
    firstReadT = $null; readyT = $null; lowRateRun = 0; slowRun = 0; firstSampleT = $null
    seenEngine = $false; seenHealth = $false; refusedRun = 0
    minAvail = $null; maxPaging = 0; worstPressure = 'ok'; peakWs = 0; peakPriv = 0
    lastSample = $null; lastLineT = -99999; lastKey = ''; story = $null; done = $false
    history = New-Object System.Collections.ArrayList
  }
}
function Rank([string]$p) { switch ($p) { 'heavy' { return 2 } 'tight' { return 1 } default { return 0 } } }

function Step($st, $s, $drive, $plan) {
  $st.lastSample = $s
  if ($null -eq $st.firstSampleT) { $st.firstSampleT = $s.t }
  if ($s.engine) { $st.seenEngine = $true }
  if ($s.health -gt 0) { $st.seenHealth = $true }
  [void]$st.history.Add($s); if ($st.history.Count -gt 900) { $st.history.RemoveAt(0) }
  # read speed over the last five seconds
  $rate = $null
  if ($null -ne $s.readBytes) {
    $k = [Math]::Min(5, $st.history.Count - 1)
    if ($k -ge 1) {
      $a = $st.history[$st.history.Count - 1 - $k]
      if ($null -ne $a.readBytes -and $s.t -gt $a.t) { $rate = ($s.readBytes - $a.readBytes) / (($s.t - $a.t) / 1000.0) / 1MB }
    }
    if ($null -eq $st.firstReadT -and $s.readBytes -gt 16MB) { $st.firstReadT = $s.t }
  }
  # memory pressure: up after 2 samples in a row, down after 5 (no flicker)
  if ($null -ne $s.pagingPs) { [void]$st.paging.Add([double]$s.pagingPs); if ($st.paging.Count -gt 3) { $st.paging.RemoveAt(0) } }
  $pg = $null; if ($st.paging.Count -gt 0) { $pg = ($st.paging | Measure-Object -Average).Average }
  # 1.1, from two real laptops: the engine's first read (Windows prefetches
  # the whole model) took commit to 98% with 5 GB still free, and the laptop
  # stayed smooth -- commit alone is no longer heavy; paging with 38 GB free
  # (after loading, on a 64 GB laptop) is no longer tight. Low free memory is.
  $level = 0
  if ($null -ne $s.availMb -and $s.availMb -lt $TIGHT_AVAIL_MB) { $level = 1 }
  if ($null -ne $pg -and $pg -ge $TIGHT_PAGING_PS -and ($null -eq $s.availMb -or $s.availMb -lt $PAGING_AVAIL_MB)) { $level = 1 }
  if ($null -ne $s.psiSome -and $s.psiSome -ge 10) { $level = 1 }
  if ($null -ne $s.availMb -and $s.availMb -lt $HEAVY_AVAIL_MB -and ($null -eq $pg -or $pg -ge $TIGHT_PAGING_PS)) { $level = 2 }
  if ($null -ne $pg -and $pg -ge $HEAVY_PAGING_PS -and $null -ne $s.availMb -and $s.availMb -lt $TIGHT_AVAIL_MB) { $level = 2 }
  if ($null -ne $s.commitPct -and $s.commitPct -ge $HEAVY_COMMIT_PCT -and $null -ne $s.availMb -and $s.availMb -lt $TIGHT_AVAIL_MB) { $level = 2 }
  if ($null -ne $s.psiFull -and $s.psiFull -ge 10) { $level = 2 }
  $cur = Rank $st.pressure
  if ($level -gt $cur) { $st.upRun++; $st.downRun = 0; if ($st.upRun -ge 2) { $cur = $level; $st.upRun = 0 } }
  elseif ($level -lt $cur) { $st.downRun++; $st.upRun = 0; if ($st.downRun -ge 5) { $cur = $level; $st.downRun = 0 } }
  else { $st.upRun = 0; $st.downRun = 0 }
  $st.pressure = @('ok', 'tight', 'heavy')[$cur]
  if ($cur -gt (Rank $st.worstPressure)) { $st.worstPressure = $st.pressure }
  if ($null -ne $s.availMb -and ($null -eq $st.minAvail -or $s.availMb -lt $st.minAvail)) { $st.minAvail = $s.availMb }
  if ($null -ne $pg -and $pg -gt $st.maxPaging) { $st.maxPaging = $pg }
  if ($null -ne $s.engineWsMb -and $s.engineWsMb -gt $st.peakWs) { $st.peakWs = $s.engineWsMb }
  if ($null -ne $s.enginePrivMb -and $s.enginePrivMb -gt $st.peakPriv) { $st.peakPriv = $s.enginePrivMb }

  # progress: bytes read from the model's drive, or what the engine holds
  $prog = $null
  if ($st.bytes -gt 0) {
    $a = 0.0
    if ($null -ne $s.readBytes) { $a = [double]$s.readBytes / $st.bytes }
    if ($null -ne $s.engineWsMb) { $a = [Math]::Max($a, [double]$s.engineWsMb * 1MB / $st.bytes) }
    if ($null -ne $s.readBytes -or $null -ne $s.engineWsMb) { $prog = [Math]::Min(0.99, $a) }
  }
  # phase. The engine counts as running when its process is there or its
  # address answers (in case the process cannot be looked at).
  if ($null -ne $rate -and $rate -lt 2 -and $null -ne $prog -and $prog -ge 0.5) { $st.lowRateRun++ } else { $st.lowRateRun = 0 }
  if ($s.health -gt 0) { $st.refusedRun = 0 } else { $st.refusedRun++ }
  # /health counts only once this start's engine has been seen: an engine that
  # failed to open the port must not make an older Lantern's server look like ours
  if ($st.seenEngine -and -not $s.engine) { $st.phase = 'stopped' }
  elseif (-not $st.seenEngine) { if ($s.t -gt $NO_ENGINE_MS) { $st.phase = 'stopped' } else { $st.phase = 'starting' } }
  elseif ($s.health -eq 200) { if ($null -eq $st.readyT) { $st.readyT = $s.t }; $st.phase = 'ready' }
  elseif ($s.health -eq 503) { if ($null -ne $prog -and ($prog -ge 0.97 -or $st.lowRateRun -ge 5)) { $st.phase = 'preparing' } else { $st.phase = 'reading' } }
  elseif ($s.health -eq 0) { if ($st.phase -eq 'starting' -and $null -ne $s.readBytes -and $s.readBytes -gt 64MB) { $st.phase = 'reading' } }
  else { $st.phase = 'other' }

  # time left
  $left = $null
  if ($st.phase -eq 'reading' -and $null -ne $rate -and $rate -ge 1 -and $null -ne $s.readBytes) {
    $left = ([Math]::Max(0.0, $st.bytes - $s.readBytes) / 1MB) / $rate * 1000 + $PREPARE_TAIL_MS
  } elseif ($st.phase -eq 'preparing') { $left = $PREPARE_TAIL_MS }
  if ($st.phase -eq 'reading' -and $null -ne $rate -and $rate -lt $SLOW_MBPS -and $rate -ge 0.5) { $st.slowRun++ } elseif ($null -ne $rate -and $rate -ge $SLOW_MBPS) { $st.slowRun = 0 }

  $st.story = Tell $st $s $prog $rate $left $drive $plan
  $snap = [ordered]@{
    v = 1; watcher = 'lantern-watch.ps1 ' + $LW_VERSION; os = 'windows'
    t = $st.startedMs + [long]$s.t; started = $st.startedMs
    phase = $st.phase; code = $st.story.code; message = $st.story.message; advice = $st.story.advice
    model = $st.model; bytes = [long]$st.bytes
    read = $(if ($null -ne $s.readBytes) { [long]$s.readBytes } else { $null })
    progress = $(if ($st.phase -eq 'ready') { 1 } elseif ($null -ne $prog) { [Math]::Round($prog, 4) } else { $null })
    mbps = $(if ($null -ne $rate -and ($st.phase -eq 'reading' -or $st.phase -eq 'preparing')) { [Math]::Round($rate, 1) } else { $null })
    leftMs = $(if ($null -ne $left) { [long]$left } else { $null })
    loadMs = $(if ($null -ne $st.readyT) { [long]$st.readyT } else { $null })
    pressure = $st.pressure
    mem = [ordered]@{ totalMb = $(if ($null -ne $s.totalMb) { [Math]::Round($s.totalMb) } else { $null }); availMb = $(if ($null -ne $s.availMb) { [Math]::Round($s.availMb) } else { $null }); commitPct = $(if ($null -ne $s.commitPct) { [Math]::Round($s.commitPct, 1) } else { $null }); pagingPs = $(if ($null -ne $pg) { [Math]::Round($pg) } else { $null }); psiSome = $s.psiSome; psiFull = $s.psiFull }
    cpu = [ordered]@{ totalPct = $(if ($null -ne $s.cpuPct) { [Math]::Round($s.cpuPct) } else { $null }); enginePct = $(if ($null -ne $s.engineCpuPct) { [Math]::Round($s.engineCpuPct) } else { $null }) }
    engine = [ordered]@{ wsMb = $(if ($null -ne $s.engineWsMb) { [Math]::Round($s.engineWsMb) } else { $null }); privMb = $(if ($null -ne $s.enginePrivMb) { [Math]::Round($s.enginePrivMb) } else { $null }) }
    drive = [ordered]@{ name = $drive.name; kind = $drive.kind; slow = ($st.slowRun -ge 10) }
    plan = $plan
  }
  return $snap
}

function Tell($st, $s, $prog, $rate, $left, $drive, $plan) {
  $code = $st.phase; $msg = ''; $adv = ''
  $gbDone = $null; if ($null -ne $s.readBytes) { $gbDone = F1 ([Math]::Min([double]$s.readBytes, [double]$st.bytes) / 1e9) }
  $gbAll = F1 ($st.bytes / 1e9)
  switch ($st.phase) {
    'starting' { $msg = "Starting Lantern's AI engine." }
    'reading' {
      if ($null -ne $gbDone -and $null -ne $rate -and $rate -ge 1) {
        $msg = 'Reading the AI model from ' + $drive.word + ': ' + $gbDone + ' of ' + $gbAll + ' GB at ' + (F0 $rate) + ' MB/s'
        if ($null -ne $left) { $msg += ', about ' + (Clock $left) + ' left.' } else { $msg += '.' }
      } elseif ($null -ne $prog) { $msg = 'Loading the AI model (' + (F0 (100 * $prog)) + '%).' }
      else { $msg = 'Loading the AI model.' }
      if ($st.slowRun -ge 10) { $code = 'reading-slow'; $adv = 'This drive or USB port is reading slowly (' + (F0 $rate) + ' MB/s). A USB 3 port (often blue) or a faster stick loads it much sooner.' }
    }
    'preparing' { $msg = 'The model is read. Getting it ready to answer: a few more seconds.' }
    'ready' {
      $msg = "Lantern's AI is ready."
      if ($null -ne $st.readyT) { $msg = "Lantern's AI is ready (loaded in " + (Clock $st.readyT) + ').' }
    }
    'stopped' { $msg = "Lantern's AI engine has stopped." }
    default { $msg = "Lantern's AI engine answered unexpectedly." }
  }
  if ($st.phase -ne 'stopped') {
    if ($st.pressure -eq 'heavy') {
      $code = 'pressure'
      $adv = 'This computer has run out of free memory, so Windows is moving other programs to the disk. It may stop responding for a minute or two, but the AI is still loading. Please wait, and do not click or open anything meanwhile: that makes it take longer.'
      if ($st.phase -eq 'ready') { $adv = 'Free memory has run out, so the computer and the AI may be slow. Closing other programs helps.' }
    } elseif ($st.pressure -eq 'tight' -and $st.phase -ne 'ready') {
      if (-not $adv) { $adv = 'Memory is nearly full, so the computer may respond slowly until this finishes. Please do not open other programs meanwhile.' }
      if ($code -eq 'reading') { $code = 'reading-tight' }
    }
  }
  if ($plan -and $plan.choice -eq 'smaller' -and $st.phase -ne 'stopped') {
    $note = 'Using ' + (Nice-Name $plan.picked) + ' because only ' + (Gb $plan.availMb) + ' of memory was free.'
    if (-not $adv) { $adv = $note } else { $adv = $note + ' ' + $adv }
  }
  return @{ code = $code; message = $msg; advice = $adv }
}

# ---- the status address for Lantern's loading screen --------------------------
function Start-Status([int]$port) {
  if ($script:Sim) { return $null }
  try {
    $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
    $l.Start(); return $l
  } catch { Say ('  Lantern Watch: port ' + $port + ' is busy, so the loading screen will estimate instead.'); return $null }
}
function Send-Http($stream, [int]$code, [string]$reason, [string]$body, [string]$origin) {
  $b = [Text.Encoding]::UTF8.GetBytes($body)
  $h = 'HTTP/1.1 ' + $code + ' ' + $reason + "`r`n" + 'Content-Type: application/json; charset=utf-8' + "`r`n" + 'Cache-Control: no-store' + "`r`n" + 'Connection: close' + "`r`n" + 'Content-Length: ' + $b.Length + "`r`n"
  if ($origin) { $h += 'Access-Control-Allow-Origin: ' + $origin + "`r`n" + 'Vary: Origin' + "`r`n" + 'Access-Control-Allow-Methods: GET, OPTIONS' + "`r`n" + 'Access-Control-Allow-Private-Network: true' + "`r`n" }
  $hb = [Text.Encoding]::ASCII.GetBytes($h + "`r`n")
  $stream.Write($hb, 0, $hb.Length); if ($b.Length) { $stream.Write($b, 0, $b.Length) }; $stream.Flush()
}
function Serve($listener, $snap, $st) {
  if (-not $listener) { return }
  $n = 0
  while ($n -lt 20 -and $listener.Pending()) {
    $n++; $c = $null
    try {
      $c = $listener.AcceptTcpClient(); $c.ReceiveTimeout = 400; $c.SendTimeout = 400
      $ns = $c.GetStream(); $buf = New-Object byte[] 4096; $req = ''
      $sw = [Diagnostics.Stopwatch]::StartNew()
      while ($req.IndexOf("`r`n`r`n") -lt 0 -and $sw.ElapsedMilliseconds -lt 400 -and $req.Length -lt 8192) {
        if ($ns.DataAvailable) { $k = $ns.Read($buf, 0, $buf.Length); if ($k -le 0) { break }; $req += [Text.Encoding]::ASCII.GetString($buf, 0, $k) }
        else { Start-Sleep -Milliseconds 5 }
      }
      $lines = $req -split "`r`n"; $first = $lines[0] -split ' '
      $method = $first[0]; $path = '/'; if ($first.Count -gt 1) { $path = $first[1] }
      $origin = ''
      foreach ($h in $lines) { if ($h -match '^(?i)origin:\s*(.+)$') { $origin = $Matches[1].Trim() } }
      $allowed = @(('http://127.0.0.1:' + $Port), ('http://localhost:' + $Port))
      if ($allowed -notcontains $origin) { $origin = '' }
      $q = $path.IndexOf('?'); if ($q -ge 0) { $path = $path.Substring(0, $q) }
      if ($method -eq 'OPTIONS') { Send-Http $ns 204 'No Content' '' $origin }
      elseif ($method -eq 'GET' -and $path -eq '/status') { Send-Http $ns 200 'OK' ($snap | ConvertTo-Json -Compress -Depth 5) $origin }
      elseif ($method -eq 'GET' -and $path -eq '/history') {
        $rows = @($st.history | Select-Object -Last 300 | ForEach-Object { [ordered]@{ t = [long]$_.t; read = $_.readBytes; availMb = $_.availMb; pagingPs = $_.pagingPs; cpuPct = $_.cpuPct; engineCpuPct = $_.engineCpuPct; engineWsMb = $_.engineWsMb; health = $_.health } })
        Send-Http $ns 200 'OK' (ConvertTo-Json -InputObject $rows -Compress -Depth 4) $origin
      } else { Send-Http $ns 404 'Not Found' '{"error":"not found"}' $origin }
    } catch { } finally { if ($c) { try { $c.Close() } catch { } } }
  }
}

# ---- the black window ---------------------------------------------------------
function Show-Console($st, $snap) {
  if ($script:Sim) { return }
  try {
    $title = 'Lantern AI: '
    switch ($st.phase) {
      'reading' { if ($null -ne $snap.progress) { $title += 'loading ' + (F0 (100 * $snap.progress)) + '%' } else { $title += 'loading' }; if ($null -ne $snap.leftMs) { $title += ', about ' + (Clock $snap.leftMs) + ' left' } }
      'preparing' { $title += 'almost ready' }
      'ready' { $title += 'ready - keep this window open' }
      'stopped' { $title += 'stopped' }
      default { $title += 'starting' }
    }
    if ($st.pressure -eq 'heavy') { $title += ' - low memory, please wait' }
    $Host.UI.RawUI.WindowTitle = $title
  } catch { }
  $key = $st.phase + '|' + $snap.code + '|' + $st.pressure
  $t = $st.lastSample.t
  $due = ($st.phase -eq 'reading' -and ($t - $st.lastLineT) -ge 15000)
  if ($key -ne $st.lastKey -or $due) {
    $line = '[Lantern] ' + $snap.message
    if ($snap.advice) { $line += ' ' + $snap.advice }
    try { [Console]::Out.WriteLine($line) } catch { }
    $st.lastKey = $key; $st.lastLineT = $t
  }
}

# ---- the log ------------------------------------------------------------------
# While the model loads, nothing is written anywhere: rows are kept in memory.
# (1.1: the engine asks Windows for the whole model at once, and anything else
# that touches the stick waits behind it -- from a USB 2.0 port that was 14
# minutes, and the watcher's first log write, to the temp folder, stopped it
# for all of them.) When the load is over (ready, stopped, or the window
# closed) they go to kit\logs\load-<time>.csv, with any left in the temp
# folder by an older watcher; after ready, rows go there every LOG_FLUSH_MS.
$LOG_HEADER = 'elapsed_s,phase,health,read_mb,progress,mbps,avail_mb,commit_pct,paging_ps,cpu_pct,engine_cpu_pct,engine_ws_mb,engine_priv_mb,pressure,code'
$script:logStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:logTmp = $null
$script:logFinal = $null
$script:logBuf = New-Object System.Text.StringBuilder
$script:logFlushed = [DateTime]::Now
function Get-KitLogDir { if ($LogDir) { return $LogDir }; return (Join-Path $PSScriptRoot 'logs') }
function Get-TempLogDir { return (Join-Path ([IO.Path]::GetTempPath()) 'Lantern-logs') }
function V($x, [string]$fmt) { if ($null -eq $x) { return '' }; return ([double]$x).ToString($fmt, $INV) }
function Write-LogLine($s, $snap, $st) {
  if ($script:Sim) { return }
  $rm = $null; if ($null -ne $s.readBytes) { $rm = [double]$s.readBytes / 1MB }
  $cols = @((V ($s.t / 1000) '0.0'), $st.phase, $s.health, (V $rm '0'), (V $snap.progress '0.000'), (V $snap.mbps '0.0'), (V $s.availMb '0'), (V $s.commitPct '0.0'), (V $snap.mem.pagingPs '0'), (V $s.cpuPct '0'), (V $s.engineCpuPct '0'), (V $s.engineWsMb '0'), (V $s.enginePrivMb '0'), $st.pressure, $snap.code)
  if ($script:logBuf.Length -lt 4MB) { [void]$script:logBuf.Append(($cols -join ',') + "`r`n") }
  if ($script:logFinal -and ([DateTime]::Now - $script:logFlushed).TotalMilliseconds -ge $LOG_FLUSH_MS) { Flush-Log }
}
function Flush-Log {
  $script:logFlushed = [DateTime]::Now
  if ($script:Sim -or $script:logBuf.Length -eq 0) { return }
  try {
    if ($script:logFinal) { [IO.File]::AppendAllText($script:logFinal, $script:logBuf.ToString()) }
    else {
      if (-not $script:logTmp) {
        $td = Get-TempLogDir
        if (-not (Test-Path -LiteralPath $td)) { New-Item -ItemType Directory -Path $td -Force | Out-Null }
        $script:logTmp = Join-Path $td ('load-' + $script:logStamp + '.csv')
        [IO.File]::WriteAllText($script:logTmp, $LOG_HEADER + "`r`n")
      }
      [IO.File]::AppendAllText($script:logTmp, $script:logBuf.ToString())
    }
    [void]$script:logBuf.Clear()
  } catch { }
}
# Move-Log($dir): the load is over; its rows go to $dir (kit\logs) now
function Move-Log($dir) {
  if ($script:Sim -or $script:logFinal -or -not $dir) { return }
  try {
    $final = Join-Path $dir ('load-' + $script:logStamp + '.csv')
    $text = $LOG_HEADER + "`r`n"
    if ($script:logTmp -and (Test-Path -LiteralPath $script:logTmp)) {
      $text = [IO.File]::ReadAllText($script:logTmp)
      if ($script:logTmp -ne $final) { Remove-Item -LiteralPath $script:logTmp -Force -ErrorAction SilentlyContinue }
    }
    [IO.File]::WriteAllText($final, $text + $script:logBuf.ToString())
    [void]$script:logBuf.Clear(); $script:logFinal = $final; $script:logFlushed = [DateTime]::Now
    $td = Get-TempLogDir
    if ((Test-Path -LiteralPath $td) -and ([IO.Path]::GetFullPath($td).TrimEnd('\') -ne [IO.Path]::GetFullPath($dir).TrimEnd('\'))) {
      foreach ($o in @(Get-ChildItem -LiteralPath $td -Filter 'load-*.csv' -File)) { try { Move-Item -LiteralPath $o.FullName -Destination (Join-Path $dir $o.Name) -Force } catch { } }
    }
    $old = @(Get-ChildItem -LiteralPath $dir -Filter 'load-*.csv' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip $KEEP_LOGS)
    foreach ($o in $old) { try { Remove-Item -LiteralPath $o.FullName -Force } catch { } }
  } catch { }
}
function Write-Summary($dir, $st, $drive, $plan) {
  if (-not $dir) { return }
  $s = $st.lastSample; $read = $null
  foreach ($h in $st.history) { if ($null -ne $h.readBytes) { $read = $h.readBytes } }
  $sum = [ordered]@{
    v = 1; when = (Get-Date -Format 's'); os = 'windows'; model = $st.model; bytes = [long]$st.bytes
    loadMs = $(if ($null -ne $st.readyT) { [long]$st.readyT } else { $null }); outcome = $(if ($null -ne $st.readyT) { 'ready' } else { $st.phase })
    firstSampleMs = $(if ($null -ne $st.firstSampleT) { [long]$st.firstSampleT } else { $null })
    readBytes = $(if ($null -ne $read) { [long]$read } else { $null })
    readRatio = $(if ($null -ne $read -and $st.bytes -gt 0) { [Math]::Round($read / $st.bytes, 2) } else { $null })
    avgMbps = $(if ($null -ne $read -and $null -ne $st.firstReadT -and $null -ne $st.readyT -and $st.readyT -gt $st.firstReadT) { [Math]::Round($read / 1MB / (($st.readyT - $st.firstReadT) / 1000), 1) } else { $null })
    totalMb = $(if ($s -and $null -ne $s.totalMb) { [Math]::Round($s.totalMb) } else { $null })
    minAvailMb = $(if ($null -ne $st.minAvail) { [Math]::Round($st.minAvail) } else { $null })
    maxPagingPs = [Math]::Round($st.maxPaging); worstPressure = $st.worstPressure
    enginePeakWsMb = [Math]::Round($st.peakWs); enginePeakPrivMb = [Math]::Round($st.peakPriv)
    drive = $drive.kind; sources = $script:sources; plan = $plan; watcher = $LW_VERSION
  }
  try {
    [IO.File]::WriteAllText((Join-Path $dir 'last-load.json'), ($sum | ConvertTo-Json -Compress -Depth 4))
    $hist = Join-Path $dir 'loads.csv'
    if (-not (Test-Path -LiteralPath $hist)) { [IO.File]::WriteAllText($hist, 'when,model,gb,outcome,load_s,avg_mbps,read_ratio,total_mb,min_avail_mb,worst_pressure,drive,plan' + "`r`n") }
    $pc = ''; if ($plan) { $pc = [string]$plan.choice }
    $row = @($sum.when, $sum.model, (V ($st.bytes / 1e9) '0.0'), $sum.outcome, (V $(if ($null -ne $sum.loadMs) { $sum.loadMs / 1000 } else { $null }) '0'), (V $sum.avgMbps '0.0'), (V $sum.readRatio '0.00'), (V $sum.totalMb '0'), (V $sum.minAvailMb '0'), $sum.worstPressure, $sum.drive, $pc)
    [IO.File]::AppendAllText($hist, ($row -join ',') + "`r`n")
  } catch { }
}
function Read-Plan($dir, [string]$modelName) {
  if (-not $dir) { return $null }
  try {
    $p = Join-Path $dir 'last-plan.json'
    if (-not (Test-Path -LiteralPath $p)) { $p = Join-Path (Get-TempLogDir) 'last-plan.json' }
    if (-not (Test-Path -LiteralPath $p)) { return $null }
    $j = Get-Content -Raw -LiteralPath $p | ConvertFrom-Json
    if (((Now-Ms) - [double]$j.t) -gt 300000) { return $null }
    if ($j.picked -ne $modelName) { return $null }
    return $j
  } catch { return $null }
}

function Parent-Gone {
  if ($script:parentPid -le 0) { return $false }
  try { $null = Get-Process -Id $script:parentPid -ErrorAction Stop; return $false } catch { return $true }
}
function Engine-Gone {
  if (-not $script:proc) { return $false }
  try { $script:proc.Refresh(); return [bool]$script:proc.HasExited } catch { return $true }
}
function Invoke-Watch {
  if (-not $Model) { Say 'Lantern Watch: no -Model given.'; return }
  # nothing in this process may wait on the model's drive while the engine
  # reads it: its working directory (start-lantern's, on the stick) moves to
  # the temp folder, so no relative path or library search can go there (1.1)
  if (-not $script:Sim) { try { $wd = [IO.Path]::GetTempPath(); Set-Location -LiteralPath $wd; [Environment]::CurrentDirectory = $wd } catch { } }
  # The engine starts reading the model at the same moment, so nothing slow
  # and nothing on the model's drive comes before the first reading (see
  # Get-QuickDrive and Move-Log); the parent's id is asked after it.
  $listener = Start-Status $StatusPort   # first, so the page can ask at once
  $script:parentPid = 0; $parentAsked = [bool]$script:Sim
  $plan = $null
  if ($script:Sim) { if ($script:Sim.planResult) { $plan = $script:Sim.planResult } }
  else { $plan = Read-Plan (Get-KitLogDir) ([IO.Path]::GetFileName($Model)) }
  $drive = Get-QuickDrive $Model $plan
  $sysName = $null
  if (-not $script:Sim) { try { $sysName = ([string]$env:SystemDrive).ToUpper() } catch { } }
  $st = New-State $Model $MmProj
  $total = (Get-MemoryNow).TotalMb
  $snaps = New-Object System.Collections.ArrayList
  $snap = $null; $readyAt = $null; $quit = $false
  try {
    while ($true) {
      $s = Read-Sample $drive.name $sysName
      if ($null -eq $s) { break }
      if ($null -eq $s.totalMb) { $s.totalMb = $total }
      $snap = Step $st $s $drive $plan
      if ($script:Sim) { [void]$snaps.Add($snap) }
      Show-Console $st $snap
      if ($st.phase -eq 'ready' -and $null -eq $readyAt) { $readyAt = [DateTime]::Now }
      if ($null -eq $readyAt -or ([DateTime]::Now - $readyAt).TotalMinutes -lt 10) { Write-LogLine $s $snap $st }
      if ($st.phase -eq 'ready' -and -not $st.done) { $st.done = $true; $dir = Get-LogDir; Move-Log $dir; Write-Summary $dir $st $drive $plan }
      if ($st.phase -eq 'stopped' -or $quit) {
        $dir = Get-LogDir; Move-Log $dir; Flush-Log
        if (-not $st.done) { $st.done = $true; Write-Summary $dir $st $drive $plan }
        Serve $listener $snap $st
        break
      }
      $interval = 1000; if ($st.phase -eq 'ready') { $interval = $READY_INTERVAL_MS }
      if ($script:Sim -and $Fast) { continue }
      Serve $listener $snap $st
      if (-not $parentAsked) { $parentAsked = $true; try { $script:parentPid = [int](Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID) -Property ParentProcessId -OperationTimeoutSec $CIM_TIMEOUT_S).ParentProcessId } catch { } }
      $until = [DateTime]::Now.AddMilliseconds($interval); $k = 0
      while ([DateTime]::Now -lt $until) {
        Serve $listener $snap $st; Start-Sleep -Milliseconds 100; $k++
        if ($k % 10 -eq 0) {
          if (Parent-Gone) { $quit = $true; break }   # the black window's cmd has gone: do not keep the window open
          if (Engine-Gone) { break }                 # read again now: the engine stopped
        }
      }
    }
  } finally {
    if (-not $script:Sim) {
      if (-not $script:logFinal) { Move-Log (Get-LogDir) }
      Flush-Log
    }
    if ($listener) { try { $listener.Stop() } catch { } }
    if (-not $script:Sim) { try { $Host.UI.RawUI.WindowTitle = 'Lantern' } catch { } }
  }
  if ($script:Sim) { [Console]::Out.WriteLine((ConvertTo-Json -InputObject @($snaps) -Compress -Depth 6)) }
}

function Invoke-Selftest {
  Say ('Lantern Watch ' + $LW_VERSION + ' self-test (PowerShell ' + $PSVersionTable.PSVersion + ')')
  $mem = Get-MemoryNow
  Say ('  memory: ' + (Gb $mem.AvailMb) + ' free of ' + (Gb $mem.TotalMb))
  if ($Model) {
    $d = Get-DriveInfo $Model
    Say ('  model: ' + $Model + ' (' + (Gb ((File-Bytes $Model) / 1MB)) + ') on ' + $d.name + ' [' + $d.kind + ']')
    $q = Get-QuickDrive $Model $null
    Say ('  while loading (the instant check): ' + $q.name + ' [' + $q.kind + ']')
    $sys = $null; try { $sys = ([string]$env:SystemDrive).ToUpper() } catch { }
    $a = Read-Sample $d.name $sys; Start-Sleep -Milliseconds 1100; $b = Read-Sample $d.name $sys
    Say ('  readings: ' + (($script:sources.GetEnumerator() | ForEach-Object { $_.Key + '=' + $(if ($_.Value) { 'yes' } else { 'no' }) }) -join ' '))
    Say ('  sample: avail ' + (V $b.availMb '0') + ' MB, commit ' + (V $b.commitPct '0.0') + '%, paging ' + (V $b.pagingPs '0') + '/s, cpu ' + (V $b.cpuPct '0') + '%, health ' + $b.health)
  }
  $l = Start-Status $StatusPort
  if ($l) { Say ('  status address 127.0.0.1:' + $StatusPort + ' can be opened'); $l.Stop() }
  Say ('  logs: ' + (Get-LogDir))
}

try {
  switch ($Mode) {
    'plan' { Invoke-Plan }
    'watch' { Invoke-Watch }
    'selftest' { Invoke-Selftest }
  }
} catch {
  Say ('  Lantern Watch stopped (' + $_.Exception.Message + '); Lantern carries on without it.')
  if ($Simulate) { throw }
}
exit 0
