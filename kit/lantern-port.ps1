# lantern-port.ps1 -- is Lantern's address free for Start Lantern? (1.24.30)
# Adam's laptop, 2026-11-20: the desktop Lantern (the one-link starter) was
# still running at 127.0.0.1:8080, waiting on an engine download that never
# moved, when Start Lantern was started from the USB stick. On Windows both
# took the address, and the page showed the desktop one's downloads ("Getting
# the AI engine (llama.cpp): 0%") beside the stick's working AI.
# start-lantern.bat runs this first and gets one line back:
#   FREE       the address is free
#   STOPPED    the desktop Lantern had it; it was asked to stop, and did
#              (its downloads carry on when it is next opened)
#   PORT=<n>   another program has it: use <n>
#   NONE       another program has it, and every spare address too
param([int]$Port = 8080)
$ErrorActionPreference = "SilentlyContinue"
function Busy([int]$p) {
  $c = New-Object Net.Sockets.TcpClient
  try {
    $a = $c.BeginConnect("127.0.0.1", $p, $null, $null)
    $ok = $a.AsyncWaitHandle.WaitOne(400)
    if ($ok) { try { $c.EndConnect($a) } catch { $ok = $false } }
    return $ok
  } finally { $c.Close() }
}
# never through a proxy (a work computer's): the address is this computer's own
function Http([string]$method, [string]$url) {
  $q = [Net.HttpWebRequest]::Create($url); $q.Method = $method; $q.Timeout = 3000; $q.Proxy = $null
  if ($method -eq "POST") { $q.ContentType = "application/json"; $b = [Text.Encoding]::UTF8.GetBytes("{}"); $q.ContentLength = $b.Length; $w = $q.GetRequestStream(); $w.Write($b, 0, $b.Length); $w.Close() }
  $r = $q.GetResponse()
  try { return (New-Object IO.StreamReader($r.GetResponseStream())).ReadToEnd() } finally { $r.Close() }
}
if (-not (Busy $Port)) { "FREE"; exit 0 }
$st = $null
try { $st = (Http "GET" "http://127.0.0.1:$Port/lantern-setup/status") | ConvertFrom-Json } catch { }
if ($st -and $st.starter) {
  # the desktop Lantern: asked to stop, as its own Stop Lantern button does (a second Lantern at the address can take
  # the request instead on Windows, so it is asked up to three times)
  for ($k = 0; $k -lt 3 -and (Busy $Port); $k++) {
    try { Http "POST" "http://127.0.0.1:$Port/lantern-setup/stop" | Out-Null } catch { }
    for ($i = 0; $i -lt 40 -and (Busy $Port); $i++) { Start-Sleep -Milliseconds 250 }
  }
  if (-not (Busy $Port)) { "STOPPED"; exit 0 }
}
# the desktop Lantern's own spare addresses (not 8081, the library's; 8082, Lantern Watch's; 8090, the engine's behind it)
foreach ($q in 8083, 8084, 8085, 8086, 8087, 8088, 8089, 8091, 8092, 8093) { if (-not (Busy $q)) { "PORT=$q"; exit 0 } }
"NONE"
