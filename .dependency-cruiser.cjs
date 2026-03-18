const packageRootPattern = "^src/packages/";
const coreSdkPattern = "^src/packages/core-sdk/";
const coreHostPattern = "^src/packages/core-host/";
const coreUiPattern = "^src/packages/core-ui/";
const featuresPattern = "^src/packages/features/";
const appPackagePattern = "^src/packages/app/";
const knownCognoAliasPattern =
  "^@cogno/(?!app(?:$|/)|app-setup(?:$|/)|features(?:$|/)|core-sdk(?:$|/)|core-host(?:$|/)|core-ui(?:$|/)|pro-features(?:$|/)).+";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-sdk-is-isolated",
      severity: "error",
      comment: "core-sdk must not import other internal modules.",
      from: { path: coreSdkPattern },
      to: { path: "^(src/packages/app|src/packages/core-host|src/packages/features)/" },
    },
    {
      name: "core-host-must-not-import-app",
      severity: "error",
      comment: "core-host must not depend on the reusable app implementation.",
      from: { path: coreHostPattern },
      to: { path: appPackagePattern },
    },
    {
      name: "core-host-must-not-import-features",
      severity: "error",
      comment: "core-host must not depend on concrete features.",
      from: { path: coreHostPattern },
      to: { path: featuresPattern },
    },
    {
      name: "core-ui-is-isolated",
      severity: "error",
      comment: "core-ui must not import other internal modules.",
      from: { path: coreUiPattern },
      to: { path: "^(src/packages/app|src/packages/core-sdk|src/packages/core-host|src/packages/features)/" },
    },
    {
      name: "features-must-not-import-app-or-core-host",
      severity: "error",
      comment: "features must not depend on app or core-host.",
      from: { path: featuresPattern },
      to: { path: "^(src/packages/app|src/packages/core-host)/" },
    },
    {
      name: "known-cogno-aliases-only",
      severity: "error",
      comment: "Only defined @cogno/* aliases are allowed.",
      from: { path: packageRootPattern },
      to: {
        dependencyTypes: ["unknown"],
        path: knownCognoAliasPattern,
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
        "^\\.angular/",
        "^src/packages/assets/src/assets/",
        "\\.spec\\.ts$",
        "\\.test\\.ts$",
      ],
    },
  },
};
