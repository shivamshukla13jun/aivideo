import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/suwayomi': {
        target: 'http://127.0.0.1:4567',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/suwayomi/, ''),
        timeout: 0,
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 0,
      },
      '/storage': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 0,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        timeout: 0,
      },
    },


  },
});
