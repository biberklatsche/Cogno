#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { request as createHttpRequest } from "node:http";
import { request as createHttpsRequest } from "node:https";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { URL } from "node:url";

const artifactRootDirectoryPath = "release-artifacts";
const packageJsonPath = "package.json";
const releaseSettingsFilePath = join(homedir(), ".cogno-secrets", "release.settings.json");
const tauriCargoTomlPath = "src-tauri/Cargo.toml";
const tauriConfigPath = "src-tauri/tauri.conf.json";
const supportedChannels = ["dev", "release"];
const supportedPlatforms = {
  darwin: "macos",
  linux: "linux",
  win32: "windows",
};
const defaultRequiredPlatforms = ["macos", "windows", "linux"];

await main();

async function main() {
  const parsedArguments = parseCommandLineArguments(process.argv.slice(2));

  if (parsedArguments.help) {
    printHelp();
    return;
  }

  const currentPlatformName = resolveCurrentPlatformName();
  const releaseChannel = parsedArguments.channel ?? "release";

  validateChannel(releaseChannel);
  validateCommandLineArguments(parsedArguments);

  if (!parsedArguments.allowDirtyWorkingTree) {
    assertWorkingTreeIsClean();
  }

  const projectVersion = resolveValidatedProjectVersion();
  const releaseTag =
    parsedArguments.tag ??
    (parsedArguments.testBuild ? createTestBuildTag(projectVersion) : resolveHeadTag());
  const releaseVersion = parsedArguments.testBuild
    ? projectVersion
    : normalizeTagToVersion(releaseTag);

  if (!parsedArguments.testBuild) {
    validateVersionConsistency(releaseVersion, projectVersion);
  }

  const releaseSettings = loadReleaseSettings({
    releaseChannel,
  });
  const releaseNotes = resolveReleaseNotes({
    parsedArguments,
    releaseSettings,
  });

  if (parsedArguments.finalize) {
    const finalizedReleaseDirectoryPath = await finalizeRelease({
      releaseChannel,
      releaseNotes,
      releaseSettings,
      releaseTag,
      releaseVersion,
    });

    printFinalizeSummary({
      finalizedReleaseDirectoryPath,
      releaseChannel,
      releaseTag,
      releaseVersion,
    });

    return;
  }

  const releaseOutputDirectoryPath = join(
    artifactRootDirectoryPath,
    "staged",
    releaseTag,
    currentPlatformName,
  );

  recreateDirectory(releaseOutputDirectoryPath);

  if (!parsedArguments.skipBuild) {
    runBuild({
      currentPlatformName,
      releaseTag,
      releaseVersion,
    });
  }

  const collectedArtifacts = collectArtifacts({
    currentPlatformName,
    releaseOutputDirectoryPath,
    releaseVersion,
  });

  if (collectedArtifacts.length === 0) {
    throw new Error(`No artifacts found for platform "${currentPlatformName}".`);
  }

  const manifest = createManifest({
    collectedArtifacts,
    currentPlatformName,
    releaseChannel,
    releaseTag,
    releaseVersion,
  });
  const manifestPath = join(releaseOutputDirectoryPath, "manifest.json");

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const shouldSkipUpload = parsedArguments.skipUpload || parsedArguments.testBuild;

  if (!shouldSkipUpload) {
    await uploadStagedArtifacts({
      releaseChannel,
      releaseOutputDirectoryPath,
      releaseSettings,
      releaseTag,
      currentPlatformName,
    });
  }

  printBuildSummary({
    collectedArtifacts,
    currentPlatformName,
    manifestPath,
    releaseChannel,
    releaseOutputDirectoryPath,
    releaseTag,
    shouldSkipUpload,
  });
}

function parseCommandLineArguments(commandLineArguments) {
  const parsedArguments = {
    allowDirtyWorkingTree: false,
    finalize: false,
    help: false,
    skipBuild: false,
    skipUpload: false,
    testBuild: false,
  };

  for (
    let currentArgumentIndex = 0;
    currentArgumentIndex < commandLineArguments.length;
    currentArgumentIndex += 1
  ) {
    const currentArgument = commandLineArguments[currentArgumentIndex];
    const nextArgument = commandLineArguments[currentArgumentIndex + 1];

    switch (currentArgument) {
      case "--":
        break;
      case "--help":
      case "-h":
        parsedArguments.help = true;
        break;
      case "--tag":
        parsedArguments.tag = requireArgumentValue(currentArgument, nextArgument);
        currentArgumentIndex += 1;
        break;
      case "--channel":
        parsedArguments.channel = requireArgumentValue(currentArgument, nextArgument);
        currentArgumentIndex += 1;
        break;
      case "--notes-file":
        parsedArguments.notesFilePath = requireArgumentValue(currentArgument, nextArgument);
        currentArgumentIndex += 1;
        break;
      case "--skip-build":
        parsedArguments.skipBuild = true;
        break;
      case "--skip-upload":
        parsedArguments.skipUpload = true;
        break;
      case "--test":
        parsedArguments.testBuild = true;
        break;
      case "--allow-dirty":
        parsedArguments.allowDirtyWorkingTree = true;
        break;
      case "--finalize":
        parsedArguments.finalize = true;
        break;
      default:
        throw new Error(`Unknown argument "${currentArgument}". Use --help for usage information.`);
    }
  }

  return parsedArguments;
}

function validateCommandLineArguments(parsedArguments) {
  if (parsedArguments.testBuild && parsedArguments.tag !== undefined) {
    throw new Error('The arguments "--test" and "--tag" cannot be combined.');
  }

  if (parsedArguments.finalize && parsedArguments.testBuild) {
    throw new Error('The arguments "--finalize" and "--test" cannot be combined.');
  }

  if (parsedArguments.finalize && parsedArguments.skipBuild) {
    throw new Error('The arguments "--finalize" and "--skip-build" cannot be combined.');
  }
}

function printHelp() {
  console.log("Local release builder for Cogno2");
  console.log("");
  console.log("Build current platform:");
  console.log("  pnpm run release:build -- --channel release");
  console.log("");
  console.log("Finalize after all three platforms are built:");
  console.log("  pnpm run release:build -- --channel release --finalize");
  console.log("");
  console.log("Local test without tag:");
  console.log("  pnpm run release:build -- --test");
  console.log("");
  console.log("Options:");
  console.log("  --tag <tag>         Build or finalize metadata for a specific Git tag.");
  console.log("  --test              Local test build without Git tag and without upload.");
  console.log("  --channel <value>   dev | release (default: release)");
  console.log("  --notes-file <path> Optional release notes file for latest/updater metadata.");
  console.log("  --skip-build        Reuse existing bundle output.");
  console.log("  --skip-upload       Build only, do not upload.");
  console.log("  --finalize          Publish latest metadata.");
  console.log("  --allow-dirty       Allow a dirty working tree.");
  console.log("  --help              Show this help.");
  console.log("");
  console.log("Config file:");
  console.log(`  ${releaseSettingsFilePath}`);
}

function printBuildSummary({
  collectedArtifacts,
  currentPlatformName,
  manifestPath,
  releaseChannel,
  releaseOutputDirectoryPath,
  releaseTag,
  shouldSkipUpload,
}) {
  console.log("");
  console.log("Release build completed.");
  console.log(`Tag: ${releaseTag}`);
  console.log(`Channel: ${releaseChannel}`);
  console.log(`Platform: ${currentPlatformName}`);
  console.log(`Artifacts: ${collectedArtifacts.length}`);
  console.log(`Upload skipped: ${shouldSkipUpload ? "yes" : "no"}`);
  console.log(`Output directory: ${resolve(releaseOutputDirectoryPath)}`);
  console.log(`Manifest: ${resolve(manifestPath)}`);
}

function printFinalizeSummary({
  finalizedReleaseDirectoryPath,
  releaseChannel,
  releaseTag,
  releaseVersion,
}) {
  console.log("");
  console.log("Release finalization completed.");
  console.log(`Tag: ${releaseTag}`);
  console.log(`Version: ${releaseVersion}`);
  console.log(`Channel: ${releaseChannel}`);
  console.log(`Output directory: ${resolve(finalizedReleaseDirectoryPath)}`);
}

function requireArgumentValue(argumentName, argumentValue) {
  if (argumentValue === undefined || argumentValue.startsWith("--")) {
    throw new Error(`Missing value for argument "${argumentName}".`);
  }

  return argumentValue;
}

function validateChannel(releaseChannel) {
  if (!supportedChannels.includes(releaseChannel)) {
    throw new Error(
      `Unsupported channel "${releaseChannel}". Supported channels: ${supportedChannels.join(", ")}.`,
    );
  }
}

