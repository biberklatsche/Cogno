import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['setup-vitest.ts'],
    alias: [
      { find: '@xterm/addon-ligatures', replacement: '/src/app/__test__/mocks/xterm-addon-ligatures-mock.ts' },
    ],
    include: [
      'src/app/src/**/*.spec.ts',
      'src/open-features/**/*.spec.ts',
      'src/pro-features/**/*.ts',
    ],
    exclude: [
      'src/app/src/terminal/+state/advanced/autocomplete/spec/imported/commands/**/*.spec.ts',
    ],
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/app/src/**/*.ts',
        'src/open-features/**/*.ts',
        'src/pro-features/**/*.ts',
      ],
      exclude: [
        'src/app/src/_tauri/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/__test__/tauri_mocks/**',
        '**/*.d.ts'
      ]
    }
  }
});
