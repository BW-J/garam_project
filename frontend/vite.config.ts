import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import autoprefixer from 'autoprefixer';

// export default defineConfig({
export default defineConfig(({ mode }) => {
  // 현재 모드(development, production)에 맞는 환경 변수를 로드합니다.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    build: {
      outDir: 'dist',
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
      allowedHosts: ['bwjung.iptime.org', 'garamga.kr'],
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
