"""
run.py — One-click launcher for the Enterprise Mail Server.

Starts in parallel:
  • Python backend  (FastAPI + SMTP + IMAP)  →  http://localhost:8080
  • Next.js frontend (React UI)              →  http://localhost:3000

Usage:
  python run.py                  # start everything, open browser
  python run.py --no-browser     # skip auto browser open
  python run.py --backend-only   # skip Next.js frontend
  python run.py --frontend-only  # skip Python backend
  python run.py --install        # force reinstall all deps, then start
  python run.py --build          # production build of Next.js, then start
"""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

# ── ANSI colours (Windows 10+ and all Unix) ────────────────────────────────────
os.system("")
R    = "\033[91m"; G    = "\033[92m"; Y    = "\033[93m"
B    = "\033[94m"; M    = "\033[95m"; C    = "\033[96m"
W    = "\033[97m"; DIM  = "\033[2m";  RST  = "\033[0m"
BOLD = "\033[1m"

BASE_DIR     = Path(__file__).parent
FRONTEND_DIR = BASE_DIR / "frontend"


# ── Logging helpers ────────────────────────────────────────────────────────────

def log(sym, col, msg): print(f"  {col}{sym}{RST}  {msg}")
def ok(msg):    log("✔", G, msg)
def err(msg):   log("✘", R, msg)
def info(msg):  log("•", C, msg)
def warn(msg):  log("!", Y, msg)
def step(msg):  print(f"\n{BOLD}{B}  ▶  {msg}{RST}")
def label(tag, col, msg): print(f"  {col}[{tag}]{RST} {msg}")


def banner():
    print(f"""
{M}╔══════════════════════════════════════════════════════════╗
║  {W}{BOLD}  Enterprise Mail Server  —  Launcher  v2{RST}{M}              ║
╠══════════════════════════════════════════════════════════╣
║  {DIM}Backend  →  http://localhost:8080{RST}{M}                       ║
║  {DIM}Frontend →  http://localhost:3000{RST}{M}                       ║
╚══════════════════════════════════════════════════════════╝{RST}
""")


# ── Pre-flight checks ──────────────────────────────────────────────────────────

def check_python():
    step("Checking Python version")
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 9):
        err(f"Python 3.9+ required. You have {major}.{minor}.")
        sys.exit(1)
    ok(f"Python {major}.{minor}")


def check_node():
    step("Checking Node.js / npm")
    node = shutil.which("node")
    npm  = shutil.which("npm")
    if not node or not npm:
        err("Node.js / npm not found.")
        print(f"""
  {Y}Install Node.js (LTS) from https://nodejs.org/{RST}
  After installing, reopen this terminal and run again.
""")
        return False
    try:
        ver = subprocess.check_output(["node", "--version"], text=True).strip()
        ok(f"Node.js {ver}  (npm found)")
    except Exception:
        ok("Node.js found")
    return True


def check_mongodb(host="localhost", port=27017, timeout=3):
    # Read custom port from .env
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("MONGODB_URI="):
                uri = line.split("=", 1)[1].strip()
                # parse port from mongodb://host:port
                try:
                    port = int(uri.rstrip("/").split(":")[-1])
                except Exception:
                    pass

    step(f"Checking MongoDB (port {port})")
    try:
        s = socket.create_connection((host, port), timeout=timeout)
        s.close()
        ok(f"MongoDB reachable at {host}:{port}")
        return True
    except OSError:
        warn(f"MongoDB not reachable at {host}:{port}")
        print(f"""
  {Y}┌────────────────────────────────────────────────────────┐
  │  MongoDB does not appear to be running.               │
  │                                                       │
  │  Download: https://www.mongodb.com/try/download/      │
  │            community                                  │
  │                                                       │
  │  Windows: installs as a service (starts automatically)│
  │  Linux  : sudo systemctl start mongod                 │
  │  macOS  : brew services start mongodb-community       │
  └────────────────────────────────────────────────────────┘{RST}""")
        ans = input(f"\n  {Y}Continue anyway (server will retry)? [y/N]: {RST}").strip().lower()
        return ans == "y"


def install_python_deps(force=False):
    req = BASE_DIR / "requirements.txt"
    if not req.exists():
        err("requirements.txt not found"); sys.exit(1)

    step("Python dependencies")
    if not force:
        try:
            import fastapi, motor, aiosmtpd, uvicorn  # noqa
            ok("Already installed"); return
        except ImportError:
            pass

    info("Running: pip install -r requirements.txt …")
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(req), "-q"],
    )
    if r.returncode != 0:
        err("pip install failed. Run manually: pip install -r requirements.txt")
        sys.exit(1)
    ok("Python packages installed")


def install_node_deps(force=False):
    nm = FRONTEND_DIR / "node_modules"
    step("Node.js dependencies")

    if nm.exists() and not force:
        ok("node_modules already present"); return

    info("Running: npm install  (this may take ~60 seconds) …")
    r = subprocess.run(
        ["npm", "install"],
        cwd=str(FRONTEND_DIR),
        shell=(sys.platform == "win32"),
    )
    if r.returncode != 0:
        err("npm install failed.")
        sys.exit(1)
    ok("Node packages installed")


def build_nextjs():
    step("Building Next.js (production)")
    info("Running: npm run build …")
    r = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(FRONTEND_DIR),
        shell=(sys.platform == "win32"),
    )
    if r.returncode != 0:
        err("Next.js build failed. Fix errors and retry.")
        sys.exit(1)
    ok("Next.js build complete")


# ── Process launchers ──────────────────────────────────────────────────────────

