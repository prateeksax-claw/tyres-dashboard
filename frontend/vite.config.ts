import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'echarts': ['echarts', 'echarts-for-react'],
          'vendor': ['react', 'react-dom'],
          'query': ['@tanstack/react-query'],
          'motion': ['framer-motion'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 3202,
    host: true,
    allowedHosts: ['tyres.prateeksaxena.net', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8770',
        changeOrigin: true,
      }
    }
  }
})
