#Requires -RunAsAdministrator
<#
.SYNOPSIS
    MailServer — Windows single-server setup script.

.DESCRIPTION
    Bootstraps the full mail-server stack on a Windows PC running
    Docker Desktop (WSL2 backend).  Run this once after cloning the
    repository.

    Steps performed:
      1. Verify Docker Desktop is installed and running
      2. Create required data directories
      3. Copy .env.example to .env (if not already present)
      4. Generate a self-signed TLS certificate for local testing
      5. Build and start all services with Docker Compose
      6. Wait for the API to become healthy
      7. Seed the superadmin account
      8. Print URLs and next steps

.NOTES
    Must be run from the repository root.
    Requires Windows 10 (1903+) or Windows 11.
    Requires Docker Desktop 4.x+ with WSL2 backend enabled.
#>

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$RepoRoot  = Split-Path -Parent $PSScriptRoot
$DataRoot  = Join-Path $RepoRoot "data"

# Directories that must exist before Docker starts
$DataDirs = @(
    "data\mail",
    "data\certs",
    "data\mongodb",
    "data\backups"
)

# Colour helpers
function Write-Step  { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "    [OK]  $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "    [ERR]  $msg" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
Clear-Host
Write-Host ""
Write-Host "  MailServer — Windows Setup" -ForegroundColor Cyan
Write-Host "  Single-server deployment with Docker Desktop" -ForegroundColor DarkCyan
Write-Host ""

# ---------------------------------------------------------------------------
# Step 1 — Check Docker Desktop
# ---------------------------------------------------------------------------
Write-Step "Checking Docker Desktop..."

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Warn "Docker is not installed or not on PATH."
    Write-Host "    Download Docker Desktop from https://www.docker.com/products/docker-desktop/"
    Write-Host "    Enable the WSL2 backend during installation, then re-run this script."
    exit 1
}

try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
    Write-OK "Docker Desktop is running."
} catch {
    Write-Fail "Docker daemon is not running.  Please start Docker Desktop and try again."
}

$composeVersion = docker compose version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose (v2) is required but not found.  Update Docker Desktop."
}
Write-OK "docker compose v2 found."

# ---------------------------------------------------------------------------
# Step 2 — Create data directories
# ---------------------------------------------------------------------------
Write-Step "Creating data directories..."

Set-Location $RepoRoot

foreach ($dir in $DataDirs) {
    $fullPath = Join-Path $RepoRoot $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        Write-OK "Created  $dir"
    } else {
        Write-OK "Exists   $dir"
    }
}

# ---------------------------------------------------------------------------
# Step 3 — Copy .env.example to .env
# ---------------------------------------------------------------------------
Write-Step "Checking environment file..."

$envFile    = Join-Path $RepoRoot ".env"
$envExample = Join-Path $RepoRoot ".env.example"

if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-OK ".env created from .env.example"
    Write-Warn "IMPORTANT: Edit .env and set your domain, secrets, and passwords before continuing."
    Write-Host ""
    Write-Host "    Mandatory changes in .env:" -ForegroundColor Yellow
    Write-Host "      MAIL_DOMAIN           your actual domain (e.g. example.com)" -ForegroundColor Yellow
    Write-Host "      MAIL_HOSTNAME         mail.example.com" -ForegroundColor Yellow
    Write-Host "      MONGO_ROOT_PASSWORD   any strong password" -ForegroundColor Yellow
    Write-Host "      MONGO_APP_PASSWORD    any strong password (must match MONGO_URI)" -ForegroundColor Yellow
    Write-Host "      REDIS_PASSWORD        any strong password" -ForegroundColor Yellow
    Write-Host "      JWT_SECRET            32+ random characters" -ForegroundColor Yellow
    Write-Host "      JWT_REFRESH_SECRET    32+ random characters (different from above)" -ForegroundColor Yellow
    Write-Host "      INTERNAL_AUTH_TOKEN   16+ random characters" -ForegroundColor Yellow
    Write-Host "      NEXTCLOUD_ADMIN_PASSWORD  any strong password" -ForegroundColor Yellow
    Write-Host ""

    $continue = Read-Host "Press Enter after editing .env to continue, or type 'skip' to continue without editing"
    if ($continue -eq "skip") {
        Write-Warn "Continuing with default (insecure) values — change them before exposing to the internet."
    }
} else {
    Write-OK ".env already exists — skipping copy."
}

