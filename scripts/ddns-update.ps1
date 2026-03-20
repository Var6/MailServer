param(
  [string]$Token     = $env:DUCKDNS_TOKEN,
  [string]$Subdomain = $env:DUCKDNS_SUBDOMAIN
)

$stateFile = Join-Path $PSScriptRoot ".ddns_last_ip"
$logFile   = Join-Path $PSScriptRoot ".ddns.log"

function Log($msg) {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "$ts  $msg"
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

if (-not $Token -or -not $Subdomain) {
  Log "ERROR: DUCKDNS_TOKEN and DUCKDNS_SUBDOMAIN must be set"
  exit 1
}

try {
  $currentIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 10).Trim()
} catch {
  Log "ERROR: Could not get public IP: $_"
  exit 1
}

$lastIp = ""
if (Test-Path $stateFile) {
  $lastIp = (Get-Content $stateFile -Raw).Trim()
}

if ($currentIp -eq $lastIp) {
  exit 0
}

Log "IP changed: $lastIp -> $currentIp -- updating DuckDNS..."

try {
  $amp = [char]38
  $url = "https://www.duckdns.org/update?domains=" + $Subdomain + $amp + "token=" + $Token + $amp + "ip=" + $currentIp
  $result = (Invoke-RestMethod -Uri $url -TimeoutSec 10).Trim()
  if ($result -eq "OK") {
    Set-Content -Path $stateFile -Value $currentIp
    Log "SUCCESS: $Subdomain.duckdns.org now points to $currentIp"
  } else {
    Log "ERROR: DuckDNS returned: $result"
    exit 1
  }
} catch {
  Log "ERROR: DuckDNS update failed: $_"
  exit 1
}