function resolveCurrentPlatformName() {
  const currentPlatformName = supportedPlatforms[process.platform];

  if (currentPlatformName === undefined) {
    throw new Error(`Unsupported platform "${process.platform}".`);
  }

  return currentPlatformName;
}

function assertWorkingTreeIsClean() {
  const gitStatusOutput = runCommandAndCollectOutput("git", ["status", "--porcelain"]);

  if (gitStatusOutput.trim().length > 0) {
    throw new Error("Working tree is dirty. Commit or stash changes, or use --allow-dirty.");
  }
}

function resolveHeadTag() {
  const tagsAtHeadOutput = runCommandAndCollectOutput("git", ["tag", "--points-at", "HEAD"]);
  const tagsAtHead = tagsAtHeadOutput
    .split("\n")
    .map((currentTag) => currentTag.trim())
    .filter(Boolean);

  if (tagsAtHead.length === 0) {
    throw new Error("HEAD is not tagged. Use --tag <tag> or check out a tagged commit.");
  }

  return tagsAtHead.sort()[0];
}

function normalizeTagToVersion(releaseTag) {
  return releaseTag.startsWith("v") ? releaseTag.slice(1) : releaseTag;
}

function createTestBuildTag(projectVersion) {
  return `test-v${projectVersion}`;
}

function loadReleaseSettings({ releaseChannel }) {
  const settingsFilePath = releaseSettingsFilePath;
  const parsedSettings =
    existsSync(settingsFilePath) && statSync(settingsFilePath).isFile()
      ? parseReleaseSettingsFile(settingsFilePath)
      : {};
  const releaseChannelSettings = parsedSettings.channels?.[releaseChannel] ?? {};

  return {
    channels: parsedSettings.channels ?? {},
    apple: {
      appleId: parsedSettings.apple?.appleId,
      appleIdPassword: parsedSettings.apple?.appleIdPassword,
      signingIdentity: parsedSettings.apple?.signingIdentity,
      teamId: parsedSettings.apple?.teamId,
    },
    storage: {
      accessKeyId: parsedSettings.storage?.accessKeyId,
      basePath: parsedSettings.storage?.basePath ?? "cogno2",
      bucketName: parsedSettings.storage?.bucketName,
      endpoint: parsedSettings.storage?.endpoint,
      forcePathStyle: coerceBooleanValue(parsedSettings.storage?.forcePathStyle ?? true),
      publicBaseUrl: parsedSettings.storage?.publicBaseUrl,
      region: parsedSettings.storage?.region,
      secretAccessKey: parsedSettings.storage?.secretAccessKey,
    },
    settingsFilePath,
    updater: {
      enabled: coerceBooleanValue(parsedSettings.updater?.enabled),
      notesFilePath: parsedSettings.updater?.notesFilePath ?? releaseChannelSettings.notesFilePath,
      privateKey: parsedSettings.updater?.privateKey,
      privateKeyPassword: parsedSettings.updater?.privateKeyPassword,
      privateKeyPath: expandHomeDirectory(parsedSettings.updater?.privateKeyPath),
      publicKeyPath: expandHomeDirectory(parsedSettings.updater?.publicKeyPath),
    },
    requiredPlatforms: normalizeRequiredPlatforms(
      releaseChannelSettings.requiredPlatforms ?? parsedSettings.requiredPlatforms,
    ),
  };
}

function parseReleaseSettingsFile(settingsFilePath) {
  try {
    return JSON.parse(readFileSync(settingsFilePath, "utf-8"));
  } catch (error) {
    throw new Error(
      `Could not parse release settings file "${settingsFilePath}": ${error.message}`,
    );
  }
}

function coerceBooleanValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalizedValue)) {
      return true;
    }

    if (["0", "false", "no", "off", ""].includes(normalizedValue)) {
      return false;
    }
  }

  return false;
}

function normalizeRequiredPlatforms(requiredPlatforms) {
  if (!Array.isArray(requiredPlatforms) || requiredPlatforms.length === 0) {
    return [...defaultRequiredPlatforms];
  }

  const normalizedPlatforms = [...new Set(requiredPlatforms.map(String))];

  for (const currentPlatformName of normalizedPlatforms) {
    if (!defaultRequiredPlatforms.includes(currentPlatformName)) {
      throw new Error(
        `Unsupported required platform "${currentPlatformName}" in release settings.`,
      );
    }
  }

  return normalizedPlatforms.sort();
}

function expandHomeDirectory(pathValue) {
  if (typeof pathValue !== "string" || pathValue.length === 0) {
    return pathValue;
  }

  if (pathValue === "~") {
    return homedir();
  }

  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }

  return pathValue;
}

function resolveReleaseNotes({ parsedArguments, releaseSettings }) {
  const explicitNotesFilePath = normalizeOptionalString(parsedArguments.notesFilePath);
  const configuredNotesFilePath = normalizeOptionalString(releaseSettings.updater.notesFilePath);
  const releaseNotesFilePath = explicitNotesFilePath ?? configuredNotesFilePath;

  if (releaseNotesFilePath === undefined) {
    return undefined;
  }

  const resolvedNotesFilePath = expandHomeDirectory(releaseNotesFilePath);

  if (!existsSync(resolvedNotesFilePath)) {
    throw new Error(`Release notes file not found: ${resolvedNotesFilePath}`);
  }

  const releaseNotes = readFileSync(resolvedNotesFilePath, "utf-8").trim();

  if (releaseNotes.length === 0) {
    return undefined;
  }

  return releaseNotes;
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  return trimmedValue;
}

function resolveValidatedProjectVersion() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const packageVersion = packageJson.version;
  const cargoTomlContent = readFileSync(tauriCargoTomlPath, "utf-8");
  const cargoVersionMatch = cargoTomlContent.match(/^version = "([^"]+)"$/mu);

  if (cargoVersionMatch === null) {
    throw new Error(`Could not read version from ${tauriCargoTomlPath}.`);
  }

  const discoveredVersions = [
    { path: packageJsonPath, version: packageVersion },
    { path: tauriCargoTomlPath, version: cargoVersionMatch[1] },
    { path: tauriConfigPath, version: JSON.parse(readFileSync(tauriConfigPath, "utf-8")).version },
  ];

  const [firstVersionRecord] = discoveredVersions;

  for (const currentVersionRecord of discoveredVersions) {
    if (currentVersionRecord.version !== firstVersionRecord.version) {
      throw new Error(
        `Version mismatch between project files: expected "${firstVersionRecord.version}" but ${currentVersionRecord.path} contains "${currentVersionRecord.version}".`,
      );
    }
  }

  return firstVersionRecord.version;
}

function validateVersionConsistency(releaseVersion, projectVersion) {
  if (projectVersion !== releaseVersion) {
    throw new Error(
      `Version mismatch: tag resolves to "${releaseVersion}" but project files contain "${projectVersion}".`,
    );
  }
}

function recreateDirectory(directoryPath) {
  rmSync(directoryPath, { force: true, recursive: true });
  mkdirSync(directoryPath, { recursive: true });
}

function runBuild({ currentPlatformName, releaseTag, releaseVersion }) {
  console.log("");
  console.log(`Building ${releaseVersion} for ${currentPlatformName} from tag ${releaseTag}`);

  if (currentPlatformName === "macos") {
    buildMacosReleaseArtifacts();
    return;
  }

  runCommand("pnpm", ["build:desktop"], {
    environmentVariables: process.env,
    runnerType: "pnpm-run",
  });
}

function buildMacosReleaseArtifacts() {
  const dmgDirectoryPath = join("src-tauri", "target", "release", "bundle", "dmg");
  const tauriMacosBuildConfig = createTauriMacosBuildConfig();
  const macosBuildEnvironment = createMacosBuildEnvironment();
  const temporaryConfigDirectoryPath = mkdtempSync(join(tmpdir(), "cogno2-tauri-config-"));
  const temporaryConfigPath = join(temporaryConfigDirectoryPath, "tauri.macos.build.json");

  try {
    console.log("");
    console.log("Building macOS app bundle and DMG");
    writeFileSync(temporaryConfigPath, JSON.stringify(tauriMacosBuildConfig, null, 2));

    runCommand(
      "pnpm",
      ["exec", "tauri", "build", "--bundles", "app,dmg", "--config", temporaryConfigPath],
      {
        environmentVariables: macosBuildEnvironment,
      },
    );
  } finally {
    rmSync(temporaryConfigDirectoryPath, { force: true, recursive: true });
  }

  const discoveredDmgPath = resolveNewestMatchingFilePath({
    directoryPath: dmgDirectoryPath,
    fileExtension: ".dmg",
  });

  if (discoveredDmgPath === undefined) {
    throw new Error(`No DMG artifact found in directory: ${dmgDirectoryPath}`);
  }

  console.log(`DMG created: ${discoveredDmgPath}`);

  const appleCredentials = resolveAppleCredentials();
  const appleSigningIdentity = resolveAppleSigningIdentity();

  if (appleCredentials === undefined || appleSigningIdentity === undefined) {
    console.log("Skipping notarization because Apple credentials or signing identity are missing.");
    return;
  }

  console.log("");
  console.log("Notarizing DMG");
  runCommand("xcrun", [
    "notarytool",
    "submit",
    discoveredDmgPath,
    "--apple-id",
    appleCredentials.appleId,
    "--team-id",
    appleCredentials.teamId,
    "--password",
    appleCredentials.appleIdPassword,
    "--wait",
  ]);

  console.log("Stapling notarization ticket");
  runCommand("xcrun", ["stapler", "staple", discoveredDmgPath]);
}

