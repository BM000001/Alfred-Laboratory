import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // GitHub Pages publica o site no caminho do repositório.
  base: mode === 'github-pages' ? (loadEnv(mode, '.', 'ALFRED_').ALFRED_PAGES_BASE || '/Alfred-Laboratory/') : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // A Etapa 1 mantém testes Node próprios na raiz; Vitest valida somente o app React.
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
