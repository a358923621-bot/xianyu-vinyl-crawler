"""
Xianyu Vinyl Records Scraper using Selenium
"""
import json
import time
import pathlib
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# Output directory
OUTPUT_DIR = pathlib.Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# Xianyu search URL for vinyl records
SEARCH_URL = "https://www.goofish.com/search?q=黑胶唱片"


def setup_driver(headless=False):
    """Setup Chrome driver with options"""
    options = Options()
    if headless:
        options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

    # Use webdriver_manager to auto-download ChromeDriver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_window_size(1920, 1080)
    return driver


def extract_products(driver):
    """Extract product data from the page"""
    products = []

    # Get page text for analysis
    body_text = driver.find_element(By.TAG_NAME, "body").text
    print(f"Page body text length: {len(body_text)}")

    # Save page source for debugging
    with open(OUTPUT_DIR / "debug_page.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print("Page source saved to debug_page.html")

    # Also save the rendered text
    with open(OUTPUT_DIR / "page_text.txt", "w", encoding="utf-8") as f:
        f.write(body_text)
    print("Page text saved to page_text.txt")

    # Try multiple strategies to find products
    print("\n=== Strategy 1: Looking for links with item/product in href ===")
    all_links = driver.find_elements(By.TAG_NAME, "a")
    product_links = []
    for link in all_links:
        href = link.get_attribute("href")
        if href and ("/item/" in href or "itemId=" in href):
            product_links.append(link)

    print(f"Found {len(product_links)} product links")
    for i, link in enumerate(product_links[:10]):
        print(f"  Link {i}: {link.get_attribute('href')}")

    if product_links:
        print("\n=== Extracting from product links ===")
        for i, link in enumerate(product_links[:30]):
            try:
                product = {}
                product["link"] = link.get_attribute("href")

                # Get text from link or nearby elements
                link_text = link.text.strip()
                if link_text:
                    product["title"] = link_text

                # Look for price in parent/ancestor elements
                try:
                    parent = link.find_element(By.XPATH, "..")
                    parent_text = parent.text

                    # Extract price
                    import re
                    price_match = re.search(r'[¥￥]\s*(\d+\.?\d*)', parent_text)
                    if price_match:
                        product["price"] = price_match.group(0)

                    # If no title from link, get from parent
                    if not product.get("title"):
                        lines = [l.strip() for l in parent_text.split("\n") if l.strip()]
                        if lines:
                            product["title"] = lines[0]
                except:
                    pass

                if product.get("title"):
                    products.append(product)
                    print(f"Product {i}: {product.get('title', 'N/A')} - {product.get('price', 'N/A')}")

            except Exception as e:
                continue

    # If still no products, try looking at all divs with text containing prices
    if not products:
        print("\n=== Strategy 2: Looking for price elements ===")
        import re
        all_divs = driver.find_elements(By.TAG_NAME, "div")

        for div in all_divs[:100]:  # Check first 100 divs
            try:
                div_text = div.text.strip()
                if len(div_text) < 10 or len(div_text) > 500:
                    continue

                # Look for price pattern
                price_match = re.search(r'[¥￥]\s*(\d+\.?\d*)', div_text)
                if price_match:
                    product = {}
                    product["price"] = price_match.group(0)

                    # Extract title (first line that's not the price)
                    lines = [l.strip() for l in div_text.split("\n") if l.strip()]
                    for line in lines:
                        if not line.startswith("¥") and not line.startswith("￥") and len(line) > 3:
                            product["title"] = line
                            break

                    # Try to find link
                    try:
                        link = div.find_element(By.TAG_NAME, "a")
                        product["link"] = link.get_attribute("href")
                    except:
                        pass

                    if product.get("title"):
                        products.append(product)
                        print(f"Product: {product.get('title')} - {product.get('price')}")

                        if len(products) >= 20:
                            break
            except:
                continue

    return products


def main():
    """Main scraping function"""
    print("Starting Xianyu Vinyl Records Scraper...")
    print("=" * 50)

    # Setup driver (non-headless for debugging)
    driver = setup_driver(headless=False)

    try:
        print(f"Navigating to: {SEARCH_URL}")
        driver.get(SEARCH_URL)

        # Wait for page to load
        print("Waiting for page to load...")
        time.sleep(8)  # Give more time for React to render and load data

        # Wait for specific elements that indicate data has loaded
        print("Waiting for product data to load...")
        try:
            # Wait for any text content with price or items
            WebDriverWait(driver, 20).until(
                lambda d: "¥" in d.find_element(By.TAG_NAME, "body").text or
                         "商品" in d.find_element(By.TAG_NAME, "body").text
            )
            print("Product data detected!")
        except:
            print("No product data detected within timeout, continuing anyway...")

        # Check if login is required and wait for QR code scan
        page_text = driver.find_element(By.TAG_NAME, "body").text
        login_keywords = ["login", "scan"]
        if any(keyword in page_text.lower() for keyword in login_keywords):
            print("\n" + "=" * 60)
            print("Login page detected! Please scan QR code in browser window")
            print("=" * 60)
            print("\n1. Open Taobao or Alipay APP")
            print("2. Click 'Scan' function")
            print("3. Scan the QR code shown in browser")
            print("4. Confirm login on your phone")
            print("\nWaiting for login... (max 120 seconds)")
            print("=" * 60)

            # Wait for login to complete - check for login success indicators
            max_wait = 120  # 2 minutes
            wait_interval = 2
            elapsed = 0

            while elapsed < max_wait:
                time.sleep(wait_interval)
                elapsed += wait_interval

                # Check if login was successful
                current_text = driver.find_element(By.TAG_NAME, "body").text
                # Check for product listings or search interface
                login_success_keywords = ["search", "商品", "price", "¥", "item", "card"]
                if any(keyword in current_text.lower() for keyword in login_success_keywords):
                    # Also verify no longer on login page
                    current_lower = current_text.lower()
                    if "scan" not in current_lower and "qr" not in current_lower:
                        print(f"\n[OK] Login successful! (Time: {elapsed} seconds)")
                        break

                # Progress indicator
                if elapsed % 10 == 0:
                    print(f"Waiting... ({elapsed}/{max_wait}s)")

            if elapsed >= max_wait:
                print("\n[WARNING] Login timeout, will continue scraping...")

            # Extra wait after login
            time.sleep(3)

        # Scroll down to load more content
        print("Scrolling to load more content...")
        for i in range(3):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

        # Extract products
        print("\nExtracting product data...")
        products = extract_products(driver)

        # Save results
        result = {
            "export_time": datetime.now().isoformat(),
            "total": len(products),
            "source_url": SEARCH_URL,
            "data": products
        }

        output_file = OUTPUT_DIR / f"xianyu_vinyl_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print("\n" + "=" * 50)
        print(f"Scraping complete!")
        print(f"Found {len(products)} products")
        print(f"Results saved to: {output_file}")
        print("=" * 50)

        # Print sample data
        if products:
            print("\nSample products:")
            for p in products[:5]:
                print(f"  - {p.get('title', 'N/A')}: {p.get('price', 'N/A')}")

    except Exception as e:
        print(f"Error during scraping: {e}")
        import traceback
        traceback.print_exc()

    finally:
        print("\n浏览器将在60秒后关闭，你可以查看结果...")
        time.sleep(60)
        driver.quit()


if __name__ == "__main__":
    main()
