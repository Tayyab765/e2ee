import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: {
      key: '../server/cert/key.pem',
      cert: '../server/cert/cert.pem'
    },
    proxy: {
      '/api': {
        target: 'https://localhost:4000',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