function createTauriMacosBuildConfig() {
  const entitlementsPath = resolve("src-tauri", "entitlements.plist");
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf-8"));
  const appleSigningIdentity = resolveAppleSigningIdentity();
  const macosBundleConfig = {
    ...(tauriConfig.bundle?.macOS ?? {}),
  };

  if (appleSigningIdentity !== undefined && appleSigningIdentity.length > 0) {
    macosBundleConfig.signingIdentity = appleSigningIdentity;
    macosBundleConfig.entitlements ??= entitlementsPath;
  }

  return {
    ...tauriConfig,
    bundle: {
      ...tauriConfig.bundle,
      macOS: macosBundleConfig,
    },
  };
}

function resolveAppleCredentials() {
  const appleSettings = loadReleaseSettings({ releaseChannel: "release" }).apple;

  if (
    appleSettings.appleId === undefined ||
    appleSettings.appleIdPassword === undefined ||
    appleSettings.teamId === undefined
  ) {
    return undefined;
  }

  return {
    appleId: appleSettings.appleId,
    appleIdPassword: appleSettings.appleIdPassword,
    teamId: appleSettings.teamId,
  };
}

function resolveAppleSigningIdentity() {
  const appleSettings = loadReleaseSettings({ releaseChannel: "release" }).apple;
  const appleSigningIdentity = appleSettings.signingIdentity;

  if (typeof appleSigningIdentity !== "string" || appleSigningIdentity.length === 0) {
    return undefined;
  }

  return appleSigningIdentity;
}

function createMacosBuildEnvironment() {
  const appleCredentials = resolveAppleCredentials();
  const appleSigningIdentity = resolveAppleSigningIdentity();
  const macosBuildEnvironment = {
    ...process.env,
  };

  if (appleCredentials !== undefined) {
    macosBuildEnvironment.APPLE_ID = appleCredentials.appleId;
    macosBuildEnvironment.APPLE_PASSWORD = appleCredentials.appleIdPassword;
    macosBuildEnvironment.APPLE_TEAM_ID = appleCredentials.teamId;
  }

  if (appleSigningIdentity !== undefined) {
    macosBuildEnvironment.COGNO_APPLE_SIGNING_IDENTITY = appleSigningIdentity;
  }

  return macosBuildEnvironment;
}

function resolveNewestMatchingFilePath({ directoryPath, fileExtension }) {
  if (!existsSync(directoryPath)) {
    return undefined;
  }

  const discoveredFilePaths = readdirSync(directoryPath)
    .filter((currentFileName) => currentFileName.endsWith(fileExtension))
    .map((currentFileName) => join(directoryPath, currentFileName));

  if (discoveredFilePaths.length === 0) {
    return undefined;
  }

  return discoveredFilePaths.sort((leftFilePath, rightFilePath) => {
    const leftModificationTimestamp = statSync(leftFilePath).mtimeMs;
    const rightModificationTimestamp = statSync(rightFilePath).mtimeMs;

    return rightModificationTimestamp - leftModificationTimestamp;
  })[0];
}

function collectArtifacts({ currentPlatformName, releaseOutputDirectoryPath, releaseVersion }) {
  const sourceBundleDirectoryPath = join("src-tauri", "target", "release", "bundle");
  const discoveredArtifactPaths = findBundleArtifacts({
    currentPlatformName,
    sourceBundleDirectoryPath,
  }).sort((leftArtifactPath, rightArtifactPath) =>
    leftArtifactPath.localeCompare(rightArtifactPath),
  );
  const collectedArtifacts = [];
  const copiedArtifactFileNames = new Set();
  let macosApplicationArtifact;

  for (const currentArtifactPath of discoveredArtifactPaths) {
    const currentArtifactKind = determineArtifactKind(currentArtifactPath);
    const currentArtifactExtension = determineTargetArtifactExtension(currentArtifactPath);
    const targetArtifactFileName = createTargetArtifactFileName({
      currentArtifactExtension,
      currentArtifactKind,
      currentPlatformName,
      releaseVersion,
    });

    if (copiedArtifactFileNames.has(targetArtifactFileName)) {
      continue;
    }

    const targetArtifactPath = join(releaseOutputDirectoryPath, targetArtifactFileName);

    if (currentArtifactKind === "app") {
      createMacosApplicationArchive(currentArtifactPath, targetArtifactPath);
      macosApplicationArtifact = {
        fileName: targetArtifactFileName,
        kind: currentArtifactKind,
        path: targetArtifactPath,
        sourcePath: currentArtifactPath,
      };
    } else {
      copyArtifact(currentArtifactPath, targetArtifactPath);
    }

    copiedArtifactFileNames.add(targetArtifactFileName);

    collectedArtifacts.push({
      fileName: targetArtifactFileName,
      kind: currentArtifactKind,
      path: targetArtifactPath,
      sourcePath: currentArtifactPath,
    });
  }

  if (currentPlatformName === "macos" && macosApplicationArtifact !== undefined) {
    const updaterArtifactFileName = createTargetArtifactFileName({
      currentArtifactExtension: ".tar.gz",
      currentArtifactKind: "updater",
      currentPlatformName,
      releaseVersion,
    });

    if (!copiedArtifactFileNames.has(updaterArtifactFileName)) {
      const updaterArtifactPath = join(releaseOutputDirectoryPath, updaterArtifactFileName);

      createMacosUpdaterArchive(macosApplicationArtifact.sourcePath, updaterArtifactPath);
      copiedArtifactFileNames.add(updaterArtifactFileName);
      collectedArtifacts.push({
        fileName: updaterArtifactFileName,
        kind: "updater",
        path: updaterArtifactPath,
        sourcePath: macosApplicationArtifact.sourcePath,
      });
    }
  }

  return collectedArtifacts.sort((leftArtifact, rightArtifact) =>
    leftArtifact.fileName.localeCompare(rightArtifact.fileName),
  );
}

function findBundleArtifacts({ currentPlatformName, sourceBundleDirectoryPath }) {
  if (!existsSync(sourceBundleDirectoryPath)) {
    throw new Error(`Bundle directory not found: ${sourceBundleDirectoryPath}`);
  }

  const discoveredPaths = [];

  collectFileSystemEntriesRecursively(sourceBundleDirectoryPath, discoveredPaths);

  return discoveredPaths.filter((currentEntryPath) => {
    const currentEntryStats = statSync(currentEntryPath);

    if (currentEntryStats.isDirectory()) {
      return currentPlatformName === "macos" && currentEntryPath.endsWith(".app");
    }

    if (currentPlatformName === "linux") {
      return (
        currentEntryPath.endsWith(".AppImage") ||
        currentEntryPath.endsWith(".AppImage.sig") ||
        currentEntryPath.endsWith(".deb") ||
        currentEntryPath.endsWith(".rpm") ||
        currentEntryPath.endsWith(".tar.gz")
      );
    }

    if (currentPlatformName === "macos") {
      return (
        currentEntryPath.endsWith(".dmg") ||
        currentEntryPath.endsWith(".app.tar.gz") ||
        currentEntryPath.endsWith(".app.tar.gz.sig")
      );
    }

    if (currentPlatformName === "windows") {
      return (
        currentEntryPath.endsWith(".exe") ||
        currentEntryPath.endsWith(".exe.sig") ||
        currentEntryPath.endsWith(".msi") ||
        currentEntryPath.endsWith(".msi.sig")
      );
    }

    return false;
  });
}

