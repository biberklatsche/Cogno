const packageRootPattern = "^src/packages/";
const coreSdkPattern = "^src/packages/core-sdk/";
const coreHostPattern = "^src/packages/core-host/";
const coreUiPattern = "^src/packages/core-ui/";
const featuresPattern = "^src/packages/features/";
const workbenchPattern = "^src/packages/workbench/";
const knownCognoAliasPattern =
  "^@cogno/(?!app(?:$|/)|workbench(?:$|/)|features(?:$|/)|core-sdk(?:$|/)|core-host(?:$|/)|core-ui(?:$|/)|pro-features(?:$|/)).+";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-sdk-is-isolated",
      severity: "error",
      comment: "core-sdk must not import other internal modules.",
      from: { path: coreSdkPattern },
      to: { path: "^(src/packages/workbench|src/packages/core-host|src/packages/features)/" },
    },
    {
      name: "core-host-must-not-import-workbench",
      severity: "error",
      comment: "core-host must not depend on the UI and host workbench.",
      from: { path: coreHostPattern },
      to: { path: workbenchPattern },
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
      to: { path: "^(src/packages/workbench|src/packages/core-sdk|src/packages/core-host|src/packages/features)/" },
    },
    {
      name: "features-must-not-import-workbench-or-core-host",
      severity: "error",
      comment: "features must not depend on workbench or core-host.",
      from: { path: featuresPattern },
      to: { path: "^(src/packages/workbench|src/packages/core-host)/" },
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
