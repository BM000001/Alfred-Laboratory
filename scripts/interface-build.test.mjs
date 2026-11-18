import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const base = 'https://example.test/Alfred-Laboratory/';
test('versions only the shell and validates its assets before activating', async () => {
  const listeners = new Map();
  const writes = [];
  const deleted = [];
  let network = true;
  let failAssets = true;
  const html = '<script src="assets/app.js"></script><link href="assets/new.css">';
  const cache = {
    addAll: async (requests) => {
      assert.deepEqual(Array.from(requests, ({ url }) => url), [base + 'assets/app.js', base + 'assets/new.css']);
      if (failAssets) throw new Error('asset missing');
    },
    put: async (url, response) => { writes.push([url, await response.text()]); },
    match: async (request) => {
      const found = writes.find(([url]) => url === (request.url ?? request));
      return found && new Response(found[1]);
    },
  };
  vm.runInNewContext(worker, {
    URL, Request, Response,
    self: { registration: { scope: base }, addEventListener: (type, handler) => listeners.set(type, handler),
      clients: { claim: async () => {} } },
    caches: { open: async (name) => {
      assert.equal(name, 'laboratory-alfred-app-shell-v2');
      return cache;
    }, keys: async () => ['laboratory-alfred-app-shell-v1', 'laboratory-alfred-app-shell-v2', 'laboratory-alfred-ocr-assets-v1', 'alfred-app-shell-v1'],
    delete: async (key) => deleted.push(key) },
    fetch: async (_request, opts) => {
      if (!network) throw new Error('offline');
      if (opts) assert.equal(opts.cache, 'reload');
      return new Response(html);
    },
  });
  function run(type, options = {}) {
    let pending;
    listeners.get(type)({ waitUntil: (task) => { pending = task; }, respondWith: (task) => { pending = task; }, ...options });
    return pending;
  }
  await assert.rejects(run('install'), /asset missing/);
  assert.equal(writes.length, 0);
  failAssets = false;
  await run('install');
  await run('activate');
  assert.deepEqual(deleted, ['laboratory-alfred-app-shell-v1']);
  network = false;
  const offline = await run('fetch', { request: { method: 'GET', url: base + '?offline', mode: 'navigate' } });
  assert.equal(await offline.text(), html);
});

test('imports only the new visual system and uses the same base for PWA links', async () => {
  const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const [entry, assistant, html, manifest, design, interfaceStyles] = await Promise.all([
    read('src/main.tsx'), read('src/modules/Assistant.tsx'), read('index.html'), read('public/manifest.webmanifest'),
    read('src/styles/design.css'), read('src/styles/interface.css'),
  ]);
  assert.deepEqual(entry.match(/styles\/[^']+\.css/g), ['styles/design.css', 'styles/interface.css']);
  assert.doesNotMatch(assistant, /assistant\.css/);
  assert.match(html, /%BASE_URL%manifest\.webmanifest/);
  assert.equal(JSON.parse(manifest).scope, './');
  for (const content of [manifest, html, design, interfaceStyles]) {
    assert.doesNotMatch(content, /#(?:00f\b|007bff|0d6efd|1e3a8a|3978d5|91b4f5)|var\(--blue\)/i);
  }
});
