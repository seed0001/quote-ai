import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend-only config. All API routes live in server.js (Express) — in dev,
// run `npm run dev:api` in one terminal and `npm run dev` in another; this
// proxy forwards /api calls to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: false,
      },
    },
  },
})
