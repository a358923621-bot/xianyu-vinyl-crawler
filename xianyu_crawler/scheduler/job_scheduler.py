"""
Job scheduler for Xianyu crawler using APScheduler

Manages scheduled crawling tasks with configurable intervals
"""

import os
import sys
import subprocess
from datetime import datetime, time
from typing import Optional

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from xianyu_crawler.settings import (
    SCHEDULER_ENABLED,
    SCHEDULER_INCREMENTAL_INTERVAL_HOURS,
    SCHEDULER_FULL_CRAWL_HOUR,
    SCHEDULER_EXPORT_HOUR,
    JSON_OUTPUT_DIR,
)


class XianyuCrawlerScheduler:
    """
    Scheduler for automated Xianyu crawler tasks
    """

    def __init__(self):
        self.scheduler = BlockingScheduler()
        self.crawler_script = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "run_spider.py"
        )
        self.export_script = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "export.py"
        )

    def _run_incremental_crawl(self):
        """Run incremental crawl job"""
        logger.info("=" * 60)
        logger.info("Starting INCREMENTAL crawl job")
        logger.info("=" * 60)

        try:
            # Run Scrapy spider with incremental type
            result = subprocess.run(
                ["scrapy", "crawl", "vinyl_spider", "-a", "crawl_type=incremental"],
                capture_output=True,
                text=True,
                cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            )

            if result.returncode == 0:
                logger.info("Incremental crawl completed successfully")
                logger.info(result.stdout)
            else:
                logger.error(f"Incremental crawl failed with return code {result.returncode}")
                logger.error(result.stderr)

        except Exception as e:
            logger.error(f"Error running incremental crawl: {e}")

    def _run_full_crawl(self):
        """Run full crawl job"""
        logger.info("=" * 60)
        logger.info("Starting FULL crawl job")
        logger.info("=" * 60)

        try:
            # Run Scrapy spider with full type
            result = subprocess.run(
                ["scrapy", "crawl", "vinyl_spider", "-a", "crawl_type=full"],
                capture_output=True,
                text=True,
                cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            )

            if result.returncode == 0:
                logger.info("Full crawl completed successfully")
                logger.info(result.stdout)
            else:
                logger.error(f"Full crawl failed with return code {result.returncode}")
                logger.error(result.stderr)

        except Exception as e:
            logger.error(f"Error running full crawl: {e}")

    def _run_export(self):
        """Run data export job"""
        logger.info("=" * 60)
        logger.info("Starting EXPORT job")
        logger.info("=" * 60)

        try:
            # Run export script
            result = subprocess.run(
                [sys.executable, self.export_script],
                capture_output=True,
                text=True,
            )

            if result.returncode == 0:
                logger.info("Export completed successfully")
                logger.info(result.stdout)
            else:
                logger.error(f"Export failed with return code {result.returncode}")
                logger.error(result.stderr)

        except Exception as e:
            logger.error(f"Error running export: {e}")

    def _run_health_check(self):
        """Run health check job"""
        logger.info("Running health check...")

        # Check if output directory exists
        if not os.path.exists(JSON_OUTPUT_DIR):
            logger.warning(f"Output directory does not exist: {JSON_OUTPUT_DIR}")
        else:
            # Count exported files
            files = [f for f in os.listdir(JSON_OUTPUT_DIR) if f.endswith(".json")]
            logger.info(f"Found {len(files)} export files")

    def setup_jobs(self):
        """Configure scheduled jobs"""
        if not SCHEDULER_ENABLED:
            logger.warning("Scheduler is disabled in settings")
            return

        logger.info("Setting up scheduled jobs...")

        # Incremental crawl - every N hours
        self.scheduler.add_job(
            self._run_incremental_crawl,
            "interval",
            hours=SCHEDULER_INCREMENTAL_INTERVAL_HOURS,
            id="incremental_crawl",
            name="Incremental Crawl",
            replace_existing=True,
        )

        # Full crawl - daily at specified hour (default 2 AM)
        self.scheduler.add_job(
            self._run_full_crawl,
            "cron",
            hour=SCHEDULER_FULL_CRAWL_HOUR,
            minute=0,
            id="full_crawl",
            name="Full Crawl",
            replace_existing=True,
        )

        # Export - daily at specified hour (default 8 AM)
        self.scheduler.add_job(
            self._run_export,
            "cron",
            hour=SCHEDULER_EXPORT_HOUR,
            minute=0,
            id="export",
            name="Export Data",
            replace_existing=True,
        )

        # Health check - every hour
        self.scheduler.add_job(
            self._run_health_check,
            "interval",
            hours=1,
            id="health_check",
            name="Health Check",
            replace_existing=True,
        )

        logger.info("Scheduled jobs configured:")
        logger.info(f"  - Incremental crawl: Every {SCHEDULER_INCREMENTAL_INTERVAL_HOURS} hours")
        logger.info(f"  - Full crawl: Daily at {SCHEDULER_FULL_CRAWL_HOUR}:00")
        logger.info(f"  - Export: Daily at {SCHEDULER_EXPORT_HOUR}:00")
        logger.info(f"  - Health check: Every hour")

    def start(self):
        """Start the scheduler"""
        logger.info("Starting Xianyu crawler scheduler...")
        logger.info(f"Scheduler started at {datetime.now().isoformat()}")

        try:
            self.setup_jobs()
            self.scheduler.start()

        except (KeyboardInterrupt, SystemExit):
            logger.info("Scheduler stopped by user")
            self.scheduler.shutdown()

        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            self.scheduler.shutdown()
            raise

    def run_now(self, job_type: str = "incremental"):
        """
        Run a specific job immediately

        Args:
            job_type: Type of job to run - "incremental", "full", or "export"
        """
        logger.info(f"Running {job_type} job immediately...")

        if job_type == "incremental":
            self._run_incremental_crawl()
        elif job_type == "full":
            self._run_full_crawl()
        elif job_type == "export":
            self._run_export()
        else:
            logger.error(f"Unknown job type: {job_type}")


def main():
    """Main entry point for the scheduler"""
    import argparse

    parser = argparse.ArgumentParser(description="Xianyu Crawler Scheduler")
    parser.add_argument(
        "--run-now",
        choices=["incremental", "full", "export"],
        help="Run a specific job immediately instead of starting scheduler",
    )
    parser.add_argument(
        "--test", action="store_true", help="Test mode - run once and exit"
    )

    args = parser.parse_args()

    scheduler = XianyuCrawlerScheduler()

    if args.run_now:
        # Run specific job immediately
        scheduler.run_now(args.run_now)
    elif args.test:
        # Test mode - run incremental crawl once
        logger.info("Test mode: running incremental crawl...")
        scheduler.run_now("incremental")
    else:
        # Start scheduler
        scheduler.start()


if __name__ == "__main__":
    main()
