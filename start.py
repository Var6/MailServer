"""
Main startup script for the Enterprise Mail Server.
Initializes the database, starts SMTP, IMAP, and web servers.
"""
import asyncio
import logging
import os
import signal
import sys
import threading
import time
from pathlib import Path

# Ensure working directory is the script location
os.chdir(Path(__file__).parent)

# ── Logging setup ──────────────────────────────────────────────────────────────
from config import config

config.ensure_dirs()

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(config.LOG_FILE, encoding="utf-8"),
    ],
)
logger = logging.getLogger("start")

# ── Imports ────────────────────────────────────────────────────────────────────
from database import init_db, create_user, get_user_by_email, get_db
from auth import hash_password
from smtp_server import smtp_controller
from imap_server import imap_server


async def initialize_database():
    """Connect to MongoDB, create indexes, and seed admin user."""
    logger.info("Initializing database...")
    await init_db()          # connects + creates indexes

    db = get_db()            # motor database object (available after init_db)
    existing = await get_user_by_email(db, config.ADMIN_EMAIL)
    if not existing:
        await create_user(
            db,
            email=config.ADMIN_EMAIL,
            password_hash=hash_password(config.ADMIN_PASSWORD),
            display_name=config.ADMIN_DISPLAY_NAME,
            is_admin=True,
        )
        logger.info(f"Created admin user: {config.ADMIN_EMAIL}")
    else:
        logger.info(f"Admin user already exists: {config.ADMIN_EMAIL}")


def start_smtp_server():
    """Start SMTP server in a background thread."""
    try:
        smtp_controller.start()
    except Exception as e:
        logger.error(f"SMTP server startup error: {e}", exc_info=True)


async def start_imap_server():
    """Start IMAP server as an asyncio task."""
    try:
        await imap_server.start()
    except Exception as e:
        logger.error(f"IMAP server error: {e}", exc_info=True)


async def start_web_server():
    """Start the FastAPI web server via uvicorn."""
    import uvicorn
    uv_config = uvicorn.Config(
        app="web_app:app",
        host=config.WEB_HOST,
        port=config.WEB_PORT,
        log_level=config.LOG_LEVEL.lower(),
        access_log=config.DEBUG,
        reload=False,
    )
    server = uvicorn.Server(uv_config)
    await server.serve()


def print_startup_banner():
    """Print startup information to console."""
    print("\n" + "=" * 60)
    print(f"  🚀  {config.COMPANY_NAME} Mail Server")
    print("=" * 60)
    print(f"  Domain:       {config.DOMAIN}")
    print(f"  Web UI:       http://localhost:{config.WEB_PORT}")
    print(f"  API Docs:     http://localhost:{config.WEB_PORT}/api/docs")
    print(f"  SMTP:         {config.SMTP_HOST}:{config.SMTP_PORT}")
    print(f"  SMTP Sub:     {config.SMTP_HOST}:{config.SMTP_SUBMISSION_PORT}")
    print(f"  IMAP:         {config.IMAP_HOST}:{config.IMAP_PORT}")
    print("-" * 60)
    print(f"  Admin Email:  {config.ADMIN_EMAIL}")
    print(f"  Admin Pass:   {config.ADMIN_PASSWORD}")
    print("-" * 60)
    print("  Press Ctrl+C to stop the server")
    print("=" * 60 + "\n")


async def health_monitor():
    """Periodically check server health and log stats."""
    while True:
        await asyncio.sleep(60)
        try:
            import psutil
            mem = psutil.virtual_memory()
            cpu = psutil.cpu_percent(interval=1)
            logger.debug(f"Health: CPU={cpu:.1f}% MEM={mem.percent:.1f}%")
        except Exception:
            pass


async def main():
    """Main async entry point."""
    # Initialize database
    await initialize_database()

    print_startup_banner()

    # Start SMTP in background thread (aiosmtpd uses its own event loop)
    smtp_thread = threading.Thread(target=start_smtp_server, daemon=True, name="smtp-server")
    smtp_thread.start()
    logger.info("SMTP thread started")

    # Create async tasks
    tasks = [
        asyncio.create_task(start_imap_server(), name="imap-server"),
        asyncio.create_task(start_web_server(), name="web-server"),
        asyncio.create_task(health_monitor(), name="health-monitor"),
    ]

    # Handle graceful shutdown
    loop = asyncio.get_running_loop()
    shutdown_event = asyncio.Event()

    def handle_shutdown():
        logger.info("Shutdown signal received")
        shutdown_event.set()

    try:
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, handle_shutdown)
    except (NotImplementedError, AttributeError):
        # Windows doesn't support add_signal_handler
        pass

    try:
        # Wait for shutdown or task completion
        done, pending = await asyncio.wait(
            tasks,
            return_when=asyncio.FIRST_COMPLETED,
        )
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutting down...")
    finally:
        # Cancel pending tasks
        for task in tasks:
            if not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

        # Stop SMTP
        smtp_controller.stop()
        imap_server.stop()
        logger.info("All servers stopped. Goodbye!")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
