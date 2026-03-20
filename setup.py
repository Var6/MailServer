"""
First-time setup wizard for the Enterprise Mail Server.
Interactive CLI to configure the server and generate necessary files.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent


def print_header():
    print("\n" + "=" * 60)
    print("  📧  Enterprise Mail Server - Setup Wizard")
    print("=" * 60)
    print("  This wizard will configure your mail server.")
    print("  Press Enter to accept default values [in brackets].\n")


def ask(prompt, default="", required=False, secret=False, validator=None):
    """Prompt for user input with optional default and validation."""
    import getpass

    display_default = f" [{default}]" if default else ""
    full_prompt = f"  {prompt}{display_default}: "

    while True:
        if secret:
            value = getpass.getpass(full_prompt)
        else:
            value = input(full_prompt).strip()

        if not value:
            if default:
                return default
            elif required:
                print("    ⚠  This field is required.")
                continue
            else:
                return ""

        if validator:
            ok, msg = validator(value)
            if not ok:
                print(f"    ⚠  {msg}")
                continue

        return value


def ask_yes_no(prompt, default=True):
    suffix = " [Y/n]" if default else " [y/N]"
    value = input(f"  {prompt}{suffix}: ").strip().lower()
    if not value:
        return default
    return value in ("y", "yes")


def check_python_version():
    print("\n[1/8] Checking Python version...")
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 9):
        print(f"  ❌ Python 3.9+ required. Found: {major}.{minor}")
        sys.exit(1)
    print(f"  ✅ Python {major}.{minor} - OK")


def install_requirements():
    print("\n[2/8] Installing requirements...")
    req_file = BASE_DIR / "requirements.txt"
    if not req_file.exists():
        print("  ❌ requirements.txt not found!")
        sys.exit(1)

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(req_file), "--quiet"],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            print("  ✅ All packages installed successfully")
        else:
            print(f"  ⚠  pip output: {result.stderr[:500]}")
            print("  Attempting to continue...")
    except subprocess.TimeoutExpired:
        print("  ⚠  Installation timed out. Run manually: pip install -r requirements.txt")
    except Exception as e:
        print(f"  ⚠  Installation error: {e}")


def configure_server():
    print("\n[3/8] Server Configuration...")

    domain = ask("Domain name (e.g., mail.company.com)", default="localhost")
    company = ask("Company/Server name", default="Enterprise Mail")
    hostname = ask("Server hostname", default=domain)

    return {"domain": domain, "company": company, "hostname": hostname}


def configure_admin():
    print("\n[4/8] Admin Account...")

    def email_validator(v):
        if "@" not in v:
            return False, "Please enter a valid email address"
        return True, ""

    def password_validator(v):
        if len(v) < 8:
            return False, "Password must be at least 8 characters"
        if not any(c.isupper() for c in v):
            return False, "Password must contain at least one uppercase letter"
        if not any(c.isdigit() for c in v):
            return False, "Password must contain at least one digit"
        return True, ""

    email = ask("Admin email", default="admin@localhost", validator=email_validator)
    password = ask("Admin password", default="Admin@1234!", secret=True, validator=password_validator)
    display_name = ask("Admin display name", default="Administrator")

    return {"email": email, "password": password, "display_name": display_name}


def configure_ports():
    print("\n[5/8] Port Configuration...")

    def port_validator(v):
        try:
            p = int(v)
            if 1 <= p <= 65535:
                return True, ""
            return False, "Port must be between 1 and 65535"
        except ValueError:
            return False, "Port must be a number"

    smtp_port = ask("SMTP port (25 requires admin/root)", default="2525", validator=port_validator)
    smtp_sub_port = ask("SMTP submission port", default="5870", validator=port_validator)
    imap_port = ask("IMAP port (143 requires admin/root)", default="1430", validator=port_validator)
    web_port = ask("Web UI port", default="8080", validator=port_validator)

    return {
        "smtp_port": smtp_port,
        "smtp_sub_port": smtp_sub_port,
        "imap_port": imap_port,
        "web_port": web_port,
    }


def configure_relay():
    print("\n[6/8] SMTP Relay Configuration (for sending external mail)...")

    use_relay = ask_yes_no("Configure SMTP relay?", default=False)
    if not use_relay:
        print("  Skipping relay configuration (outbound mail disabled)")
        return {}

    relay_host = ask("Relay SMTP host (e.g., smtp.gmail.com)", required=True)
    relay_port = ask("Relay SMTP port", default="587")
    relay_user = ask("Relay username/email", default="")
    relay_pass = ask("Relay password", secret=True, default="")
    relay_tls = ask_yes_no("Use TLS for relay?", default=True)

    return {
        "relay_host": relay_host,
        "relay_port": relay_port,
        "relay_user": relay_user,
        "relay_pass": relay_pass,
        "relay_tls": "true" if relay_tls else "false",
    }


def generate_tls_cert():
    print("\n[7/8] TLS Certificate...")
    cert_file = BASE_DIR / "cert.pem"
    key_file = BASE_DIR / "key.pem"

    if cert_file.exists() and key_file.exists():
        print("  ✅ TLS certificate already exists")
        return

    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime
        import ipaddress

        print("  Generating self-signed certificate...")

        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )

        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Enterprise Mail"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])

        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
            .add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName("localhost"),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                ]),
                critical=False,
            )
            .sign(key, hashes.SHA256())
        )

        with open(cert_file, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))

        with open(key_file, "wb") as f:
            f.write(key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption(),
            ))

        print(f"  ✅ Certificate generated: {cert_file}")
    except ImportError:
        print("  ⚠  cryptography package not available for cert generation")
    except Exception as e:
        print(f"  ⚠  Certificate generation failed: {e}")


def create_env_file(server_cfg, admin_cfg, port_cfg, relay_cfg):
    print("\n[8/8] Creating configuration file (.env)...")

    import secrets as _secrets

    secret_key = _secrets.token_urlsafe(64)

    lines = [
        "# Enterprise Mail Server Configuration",
        "# Generated by setup.py",
        "",
        "# Server",
        f"MAIL_DOMAIN={server_cfg['domain']}",
        f"COMPANY_NAME={server_cfg['company']}",
        f"SERVER_HOSTNAME={server_cfg['hostname']}",
        "",
        "# Security",
        f"SECRET_KEY={secret_key}",
        "",
        "# Admin",
        f"ADMIN_EMAIL={admin_cfg['email']}",
        f"ADMIN_PASSWORD={admin_cfg['password']}",
        f"ADMIN_DISPLAY_NAME={admin_cfg['display_name']}",
        "",
        "# Ports",
        f"SMTP_PORT={port_cfg['smtp_port']}",
        f"SMTP_SUBMISSION_PORT={port_cfg['smtp_sub_port']}",
        f"IMAP_PORT={port_cfg['imap_port']}",
        f"WEB_PORT={port_cfg['web_port']}",
        "",
        "# Hosts",
        "SMTP_HOST=0.0.0.0",
        "IMAP_HOST=0.0.0.0",
        "WEB_HOST=0.0.0.0",
        "",
        "# Mail settings",
        "MAX_EMAIL_SIZE_MB=25",
        "MAX_ATTACHMENT_SIZE_MB=10",
        "DEFAULT_QUOTA_MB=1024",
        "",
        "# Logging",
        "LOG_LEVEL=INFO",
        "",
        "# Database",
        f"DATABASE_URL=sqlite+aiosqlite:///{BASE_DIR}/mail.db",
    ]

    if relay_cfg:
        lines.extend([
            "",
            "# SMTP Relay",
            f"RELAY_HOST={relay_cfg.get('relay_host', '')}",
            f"RELAY_PORT={relay_cfg.get('relay_port', '587')}",
            f"RELAY_USERNAME={relay_cfg.get('relay_user', '')}",
            f"RELAY_PASSWORD={relay_cfg.get('relay_pass', '')}",
            f"RELAY_USE_TLS={relay_cfg.get('relay_tls', 'true')}",
        ])

    env_content = "\n".join(lines) + "\n"
    env_file = BASE_DIR / ".env"

    if env_file.exists():
        backup = env_file.with_suffix(".env.bak")
        env_file.rename(backup)
        print(f"  Backed up existing .env to {backup.name}")

    with open(env_file, "w") as f:
        f.write(env_content)

    print(f"  ✅ Configuration saved to .env")


def initialize_database():
    print("\n  Initializing database...")
    try:
        import asyncio
        # Reload config with new .env
        import importlib
        import config as cfg_mod
        importlib.reload(cfg_mod)

        async def _init():
            from database import init_db, create_user, get_user_by_email, AsyncSessionLocal
            from auth import hash_password as hp

            await init_db()
            async with AsyncSessionLocal() as db:
                existing = await get_user_by_email(db, cfg_mod.config.ADMIN_EMAIL)
                if not existing:
                    await create_user(
                        db,
                        email=cfg_mod.config.ADMIN_EMAIL,
                        password_hash=hp(cfg_mod.config.ADMIN_PASSWORD),
                        display_name=cfg_mod.config.ADMIN_DISPLAY_NAME,
                        is_admin=True,
                    )

        asyncio.run(_init())
        print("  ✅ Database initialized")
    except Exception as e:
        print(f"  ⚠  Database init error: {e}")


def print_success(admin_cfg, port_cfg):
    print("\n" + "=" * 60)
    print("  🎉  Setup Complete!")
    print("=" * 60)
    print(f"\n  To start the server, run:")
    print(f"    python start.py")
    print(f"\n  Web interface: http://localhost:{port_cfg['web_port']}")
    print(f"  Admin email:   {admin_cfg['email']}")
    print(f"  Admin pass:    {admin_cfg['password']}")
    print(f"\n  SMTP:  localhost:{port_cfg['smtp_port']} (no auth)")
    print(f"  SMTP:  localhost:{port_cfg['smtp_sub_port']} (auth required)")
    print(f"  IMAP:  localhost:{port_cfg['imap_port']}")
    print("=" * 60 + "\n")


def main():
    print_header()

    try:
        check_python_version()
        install_requirements()
        server_cfg = configure_server()
        admin_cfg = configure_admin()
        port_cfg = configure_ports()
        relay_cfg = configure_relay()
        generate_tls_cert()
        create_env_file(server_cfg, admin_cfg, port_cfg, relay_cfg)
        initialize_database()
        print_success(admin_cfg, port_cfg)

    except KeyboardInterrupt:
        print("\n\n  Setup cancelled.")
        sys.exit(0)
    except Exception as e:
        print(f"\n  ❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
