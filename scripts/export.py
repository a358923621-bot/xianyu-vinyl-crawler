"""
Export script for Xianyu crawler data

Provides CLI for exporting scraped data to various formats
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger

from xianyu_crawler.settings import JSON_OUTPUT_DIR
from xianyu_crawler.storage.json_export import JsonExporter
from xianyu_crawler.storage.dedup import filter_duplicates, merge_and_deduplicate


def export_latest():
    """Export latest data to JSON"""
    exporter = JsonExporter(str(JSON_OUTPUT_DIR))
    stats = exporter.get_stats()

    print("\n" + "=" * 60)
    print("  Xianyu Crawler - Latest Export")
    print("=" * 60)

    if stats["latest_file"]:
        latest_path = stats["latest_file"]["path"]
        modified = stats["latest_file"]["modified"]
        size = stats["latest_file"]["size_bytes"]

        print(f"\nLatest export file: {latest_path}")
        print(f"Modified: {modified}")
        print(f"Size: {size:,} bytes")

        # Show preview
        with open(latest_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        print(f"\nTotal items: {data.get('total', 0)}")
        print(f"Export time: {data.get('export_time', 'N/A')}")

        if data.get("data"):
            print("\nPreview of first 3 items:")
            for i, item in enumerate(data["data"][:3], 1):
                print(f"\n  {i}. {item.get('title', 'N/A')}")
                print(f"     Price: ¥{item.get('price', 0)}")
                print(f"     Seller: {item.get('seller_name', 'N/A')}")
    else:
        print("\nNo export files found.")

    print("=" * 60 + "\n")


def export_filtered(min_price: float = None, max_price: float = None, min_want_count: int = None):
    """Export filtered data"""
    exporter = JsonExporter(str(JSON_OUTPUT_DIR))

    # Get latest data
    stats = exporter.get_stats()
    if not stats["latest_file"]:
        print("No data to export")
        return

    with open(stats["latest_file"]["path"], "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("data", [])

    # Apply filters
    filtered_items = items
    if min_price is not None:
        filtered_items = [i for i in filtered_items if i.get("price", 0) >= min_price]
    if max_price is not None:
        filtered_items = [i for i in filtered_items if i.get("price", float("inf")) <= max_price]
    if min_want_count is not None:
        filtered_items = [i for i in filtered_items if i.get("want_count", 0) >= min_want_count]

    # Export
    output_path = exporter.export_filtered(
        items,
        min_price=min_price,
        max_price=max_price,
        min_want_count=min_want_count,
    )

    print(f"\nExported {len(filtered_items)} filtered items to: {output_path}")
    print(f"  (from {len(items)} total items)")


def export_stats():
    """Export statistics"""
    exporter = JsonExporter(str(JSON_OUTPUT_DIR))
    stats = exporter.get_stats()

    print("\n" + "=" * 60)
    print("  Xianyu Crawler - Statistics")
    print("=" * 60)

    print(f"\nOutput directory: {stats['output_dir']}")
    print(f"Total files: {stats['total_files']}")

    if stats["daily_files"]:
        print(f"\nDaily export files: {len(stats['daily_files'])}")
        for file_path in stats["daily_files"][-7:]:  # Last 7 days
            print(f"  - {Path(file_path).name}")

    # Calculate aggregate stats from all files
    total_items = 0
    all_items = []

    for json_file in Path(stats["output_dir"]).glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                file_items = data.get("data", [])
                total_items += len(file_items)
                all_items.extend(file_items)
        except Exception as e:
            logger.warning(f"Error reading {json_file}: {e}")

    print(f"\nTotal items across all files: {total_items}")

    # Remove duplicates
    unique_items = filter_duplicates(all_items)
    print(f"Unique items (after deduplication): {len(unique_items)}")

    if unique_items:
        # Calculate statistics
        prices = [item.get("price", 0) for item in unique_items if item.get("price")]

        if prices:
            print(f"\nPrice statistics:")
            print(f"  Min: ¥{min(prices):.2f}")
            print(f"  Max: ¥{max(prices):.2f}")
            print(f"  Avg: ¥{sum(prices) / len(prices):.2f}")

        # Top items by want count
        top_wanted = sorted(unique_items, key=lambda x: x.get("want_count", 0), reverse=True)[:5]
        print(f"\nTop 5 most wanted items:")
        for i, item in enumerate(top_wanted, 1):
            print(f"  {i}. {item.get('title', 'N/A')}")
            print(f"     Wanted: {item.get('want_count', 0)} | Price: ¥{item.get('price', 0)}")

    print("=" * 60 + "\n")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Xianyu Crawler - Export Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Show latest export
  python scripts/export.py --latest

  # Export items between 100-500 yuan
  python scripts/export.py --filter --min-price 100 --max-price 500

  # Export items with at least 10 wants
  python scripts/export.py --filter --min-want-count 10

  # Show statistics
  python scripts/export.py --stats
        """,
    )

    parser.add_argument("--latest", action="store_true", help="Show latest export")
    parser.add_argument("--filter", action="store_true", help="Export filtered data")
    parser.add_argument("--min-price", type=float, help="Minimum price filter")
    parser.add_argument("--max-price", type=float, help="Maximum price filter")
    parser.add_argument("--min-want-count", type=int, help="Minimum want count filter")
    parser.add_argument("--stats", action="store_true", help="Show export statistics")

    args = parser.parse_args()

    if args.latest:
        export_latest()
    elif args.filter:
        export_filtered(args.min_price, args.max_price, args.min_want_count)
    elif args.stats:
        export_stats()
    else:
        # Default: show latest
        export_latest()


if __name__ == "__main__":
    main()
