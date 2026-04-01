const packageRootPattern = "^src/packages/";
const productsPattern = "^(src/products/|src/packages/products/)";
const bootstrapPattern = "^src/app/";
const coreDomainPattern = "^src/packages/core-domain/";
const coreApiPattern = "^src/packages/core-api/";
const coreHostPattern = "^src/packages/core-host/";
const coreUiPattern = "^src/packages/core-ui/";
const coreSupportPattern = "^src/packages/core-support/";
const featuresPattern = "^src/packages/features/";
const appAngularPattern = "^(src/packages/app-angular/|src/packages/app/)";
const appTauriPattern = "^(src/packages/app-tauri/|src/packages/app/_tauri/)";
const appPackagePattern = "^src/packages/app/";
const knownCognoAliasPattern =
  "^@cogno/(?!app(?:$|/)|app-setup(?:$|/)|app-angular(?:$|/)|app-tauri(?:$|/)|features(?:$|/)|products(?:$|/)|core-domain(?:$|/)|core-api(?:$|/)|core-host(?:$|/)|core-ui(?:$|/)|core-support(?:$|/)|pro-features(?:$|/)).+";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-domain-must-not-import-app-angular",
      severity: "error",
      comment: "core-domain must not depend on app-angular.",
      from: { path: coreDomainPattern },
      to: { path: appAngularPattern },
    },
    {
      name: "core-domain-must-not-import-app-tauri",
      severity: "error",
      comment: "core-domain must not depend on app-tauri.",
      from: { path: coreDomainPattern },
      to: { path: appTauriPattern },
    },
    {
      name: "core-domain-must-not-import-features",
      severity: "error",
      comment: "core-domain must not depend on features.",
      from: { path: coreDomainPattern },
      to: { path: featuresPattern },
    },
    {
      name: "core-domain-must-not-import-products",
      severity: "error",
      comment: "core-domain must not depend on products.",
      from: { path: coreDomainPattern },
      to: { path: productsPattern },
    },
    {
      name: "core-domain-must-not-import-angular",
      severity: "error",
      comment: "core-domain must not depend on Angular.",
      from: { path: coreDomainPattern },
      to: { path: "^@angular/" },
    },
    {
      name: "core-domain-must-not-import-tauri",
      severity: "error",
      comment: "core-domain must not depend on Tauri.",
      from: { path: coreDomainPattern },
      to: { path: "^@tauri-apps/" },
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
      name: "core-api-must-not-import-products",
      severity: "error",
      comment: "core-api must not depend on products.",
      from: { path: coreApiPattern },
      to: { path: productsPattern },
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
      name: "core-host-must-not-import-products",
      severity: "error",
      comment: "core-host must not depend on products.",
      from: { path: coreHostPattern },
      to: { path: productsPattern },
    },
    {
      name: "core-ui-is-isolated",
      severity: "error",
      comment: "core-ui must not import other internal modules.",
      from: { path: coreUiPattern },
      to: { path: "^(src/packages/app|src/packages/core-host|src/packages/features)/" },
    },
    {
      name: "core-ui-must-not-import-products",
      severity: "error",
      comment: "core-ui must not depend on products.",
      from: { path: coreUiPattern },
      to: { path: productsPattern },
    },
    {
      name: "core-support-must-be-frameworkfree",
      severity: "error",
      comment: "core-support must remain framework-free and reusable.",
      from: { path: coreSupportPattern },
      to: { path: "^(src/packages/app|src/packages/core-host|src/packages/features|src/products/|src/packages/products/|@angular/|@tauri-apps/)" },
    },
    {
      name: "features-must-not-import-app-or-core-host",
      severity: "error",
      comment: "features must not depend on app or core-host.",
      from: { path: featuresPattern },
      to: { path: "^(src/packages/app|src/packages/core-host)/" },
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
      name: "features-must-not-import-products",
      severity: "error",
      comment: "features must not depend on products.",
      from: { path: featuresPattern },
      to: { path: productsPattern },
    },
    {
      name: "app-angular-must-not-import-features",
      severity: "error",
      comment: "app-angular must not depend on concrete features.",
      from: { path: appAngularPattern },
      to: { path: featuresPattern },
    },
    {
      name: "app-angular-must-not-import-products",
      severity: "error",
      comment: "app-angular must not depend on products.",
      from: { path: appAngularPattern },
      to: { path: productsPattern },
    },
    {
      name: "app-tauri-must-not-import-features",
      severity: "error",
      comment: "app-tauri must not depend on concrete features outside explicit compose/bootstrap boundaries.",
      from: { path: appTauriPattern },
      to: { path: featuresPattern },
    },
    {
      name: "app-tauri-must-not-import-products",
      severity: "error",
      comment: "app-tauri must not depend on products.",
      from: { path: appTauriPattern },
      to: { path: productsPattern },
    },
    {
      name: "internal-layers-must-not-import-bootstrap",
      severity: "error",
      comment: "Reusable packages and products must not depend on bootstrap entry points.",
      from: { path: "^(src/packages/|src/products/|src/packages/products/)" },
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
