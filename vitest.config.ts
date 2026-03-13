import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["setup-vitest.ts"],
    alias: [
      {
        find: "@xterm/addon-ligatures",
        replacement: "/packages/__test__/mocks/xterm-addon-ligatures-mock.ts",
      },
    ],
    include: [
      "packages/app-shell/**/*.spec.ts",
      "src/core-host/**/*.spec.ts",
      "packages/base-features/**/*.spec.ts",
    ],
    exclude: [
      "packages/app-shell/terminal/+state/advanced/autocomplete/spec/imported/commands/**/*.spec.ts",
    ],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "packages/app-shell/**/*.ts",
        "src/core-host/**/*.ts",
        "packages/base-features/**/*.ts",
      ],
      exclude: [
        "packages/app-shell/_tauri/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/__test__/tauri_mocks/**",
        "**/*.d.ts",
      ],
    },
  },
});
