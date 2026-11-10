import pkg from '../../package.json';
import inventory from '../../THIRD_PARTY.md?raw';
import { describe, expect, it } from 'vitest';

describe('Inventário de dependências de runtime', () => {
  it('lista em THIRD_PARTY.md todas as dependências diretas do navegador', () => {
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
