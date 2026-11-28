"""Exercise private-preview service-worker upgrades with synthetic data and a local Access gate."""
import argparse
import importlib.util
import json
import ssl
from tempfile import TemporaryDirectory
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
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'<!doctype html><title>Login test</title>')
        elif expired:
            self.send_response(302)
            self.send_header('Location', 'https://access.example.test/login-test')
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


class ThreadedTLS(ThreadingHTTPServer):
    request_queue_size = 128
    def finish_request(self, request, address):
        with tls.wrap_socket(request, server_side=True) as conn:
            self.RequestHandlerClass(conn, address, self)

server = ThreadedTLS(('127.0.0.1', 0), Gate)
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain(args.cert, args.key)

Thread(target=server.serve_forever, daemon=True).start()
url = f'https://{host}'
with TemporaryDirectory() as profile, sync_playwright() as pw:
    def reopen():
        return pw.chromium.launch_persistent_context(profile, headless=True, ignore_https_errors=True,
            viewport={'width':390, 'height':844}, executable_path='/usr/bin/chromium', args=[
        '--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors',
        f'--host-resolver-rules=MAP {host}:443 127.0.0.1:{server.server_port}, MAP access.example.test:443 127.0.0.1:{server.server_port}'])
    ctx = reopen()
    page = ctx.new_page()
    page.goto(url, wait_until='domcontentloaded')
    page.evaluate('async () => {await navigator.serviceWorker.ready}')
    page.evaluate(smoke.SEED_DATABASE)
    blob_operation = """async write => {
      const db = await new Promise(r => {const q=indexedDB.open('alfred');q.onsuccess=()=>r(q.result)});
      const tx=db.transaction('files',write?'readwrite':'readonly'), store=tx.objectStore('files');
      const file=await new Promise(r=>{const q=store.get('f1');q.onsuccess=()=>r(q.result)});
      if(write){file.blob=new Blob(['arquivo original sintético']);store.put(file)}
      await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j});db.close();
      return file.blob.text();
    }"""
    assert page.evaluate(blob_operation, True) == 'arquivo original sintético'
    previous = page.evaluate(smoke.READ_DATABASE)
    root = args.new
    expired = True
    # An install during expiry must leave the old cache and original data intact.
    page.evaluate('async () => {try {await (await navigator.serviceWorker.ready).update()} catch {}}')
    assert page.evaluate(smoke.READ_DATABASE) == previous
    expired = False
    page.evaluate('async () => {await (await navigator.serviceWorker.ready).update()}')
    page.wait_for_function('navigator.serviceWorker.getRegistration().then(r => !!r.waiting)')
    ctx.close()
    ctx = reopen()
    page = ctx.new_page()
    page.goto(url, wait_until='domcontentloaded')
    page.get_by_role('button', name='Aprender', exact=True).click()
    page.get_by_text('IA disponível', exact=True).wait_for()
    expected = json.loads((root / 'version.json').read_text())['build']
    page.wait_for_function("build => caches.keys().then(keys => keys.filter(k => k.startsWith('alfred-app-shell-')).every(k => k.endsWith(build)))", arg=expected)
    expired = True
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    page.get_by_text('Sessão expirada ou inválida').wait_for()
    assert page.get_by_role('link', name='Renovar sessão').is_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.reload()
    page.wait_for_url('**/login-test')
    expired = False
    page.goto(url, wait_until='domcontentloaded')
    assert page.evaluate(smoke.READ_DATABASE) == previous
    assert page.evaluate(blob_operation, False) == 'arquivo original sintético'
    print('PASS previous shell, expired session, new shell, renewal control, native redirect, persisted study records')
    ctx.close()
server.shutdown()
