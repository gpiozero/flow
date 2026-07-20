import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Separate HTML entries (not client-side routing) so the built
      // dist/ works from a plain static file server with no SPA
      // fallback, e.g. `python3 -m http.server` — see docs/hosted-deployment.md.
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
})