function collectFileSystemEntriesRecursively(currentDirectoryPath, discoveredPaths) {
  const childEntryNames = readdirSync(currentDirectoryPath);

  for (const currentChildEntryName of childEntryNames) {
    const currentChildEntryPath = join(currentDirectoryPath, currentChildEntryName);
    const currentChildEntryStats = statSync(currentChildEntryPath);

    discoveredPaths.push(currentChildEntryPath);

    if (currentChildEntryStats.isDirectory() && !currentChildEntryPath.endsWith(".app")) {
      collectFileSystemEntriesRecursively(currentChildEntryPath, discoveredPaths);
    }
  }
}

function determineArtifactKind(artifactPath) {
  if (artifactPath.endsWith(".app")) {
    return "app";
  }

  if (artifactPath.endsWith(".app.tar.gz.sig")) {
    return "updater-signature";
  }

  if (artifactPath.endsWith(".app.tar.gz")) {
    return "updater";
  }

  if (artifactPath.endsWith(".AppImage.sig")) {
    return "appimage-signature";
  }

  if (artifactPath.endsWith(".AppImage")) {
    return "appimage";
  }

  if (artifactPath.endsWith(".msi.sig")) {
    return "msi-signature";
  }

  if (artifactPath.endsWith(".exe.sig")) {
    return artifactPath.includes(`${join("bundle", "nsis")}`) ? "nsis-signature" : "exe-signature";
  }

  if (artifactPath.endsWith(".tar.gz")) {
    return "tarball";
  }

  if (artifactPath.endsWith(".exe")) {
    return artifactPath.includes(`${join("bundle", "nsis")}`) ? "nsis" : "exe";
  }

  return extname(artifactPath).slice(1).toLowerCase();
}

function determineTargetArtifactExtension(artifactPath) {
  if (artifactPath.endsWith(".app")) {
    return ".zip";
  }

  if (
    artifactPath.endsWith(".app.tar.gz") ||
    artifactPath.endsWith(".tar.gz") ||
    artifactPath.endsWith(".app.tar.gz.sig") ||
    artifactPath.endsWith(".AppImage.sig") ||
    artifactPath.endsWith(".exe.sig") ||
    artifactPath.endsWith(".msi.sig")
  ) {
    if (artifactPath.endsWith(".sig")) {
      return ".sig";
    }

    return ".tar.gz";
  }

  if (artifactPath.endsWith(".AppImage")) {
    return ".AppImage";
  }

  return extname(artifactPath);
}

function createTargetArtifactFileName({
  currentArtifactExtension,
  currentArtifactKind,
  currentPlatformName,
  releaseVersion,
}) {
  return (
    ["cogno2", releaseVersion, currentPlatformName, process.arch, currentArtifactKind].join("-") +
    currentArtifactExtension
  );
}

function createMacosApplicationArchive(sourceApplicationPath, targetArchivePath) {
  runCommand("ditto", [
    "-c",
    "-k",
    "--keepParent",
    "--sequesterRsrc",
    sourceApplicationPath,
    targetArchivePath,
  ]);
}

function createMacosUpdaterArchive(sourceApplicationPath, targetArchivePath) {
  runCommand("tar", [
    "-czf",
    targetArchivePath,
    "-C",
    dirname(sourceApplicationPath),
    basename(sourceApplicationPath),
  ]);
}

function copyArtifact(sourceArtifactPath, targetArtifactPath) {
  const sourceArtifactStats = statSync(sourceArtifactPath);

  if (sourceArtifactStats.isDirectory()) {
    cpSync(sourceArtifactPath, targetArtifactPath, { recursive: true });
    return;
  }

  copyFileSync(sourceArtifactPath, targetArtifactPath);
}

function createManifest({
  collectedArtifacts,
  currentPlatformName,
  releaseChannel,
  releaseTag,
  releaseVersion,
}) {
  const preferredDownloadArtifact = resolvePreferredDownloadArtifact({
    collectedArtifacts,
    currentPlatformName,
  });
  const updaterArtifact = resolveUpdaterArtifact({
    collectedArtifacts,
    currentPlatformName,
  });

  return {
    architecture: process.arch,
    artifacts: collectedArtifacts.map((currentArtifact) => ({
      fileName: currentArtifact.fileName,
      kind: currentArtifact.kind,
      relativePath: currentArtifact.fileName,
      sourcePath: relative(process.cwd(), currentArtifact.sourcePath),
    })),
    channel: releaseChannel,
    createdAt: new Date().toISOString(),
    platform: currentPlatformName,
    preferredDownloadArtifactFileName: preferredDownloadArtifact?.fileName,
    tag: releaseTag,
    updater:
      updaterArtifact === undefined
        ? undefined
        : {
            artifactFileName: updaterArtifact.fileName,
            signatureFileName: updaterArtifact.signatureFileName,
            strategy: updaterArtifact.strategy,
            tauriPlatformKey: resolveTauriPlatformKey({
              architecture: process.arch,
              platformName: currentPlatformName,
            }),
          },
    version: releaseVersion,
  };
}

function resolvePreferredDownloadArtifact({ collectedArtifacts, currentPlatformName }) {
  const preferredArtifactKindsByPlatform = {
    linux: ["appimage", "deb", "rpm", "tarball"],
    macos: ["dmg", "app"],
    windows: ["nsis", "msi", "exe"],
  };

  return findArtifactByPreferredKinds(
    collectedArtifacts,
    preferredArtifactKindsByPlatform[currentPlatformName] ?? [],
  );
}

function resolveUpdaterArtifact({ collectedArtifacts, currentPlatformName }) {
  if (currentPlatformName === "linux") {
    const appImageArtifact = findArtifactByPreferredKinds(collectedArtifacts, ["appimage"]);

    if (appImageArtifact === undefined) {
      return undefined;
    }

    return {
      fileName: appImageArtifact.fileName,
      signatureFileName: findMatchingSignatureArtifactFileName(collectedArtifacts, [
        "appimage-signature",
      ]),
      strategy: "sign-on-finalize",
    };
  }

  if (currentPlatformName === "windows") {
    const windowsUpdaterArtifact = findArtifactByPreferredKinds(collectedArtifacts, [
      "nsis",
      "msi",
      "exe",
    ]);

    if (windowsUpdaterArtifact === undefined) {
      return undefined;
    }

    return {
      fileName: windowsUpdaterArtifact.fileName,
      signatureFileName: findMatchingSignatureArtifactFileName(collectedArtifacts, [
        `${windowsUpdaterArtifact.kind}-signature`,
      ]),
      strategy: "sign-on-finalize",
    };
  }

  const preparedMacosUpdaterArtifact = findArtifactByPreferredKinds(collectedArtifacts, [
    "updater",
  ]);

  if (preparedMacosUpdaterArtifact !== undefined) {
    return {
      fileName: preparedMacosUpdaterArtifact.fileName,
      signatureFileName: findMatchingSignatureArtifactFileName(collectedArtifacts, [
        "updater-signature",
      ]),
      strategy: "ready",
    };
  }

  const macosApplicationArchive = findArtifactByPreferredKinds(collectedArtifacts, ["app"]);

  if (macosApplicationArchive === undefined) {
    return undefined;
  }

  return {
    fileName: macosApplicationArchive.fileName,
    strategy: "build-and-sign-on-finalize",
  };
}

function findMatchingSignatureArtifactFileName(collectedArtifacts, acceptableKinds) {
  const matchingSignatureArtifact = collectedArtifacts.find((currentArtifact) =>
    acceptableKinds.includes(currentArtifact.kind),
  );

  return matchingSignatureArtifact?.fileName;
}

function findArtifactByPreferredKinds(collectedArtifacts, preferredArtifactKinds) {
  for (const currentPreferredArtifactKind of preferredArtifactKinds) {
    const matchingArtifact = collectedArtifacts.find(
      (currentArtifact) => currentArtifact.kind === currentPreferredArtifactKind,
    );

    if (matchingArtifact !== undefined) {
      return matchingArtifact;
    }
  }

  return undefined;
}

async function uploadStagedArtifacts({
  currentPlatformName,
  releaseChannel,
  releaseOutputDirectoryPath,
  releaseSettings,
  releaseTag,
}) {
  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);
  const stagingRelativeDirectoryPath = createStagingRelativeDirectoryPath({
    currentPlatformName,
    releaseChannel,
    releaseTag,
    remoteStorageSettings,
  });
  console.log("");
  console.log(
    `Uploading staged artifacts to s3://${remoteStorageSettings.bucketName}/${stagingRelativeDirectoryPath}`,
  );

  const releaseOutputEntryNames = readdirSync(releaseOutputDirectoryPath);

  for (const currentEntryName of releaseOutputEntryNames) {
    const currentEntryPath = join(releaseOutputDirectoryPath, currentEntryName);

    if (!statSync(currentEntryPath).isFile()) {
      continue;
    }

    await uploadFileToS3({
      localFilePath: currentEntryPath,
      objectKey: joinRemotePathSegments([stagingRelativeDirectoryPath, currentEntryName]),
      remoteStorageSettings,
    });
  }
}

