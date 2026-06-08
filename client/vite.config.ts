import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Stellar Dominion',
        short_name: 'Stellar Dom',
        description: 'Turn-based multiplayer space strategy — 2–6 players',
        theme_color: '#0c1018',
        background_color: '#0c1018',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@stellar-dominion/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 3000,
  },
});
