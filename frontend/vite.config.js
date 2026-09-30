import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const target = process.env.VITE_API_PROXY || 'http://localhost:4100';
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, proxy: { '/api': { target, changeOrigin: true } } },
  preview: { port: 5181, proxy: { '/api': { target, changeOrigin: true } } },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
