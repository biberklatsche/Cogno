const packageRootPattern = "^src/packages/";
const bootstrapPattern = "^src/app/";
const sharedPattern = "^src/packages/shared/";
const sharedDomainPattern = "^src/packages/shared/(domain|support)/";
const coreApiPattern = "^src/packages/core-api/";
const featuresPattern = "^src/packages/features/";
const appAngularPattern = "^(src/packages/app-angular/|src/packages/app/)";
const appTauriPattern = "^(src/packages/app-tauri/|src/packages/app/_tauri/)";
const appPackagePattern = "^src/packages/app/";
const knownCognoAliasPattern =
  "^@cogno/(?!app(?:$|/)|app-setup(?:$|/)|app-angular(?:$|/)|app-tauri(?:$|/)|features(?:$|/)|core-api(?:$|/)|shared(?:$|/)).+";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "shared-knows-nothing-about-the-app",
      severity: "error",
      comment:
        "shared must not depend on app, features, the platform layer or Tauri. (core-api is still allowed until it is dissolved in architecture step 4.)",
      from: { path: sharedPattern },
      to: { path: "^(src/packages/app|src/packages/app-tauri|src/packages/features|src/app)/|^@tauri-apps/" },
    },
    {
      name: "shared-domain-is-frameworkfree",
      severity: "error",
      comment: "shared/domain and shared/support must not depend on Angular or RxJS.",
      from: { path: sharedDomainPattern },
      to: { path: "^(@angular/|rxjs)" },
    },
    {
      name: "core-api-must-not-import-angular",
      severity: "error",
      comment: "core-api must not depend on Angular.",
      from: { path: coreApiPattern },
      to: { path: "^@angular/" },
    },
    {
      name: "core-api-must-not-import-tauri",
      severity: "error",
      comment: "core-api must not depend on Tauri.",
      from: { path: coreApiPattern },
      to: { path: "^@tauri-apps/" },
    },
    {
      name: "core-api-must-not-import-app-angular",
      severity: "error",
      comment: "core-api must not depend on app-angular.",
      from: { path: coreApiPattern },
      to: { path: appAngularPattern },
    },
    {
      name: "core-api-must-not-import-app-tauri",
      severity: "error",
      comment: "core-api must not depend on app-tauri.",
      from: { path: coreApiPattern },
      to: { path: appTauriPattern },
    },
    {
      name: "core-api-must-not-import-features",
      severity: "error",
      comment: "core-api must not depend on features.",
      from: { path: coreApiPattern },
      to: { path: featuresPattern },
    },
    {
      name: "core-api-must-not-contain-feature-aggregations",
      severity: "warn",
      comment: "core-api must not import feature-level aggregation or default-value files. These belong in the features package. Catches files whose names suggest collected/default state rather than contracts.",
      from: { path: coreApiPattern },
      to: { path: "(feature-settings-extension|feature-.*-defaults?|.*-aggregation|.*-collection\\.ts$)" },
    },
    {
      name: "features-must-not-import-app",
      severity: "error",
      comment: "features must not depend on app.",
      from: { path: featuresPattern },
      to: { path: "^src/packages/app/" },
    },
    {
      name: "features-must-not-import-app-angular",
      severity: "error",
      comment: "features must not depend on app-angular.",
      from: { path: featuresPattern },
      to: { path: appAngularPattern },
    },
    {
      name: "features-must-not-import-app-tauri",
      severity: "error",
      comment: "features must not depend on app-tauri.",
      from: { path: featuresPattern },
      to: { path: appTauriPattern },
    },
    {
      name: "app-angular-must-not-import-features",
      severity: "error",
      comment: "app-angular must not depend on concrete features.",
      from: { path: appAngularPattern },
      to: { path: featuresPattern },
    },
    {
      name: "features-must-not-depend-on-feature-orchestration-in-app",
      severity: "error",
      comment: "Feature-specific orchestration services (e.g. *-host-application.service) must not be imported by features — they belong in app-host adapters only.",
      from: { path: featuresPattern },
      to: { path: "app-host.*-application\\.service\\.ts$" },
    },
    {
      name: "app-tauri-must-not-import-features",
      severity: "error",
      comment: "app-tauri must not depend on concrete features outside explicit compose/bootstrap boundaries.",
      from: { path: appTauriPattern },
      to: { path: featuresPattern },
    },
    {
      name: "app-tauri-must-not-import-app",
      severity: "error",
      comment:
        "app-tauri is the Tauri adapter layer below app: it implements core-api ports and must not reach up into app.",
      from: { path: appTauriPattern },
      to: { path: appPackagePattern, pathNot: "^src/packages/app/_tauri/" },
    },
    {
      name: "internal-layers-must-not-import-bootstrap",
      severity: "error",
      comment: "Reusable packages must not depend on bootstrap entry points.",
      from: { path: "^src/packages/" },
      to: { path: bootstrapPattern },
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
    tsPreCompilationDeps: true,
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
