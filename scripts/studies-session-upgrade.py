"""Exercise private-preview service-worker upgrades with synthetic data and a local Access gate."""
import argparse
import importlib.util
import json
import ssl
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
for name in ('old', 'new', 'cert', 'key'):
    parser.add_argument(name, type=Path)
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('smoke', Path(__file__).with_name('studies-webkit-smoke.py'))
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)
host = 'alfred-studies-iphone-preview.alfred-bm-laboratory.workers.dev'
root = args.old
expired = False


class Gate(SimpleHTTPRequestHandler):
    def __init__(self, *params):
        super().__init__(*params, directory=str(root))

    def do_GET(self):
        if self.path == '/login-test':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Login test')
        elif expired:
            self.send_response(302)
            self.send_header('Location', '/login-test')
            self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        self.send_response(401 if expired else 200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'available': not expired}).encode())

    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), Gate)
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain(args.cert, args.key)
server.socket = tls.wrap_socket(server.socket, server_side=True)
Thread(target=server.serve_forever, daemon=True).start()
url = f'https://{host}'
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=[
        '--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors',
        f'--host-resolver-rules=MAP {host}:443 127.0.0.1:{server.server_port}'])
    ctx = browser.new_context(ignore_https_errors=True, viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    page.goto(url)
    page.evaluate('async () => {await navigator.serviceWorker.ready}')
    page.evaluate(smoke.SEED_DATABASE)
    previous = page.evaluate(smoke.READ_DATABASE)
    root = args.new
    expired = True
    # An install during expiry must leave the old cache and original data intact.
    page.evaluate('async () => {try {await (await navigator.serviceWorker.ready).update()} catch {}}')
    assert page.evaluate(smoke.READ_DATABASE) == previous
    expired = False
    page.evaluate('async () => {await (await navigator.serviceWorker.ready).update()}')
    page.wait_for_function('navigator.serviceWorker.getRegistration().then(r => !!r.waiting)')
    page.close()
    page = ctx.new_page()
    page.goto(url)
    page.get_by_role('button', name='Aprender', exact=True).click()
    page.get_by_text('IA disponível', exact=True).wait_for()
    expired = True
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    page.get_by_text('Sessão expirada ou inválida').wait_for()
    assert page.get_by_role('link', name='Renovar sessão').is_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.reload()
    page.wait_for_url('**/login-test')
    expired = False
    page.goto(url)
    assert page.evaluate(smoke.READ_DATABASE) == previous
    print('PASS previous shell, expired session, new shell, renewal control, native redirect, persisted study records')
    browser.close()
server.shutdown()
