"""
Middleware classes for Xianyu crawler

Includes anti-spider measures like User-Agent rotation,
retry logic, and request throttling.
"""

import random
import time
from typing import Iterable
from fake_useragent import UserAgent
from scrapy import signals
from scrapy.downloadermiddlewares.retry import RetryMiddleware as ScrapyRetryMiddleware
from scrapy.exceptions import NotConfigured
from scrapy.http import Request, Response
from scrapy.spiders import Spider
from twisted.internet import defer
from twisted.internet.error import (
    ConnectError,
    ConnectionDone,
    TimeoutError,
    TCPTimedOutError,
)


class RandomUserAgentMiddleware:
    """
    Middleware to rotate User-Agent for each request
    """

    def __init__(self):
        self.ua = UserAgent()
        self.ua_type = "random"

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def process_request(self, request: Request, spider: Spider):
        """Add a random User-Agent to each request"""
        request.headers["User-Agent"] = self.ua.get(self.ua_type)


class XianyuSpiderMiddleware:
    """
    Spider middleware for handling spider input/output
    """

    @classmethod
    def from_crawler(cls, crawler):
        s = cls()
        crawler.signals.connect(s.spider_opened, signal=signals.spider_opened)
        return s

    def process_spider_input(self, response, spider):
        """Called for each response that goes through the spider middleware"""
        return None

    def process_spider_output(self, response, result, spider):
        """Called with the results returned from the Spider"""
        for i in result:
            yield i

    def process_spider_exception(self, response, exception, spider):
        """Called when a spider or process_spider_input() method raises an exception"""
        pass

    def process_start_requests(self, start_requests, spider):
        """Called with the start requests of the spider"""
        for r in start_requests:
            yield r

    def spider_opened(self, spider):
        spider.logger.info("Spider opened: %s" % spider.name)


class RetryMiddleware(ScrapyRetryMiddleware):
    """
    Custom retry middleware with enhanced error handling
    """

    EXCEPTIONS_TO_RETRY = (
        defer.TimeoutError,
        TimeoutError,
        ConnectError,
        ConnectionDone,
        TCPTimedOutError,
        # Add more exceptions as needed
    )

    def __init__(self, settings):
        super().__init__(settings)
        self.max_retry_times = settings.getint("RETRY_TIMES", 3)
        self.retry_http_codes = set(
            int(x) for x in settings.getlist("RETRY_HTTP_CODES", [500, 502, 503, 504, 408, 429])
        )
        self.retry_adjust_delay = settings.getfloat("RETRY_ADJUST_DELAY", True)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_response(self, request: Request, response: Response, spider: Spider):
        """Handle retry logic based on response status"""
        if request.meta.get("dont_retry", False):
            return response

        # Check if response status code is in retry list
        if response.status in self.retry_http_codes:
            reason = f"HTTP status {response.status}"
            return self._retry(request, reason, spider) or response

        # Check for specific anti-spider indicators
        if self._is_blocked(response):
            spider.logger.warning(f"Potential block detected for {request.url}")
            return self._retry(request, "Blocked by anti-spider", spider) or response

        return response

    def process_exception(self, request: Request, exception, spider: Spider):
        """Handle retry logic based on exceptions"""
        if isinstance(exception, self.EXCEPTIONS_TO_RETRY) and not request.meta.get(
            "dont_retry", False
        ):
            return self._retry(request, exception, spider)

    def _retry(self, request: Request, reason, spider: Spider):
        """Retry the request with incremented retry count"""
        retries = request.meta.get("retry_times", 0) + 1

        if retries <= self.max_retry_times:
            spider.logger.debug(f"Retrying {request.url} (failed {retries} times): {reason}")

            # Exponential backoff
            retry_delay = min(2**retries, 60)  # Max 60 seconds
            if self.retry_adjust_delay:
                retry_delay = retry_delay + random.uniform(0, 1)

            # Create retry request
            retry_request = request.copy()
            retry_request.meta["retry_times"] = retries
            retry_request.dont_filter = True

            # Add delay to avoid overwhelming the server
            retry_request.priority = request.priority + 1

            # Schedule retry
            return retry_request
        else:
            spider.logger.error(f"Gave up retrying {request.url} (failed {retries} times): {reason}")

    def _is_blocked(self, response: Response) -> bool:
        """Check if response indicates blocking by anti-spider measures"""
        # Check for common indicators of blocking
        block_indicators = [
            "验证码",
            "captcha",
            "访问频繁",
            "access denied",
            "blocked",
        ]

        # Check response body for block indicators
        if hasattr(response, "text"):
            for indicator in block_indicators:
                if indicator in response.text.lower():
                    return True

        # Check response headers
        if "X-RateLimit-Limit" in response.headers or "X-RateLimit-Remaining" in response.headers:
            remaining = int(response.headers.get("X-RateLimit-Remaining", 1))
            if remaining <= 0:
                return True

        return False


class RequestDelayMiddleware:
    """
    Middleware to add random delays between requests
    """

    def __init__(self, settings):
        self.min_delay = settings.getfloat("DOWNLOAD_DELAY", 3)
        self.max_delay = settings.getfloat("AUTOTHROTTLE_MAX_DELAY", 8)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_request(self, request: Request, spider: Spider):
        """Add random delay to each request"""
        if not request.meta.get("dont_delay", False):
            # Random delay between min and max
            delay = random.uniform(self.min_delay, self.max_delay)
            time.sleep(delay)
            spider.logger.debug(f"Delayed {request.url} for {delay:.2f} seconds")


class RefererMiddleware:
    """
    Middleware to set proper Referer header for requests
    """

    def process_request(self, request: Request, spider: Spider):
        """Set Referer header for detail page requests"""
        if not request.headers.get("Referer"):
            # Set referer to the search page for detail requests
            if "item" in request.url or "auction" in request.url:
                referer = spider.settings.get("XIANYU_SEARCH_URL", "https://www.goofish.com/search")
                request.headers["Referer"] = referer
            else:
                request.headers["Referer"] = "https://www.goofish.com/"


class ProxyMiddleware:
    """
    Optional middleware for proxy rotation (if configured)
    """

    def __init__(self, settings):
        self.proxy_list = settings.getlist("PROXY_LIST", [])
        self.enabled = len(self.proxy_list) > 0

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_request(self, request: Request, spider: Spider):
        """Add proxy to request if proxy list is configured"""
        if self.enabled and not request.meta.get("dont_proxy"):
            proxy = random.choice(self.proxy_list)
            request.meta["proxy"] = proxy
            spider.logger.debug(f"Using proxy {proxy} for {request.url}")
