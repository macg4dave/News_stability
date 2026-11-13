"""Reader proxy boundaries; this stack never contacts the LAN NewsBlur server."""
import http.cookiejar
import json
import os
import unittest
import urllib.error
import urllib.request


class ReaderTests(unittest.TestCase):
    def setUp(self):
        self.base = os.environ["TEST_BASE_URL"]
        self.jar = http.cookiejar.CookieJar()
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def test_static_page_health_and_security_headers(self):
        with self.client.open(self.base + "/") as response:
            self.assertIn(b"News Stability", response.read())
            self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])
            self.assertEqual(response.headers["Referrer-Policy"], "no-referrer")
        for path in ("/reader.js", "/reader.css"):
            with self.client.open(self.base + path) as response:
                self.assertEqual(response.status, 200)
        with self.client.open(self.base + "/healthz") as response:
            self.assertEqual(response.read(), b"ok\n")
        with self.client.open(self.base + "/api/healthz") as response:
            self.assertEqual(json.load(response), {"status": "ok"})

    def test_session_and_csrf_boundary(self):
        with self.client.open(self.base + "/api/session") as response:
            session = json.load(response)
            self.assertFalse(session["authenticated"])
            self.assertTrue(session["csrf_token"])
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertIn("HttpOnly", response.headers["Set-Cookie"])
            self.assertIn("SameSite=Strict", response.headers["Set-Cookie"])
        self.assertEqual(len(self.jar), 1)
        request = urllib.request.Request(self.base + "/api/login", data=b'{}', headers={
            "Content-Type": "application/json", "Origin": "http://localhost",
        })
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.client.open(request)
        self.assertEqual(caught.exception.code, 403)
        self.assertEqual(json.load(caught.exception)["code"], "csrf_rejected")

    def test_unauthenticated_reads_and_removed_passthrough(self):
        for path, status in (("/api/feeds", 401), ("/api/feeds/1/stories", 401), ("/api/saved", 401), ("/newsblur/api/login", 404)):
            with self.assertRaises(urllib.error.HTTPError) as caught:
                self.client.open(self.base + path)
            self.assertEqual(caught.exception.code, status)

    def test_z_auth_rate_limit_leaves_read_routes_available(self):
        # Invalid Origin rejects before any upstream access. Run after bootstrap
        # checks because this intentionally fills this client's authentication bucket.
        limited = False
        for _ in range(25):
            request = urllib.request.Request(self.base + "/api/login", data=b'{}', headers={
                "Content-Type": "application/json", "Origin": "https://other.invalid",
            })
            with self.assertRaises(urllib.error.HTTPError) as caught:
                self.client.open(request)
            self.assertIn(caught.exception.code, (403, 429))
            if caught.exception.code == 429:
                self.assertEqual(json.load(caught.exception)["code"], "rate_limited")
                limited = True
                break
        self.assertTrue(limited, "authentication flood was not limited")
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.client.open(self.base + "/api/feeds")
        self.assertEqual(caught.exception.code, 401)


if __name__ == "__main__":
    unittest.main()
