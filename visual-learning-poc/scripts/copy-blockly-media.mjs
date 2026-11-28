import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../node_modules/blockly/media', import.meta.url));
const target = fileURLToPath(new URL('../public/blockly-media', import.meta.url));
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
console.log('Blockly media copied into the PWA asset tree.');