// The six rules of ARCHITECTURE.md. `pnpm lint:architecture` fails on a violation.
const appPattern = "^src/packages/app/";
const featuresPattern = "^src/packages/features/";
const platformPattern = "^src/packages/platform/";
const sharedPattern = "^src/packages/shared/";
const sharedFrameworkFreePattern = "^src/packages/shared/(domain|support)/";
const testSupportPattern = "^src/packages/__test__/";
const knownCognoAliasPattern = "^@cogno/(?!app(?:$|/)|features(?:$|/)|platform(?:$|/)|shared(?:$|/)).+";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "1-only-platform-talks-to-tauri",
      severity: "error",
      comment: "Only platform imports @tauri-apps/*; everything else goes through its services.",
      from: { path: "^src/", pathNot: `${platformPattern}|${testSupportPattern}` },
      to: { path: "^@tauri-apps/" },
    },
    {
      name: "2-shared-knows-nothing-about-the-app",
      severity: "error",
      comment: "shared imports no other internal package.",
      from: { path: sharedPattern },
      to: { path: `${appPattern}|${featuresPattern}|${platformPattern}` },
    },
    {
      name: "2-shared-domain-is-framework-free",
      severity: "error",
      comment: "shared/domain and shared/support import no framework.",
      from: { path: sharedFrameworkFreePattern },
      to: { path: "^(@angular/|rxjs)" },
    },
    {
      name: "3-platform-imports-only-shared",
      severity: "error",
      comment: "platform is the Tauri binding layer and must not reach into app or features.",
      from: { path: platformPattern },
      to: { path: `${appPattern}|${featuresPattern}` },
    },
    {
      name: "4-features-never-import-app",
      severity: "error",
      comment: "A feature that needs something from the app declares a port; it never imports app.",
      from: { path: featuresPattern },
      to: { path: appPattern },
    },
    {
      name: "4-features-import-each-other-through-index",
      severity: "error",
      comment: "A feature imports another feature only through that feature's index.ts.",
      from: { path: "^src/packages/features/([^/]+)/" },
      to: {
        path: "^src/packages/features/([^/]+)/.+",
        pathNot: "^src/packages/features/([^/]+)/index\\.ts$|^src/packages/features/$1/",
      },
    },
    {
      name: "5-nothing-imports-app",
      severity: "error",
      comment: "app is the root of the dependency line; nothing depends on it.",
      from: { path: "^src/", pathNot: `${appPattern}|${testSupportPattern}` },
      to: { path: appPattern },
    },
    {
      name: "6-known-aliases-only",
      severity: "error",
      comment: "Only the four @cogno/* aliases exist.",
      from: { path: "^src/" },
      to: { dependencyTypes: ["unknown"], path: knownCognoAliasPattern },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"],
    },
    tsPreCompilationDeps: true,
    exclude: {
      path: ["^dist/", "^coverage/", "^\\.angular/", "^src/packages/assets/src/assets/", "\\.spec\\.ts$", "\\.test\\.ts$"],
    },
  },
};
