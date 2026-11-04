import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': process.env.LOTTO_DEV_API_ORIGIN ?? 'http://127.0.0.1:8000' } },
})
