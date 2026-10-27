import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import { cloudflare } from '@cloudflare/vite-plugin';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Emits `data/<path>.gz` next to every dataset in the manifest. Cloudflare compresses text but
 * not `application/octet-stream`, so the grids and the road graph would travel uncompressed;
 * `src/data/browser.ts` fetches these copies in production and inflates them.
 */
function compressData(): Plugin {
  return {
    name: 'quaketrace:compress-data',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle() {
      const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8')) as {
        datasets: Record<string, { path: string }>;
      };
      for (const { path } of Object.values(manifest.datasets)) {
        this.emitFile({
          type: 'asset',
          fileName: `data/${path}.gz`,
          source: gzipSync(readFileSync(`public/data/${path}`), { level: 9 }),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    cloudflare(),
    compressData(),
  ],
  resolve: { tsconfigPaths: true },
});