# Load .env into current process so we can read MAIL_HOSTNAME
$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match '^\s*[^#]\S+=.*' } | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
        $key   = $parts[0].Trim()
        $value = $parts[1].Trim()
        $envVars[$key] = $value
        [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$mailHostname = if ($envVars["MAIL_HOSTNAME"]) { $envVars["MAIL_HOSTNAME"] } else { "mail.yourdomain.com" }

# ---------------------------------------------------------------------------
# Step 4 — Generate self-signed TLS certificate (for local/dev testing)
# ---------------------------------------------------------------------------
Write-Step "Generating self-signed TLS certificate..."

$certDir  = Join-Path $RepoRoot "data\certs"
$certFile = Join-Path $certDir "server.crt"
$keyFile  = Join-Path $certDir "server.key"

if ((Test-Path $certFile) -and (Test-Path $keyFile)) {
    Write-OK "Certificate already exists — skipping generation."
} else {
    # Use Docker to run openssl so we don't need openssl on the host
    Write-Host "    Running openssl in a temporary container..."
    docker run --rm `
        -v "${certDir}:/out" `
        alpine/openssl req -x509 -nodes -days 3650 `
            -newkey rsa:2048 `
            -keyout /out/server.key `
            -out /out/server.crt `
            -subj "/CN=$mailHostname/O=MailServer/C=US" `
            -addext "subjectAltName=DNS:$mailHostname,DNS:localhost,IP:127.0.0.1"

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "openssl container failed.  Trying native PowerShell certificate generation..."
        # Fallback: PowerShell New-SelfSignedCertificate (exports PFX then converts)
        $cert = New-SelfSignedCertificate `
            -DnsName $mailHostname, "localhost" `
            -CertStoreLocation "cert:\LocalMachine\My" `
            -NotAfter (Get-Date).AddYears(10) `
            -KeyAlgorithm RSA `
            -KeyLength 2048

        # Export PFX
        $pfxPath = Join-Path $certDir "server.pfx"
        $pfxPwd  = ConvertTo-SecureString -String "temp-export-pwd" -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pfxPwd | Out-Null

        # Convert PFX to PEM with openssl in Docker
        docker run --rm `
            -v "${certDir}:/out" `
            alpine/openssl pkcs12 -in /out/server.pfx -nokeys -out /out/server.crt `
                -passin pass:temp-export-pwd
        docker run --rm `
            -v "${certDir}:/out" `
            alpine/openssl pkcs12 -in /out/server.pfx -nocerts -nodes -out /out/server.key `
                -passin pass:temp-export-pwd

        Remove-Item $pfxPath -ErrorAction SilentlyContinue
    }

    Write-OK "Self-signed certificate written to data\certs\"
    Write-Warn "For production, replace with a Let's Encrypt or Cloudflare Origin certificate."
}

# ---------------------------------------------------------------------------
# Step 5 — Create the Docker network (mailnet) if needed
# ---------------------------------------------------------------------------
Write-Step "Ensuring Docker network 'mailnet' exists..."

$networks = docker network ls --format "{{.Name}}" 2>&1
if ($networks -notcontains "mailnet") {
    docker network create mailnet | Out-Null
    Write-OK "Network 'mailnet' created."
} else {
    Write-OK "Network 'mailnet' already exists."
}

# ---------------------------------------------------------------------------
# Step 6 — Build and start the core mail stack
# ---------------------------------------------------------------------------
Write-Step "Building and starting core mail stack (docker-compose.yml)..."
Write-Host "    This may take several minutes on the first run (downloading images + building)."
Write-Host "    ClamAV will take ~2 min to load its virus signatures."
Write-Host ""

docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up failed.  Check the output above for errors."
}
Write-OK "Core stack started."

# ---------------------------------------------------------------------------
# Step 7 — Build and start the application layer
# ---------------------------------------------------------------------------
Write-Step "Building and starting application layer (docker-compose.apps.yml)..."

docker compose -f docker-compose.apps.yml up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose -f docker-compose.apps.yml up failed."
}
Write-OK "Application layer started."

# ---------------------------------------------------------------------------
# Step 8 — Wait for the API to be healthy
# ---------------------------------------------------------------------------
Write-Step "Waiting for API to become healthy (up to 120 s)..."

$apiUrl    = "http://localhost:3000/health"
$maxWait   = 120
$waited    = 0
$interval  = 5
$apiReady  = $false

while ($waited -lt $maxWait) {
    try {
        $resp = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            $apiReady = $true
            break
        }
    } catch { }
    Write-Host "    Waiting... ($waited s elapsed)"
    Start-Sleep -Seconds $interval
    $waited += $interval
}

if ($apiReady) {
    Write-OK "API is healthy."
} else {
    Write-Warn "API did not respond within $maxWait s.  It may still be starting — check with:"
    Write-Host "    docker logs mailserver-api"
    Write-Host ""
    Write-Host "    Once healthy, run the superadmin seed step manually:"
    Write-Host "    scripts\setup-windows.ps1 will print the command below."
}

