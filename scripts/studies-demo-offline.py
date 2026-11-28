"""Disconnect a real local HTTP origin after install, then reopen the demo in WebKit."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

from playwright.sync_api import sync_playwright

with TemporaryDirectory() as profile, TemporaryDirectory() as root, sync_playwright() as playwright:
    mount = Path(root, "Alfred-Laboratory/studies-app")
    mount.parent.mkdir()
    mount.symlink_to(Path("dist").resolve(), target_is_directory=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=root))
    Thread(target=server.serve_forever, daemon=True).start()
    context = playwright.webkit.launch_persistent_context(profile)
    url = f"http://127.0.0.1:{server.server_port}/Alfred-Laboratory/studies-app/"
    page = context.new_page()
    page.goto(url)
    page.get_by_text("Abrir com exemplos de programação").click()
    page.get_by_role("button", name="Aprender", exact=True).wait_for()
    page.evaluate("async () => { await navigator.serviceWorker.ready; }")
    page.wait_for_function("!!navigator.serviceWorker.controller")
    server.shutdown()
    server.server_close()
    page.close()
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded")
    page.get_by_text("Abrir dados locais desta prévia").click()
    page.get_by_role("button", name="Aprender", exact=True).click()
    page.get_by_role("button", name="Programação · demonstração", exact=False).wait_for()
    print("PASS WebKit: origem desligada, nova aba, shell e disciplina persistida.")
    context.close()
