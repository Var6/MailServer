# ============================================================
#  DuckDNS Auto-Update Script
#  Runs every 5 minutes via Windows Task Scheduler.
#  Updates your DuckDNS subdomain whenever your public IP changes.
# ============================================================

param(
  [string]$Token    = $env:DUCKDNS_TOKEN,
  [string]$Subdomain = $env:DUCKDNS_SUBDOMAIN
)

$stateFile = "$PSScriptRoot\.ddns_last_ip"
$logFile   = "$PSScriptRoot\.ddns.log"

function Log($msg) {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  "$ts  $msg" | Tee-Object -FilePath $logFile -Append | Write-Host
}

if (-not $Token -or -not $Subdomain) {
  Log "ERROR: DUCKDNS_TOKEN and DUCKDNS_SUBDOMAIN must be set in .env or passed as parameters."
  exit 1
}

# Get current public IP
try {
  $currentIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 10).Trim()
} catch {
  Log "ERROR: Could not get public IP — no internet? $_"
  exit 1
}

# Read last known IP
$lastIp = if (Test-Path $stateFile) { Get-Content $stateFile -Raw | ForEach-Object { $_.Trim() } } else { "" }

if ($currentIp -eq $lastIp) {
  # IP unchanged — silent exit
  exit 0
}

# IP changed — update DuckDNS
Log "IP changed: $lastIp -> $currentIp — updating DuckDNS ($Subdomain.duckdns.org)..."
try {
  $url    = "https://www.duckdns.org/update?domains=$Subdomain&token=$Token&ip=$currentIp"
  $result = (Invoke-RestMethod -Uri $url -TimeoutSec 10).Trim()

  if ($result -eq "OK") {
    Set-Content -Path $stateFile -Value $currentIp
    Log "SUCCESS: $Subdomain.duckdns.org now points to $currentIp"
  } else {
    Log "ERROR: DuckDNS returned: $result"
    exit 1
  }
} catch {
  Log "ERROR: DuckDNS update failed — $_"
  exit 1
}
