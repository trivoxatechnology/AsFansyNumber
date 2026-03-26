import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/fancy_number_admin': {
        target: 'https://asfancynumber.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
