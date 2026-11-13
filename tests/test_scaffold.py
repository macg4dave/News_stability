"""Static security contracts that complement the server's article allowlist."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.violations = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "style" or (tag == "script" and not attributes.get("src")):
            self.violations.append("inline executable/style content")
        if any(key.startswith("on") or key == "style" for key in attributes):
            self.violations.append("inline attribute")
        if tag == "a" and attributes.get("target") == "_blank":
            if not {"noopener", "noreferrer"}.issubset(attributes.get("rel", "").split()):
                self.violations.append("unsafe external link")


class StaticSecurityTests(unittest.TestCase):
    def test_page_matches_csp_and_safe_link_policy(self):
        page = Page()
        page.feed((ROOT / "web/index.html").read_text(encoding="utf-8"))
        self.assertEqual(page.violations, [])


if __name__ == "__main__":
    unittest.main()
