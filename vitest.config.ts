import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'lib/**/*.ts',
        'config/**/*.ts',
      ],
      exclude: [
        '**/__tests__/**',
        'lib/index.ts',
        'lib/reference-math.ts',
        // Hooks are thin wagmi wrappers - testing them requires React testing library
        // The business logic they use (math, config) is already tested
        'hooks/**/*.ts',
        // Type-only files have no runtime code to test
        'types/**/*.ts',
      ],
      thresholds: {
        // High thresholds for core business logic
        statements: 99,
        branches: 95,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})