_stop_event = threading.Event()


def stream_output(proc, tag, colour):
    """Forward a subprocess's stdout+stderr with a coloured [TAG] prefix."""
    def _read(stream):
        for raw in iter(stream.readline, b""):
            line = raw.decode("utf-8", errors="replace").rstrip()
            if line:
                label(tag, colour, line)

    t_out = threading.Thread(target=_read, args=(proc.stdout,), daemon=True)
    t_err = threading.Thread(target=_read, args=(proc.stderr,), daemon=True)
    t_out.start(); t_err.start()


def launch_backend():
    start_script = BASE_DIR / "start.py"
    if not start_script.exists():
        err("start.py not found"); return None

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    proc = subprocess.Popen(
        [sys.executable, str(start_script)],
        cwd=str(BASE_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    stream_output(proc, "BACKEND", G)
    return proc


def launch_frontend(production=False):
    if not FRONTEND_DIR.exists():
        err("frontend/ directory not found"); return None

    cmd = ["npm", "run", "start" if production else "dev"]
    proc = subprocess.Popen(
        cmd,
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=(sys.platform == "win32"),
    )
    stream_output(proc, "NEXTJS ", C)
    return proc


def wait_for_port(host, port, timeout=60, label="service"):
    """Poll until a port is open (server is ready)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            s = socket.create_connection((host, port), timeout=1)
            s.close()
            return True
        except OSError:
            time.sleep(0.5)
    warn(f"{label} did not become ready within {timeout}s")
    return False


def open_browser(url):
    import webbrowser
    webbrowser.open(url)


# ── Ready banner ───────────────────────────────────────────────────────────────

def print_ready(backend=True, frontend=True):
    lines = []
    if frontend:
        lines.append(f"  {W}UI (Next.js) {G}→  {C}http://localhost:3000{RST}")
    if backend:
        lines.append(f"  {W}Backend API  {G}→  {C}http://localhost:8080{RST}")
        lines.append(f"  {W}API Docs     {G}→  {C}http://localhost:8080/api/docs{RST}")
    lines.append("")
    lines.append(f"  {DIM}Login: admin@localhost  /  Admin@1234!{RST}")
    lines.append("")
    lines.append(f"  {Y}Press  Ctrl+C  to stop all servers{RST}")

    width = 58
    print(f"\n{G}╔{'═'*width}╗")
    print(f"║  {W}{BOLD}  All systems running!{RST}{G}" + " "*(width-24) + "║")
    print(f"╠{'═'*width}╣")
    for l in lines:
        # strip ANSI for length calculation
        import re
        plain = re.sub(r'\033\[[0-9;]*m', '', l)
        pad = width - len(plain)
        print(f"║{l}{' '*max(pad,0)}{G}║")
    print(f"╚{'═'*width}╝{RST}\n")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Enterprise Mail Server Launcher")
    parser.add_argument("--no-browser",    action="store_true", help="Do not open browser")
    parser.add_argument("--backend-only",  action="store_true", help="Only start Python backend")
    parser.add_argument("--frontend-only", action="store_true", help="Only start Next.js frontend")
    parser.add_argument("--install",       action="store_true", help="Force reinstall all deps")
    parser.add_argument("--build",         action="store_true", help="Production build of Next.js")
    args = parser.parse_args()

    run_backend  = not args.frontend_only
    run_frontend = not args.backend_only

    banner()

    # ── Checks & installs ──────────────────────────────────────────────────────
    check_python()

    if run_backend:
        install_python_deps(force=args.install)
        check_mongodb()

    node_ok = False
    if run_frontend:
        node_ok = check_node()
        if node_ok:
            install_node_deps(force=args.install)
            if args.build:
                build_nextjs()

    # ── Launch processes ───────────────────────────────────────────────────────
    step("Starting servers")

    procs = []

    backend_proc  = None
    frontend_proc = None

    if run_backend:
        info("Launching Python backend …")
        backend_proc = launch_backend()
        if backend_proc:
            procs.append(("Backend", backend_proc))

    if run_frontend and node_ok:
        info("Launching Next.js frontend …")
        frontend_proc = launch_frontend(production=args.build)
        if frontend_proc:
            procs.append(("Next.js", frontend_proc))

    if not procs:
        err("No processes started. Exiting.")
        sys.exit(1)

    # ── Wait for servers to be ready, then open browser ────────────────────────
    if not args.no_browser:
        def _open_when_ready():
            url = "http://localhost:3000" if run_frontend and node_ok else "http://localhost:8080"
            port = 3000 if run_frontend and node_ok else 8080
            svc  = "Next.js" if run_frontend and node_ok else "Backend"
            info(f"Waiting for {svc} to be ready …")
            if wait_for_port("localhost", port, timeout=90, label=svc):
                time.sleep(0.5)          # tiny extra buffer
                info(f"Opening browser → {url}")
                open_browser(url)

        threading.Thread(target=_open_when_ready, daemon=True).start()

    print_ready(backend=run_backend, frontend=run_frontend and node_ok)

    # ── Keep running until Ctrl+C or a process exits ───────────────────────────
    try:
        while True:
            for name, proc in procs:
                if proc.poll() is not None:
                    warn(f"{name} process exited (code {proc.returncode}). "
                         "Stopping all services.")
                    raise KeyboardInterrupt
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        print(f"\n\n  {Y}Shutting down …{RST}")
        for name, proc in procs:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                info(f"{name} stopped")
        print(f"\n  {G}All services stopped. Goodbye!{RST}\n")


if __name__ == "__main__":
    main()
