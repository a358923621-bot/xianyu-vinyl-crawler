"""
QR code login implementation for Xianyu using Playwright

Supports scanning QR code with Taobao/Alipay app to authenticate
"""

import asyncio
import time
from pathlib import Path
from typing import Optional

from loguru import logger
from playwright.async_api import async_playwright, Browser, Page, BrowserContext

from xianyu_crawler.auth.cookie_manager import CookieManager


class XianyuQRCodeLogin:
    """
    Handles QR code login for Xianyu (Idle Fish) platform
    """

    # Login page URL
    LOGIN_URL = "https://login.taobao.com/member/login.jhtml?style=mini&newLogin2=true&redirectURL=https://www.goofish.com"

    # Selectors for login page elements
    SELECTORS = {
        "qrcode": "div.login-qrcode img",  # QR code image
        "qrcode_container": "div.login-qrcode",  # QR code container
        "login_success_indicator": "div.login-success, div.success",  # Login success indicator
        "login_failed_indicator": "div.login-error, div.error",  # Login error indicator
        "refresh_button": "a.refresh-link, button.refresh",  # Refresh QR code button
        "user_info": "span.user-nick, div.username",  # User info after login
    }

    def __init__(self, cookies_dir: str, headless: bool = False):
        self.cookies_dir = Path(cookies_dir)
        self.cookies_dir.mkdir(parents=True, exist_ok=True)
        self.headless = headless
        self.cookie_manager = CookieManager(str(self.cookies_dir))

        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    async def login(self, timeout: int = 300, show_qrcode: bool = True) -> bool:
        """
        Perform QR code login flow

        Args:
            timeout: Maximum time to wait for login (seconds)
            show_qrcode: Whether to display QR code in console

        Returns:
            True if login successful, False otherwise
        """
        logger.info("Starting QR code login flow...")

        # Check if existing cookies are valid
        if self.cookie_manager.is_cookies_valid():
            logger.info("Valid cookies found, skipping login")
            return True

        # Launch browser
        async with async_playwright() as p:
            self.browser = await p.chromium.launch(headless=self.headless)
            self.context = await self.browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            self.page = await self.context.new_page()

            try:
                # Navigate to login page
                logger.info(f"Navigating to login page: {self.LOGIN_URL}")
                await self.page.goto(self.LOGIN_URL, wait_until="networkidle")

                # Wait for QR code to load
                logger.info("Waiting for QR code to load...")
                await self.page.wait_for_selector(self.SELECTORS["qrcode"], timeout=15000)

                # Get QR code image
                qrcode_element = await self.page.query_selector(self.SELECTORS["qrcode"])
                qrcode_data_url = await qrcode_element.get_attribute("src")

                # Save QR code image
                qrcode_path = self.cookies_dir / "qrcode.png"
                await self.page.screenshot(clip=await qrcode_element.bounding_box(), path=str(qrcode_path))
                logger.info(f"QR code saved to: {qrcode_path}")

                if show_qrcode:
                    # Display QR code info in console
                    self._display_qrcode_info(qrcode_path)

                # Wait for user to scan QR code and login
                logger.info("Waiting for user to scan QR code with Taobao/Alipay app...")
                logger.info(f"Timeout set to {timeout} seconds")

                # Poll for login success
                start_time = time.time()
                logged_in = False

                while time.time() - start_time < timeout:
                    # Check if we've been redirected to the main page
                    current_url = self.page.url
                    if "goofish.com" in current_url and "login" not in current_url:
                        logger.info("Login successful! Redirected to main page.")
                        logged_in = True
                        break

                    # Check for success indicator on page
                    try:
                        success_indicator = await self.page.query_selector(self.SELECTORS["login_success_indicator"])
                        if success_indicator:
                            logger.info("Login success indicator found!")
                            logged_in = True
                            break
                    except Exception:
                        pass

                    # Wait a bit before checking again
                    await asyncio.sleep(2)

                if not logged_in:
                    logger.warning("Login timeout. Please try again.")
                    return False

                # Get cookies after successful login
                cookies = await self.context.cookies()
                logger.info(f"Retrieved {len(cookies)} cookies after login")

                # Save cookies
                if self.cookie_manager.save_cookies(cookies):
                    logger.info("Cookies saved successfully")
                else:
                    logger.warning("Failed to save cookies")

                # Get user info
                await self._get_user_info()

                return True

            except Exception as e:
                logger.error(f"Error during login: {e}")
                return False

            finally:
                # Clean up
                await self.browser.close()

    def _display_qrcode_info(self, qrcode_path: Path):
        """Display QR code information in console"""
        print("\n" + "=" * 60)
        print("  闲鱼/咸鱼 QR Code Login")
        print("=" * 60)
        print(f"\n  QR Code image saved to: {qrcode_path}")
        print("\n  Please scan the QR code with:")
        print("    1. Open Taobao (淘宝) or Alipay (支付宝) app")
        print("    2. Go to 'Scan' (扫一扫)")
        print("    3. Scan the QR code")
        print("    4. Confirm login on your phone")
        print("\n  Waiting for login...")
        print("=" * 60 + "\n")

    async def _get_user_info(self):
        """Get user information after login"""
        try:
            # Wait for page to load after login
            await asyncio.sleep(2)

            # Try to get username
            user_info_element = await self.page.query_selector(self.SELECTORS["user_info"])
            if user_info_element:
                username = await user_info_element.inner_text()
                logger.info(f"Logged in as: {username}")

        except Exception as e:
            logger.warning(f"Could not retrieve user info: {e}")

    async def load_cookies_to_context(self, context: BrowserContext) -> bool:
        """
        Load saved cookies to browser context

        Args:
            context: Playwright browser context

        Returns:
            True if cookies loaded successfully, False otherwise
        """
        cookies = self.cookie_manager.load_cookies()
        if cookies is None:
            logger.warning("No saved cookies found")
            return False

        try:
            formatted_cookies = self.cookie_manager.format_cookies_for_playwright(cookies)
            await context.add_cookies(formatted_cookies)
            logger.info(f"Loaded {len(formatted_cookies)} cookies to context")
            return True

        except Exception as e:
            logger.error(f"Error loading cookies to context: {e}")
            return False

    async def verify_login_status(self, page: Page) -> bool:
        """
        Verify if still logged in

        Args:
            page: Playwright page object

        Returns:
            True if logged in, False otherwise
        """
        try:
            # Navigate to main page
            await page.goto("https://www.goofish.com", wait_until="networkidle")

            # Check for login indicators
            page_content = await page.content()

            # If we see login button, not logged in
            if "登录" in page_content and "logout" not in page_content.lower():
                return False

            # If we see user info, logged in
            if any(keyword in page_content for keyword in ["我的", "消息", "购物车"]):
                return True

            return False

        except Exception as e:
            logger.error(f"Error verifying login status: {e}")
            return False


async def perform_login(cookies_dir: str, headless: bool = False, timeout: int = 300) -> bool:
    """
    Convenience function to perform QR code login

    Args:
        cookies_dir: Directory to store cookies
        headless: Whether to run browser in headless mode
        timeout: Maximum time to wait for login (seconds)

    Returns:
        True if login successful, False otherwise
    """
    login_manager = XianyuQRCodeLogin(cookies_dir, headless=headless)
    return await login_manager.login(timeout=timeout, show_qrcode=True)


# CLI function for standalone login
async def cli_login():
    """CLI entry point for login"""
    import sys

    cookies_dir = "data/cookies"

    print("Xianyu QR Code Login")
    print(f"Cookies will be saved to: {cookies_dir}\n")

    success = await perform_login(cookies_dir, headless=False)

    if success:
        print("\n✓ Login successful! You can now run the crawler.")
        sys.exit(0)
    else:
        print("\n✗ Login failed. Please try again.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(cli_login())
