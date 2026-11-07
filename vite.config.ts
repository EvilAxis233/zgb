import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
    // 仅本地开发生效：把 /api 转发到线上，让预览能拿到真实数据。
    // 生产构建（npm run build）不经过这里，线上行为不变。
    proxy: {
      '/api': {
        target: 'https://zgb-abc.pages.dev',
        changeOrigin: true,
      },
    },
  },
});
