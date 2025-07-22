import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  build: {
    assets: 'assets',
    inlineStylesheets: 'auto'
  },
  vite: {
    plugins: [
      {
        name: 'service-worker-build',
        writeBundle() {
          // Build service worker separately
          return import('vite').then(({ build }) => {
            return build({
              build: {
                lib: {
                  entry: './src/service-worker.ts',
                  name: 'ServiceWorker',
                  fileName: 'service-worker',
                  formats: ['iife']
                },
                outDir: 'dist',
                emptyOutDir: false,
                rollupOptions: {
                  output: {
                    entryFileNames: 'service-worker.js'
                  }
                }
              }
            });
          });
        }
      }
    ]
  }
});