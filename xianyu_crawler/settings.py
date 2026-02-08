"""
Scrapy settings for xianyu_vinyl_crawler project
"""

import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).parent.parent

# Scrapy project settings
BOT_NAME = "xianyu_crawler"
SPIDER_MODULES = ["xianyu_crawler.spiders"]
NEWSPIDER_MODULE = "xianyu_crawler.spiders"

# Crawl responsibly by identifying yourself (and your website) on the user-agent
# USER_AGENT = f"{BOT_NAME}/1.0"

# Obey robots.txt rules
ROBOTSTXT_OBEY = False

# Configure maximum concurrent requests performed by Scrapy (default: 16)
CONCURRENT_REQUESTS = 8

# Configure a delay for requests for the same website (default: 0)
# See https://docs.scrapy.org/en/latest/topics/settings.html#download-delay
DOWNLOAD_DELAY = 3
# The download delay setting will honor only one of:
CONCURRENT_REQUESTS_PER_DOMAIN = 2
CONCURRENT_REQUESTS_PER_IP = 2

# Disable cookies (enabled by default)
COOKIES_ENABLED = True

# Disable Telnet Console (enabled by default)
TELNETCONSOLE_ENABLED = False

# Override the default request headers:
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# Enable or disable spider middlewares
# See https://docs.scrapy.org/en/latest/topics/spider-middleware.html
SPIDER_MIDDLEWARES = {
    "xianyu_crawler.middlewares.XianyuSpiderMiddleware": 543,
}

# Enable or disable downloader middlewares
# See https://docs.scrapy.org/en/latest/topics/downloader-middleware.html
DOWNLOADER_MIDDLEWARES = {
    "xianyu_crawler.middlewares.RandomUserAgentMiddleware": 400,
    "xianyu_crawler.middlewares.RetryMiddleware": 500,
}

# Enable or disable extensions
# See https://docs.scrapy.org/en/latest/topics/extensions.html
EXTENSIONS = {
    "scrapy.extensions.telnet.TelnetConsole": None,
}

# Configure item pipelines
# See https://docs.scrapy.org/en/latest/topics/item-pipeline.html
ITEM_PIPELINES = {
    "xianyu_crawler.pipelines.DeduplicationPipeline": 100,
    "xianyu_crawler.pipelines.DataValidationPipeline": 200,
    "xianyu_crawler.pipelines.JsonExportPipeline": 300,
}

# Enable and configure the AutoThrottle extension (disabled by default)
# See https://docs.scrapy.org/en/latest/topics/autothrottle.html
AUTOTHROTTLE_ENABLED = True
# The initial download delay
AUTOTHROTTLE_START_DELAY = 3
# The maximum download delay to be set in case of high latencies
AUTOTHROTTLE_MAX_DELAY = 8
# The average number of requests Scrapy should be sending in parallel to
# each remote server
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
# Enable showing throttling stats for every response received:
AUTOTHROTTLE_DEBUG = False

# Enable and configure HTTP caching (disabled by default)
# See https://docs.scrapy.org/en/latest/topics/downloader-middleware.html#httpcache-middleware-settings
HTTPCACHE_ENABLED = False
# HTTPCACHE_STORAGE = "scrapy.extensions.httpcache.FilesystemCacheStorage"

# Set settings whose default value is deprecated to a future-proof value
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"

# Playwright settings
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": True,
}
PLAYWRIGHT_DEFAULT_CONTEXT_ARGS = {
    "viewport": {"width": 1920, "height": 1080},
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}

# Xianyu-specific settings
XIANYU_BASE_URL = "https://www.goofish.com"
XIANYU_SEARCH_URL = "https://www.goofish.com/search"

# Data storage paths
DATA_DIR = BASE_DIR / "data"
COOKIES_DIR = DATA_DIR / "cookies"
CACHE_DIR = DATA_DIR / "cache"
OUTPUT_DIR = BASE_DIR / "output"
JSON_OUTPUT_DIR = OUTPUT_DIR / "json"

# Create directories if they don't exist
for dir_path in [COOKIES_DIR, CACHE_DIR, JSON_OUTPUT_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# Logging
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
LOG_DATEFORMAT = "%Y-%m-%d %H:%M:%S"

# Scheduler settings
SCHEDULER_ENABLED = True
SCHEDULER_INCREMENTAL_INTERVAL_HOURS = 4
SCHEDULER_FULL_CRAWL_HOUR = 2  # 2 AM
SCHEDULER_EXPORT_HOUR = 8  # 8 AM

# Keywords to search
SEARCH_KEYWORDS = [
    "黑胶唱片",
    "vinyl",
    "LP",
    "黑胶",
    "vinyl record",
]

# Max pages to crawl
MAX_PAGES_INCREMENTAL = 20
MAX_PAGES_FULL = 100

# Retry settings
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]