async function finalizeRelease({
  releaseChannel,
  releaseNotes,
  releaseSettings,
  releaseTag,
  releaseVersion,
}) {
  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);
  const finalizedReleaseDirectoryPath = join(
    artifactRootDirectoryPath,
    "finalized",
    releaseChannel,
    releaseTag,
  );
  const publishedPlatformManifests = [];

  recreateDirectory(finalizedReleaseDirectoryPath);

  for (const currentPlatformName of releaseSettings.requiredPlatforms) {
    const stagedManifest = await downloadStagedManifest({
      currentPlatformName,
      releaseChannel,
      releaseSettings,
      releaseTag,
    });

    validateStagedManifest({
      currentPlatformName,
      expectedChannel: releaseChannel,
      expectedTag: releaseTag,
      expectedVersion: releaseVersion,
      stagedManifest,
    });

    await promoteStagedPlatformDirectory({
      currentPlatformName,
      releaseChannel,
      stagedManifest,
      releaseSettings,
      releaseTag,
    });

    const publishedManifest = createPublishedPlatformManifest({
      releaseSettings,
      releaseTag,
      stagedManifest,
    });

    publishedPlatformManifests.push(publishedManifest);

    const publishedPlatformManifestPath = join(
      finalizedReleaseDirectoryPath,
      currentPlatformName,
      "manifest.json",
    );

    mkdirSync(join(finalizedReleaseDirectoryPath, currentPlatformName), { recursive: true });
    writeFileSync(publishedPlatformManifestPath, JSON.stringify(publishedManifest, null, 2));

    await uploadJsonDocument({
      documentContent: publishedManifest,
      releaseSettings,
      targetRelativePath: createLatestPlatformManifestRelativePath({
        currentPlatformName,
        releaseChannel,
        remoteStorageSettings,
      }),
    });
  }

  const latestManifest = createLatestManifest({
    publishedPlatformManifests,
    releaseChannel,
    releaseNotes,
    releaseSettings,
    releaseTag,
    releaseVersion,
  });
  const latestManifestPath = join(finalizedReleaseDirectoryPath, "latest.json");

  writeFileSync(latestManifestPath, JSON.stringify(latestManifest, null, 2));

  await uploadJsonDocument({
    documentContent: latestManifest,
    releaseSettings,
    targetRelativePath: createLatestReleaseRelativePath({
      releaseChannel,
      remoteStorageSettings,
    }),
  });

  const updaterManifest = await maybeCreateUpdaterManifest({
    publishedPlatformManifests,
    releaseNotes,
    releaseSettings,
    releaseTag,
    releaseVersion,
  });

  if (updaterManifest !== undefined) {
    const updaterManifestPath = join(finalizedReleaseDirectoryPath, "tauri-updater.json");

    writeFileSync(updaterManifestPath, JSON.stringify(updaterManifest, null, 2));

    await uploadJsonDocument({
      documentContent: updaterManifest,
      releaseSettings,
      targetRelativePath: createUpdaterManifestRelativePath({
        releaseChannel,
        remoteStorageSettings,
      }),
    });
  }

  return finalizedReleaseDirectoryPath;
}

function resolveRemoteStorageSettings(releaseSettings) {
  const {
    accessKeyId,
    bucketName,
    endpoint,
    forcePathStyle,
    publicBaseUrl,
    region,
    secretAccessKey,
  } = releaseSettings.storage;

  if (typeof bucketName !== "string" || bucketName.length === 0) {
    throw new Error(
      `Release upload requires "storage.bucketName" in ${releaseSettings.settingsFilePath}.`,
    );
  }

  if (typeof region !== "string" || region.length === 0) {
    throw new Error(
      `Release upload requires "storage.region" in ${releaseSettings.settingsFilePath}.`,
    );
  }

  if (typeof endpoint !== "string" || endpoint.length === 0) {
    throw new Error(
      `Release upload requires "storage.endpoint" in ${releaseSettings.settingsFilePath}.`,
    );
  }

  if (typeof accessKeyId !== "string" || accessKeyId.length === 0) {
    throw new Error(
      `Release upload requires "storage.accessKeyId" in ${releaseSettings.settingsFilePath}.`,
    );
  }

  if (typeof secretAccessKey !== "string" || secretAccessKey.length === 0) {
    throw new Error(
      `Release upload requires "storage.secretAccessKey" in ${releaseSettings.settingsFilePath}.`,
    );
  }

  return {
    accessKeyId,
    basePath: normalizeRemotePathSegment(releaseSettings.storage.basePath ?? "cogno2"),
    bucketName,
    endpoint: endpoint.replace(/\/+$/u, ""),
    forcePathStyle,
    publicBaseUrl,
    region,
    secretAccessKey,
  };
}

function createStagingRelativeDirectoryPath({
  currentPlatformName,
  releaseChannel,
  releaseTag,
  remoteStorageSettings,
}) {
  return joinRemotePathSegments([
    remoteStorageSettings.basePath,
    releaseChannel,
    "staging",
    releaseTag,
    currentPlatformName,
  ]);
}

function createPublishedRelativeDirectoryPath({
  currentPlatformName,
  releaseChannel,
  releaseTag,
  remoteStorageSettings,
}) {
  return joinRemotePathSegments([
    remoteStorageSettings.basePath,
    releaseChannel,
    "releases",
    releaseTag,
    currentPlatformName,
  ]);
}

function createLatestPlatformManifestRelativePath({
  currentPlatformName,
  releaseChannel,
  remoteStorageSettings,
}) {
  return joinRemotePathSegments([
    remoteStorageSettings.basePath,
    releaseChannel,
    "latest",
    currentPlatformName,
    "manifest.json",
  ]);
}

function createLatestReleaseRelativePath({ releaseChannel, remoteStorageSettings }) {
  return joinRemotePathSegments([remoteStorageSettings.basePath, releaseChannel, "latest.json"]);
}

function createUpdaterManifestRelativePath({ releaseChannel, remoteStorageSettings }) {
  return joinRemotePathSegments([
    remoteStorageSettings.basePath,
    releaseChannel,
    "updater",
    "latest.json",
  ]);
}

function normalizeRemotePathSegment(pathValue) {
  return String(pathValue).replace(/^\/+/u, "").replace(/\/+$/u, "");
}

function joinRemotePathSegments(pathSegments) {
  return pathSegments
    .filter((currentPathSegment) => currentPathSegment !== undefined && currentPathSegment !== "")
    .map((currentPathSegment) => normalizeRemotePathSegment(currentPathSegment))
    .join("/");
}

async function downloadStagedManifest({
  currentPlatformName,
  releaseChannel,
  releaseSettings,
  releaseTag,
}) {
  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);
  const stagedManifestRelativePath = joinRemotePathSegments([
    createStagingRelativeDirectoryPath({
      currentPlatformName,
      releaseChannel,
      releaseTag,
      remoteStorageSettings,
    }),
    "manifest.json",
  ]);
  const stagedManifestText = await downloadTextFromS3({
    objectKey: stagedManifestRelativePath,
    remoteStorageSettings,
  });

  try {
    return JSON.parse(stagedManifestText);
  } catch (error) {
    throw new Error(
      `Could not parse staged manifest for platform "${currentPlatformName}": ${error.message}`,
    );
  }
}

function validateStagedManifest({
  currentPlatformName,
  expectedChannel,
  expectedTag,
  expectedVersion,
  stagedManifest,
}) {
  if (stagedManifest.channel !== expectedChannel) {
    throw new Error(
      `Staged manifest for "${currentPlatformName}" belongs to channel "${stagedManifest.channel}" instead of "${expectedChannel}".`,
    );
  }

  if (stagedManifest.platform !== currentPlatformName) {
    throw new Error(
      `Staged manifest platform mismatch: expected "${currentPlatformName}" but found "${stagedManifest.platform}".`,
    );
  }

  if (stagedManifest.tag !== expectedTag) {
    throw new Error(
      `Staged manifest for "${currentPlatformName}" belongs to tag "${stagedManifest.tag}" instead of "${expectedTag}".`,
    );
  }

  if (stagedManifest.version !== expectedVersion) {
    throw new Error(
      `Staged manifest for "${currentPlatformName}" belongs to version "${stagedManifest.version}" instead of "${expectedVersion}".`,
    );
  }
}

