import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [html, worker] = await Promise.all([
  readFile('dist/index.html', 'utf8'),
  readFile('dist/sw.js', 'utf8'),
]);
const revision = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f\d]{40}$/.test(revision)) throw new Error('Revisão inválida para a identificação do build.');
const build = createHash('sha256').update(html).update(worker).digest('hex').slice(0, 16);
if (!worker.includes('__ALFRED_SHELL_BUILD__') || !html.includes('</head>')) {
  throw new Error('Marcadores da versão da interface ausentes.');
}
await Promise.all([
  writeFile('dist/sw.js', worker.replace('__ALFRED_SHELL_BUILD__', build)),
  writeFile('dist/index.html', html.replace('</head>', `<meta name="alfred-build" content="${revision.slice(0, 7)} · ${build}" />\n  </head>`)),
  writeFile('dist/version.json', JSON.stringify({ revision, build }) + '\n'),
]);
