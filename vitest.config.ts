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
      "src/packages/workbench/**/*.spec.ts",
      "src/packages/core-host/**/*.spec.ts",
      "src/packages/features/**/*.spec.ts",
    ],
    exclude: [
      "src/packages/workbench/terminal/+state/advanced/autocomplete/spec/imported/commands/**/*.spec.ts",
    ],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/packages/workbench/**/*.ts",
        "src/packages/core-host/**/*.ts",
        "src/packages/features/**/*.ts",
      ],
      exclude: [
        "src/packages/workbench/_tauri/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/__test__/tauri_mocks/**",
        "**/*.d.ts",
      ],
    },
  },
});
