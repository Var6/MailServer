#Requires -RunAsAdministrator
<#
.SYNOPSIS
    MailServer — Cloudflare Tunnel setup script.

.DESCRIPTION
    Guides you through creating a Cloudflare Tunnel so your mail server
    is publicly accessible without opening firewall ports or having a
    static IP address.

    Steps performed:
      1. Install cloudflared via winget (if not already installed)
      2. Authenticate with your Cloudflare account
      3. Create a tunnel named "mailserver"
      4. Write the tunnel token to .env
      5. Add DNS CNAME records via cloudflared
      6. Optionally update config/cloudflared/config.yml with your tunnel ID
      7. Restart the cloudflared Docker service

.NOTES
    Requires a Cloudflare account (free tier is fine) with your domain
    added to Cloudflare and nameservers pointed at Cloudflare.

    Run from the repository root after setup-windows.ps1 has succeeded.
#>

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "    [ERR]  $msg" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
Clear-Host
Write-Host ""
Write-Host "  MailServer — Cloudflare Tunnel Setup" -ForegroundColor Cyan
Write-Host "  Public access without port forwarding or a static IP" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Prerequisites:" -ForegroundColor Yellow
Write-Host "    1. Your domain is added to Cloudflare (not just registered there)." -ForegroundColor Yellow
Write-Host "    2. Cloudflare nameservers are active for your domain." -ForegroundColor Yellow
Write-Host "    3. setup-windows.ps1 has already been run successfully." -ForegroundColor Yellow
Write-Host ""
$ready = Read-Host "Are the prerequisites met? (yes/no)"
if ($ready -notin @("yes", "y")) {
    Write-Host "Please complete the prerequisites first."
    Write-Host "Cloudflare setup guide: https://developers.cloudflare.com/fundamentals/setup/"
    exit 0
}

# ---------------------------------------------------------------------------
# Step 1 — Install cloudflared
# ---------------------------------------------------------------------------
Write-Step "Checking / installing cloudflared..."

$cfInstalled = Get-Command cloudflared -ErrorAction SilentlyContinue

