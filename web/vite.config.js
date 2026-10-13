import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2019',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  // Geliştirmede bulut kayıt API'si yerel Node sunucusuna (node server.mjs) yönlendirilir
  server: { host: true, proxy: { '/api': `http://localhost:${process.env.API_PORT || 10000}` } },
});
