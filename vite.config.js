import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/fancy_number': {
        target: 'http://asfancynumber.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
