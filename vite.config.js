import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import strip from '@rollup/plugin-strip'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      ...strip({
        include: ['src/**/*.{js,jsx}'],
        // Solo debug: logger.js usa console.error/info/warn para producción
        functions: ['console.log', 'console.debug', 'console.dir', 'console.table', 'console.trace'],
      }),
      enforce: 'pre',
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/exceljs') || id.includes('node_modules/xlsx')) {
            return 'vendor-excel';
          }
          if (id.includes('node_modules/react-icons')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-dates';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['exceljs', 'xlsx'],
  },
})
