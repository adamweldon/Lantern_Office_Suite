# check_computer.ps1 -- can this computer train a Lantern model? Run by "Check this computer (Windows).bat".
# It only reads: the graphics card (nvidia-smi, which comes with NVIDIA's driver), memory, free space and Python.
# It writes what it found to computer_check.txt beside it, and changes nothing else.
# The sizes below are a rough guide worked out from the models' sizes; no Lantern training has run on a card yet.
param([switch]$DefineOnly)
$ErrorActionPreference = 'SilentlyContinue'

# graphics memory (MB) each model needs to train, and free disk (GB) for the programs, the model and its trained copies
$NEED = @(
  @{ Size = '0.8b'; Name = 'the 0.8B'; MB = 8000;  GB = 15 },
  @{ Size = '2b';   Name = 'the 2B';   MB = 12000; GB = 20 },
  @{ Size = '4b';   Name = 'the 4B';   MB = 15500; GB = 35 },
  @{ Size = '9b';   Name = 'the 9B (held in 4-bit)'; MB = 15500; GB = 60 }
)

function Get-Facts {
  $f = @{ Gpus = @(); Others = @(); Cuda = 0.0; Pythons = @(); FreeGB = -1; RamGB = -1; Cpu = ''; Os = ''; Drive = '' }
  $cs = Get-CimInstance Win32_ComputerSystem
  $os = Get-CimInstance Win32_OperatingSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  if ($cs) { $f.RamGB = [int][math]::Round($cs.TotalPhysicalMemory / 1GB) }
  if ($os) { $f.Os = [string]$os.Caption }
  if ($cpu) { $f.Cpu = ([string]$cpu.Name).Trim() }
  $here = Split-Path -Parent $PSCommandPath
  $f.Drive = Split-Path -Qualifier $here
  $disk = Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='" + $f.Drive + "'")
  if ($disk) { $f.FreeGB = [int][math]::Round($disk.FreeSpace / 1GB) }
  foreach ($v in (Get-CimInstance Win32_VideoController)) { $f.Others += [string]$v.Name }
  $smi = $null
  $c = Get-Command nvidia-smi -ErrorAction SilentlyContinue
  if ($c) { $smi = $c.Source } elseif (Test-Path "$env:SystemRoot\System32\nvidia-smi.exe") { $smi = "$env:SystemRoot\System32\nvidia-smi.exe" }
  if ($smi) {
    $lines = & $smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $lines) { $lines = & $smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits 2>$null }
    foreach ($l in @($lines)) {
      $p = ([string]$l) -split ',\s*'
      if ($p.Count -ge 3) {
        $cap = 0.0
        if ($p.Count -ge 4) { [double]::TryParse($p[3], [ref]$cap) | Out-Null }
        $f.Gpus += @{ Name = $p[0].Trim(); MB = [int]$p[1]; Driver = $p[2].Trim(); Cap = $cap }
      }
    }
    $m = (& $smi 2>$null | Out-String) -match 'CUDA Version:\s*([\d.]+)'
    if ($m) { $f.Cuda = [double]$Matches[1] }
  }
  # Python: the py launcher lists every Python it knows; else whatever "python" is (not the Store's stand-in)
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    foreach ($l in @(& py -0p 2>$null)) { if ([string]$l -match '(\d+\.\d+)') { $f.Pythons += $Matches[1] } }
  }
  if (-not $f.Pythons) {
    $v = (& python --version 2>&1 | Out-String)
    if ($v -match 'Python (\d+\.\d+)') { $f.Pythons += $Matches[1] }
  }
  return $f
}