if ($cfInstalled) {
    $cfVersion = cloudflared --version 2>&1
    Write-OK "cloudflared already installed: $cfVersion"
} else {
    Write-Host "    Installing cloudflared via winget..."
    winget install --id Cloudflare.cloudflared --exact --accept-package-agreements --accept-source-agreements

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "winget install failed.  Trying direct download..."
        $cfUrl  = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi"
        $cfMsi  = Join-Path $env:TEMP "cloudflared.msi"
        Invoke-WebRequest -Uri $cfUrl -OutFile $cfMsi -UseBasicParsing
        Start-Process msiexec -ArgumentList "/i `"$cfMsi`" /quiet /norestart" -Wait
        Remove-Item $cfMsi -ErrorAction SilentlyContinue
    }

    # Refresh PATH so we can call cloudflared immediately
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")

    $cfInstalled = Get-Command cloudflared -ErrorAction SilentlyContinue
    if (-not $cfInstalled) {
        Write-Fail "cloudflared installation failed.  Install manually from https://developers.cloudflare.com/cloudflared/install/"
    }
    Write-OK "cloudflared installed."
}

# ---------------------------------------------------------------------------
# Step 2 — Authenticate with Cloudflare
# ---------------------------------------------------------------------------
Write-Step "Authenticating with Cloudflare..."
Write-Host "    A browser window will open.  Log in and authorise cloudflared."
Write-Host "    Select the zone (domain) you want to use for your mail server."
Write-Host ""

cloudflared tunnel login

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Cloudflare authentication failed."
}
Write-OK "Authentication successful.  Credentials stored in ~\.cloudflared\"

# ---------------------------------------------------------------------------
# Step 3 — Create (or reuse) a tunnel named "mailserver"
# ---------------------------------------------------------------------------
Write-Step "Creating Cloudflare Tunnel..."

$existingTunnels = cloudflared tunnel list --output json 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
$existingTunnel  = $existingTunnels | Where-Object { $_.name -eq "mailserver" } | Select-Object -First 1

if ($existingTunnel) {
    $tunnelId   = $existingTunnel.id
    $tunnelName = $existingTunnel.name
    Write-OK "Tunnel '$tunnelName' already exists (ID: $tunnelId) — reusing it."
} else {
    $createOutput = cloudflared tunnel create mailserver 2>&1
    Write-Host $createOutput

    # Extract the tunnel ID from the output line:
    # "Created tunnel mailserver with id <UUID>"
    $idMatch = [regex]::Match($createOutput -join " ", 'with id ([0-9a-f-]{36})')
    if (-not $idMatch.Success) {
        Write-Fail "Could not parse tunnel ID from cloudflared output.  Check the output above."
    }
    $tunnelId   = $idMatch.Groups[1].Value
    $tunnelName = "mailserver"
    Write-OK "Tunnel created: $tunnelName (ID: $tunnelId)"
}

# Copy credentials JSON into repo config dir (Option B support)
$cfCredDir   = Join-Path $env:USERPROFILE ".cloudflared"
$cfCredsFile = Join-Path $cfCredDir "$tunnelId.json"
$repoCredsFile = Join-Path $RepoRoot "config\cloudflared\creds.json"

if (Test-Path $cfCredsFile) {
    Copy-Item $cfCredsFile $repoCredsFile -Force
    Write-OK "Credentials copied to config\cloudflared\creds.json"
    Write-Warn "Do NOT commit config\cloudflared\creds.json to version control."
}

# ---------------------------------------------------------------------------
# Step 4 — Get tunnel token and write to .env
# ---------------------------------------------------------------------------
Write-Step "Retrieving tunnel token..."

$tunnelToken = cloudflared tunnel token $tunnelName 2>&1 | Select-Object -Last 1

if ([string]::IsNullOrWhiteSpace($tunnelToken) -or $tunnelToken -match "Error") {
    Write-Warn "Could not retrieve tunnel token automatically."
    Write-Host "    Run manually: cloudflared tunnel token mailserver"
    $tunnelToken = Read-Host "Paste your tunnel token here"
}

# Write token to .env
$envFile = Join-Path $RepoRoot ".env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw

    if ($envContent -match "CLOUDFLARE_TUNNEL_TOKEN=") {
        # Replace existing line
        $envContent = $envContent -replace "(?m)^CLOUDFLARE_TUNNEL_TOKEN=.*$", "CLOUDFLARE_TUNNEL_TOKEN=$tunnelToken"
    } else {
        $envContent += "`nCLOUDFLARE_TUNNEL_TOKEN=$tunnelToken`n"
    }
    Set-Content $envFile $envContent -NoNewline
    Write-OK "CLOUDFLARE_TUNNEL_TOKEN written to .env"
} else {
    Write-Warn ".env not found — write token manually: CLOUDFLARE_TUNNEL_TOKEN=$tunnelToken"
}

# ---------------------------------------------------------------------------
# Step 5 — Update config/cloudflared/config.yml with tunnel ID
# ---------------------------------------------------------------------------
Write-Step "Updating config/cloudflared/config.yml..."

$configFile = Join-Path $RepoRoot "config\cloudflared\config.yml"
if (Test-Path $configFile) {
    $configContent = Get-Content $configFile -Raw
    $configContent = $configContent -replace "<TUNNEL_ID>", $tunnelId
    Set-Content $configFile $configContent -NoNewline
    Write-OK "config.yml updated with tunnel ID $tunnelId"
}

# ---------------------------------------------------------------------------
# Step 6 — Load .env to get domain names
# ---------------------------------------------------------------------------
$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match '^\s*[^#]\S+=.*' } | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) { $envVars[$parts[0].Trim()] = $parts[1].Trim() }
}
$mailDomain   = if ($envVars["MAIL_DOMAIN"])   { $envVars["MAIL_DOMAIN"] }   else { "yourdomain.com" }
$mailHostname = if ($envVars["MAIL_HOSTNAME"]) { $envVars["MAIL_HOSTNAME"] } else { "mail.$mailDomain" }

# ---------------------------------------------------------------------------
# Step 7 — Create DNS records
# ---------------------------------------------------------------------------
Write-Step "Creating DNS CNAME records in Cloudflare..."
Write-Host "    This will create:"
Write-Host "      $mailHostname  →  $tunnelId.cfargotunnel.com"
Write-Host "      cloud.$mailDomain  →  $tunnelId.cfargotunnel.com"
Write-Host ""

cloudflared tunnel route dns $tunnelName $mailHostname
if ($LASTEXITCODE -eq 0) { Write-OK "DNS record created for $mailHostname" }
else { Write-Warn "DNS record for $mailHostname may already exist or failed — check Cloudflare dashboard." }

cloudflared tunnel route dns $tunnelName "cloud.$mailDomain"
if ($LASTEXITCODE -eq 0) { Write-OK "DNS record created for cloud.$mailDomain" }
else { Write-Warn "DNS record for cloud.$mailDomain may already exist or failed — check Cloudflare dashboard." }

# ---------------------------------------------------------------------------
# Step 8 — Add MX record reminder (must be done manually in dashboard)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  IMPORTANT — MX record must be added manually in the Cloudflare dashboard:" -ForegroundColor Yellow
Write-Host "    Type : MX" -ForegroundColor Yellow
Write-Host "    Name : $mailDomain" -ForegroundColor Yellow
Write-Host "    Value: $mailHostname" -ForegroundColor Yellow
Write-Host "    Priority: 10" -ForegroundColor Yellow
Write-Host "    Proxy : DNS only (grey cloud)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Also add these DNS records for email authentication:" -ForegroundColor Yellow
Write-Host "    TXT  $mailDomain               v=spf1 mx a:$mailHostname ~all" -ForegroundColor Yellow
Write-Host "    TXT  _dmarc.$mailDomain        v=DMARC1; p=quarantine; rua=mailto:admin@$mailDomain" -ForegroundColor Yellow
Write-Host "    TXT  mail._domainkey.$mailDomain   (get value from: docker exec mailserver-rspamd cat /var/lib/rspamd/dkim/mail.pub)" -ForegroundColor Yellow

# ---------------------------------------------------------------------------
# Step 9 — Restart cloudflared service in Docker
# ---------------------------------------------------------------------------
Write-Step "Restarting cloudflared container with new token..."

Set-Location $RepoRoot
docker compose -f docker-compose.apps.yml up -d --no-deps cloudflared

if ($LASTEXITCODE -eq 0) {
    Write-OK "cloudflared container restarted."
} else {
    Write-Warn "docker compose restart failed.  Try manually: docker compose -f docker-compose.apps.yml up -d cloudflared"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Cloudflare Tunnel setup complete!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tunnel name : $tunnelName"
Write-Host "  Tunnel ID   : $tunnelId"
Write-Host ""
Write-Host "  Your mail server will be accessible at:"
Write-Host "    https://$mailHostname         (webmail + API)"
Write-Host "    https://cloud.$mailDomain     (Nextcloud)"
Write-Host ""
Write-Host "  DNS propagation takes 1-5 minutes with Cloudflare."
Write-Host ""
Write-Host "  To check the tunnel is connected:"
Write-Host "    docker logs mailserver-cloudflared"
Write-Host "    cloudflared tunnel info $tunnelName"
Write-Host ""
Write-Host "  NOTE: Cloudflare Tunnel proxies HTTP/HTTPS."
Write-Host "    For IMAP/POP3/SMTP, email clients must connect to your PC's IP"
Write-Host "    directly, OR use a separate TCP-mode Cloudflare Tunnel (Teams plan)."
Write-Host "    For desktop clients on the same LAN, direct connection always works." -ForegroundColor Yellow
Write-Host ""
