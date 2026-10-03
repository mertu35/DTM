"""Local-only finance QA: python tests/finance-server.py.

Serves the repo on 8766 and saves the sample PDF under the OS temp directory.
No Firebase connection. No production data is used.
"""
import http.server
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = Path(tempfile.gettempdir()) / "dtm-finance-qa"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/test-pdf":
            self.send_error(404)
            return
        size = int(self.headers.get("Content-Length", 0))
        if size <= 0 or size > 10 * 1024 * 1024:
            self.send_error(413)
            return
        pdf = self.rfile.read(size)
        if not pdf.startswith(b"%PDF-"):
            self.send_error(400)
            return
        OUTPUT.mkdir(parents=True, exist_ok=True)
        (OUTPUT / "sample-payment.pdf").write_bytes(pdf)
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    print(f"http://127.0.0.1:8766/tests/finance-preview.html — output: {OUTPUT}", flush=True)
    http.server.HTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