async function promoteStagedPlatformDirectory({
  currentPlatformName,
  releaseChannel,
  stagedManifest,
  releaseSettings,
  releaseTag,
}) {
  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);
  const stagedRelativeDirectoryPath = createStagingRelativeDirectoryPath({
    currentPlatformName,
    releaseChannel,
    releaseTag,
    remoteStorageSettings,
  });
  const publishedRelativeDirectoryPath = createPublishedRelativeDirectoryPath({
    currentPlatformName,
    releaseChannel,
    releaseTag,
    remoteStorageSettings,
  });

  console.log(
    `Promoting ${currentPlatformName} artifacts to s3://${remoteStorageSettings.bucketName}/${publishedRelativeDirectoryPath}`,
  );

  for (const currentArtifact of stagedManifest.artifacts) {
    await copyS3Object({
      destinationObjectKey: joinRemotePathSegments([
        publishedRelativeDirectoryPath,
        currentArtifact.fileName,
      ]),
      remoteStorageSettings,
      sourceObjectKey: joinRemotePathSegments([
        stagedRelativeDirectoryPath,
        currentArtifact.fileName,
      ]),
    });
  }
}

function createPublishedPlatformManifest({ releaseSettings, releaseTag, stagedManifest }) {
  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);
  const publishedRelativeDirectoryPath = createPublishedRelativeDirectoryPath({
    currentPlatformName: stagedManifest.platform,
    releaseChannel: stagedManifest.channel,
    releaseTag,
    remoteStorageSettings,
  });
  const publishedArtifacts = stagedManifest.artifacts.map((currentArtifact) => ({
    ...currentArtifact,
    downloadUrl: createPublicArtifactUrl({
      artifactFileName: currentArtifact.fileName,
      publishedRelativeDirectoryPath,
      releaseSettings,
    }),
  }));
  const preferredDownloadArtifact = publishedArtifacts.find(
    (currentArtifact) =>
      currentArtifact.fileName === stagedManifest.preferredDownloadArtifactFileName,
  );
  const publishedUpdater =
    stagedManifest.updater === undefined
      ? undefined
      : {
          ...stagedManifest.updater,
          artifactUrl: createPublicArtifactUrl({
            artifactFileName: stagedManifest.updater.artifactFileName,
            publishedRelativeDirectoryPath,
            releaseSettings,
          }),
          signatureUrl:
            stagedManifest.updater.signatureFileName === undefined
              ? undefined
              : createPublicArtifactUrl({
                  artifactFileName: stagedManifest.updater.signatureFileName,
                  publishedRelativeDirectoryPath,
                  releaseSettings,
                }),
        };

  return {
    ...stagedManifest,
    artifacts: publishedArtifacts,
    latestPath: `${stagedManifest.channel}/latest/${stagedManifest.platform}/manifest.json`,
    manifestUrl: createPublicDocumentUrl({
      relativePath: createLatestPlatformManifestRelativePath({
        currentPlatformName: stagedManifest.platform,
        releaseChannel: stagedManifest.channel,
        remoteStorageSettings,
      }),
      releaseSettings,
    }),
    preferredDownload: preferredDownloadArtifact,
    publishedAt: new Date().toISOString(),
    releasePath: `${stagedManifest.channel}/releases/${releaseTag}/${stagedManifest.platform}`,
    updater: publishedUpdater,
  };
}

function createLatestManifest({
  publishedPlatformManifests,
  releaseChannel,
  releaseNotes,
  releaseSettings,
  releaseTag,
  releaseVersion,
}) {
  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);

  return {
    channel: releaseChannel,
    notes: releaseNotes,
    platforms: Object.fromEntries(
      publishedPlatformManifests
        .sort((leftManifest, rightManifest) =>
          leftManifest.platform.localeCompare(rightManifest.platform),
        )
        .map((currentManifest) => [
          currentManifest.platform,
          {
            architecture: currentManifest.architecture,
            artifactFileName: currentManifest.preferredDownload?.fileName,
            artifactKind: currentManifest.preferredDownload?.kind,
            downloadUrl: currentManifest.preferredDownload?.downloadUrl,
            manifestUrl: currentManifest.manifestUrl,
          },
        ]),
    ),
    publishedAt: new Date().toISOString(),
    requiredPlatforms: releaseSettings.requiredPlatforms,
    tag: releaseTag,
    tauriUpdaterUrl: createPublicDocumentUrl({
      relativePath: createUpdaterManifestRelativePath({
        releaseChannel,
        remoteStorageSettings,
      }),
      releaseSettings,
    }),
    version: releaseVersion,
  };
}

async function maybeCreateUpdaterManifest({
  publishedPlatformManifests,
  releaseNotes,
  releaseSettings,
  releaseTag,
  releaseVersion,
}) {
  if (!releaseSettings.updater.enabled) {
    return undefined;
  }

  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);
  const updaterWorkingDirectoryPath = mkdtempSync(join(tmpdir(), "cogno2-updater-"));
  const updaterPlatforms = {};

  try {
    for (const currentPublishedPlatformManifest of publishedPlatformManifests) {
      const updaterPlatformEntry = await createUpdaterPlatformEntry({
        publishedPlatformManifest: currentPublishedPlatformManifest,
        releaseSettings,
        releaseTag,
        remoteStorageSettings,
        updaterWorkingDirectoryPath,
      });

      if (updaterPlatformEntry === undefined) {
        throw new Error(
          `Updater is enabled, but platform "${currentPublishedPlatformManifest.platform}" does not expose an updater artifact.`,
        );
      }

      updaterPlatforms[currentPublishedPlatformManifest.updater.tauriPlatformKey] =
        updaterPlatformEntry;
    }

    return {
      notes: releaseNotes,
      platforms: updaterPlatforms,
      pub_date: new Date().toISOString(),
      version: releaseVersion,
    };
  } finally {
    rmSync(updaterWorkingDirectoryPath, { force: true, recursive: true });
  }
}

async function createUpdaterPlatformEntry({
  publishedPlatformManifest,
  releaseSettings,
  releaseTag,
  remoteStorageSettings,
  updaterWorkingDirectoryPath,
}) {
  const updaterConfiguration = publishedPlatformManifest.updater;

  if (updaterConfiguration === undefined) {
    return undefined;
  }

  if (
    updaterConfiguration.strategy === "ready" &&
    updaterConfiguration.signatureFileName !== undefined
  ) {
    const signatureContent = await readPublishedArtifactText({
      artifactFileName: updaterConfiguration.signatureFileName,
      platformManifest: publishedPlatformManifest,
      releaseTag,
      remoteStorageSettings,
    });

    return {
      signature: signatureContent.trim(),
      url: updaterConfiguration.artifactUrl,
    };
  }

  const generatedUpdaterArtifact = await buildOrDownloadUpdaterArtifactForSigning({
    platformManifest: publishedPlatformManifest,
    releaseTag,
    remoteStorageSettings,
    updaterWorkingDirectoryPath,
  });
  const generatedSignature = signUpdaterArtifact({
    releaseSettings,
    updaterArtifactPath: generatedUpdaterArtifact.localArtifactPath,
  });
  const publishedSignatureFileName = `${generatedUpdaterArtifact.publishedArtifactFileName}.sig`;
  const publishedRelativeDirectoryPath = createPublishedRelativeDirectoryPath({
    currentPlatformName: publishedPlatformManifest.platform,
    releaseChannel: publishedPlatformManifest.channel,
    releaseTag,
    remoteStorageSettings,
  });
  await uploadFileToS3({
    localFilePath: generatedUpdaterArtifact.localSignaturePath,
    objectKey: joinRemotePathSegments([publishedRelativeDirectoryPath, publishedSignatureFileName]),
    remoteStorageSettings,
  });

  if (generatedUpdaterArtifact.createdArtifactLocally) {
    await uploadFileToS3({
      localFilePath: generatedUpdaterArtifact.localArtifactPath,
      objectKey: joinRemotePathSegments([
        publishedRelativeDirectoryPath,
        generatedUpdaterArtifact.publishedArtifactFileName,
      ]),
      remoteStorageSettings,
    });
  }

  return {
    signature: generatedSignature,
    url: createPublicArtifactUrl({
      artifactFileName: generatedUpdaterArtifact.publishedArtifactFileName,
      publishedRelativeDirectoryPath,
      releaseSettings,
    }),
  };
}

