import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const build = '1234567890abcdef';
const worker = (await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')).replace('__ALFRED_SHELL_BUILD__', build);
const base = 'https://example.test/Alfred-Laboratory/';
test('versions only the shell and validates its assets before activating', async () => {
  const listeners = new Map();
  const writes = [];
  const deleted = [];
  const staticAsset = base + 'assets/app-AbCd1234.js';
  let network = true;
  let servedBuild = '0000000000000000';
  let failAssets = true;
  const entry = '<script src="assets/app-AbCd1234.js"></script><link href="assets/new.css">';
  const cache = {
    addAll: async (requests) => {
      assert.deepEqual(Array.from(requests, ({ url }) => url), [base + 'assets/app-AbCd1234.js', base + 'assets/new.css']);
      if (failAssets) throw new Error('asset missing');
    },
    put: async (url, response) => { writes.push([url, await response.text()]); },
    match: async (request, options) => {
      if (request.url === staticAsset && options?.ignoreVary) return new Response('cached module');
      const found = writes.find(([url]) => url === (request.url ?? request));
      return found && new Response(found[1]);
    },
  };
  vm.runInNewContext(worker, {
    URL, Request, Response,
    self: { registration: { scope: base }, addEventListener: (type, handler) => listeners.set(type, handler),
      clients: { claim: async () => {} } },
    caches: { open: async (name) => {
      assert.equal(name, 'laboratory-alfred-app-shell-v3-' + build);
      return cache;
    }, keys: async () => ['laboratory-alfred-app-shell-v1', 'laboratory-alfred-app-shell-v2', 'laboratory-alfred-app-shell-v3-' + build, 'laboratory-alfred-ocr-assets-v1', 'alfred-app-shell-v1'],
    delete: async (key) => deleted.push(key) },
    fetch: async (_request, opts) => {
      if (!network) throw new Error('offline');
      if (opts) assert.equal(opts.cache, 'reload');
      return new Response(entry + `<meta name="alfred-build" content="6fd78be · ${servedBuild}" />`);
    },
  });
  function run(type, options = {}) {
    let pending;
    listeners.get(type)({ waitUntil: (task) => { pending = task; }, respondWith: (task) => { pending = task; }, ...options });
    return pending;
  }
  await assert.rejects(run('install'), /outra versão/);
  servedBuild = build;
  await assert.rejects(run('install'), /asset missing/);
  assert.equal(writes.length, 0);
  failAssets = false;
  await run('install');
  await run('activate');
  assert.deepEqual(deleted, ['laboratory-alfred-app-shell-v1', 'laboratory-alfred-app-shell-v2']);
  const beforeNavigation = writes.length;
  servedBuild = '9999999999999999';
  await run('fetch', { request: { method: 'GET', url: base, mode: 'navigate' } });
  assert.equal(writes.length, beforeNavigation);
  network = false;
  const offline = await run('fetch', { request: { method: 'GET', url: base + '?offline', mode: 'navigate' } });
  assert.match(await offline.text(), new RegExp(build));
  const module = await run('fetch', { request: { method: 'GET', url: staticAsset, mode: 'cors' } });
  assert.equal(await module.text(), 'cached module');
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

test('contraste de texto, botões e controles atende os limites nos dois temas', async () => {
  const css = await readFile(new URL('../src/styles/design.css', import.meta.url), 'utf8');
  function luminance(hex) {
    const channels = hex.match(/../g).map((channel) => parseInt(channel, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const tokens = (rules) => Object.fromEntries([...rules.matchAll(/--([\w-]+): #([0-9a-f]{6});/g)].map(([, name, rgb]) => [name, rgb]));
  const [light, dark] = css.split('* { box-sizing')[0].split(':root[data-theme=dark]');
  for (const theme of [tokens(light), { ...tokens(light), ...tokens(dark) }]) {
    for (const [foreground, background, minimum] of [
      ['ink', 'canvas', 4.5], ['muted', 'surface', 4.5], ['muted', 'surface-raised', 4.5],
      ['muted', 'canvas', 4.5], ['on-action', 'action', 4.5], ['canvas', 'accent', 4.5], ['accent', 'surface', 4.5],
      ['accent', 'accent-wash', 4.5], ['ink', 'accent-wash', 4.5], ['muted', 'accent-wash', 4.5],
      ['accent', 'surface-raised', 4.5], ['danger', 'surface', 4.5], ['danger', 'danger-wash', 4.5],
      ['success', 'success-wash', 4.5], ['control-edge', 'surface', 3],
    ]) {
      const values = [luminance(theme[foreground]), luminance(theme[background])].sort((a, b) => a - b);
      const ratio = (values[1] + .05) / (values[0] + .05);
      assert.ok(ratio >= minimum, `${foreground}/${background}: ${ratio.toFixed(2)} < ${minimum}`);
    }
  }
});

test('preview hands documents and Access callbacks to the browser and excludes login redirects from asset cache', async () => {
  const scope = 'https://alfred-studies-iphone-preview.brianmarcondes2000.workers.dev/';
  const listeners = new Map();
  let activated = false;
  vm.runInNewContext(worker, {
    URL, Response, self: { registration: { scope }, skipWaiting: async () => { activated = true; },
      addEventListener: (type, callback) => listeners.set(type, callback) },
    caches: { open: async () => ({ match: async () => undefined, put: () => assert.fail('cached Access redirect') }) },
    fetch: async (_req, opts) => { assert.equal(opts.redirect, 'manual'); return { type: 'opaqueredirect' }; },
  });
  await new Promise((resolve, reject) => listeners.get('install')({ waitUntil: p => p.then(resolve, reject) }));
  assert.equal(activated, true);
  for (const [path, mode] of [['', 'navigate'], ['index.html', 'navigate'], ['cdn-cgi/access/authorized', 'cors']]) {
    listeners.get('fetch')({ request: { url: scope + path, method: 'GET', mode }, respondWith: () => assert.fail('intercepted Access') });
  }
  let pending;
  listeners.get('fetch')({ request: { url: scope + 'assets/app-12345678.js', method: 'GET', mode: 'cors' }, respondWith: p => { pending = p; } });
  assert.equal((await pending).status, 401);
});
