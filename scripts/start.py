"""
Startup script for Xianyu crawler

Handles login check, dependency verification, and spider execution
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger

from xianyu_crawler.auth.cookie_manager import CookieManager
from xianyu_crawler.auth.qrcode_login import XianyuQRCodeLogin
from xianyu_crawler.settings import COOKIES_DIR, DATA_DIR, JSON_OUTPUT_DIR


def check_dependencies():
    """Check if required dependencies are installed"""
    logger.info("Checking dependencies...")

    required_modules = [
        "scrapy",
        "playwright",
        "scrapy_playwright",
        "apscheduler",
        "pydantic",
        "loguru",
    ]

    missing_modules = []

    for module in required_modules:
        try:
            __import__(module)
            logger.info(f"  ✓ {module}")
        except ImportError:
            logger.error(f"  ✗ {module} - NOT FOUND")
            missing_modules.append(module)

    if missing_modules:
        logger.error(f"\nMissing dependencies: {', '.join(missing_modules)}")
        logger.error("Please install dependencies using: uv sync")
        return False

    logger.info("All dependencies satisfied.\n")
    return True


def check_directories():
    """Check and create required directories"""
    logger.info("Checking directories...")

    directories = [COOKIES_DIR, DATA_DIR, JSON_OUTPUT_DIR]

    for dir_path in directories:
        path = Path(dir_path)
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            logger.info(f"  Created directory: {dir_path}")
        else:
            logger.info(f"  ✓ Directory exists: {dir_path}")

    logger.info("")


async def check_login() -> bool:
    """Check if user is logged in"""
    logger.info("Checking login status...")

    cookie_manager = CookieManager(str(COOKIES_DIR))

    if cookie_manager.is_cookies_valid():
        expiry = cookie_manager.get_cookie_expiry()
        logger.info(f"  ✓ Valid cookies found (expires: {expiry})")
        return True
    else:
        logger.warning("  ✗ No valid cookies found")
        return False


async def perform_login() -> bool:
    """Perform QR code login"""
    logger.info("Starting QR code login...")

    login_manager = XianyuQRCodeLogin(str(COOKIES_DIR), headless=False)
    success = await login_manager.login(timeout=300, show_qrcode=True)

    if success:
        logger.info("✓ Login successful!")
    else:
        logger.error("✗ Login failed")

    return success


def run_crawler(crawl_type: str = "incremental"):
    """Run the Scrapy spider"""
    import subprocess

    logger.info(f"Starting {crawl_type} crawl...")

    # Change to project directory
    project_dir = Path(__file__).parent.parent
    os.chdir(project_dir)

    # Run Scrapy
    cmd = ["scrapy", "crawl", "vinyl_spider", "-a", f"crawl_type={crawl_type}"]

    logger.info(f"Running command: {' '.join(cmd)}")

    result = subprocess.run(cmd)

    if result.returncode == 0:
        logger.info("Crawl completed successfully")
        return True
    else:
        logger.error(f"Crawl failed with return code {result.returncode}")
        return False


def start_scheduler():
    """Start the job scheduler"""
    logger.info("Starting job scheduler...")

    from xianyu_crawler.scheduler.job_scheduler import XianyuCrawlerScheduler

    scheduler = XianyuCrawlerScheduler()
    scheduler.start()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Xianyu Vinyl Record Crawler - Startup Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Start the scheduler (runs continuously)
  python scripts/start.py

  # Run a single incremental crawl
  python scripts/start.py --crawl incremental

  # Run a single full crawl
  python scripts/start.py --crawl full

  # Login only
  python scripts/start.py --login

  # Check login status
  python scripts/start.py --check-login
        """,
    )

    parser.add_argument("--crawl", choices=["incremental", "full"], help="Run a single crawl")
    parser.add_argument("--login", action="store_true", help="Perform QR code login")
    parser.add_argument("--check-login", action="store_true", help="Check login status")
    parser.add_argument("--scheduler", action="store_true", help="Start the job scheduler")
    parser.add_argument("--skip-checks", action="store_true", help="Skip dependency checks")

    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  Xianyu Vinyl Record Crawler")
    print("=" * 60 + "\n")

    # Check dependencies
    if not args.skip_checks and not check_dependencies():
        sys.exit(1)

    # Check directories
    if not args.skip_checks:
        check_directories()

    # Handle login operations
    if args.login:
        success = asyncio.run(perform_login())
        sys.exit(0 if success else 1)

    if args.check_login:
        logged_in = asyncio.run(check_login())
        if not logged_in:
            print("\nPlease login using: python scripts/start.py --login")
        sys.exit(0 if logged_in else 1)

    # Check login before running crawler
    if args.crawl:
        logged_in = asyncio.run(check_login())
        if not logged_in:
            print("\nNo valid login found. Please login first:")
            print("  python scripts/start.py --login")
            sys.exit(1)

        success = run_crawler(args.crawl)
        sys.exit(0 if success else 1)

    # Start scheduler
    if args.scheduler or not any([args.login, args.check_login, args.crawl]):
        # Check login before starting scheduler
        logged_in = asyncio.run(check_login())
        if not logged_in:
            print("\nNo valid login found. Please login first:")
            print("  python scripts/start.py --login")
            sys.exit(1)

        start_scheduler()


if __name__ == "__main__":
    main()
