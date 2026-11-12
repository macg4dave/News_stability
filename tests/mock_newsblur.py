"""Synthetic upstream for proxy testing; never contacts a real NewsBlur server."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.reply({"path": self.path, "cookie": self.headers.get("Cookie")})

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        self.reply({"path": self.path, "body": body}, cookie=True)

    def reply(self, payload, cookie=False):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        if cookie:
            self.send_header("Set-Cookie", "newsblur_sessionid=fixture; Domain=mock-newsblur; Path=/; HttpOnly; SameSite=Lax")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
