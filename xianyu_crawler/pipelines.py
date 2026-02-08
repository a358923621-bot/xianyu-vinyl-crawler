"""
Pipeline classes for processing scraped items

Includes deduplication, data validation, and JSON export
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Set

from loguru import logger
from pydantic import ValidationError

from xianyu_crawler.items import VinylProductItem, VinylProductModel, ExportDataModel
from xianyu_crawler.storage.dedup import DeduplicationManager
from xianyu_crawler.storage.json_export import JsonExporter
from xianyu_crawler.utils.validators import validate_product_item


class DeduplicationPipeline:
    """
    Pipeline to filter out duplicate items based on product_id
    """

    def __init__(self, cache_dir):
        self.cache_dir = Path(cache_dir)
        self.seen_ids: Set[str] = set()
        self.cache_file = self.cache_dir / "seen_products.txt"
        self.dedup_manager = None

    @classmethod
    def from_crawler(cls, crawler):
        cache_dir = crawler.settings.get("CACHE_DIR")
        return cls(cache_dir)

    def open_spider(self, spider):
        """Load existing product IDs from cache"""
        logger.info(f"Loading seen product IDs from {self.cache_file}")

        self.dedup_manager = DeduplicationManager(str(self.cache_dir))
        self.seen_ids = self.dedup_manager.load_seen_ids()

        logger.info(f"Loaded {len(self.seen_ids)} seen product IDs")

    def process_item(self, item: VinylProductItem, spider):
        """Check if item is duplicate"""
        product_id = item.get("product_id")

        if not product_id:
            logger.warning("Item missing product_id, skipping")
            return item

        if product_id in self.seen_ids:
            logger.debug(f"Duplicate item found: {product_id}")
            raise DropItem(f"Duplicate product_id: {product_id}")

        # Add to seen set
        self.seen_ids.add(product_id)
        self.dedup_manager.save_seen_id(product_id)

        return item

    def close_spider(self, spider):
        """Save seen product IDs to cache"""
        logger.info(f"Saving {len(self.seen_ids)} seen product IDs to {self.cache_file}")


class DataValidationPipeline:
    """
    Pipeline to validate scraped items using Pydantic models
    """

    def __init__(self):
        self.validation_errors = 0
        self.valid_items = 0

    def open_spider(self, spider):
        logger.info("Data validation pipeline started")

    def process_item(self, item: VinylProductItem, spider):
        """Validate item using Pydantic model"""
        try:
            # Convert to Pydantic model for validation
            validated_item = validate_product_item(item)

            # Update validation counters
            self.valid_items += 1

            return validated_item.to_scrapy_item()

        except ValidationError as e:
            self.validation_errors += 1
            logger.error(f"Validation error for item: {e}")
            raise DropItem(f"Validation error: {e}")

    def close_spider(self, spider):
        logger.info(f"Data validation complete: {self.valid_items} valid, {self.validation_errors} invalid")


class JsonExportPipeline:
    """
    Pipeline to export items to JSON format
    """

    def __init__(self, output_dir):
        self.output_dir = Path(output_dir)
        self.items_buffer = []
        self.exporter = None

    @classmethod
    def from_crawler(cls, crawler):
        output_dir = crawler.settings.get("JSON_OUTPUT_DIR")
        return cls(output_dir)

    def open_spider(self, spider):
        """Initialize JSON exporter"""
        logger.info(f"JSON export pipeline started, output to {self.output_dir}")

        self.exporter = JsonExporter(str(self.output_dir))
        self.items_buffer = []

    def process_item(self, item: VinylProductItem, spider):
        """Add item to buffer for batch export"""
        self.items_buffer.append(item)

        # Export in batches of 100 items
        if len(self.items_buffer) >= 100:
            self._export_batch()

        return item

    def _export_batch(self):
        """Export buffered items to JSON"""
        if not self.items_buffer:
            return

        logger.info(f"Exporting {len(self.items_buffer)} items to JSON")

        # Convert items to dict format
        items_data = []
        for item in self.items_buffer:
            try:
                # Convert to Pydantic model for serialization
                model = VinylProductModel(**dict(item))
                items_data.append(model.to_dict())
            except Exception as e:
                logger.warning(f"Error converting item to JSON: {e}")

        # Export using JsonExporter
        if items_data:
            self.exporter.export_items(items_data)

        # Clear buffer
        self.items_buffer = []

    def close_spider(self, spider):
        """Export remaining items in buffer"""
        logger.info("Closing JSON export pipeline")

        # Export any remaining items
        if self.items_buffer:
            self._export_batch()

        # Create final export with metadata
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_file = self.output_dir / f"final_export_{timestamp}.json"

        logger.info(f"Final export saved to {export_file}")


class FilterPipeline:
    """
    Pipeline to filter items based on criteria
    """

    def __init__(self, settings):
        self.min_price = settings.getfloat("FILTER_MIN_PRICE", 0)
        self.max_price = settings.getfloat("FILTER_MAX_PRICE", float("inf"))
        self.min_want_count = settings.getint("FILTER_MIN_WANT_COUNT", 0)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_item(self, item: VinylProductItem, spider):
        """Filter item based on criteria"""
        price = item.get("price", 0)
        want_count = item.get("want_count", 0)

        # Price filter
        if price < self.min_price or price > self.max_price:
            logger.debug(f"Item filtered by price: {price}")
            raise DropItem(f"Price out of range: {price}")

        # Want count filter
        if want_count < self.min_want_count:
            logger.debug(f"Item filtered by want count: {want_count}")
            raise DropItem(f"Want count too low: {want_count}")

        return item


class DropItem(Exception):
    """Exception raised when an item should be dropped"""
    pass
