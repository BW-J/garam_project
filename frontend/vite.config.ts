import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  base: './',
  build: {
    outDir: 'build',
  },
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.scss'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['bwjung.iptime.org'],
    proxy: {
      '/api': {
        target: 'http://192.168.0.25:3000', // NestJS 서버 주소
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
