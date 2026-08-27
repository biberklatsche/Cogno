// Rules of ARCHITECTURE.md. `pnpm lint:architecture` fails on a violation.
//
// Block 1: the target architecture (ARCHITECTURE.md 2.1, import matrix).
// Block 2: the legacy four-package rules - valid while src/packages/app/ exists.
// Block 3: the transition rules - deleted in migration step 29.
const pkg = "^src/packages/";
const appPattern = "^src/packages/app/";
const featuresPattern = "^src/packages/features/";
const platformPattern = "^src/packages/platform/";
const sharedPattern = "^src/packages/shared/";
const sharedFrameworkFreePattern = "^src/packages/shared/(domain|support)/";
const corePattern = "^src/packages/core/";
const bootstrapPattern = "^src/packages/bootstrap/";
const testSupportPattern = "^src/packages/__test__/";
const knownCognoAliasPattern =
  "^@cogno/(?!app(?:$|/)|bootstrap(?:$|/)|core(?:$|/)|features(?:$|/)|platform(?:$|/)|shared(?:$|/)).+";

/** Everything in core/ except the named layer itself. */
const coreExcept = (...layers) =>
  `^src/packages/core/(?!(${layers.join("|")})/)`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ---- Block 1: target architecture (ARCHITECTURE.md 2.1, import matrix) ----
    {
      name: "t1-shared-imports-nothing-internal",
      severity: "error",
      comment: "shared is the foundation and knows no other package.",
      from: { path: sharedPattern },
      to: { path: `${platformPattern}|${corePattern}|${featuresPattern}|${bootstrapPattern}` },
    },
    {
      name: "t2-shared-domain-is-framework-free",
      severity: "error",
      comment: "shared/domain and shared/support import no framework.",
      from: { path: sharedFrameworkFreePattern },
      to: { path: "^(@angular/|rxjs)" },
    },
    {
      name: "t3-platform-imports-only-shared",
      severity: "error",
      comment: "platform is the Tauri boundary; it knows no product layer.",
      from: { path: platformPattern },
      to: { path: `${corePattern}|${featuresPattern}|${bootstrapPattern}` },
    },
    {
      name: "t4-only-platform-talks-to-tauri",
      severity: "error",
      comment: "Only platform imports @tauri-apps/*; everything else goes through its services.",
      from: { path: "^src/", pathNot: `${platformPattern}|${testSupportPattern}` },
      to: { path: "^@tauri-apps/" },
    },
    {
      name: "t5-infrastructure-knows-no-product-layer",
      severity: "error",
      comment: "infrastructure knows neither a session nor the layout.",
      from: { path: `${corePattern}infrastructure/` },
      to: {
        path: `${coreExcept("infrastructure")}|${featuresPattern}|${bootstrapPattern}`,
      },
    },
    {
      name: "t6-terminal-is-the-machine",
      severity: "error",
      comment: "The machine imports nothing else from core - not even infrastructure.",
      from: { path: `${corePattern}terminal/` },
      to: { path: `${coreExcept("terminal")}|${featuresPattern}|${bootstrapPattern}` },
    },
    {
      name: "t7-command-log-uses-only-infrastructure",
      severity: "error",
      comment: "command-log owns the data; it knows no session and no layout.",
      from: { path: `${corePattern}command-log/` },
      to: {
        path: `${coreExcept("command-log", "infrastructure")}|${featuresPattern}|${bootstrapPattern}`,
      },
    },
    {
      name: "t8-session-knows-no-workbench",
      severity: "error",
      comment: "A session does not know whether it is displayed. It publishes facts.",
      from: { path: `${corePattern}session/` },
      to: {
        path: `${coreExcept("session", "terminal", "command-log", "infrastructure")}|${featuresPattern}|${bootstrapPattern}`,
      },
    },
    {
      name: "t9-workbench-knows-no-machine-and-no-api",
      severity: "error",
      comment: "The workbench owns sessions as hosts; it never touches the machine or the api.",
      from: { path: `${corePattern}workbench/` },
      to: {
        path: `${coreExcept("workbench", "session", "command-log", "infrastructure")}|${featuresPattern}|${bootstrapPattern}`,
      },
    },
    {
      name: "t10-api-knows-no-features-and-no-machine",
      severity: "error",
      comment: "The api is the view features get; it composes session and workbench.",
      from: { path: `${corePattern}api/` },
      to: {
        path: `${coreExcept("api", "workbench", "session", "command-log", "infrastructure")}|${featuresPattern}|${bootstrapPattern}`,
      },
    },
    {
      name: "t11-features-see-only-the-api",
      severity: "error",
      comment: "Features import shared, platform and core/api - nothing else from core.",
      from: { path: featuresPattern },
      to: { path: `${coreExcept("api")}|${bootstrapPattern}` },
    },
    {
      name: "t12-features-import-each-other-through-index",
      severity: "error",
      comment: "A feature imports another feature only through that feature's index.ts.",
      from: { path: "^src/packages/features/([^/]+)/" },
      to: {
        path: "^src/packages/features/([^/]+)/.+",
        pathNot: "^src/packages/features/([^/]+)/index\\.ts$|^src/packages/features/$1/",
      },
    },
    {
      name: "t13-nothing-imports-bootstrap",
      severity: "error",
      comment: "bootstrap is the composition root; nothing depends on it.",
      from: { path: pkg, pathNot: `${bootstrapPattern}|${testSupportPattern}` },
      to: { path: bootstrapPattern },
    },
    {
      name: "t14-known-aliases-only",
      severity: "error",
      comment: "Only the five @cogno/* aliases exist (@cogno/app is frozen legacy).",
      from: { path: "^src/" },
      to: { dependencyTypes: ["unknown"], path: knownCognoAliasPattern },
    },

    // ---- Block 2: legacy four-package rules - deleted in migration step 29 ----
    {
      name: "l1-shared-knows-nothing-about-the-app",
      severity: "error",
      comment: "shared imports no other internal package.",
      from: { path: sharedPattern },
      to: { path: `${appPattern}|${featuresPattern}|${platformPattern}` },
    },
    {
      name: "l2-platform-does-not-import-app",
      severity: "error",
      comment: "platform is the Tauri binding layer and must not reach into app or features.",
      from: { path: platformPattern },
      to: { path: `${appPattern}|${featuresPattern}` },
    },
    {
      name: "l3-features-never-import-app",
      severity: "error",
      comment: "A feature that needs something from the app declares a port; it never imports app.",
      from: { path: featuresPattern },
      to: { path: appPattern },
    },
    {
      name: "l4-nothing-imports-app",
      severity: "error",
      comment: "app is the root of the dependency line; nothing depends on it.",
      from: { path: "^src/", pathNot: `${appPattern}|${testSupportPattern}` },
      to: { path: appPattern },
    },

    // ---- Block 3: transition rules - deleted in migration step 29 ----
    // The frozen @cogno/app alias is guarded by scripts/architecture-guard.mjs:
    // depcruise matches resolved paths, so an alias cannot be forbidden by name.
    {
      name: "x1-target-never-imports-legacy",
      severity: "error",
      comment:
        "Nothing in the target layout imports app/. bootstrap/ is exempt until step 28: it is the composition root and wires the old world while it exists.",
      from: { path: corePattern },
      to: { path: appPattern },
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