async function buildOrDownloadUpdaterArtifactForSigning({
  platformManifest,
  releaseTag,
  remoteStorageSettings,
  updaterWorkingDirectoryPath,
}) {
  const platformWorkingDirectoryPath = join(updaterWorkingDirectoryPath, platformManifest.platform);

  mkdirSync(platformWorkingDirectoryPath, { recursive: true });

  if (platformManifest.platform !== "macos") {
    const downloadedArtifactPath = await downloadPublishedArtifact({
      artifactFileName: platformManifest.updater.artifactFileName,
      destinationDirectoryPath: platformWorkingDirectoryPath,
      platformManifest,
      releaseTag,
      remoteStorageSettings,
    });

    return {
      createdArtifactLocally: false,
      localArtifactPath: downloadedArtifactPath,
      localSignaturePath: `${downloadedArtifactPath}.sig`,
      publishedArtifactFileName: platformManifest.updater.artifactFileName,
    };
  }

  if (platformManifest.updater.strategy === "ready") {
    const downloadedPreparedUpdaterPath = await downloadPublishedArtifact({
      artifactFileName: platformManifest.updater.artifactFileName,
      destinationDirectoryPath: platformWorkingDirectoryPath,
      platformManifest,
      releaseTag,
      remoteStorageSettings,
    });

    return {
      createdArtifactLocally: false,
      localArtifactPath: downloadedPreparedUpdaterPath,
      localSignaturePath: `${downloadedPreparedUpdaterPath}.sig`,
      publishedArtifactFileName: platformManifest.updater.artifactFileName,
    };
  }

  if (process.platform !== "darwin") {
    throw new Error(
      'macOS updater artifact is not staged. Run "--finalize" on macOS or build a prepared updater archive on the macOS build machine.',
    );
  }

  const downloadedApplicationArchivePath = await downloadPublishedArtifact({
    artifactFileName: platformManifest.updater.artifactFileName,
    destinationDirectoryPath: platformWorkingDirectoryPath,
    platformManifest,
    releaseTag,
    remoteStorageSettings,
  });
  const extractionDirectoryPath = join(platformWorkingDirectoryPath, "app");
  const discoveredApplicationName = extractMacosApplicationArchive({
    applicationArchivePath: downloadedApplicationArchivePath,
    extractionDirectoryPath,
  });
  const generatedUpdaterFileName = `${[
    "cogno2",
    platformManifest.version,
    platformManifest.platform,
    platformManifest.architecture,
    "updater",
  ].join("-")}.tar.gz`;
  const generatedUpdaterArtifactPath = join(platformWorkingDirectoryPath, generatedUpdaterFileName);

  runCommand("tar", [
    "-czf",
    generatedUpdaterArtifactPath,
    "-C",
    extractionDirectoryPath,
    discoveredApplicationName,
  ]);

  return {
    createdArtifactLocally: true,
    localArtifactPath: generatedUpdaterArtifactPath,
    localSignaturePath: `${generatedUpdaterArtifactPath}.sig`,
    publishedArtifactFileName: generatedUpdaterFileName,
  };
}

function extractMacosApplicationArchive({ applicationArchivePath, extractionDirectoryPath }) {
  recreateDirectory(extractionDirectoryPath);

  runCommand("ditto", [
    "-x",
    "-k",
    "--sequesterRsrc",
    applicationArchivePath,
    extractionDirectoryPath,
  ]);

  const extractedEntryNames = readdirSync(extractionDirectoryPath);
  const applicationDirectoryName = extractedEntryNames.find((currentEntryName) =>
    currentEntryName.endsWith(".app"),
  );

  if (applicationDirectoryName === undefined) {
    throw new Error(`Could not find extracted .app directory in ${extractionDirectoryPath}.`);
  }

  return applicationDirectoryName;
}

function signUpdaterArtifact({ releaseSettings, updaterArtifactPath }) {
  const signatureContent = runCommandAndCollectOutput(
    "pnpm",
    createTauriSignerArguments({
      releaseSettings,
      updaterArtifactPath,
    }),
  ).trim();

  if (signatureContent.length === 0) {
    throw new Error(`Could not sign updater artifact: ${updaterArtifactPath}`);
  }

  writeFileSync(`${updaterArtifactPath}.sig`, `${signatureContent}\n`);

  return signatureContent;
}

function createTauriSignerArguments({ releaseSettings, updaterArtifactPath }) {
  const signerArguments = ["exec", "tauri", "signer", "sign"];

  if (releaseSettings.updater.privateKeyPath !== undefined) {
    signerArguments.push("--private-key-path", releaseSettings.updater.privateKeyPath);
  } else if (releaseSettings.updater.privateKey !== undefined) {
    signerArguments.push("--private-key", releaseSettings.updater.privateKey);
  } else {
    throw new Error(
      "Updater signing requires updater.privateKeyPath or updater.privateKey in release.settings.json.",
    );
  }

  if (releaseSettings.updater.privateKeyPassword !== undefined) {
    signerArguments.push("--password", releaseSettings.updater.privateKeyPassword);
  }

  signerArguments.push(updaterArtifactPath);

  return signerArguments;
}

async function downloadPublishedArtifact({
  artifactFileName,
  destinationDirectoryPath,
  platformManifest,
  releaseTag,
  remoteStorageSettings,
}) {
  const localDestinationPath = join(destinationDirectoryPath, artifactFileName);
  const publishedArtifactRelativePath = joinRemotePathSegments([
    createPublishedRelativeDirectoryPath({
      currentPlatformName: platformManifest.platform,
      releaseChannel: platformManifest.channel,
      releaseTag,
      remoteStorageSettings,
    }),
    artifactFileName,
  ]);

  await downloadFileFromS3({
    localDestinationPath,
    objectKey: publishedArtifactRelativePath,
    remoteStorageSettings,
  });

  if (!existsSync(localDestinationPath)) {
    throw new Error(`Could not download published artifact: ${artifactFileName}`);
  }

  return localDestinationPath;
}

async function readPublishedArtifactText({
  artifactFileName,
  platformManifest,
  releaseTag,
  remoteStorageSettings,
}) {
  const publishedArtifactRelativePath = joinRemotePathSegments([
    createPublishedRelativeDirectoryPath({
      currentPlatformName: platformManifest.platform,
      releaseChannel: platformManifest.channel,
      releaseTag,
      remoteStorageSettings,
    }),
    artifactFileName,
  ]);

  return downloadTextFromS3({
    objectKey: publishedArtifactRelativePath,
    remoteStorageSettings,
  });
}

function createPublicArtifactUrl({
  artifactFileName,
  publishedRelativeDirectoryPath,
  releaseSettings,
}) {
  const publicBaseUrl = releaseSettings.storage.publicBaseUrl;

  if (publicBaseUrl === undefined || publicBaseUrl.length === 0) {
    return undefined;
  }

  const normalizedPublicBaseUrl = publicBaseUrl.replace(/\/+$/u, "");

  return `${normalizedPublicBaseUrl}/${publishedRelativeDirectoryPath}/${artifactFileName}`;
}

function createPublicDocumentUrl({ relativePath, releaseSettings }) {
  const publicBaseUrl = releaseSettings.storage.publicBaseUrl;

  if (publicBaseUrl === undefined || publicBaseUrl.length === 0) {
    return undefined;
  }

  const normalizedPublicBaseUrl = publicBaseUrl.replace(/\/+$/u, "");

  return `${normalizedPublicBaseUrl}/${relativePath}`;
}

async function uploadJsonDocument({ documentContent, releaseSettings, targetRelativePath }) {
  const remoteStorageSettings = resolveRemoteStorageSettings(releaseSettings);
  const temporaryDirectoryPath = mkdtempSync(join(tmpdir(), "cogno2-json-"));
  const temporaryFilePath = join(temporaryDirectoryPath, "document.json");

  try {
    writeFileSync(temporaryFilePath, JSON.stringify(documentContent, null, 2));

    await uploadFileToS3({
      localFilePath: temporaryFilePath,
      objectKey: targetRelativePath,
      remoteStorageSettings,
    });
  } finally {
    rmSync(temporaryDirectoryPath, { force: true, recursive: true });
  }
}

async function uploadFileToS3({ localFilePath, objectKey, remoteStorageSettings }) {
  const fileContent = readFileSync(localFilePath);

  await sendS3Request({
    bodyBuffer: fileContent,
    headers: {
      "content-type": resolveContentType(localFilePath),
    },
    method: "PUT",
    objectKey,
    remoteStorageSettings,
  });
}

async function downloadFileFromS3({ localDestinationPath, objectKey, remoteStorageSettings }) {
  const fileContent = await sendS3Request({
    method: "GET",
    objectKey,
    remoteStorageSettings,
  });

  writeFileSync(localDestinationPath, fileContent);
}