# ---------------------------------------------------------------------------
# Step 9 — Seed the superadmin account
# ---------------------------------------------------------------------------
Write-Step "Seeding superadmin account..."

$superadminEmail = Read-Host "Enter superadmin email address (default: superadmin@$($envVars['MAIL_DOMAIN'] ?? 'yourdomain.com'))"
if ([string]::IsNullOrWhiteSpace($superadminEmail)) {
    $superadminEmail = "superadmin@$($envVars['MAIL_DOMAIN'] ?? 'yourdomain.com')"
}

$superadminPassRaw = Read-Host "Enter superadmin password (min 12 chars)" -AsSecureString
$superadminPass    = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($superadminPassRaw)
)

if ($superadminPass.Length -lt 12) {
    Write-Warn "Password is shorter than 12 characters — consider using a stronger password."
}

# Seed via the API endpoint
if ($apiReady) {
    try {
        $body = @{
            email    = $superadminEmail
            password = $superadminPass
        } | ConvertTo-Json

        $seedResp = Invoke-WebRequest `
            -Uri "http://localhost:3000/api/internal/seed-superadmin" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction Stop

        Write-OK "Superadmin account created via API."
    } catch {
        Write-Warn "API seed endpoint not available — using direct MongoDB insert..."
        # Fall back to docker exec into MongoDB
        $escaped = $superadminPass -replace "'", "'\''"
        docker exec -i mailserver-mongodb mongosh mailserver `
            -u ($envVars["MONGO_ROOT_USER"] ?? "admin") `
            -p ($envVars["MONGO_ROOT_PASSWORD"] ?? "changeme") `
            --authenticationDatabase admin `
            --eval @"
const bcrypt = { hashSync: (p, r) => `+"`" + `require('bcryptjs').hashSync(p, r)` + "`" + ` };
db.users.updateOne(
  { email: '$superadminEmail' },
  { `$set: { email: '$superadminEmail', role: 'superadmin',
             domain: '$($superadminEmail.Split('@')[1])',
             quotaMb: 10240, active: true, createdAt: new Date() } },
  { upsert: true }
);
print('Superadmin upserted (password must be set via API /auth/reset or re-run seed).');
"@
        Write-Warn "Password hashing requires bcryptjs inside mongosh.  If the above failed,"
        Write-Warn "run scripts\seed-superadmin.sh (in WSL/Git Bash) or set the password via the API."
    }
} else {
    Write-Warn "Skipping superadmin seed — API is not ready."
    Write-Host "    Run this command manually once the API is healthy:"
    Write-Host "    `$env:SUPERADMIN_EMAIL='$superadminEmail'; `$env:SUPERADMIN_PASS='<password>'; bash scripts/seed-superadmin.sh"
}

# ---------------------------------------------------------------------------
# Step 10 — Print summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Local access (HTTP — no Cloudflare Tunnel):"
Write-Host "    Webmail / Landing page  http://localhost"
Write-Host "    Webmail (HTTPS)         https://localhost  (self-signed cert warning is normal)"
Write-Host ""
Write-Host "  Superadmin portal   https://localhost/superadmin/login"
Write-Host "  Admin portal        https://localhost/admin/login"
Write-Host "  User portal         https://localhost/login"
Write-Host ""
Write-Host "  Mail client settings:"
Write-Host "    IMAP  $mailHostname  port 993  SSL/TLS"
Write-Host "    POP3  $mailHostname  port 995  SSL/TLS"
Write-Host "    SMTP  $mailHostname  port 587  STARTTLS"
Write-Host ""
Write-Host "  To expose to the internet via Cloudflare Tunnel (recommended):"
Write-Host "    .\scripts\setup-cloudflare.ps1"
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "    docker compose ps                       # check service status"
Write-Host "    docker compose logs -f api              # tail API logs"
Write-Host "    docker logs mailserver-postfix          # Postfix logs"
Write-Host "    docker logs mailserver-clamav           # ClamAV (slow first start)"
Write-Host "    docker compose down                     # stop everything"
Write-Host "    docker compose up -d                    # restart"
Write-Host ""
Write-Host "  NOTE: ClamAV downloads virus signatures on first start (~400 MB)."
Write-Host "        Give it 2-3 minutes before mail scanning works." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ISP port 25 note:"
Write-Host "    Many residential ISPs block outbound port 25.  If Gmail / Outlook"
Write-Host "    reject your outbound mail, use Mailgun or SendGrid as an SMTP relay."
Write-Host "    Receiving on port 25 (inbound) works fine via Cloudflare Tunnel."
Write-Host ""
