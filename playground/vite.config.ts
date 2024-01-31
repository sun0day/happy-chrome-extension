import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import crx from 'vite-plugin-happy-crx'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crx()],
})
