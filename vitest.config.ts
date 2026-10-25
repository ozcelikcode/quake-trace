import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**', 'worker/**'],
      exclude: ['worker/worker-configuration.d.ts'],
      thresholds: {
        'src/engine/**': { lines: 90, branches: 90 },
      },
    },
  },
});
