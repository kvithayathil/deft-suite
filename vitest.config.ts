import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/cli.ts',
        'src/core/ports/**',
        'src/workers/**',
        'src/adapters/driving/**',
        'src/tools/context.ts',
        'src/tools/types.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});
