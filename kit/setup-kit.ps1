# setup-kit.ps1 -- fetch the AI engine (llama.cpp) and models into this kit (Windows).
# Needs internet once; afterwards the kit works offline and can be copied.
#   setup-kit.bat              engine + the 4B model, then offers a bigger model
#                              when this computer can run one
#   setup-kit.bat phone        the two phone models (0.8B, 2B) -- to copy onto phones
#   setup-kit.bat laptop       Qwen3.5 4B   (8 GB computers)
#   setup-kit.bat big          Qwen3.5 9B   (16 GB computers)
#   setup-kit.bat xl           Qwen3.5 35B-A3B (32 GB computers; 17.5 GB file)
#   setup-kit.bat check        show what this computer can run and what the kit has
#   add "gpu" for the Vulkan engine build (graphics card)
# start-lantern.bat runs "setup-kit.ps1 offer": when this computer can run a
# bigger model than the kit has, and there is room and internet, it asks
# once and downloads it in a separate window while Lantern starts.
# Overrides: LLAMA_BUILD, LLAMA_BASE, HF_BASE (mirrors); LANTERN_AUTO_DOWNLOAD=0
# never offer, =1 download without asking (unattended set-ups); for testing:
# LANTERN_MEM_MB, LANTERN_FS, LANTERN_FREE_GB pretend memory, drive format, free space.
param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Sets)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is very slow with the progress bar on
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Build = if ($env:LLAMA_BUILD) { $env:LLAMA_BUILD } else { "b11435" }
$LlamaBase = if ($env:LLAMA_BASE) { $env:LLAMA_BASE } else { "https://github.com/ggml-org/llama.cpp/releases/download/$Build" }
$HfBase = if ($env:HF_BASE) { $env:HF_BASE } else { "https://huggingface.co" }
$Models = Join-Path $Dir "models"
New-Item -ItemType Directory -Force -Path $Models | Out-Null
$Curl = Get-Command curl.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $Curl) { $Curl = Get-Command curl -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 }

# Models, best first. mem = memory (MB) the computer needs to run it well;
# pat = how start-lantern recognises any copy of it in models\.
$Tiers = @(
  [pscustomobject]@{ id = "xl"; pat = "35B-A3B"; name = "Qwen3.5 35B-A3B"; repo = "unsloth/Qwen3.5-35B-A3B-GGUF"; file = "Qwen3.5-35B-A3B-UD-IQ4_XS.gguf"; gb = 17.5; mem = 28000;
    note = "A mixture-of-experts model: 35B parameters of knowledge, but only about 3B work on each word, so it should run near the 4B's speed." },
  [pscustomobject]@{ id = "big"; pat = "9B"; name = "Qwen3.5 9B"; repo = "unsloth/Qwen3.5-9B-GGUF"; file = "Qwen3.5-9B-Q4_K_M.gguf"; gb = 5.7; mem = 15000; note = "" },
  [pscustomobject]@{ id = "laptop"; pat = "4B"; name = "Qwen3.5 4B"; repo = "unsloth/Qwen3.5-4B-GGUF"; file = "Qwen3.5-4B-Q4_K_M.gguf"; gb = 2.7; mem = 7000; note = "" },
  [pscustomobject]@{ id = "2b"; pat = "2B"; name = "Qwen3.5 2B"; repo = "unsloth/Qwen3.5-2B-GGUF"; file = "Qwen3.5-2B-Q4_K_M.gguf"; gb = 1.3; mem = 5000; note = "" },
  [pscustomobject]@{ id = "0.8b"; pat = "0.8B"; name = "Qwen3.5 0.8B"; repo = "unsloth/Qwen3.5-0.8B-GGUF"; file = "Qwen3.5-0.8B-Q4_K_M.gguf"; gb = 0.55; mem = 0; note = "" }
)
function Tier($id) {
  $a = @{ "35b" = "xl"; "9b" = "big"; "4b" = "laptop" }
  if ($a.ContainsKey($id)) { $id = $a[$id] }
  $Tiers | Where-Object { $_.id -eq $id } | Select-Object -First 1
}

