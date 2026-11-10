import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Inventário de dependências de runtime', () => {
  it('lista em THIRD_PARTY.md todas as dependências diretas do navegador', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const inventory = readFileSync(resolve(process.cwd(), 'THIRD_PARTY.md'), 'utf8');
    const documented = new Set(
      inventory.split('\n')
        .filter((line) => line.startsWith('|'))
        .map((line) => line.split('|')[1]?.trim())
        .filter((name): name is string => Boolean(name)),
    );
    for (const dependency of Object.keys(pkg.dependencies ?? {})) {
      expect(documented.has(dependency), `Dependência não documentada: ${dependency}`).toBe(true);
    }
  });
});
