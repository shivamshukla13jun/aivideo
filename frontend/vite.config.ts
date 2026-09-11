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
        target: 'https://suwayomi-server-stable-ky1i.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/suwayomi/, ''),
        timeout: 0,
      },
      '/api': {
        target: 'https://aivideo-ln2b.onrender.com',
        changeOrigin: true,
        timeout: 0,
      },
      '/storage': {
        target: 'https://aivideo-ln2b.onrender.com',
        changeOrigin: true,
        timeout: 0,
      },
      '/socket.io': {
        target: 'https://aivideo-ln2b.onrender.com',
        ws: true,
        timeout: 0,
      },
    },


  },
});
