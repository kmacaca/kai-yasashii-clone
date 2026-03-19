import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import ViteRestart from 'vite-plugin-restart'

export default defineConfig({
  root: 'src/',
  publicDir: '../public/',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
  },
  plugins: [
    tailwindcss(),
    ViteRestart({
      restart: ['public/**'],
    }),
  ],
})
