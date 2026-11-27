import { cp } from 'node:fs/promises';

await cp(new URL('../node_modules/blockly/media/', import.meta.url),
  new URL('../public/blockly-media/', import.meta.url), { recursive: true });
