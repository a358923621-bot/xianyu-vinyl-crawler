"""
Main spider for Xianyu vinyl record crawler

Crawls product listings and details from Xianyu (Idle Fish) platform
"""

import asyncio
from datetime import datetime
from typing import Generator, Optional

from loguru import logger
from scrapy import Request, Spider
from scrapy.http import Response
from scrapy_playwright.page import PageMethod

from xianyu_crawler.items import VinylProductItem
from xianyu_crawler.settings import (
    XIANYU_BASE_URL,
    XIANYU_SEARCH_URL,
    SEARCH_KEYWORDS,
    MAX_PAGES_INCREMENTAL,
    MAX_PAGES_FULL,
)


class VinylSpider(Spider):
    """
    Spider for crawling vinyl record listings from Xianyu
    """

    name = "vinyl_spider"
    custom_settings = {
        "PLAYWRIGHT_LAUNCH_OPTIONS": {
            "headless": True,
        },
    }

    def __init__(self, crawl_type="incremental", *args, **kwargs):
        """
        Initialize spider

        Args:
            crawl_type: Type of crawl - "incremental" (default) or "full"
        """
        super().__init__(*args, **kwargs)
        self.crawl_type = crawl_type
        self.max_pages = MAX_PAGES_FULL if crawl_type == "full" else MAX_PAGES_INCREMENTAL
        self.keywords = SEARCH_KEYWORDS

        logger.info(f"VinylSpider initialized: {crawl_type} crawl, max_pages={self.max_pages}")

    def start_requests(self) -> Generator[Request, None, None]:
        """
        Generate initial search requests
        """
        for keyword in self.keywords:
            # Encode keyword for URL
            encoded_keyword = keyword.replace(" ", "+")

            # Construct search URL
            search_url = f"{XIANYU_SEARCH_URL}?q={encoded_keyword}"

            logger.info(f"Starting search for keyword: {keyword}")

            yield Request(
                url=search_url,
                callback=self.parse_search_results,
                meta={
                    "keyword": keyword,
                    "page": 1,
                    "playwright": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_selector", "div.search-items", timeout=30000),
                        PageMethod("wait_for_timeout", 3000),  # Wait for dynamic content
                    ],
                },
            )

    def parse_search_results(self, response: Response) -> Generator[Request, None, None]:
        """
        Parse search results page and extract product links

        Args:
            response: Scrapy response object

        Yields:
            Requests for product detail pages
        """
        current_page = response.meta.get("page", 1)
        keyword = response.meta.get("keyword", "")

        logger.info(f"Parsing search results: {keyword} - Page {current_page}")

        # Extract product items from search results
        # Note: These selectors are examples and may need to be updated based on actual Xianyu page structure
        product_cards = response.css("div.search-item, div.Card--mainCard, div.SellerItem--item")

        logger.info(f"Found {len(product_cards)} products on page {current_page}")

        for card in product_cards:
            try:
                # Extract product link
                link = card.css("a::attr(href)").get()

                if not link:
                    continue

                # Make absolute URL
                if link.startswith("/"):
                    link = f"{XIANYU_BASE_URL}{link}"

                # Extract basic info
                title = card.css("a::attr(title), .title::text").get()
                price_text = card.css(".price::text, .Price--price::text").get()

                # Extract product ID from URL
                product_id = self._extract_product_id(link)

                if not product_id:
                    logger.warning(f"Could not extract product ID from: {link}")
                    continue

                logger.debug(f"Found product: {title} ({product_id})")

                # Yield request for detail page
                yield Request(
                    url=link,
                    callback=self.parse_product_detail,
                    meta={
                        "product_id": product_id,
                        "title": title,
                        "price_text": price_text,
                        "keyword": keyword,
                        "playwright": True,
                        "playwright_page_methods": [
                            PageMethod("wait_for_selector", "div.product-detail, .Item--main", timeout=30000),
                            PageMethod("wait_for_timeout", 2000),
                        ],
                    },
                )

            except Exception as e:
                logger.error(f"Error parsing product card: {e}")
                continue

        # Handle pagination
        if current_page < self.max_pages:
            # Check if there's a next page
            next_page = response.css("a.next::attr(href), .pagination .next::attr(href)").get()

            if next_page:
                if next_page.startswith("/"):
                    next_page = f"{XIANYU_BASE_URL}{next_page}"

                logger.info(f"Following to next page: {current_page + 1}")

                yield Request(
                    url=next_page,
                    callback=self.parse_search_results,
                    meta={
                        "keyword": keyword,
                        "page": current_page + 1,
                        "playwright": True,
                        "playwright_page_methods": [
                            PageMethod("wait_for_selector", "div.search-items", timeout=30000),
                            PageMethod("wait_for_timeout", 3000),
                        ],
                    },
                )

    def parse_product_detail(self, response: Response) -> Optional[VinylProductItem]:
        """
        Parse product detail page

        Args:
            response: Scrapy response object

        Returns:
            VinylProductItem or None
        """
        product_id = response.meta.get("product_id")
        title = response.meta.get("title")
        price_text = response.meta.get("price_text")

        try:
            item = VinylProductItem()

            # Basic info
            item["product_id"] = product_id
            item["link"] = response.url
            item["crawled_at"] = datetime.now()
            item["is_available"] = True

            # Extract title
            if not title:
                title = response.css(".item-title, .Title--text, h1::text").get()
            item["title"] = title.strip() if title else ""

            # Extract and parse price
            price = self._parse_price(response.css(".price, .Price--price, .PriceAmount::text").getall())
            if not price and price_text:
                price = self._parse_price([price_text])
            item["price"] = price

            # Extract seller info
            seller_name = response.css(".seller-name, .SellerInfo--nick, .user-nick::text").get()
            seller_credit = response.css(".seller-credit, .credit-score::text").get()
            seller_id = response.css(".seller-id::attr(data-id)").get()

            item["seller_name"] = seller_name.strip() if seller_name else None
            item["seller_credit"] = self._parse_int(seller_credit)
            item["seller_id"] = seller_id

            # Extract seller location
            seller_location = response.css(".seller-location, .Location--text::text").get()
            item["seller_location"] = seller_location.strip() if seller_location else None

            # Extract product condition
            condition = response.css(".condition, .Condition--text::text").get()
            item["condition"] = condition.strip() if condition else None

            # Extract trade type
            trade_type = response.css(".trade-type, .TradeMethod--text::text").get()
            item["trade_type"] = trade_type.strip() if trade_type else None

            # Extract location
            location = response.css(".location, .Location--address::text").get()
            item["location"] = location.strip() if location else None

            # Extract publish time
            publish_time = response.css(".publish-time, .Time--text::text").get()
            item["publish_time"] = publish_time.strip() if publish_time else None

            # Extract engagement metrics
            view_count = response.css(".view-count, .ViewCount--text::text").get()
            want_count = response.css(".want-count, .WantCount--text::text").get()

            item["view_count"] = self._parse_int(view_count)
            item["want_count"] = self._parse_int(want_count)

            # Extract images
            images = response.css(".product-images img::attr(src), .Image--image::attr(src)").getall()
            item["images"] = [img for img in images if img]

            # Extract description
            description = response.css(".description, .Description--text::text").getall()
            item["description"] = " ".join(d.strip() for d in description if d.strip()) if description else None

            # Extract tags
            tags = response.css(".tags .tag::text, .Tag--text::text").getall()
            item["tags"] = [tag.strip() for tag in tags if tag.strip()]

            logger.info(f"Successfully parsed product: {product_id} - {item.get('title')}")

            yield item

        except Exception as e:
            logger.error(f"Error parsing product detail for {product_id}: {e}")
            return None

    def _extract_product_id(self, url: str) -> Optional[str]:
        """
        Extract product ID from URL

        Args:
            url: Product URL

        Returns:
            Product ID or None
        """
        import re

        patterns = [
            r"item\.htm\?id=(\d+)",
            r"item/(\d+)",
            r"id=(\d+)",
            r"/(\d+)\.htm",
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        return None

    def _parse_price(self, price_elements) -> float:
        """
        Parse price from list of price elements

        Args:
            price_elements: List of price text elements

        Returns:
            Parsed price as float
        """
        import re

        for elem in price_elements:
            if elem:
                # Remove currency symbols and extract number
                price_str = elem.replace("¥", "").replace("$", "").replace(",", "").strip()
                match = re.search(r"(\d+\.?\d*)", price_str)
                if match:
                    try:
                        return round(float(match.group(1)), 2)
                    except ValueError:
                        continue

        return 0.0

    def _parse_int(self, value: Optional[str]) -> Optional[int]:
        """
        Parse integer from string value

        Args:
            value: String value to parse

        Returns:
            Parsed integer or None
        """
        if not value:
            return None

        import re

        match = re.search(r"(\d+)", str(value))
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass

        return None


# Manual testing function
async def test_spider():
    """Test function for spider development"""
    from scrapy.crawler import CrawlerProcess

    settings = {
        "PLAYWRIGHT_LAUNCH_OPTIONS": {
            "headless": False,
        },
        "LOG_LEVEL": "DEBUG",
    }

    process = CrawlerProcess(settings=settings)
    process.crawl(VinylSpider, crawl_type="incremental")
    process.start()


if __name__ == "__main__":
    # Run spider using Scrapy CLI
    import scrapy.cmdline

    scrapy.cmdline.execute(["scrapy", "crawl", "vinyl_spider", "-a", "crawl_type=incremental"])
