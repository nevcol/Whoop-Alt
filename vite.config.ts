import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path matches the GitHub Pages URL: https://nevcol.github.io/Whoop-Alt/
  base: '/Whoop-Alt/',
  server: {
    port: 5173,
    host: true,
  },
});
