import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  build: {
    assets: 'assets',
    inlineStylesheets: 'never'
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      }
    },
    plugins: [
      {
        name: 'client-scripts-build',
        writeBundle() {
          // Build client scripts separately
          const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };
          return import('vite').then(({ build }) => {
            return Promise.all([
              // Build service worker
              build({
                resolve: { alias },
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
              }),
              // Build panel client
              build({
                resolve: { alias },
                build: {
                  lib: {
                    entry: './src/panel-client.ts',
                    name: 'PanelClient',
                    fileName: 'panel-client',
                    formats: ['iife']
                  },
                  outDir: 'dist',
                  emptyOutDir: false,
                  rollupOptions: {
                    output: {
                      entryFileNames: 'panel-client.js'
                    }
                  }
                }
              })
            ]);
          });
        }
      }
    ]
  }
});
