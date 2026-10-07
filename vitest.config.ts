import { defineConfig } from 'vitest/config'

// Unit tests for game rules, data integrity and account security.
// Kept separate from vite.config.ts so the PWA plugin doesn't run under test.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
})
