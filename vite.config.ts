import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Proxy API calls to the Express backend during development.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