async function downloadTextFromS3({ objectKey, remoteStorageSettings }) {
  const fileContent = await sendS3Request({
    method: "GET",
    objectKey,
    remoteStorageSettings,
  });

  return fileContent.toString("utf-8");
}

async function copyS3Object({ destinationObjectKey, remoteStorageSettings, sourceObjectKey }) {
  await sendS3Request({
    headers: {
      "x-amz-copy-source": `/${remoteStorageSettings.bucketName}/${encodeS3HeaderPath(sourceObjectKey)}`,
    },
    method: "PUT",
    objectKey: destinationObjectKey,
    remoteStorageSettings,
  });
}

async function sendS3Request({
  bodyBuffer,
  headers = {},
  method,
  objectKey,
  remoteStorageSettings,
}) {
  const endpointUrl = new URL(remoteStorageSettings.endpoint);
  const requestDate = new Date();
  const amzDate = createAmzDate(requestDate);
  const shortDate = amzDate.slice(0, 8);
  const payloadBuffer = bodyBuffer ?? Buffer.alloc(0);
  const payloadHash = createSha256Hex(payloadBuffer);
  const resolvedRequestTarget = createS3RequestTarget({
    bucketName: remoteStorageSettings.bucketName,
    endpointUrl,
    forcePathStyle: remoteStorageSettings.forcePathStyle,
    objectKey,
  });
  const requestHeaders = {
    ...headers,
    host: resolvedRequestTarget.hostHeader,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  const canonicalHeaders = createCanonicalHeaders(requestHeaders);
  const signedHeaders = Object.keys(canonicalHeaders).join(";");
  const canonicalRequest = [
    method,
    resolvedRequestTarget.canonicalUri,
    "",
    Object.entries(canonicalHeaders)
      .map(
        ([currentHeaderName, currentHeaderValue]) => `${currentHeaderName}:${currentHeaderValue}\n`,
      )
      .join(""),
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${shortDate}/${remoteStorageSettings.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createSha256Hex(Buffer.from(canonicalRequest, "utf-8")),
  ].join("\n");
  const signingKey = createAwsV4SigningKey({
    region: remoteStorageSettings.region,
    secretAccessKey: remoteStorageSettings.secretAccessKey,
    shortDate,
  });
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf-8").digest("hex");

  requestHeaders.authorization =
    `AWS4-HMAC-SHA256 Credential=${remoteStorageSettings.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return performHttpRequest({
    bodyBuffer: payloadBuffer,
    headers: requestHeaders,
    method,
    requestPath: resolvedRequestTarget.requestPath,
    url: resolvedRequestTarget.requestUrl,
  });
}

function createS3RequestTarget({ bucketName, endpointUrl, forcePathStyle, objectKey }) {
  const encodedObjectPath = encodeS3ObjectPath(objectKey);
  const normalizedBasePath = endpointUrl.pathname.replace(/\/+$/u, "");

  if (forcePathStyle) {
    const requestPath = `${normalizedBasePath}/${bucketName}/${encodedObjectPath}`.replace(
      /\/{2,}/gu,
      "/",
    );

    return {
      canonicalUri: requestPath,
      hostHeader: endpointUrl.host,
      requestPath,
      requestUrl: new URL(`${endpointUrl.origin}${requestPath}`),
    };
  }

  const requestUrl = new URL(endpointUrl.toString());

  requestUrl.hostname = `${bucketName}.${requestUrl.hostname}`;
  requestUrl.pathname = `${normalizedBasePath}/${encodedObjectPath}`.replace(/\/{2,}/gu, "/");

  return {
    canonicalUri: requestUrl.pathname,
    hostHeader: requestUrl.host,
    requestPath: requestUrl.pathname,
    requestUrl,
  };
}

function createCanonicalHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers)
      .map(([currentHeaderName, currentHeaderValue]) => [
        currentHeaderName.toLowerCase(),
        String(currentHeaderValue).trim().replace(/\s+/gu, " "),
      ])
      .sort(([leftHeaderName], [rightHeaderName]) => leftHeaderName.localeCompare(rightHeaderName)),
  );
}

function createAwsV4SigningKey({ region, secretAccessKey, shortDate }) {
  const dateKey = createHmac("sha256", `AWS4${secretAccessKey}`)
    .update(shortDate, "utf-8")
    .digest();
  const regionKey = createHmac("sha256", dateKey).update(region, "utf-8").digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3", "utf-8").digest();

  return createHmac("sha256", serviceKey).update("aws4_request", "utf-8").digest();
}

function createAmzDate(currentDate) {
  return currentDate.toISOString().replace(/[:-]|\.\d{3}/gu, "");
}

function createSha256Hex(contentBuffer) {
  return createHash("sha256").update(contentBuffer).digest("hex");
}

function encodeS3ObjectPath(objectKey) {
  return objectKey
    .split("/")
    .map((currentPathSegment) => encodeURIComponent(currentPathSegment))
    .join("/");
}

function encodeS3HeaderPath(objectKey) {
  return objectKey
    .split("/")
    .map((currentPathSegment) => encodeURIComponent(currentPathSegment))
    .join("/");
}

function resolveContentType(filePath) {
  if (filePath.endsWith(".json")) {
    return "application/json";
  }

  if (filePath.endsWith(".sig")) {
    return "text/plain; charset=utf-8";
  }

  if (filePath.endsWith(".txt") || filePath.endsWith(".md")) {
    return "text/plain; charset=utf-8";
  }

  return "application/octet-stream";
}

async function performHttpRequest({ bodyBuffer, headers, method, requestPath, url }) {
  const requestFunction = url.protocol === "http:" ? createHttpRequest : createHttpsRequest;

  return new Promise((resolveRequest, rejectRequest) => {
    const request = requestFunction(
      {
        headers,
        hostname: url.hostname,
        method,
        path: requestPath,
        port: url.port.length > 0 ? Number(url.port) : undefined,
        protocol: url.protocol,
      },
      (response) => {
        const responseChunks = [];

        response.on("data", (currentChunk) => {
          responseChunks.push(Buffer.from(currentChunk));
        });
        response.on("end", () => {
          const responseBodyBuffer = Buffer.concat(responseChunks);

          if (
            response.statusCode === undefined ||
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            rejectRequest(
              new Error(
                `S3 request failed with status ${response.statusCode ?? "unknown"} for ${method} ${url.toString()}: ${responseBodyBuffer.toString("utf-8")}`,
              ),
            );
            return;
          }

          resolveRequest(responseBodyBuffer);
        });
      },
    );

    request.on("error", (error) => {
      rejectRequest(error);
    });

    request.end(bodyBuffer);
  });
}

function resolveTauriPlatformKey({ architecture, platformName }) {
  return `${resolveTauriPlatformName(platformName)}-${resolveTauriArchitecture(architecture)}`;
}

function resolveTauriPlatformName(platformName) {
  if (platformName === "macos") {
    return "darwin";
  }

  return platformName;
}

function resolveTauriArchitecture(architecture) {
  const tauriArchitectureByNodeArchitecture = {
    arm64: "aarch64",
    arm: "armv7",
    ia32: "i686",
    x64: "x86_64",
  };

  return tauriArchitectureByNodeArchitecture[architecture] ?? architecture;
}

function runCommand(commandName, commandArguments, options = {}) {
  const { environmentVariables, runnerType } = options;
  const resolvedCommandName = resolveCommandName(commandName);
  const resolvedArguments =
    runnerType === "pnpm-run" ? ["run", ...commandArguments] : commandArguments;

  console.log(`> ${[resolvedCommandName, ...resolvedArguments].join(" ")}`);
  execFileSync(resolvedCommandName, resolvedArguments, {
    env: environmentVariables,
    shell: shouldUseShellExecution(resolvedCommandName),
    stdio: "inherit",
  });
}

function runCommandAndCollectOutput(commandName, commandArguments, options = {}) {
  const { environmentVariables, runnerType } = options;
  const resolvedCommandName = resolveCommandName(commandName);
  const resolvedArguments =
    runnerType === "pnpm-run" ? ["run", ...commandArguments] : commandArguments;

  return execFileSync(resolvedCommandName, resolvedArguments, {
    encoding: "utf-8",
    env: environmentVariables,
    shell: shouldUseShellExecution(resolvedCommandName),
  }).trim();
}

function resolveCommandName(commandName) {
  if (process.platform === "win32" && commandName === "pnpm") {
    return "pnpm.cmd";
  }

  return commandName;
}

function shouldUseShellExecution(commandName) {
  return process.platform === "win32" && commandName.endsWith(".cmd");
}
