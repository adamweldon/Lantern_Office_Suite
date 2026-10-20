# setup-kit.ps1 -- fetch the AI engine (llama.cpp) and models into this kit (Windows).
# Needs internet once; afterwards the kit works offline and can be copied.
#   setup-kit.bat              engine for this computer + the model that fits it
#   setup-kit.bat phone        the two phone models (0.8B, 2B) -- to copy onto phones
#   setup-kit.bat laptop big   4B (8 GB laptops) and 9B (16 GB laptops)
#   add "gpu" for the Vulkan engine build (graphics card)
param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Sets)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is very slow with the progress bar on
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Build = if ($env:LLAMA_BUILD) { $env:LLAMA_BUILD } else { "b11435" }
$LlamaBase = if ($env:LLAMA_BASE) { $env:LLAMA_BASE } else { "https://github.com/ggml-org/llama.cpp/releases/download/$Build" }
$HfBase = if ($env:HF_BASE) { $env:HF_BASE } else { "https://huggingface.co" }
$Models = Join-Path $Dir "models"
New-Item -ItemType Directory -Force -Path $Models | Out-Null

function Fetch($url, $dest) {
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 0)) { Write-Host "  have $(Split-Path -Leaf $dest)"; return }
  Write-Host "  downloading $(Split-Path -Leaf $dest) (large files take a while)"
  Invoke-WebRequest -Uri $url -OutFile "$dest.part" -UseBasicParsing
  Move-Item -Force "$dest.part" $dest
}
function Model($repo, $file) {
  $dest = Join-Path $Models $file
  Fetch "$HfBase/$repo/resolve/main/$file" $dest
  $fs = [System.IO.File]::OpenRead($dest); $b = New-Object byte[] 4; [void]$fs.Read($b, 0, 4); $fs.Close()
  if ([System.Text.Encoding]::ASCII.GetString($b) -ne "GGUF") { Write-Host "  $file is not a GGUF file; deleted"; Remove-Item $dest }
}
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
function Phone { Model "unsloth/Qwen3.5-0.8B-GGUF" "Qwen3.5-0.8B-Q4_K_M.gguf"; Model "unsloth/Qwen3.5-2B-GGUF" "Qwen3.5-2B-Q4_K_M.gguf" }
function Laptop { Model "unsloth/Qwen3.5-4B-GGUF" "Qwen3.5-4B-Q4_K_M.gguf" }
function Big { Model "unsloth/Qwen3.5-9B-GGUF" "Qwen3.5-9B-Q4_K_M.gguf" }

$gpu = $Sets -contains "gpu"
$Sets = @($Sets | Where-Object { $_ -and $_ -ne "gpu" })
$asset = if ($gpu) { "llama-$Build-bin-win-vulkan-x64.zip" } else { "llama-$Build-bin-win-cpu-x64.zip" }
Write-Host "Lantern kit setup (llama.cpp $Build)"
if ($Sets.Count -eq 0) {
  Engine $asset
  $mem = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB)
  if ($mem -ge 7000) { Laptop } else { Phone }
}
foreach ($s in $Sets) {
  switch ($s) {
    "phone" { Phone }
    "laptop" { Laptop }
    "big" { Big }
    "engine" { Engine $asset }
    default { Write-Host "unknown option: $s" }
  }
}
Write-Host "Done. Start Lantern with start-lantern.bat"
