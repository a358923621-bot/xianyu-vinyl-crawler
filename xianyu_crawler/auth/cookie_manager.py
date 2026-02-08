"""
Cookie management for Xianyu crawler

Handles cookie persistence, validation, and automatic refresh
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

from loguru import logger


class CookieManager:
    """
    Manages cookies for Xianyu authentication
    """

    def __init__(self, cookies_dir: str):
        self.cookies_dir = Path(cookies_dir)
        self.cookies_dir.mkdir(parents=True, exist_ok=True)
        self.cookies_file = self.cookies_dir / "cookies.json"

    def save_cookies(self, cookies: list) -> bool:
        """
        Save cookies to file

        Args:
            cookies: List of cookie dictionaries from Playwright

        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert Playwright cookies to serializable format
            cookie_data = {
                "cookies": cookies,
                "saved_at": datetime.now().isoformat(),
                "expires_at": (datetime.now() + timedelta(days=7)).isoformat(),  # Cookies typically valid for 7 days
            }

            with open(self.cookies_file, "w", encoding="utf-8") as f:
                json.dump(cookie_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Cookies saved to {self.cookies_file}")
            return True

        except Exception as e:
            logger.error(f"Error saving cookies: {e}")
            return False

    def load_cookies(self) -> Optional[list]:
        """
        Load cookies from file

        Returns:
            List of cookie dictionaries, or None if not found/invalid
        """
        try:
            if not self.cookies_file.exists():
                logger.warning(f"Cookies file not found: {self.cookies_file}")
                return None

            with open(self.cookies_file, "r", encoding="utf-8") as f:
                cookie_data = json.load(f)

            # Check if cookies are expired
            expires_at = datetime.fromisoformat(cookie_data.get("expires_at", ""))
            if datetime.now() > expires_at:
                logger.warning("Cookies have expired")
                return None

            cookies = cookie_data.get("cookies", [])
            logger.info(f"Loaded {len(cookies)} cookies from {self.cookies_file}")
            return cookies

        except Exception as e:
            logger.error(f"Error loading cookies: {e}")
            return None

    def delete_cookies(self) -> bool:
        """
        Delete stored cookies

        Returns:
            True if successful, False otherwise
        """
        try:
            if self.cookies_file.exists():
                self.cookies_file.unlink()
                logger.info(f"Cookies deleted from {self.cookies_file}")
            return True

        except Exception as e:
            logger.error(f"Error deleting cookies: {e}")
            return False

    def is_cookies_valid(self) -> bool:
        """
        Check if stored cookies are valid (not expired)

        Returns:
            True if cookies are valid, False otherwise
        """
        cookie_data = self.load_cookies()
        if cookie_data is None:
            return False

        # Check if cookies are recent enough
        saved_at = datetime.fromisoformat(
            json.loads(self.cookies_file.read_text(encoding="utf-8")).get("saved_at", "")
        )
        return datetime.now() - saved_at < timedelta(days=7)

    def get_cookie_expiry(self) -> Optional[datetime]:
        """
        Get the expiry time of stored cookies

        Returns:
            Datetime of expiry, or None if not found
        """
        try:
            if not self.cookies_file.exists():
                return None

            with open(self.cookies_file, "r", encoding="utf-8") as f:
                cookie_data = json.load(f)

            return datetime.fromisoformat(cookie_data.get("expires_at", ""))

        except Exception as e:
            logger.error(f"Error getting cookie expiry: {e}")
            return None

    def format_cookies_for_playwright(self, cookies: list) -> list:
        """
        Format cookies for Playwright context.add_cookies()

        Args:
            cookies: List of cookie dictionaries

        Returns:
            List of properly formatted cookie dictionaries
        """
        formatted = []
        for cookie in cookies:
            # Ensure required fields are present
            formatted_cookie = {
                "name": cookie.get("name", ""),
                "value": cookie.get("value", ""),
                "domain": cookie.get("domain", ".goofish.com"),
                "path": cookie.get("path", "/"),
            }

            # Add optional fields if present
            if "secure" in cookie:
                formatted_cookie["secure"] = cookie["secure"]
            if "httpOnly" in cookie:
                formatted_cookie["httpOnly"] = cookie["httpOnly"]
            if "sameSite" in cookie:
                formatted_cookie["sameSite"] = cookie["sameSite"]
            if "expires" in cookie:
                # Convert expires timestamp to datetime
                expires = cookie["expires"]
                if isinstance(expires, (int, float)):
                    formatted_cookie["expires"] = datetime.fromtimestamp(expires).isoformat()

            formatted.append(formatted_cookie)

        return formatted

    def extract_session_token(self, cookies: list) -> Optional[str]:
        """
        Extract session token from cookies

        Args:
            cookies: List of cookie dictionaries

        Returns:
            Session token string, or None if not found
        """
        for cookie in cookies:
            if cookie.get("name") in ["_m_h5_tk", "_m_h5_tk_enc", "cookie2"]:
                return cookie.get("value")
        return None


class CookieValidator:
    """
    Validates if cookies are still working
    """

    def __init__(self, base_url: str = "https://www.goofish.com"):
        self.base_url = base_url

    async def validate_cookies(self, cookies: list, http_client) -> bool:
        """
        Validate cookies by making a test request

        Args:
            cookies: List of cookie dictionaries
            http_client: HTTP client to make the request

        Returns:
            True if cookies are valid, False otherwise
        """
        try:
            # Make a test request to check if cookies are working
            # This would typically check for a logged-in user indicator
            response = await http_client.get(
                self.base_url,
                cookies={c["name"]: c["value"] for c in cookies},
                follow_redirects=True,
            )

            # Check for login indicators
            # This depends on Xianyu's actual page structure
            text = response.text

            # If we see login button, cookies are not valid
            if "登录" in text and "logout" not in text.lower():
                logger.warning("Cookie validation failed: Login page detected")
                return False

            # If we see user info, cookies are valid
            if any(keyword in text for keyword in ["我的", "消息", "购物车"]):
                logger.info("Cookie validation successful: User logged in")
                return True

            # Default: assume valid if no explicit login prompt
            logger.info("Cookie validation: No explicit login prompt found")
            return True

        except Exception as e:
            logger.error(f"Error validating cookies: {e}")
            return False
