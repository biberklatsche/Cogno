/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-sdk-is-isolated",
      severity: "error",
      comment: "core-sdk darf keine anderen Module importieren.",
      from: { path: "^src/packages/core-sdk/" },
      to: { path: "^(src/packages/app-shell|src/packages/core-host|src/packages/base-features)/" },
    },
    {
      name: "core-host-must-not-import-app",
      severity: "error",
      comment: "core-host darf app nicht importieren.",
      from: { path: "^src/packages/core-host/" },
      to: { path: "^src/packages/app-shell/" },
    },
    {
      name: "core-host-must-not-import-features",
      severity: "error",
      comment: "core-host darf nicht von konkreten Features abhängen.",
      from: { path: "^src/packages/core-host/" },
      to: { path: "^src/packages/base-features/" },
    },
    {
      name: "core-ui-is-isolated",
      severity: "error",
      comment: "core-ui darf keine anderen internen Module importieren.",
      from: { path: "^src/packages/core-ui/" },
      to: { path: "^(src/packages/app-shell|src/packages/core-sdk|src/packages/core-host|src/packages/base-features)/" },
    },
    {
      name: "base-features-only-core-sdk",
      severity: "error",
      comment: "base-features darf nur gegen core-sdk und core-ui entwickeln.",
      from: { path: "^src/packages/base-features/" },
      to: { path: "^(src/packages/app-shell|src/packages/core-host)" },
    },
    {
      name: "known-cogno-aliases-only",
      severity: "error",
      comment: "Nur definierte @cogno/* Aliase sind erlaubt.",
      from: { path: "^src/" },
      to: {
        dependencyTypes: ["unknown"],
        path: "^@cogno/(?!app(?:$|/)|app-shell$|core-sdk$|core-host$|core-ui$|base-features$|pro-features$).+",
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
        "^src/packages/app-assets/src/assets/",
        "\\.spec\\.ts$",
        "\\.test\\.ts$",
      ],
    },
  },
};
