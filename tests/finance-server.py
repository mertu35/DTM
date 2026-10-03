"""Local-only finance QA: python tests/finance-server.py.

Serves the repo on 8766 and saves the sample PDF under the OS temp directory.
No Firebase connection. No production data is used.
"""
import http.server
from pathlib import Path
import tempfile
import json
import re
import urllib.request
import urllib.error
import uuid

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = Path(tempfile.gettempdir()) / "dtm-finance-qa"
AUTH_API = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
DOC_API = 'http://127.0.0.1:8080/v1/projects/demo-dtm/databases/(default)/documents'
ACCOUNT_FILE = OUTPUT / 'auth-test-account.json'
TEST_ACCOUNT = json.loads(ACCOUNT_FILE.read_text()) if ACCOUNT_FILE.exists() else None

def emulator_request(url, data=None, method=None, admin=False):
    headers = {'Content-Type': 'application/json'}
    if admin:
        headers['Authorization'] = 'Bearer owner'
    req = urllib.request.Request(url, data=None if data is None else json.dumps(data).encode(),
                                 method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        raw = response.read()
        return json.loads(raw) if raw else {}

def auth_request(action, data):
    return emulator_request(f'{AUTH_API}/accounts:{action}?key=local-test-key', data)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.split('?')[0] == '/test-auth':
            html = (ROOT / 'app/index.html').read_text(encoding='utf-8')
            html = html.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:8080 http://127.0.0.1:9099")
            html = html.replace('<title>', '<base href="/app/"><title>', 1)
            html = html.replace('src="js/config.js"', 'src="/tests/auth-emulator-config.js"')
            html = re.sub(r'(<script src="js/firebase.js[^>]+></script>)',
                          r'\1\n<script src="/tests/auth-emulator-connect.js"></script>', html)
            html = html.replace('</body>', '<script src="/tests/auth-preview.js"></script></body>')
            toolbar = '''<div style="position:fixed;top:0;left:0;right:0;z-index:100000;background:#e0f2fe;padding:8px;display:flex;gap:12px;align-items:center">
                <button data-dtm-onclick="qa-auth-prepare">Yerel test hesabı oluştur</button>
                <button data-dtm-onclick="qa-auth-verify">Yerel doğrulama bağlantısını uygula</button>
                <button data-dtm-onclick="qa-auth-state">Test profilini kontrol et</button>
                <button data-dtm-onclick="qa-auth-cleanup">Test hesabını temizle</button>
                <span id="qaAuthStatus">Yalnızca demo-dtm emülatörleri kullanılır.</span></div>'''
            html = html.replace('</body>', toolbar + '</body>')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(html.encode())
            return
        if self.path == '/test-pdf' and (OUTPUT / 'sample-payment.pdf').exists():
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.end_headers()
            self.wfile.write((OUTPUT / 'sample-payment.pdf').read_bytes())
        else:
            super().do_GET()

    def do_POST(self):
        global TEST_ACCOUNT
        if self.path.startswith('/test-auth-'):
            try:
                if self.path == '/test-auth-prepare':
                    username = 'security-test-' + uuid.uuid4().hex[:8]
                    old_email = username + '@dtm.local'
                    new_email = username + '@example.test'
                    password = 'LocalEmulatorOnly!2026'
                    created = auth_request('signUp', {'email': old_email, 'password': password, 'returnSecureToken': True})
                    uid = created['localId']
                    TEST_ACCOUNT = {'uid': uid, 'username': username, 'oldEmail': old_email,
                                    'newEmail': new_email, 'password': password}
                    emulator_request(f'{DOC_API}/users/{uid}', {'fields': {
                        'username': {'stringValue': username}, 'role': {'stringValue': 'user'},
                        'displayName': {'stringValue': 'Security Test'}
                    }}, 'PATCH', True)
                    OUTPUT.mkdir(parents=True, exist_ok=True)
                    ACCOUNT_FILE.write_text(json.dumps(TEST_ACCOUNT))
                    result = TEST_ACCOUNT
                elif self.path == '/test-auth-verify':
                    assert TEST_ACCOUNT, 'Prepare the test account first'
                    codes = emulator_request('http://127.0.0.1:9099/emulator/v1/projects/demo-dtm/oobCodes')['oobCodes']
                    code = next(c for c in reversed(codes) if c.get('email') == TEST_ACCOUNT['newEmail'] or c.get('newEmail') == TEST_ACCOUNT['newEmail'])
                    auth_request('update', {'oobCode': code['oobCode']})
                    result = {'verified': True, 'newEmail': TEST_ACCOUNT['newEmail']}
                elif self.path == '/test-auth-state':
                    assert TEST_ACCOUNT, 'Prepare the test account first'
                    doc = emulator_request(f"{DOC_API}/users/{TEST_ACCOUNT['uid']}", admin=True)
                    values = doc['fields']
                    result = {'email': values.get('email', {}).get('stringValue'),
                              'emailVerified': values.get('emailVerified', {}).get('booleanValue', False)}
                elif self.path == '/test-auth-cleanup':
                    assert TEST_ACCOUNT, 'Prepare the test account first'
                    try:
                        cred = auth_request('signInWithPassword', {'email': TEST_ACCOUNT['newEmail'], 'password': TEST_ACCOUNT['password'], 'returnSecureToken': True})
                    except urllib.error.HTTPError:
                        cred = auth_request('signInWithPassword', {'email': TEST_ACCOUNT['oldEmail'], 'password': TEST_ACCOUNT['password'], 'returnSecureToken': True})
                    auth_request('delete', {'idToken': cred['idToken']})
                    for collection in ['users', 'publicUsers', 'referans']:
                        emulator_request(f"{DOC_API}/{collection}/{TEST_ACCOUNT['uid']}", method='DELETE', admin=True)
                    TEST_ACCOUNT = None
                    ACCOUNT_FILE.unlink(missing_ok=True)
                    result = {'deleted': True}
                else:
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as error:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(error)}).encode())
            return
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
