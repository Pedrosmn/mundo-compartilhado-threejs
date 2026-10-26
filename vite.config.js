import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps the build working from any subfolder (GitHub Pages, etc.).
  base: './',
  server: {
    open: false,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
