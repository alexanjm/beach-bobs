import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Pages serves the site from /<repo>/, dev serves from /
  base: process.env.NODE_ENV === 'production' ? '/beach-bobs/' : '/',
  plugins: [react(), tailwindcss()],
})
