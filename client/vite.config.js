import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const serverConfig = {
    port: 5173,
  };

  if (mode === 'development') {
    serverConfig.https = {
      key: '../server/cert/key.pem',
      cert: '../server/cert/cert.pem'
    };
    serverConfig.proxy = {
      '/api': {
        target: env.VITE_API_URL || 'https://localhost:4000',
        changeOrigin: true,
        secure: false
      }
    };
  }

  return {
    plugins: [react()],
    server: serverConfig,
  };
});
