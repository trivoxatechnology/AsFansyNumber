import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
<<<<<<< HEAD
    port: 5174,
    proxy: {
      '/fancy_number': {
        target: 'https://asfancynumber.com',
=======
    proxy: {
      '/fancy_number': {
        target: 'http://asfancynumber.com',
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
