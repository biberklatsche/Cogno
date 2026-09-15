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
        replacement: "/src/__test__/mocks/xterm-addon-ligatures-mock.ts",
      },
    ],
    include: [
      "src/app/**/*.spec.ts",
      "src/platform/**/*.spec.ts",
      "src/shared/**/*.spec.ts",
      "src/features/**/*.spec.ts",
      "src/core/**/*.spec.ts",
      "src/bootstrap/**/*.spec.ts",
    ],
    exclude: [
      "src/core/session/autocomplete/spec/imported/commands/**/*.spec.ts",
      "src/shared/ui/icons/icon/icon.component.spec.ts",
    ],
    coverage: {
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/app/**/*.ts",
        "src/shared/**/*.ts",
        "src/features/**/*.ts",
        "src/core/**/*.ts",
        "src/bootstrap/**/*.ts",
      ],
      exclude: [
        "src/app/_tauri/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/__test__/tauri_mocks/**",
        "**/*.d.ts",
      ],
    },
  },
});
