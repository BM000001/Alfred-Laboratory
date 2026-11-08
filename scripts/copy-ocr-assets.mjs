import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const modules = path.join(root, 'node_modules');
const output = path.join(root, 'public', 'ocr');

async function findFile(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && predicate(entry.name)) return candidate;
    if (entry.isDirectory()) {
      const found = await findFile(candidate, predicate);
      if (found) return found;
    }
  }
  return undefined;
}

// OEM.LSTM_ONLY needs only the LSTM engines. Keep SIMD and non-SIMD
// variants for modern phones and older browsers without WebAssembly SIMD.
const requiredCoreFiles = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
];

async function findCoreDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  if (requiredCoreFiles.every((name) => names.has(name))) return directory;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findCoreDirectory(path.join(directory, entry.name));
    if (found) return found;
  }
  return undefined;
}

const worker = await findFile(path.join(modules, 'tesseract.js'), (name) => name === 'worker.min.js');
const language = await findFile(path.join(modules, '@tesseract.js-data', 'por'), (name) => name === 'por.traineddata.gz');
const coreDirectory = await findCoreDirectory(path.join(modules, 'tesseract.js-core'));

if (!worker || !language || !coreDirectory) {
  throw new Error('Assets locais do OCR não encontrados. Verifique tesseract.js, tesseract.js-core e @tesseract.js-data/por.');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(path.join(output, 'core'), { recursive: true });
await mkdir(path.join(output, 'lang'), { recursive: true });
await cp(worker, path.join(output, 'worker.min.js'));

const coreFiles = (await readdir(coreDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.startsWith('tesseract-core') &&
    /(?:simd-)?lstm\.wasm(?:\.js)?$/.test(entry.name));
for (const entry of coreFiles) {
  await cp(path.join(coreDirectory, entry.name), path.join(output, 'core', entry.name));
}
await cp(language, path.join(output, 'lang', 'por.traineddata.gz'));

const files = [
  path.join(output, 'worker.min.js'),
  ...coreFiles.map((entry) => path.join(output, 'core', entry.name)),
  path.join(output, 'lang', 'por.traineddata.gz'),
];
const totalBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size)))
  .reduce((sum, size) => sum + size, 0);
console.log('OCR assets locais preparados:', files.length, 'arquivos;', (totalBytes / 1024 / 1024).toFixed(2), 'MiB.');
