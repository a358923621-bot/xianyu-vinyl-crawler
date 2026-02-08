"""
Anti-spider utilities for Xianyu crawler
"""

import random
import time
from typing import List


def random_delay(min_seconds: float = 3.0, max_seconds: float = 8.0):
    """
    Sleep for a random amount of time

    Args:
        min_seconds: Minimum delay in seconds
        max_seconds: Maximum delay in seconds
    """
    delay = random.uniform(min_seconds, max_seconds)
    time.sleep(delay)
    return delay


def get_random_user_agent() -> str:
    """
    Get a random user agent string

    Returns:
        User agent string
    """
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]
    return random.choice(user_agents)


def get_random_headers() -> dict:
    """
    Get random request headers

    Returns:
        Dictionary of headers
    """
    return {
        "User-Agent": get_random_user_agent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }


def exponential_backoff(attempt: int, base_delay: float = 2.0, max_delay: float = 60.0) -> float:
    """
    Calculate exponential backoff delay

    Args:
        attempt: Current attempt number (starting from 0)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds

    Returns:
        Delay in seconds
    """
    delay = min(base_delay * (2**attempt), max_delay)
    return delay + random.uniform(0, 1)


def is_blocked_response(response_text: str) -> bool:
    """
    Check if response indicates blocking by anti-spider measures

    Args:
        response_text: Response HTML/text

    Returns:
        True if blocked, False otherwise
    """
    block_indicators = [
        "验证码",
        "captcha",
        "访问频繁",
        "access denied",
        "blocked",
        "请求过于频繁",
        "系统繁忙",
        "请稍后再试",
    ]

    response_lower = response_text.lower()

    for indicator in block_indicators:
        if indicator.lower() in response_lower:
            return True

    return False


def rotate_proxy(proxies: List[str]) -> str:
    """
    Rotate through a list of proxy servers

    Args:
        proxies: List of proxy URLs

    Returns:
        Selected proxy URL
    """
    if not proxies:
        return None
    return random.choice(proxies)
