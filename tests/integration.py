import http.cookiejar
import json
import os
import unittest
import urllib.request


class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.base = os.environ["TEST_BASE_URL"]
        self.jar = http.cookiejar.CookieJar()
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def test_static_page_and_health(self):
        with self.client.open(self.base + "/") as response:
            self.assertIn(b"News Stability", response.read())
        with self.client.open(self.base + "/healthz") as response:
            self.assertEqual(response.read(), b"ok\n")
        with self.client.open(self.base + "/api/healthz") as response:
            self.assertEqual(json.load(response), {"status": "ok"})

    def test_proxy_preserves_path_query_body_and_session(self):
        data = b"username=fixture&password=synthetic"
        with self.client.open(self.base + "/newsblur/api/login", data=data) as response:
            payload = json.load(response)
        self.assertEqual(payload, {"path": "/api/login", "body": data.decode()})
        self.assertEqual(len(self.jar), 1)
        self.assertEqual(next(iter(self.jar)).path, "/newsblur/")
        # A fully qualified test hostname exercises real domain-cookie behavior.
        self.assertEqual(next(iter(self.jar)).domain.lstrip("."), "reader.test")
        with self.client.open(self.base + "/newsblur/reader/feeds?flat=true") as response:
            payload = json.load(response)
        self.assertEqual(payload["path"], "/reader/feeds?flat=true")
        self.assertEqual(payload["cookie"], "newsblur_sessionid=fixture")


if __name__ == "__main__":
    unittest.main()
