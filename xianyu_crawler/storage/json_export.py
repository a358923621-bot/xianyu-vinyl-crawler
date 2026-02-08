"""
JSON export functionality for Xianyu crawler
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from loguru import logger


class JsonExporter:
    """
    Handles exporting scraped data to JSON format
    """

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.current_data: List[Dict[str, Any]] = []

    def export_items(self, items: List[Dict[str, Any]]) -> str:
        """
        Export items to a JSON file

        Args:
            items: List of item dictionaries

        Returns:
            Path to the exported file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"vinyl_products_{timestamp}.json"
        output_path = self.output_dir / filename

        try:
            # Create export data structure
            export_data = {
                "export_time": datetime.now().isoformat(),
                "total": len(items),
                "data": items,
            }

            # Write to file
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Exported {len(items)} items to {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error exporting items: {e}")
            raise

    def append_to_file(self, items: List[Dict[str, Any]], filename: str = "latest.json"):
        """
        Append items to an existing JSON file

        Args:
            items: List of item dictionaries
            filename: Name of the file to append to
        """
        output_path = self.output_dir / filename

        try:
            # Load existing data
            existing_data = []
            if output_path.exists():
                with open(output_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f).get("data", [])

            # Combine existing and new data
            combined_data = existing_data + items

            # Create export data structure
            export_data = {
                "export_time": datetime.now().isoformat(),
                "total": len(combined_data),
                "data": combined_data,
            }

            # Write to file
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Appended {len(items)} items to {output_path} (total: {len(combined_data)})")

        except Exception as e:
            logger.error(f"Error appending items: {e}")
            raise

    def update_latest_file(self, items: List[Dict[str, Any]]):
        """
        Update the 'latest.json' file with current data

        Args:
            items: List of item dictionaries
        """
        self.append_to_file(items, "latest.json")

    def create_daily_export(self, items: List[Dict[str, Any]]) -> str:
        """
        Create a daily export file named with the current date

        Args:
            items: List of item dictionaries

        Returns:
            Path to the exported file
        """
        date_str = datetime.now().strftime("%Y%m%d")
        filename = f"daily_export_{date_str}.json"
        output_path = self.output_dir / filename

        try:
            # Load existing daily data
            existing_items = []
            if output_path.exists():
                with open(output_path, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
                    existing_items = existing_data.get("data", [])

            # Merge with new items (dedup by product_id)
            seen_ids = {item.get("product_id") for item in existing_items if item.get("product_id")}
            new_items = [item for item in items if item.get("product_id") not in seen_ids]
            merged_items = existing_items + new_items

            # Create export data structure
            export_data = {
                "export_time": datetime.now().isoformat(),
                "total": len(merged_items),
                "data": merged_items,
            }

            # Write to file
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Created daily export: {output_path} ({len(merged_items)} total items)")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error creating daily export: {e}")
            raise

    def export_filtered(
        self,
        items: List[Dict[str, Any]],
        min_price: float = None,
        max_price: float = None,
        min_want_count: int = None,
    ) -> str:
        """
        Export items that match the specified criteria

        Args:
            items: List of item dictionaries
            min_price: Minimum price filter
            max_price: Maximum price filter
            min_want_count: Minimum want count filter

        Returns:
            Path to the exported file
        """
        filtered_items = items

        # Apply filters
        if min_price is not None:
            filtered_items = [i for i in filtered_items if i.get("price", 0) >= min_price]

        if max_price is not None:
            filtered_items = [i for i in filtered_items if i.get("price", float("inf")) <= max_price]

        if min_want_count is not None:
            filtered_items = [i for i in filtered_items if i.get("want_count", 0) >= min_want_count]

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"filtered_products_{timestamp}.json"
        output_path = self.output_dir / filename

        try:
            # Create export data structure
            export_data = {
                "export_time": datetime.now().isoformat(),
                "filters": {
                    "min_price": min_price,
                    "max_price": max_price,
                    "min_want_count": min_want_count,
                },
                "total": len(filtered_items),
                "data": filtered_items,
            }

            # Write to file
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Exported {len(filtered_items)} filtered items to {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Error exporting filtered items: {e}")
            raise

    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about exported files

        Returns:
            Dictionary with export statistics
        """
        stats = {
            "output_dir": str(self.output_dir),
            "total_files": 0,
            "latest_file": None,
            "daily_files": [],
        }

        try:
            # List all JSON files
            json_files = list(self.output_dir.glob("*.json"))
            stats["total_files"] = len(json_files)

            if json_files:
                # Find latest file
                latest_file = max(json_files, key=lambda f: f.stat().st_mtime)
                stats["latest_file"] = {
                    "path": str(latest_file),
                    "modified": datetime.fromtimestamp(latest_file.stat().st_mtime).isoformat(),
                    "size_bytes": latest_file.stat().st_size,
                }

                # Find daily export files
                daily_files = [f for f in json_files if f.name.startswith("daily_export_")]
                stats["daily_files"] = sorted([str(f) for f in daily_files])

        except Exception as e:
            logger.error(f"Error getting stats: {e}")

        return stats


def main():
    """CLI entry point for JSON export"""
    import sys

    # Example usage
    output_dir = "output/json"
    exporter = JsonExporter(output_dir)

    # Get stats
    stats = exporter.get_stats()
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
