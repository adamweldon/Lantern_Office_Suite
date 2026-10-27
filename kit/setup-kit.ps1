# setup-kit.ps1 -- fetch the AI engine (llama.cpp) and models into this kit (Windows).
# Needs internet once; afterwards the kit works offline and can be copied.
#   setup-kit.bat              Lantern itself when the kit lacks it (from GitHub), then
#                              engine + the 4B model, then offers a bigger model
#                              when this computer can run one, then the offline
#                              encyclopedia -- everything in one go
#   setup-kit.bat phone        the two phone models (0.8B, 2B) -- to copy onto phones
#   setup-kit.bat laptop       Qwen3.5 4B   (8 GB computers)
#   setup-kit.bat big          Qwen3.5 9B   (16 GB computers)
#   setup-kit.bat xl           Qwen3.5 35B-A3B (32 GB computers; 17.5 GB file)
#   setup-kit.bat library      an offline encyclopedia: kiwix-serve + English Wikipedia
#                              (lead sections, ~12 GB; Simple English ~2.5 GB if
#                              the drive is small or FAT32)
#   setup-kit.bat library-simple   Simple English Wikipedia (~2.5 GB)
#   setup-kit.bat library-full     the full English Wikipedia (every article, text
#                              without pictures, ~60 GB): explanation questions in
#                              Chat read whole articles; quick facts keep the
#                              small file. Offered once the small one is there;
#                              never downloaded unasked.
#   setup-kit.bat zim NAME     any Kiwix file by name (e.g. wikipedia_en_medicine_maxi)
#                              or full URL, into library\
#   setup-kit.bat shelves      the practical shelf for the library: WikiMed (medicine),
#                              iFixit repair guides, Wikivoyage, PhET simulations
#   setup-kit.bat shelves-all  those and the Wiktionary dictionary and Wikibooks
#   setup-kit.bat shelf-medicine | shelf-repair | shelf-travel | shelf-science |
#                 shelf-words | shelf-textbooks   one of them
#   setup-kit.bat vision       the vision part of every laptop model in the kit
#                              (mmproj, 0.7-0.9 GB each): the AI can then look at
#                              the drawings it makes. New 4B/9B/35B downloads
#                              bring theirs along.
#   setup-kit.bat check        show what this computer can run and what the kit has
#   setup-kit.bat lantern      the newest Lantern from GitHub into the Lantern folder
#                              (site\ and Lantern_Office_Suite.html), also to update
#                              it; setup fetches it by itself when there is none
#   add "gpu" for the Vulkan engine build (graphics card)
# "Install Lantern (Windows).bat" runs this with LANTERN_POPUP=1: the questions
# come up in message boxes (Yes / No / Cancel) while this window shows the progress.
# start-lantern.bat runs "setup-kit.ps1 offer": when this computer can run a
# bigger model than the kit has, and there is room and internet, it asks
# once and downloads it in a separate window while Lantern starts.
# Overrides: LLAMA_BUILD, LLAMA_BASE, HF_BASE, KIWIX_BASE (mirrors); LANTERN_AUTO_DOWNLOAD=0
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
$KiwixBase = if ($env:KIWIX_BASE) { $env:KIWIX_BASE } else { "https://download.kiwix.org" }
$LanternHome = "https://github.com/adamweldon/Lantern_Office_Suite"
$LanternSrc = if ($env:LANTERN_SRC) { $env:LANTERN_SRC } else { "$LanternHome/archive/refs/heads/main.zip" }
$Models = Join-Path $Dir "models"
New-Item -ItemType Directory -Force -Path $Models | Out-Null
$Library = Join-Path $Dir "library"
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
    & $Curl.Path -L --fail --retry 5 --retry-delay 3 -C - -o $part $url
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
# The model's vision part: mmproj-F16.gguf in its repository, kept as
# mmproj-<model>-F16.gguf (start-lantern loads it with that model). Laptop
# models only; a failed download is reported, not fatal.
function VisionFile($t) { "mmproj-" + (($t.repo -split '/')[1] -replace '-GGUF$', '') + "-F16.gguf" }
function HasVision($t) { $f = Join-Path $Models (VisionFile $t); (Test-Path $f) -and ((Get-Item $f).Length -gt 0) }
function GetVision($t) {
  if ($t.id -notin @("xl", "big", "laptop")) { return }
  try {
    $dest = Join-Path $Models (VisionFile $t)
    Fetch "$HfBase/$($t.repo)/resolve/main/mmproj-F16.gguf" $dest
    $fs = [System.IO.File]::OpenRead($dest); $b = New-Object byte[] 4; [void]$fs.Read($b, 0, 4); $fs.Close()
    if ([System.Text.Encoding]::ASCII.GetString($b) -ne "GGUF") { Write-Host "  $(Split-Path -Leaf $dest) is not a GGUF file; deleted"; Remove-Item $dest }
  } catch { Write-Host "  (vision part of $($t.name) not downloaded: $($_.Exception.Message))" }
}
function GetTier($t) { Model $t.repo $t.file; if (Have $t) { GetVision $t } }
function TempRoot { if ($env:TEMP) { $env:TEMP } else { [System.IO.Path]::GetTempPath() } }
# --- Lantern itself (the site\ folder llama-server serves) ---
# SiteDir -> the Lantern this kit starts: the Lantern folder's site\ (beside
# kit\: what Lantern.zip, extracted over the folder, updates), else kit\site
# (a kit on its own); "" when neither is there. One place first, always: a
# copy in kit\site used to win over the folder's, so an update laid over the
# folder never showed (bench run 10).
function SiteDir {
  foreach ($d in @((Join-Path (Split-Path -Parent $Dir) "site"), (Join-Path $Dir "site"))) {
    if (Test-Path (Join-Path $d "index.html")) { return (Resolve-Path $d).Path }
  }
  return ""
}
function VersionIn($packageJson) {
  if (-not (Test-Path $packageJson)) { return "" }
  $m = [regex]::Match((Get-Content $packageJson -Raw), '"version":\s*"([^"]*)"')
  if ($m.Success) { return $m.Groups[1].Value } else { return "" }
}
# LanternVersion -> the version Lantern's own page says it is (index.html), so a
# newer Lantern laid over an older one never reports the old number.
function LanternVersion($site) {
  $idx = Join-Path $site "index.html"
  if (Test-Path $idx) {
    $m = [regex]::Match([System.IO.File]::ReadAllText($idx), 'version: "([0-9][0-9.]*)"')
    if ($m.Success) { return $m.Groups[1].Value }
  }
  $f = Join-Path $site "lantern-version.txt"
  if (Test-Path $f) { return [string](Get-Content $f -TotalCount 1) }
  return (VersionIn (Join-Path (Split-Path -Parent $site) "package.json"))
}
# LanternFolder -> true when kit\ sits in a Lantern folder (Lantern.zip or the
# repository): Lantern goes there, beside kit\, not into the kit.
function LanternFolder {
  $up = Split-Path -Parent $Dir
  return ((Test-Path (Join-Path $up "Lantern_Office_Suite.html")) -or (Test-Path (Join-Path $up "Start Lantern (Windows).bat")) -or (Test-Path (Join-Path $up "site\index.html")))
}
# GetLantern [fresh] -> Lantern from GitHub when there is none: into the Lantern
# folder (site\ and Lantern_Office_Suite.html), or kit\site for a kit on its own
# (fresh: always, the newest -- also an update). The one in use stays until the
# new one is in place and checked.
function GetLantern([bool]$fresh = $false) {
  $cur = SiteDir
  if ($cur -and -not $fresh) { $v = LanternVersion $cur; Write-Host ("  have Lantern" + $(if ($v) { " $v" } else { "" }) + " ($cur)"); return }
  Write-Host "  Lantern itself (the suite: about 10 MB) from $LanternHome"
  $tmp = Join-Path (TempRoot) ("lantern-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp "lantern.zip"
    try { Fetch $LanternSrc $zip }
    catch { throw "Could not download Lantern ($($_.Exception.Message)). Check the internet connection and run setup again, or download the zip from $LanternHome and run Install Lantern from inside it." }
    Expand-Archive -Path $zip -DestinationPath (Join-Path $tmp "x") -Force
    $top = Get-ChildItem -Directory -Path (Join-Path $tmp "x") | Select-Object -First 1
    $idx = if ($top) { Join-Path $top.FullName "site\index.html" } else { "" }
    if (-not $top -or -not (Test-Path $idx) -or -not (Select-String -Path $idx -Pattern "Lantern" -SimpleMatch -Quiet)) {
      throw "the download has no Lantern in it (site\index.html)"
    }
    $v = LanternVersion (Join-Path $top.FullName "site")
    Set-Content -Path (Join-Path $top.FullName "site\lantern-version.txt") -Value ($(if ($v) { $v } else { "unknown" }) + " (from $LanternHome, " + (Get-Date -Format "yyyy-MM-dd") + ")")
    $lhome = if (LanternFolder) { Split-Path -Parent $Dir } else { $Dir }
    $site = Join-Path $lhome "site"; $next = Join-Path $lhome "site.new"; $old = Join-Path $lhome "site.old"
    foreach ($p in @($next, $old)) { if (Test-Path $p) { Remove-Item -Recurse -Force $p } }
    Copy-Item -Recurse -Force (Join-Path $top.FullName "site") $next
    if (Test-Path $site) { Move-Item $site $old }
    Move-Item $next $site
    if (Test-Path $old) { Remove-Item -Recurse -Force $old }
    $one = Join-Path $top.FullName "Lantern_Office_Suite.html"
    if (($lhome -ne $Dir) -and (Test-Path $one)) { Copy-Item -Force $one (Join-Path $lhome "Lantern_Office_Suite.html") }
    Write-Host ("  Lantern" + $(if ($v) { " $v" } else { "" }) + " is in place ($site)")
  } finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }
}
function Engine($asset) {
  $target = Join-Path $Dir "engine\windows"
  if (Test-Path (Join-Path $target "llama-server.exe")) { Write-Host "  have engine"; return }
  $tmp = Join-Path (TempRoot) ("lantern-" + [guid]::NewGuid())
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

# --- the offline library (Kiwix) -------------------------------------------------
$Libs = @(
  [pscustomobject]@{ id = "library"; name = "English Wikipedia (lead section of every article)"; folder = "wikipedia"; base = "wikipedia_en_all_mini"; gb = 12; pick = $true },
  [pscustomobject]@{ id = "library-simple"; name = "Simple English Wikipedia"; folder = "wikipedia"; base = "wikipedia_en_simple_all_maxi"; gb = 2.5; pick = $true },
  [pscustomobject]@{ id = "library-full"; name = "the full English Wikipedia (every article, text without pictures)"; folder = "wikipedia"; base = "wikipedia_en_all_nopic"; gb = 60; pick = $false }
)
function Listing($url) {
  if ($Curl) { $t = & $Curl.Path -sL --fail --max-time 30 $url; if ($LASTEXITCODE -ne 0) { throw "could not list $url" }; return ($t -join "`n") }
  return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30).Content
}
function VersionKey($name) { (@([regex]::Matches($name, '\d+') | ForEach-Object { $_.Value.PadLeft(8, '0') }) -join '.') }
# Latest dated file for a Kiwix name, e.g. wikipedia_en_all_mini -> wikipedia_en_all_mini_2026-06.zim
function LatestZim($folder, $base) {
  $html = Listing "$KiwixBase/zim/$folder/"
  $names = @([regex]::Matches($html, ('href="(?:[^"]*/)?(' + [regex]::Escape($base) + '_\d{4}-\d{2}\.zim)"')) | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
  if (-not $names.Count) { throw "no $base file listed at $KiwixBase/zim/$folder/" }
  return ($names | Sort-Object | Select-Object -Last 1)
}
function HaveLibrary { @(Get-ChildItem -Path $Library -Filter "*.zim" -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 0 }).Count -gt 0 }
function HaveFull { @(Get-ChildItem -Path $Library -Filter "*.zim" -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 0 -and $_.Name -match '^wikipedia_en_all_(nopic|maxi)_' }).Count -gt 0 }
# RemoteGB(url, fallback) -> the file's size on the server in GB (the full
# Wikipedia grows every release), or the fallback when it cannot be asked.
# LeftGB(name, gb) -> what is still to download (a stopped download resumes).
function LeftGB($name, $gb) {
  $part = Join-Path $Library "$name.part"
  if (Test-Path $part) { return [math]::Max(0.1, [math]::Round($gb - (Get-Item $part).Length / 1GB, 1)) }
  return $gb
}
function RemoteGB($url, $fallback) {
  try {
    if ($Curl) {
      $h = & $Curl.Path -sIL --max-time 20 $url
      $len = @($h | ForEach-Object { if ($_ -match '^content-length:\s*(\d+)') { $Matches[1] } }) | Select-Object -Last 1
      if ($len) { return [math]::Round([double]$len / 1GB, 1) }
    } else {
      $r = [System.Net.HttpWebRequest]::Create($url); $r.Method = "HEAD"; $r.Timeout = 20000; $r.UserAgent = "lantern-kit"
      $resp = $r.GetResponse(); $n = $resp.ContentLength; $resp.Close()
      if ($n -gt 0) { return [math]::Round($n / 1GB, 1) }
    }
  } catch { }
  return $fallback
}
function KiwixTools {
  $target = Join-Path $Dir "engine\windows\kiwix"
  if (Test-Path (Join-Path $target "kiwix-serve.exe")) { Write-Host "  have kiwix-serve"; return }
  $html = Listing "$KiwixBase/release/kiwix-tools/"
  $zips = @([regex]::Matches($html, 'href="(?:[^"]*/)?(kiwix-tools_win-x86_64-[0-9][0-9.\-]*\.zip)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
  if (-not $zips.Count) {   # older releases were 32-bit only
    $zips = @([regex]::Matches($html, 'href="(?:[^"]*/)?(kiwix-tools_win-i686-[0-9][0-9.\-]*\.zip)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
  }
  if (-not $zips.Count) { throw "no Windows kiwix-tools listed at $KiwixBase/release/kiwix-tools/" }
  $asset = $zips | Sort-Object { VersionKey $_ } | Select-Object -Last 1
  $tmp = Join-Path (TempRoot) ("lantern-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $zip = Join-Path $tmp $asset
  Fetch "$KiwixBase/release/kiwix-tools/$asset" $zip
  Expand-Archive -Path $zip -DestinationPath (Join-Path $tmp "x") -Force
  $bin = Get-ChildItem -Recurse -Path (Join-Path $tmp "x") -Filter "kiwix-serve.exe" | Select-Object -First 1
  if (-not $bin) { throw "no kiwix-serve.exe inside $asset" }
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -Recurse -Force (Join-Path $bin.DirectoryName "*") $target
  Remove-Item -Recurse -Force $tmp
  Write-Host "  kiwix-serve ready ($asset)"
}
# Fetch one Kiwix file into library\ and check it against the published SHA-256.
function GetZim($url) {
  New-Item -ItemType Directory -Force -Path $Library | Out-Null
  $file = ($url -split '/')[-1]; $dest = Join-Path $Library $file
  $fresh = -not (Test-Path $dest)
  Fetch $url $dest
  if (-not $fresh) { return }
  $want = ""
  try { $want = ((Listing "$url.sha256") -split '\s+')[0].ToLower() } catch { }
  if ($want -match '^[0-9a-f]{64}$') {
    Write-Host "  checking $file (SHA-256)..."
    $got = (Get-FileHash -Algorithm SHA256 -Path $dest).Hash.ToLower()
    if ($got -ne $want) { Remove-Item -Force $dest; throw "$file is damaged (checksum differs); deleted -- run setup again" }
    Write-Host "  checksum OK"
  } else { Write-Host "  (no published checksum for $file)" }
}
function LibFor($id) { $Libs | Where-Object { $_.id -eq $id } | Select-Object -First 1 }
# The encyclopedia that fits this drive: full English leads, else Simple English.
function PickLib {
  $drive = Drive
  foreach ($l in @($Libs | Where-Object { $_.pick })) { if (-not (NoRoom $l $drive)) { return $l } }
  return $null
}
function GetLibrary($l) {
  KiwixTools
  $name = LatestZim $l.folder $l.base
  Write-Host "  $($l.name): $name"
  GetZim "$KiwixBase/zim/$($l.folder)/$name"
}
function GetZimByName($arg) {
  KiwixTools
  if ($arg -match '^https?://') { GetZim $arg; return }
  $folder = ($arg -split '_')[0]
  GetZim ("$KiwixBase/zim/" + (FindZim $folder ($arg -replace '_\d{4}-\d{2}(\.zim)?$', '')))
}
# --- the shelves: more free Kiwix books for the AI to read (1.14.0) ---------------
# Lantern itself (LIBRARY_ENGINE) reads the one that fits a question.
$Shelves = @(
  [pscustomobject]@{ id = "shelf-medicine"; name = "WikiMed, Wikipedia's medicine articles"; folder = "wikipedia"; base = "wikipedia_en_medicine_nopic"; gb = 1; lic = "CC BY-SA"; practical = $true },
  [pscustomobject]@{ id = "shelf-repair"; name = "iFixit repair guides"; folder = "ifixit"; base = "ifixit_en_all"; gb = 3; lic = "CC BY-NC-SA: free, not for sale"; practical = $true },
  [pscustomobject]@{ id = "shelf-travel"; name = "the Wikivoyage travel guide"; folder = "wikivoyage"; base = "wikivoyage_en_all_nopic"; gb = 0.5; lic = "CC BY-SA"; practical = $true },
  [pscustomobject]@{ id = "shelf-science"; name = "PhET science and maths simulations"; folder = "phet"; base = "phet_en_all"; gb = 0.5; lic = "CC BY"; practical = $true },
  [pscustomobject]@{ id = "shelf-words"; name = "the Wiktionary dictionary"; folder = "wiktionary"; base = "wiktionary_en_all_nopic"; gb = 5; lic = "CC BY-SA"; practical = $false },
  [pscustomobject]@{ id = "shelf-textbooks"; name = "Wikibooks open textbooks"; folder = "wikibooks"; base = "wikibooks_en_all_nopic"; gb = 3; lic = "CC BY-SA"; practical = $false }
)
function HaveShelf($sh) { @(Get-ChildItem -Path $Library -Filter "$($sh.base)_*.zim" -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 0 -and $_.Name -match '_\d{4}-\d{2}\.zim$' }).Count -gt 0 }
# FindZim(folder, base) -> "folder/file" of the newest: its own folder first,
# then "other" and "zimit", where Kiwix files some books
function FindZim($folder, $base) {
  foreach ($f in @($folder, "other", "zimit")) {
    try { return "$f/" + (LatestZim $f $base) } catch { }
  }
  throw "no $base file listed at $KiwixBase/zim/ ($folder, other, zimit)"
}
function GetShelf($sh) {
  if (HaveShelf $sh) { Write-Host "  have $($sh.name)"; return }
  KiwixTools
  $fz = FindZim $sh.folder $sh.base
  Write-Host "  $($sh.name) ($($sh.lic)): $(($fz -split '/')[-1])"
  GetZim "$KiwixBase/zim/$fz"
}
function GetShelves($list) {
  foreach ($sh in $list) {
    try { GetShelf $sh } catch { Write-Host "  ($($sh.id) did not finish: $($_.Exception.Message); setup-kit.bat $($sh.id) carries on where it stopped)" }
  }
}
# In setup, once the kit has a library: the practical shelf, asked once.
function OfferShelves([bool]$inline) {
  if (-not $inline) { return }
  if (Test-Path (Join-Path $Models ".skip-shelves")) { return }
  $miss = @($Shelves | Where-Object { $_.practical -and -not (HaveShelf $_) })
  if (-not $miss.Count) { return }
  try { [void](Listing "$KiwixBase/zim/wikipedia/") } catch { return }   # no internet: say nothing
  $gb = ($miss | Measure-Object -Property gb -Sum).Sum
  Write-Host ""
  $l1 = "Lantern can add a shelf of free offline books for the AI to read: WikiMed (medicine), iFixit repair guides,"
  $l2 = "the Wikivoyage travel guide and PhET science simulations, about $gb GB. The AI reads the one that fits each question, and Lantern checks its quotes."
  Write-Host "  $l1"; Write-Host "  $l2"
  $ans = Ask 30 $false "More offline books" "$l1 $l2"
  if ($ans -eq "") { return }
  if ($ans -eq "no") {
    New-Item -ItemType File -Force -Path (Join-Path $Models ".skip-shelves") | Out-Null
    Write-Host "  Not asking again. To get them later: setup-kit.bat shelves"
    return
  }
  GetShelves $miss
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
# Reach -> "" when the model site has the file, else why not. It does NOT
# follow the redirect: Hugging Face sends large files from signed storage
# links that answer only a real download (GET), so a HEAD check that
# followed the redirect failed there and the kit wrongly thought it was
# offline (1.8.5).
function Reach($t) {
  $url = "$HfBase/$($t.repo)/resolve/main/$($t.file)"
  $code = 0
  try {
    $r = [System.Net.HttpWebRequest]::Create($url)
    $r.Method = "HEAD"; $r.AllowAutoRedirect = $false; $r.Timeout = 15000; $r.UserAgent = "lantern-kit"
    $resp = $r.GetResponse(); $code = [int]$resp.StatusCode; $resp.Close()
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    else { return "no connection to " + ([uri]$HfBase).Host + " (" + $_.Exception.Status + ")" }
  } catch { return "no connection to " + ([uri]$HfBase).Host + " (" + $_.Exception.Message + ")" }
  if ($code -ge 200 -and $code -lt 400) { return "" }
  return ([uri]$HfBase).Host + " answered " + $code + " for " + $t.file
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
# optIn: a very large download -- nothing happens unless Y is pressed (no
# answer = not now, asked again next time).
function Ask($secs, [bool]$optIn = $false, [string]$title = "Lantern", [string]$text = "") {
  if ($env:LANTERN_AUTO_DOWNLOAD -eq "1") { return "yes" }
  $p = PopupAsk $title $text $optIn
  if ($null -ne $p) { Write-Host "  (answered in the popup: $(if ($p) { $p } else { 'not now' }))"; return $p }
  Write-Host -NoNewline ("  Download it now?  Y = yes   N = no, and don't ask again   (" + $(if ($optIn) { "not now" } else { "yes" }) + " in $secs s) ")
  try {
    while ([Console]::KeyAvailable) { [void][Console]::ReadKey($true) }   # ignore keys pressed earlier
    $end = (Get-Date).AddSeconds($secs)
    while ((Get-Date) -lt $end) {
      if ([Console]::KeyAvailable) {
        $k = [Console]::ReadKey($true); Write-Host $k.KeyChar
        if ($k.KeyChar -eq 'n' -or $k.KeyChar -eq 'N') { return "no" }
        if ($optIn -and $k.KeyChar -ne 'y' -and $k.KeyChar -ne 'Y') { return "" }
        return "yes"
      }
      Start-Sleep -Milliseconds 200
    }
  } catch { Write-Host "(no keyboard here, so not now)"; return "" }
  if ($optIn) { Write-Host "not now"; return "" }
  Write-Host "Y"; return "yes"
}
# PopupAsk -> "yes" / "no" / "" (not now) from a message box, or $null when
# none can be shown (then Ask asks in this window).
function PopupAsk([string]$title, [string]$text, [bool]$optIn) {
  if ($env:LANTERN_POPUP -ne "1") { return $null }
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $msg = $text + "`n`nYes:  download it now.`nNo:  no, and don't ask again.`nCancel:  not now (asked again next time)."
    $def = if ($optIn) { [System.Windows.Forms.MessageBoxDefaultButton]::Button3 } else { [System.Windows.Forms.MessageBoxDefaultButton]::Button1 }
    $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }   # so the box comes up in front
    try {
      $r = [System.Windows.Forms.MessageBox]::Show($owner, $msg, $title, [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
        [System.Windows.Forms.MessageBoxIcon]::Question, $def)
    } finally { $owner.Dispose() }
    switch ($r.ToString()) { "Yes" { return "yes" } "No" { return "no" } default { return "" } }
  } catch { return $null }
}
# Plan -> what to offer: @{ t = model or $null; why = reason when nothing;
# notes = bigger models passed over, and why }. Walks the models this
# computer's memory can run, best first.
function Plan {
  $mem = MemMB; $drive = Drive; $notes = @()
  foreach ($t in @($Tiers | Where-Object { $mem -ge $_.mem })) {
    if (Have $t) { return @{ t = $null; notes = $notes; why = "the kit already has $($t.name)" } }
    if (Busy $t) { return @{ t = $null; notes = $notes; why = "$($t.name) is still downloading in another window"; busy = $true } }
    if (Test-Path (Join-Path $Models ".skip-$($t.id)")) {
      $notes += "$($t.name): you answered N before (delete models\.skip-$($t.id) to be asked again)"; continue
    }
    $room = NoRoom $t $drive
    if ($room) { $notes += "$($t.name) would suit this computer, but $room"; continue }
    $net = Reach $t
    if ($net) { return @{ t = $null; notes = $notes; why = "could not check for $($t.name): $net"; offline = $true } }
    return @{ t = $t; notes = $notes; why = "" }
  }
  return @{ t = $null; notes = $notes; why = "nothing more suits this computer" }
}
# Offer the best model the kit lacks; ask; download it (here, or in its own
# window while Lantern runs).
function Offer([bool]$inline) {
  if ($env:LANTERN_AUTO_DOWNLOAD -eq "0") { return }
  $mem = MemMB; $shown = @{}
  while ($true) {
    $p = Plan
    foreach ($n in $p.notes) { if (-not $shown.ContainsKey($n)) { Write-Host "  $n."; $shown[$n] = 1 } }
    if (-not $p.t) {
      if ($p.offline) { Write-Host "  ($($p.why); starting with the model the kit has.)"; return }
      if (-not $p.busy) { OfferLibrary $inline; if (HaveLibrary) { OfferFull $inline; OfferShelves $inline } }
      return
    }
    $t = $p.t
    Write-Host ""
    $l1 = "This computer has " + [math]::Round($mem / 1024) + " GB of memory: it can run " + $t.name + " (" + $t.gb + " GB download),"
    $l2 = "a stronger model than any in this kit. $($t.note)"
    Write-Host "  $l1"; Write-Host "  $l2"
    $ans = Ask 30 $false "A stronger AI model" "$l1 $l2"
    if ($ans -eq "") { return }
    if ($ans -eq "no") {
      New-Item -ItemType File -Force -Path (Join-Path $Models ".skip-$($t.id)") | Out-Null
      Write-Host "  Not asking again. To get it later: setup-kit.bat $($t.id)"
      $shown["$($t.name): you answered N before (delete models\.skip-$($t.id) to be asked again)"] = 1
      continue
    }
    if ($inline) {   # setup: download it here, then look again (the library comes next)
      GetTier $t
      if (-not (Have $t)) { Write-Host "  $($t.name) did not download properly; run setup-kit.bat $($t.id) to try again."; return }
      continue
    }
    $ps = (Get-Process -Id $PID).Path
    Start-Process -FilePath $ps -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"' + $PSCommandPath + '"'), "get", $t.id) | Out-Null
    Write-Host "  Downloading in a separate window. Lantern starts now with the model it has;"
    Write-Host "  start Lantern again when the download is done to use $($t.name)."
    return
  }
}
# Once the kit has the right model: offer the encyclopedia (asked once).
function LibraryPlan {
  if (HaveLibrary) { return @{ l = $null; why = "the kit has a library" } }
  if (Test-Path (Join-Path $Models ".skip-library")) { return @{ l = $null; why = "you answered N before (delete models\.skip-library to be asked again)" } }
  if (Busy ([pscustomobject]@{ id = "library" })) { return @{ l = $null; why = "the library is still downloading in another window" } }
  $l = PickLib
  if (-not $l) { return @{ l = $null; why = "there is no room on this drive for an encyclopedia" } }
  return @{ l = $l; why = "" }
}
function OfferLibrary([bool]$inline) {
  $p = LibraryPlan
  if (-not $p.l) { if ($p.why -match "downloading") { Write-Host "  The $($p.why)." }; return }
  $l = $p.l
  try { [void](Listing "$KiwixBase/zim/$($l.folder)/") } catch { return }   # no internet: say nothing
  Write-Host ""
  $l1 = "Lantern can also keep an offline encyclopedia for the AI to read: $($l.name),"
  $l2 = "about $($l.gb) GB. Fact questions are then answered from it, with quotes Lantern checks."
  Write-Host "  $l1"; Write-Host "  $l2"
  $ans = Ask 30 $false "Offline encyclopedia" "$l1 $l2"
  if ($ans -eq "") { return }
  if ($ans -eq "no") {
    New-Item -ItemType File -Force -Path (Join-Path $Models ".skip-library") | Out-Null
    Write-Host "  Not asking again. To get it later: setup-kit.bat library"
    return
  }
  if ($inline) { GetLibrary $l; return }
  $ps = (Get-Process -Id $PID).Path
  Start-Process -FilePath $ps -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"' + $PSCommandPath + '"'), "get", $l.id) | Out-Null
  Write-Host "  Downloading in a separate window. Start Lantern again when it is done to use the library."
}
# The full Wikipedia: offered (opt-in) once the kit has the small one.
# FullPlan -> @{ l; url; gb; why }
function FullPlan {
  $l = LibFor "library-full"
  if (HaveFull) { return @{ l = $null; why = "the kit has the full Wikipedia" } }
  if (-not (HaveLibrary)) { return @{ l = $null; why = "the small encyclopedia comes first" } }
  if (Test-Path (Join-Path $Models ".skip-library-full")) { return @{ l = $null; why = "you answered N before (delete models\.skip-library-full to be asked again)" } }
  if (Busy $l) { return @{ l = $null; why = "the full Wikipedia is still downloading in another window" } }
  try { $name = LatestZim $l.folder $l.base } catch { return @{ l = $null; why = "could not reach $KiwixBase"; offline = $true } }
  $url = "$KiwixBase/zim/$($l.folder)/$name"
  $gb = RemoteGB $url $l.gb
  $room = NoRoom ([pscustomobject]@{ gb = (LeftGB $name $gb) }) (Drive)
  if ($room) { return @{ l = $null; gb = $gb; why = "the full Wikipedia ($gb GB) would not fit: $room" } }
  return @{ l = $l; url = $url; gb = $gb; why = "" }
}
function GetFull {
  if (HaveFull) { Write-Host "  have the full Wikipedia"; return }
  $l = LibFor "library-full"
  $name = LatestZim $l.folder $l.base; $url = "$KiwixBase/zim/$($l.folder)/$name"
  $gb = RemoteGB $url $l.gb
  $room = NoRoom ([pscustomobject]@{ gb = (LeftGB $name $gb) }) (Drive)
  if ($room) { Write-Host "  The full Wikipedia ($gb GB) would not fit: $room."; return }
  KiwixTools
  Write-Host "  The full English Wikipedia: $name ($gb GB; this takes hours -- an interrupted download resumes where it stopped)"
  GetZim $url
}
function OfferFull([bool]$inline) {
  if ($env:LANTERN_AUTO_DOWNLOAD -eq "1" -or $env:LANTERN_AUTO_DOWNLOAD -eq "0") { return }   # never unasked
  $p = FullPlan
  if (-not $p.l) { return }
  Write-Host ""
  $l1 = "Lantern can also keep the FULL English Wikipedia: every article, text without pictures,"
  $l2 = "about $($p.gb) GB (a long download -- hours). Explanation questions in Chat (`"explain`","
  $l3 = "`"in detail`", `"how does`") are then read from whole articles; quick facts keep the small file."
  Write-Host "  $l1"; Write-Host "  $l2"; Write-Host "  $l3"
  $ans = Ask 30 $true "The full Wikipedia" "$l1 $l2 $l3"
  if ($ans -eq "") { return }
  if ($ans -eq "no") {
    New-Item -ItemType File -Force -Path (Join-Path $Models ".skip-library-full") | Out-Null
    Write-Host "  Not asking again. To get it later: setup-kit.bat library-full"
    return
  }
  if ($inline) { GetFull; return }
  $ps = (Get-Process -Id $PID).Path
  Start-Process -FilePath $ps -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"' + $PSCommandPath + '"'), "get", "library-full") | Out-Null
  Write-Host "  Downloading in a separate window (it resumes if stopped). Start Lantern again when it is done."
}
function Check {
  $mem = MemMB; $drive = Drive
  Write-Host ("Memory: " + [math]::Round($mem / 1024, 1) + " GB")
  if ($drive) { Write-Host ("Drive: " + $drive.Name + " " + $drive.DriveFormat + ", " + [math]::Round($drive.AvailableFreeSpace / 1GB, 1) + " GB free") }
  Write-Host ("Kit folder: " + $Dir)
  $site = SiteDir
  if ($site) { $v = LanternVersion $site; Write-Host ("Lantern: " + $(if ($v) { "$v, " } else { "" }) + $site) }
  else { Write-Host "Lantern: not in the kit (setup-kit.bat lantern downloads it)" }
  foreach ($t in $Tiers) {
    $fits = if ($mem -ge $t.mem) { "runs here" } else { "needs " + [math]::Round($t.mem / 1024) + " GB memory" }
    $has = if (Have $t) { "in kit" + $(if ($t.id -in @("xl", "big", "laptop")) { if (HasVision $t) { ", sees images" } else { ", no vision part (setup-kit.bat vision)" } } else { "" }) } else { "not in kit" }
    Write-Host ("  " + $t.name.PadRight(17) + ("" + $t.gb + " GB").PadRight(9) + $fits.PadRight(22) + $has)
  }
  $p = Plan
  foreach ($n in $p.notes) { Write-Host "  $n." }
  $zims = @(Get-ChildItem -Path $Library -Filter "*.zim" -ErrorAction SilentlyContinue)
  $ks = Test-Path (Join-Path $Dir "engine\windows\kiwix\kiwix-serve.exe")
  if ($zims.Count) { foreach ($z in $zims) { Write-Host ("Library: " + $z.Name + " (" + [math]::Round($z.Length / 1GB, 1) + " GB)" + $(if ($ks) { "" } else { " -- kiwix-serve missing: setup-kit.bat library" })) } }
  else { Write-Host "Library: none (setup-kit.bat library adds an offline encyclopedia)" }
  foreach ($sh in $Shelves) {
    if (HaveShelf $sh) { Write-Host "Shelf: $($sh.name) -- in the kit" } else { Write-Host "Shelf: $($sh.name) -- not in the kit (setup-kit.bat $($sh.id), about $($sh.gb) GB)" }
  }
  if ($env:LANTERN_AUTO_DOWNLOAD -eq "0") { Write-Host "Next start: offers nothing (LANTERN_AUTO_DOWNLOAD=0)." }
  elseif ($p.t) { Write-Host "Next start: will offer $($p.t.name) ($($p.t.gb) GB). Or fetch it now: setup-kit.bat $($p.t.id)" }
  elseif ($p.offline -or $p.busy) { Write-Host "Next start: offers nothing: $($p.why)." }
  else {
    $lp = LibraryPlan
    if ($lp.l) { Write-Host "Next start: will offer the encyclopedia ($($lp.l.name), about $($lp.l.gb) GB). Or fetch it now: setup-kit.bat library" }
    else { Write-Host "Next start: offers nothing: $($p.why); library: $($lp.why)." }
  }
  if (HaveLibrary -and -not (HaveFull)) {
    $fp = FullPlan
    if ($fp.l) { Write-Host "Full Wikipedia: not in the kit; about $($fp.gb) GB and there is room. Get it: setup-kit.bat library-full" }
    else { Write-Host "Full Wikipedia: not in the kit ($($fp.why))." }
  }
}

$gpu = $Sets -contains "gpu"
$Sets = @($Sets | Where-Object { $_ -and $_ -ne "gpu" })
if ($Sets.Count -gt 0 -and $Sets[0] -eq "offer") {
  try { Offer $false } catch { Write-Host "  (model check skipped: $($_.Exception.Message))" }
  exit 0
}
if ($Sets.Count -gt 0 -and $Sets[0] -eq "check") { Check; exit 0 }
if ($Sets.Count -gt 1 -and $Sets[0] -eq "get") {   # one model or library, in its own window (from Offer)
  $t = Tier $Sets[1]
  $lib = LibFor $Sets[1]
  if ($lib) { $t = [pscustomobject]@{ id = $lib.id; name = $lib.name; gb = $lib.gb } }
  $lock = Join-Path $Models ".downloading-$($t.id)"
  try {
    try { $Host.UI.RawUI.WindowTitle = "Lantern: downloading $($t.name)" } catch { }
    Set-Content -Path $lock -Value $PID
    Write-Host "Downloading $($t.name) ($($t.gb) GB) into the kit. Lantern keeps working meanwhile."
    if ($lib -and $lib.id -eq "library-full") { GetFull }
    elseif ($lib) { Set-Content -Path (Join-Path $Models ".downloading-library") -Value $PID; GetLibrary $lib } else { GetTier $t }
    Write-Host ""
    Write-Host "Done. Close Lantern's window and start it again to use $($t.name)."
  } catch { Write-Host "Download stopped: $($_.Exception.Message). Start Lantern again later to resume it." }
  finally { Remove-Item -Force $lock -ErrorAction SilentlyContinue; Remove-Item -Force (Join-Path $Models ".downloading-library") -ErrorAction SilentlyContinue }
  if (-not $env:LANTERN_NO_PAUSE) { Read-Host "Press Enter to close this window" | Out-Null }
  exit 0
}

$asset = if ($gpu) { "llama-$Build-bin-win-vulkan-x64.zip" } else { "llama-$Build-bin-win-cpu-x64.zip" }
Write-Host "Lantern kit setup (llama.cpp $Build)"
if ($Sets.Count -eq 0) {
  GetLantern
  Engine $asset
  if ((MemMB) -ge 7000) { GetTier (Tier "laptop") } else { GetTier (Tier "0.8b"); GetTier (Tier "2b") }
  Offer $true
}
$zimArg = ""
for ($i = 0; $i -lt $Sets.Count; $i++) { if ($Sets[$i] -eq "zim" -and $i + 1 -lt $Sets.Count) { $zimArg = $Sets[$i + 1]; $Sets[$i + 1] = "zim" } }
if ($zimArg) { GetZimByName $zimArg }
foreach ($s in $Sets) {
  switch ($s) {
    "phone" { GetTier (Tier "0.8b"); GetTier (Tier "2b") }
    "lantern" { GetLantern $true }
    "engine" { Engine $asset }
    "library" { $l = PickLib; if ($l) { GetLibrary $l } else { Write-Host "  No room for an encyclopedia on this drive." } }
    "library-simple" { GetLibrary (LibFor "library-simple") }
    "library-full" { GetFull }
    "shelves" { GetShelves @($Shelves | Where-Object { $_.practical }) }
    "shelves-all" { GetShelves $Shelves }
    { $_ -like "shelf-*" } { $sh = $Shelves | Where-Object { $_.id -eq $s } | Select-Object -First 1; if ($sh) { GetShelves @($sh) } else { Write-Host "unknown shelf: $s" } }
    "vision" { foreach ($t in $Tiers) { if (Have $t) { GetVision $t } } }
    "zim" { }
    default {
      $t = Tier $s
      if ($t) { GetTier $t } else { Write-Host "unknown option: $s" }
    }
  }
}
Write-Host "Done. Start Lantern with start-lantern.bat"