function Fetch($url, $dest) {
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 0)) { Write-Host "  have $(Split-Path -Leaf $dest)"; return }
  Write-Host "  downloading $(Split-Path -Leaf $dest) (large files take a while)"
  $part = "$dest.part"
  if ($Curl) {
    # curl shows progress and resumes a download that was interrupted.
    & $Curl.Source -L --fail --retry 5 --retry-delay 3 -C - -o $part $url
    if ($LASTEXITCODE -ne 0) { throw "download failed (curl $LASTEXITCODE): $url" }
  } else {
    Invoke-WebRequest -Uri $url -OutFile $part -UseBasicParsing
  }
  Move-Item -Force $part $dest
}
function Model($repo, $file) {
  $dest = Join-Path $Models $file
  Fetch "$HfBase/$repo/resolve/main/$file" $dest
  $fs = [System.IO.File]::OpenRead($dest); $b = New-Object byte[] 4; [void]$fs.Read($b, 0, 4); $fs.Close()
  if ([System.Text.Encoding]::ASCII.GetString($b) -ne "GGUF") { Write-Host "  $file is not a GGUF file; deleted"; Remove-Item $dest }
}
function GetTier($t) { Model $t.repo $t.file }
function Engine($asset) {
  $target = Join-Path $Dir "engine\windows"
  if (Test-Path (Join-Path $target "llama-server.exe")) { Write-Host "  have engine"; return }
  $tmp = Join-Path $env:TEMP ("lantern-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $zip = Join-Path $tmp $asset
  Fetch "$LlamaBase/$asset" $zip
  Expand-Archive -Path $zip -DestinationPath (Join-Path $tmp "x") -Force
  $bin = Get-ChildItem -Recurse -Path (Join-Path $tmp "x") -Filter "llama-server.exe" | Select-Object -First 1
  if (-not $bin) { throw "no llama-server.exe inside $asset" }
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -Recurse -Force (Join-Path $bin.DirectoryName "*") $target
  Remove-Item -Recurse -Force $tmp
  Write-Host "  engine ready"
}

# --- what this computer can run ---------------------------------------------
function MemMB {
  if ($env:LANTERN_MEM_MB) { return [int]$env:LANTERN_MEM_MB }
  try { return [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB) } catch { return 8000 }
}
function Have($t) {
  @(Get-ChildItem -Path $Models -Filter ("*" + $t.pat + "*.gguf") -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch "mmproj" -and $_.Length -gt 0 }).Count -gt 0
}
function Drive {
  $d = $null
  try { $d = [System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot((Resolve-Path $Models).Path)) } catch { }
  $fmt = if ($env:LANTERN_FS) { $env:LANTERN_FS } elseif ($d) { $d.DriveFormat } else { "" }
  $free = if ($env:LANTERN_FREE_GB) { [int64]([double]$env:LANTERN_FREE_GB * 1GB) } elseif ($d) { $d.AvailableFreeSpace } else { -1 }
  if (-not $d -and -not $env:LANTERN_FS -and -not $env:LANTERN_FREE_GB) { return $null }
  [pscustomobject]@{ Name = $(if ($d) { $d.Name } else { "" }); DriveFormat = $fmt; AvailableFreeSpace = $free }
}
function Online($t) {
  try { Invoke-WebRequest -Uri "$HfBase/$($t.repo)/resolve/main/$($t.file)" -Method Head -TimeoutSec 8 -UseBasicParsing | Out-Null; return $true }
  catch { return $false }
}
function Busy($t) {   # a download of this model already running in another window?
  $lock = Join-Path $Models ".downloading-$($t.id)"
  if (-not (Test-Path $lock)) { return $false }
  $p = 0; [void][int]::TryParse((Get-Content $lock -ErrorAction SilentlyContinue | Select-Object -First 1), [ref]$p)
  if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)) { return $true }
  Remove-Item -Force $lock -ErrorAction SilentlyContinue; return $false
}
# Why this model cannot go on this drive, or "" when it can.
function NoRoom($t, $drive) {
  if (-not $drive) { return "" }
  if ($t.gb -ge 4 -and $drive.DriveFormat -match "^FAT") {
    return "this drive is $($drive.DriveFormat), which cannot hold files over 4 GB (reformat the stick as exFAT to use it)"
  }
  $need = [int64]($t.gb * 1GB) + 1GB
  if ($drive.AvailableFreeSpace -ge 0 -and $drive.AvailableFreeSpace -lt $need) {
    return ("it needs " + [math]::Round($need / 1GB, 1) + " GB free and this drive has " + [math]::Round($drive.AvailableFreeSpace / 1GB, 1) + " GB")
  }
  return ""
}
# Ask -> "yes", "no", or "" when there is no keyboard to ask (then nothing
# is downloaded and nothing is remembered).
function Ask($secs) {
  if ($env:LANTERN_AUTO_DOWNLOAD -eq "1") { return "yes" }
  Write-Host -NoNewline "  Download it now?  Y = yes   N = no, and don't ask again   (yes in $secs s) "
  try {
    while ([Console]::KeyAvailable) { [void][Console]::ReadKey($true) }   # ignore keys pressed earlier
    $end = (Get-Date).AddSeconds($secs)
    while ((Get-Date) -lt $end) {
      if ([Console]::KeyAvailable) {
        $k = [Console]::ReadKey($true); Write-Host $k.KeyChar
        if ($k.KeyChar -eq 'n' -or $k.KeyChar -eq 'N') { return "no" } else { return "yes" }
      }
      Start-Sleep -Milliseconds 200
    }
  } catch { Write-Host "(no keyboard here, so not now)"; return "" }
  Write-Host "Y"; return "yes"
}
# The best model this computer can run that the kit lacks and the drive can
# hold; ask once; download it (here, or in its own window while Lantern runs).
function Offer([bool]$inline) {
  if ($env:LANTERN_AUTO_DOWNLOAD -eq "0") { return }
  $mem = MemMB; $drive = Drive
  foreach ($t in @($Tiers | Where-Object { $mem -ge $_.mem })) {
    if (Have $t) { return }                       # the kit already has the best it can use
    if (Busy $t) { Write-Host "  $($t.name) is still downloading in another window."; return }
    if (Test-Path (Join-Path $Models ".skip-$($t.id)")) { continue }
    $why = NoRoom $t $drive
    if ($why) { Write-Host "  $($t.name) would suit this computer, but $why."; continue }
    if (-not (Online $t)) { return }              # no internet: carry on with what the kit has
    Write-Host ""
    Write-Host ("  This computer has " + [math]::Round($mem / 1024) + " GB of memory: it can run " + $t.name + " (" + $t.gb + " GB download),")
    Write-Host "  a stronger model than any in this kit. $($t.note)"
    $ans = Ask 30
    if ($ans -eq "") { return }
    if ($ans -eq "no") {
      New-Item -ItemType File -Force -Path (Join-Path $Models ".skip-$($t.id)") | Out-Null
      Write-Host "  Not asking again. To get it later: setup-kit.bat $($t.id)"
      continue
    }
    if ($inline) { GetTier $t; return }
    $ps = (Get-Process -Id $PID).Path
    Start-Process -FilePath $ps -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"' + $PSCommandPath + '"'), "get", $t.id) | Out-Null
    Write-Host "  Downloading in a separate window. Lantern starts now with the model it has;"
    Write-Host "  start Lantern again when the download is done to use $($t.name)."
    return
  }
}
function Check {
  $mem = MemMB; $drive = Drive
  Write-Host ("Memory: " + [math]::Round($mem / 1024, 1) + " GB")
  if ($drive) { Write-Host ("Drive: " + $drive.Name + " " + $drive.DriveFormat + ", " + [math]::Round($drive.AvailableFreeSpace / 1GB, 1) + " GB free") }
  foreach ($t in $Tiers) {
    $fits = if ($mem -ge $t.mem) { "runs here" } else { "needs " + [math]::Round($t.mem / 1024) + " GB memory" }
    $has = if (Have $t) { "in kit" } else { "not in kit" }
    Write-Host ("  " + $t.name.PadRight(17) + ("" + $t.gb + " GB").PadRight(9) + $fits.PadRight(22) + $has)
  }
}

