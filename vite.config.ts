import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['setup-vitest.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      all: true,
      include: ['src/app/**/*.ts'],
      exclude: [
        'src/app/_tauri/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/__mocks__/**',
        '**/*.d.ts'
      ]
    }
  }
});
