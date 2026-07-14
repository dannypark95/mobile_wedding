import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served at the root of the custom domain sunghyunyeeun.com
  base: '/',
})
