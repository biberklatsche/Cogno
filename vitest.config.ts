import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['setup-vitest.ts'],
    alias: [
      { find: '@xterm/addon-ligatures', replacement: '/src/__test__/mocks/xterm-addon-ligatures-mock.ts' },
    ],
    include: ['src/**/*.spec.ts'],
    exclude: [
      'src/app/terminal/+state/advanced/autocomplete/spec/imported/commands/**/*.spec.ts',
    ],
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/app/**/*.ts'],
      exclude: [
        'src/app/_tauri/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/__test__/tauri_mocks/**',
        '**/*.d.ts'
      ]
    }
  }
});