$gpu = $Sets -contains "gpu"
$Sets = @($Sets | Where-Object { $_ -and $_ -ne "gpu" })
if ($Sets.Count -gt 0 -and $Sets[0] -eq "offer") {
  try { Offer $false } catch { Write-Host "  (model check skipped: $($_.Exception.Message))" }
  exit 0
}
if ($Sets.Count -gt 0 -and $Sets[0] -eq "check") { Check; exit 0 }
if ($Sets.Count -gt 1 -and $Sets[0] -eq "get") {   # one model, in its own window (from Offer)
  $t = Tier $Sets[1]
  $lock = Join-Path $Models ".downloading-$($t.id)"
  try {
    try { $Host.UI.RawUI.WindowTitle = "Lantern: downloading $($t.name)" } catch { }
    Set-Content -Path $lock -Value $PID
    Write-Host "Downloading $($t.name) ($($t.gb) GB) into the kit. Lantern keeps working meanwhile."
    GetTier $t
    Write-Host ""
    Write-Host "Done. Close Lantern's window and start it again to use $($t.name)."
  } catch { Write-Host "Download stopped: $($_.Exception.Message). Start Lantern again later to resume it." }
  finally { Remove-Item -Force $lock -ErrorAction SilentlyContinue }
  if (-not $env:LANTERN_NO_PAUSE) { Read-Host "Press Enter to close this window" | Out-Null }
  exit 0
}

$asset = if ($gpu) { "llama-$Build-bin-win-vulkan-x64.zip" } else { "llama-$Build-bin-win-cpu-x64.zip" }
Write-Host "Lantern kit setup (llama.cpp $Build)"
if ($Sets.Count -eq 0) {
  Engine $asset
  if ((MemMB) -ge 7000) { GetTier (Tier "laptop") } else { GetTier (Tier "0.8b"); GetTier (Tier "2b") }
  Offer $true
}
foreach ($s in $Sets) {
  switch ($s) {
    "phone" { GetTier (Tier "0.8b"); GetTier (Tier "2b") }
    "engine" { Engine $asset }
    default {
      $t = Tier $s
      if ($t) { GetTier $t } else { Write-Host "unknown option: $s" }
    }
  }
}
Write-Host "Done. Start Lantern with start-lantern.bat"
