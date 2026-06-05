import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    entries: ['./index.html'],
  },
  server: {
    watch: {
      ignored: ['**/.claude/**', '**/node_modules/**', (p) => p.includes('Ticket Project')],
    },
    proxy: {
      '/auth': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth/, ''),
      },
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
    },
  },
})
