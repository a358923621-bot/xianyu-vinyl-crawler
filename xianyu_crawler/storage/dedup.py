"""
Deduplication utilities for Xianyu crawler
"""

import hashlib
from pathlib import Path
from typing import Set, List, Optional

from loguru import logger


class DeduplicationManager:
    """
    Manages deduplication of scraped items
    """

    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Files for storing seen IDs and hashes
        self.seen_ids_file = self.cache_dir / "seen_products.txt"
        self.seen_hashes_file = self.cache_dir / "seen_hashes.txt"

        # In-memory sets for quick lookup
        self.seen_ids: Set[str] = set()
        self.seen_hashes: Set[str] = set()

        # Load existing data
        self._load_from_disk()

    def _load_from_disk(self):
        """Load seen IDs and hashes from disk"""
        # Load seen IDs
        if self.seen_ids_file.exists():
            try:
                with open(self.seen_ids_file, "r", encoding="utf-8") as f:
                    self.seen_ids = set(line.strip() for line in f if line.strip())
                logger.info(f"Loaded {len(self.seen_ids)} seen product IDs")
            except Exception as e:
                logger.error(f"Error loading seen IDs: {e}")

        # Load seen hashes
        if self.seen_hashes_file.exists():
            try:
                with open(self.seen_hashes_file, "r", encoding="utf-8") as f:
                    self.seen_hashes = set(line.strip() for line in f if line.strip())
                logger.info(f"Loaded {len(self.seen_hashes)} seen content hashes")
            except Exception as e:
                logger.error(f"Error loading seen hashes: {e}")

    def save_seen_id(self, product_id: str):
        """Add a product ID to the seen set and save to disk"""
        if product_id in self.seen_ids:
            return

        self.seen_ids.add(product_id)

        try:
            with open(self.seen_ids_file, "a", encoding="utf-8") as f:
                f.write(f"{product_id}\n")
        except Exception as e:
            logger.error(f"Error saving seen ID: {e}")

    def save_seen_hash(self, content_hash: str):
        """Add a content hash to the seen set and save to disk"""
        if content_hash in self.seen_hashes:
            return

        self.seen_hashes.add(content_hash)

        try:
            with open(self.seen_hashes_file, "a", encoding="utf-8") as f:
                f.write(f"{content_hash}\n")
        except Exception as e:
            logger.error(f"Error saving seen hash: {e}")

    def load_seen_ids(self) -> Set[str]:
        """Get all seen product IDs"""
        return self.seen_ids.copy()

    def load_seen_hashes(self) -> Set[str]:
        """Get all seen content hashes"""
        return self.seen_hashes.copy()

    def is_seen_id(self, product_id: str) -> bool:
        """Check if a product ID has been seen"""
        return product_id in self.seen_ids

    def is_seen_hash(self, content_hash: str) -> bool:
        """Check if a content hash has been seen"""
        return content_hash in self.seen_hashes

    def generate_content_hash(self, item: dict) -> str:
        """
        Generate a content hash for an item based on title and price

        Args:
            item: Item dictionary

        Returns:
            MD5 hash of the content
        """
        # Create a string from key fields
        content_str = f"{item.get('title', '')}|{item.get('price', '')}|{item.get('seller_name', '')}"

        # Generate MD5 hash
        return hashlib.md5(content_str.encode("utf-8")).hexdigest()

    def clear_old_entries(self, days: int = 30):
        """
        Clear entries older than specified days

        Args:
            days: Number of days to keep entries
        """
        # This is a simplified version - in production, you'd want to store timestamps
        logger.warning("Clear old entries not fully implemented - would require storing timestamps")
        pass

    def get_stats(self) -> dict:
        """Get statistics about deduplication data"""
        return {
            "seen_ids_count": len(self.seen_ids),
            "seen_hashes_count": len(self.seen_hashes),
            "seen_ids_file": str(self.seen_ids_file),
            "seen_hashes_file": str(self.seen_hashes_file),
        }


class BloomFilter:
    """
    Simple Bloom filter implementation for memory-efficient deduplication

    Note: This is a basic implementation. For production use with large datasets,
    consider using a library like pybloom-live or Redis Bloom filters.
    """

    def __init__(self, size: int = 1000000, hash_count: int = 7):
        """
        Initialize Bloom filter

        Args:
            size: Size of the bit array
            hash_count: Number of hash functions to use
        """
        self.size = size
        self.hash_count = hash_count
        self.bit_array = [0] * size

    def _hashes(self, item: str) -> List[int]:
        """Generate hash values for an item"""
        hashes = []
        for i in range(self.hash_count):
            # Combine item with index to create different hash values
            hash_input = f"{item}{i}".encode("utf-8")
            hash_value = int(hashlib.sha256(hash_input).hexdigest(), 16)
            hashes.append(hash_value % self.size)
        return hashes

    def add(self, item: str):
        """Add an item to the filter"""
        for index in self._hashes(item):
            self.bit_array[index] = 1

    def contains(self, item: str) -> bool:
        """Check if an item is in the filter"""
        return all(self.bit_array[index] for index in self._hashes(item))


def filter_duplicates(items: List[dict], key: str = "product_id") -> List[dict]:
    """
    Filter duplicate items from a list

    Args:
        items: List of item dictionaries
        key: Key to use for deduplication

    Returns:
        List of unique items
    """
    seen = set()
    unique_items = []

    for item in items:
        item_key = item.get(key)
        if item_key and item_key not in seen:
            seen.add(item_key)
            unique_items.append(item)

    filtered_count = len(items) - len(unique_items)
    if filtered_count > 0:
        logger.info(f"Filtered out {filtered_count} duplicate items")

    return unique_items


def merge_and_deduplicate(
    existing_items: List[dict], new_items: List[dict], key: str = "product_id"
) -> List[dict]:
    """
    Merge two lists of items and remove duplicates

    Args:
        existing_items: Existing item list
        new_items: New items to add
        key: Key to use for deduplication

    Returns:
        Merged list with unique items
    """
    # Create a map of existing items
    existing_map = {item.get(key): item for item in existing_items if item.get(key)}

    # Add new items (overwriting existing ones with same key)
    for item in new_items:
        if item.get(key):
            existing_map[item[key]] = item

    return list(existing_map.values())