function Get-Verdict($f) {
  $say = New-Object System.Collections.Generic.List[string]
  $can = @()
  $best = $null
  foreach ($g in $f.Gpus) { if (-not $best -or $g.MB -gt $best.MB) { $best = $g } }
  if (-not $best) {
    $say.Add('NO: this computer has no NVIDIA graphics card that its driver reports (nvidia-smi).')
    $say.Add('    The training kit needs one, and stops at its first step without one.')
    $say.Add('    This computer can still run Lantern, and a model trained elsewhere: copy the trained .gguf into')
    $say.Add('    kit\models\tuned\ and double-click "Start trained model.bat".')
  } else {
    foreach ($n in $NEED) { if ($best.MB -ge $n.MB) { $can += $n } }
    $gb = [math]::Round($best.MB / 1024, 1)
    if (-not $can) {
      $say.Add(('NO: its NVIDIA card ({0}) has {1} GB; the smallest model, the 0.8B, wants about 8 GB to train.' -f $best.Name, $gb))
      $say.Add('    It might train the 0.8B on shorter examples (--max-len 2048); that has not been tried.')
    } else {
      $say.Add(('YES: its NVIDIA card ({0}, {1} GB) is enough for {2}.' -f $best.Name, $gb, (($can | ForEach-Object { $_.Name }) -join ', ')))
      if ($best.Cap -gt 0 -and $best.Cap -lt 8.0) {
        $say.Add('    But the card is older than the RTX 30 series: training would run in float16, not bfloat16, which')
        $say.Add('    has not been tried. Expect it to be slower, and tell Claude what the window says.')
      }
      if ($f.Cuda -gt 0 -and $f.Cuda -lt 12) {
        $say.Add(('    Update the NVIDIA driver first (nvidia.com/drivers): it supports CUDA {0}, and the kit needs 12 or newer.' -f $f.Cuda))
      }
    }
  }
  $okpy = @($f.Pythons | Where-Object { [version]$_ -ge [version]'3.10' -and [version]$_ -le [version]'3.13' })
  if ($okpy.Count -gt 0) { $say.Add(('Python: found {0} (the kit uses 3.10 to 3.13).' -f ($okpy -join ', '))) }
  elseif ($f.Pythons.Count -gt 0) { $say.Add(('Python: only {0}. Install Python 3.12 from python.org (tick "Add to PATH"); the kit uses 3.10 to 3.13.' -f ($f.Pythons -join ', '))) }
  else { $say.Add('Python: none found. Install Python 3.12 from python.org (tick "Add to PATH") before the kit.') }
  if ($f.FreeGB -ge 0) {
    $fits = @($NEED | Where-Object { $f.FreeGB -ge $_.GB } | ForEach-Object { $_.Name })
    $say.Add(('Free space: {0} GB on {1}. Rough need: 15 GB for the 0.8B, 20 for the 2B, 35 for the 4B, 60 for the 9B.' -f $f.FreeGB, $f.Drive))
    if (-not $fits) { $say.Add('    Not enough for any of them here: free some space, or put the Lantern folder on a bigger drive.') }
  }
  if ($f.RamGB -ge 0 -and $f.RamGB -lt 16) { $say.Add(('Memory: {0} GB. Joining the trained part to the model wants about 16 GB for the 4B, 32 for the 9B.' -f $f.RamGB)) }
  return $say
}

function Main {
  $here = Split-Path -Parent $PSCommandPath
  $f = Get-Facts
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add(('LANTERN TRAINING KIT -- what this computer has ({0})' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')))
  $lines.Add('')
  $lines.Add(('Computer:   {0}   {1}' -f $env:COMPUTERNAME, $f.Os))
  $lines.Add(('Processor:  {0}' -f $f.Cpu))
  $lines.Add(('Memory:     {0} GB' -f $f.RamGB))
  $lines.Add(('Free space: {0} GB on {1}' -f $f.FreeGB, $f.Drive))
  $lines.Add(('Graphics:   {0}' -f ($f.Others -join '; ')))
  foreach ($g in $f.Gpus) { $lines.Add(('NVIDIA:     {0}, {1} MB, driver {2}, CUDA {3}{4}' -f $g.Name, $g.MB, $g.Driver, $f.Cuda, $(if ($g.Cap -gt 0) { ', compute ' + $g.Cap } else { '' }))) }
  $lines.Add(('Python:     {0}' -f $(if ($f.Pythons) { $f.Pythons -join ', ' } else { 'none found' })))
  $lines.Add('')
  foreach ($s in (Get-Verdict $f)) { $lines.Add($s) }
  $lines.Add('')
  $lines.Add('(A rough guide from the models'' sizes: no Lantern training has run on a graphics card yet.)')
  $lines | ForEach-Object { Write-Host $_ }
  $lines | Set-Content -Path (Join-Path $here 'computer_check.txt') -Encoding ASCII
}

if (-not $DefineOnly) { Main }
