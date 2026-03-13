/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-sdk-is-isolated",
      severity: "error",
      comment: "core-sdk darf keine anderen Module importieren.",
      from: { path: "^src/core-sdk/" },
      to: { path: "^(packages/app-shell|src/core-host|packages/base-features|src/features-pro)/" },
    },
    {
      name: "core-host-must-not-import-app",
      severity: "error",
      comment: "core-host darf app nicht importieren.",
      from: { path: "^src/core-host/" },
      to: { path: "^packages/app-shell/" },
    },
    {
      name: "core-host-must-not-import-features",
      severity: "error",
      comment: "core-host darf nicht von konkreten Features abhängen.",
      from: { path: "^src/core-host/" },
      to: { path: "^(packages/base-features|src/features-pro)/" },
    },
    {
      name: "core-ui-is-isolated",
      severity: "error",
      comment: "core-ui darf keine anderen internen Module importieren.",
      from: { path: "^src/core-ui/" },
      to: { path: "^(packages/app-shell|src/core-sdk|src/core-host|packages/base-features|src/features-pro)/" },
    },
    {
      name: "base-features-only-core-sdk",
      severity: "error",
      comment: "base-features darf nur gegen core-sdk und core-ui entwickeln.",
      from: { path: "^packages/base-features/" },
      to: { path: "^(packages/app-shell|src/core-host|src/features-pro)" },
    },
    {
      name: "pro-features-only-core-sdk",
      severity: "error",
      comment: "features-pro darf nur gegen core-sdk und core-ui entwickeln.",
      from: { path: "^src/features-pro/" },
      to: { path: "^(packages/app-shell|src/core-host|packages/base-features)" },
    },
    {
      name: "known-cogno-aliases-only",
      severity: "error",
      comment: "Nur definierte @cogno/* Aliase sind erlaubt.",
      from: { path: "^(src|packages)/" },
      to: {
        dependencyTypes: ["unknown"],
        path: "^@cogno/(?!app$|app-shell$|core-sdk$|core-host$|core-ui$|base-features$|pro-features$).+",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"],
    },
    exclude: {
      path: [
        "^dist/",
        "^coverage/",
        "^packages/app-assets/src/assets/",
        "\\.spec\\.ts$",
        "\\.test\\.ts$",
      ],
    },
  },
};
