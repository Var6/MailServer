param(
  [string]$Token          = $env:DUCKDNS_TOKEN,
  [string]$Subdomain      = $env:DUCKDNS_SUBDOMAIN,
  [string]$CfApiToken     = $env:CF_API_TOKEN,
  [string]$CfZoneId       = $env:CF_ZONE_ID,
  [string]$CfRecordNames  = $env:CF_RECORD_NAMES
)

$stateFile = Join-Path $PSScriptRoot ".ddns_last_ip"
$logFile   = Join-Path $PSScriptRoot ".ddns.log"

function Log($msg) {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "$ts  $msg"
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

# ── Get current public IP ────────────────────────────────────────────────────
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

Log "IP changed: $lastIp -> $currentIp"

# ── Update DuckDNS ───────────────────────────────────────────────────────────
if ($Token -and $Subdomain) {
  try {
    $amp = [char]38
    $url = "https://www.duckdns.org/update?domains=" + $Subdomain + $amp + "token=" + $Token + $amp + "ip=" + $currentIp
    $result = (Invoke-RestMethod -Uri $url -TimeoutSec 10).Trim()
    if ($result -eq "OK") {
      Log "DuckDNS: $Subdomain.duckdns.org -> $currentIp  OK"
    } else {
      Log "DuckDNS ERROR: $result"
    }
  } catch {
    Log "DuckDNS ERROR: $_"
  }
}

# ── Update Cloudflare A records ──────────────────────────────────────────────
if ($CfApiToken -and $CfZoneId -and $CfRecordNames) {
  $headers = @{
    "Authorization" = "Bearer $CfApiToken"
    "Content-Type"  = "application/json"
  }
  foreach ($recordName in ($CfRecordNames -split ",")) {
    $recordName = $recordName.Trim()
    if (-not $recordName) { continue }
    try {
      # Find the record ID
      $listUrl = "https://api.cloudflare.com/client/v4/zones/$CfZoneId/dns_records?type=A&name=$recordName"
      $list = Invoke-RestMethod -Uri $listUrl -Headers $headers -TimeoutSec 10
      if (-not $list.success -or $list.result.Count -eq 0) {
        Log "Cloudflare: A record '$recordName' not found in zone"
        continue
      }
      $recordId = $list.result[0].id
      $body = @{ type = "A"; name = $recordName; content = $currentIp; proxied = $false } | ConvertTo-Json
      $putUrl = "https://api.cloudflare.com/client/v4/zones/$CfZoneId/dns_records/$recordId"
      $update = Invoke-RestMethod -Uri $putUrl -Method Put -Headers $headers -Body $body -TimeoutSec 10
      if ($update.success) {
        Log "Cloudflare: $recordName -> $currentIp  OK"
      } else {
        Log "Cloudflare ERROR for $recordName`: $($update.errors | ConvertTo-Json -Compress)"
      }
    } catch {
      Log "Cloudflare ERROR for $recordName`: $_"
    }
  }
}

# ── Save new IP ──────────────────────────────────────────────────────────────
Set-Content -Path $stateFile -Value $currentIp
