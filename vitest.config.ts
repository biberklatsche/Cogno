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
        replacement: "/src/packages/__test__/mocks/xterm-addon-ligatures-mock.ts",
      },
    ],
    include: [
      "src/packages/app-shell/**/*.spec.ts",
      "src/packages/core-host/**/*.spec.ts",
      "src/packages/base-features/**/*.spec.ts",
    ],
    exclude: [
      "src/packages/app-shell/terminal/+state/advanced/autocomplete/spec/imported/commands/**/*.spec.ts",
    ],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/packages/app-shell/**/*.ts",
        "src/packages/core-host/**/*.ts",
        "src/packages/base-features/**/*.ts",
      ],
      exclude: [
        "src/packages/app-shell/_tauri/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/__test__/tauri_mocks/**",
        "**/*.d.ts",
      ],
    },
  },
});
