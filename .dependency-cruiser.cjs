/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-sdk-is-isolated",
      severity: "error",
      comment: "core-sdk darf keine anderen Module importieren.",
      from: { path: "^src/core-sdk/" },
      to: { path: "^src/(app|core-host|open-features|pro-features)/" },
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
      to: { path: "^src/(open-features|pro-features)/" },
    },
    {
      name: "open-features-only-core-sdk",
      severity: "error",
      comment: "open-features darf nur gegen core-sdk entwickeln.",
      from: {
        path: "^src/open-features/",
        pathNot: "^src/open-features/terminal-search/",
      },
      to: { path: "^src/(app|core-host|pro-features)/" },
    },
    {
      name: "pro-features-only-core-sdk",
      severity: "error",
      comment: "pro-features darf nur gegen core-sdk entwickeln.",
      from: { path: "^src/pro-features/" },
      to: { path: "^src/(app|core-host|open-features)/" },
    },
    {
      name: "known-cogno-aliases-only",
      severity: "error",
      comment: "Nur definierte @cogno/* Aliase sind erlaubt.",
      from: { path: "^src/" },
      to: {
        dependencyTypes: ["unknown"],
        path: "^@cogno/(?!app$|core-sdk$|core-host$|open-features$|pro-features$).+",
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
