import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // serial — shared test DB
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
