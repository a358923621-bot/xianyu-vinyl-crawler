"""
Data model definitions for Xianyu vinyl record crawler
"""

import scrapy
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class VinylProductItem(scrapy.Item):
    """
    Data model for a vinyl record product from Xianyu
    """
    # Basic product information
    product_id = scrapy.Field()  # str: Unique product ID
    title = scrapy.Field()  # str: Product title
    price = scrapy.Field()  # float: Product price
    link = scrapy.Field()  # str: Product URL

    # Seller information
    seller_name = scrapy.Field()  # str: Seller nickname
    seller_credit = scrapy.Field()  # int: Seller credit score
    seller_id = scrapy.Field()  # str: Seller unique ID
    seller_location = scrapy.Field()  # str: Seller location

    # Product details
    description = scrapy.Field()  # str: Product description
    condition = scrapy.Field()  # str: Product condition (e.g., "99新")
    trade_type = scrapy.Field()  # str: Trade type (e.g., "同城交易", "快递")
    location = scrapy.Field()  # str: Product location

    # Engagement metrics
    publish_time = scrapy.Field()  # str: Publish time
    view_count = scrapy.Field()  # int: View count
    want_count = scrapy.Field()  # int: Number of people who want this item

    # Media
    images = scrapy.Field()  # List[str]: List of image URLs

    # Metadata
    crawled_at = scrapy.Field()  # datetime: When this item was crawled
    is_available = scrapy.Field()  # bool: Whether the item is still available

    # Additional attributes
    tags = scrapy.Field()  # List[str]: Tags associated with the product


class VinylProductModel(BaseModel):
    """
    Pydantic model for validation and serialization
    """
    product_id: str = Field(..., description="Unique product ID")
    title: str = Field(..., description="Product title")
    price: float = Field(..., ge=0, description="Product price")
    link: str = Field(..., description="Product URL")

    seller_name: Optional[str] = Field(None, description="Seller nickname")
    seller_credit: Optional[int] = Field(None, ge=0, le=100, description="Seller credit score")
    seller_id: Optional[str] = Field(None, description="Seller unique ID")
    seller_location: Optional[str] = Field(None, description="Seller location")

    description: Optional[str] = Field(None, description="Product description")
    condition: Optional[str] = Field(None, description="Product condition")
    trade_type: Optional[str] = Field(None, description="Trade type")
    location: Optional[str] = Field(None, description="Product location")

    publish_time: Optional[str] = Field(None, description="Publish time")
    view_count: Optional[int] = Field(None, ge=0, description="View count")
    want_count: Optional[int] = Field(None, ge=0, description="Want count")

    images: List[str] = Field(default_factory=list, description="Image URLs")

    crawled_at: datetime = Field(default_factory=datetime.now, description="Crawl timestamp")
    is_available: bool = Field(True, description="Availability status")

    tags: List[str] = Field(default_factory=list, description="Product tags")

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        """Validate and clean price value"""
        if isinstance(v, str):
            # Remove currency symbols and convert
            v = float(v.replace("¥", "").replace(",", "").strip())
        return round(v, 2)

    @field_validator("view_count", "want_count", "seller_credit")
    @classmethod
    def validate_int_fields(cls, v: Optional[int]) -> Optional[int]:
        """Validate integer fields that might come as strings"""
        if v is None:
            return None
        if isinstance(v, str):
            try:
                # Extract number from string (e.g., "258次浏览" -> 258)
                import re
                match = re.search(r"\d+", v)
                if match:
                    return int(match.group())
            except (ValueError, AttributeError):
                return None
        return int(v) if v is not None else None

    def to_scrapy_item(self) -> VinylProductItem:
        """Convert to Scrapy Item"""
        item = VinylProductItem()
        for field_name in self.model_fields:
            value = getattr(self, field_name)
            if value is not None:
                item[field_name] = value
        return item

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON export"""
        data = self.model_dump(mode="json")
        data["crawled_at"] = self.crawled_at.isoformat()
        return data


class ExportDataModel(BaseModel):
    """
    Model for exported JSON data structure
    """
    export_time: str = Field(default_factory=lambda: datetime.now().isoformat())
    total: int = Field(..., ge=0, description="Total number of items")
    data: List[VinylProductModel] = Field(default_factory=list, description="List of products")

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON export"""
        return {
            "export_time": self.export_time,
            "total": self.total,
            "data": [item.to_dict() for item in self.data],
        }
