#!/usr/bin/env python3
"""DTM Local Development Server - Cache-Control: no-cache"""
import http.server
import os

PORT = 8080
DIRECTORY = os.path.join(os.path.dirname(__file__), "app")

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        pass  # Konsolu temiz tut

if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"DTM sunucu çalışıyor → http://localhost:{PORT}")
        httpd.serve_forever()
