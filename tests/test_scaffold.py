from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.hrefs.extend(value for key, value in attrs if key == "href")


class ScaffoldTests(unittest.TestCase):
    def test_development_references_are_available(self):
        parser = Links()
        parser.feed((ROOT / "web/index.html").read_text(encoding="utf-8"))
        for link in ("https://www.newsblur.com/api", "https://github.com/samuelclay/newsblur", "http://news101.lan", "/healthz"):
            self.assertIn(link, parser.hrefs)


if __name__ == "__main__":
    unittest.main()
