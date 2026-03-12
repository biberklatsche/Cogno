/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-sdk-is-isolated",
      severity: "error",
      comment: "core-sdk darf keine anderen Module importieren.",
      from: { path: "^src/core-sdk/" },
      to: { path: "^src/(app|core-host|features-community|features-pro)/" },
    },
    {
      name: "core-host-must-not-import-app",
      severity: "error",
      comment: "core-host darf app nicht importieren.",
      from: { path: "^src/core-host/" },
      to: { path: "^src/app/" },
    },
    {
      name: "core-host-must-not-import-features",
      severity: "error",
      comment: "core-host darf nicht von konkreten Features abhängen.",
      from: { path: "^src/core-host/" },
      to: { path: "^src/(features-community|features-pro)/" },
    },
    {
      name: "core-ui-is-isolated",
      severity: "error",
      comment: "core-ui darf keine anderen internen Module importieren.",
      from: { path: "^src/core-ui/" },
      to: { path: "^src/(app|core-sdk|core-host|features-community|features-pro)/" },
    },
    {
      name: "community-features-only-core-sdk",
      severity: "error",
      comment: "features-community darf nur gegen core-sdk und core-ui entwickeln.",
      from: { path: "^src/features-community/" },
      to: { path: "^src/(app|core-host|features-pro)/" },
    },
    {
      name: "pro-features-only-core-sdk",
      severity: "error",
      comment: "features-pro darf nur gegen core-sdk und core-ui entwickeln.",
      from: { path: "^src/features-pro/" },
      to: { path: "^src/(app|core-host|features-community)/" },
    },
    {
      name: "known-cogno-aliases-only",
      severity: "error",
      comment: "Nur definierte @cogno/* Aliase sind erlaubt.",
      from: { path: "^src/" },
      to: {
        dependencyTypes: ["unknown"],
        path: "^@cogno/(?!app$|core-sdk$|core-host$|core-ui$|community-features$|pro-features$).+",
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
        "^src/app/assets/",
        "\\.spec\\.ts$",
        "\\.test\\.ts$",
      ],
    },
  },
};
