/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the app works under any GitHub Pages sub-path
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // NOTE: favicon/apple-touch-icon/manifest icons are picked up by the
      // globPatterns below — listing them in includeAssets as well would
      // duplicate identical precache entries in sw.js.
      manifest: {
        name: 'NailDesk — دستیار ناخن‌سالن',
        short_name: 'NailDesk',
        description:
          'دستیار شخصی ناخن‌کار برای مدیریت مشتری‌ها، نوبت‌ها، طراحی ناخن و حساب‌داری — کاملاً آفلاین.',
        lang: 'fa',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FDF6F7',
        theme_color: '#E75A8B',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff}'],
        // The two manifest icons are injected into the precache by the
        // plugin itself; skip them in the glob pass to avoid duplicate
        // (albeit harmless, deduped) entries.
        globIgnores: ['icons/icon-192.png', 'icons/icon-512.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});
