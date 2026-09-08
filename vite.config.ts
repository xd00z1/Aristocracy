import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate': an auto-updating worker calls skipWaiting
      // and reloads open tabs the moment a new build lands, which throws away
      // whatever lesson is on screen and 404s the lazy chunks already in
      // flight. A waiting worker takes over on the next cold start instead.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Aristocracy',
        short_name: 'Aristocracy',
        description: 'Five minutes a day to become the person at the dinner party who knows what they are listening to.',
        theme_color: '#f6f1e7',
        background_color: '#f6f1e7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        // The content bundle is large and grows with every city, so the
        // precache ceiling is a decision here rather than workbox's silent
        // 2 MB default (over it, an asset is dropped from the manifest with a
        // build-time warning only, and offline support quietly stops working).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
            handler: 'CacheFirst',
            options: { cacheName: 'media', expiration: { maxEntries: 600 } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        // The compiled content is most of the bytes and changes on a different
        // clock from the app code; its own chunk keeps one from invalidating
        // the other in the precache.
        manualChunks(id: string) {
          if (id.includes('src/content/generated/content.json')) return 'content'
          return undefined
        },
      },
    },
  },
})
