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
        replacement: "/src/app/__test__/mocks/xterm-addon-ligatures-mock.ts",
      },
    ],
    include: [
      "src/app/src/**/*.spec.ts",
      "src/core-host/**/*.spec.ts",
      "src/features-community/**/*.spec.ts",
      "src/features-pro/**/*.spec.ts",
    ],
    exclude: [
      "src/app/src/terminal/+state/advanced/autocomplete/spec/imported/commands/**/*.spec.ts",
    ],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/app/src/**/*.ts",
        "src/core-host/**/*.ts",
        "src/features-community/**/*.ts",
        "src/features-pro/**/*.ts",
      ],
      exclude: [
        "src/app/src/_tauri/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/__test__/tauri_mocks/**",
        "**/*.d.ts",
      ],
    },
  },
});
