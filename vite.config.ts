import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return ({
  // GitHub Pages publica o site no caminho do repositório.
  base: mode === 'github-pages' ? (env.VITE_BASE_PATH ?? '/Alfred/') : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // A Etapa 1 mantém testes Node próprios na raiz; Vitest valida somente o app React.
    include: ['src/**/*.test.{ts,tsx}'],
  },
  });
});
