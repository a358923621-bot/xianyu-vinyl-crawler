"""
Data validation utilities for Xianyu crawler
"""

import re
from typing import Optional

from pydantic import ValidationError
from loguru import logger

from xianyu_crawler.items import VinylProductModel


def validate_product_item(item: dict) -> VinylProductModel:
    """
    Validate a product item using Pydantic model

    Args:
        item: Product item dictionary

    Returns:
        Validated VinylProductModel instance

    Raises:
        ValidationError: If validation fails
    """
    try:
        # Clean and prepare data
        cleaned_data = clean_item_data(item)

        # Validate using Pydantic model
        validated_item = VinylProductModel(**cleaned_data)

        return validated_item

    except ValidationError as e:
        logger.error(f"Validation error for item: {e}")
        raise


def clean_item_data(item: dict) -> dict:
    """
    Clean and normalize item data

    Args:
        item: Raw item dictionary

    Returns:
        Cleaned item dictionary
    """
    cleaned = {}

    # Required fields
    cleaned["product_id"] = str(item.get("product_id", ""))
    cleaned["title"] = str(item.get("title", "")).strip()
    cleaned["price"] = parse_price(item.get("price", 0))
    cleaned["link"] = str(item.get("link", ""))

    # Optional fields - only include if present and valid
    if item.get("seller_name"):
        cleaned["seller_name"] = str(item.get("seller_name")).strip()

    if item.get("seller_credit") is not None:
        cleaned["seller_credit"] = parse_int(item.get("seller_credit"))

    if item.get("seller_id"):
        cleaned["seller_id"] = str(item.get("seller_id"))

    if item.get("seller_location"):
        cleaned["seller_location"] = str(item.get("seller_location")).strip()

    if item.get("description"):
        cleaned["description"] = str(item.get("description")).strip()

    if item.get("condition"):
        cleaned["condition"] = str(item.get("condition")).strip()

    if item.get("trade_type"):
        cleaned["trade_type"] = str(item.get("trade_type")).strip()

    if item.get("location"):
        cleaned["location"] = str(item.get("location")).strip()

    if item.get("publish_time"):
        cleaned["publish_time"] = str(item.get("publish_time")).strip()

    if item.get("view_count") is not None:
        cleaned["view_count"] = parse_int(item.get("view_count"))

    if item.get("want_count") is not None:
        cleaned["want_count"] = parse_int(item.get("want_count"))

    if item.get("images"):
        images = item.get("images")
        if isinstance(images, list):
            cleaned["images"] = [str(url) for url in images if url]
        elif isinstance(images, str):
            cleaned["images"] = [images]

    if item.get("tags"):
        tags = item.get("tags")
        if isinstance(tags, list):
            cleaned["tags"] = [str(tag) for tag in tags if tag]
        elif isinstance(tags, str):
            cleaned["tags"] = [tags]

    return cleaned


def parse_price(price) -> float:
    """
    Parse price from various formats

    Args:
        price: Price value (string, int, float)

    Returns:
        Parsed price as float
    """
    if isinstance(price, (int, float)):
        return round(float(price), 2)

    if isinstance(price, str):
        # Remove currency symbols and whitespace
        price_str = price.strip()
        price_str = price_str.replace("¥", "").replace("$", "").replace(",", "").strip()

        # Extract number using regex
        match = re.search(r"(\d+\.?\d*)", price_str)
        if match:
            return round(float(match.group(1)), 2)

    return 0.0


def parse_int(value) -> Optional[int]:
    """
    Parse integer from various formats

    Args:
        value: Value to parse

    Returns:
        Parsed integer or None
    """
    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value)

    if isinstance(value, str):
        # Extract number using regex
        match = re.search(r"(\d+)", value)
        if match:
            return int(match.group(1))

    return None


def validate_url(url: str) -> bool:
    """
    Validate if a string is a valid URL

    Args:
        url: URL string to validate

    Returns:
        True if valid URL, False otherwise
    """
    if not url or not isinstance(url, str):
        return False

    url_pattern = re.compile(
        r"^(https?:\/\/)"  # http:// or https://
        r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain
        r"localhost|"  # localhost
        r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # or ip
        r"(?:\/[^\/\s]*)*$",
        re.IGNORECASE,
    )

    return bool(url_pattern.match(url))


def extract_product_id(url: str) -> Optional[str]:
    """
    Extract product ID from Xianyu URL

    Args:
        url: Product URL

    Returns:
        Product ID or None
    """
    if not url:
        return None

    # Try to extract ID from various URL patterns
    patterns = [
        r"item\.htm\?id=(\d+)",  # Standard pattern
        r"item/(\d+)",  # Alternative pattern
        r"id=(\d+)",  # Generic pattern
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing invalid characters

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    # Remove or replace invalid characters
    invalid_chars = r'[<>:"/\\|?*]'
    sanitized = re.sub(invalid_chars, "_", filename)

    # Remove leading/trailing spaces and dots
    sanitized = sanitized.strip(". ")

    # Limit length
    if len(sanitized) > 200:
        sanitized = sanitized[:200]

    return sanitized or "unnamed"
