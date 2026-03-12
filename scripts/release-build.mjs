#!/usr/bin/env node

import { execFileSync } from "child_process";
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync
} from "fs";
import { homedir } from "os";
import { extname, join, relative, resolve } from "path";

const artifactRootDirectoryPath = "release-artifacts";
const packageJsonPath = "package.json";
const tauriCargoTomlPath = "src-tauri/Cargo.toml";
const tauriConfigPathByEdition = {
    community: "src-tauri/tauri.community.conf.json",
    pro: "src-tauri/tauri.pro.conf.json"
};
const supportedEditions = ["community", "pro"];
const supportedChannels = ["dev", "release"];
const supportedPlatforms = {
    darwin: "macos",
    linux: "linux",
    win32: "windows"
};

main();

function main() {
    const parsedArguments = parseCommandLineArguments(process.argv.slice(2));

    if (parsedArguments.help) {
        printHelp();
        return;
    }

    const currentPlatformName = resolveCurrentPlatformName();
    const releaseEdition = parsedArguments.edition ?? "pro";
    const releaseChannel = parsedArguments.channel ?? "release";

    validateEdition(releaseEdition);
    validateChannel(releaseChannel);

    if (!parsedArguments.allowDirtyWorkingTree) {
        assertWorkingTreeIsClean();
    }

    const releaseTag = parsedArguments.tag ?? resolveHeadTag();
    const releaseVersion = normalizeTagToVersion(releaseTag);
    const loadedEnvironment = loadReleaseEnvironment({
        releaseChannel,
        releaseEdition,
        currentPlatformName
    });

    validateVersionConsistency(releaseVersion);

    const releaseOutputDirectoryPath = join(
        artifactRootDirectoryPath,
        releaseTag,
        releaseEdition,
        currentPlatformName
    );

    recreateDirectory(releaseOutputDirectoryPath);

    if (!parsedArguments.skipBuild) {
        runBuild({
            loadedEnvironment,
            releaseEdition,
            releaseTag,
            releaseVersion,
            currentPlatformName
        });
    }

    const collectedArtifacts = collectArtifacts({
        currentPlatformName,
        releaseEdition,
        releaseOutputDirectoryPath,
        releaseVersion
    });

    if (collectedArtifacts.length === 0) {
        throw new Error(`No artifacts found for platform "${currentPlatformName}".`);
    }

    const manifest = createManifest({
        collectedArtifacts,
        currentPlatformName,
        releaseChannel,
        releaseEdition,
        releaseTag,
        releaseVersion
    });
    const manifestPath = join(releaseOutputDirectoryPath, "manifest.json");

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    if (!parsedArguments.skipUpload) {
        uploadArtifacts({
            collectedArtifacts,
            loadedEnvironment,
            manifest,
            releaseChannel,
            releaseEdition,
            releaseOutputDirectoryPath,
            releaseTag,
            currentPlatformName
        });
    }

    console.log("");
    console.log("Release build completed.");
    console.log(`Tag: ${releaseTag}`);
    console.log(`Edition: ${releaseEdition}`);
    console.log(`Channel: ${releaseChannel}`);
    console.log(`Platform: ${currentPlatformName}`);
    console.log(`Artifacts: ${collectedArtifacts.length}`);
    console.log(`Output directory: ${resolve(releaseOutputDirectoryPath)}`);
    console.log(`Manifest: ${resolve(manifestPath)}`);
}

function parseCommandLineArguments(commandLineArguments) {
    const parsedArguments = {
        allowDirtyWorkingTree: false,
        help: false,
        skipBuild: false,
        skipUpload: false
    };

    for (let currentArgumentIndex = 0; currentArgumentIndex < commandLineArguments.length; currentArgumentIndex += 1) {
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
            case "--edition":
                parsedArguments.edition = requireArgumentValue(currentArgument, nextArgument);
                currentArgumentIndex += 1;
                break;
            case "--channel":
                parsedArguments.channel = requireArgumentValue(currentArgument, nextArgument);
                currentArgumentIndex += 1;
                break;
            case "--skip-build":
                parsedArguments.skipBuild = true;
                break;
            case "--skip-upload":
                parsedArguments.skipUpload = true;
                break;
            case "--allow-dirty":
                parsedArguments.allowDirtyWorkingTree = true;
                break;
            default:
                throw new Error(`Unknown argument "${currentArgument}". Use --help for usage information.`);
        }
    }

    return parsedArguments;
}

function printHelp() {
    console.log("Local release builder for Cogno2");
    console.log("");
    console.log("Usage:");
    console.log("  pnpm run release:build -- [options]");
    console.log("");
    console.log("Options:");
    console.log("  --tag <tag>         Build metadata for a specific Git tag.");
    console.log("  --edition <value>   community | pro (default: pro)");
    console.log("  --channel <value>   dev | release (default: release)");
    console.log("  --skip-build        Reuse existing bundle output and only collect/upload artifacts.");
    console.log("  --skip-upload       Build and collect artifacts without upload.");
    console.log("  --allow-dirty       Allow a dirty working tree.");
    console.log("  --help              Show this help.");
    console.log("");
    console.log("Loaded secret files from ~/.cogno-secrets when present:");
    console.log("  release.common.env");
    console.log("  release.<platform>.env");
    console.log("  release.<edition>.env");
    console.log("  release.<channel>.env");
    console.log("  release.<platform>.<edition>.env");
    console.log("");
    console.log("Upload configuration via environment variables:");
    console.log("  COGNO_RELEASE_RCLONE_REMOTE");
    console.log("  COGNO_RELEASE_RCLONE_BASE_PATH (optional, default: cogno2)");
    console.log("  COGNO_RELEASE_PUBLIC_BASE_URL (optional, for latest manifest download URLs)");
}

function requireArgumentValue(argumentName, argumentValue) {
    if (argumentValue === undefined || argumentValue.startsWith("--")) {
        throw new Error(`Missing value for argument "${argumentName}".`);
    }

    return argumentValue;
}

function validateEdition(releaseEdition) {
    if (!supportedEditions.includes(releaseEdition)) {
        throw new Error(
            `Unsupported edition "${releaseEdition}". Supported editions: ${supportedEditions.join(", ")}.`
        );
    }
}

function validateChannel(releaseChannel) {
    if (!supportedChannels.includes(releaseChannel)) {
        throw new Error(
            `Unsupported channel "${releaseChannel}". Supported channels: ${supportedChannels.join(", ")}.`
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
        throw new Error('HEAD is not tagged. Use --tag <tag> or check out a tagged commit.');
    }

    return tagsAtHead.sort()[0];
}

function normalizeTagToVersion(releaseTag) {
    return releaseTag.startsWith("v") ? releaseTag.slice(1) : releaseTag;
}

function loadReleaseEnvironment({ releaseChannel, releaseEdition, currentPlatformName }) {
    const secretDirectoryPath = join(homedir(), ".cogno-secrets");
    const environmentFileNames = [
        "release.common.env",
        `release.${currentPlatformName}.env`,
        `release.${releaseEdition}.env`,
        `release.${releaseChannel}.env`,
        `release.${currentPlatformName}.${releaseEdition}.env`
    ];
    const mergedEnvironment = { ...process.env };

    for (const currentEnvironmentFileName of environmentFileNames) {
        const currentEnvironmentFilePath = join(secretDirectoryPath, currentEnvironmentFileName);

        if (!existsSync(currentEnvironmentFilePath)) {
            continue;
        }

        const currentEnvironmentValues = parseEnvironmentFile(
            readFileSync(currentEnvironmentFilePath, "utf-8")
        );

        Object.assign(mergedEnvironment, currentEnvironmentValues);
    }

    return mergedEnvironment;
}

function parseEnvironmentFile(environmentFileContent) {
    const parsedEnvironment = {};
    const environmentFileLines = environmentFileContent.split(/\r?\n/u);

    for (const currentLine of environmentFileLines) {
        const trimmedLine = currentLine.trim();

        if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmedLine.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const variableName = trimmedLine.slice(0, separatorIndex).trim();
        const variableValue = trimmedLine.slice(separatorIndex + 1).trim();

        parsedEnvironment[variableName] = stripWrappingQuotes(variableValue);
    }

    return parsedEnvironment;
}

function stripWrappingQuotes(variableValue) {
    if (
        (variableValue.startsWith('"') && variableValue.endsWith('"')) ||
        (variableValue.startsWith("'") && variableValue.endsWith("'"))
    ) {
        return variableValue.slice(1, -1);
    }

    return variableValue;
}

function validateVersionConsistency(releaseVersion) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const packageVersion = packageJson.version;
    const cargoTomlContent = readFileSync(tauriCargoTomlPath, "utf-8");
    const cargoVersionMatch = cargoTomlContent.match(/^version = "([^"]+)"$/mu);

    if (cargoVersionMatch === null) {
        throw new Error(`Could not read version from ${tauriCargoTomlPath}.`);
    }

    const tauriVersions = Object.values(tauriConfigPathByEdition).map((currentTauriConfigPath) => {
        const currentTauriConfig = JSON.parse(readFileSync(currentTauriConfigPath, "utf-8"));
        return {
            path: currentTauriConfigPath,
            version: currentTauriConfig.version
        };
    });

    const discoveredVersions = [
        { path: packageJsonPath, version: packageVersion },
        { path: tauriCargoTomlPath, version: cargoVersionMatch[1] },
        ...tauriVersions
    ];

    for (const currentVersionRecord of discoveredVersions) {
        if (currentVersionRecord.version !== releaseVersion) {
            throw new Error(
                `Version mismatch: tag resolves to "${releaseVersion}" but ${currentVersionRecord.path} contains "${currentVersionRecord.version}".`
            );
        }
    }
}

function recreateDirectory(directoryPath) {
    rmSync(directoryPath, { force: true, recursive: true });
    mkdirSync(directoryPath, { recursive: true });
}

function runBuild({
    loadedEnvironment,
    releaseEdition,
    releaseTag,
    releaseVersion,
    currentPlatformName
}) {
    console.log("");
    console.log(`Building ${releaseEdition} ${releaseVersion} for ${currentPlatformName} from tag ${releaseTag}`);

    if (currentPlatformName === "macos") {
        runCommand("node", ["./scripts/build-tauri-macos-signed-notarized.mjs", releaseEdition], {
            environmentVariables: loadedEnvironment
        });
        return;
    }

    runCommand("pnpm", [`tauri:build:${releaseEdition}`], {
        environmentVariables: loadedEnvironment,
        runnerType: "pnpm-run"
    });
}

function collectArtifacts({
    currentPlatformName,
    releaseEdition,
    releaseOutputDirectoryPath,
    releaseVersion
}) {
    const sourceBundleDirectoryPath = join("src-tauri", "target", "release", "bundle");
    const discoveredArtifactPaths = findBundleArtifacts({
        currentPlatformName,
        sourceBundleDirectoryPath
    });
    const collectedArtifacts = [];

    for (const currentArtifactPath of discoveredArtifactPaths) {
        const currentArtifactKind = determineArtifactKind(currentArtifactPath);
        const currentArtifactExtension = determineTargetArtifactExtension(currentArtifactPath);
        const targetArtifactFileName = createTargetArtifactFileName({
            currentArtifactExtension,
            currentArtifactKind,
            currentPlatformName,
            releaseEdition,
            releaseVersion
        });
        const targetArtifactPath = join(releaseOutputDirectoryPath, targetArtifactFileName);

        if (currentArtifactKind === "app") {
            createMacosApplicationArchive(currentArtifactPath, targetArtifactPath);
        } else {
            copyArtifact(currentArtifactPath, targetArtifactPath);
        }

        collectedArtifacts.push({
            fileName: targetArtifactFileName,
            kind: currentArtifactKind,
            path: targetArtifactPath,
            sourcePath: currentArtifactPath
        });
    }

    return collectedArtifacts.sort((leftArtifact, rightArtifact) =>
        leftArtifact.fileName.localeCompare(rightArtifact.fileName)
    );
}

function findBundleArtifacts({ currentPlatformName, sourceBundleDirectoryPath }) {
    if (!existsSync(sourceBundleDirectoryPath)) {
        throw new Error(`Bundle directory not found: ${sourceBundleDirectoryPath}`);
    }

    const supportedArtifactExtensionsByPlatform = {
        linux: [".AppImage", ".deb", ".rpm", ".tar.gz"],
        macos: [".app", ".dmg"],
        windows: [".exe", ".msi"]
    };
    const supportedArtifactExtensions = supportedArtifactExtensionsByPlatform[currentPlatformName];
    const discoveredPaths = [];

    collectFileSystemEntriesRecursively(sourceBundleDirectoryPath, discoveredPaths);

    return discoveredPaths.filter((currentEntryPath) => {
        const currentEntryStats = statSync(currentEntryPath);

        if (currentEntryStats.isDirectory()) {
            return currentPlatformName === "macos" && currentEntryPath.endsWith(".app");
        }

        return supportedArtifactExtensions.some((currentExtension) =>
            currentEntryPath.endsWith(currentExtension)
        );
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

    if (artifactPath.endsWith(".AppImage")) {
        return "appimage";
    }

    if (artifactPath.endsWith(".tar.gz")) {
        return "tarball";
    }

    return extname(artifactPath).slice(1).toLowerCase();
}

function determineTargetArtifactExtension(artifactPath) {
    if (artifactPath.endsWith(".app")) {
        return ".zip";
    }

    if (artifactPath.endsWith(".AppImage")) {
        return ".AppImage";
    }

    if (artifactPath.endsWith(".tar.gz")) {
        return ".tar.gz";
    }

    return extname(artifactPath);
}

function createTargetArtifactFileName({
    currentArtifactExtension,
    currentArtifactKind,
    currentPlatformName,
    releaseEdition,
    releaseVersion
}) {
    return [
        "cogno2",
        releaseEdition,
        releaseVersion,
        currentPlatformName,
        process.arch,
        currentArtifactKind
    ].join("-") + currentArtifactExtension;
}

function createMacosApplicationArchive(sourceApplicationPath, targetArchivePath) {
    runCommand("ditto", ["-c", "-k", "--keepParent", "--sequesterRsrc", sourceApplicationPath, targetArchivePath]);
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
    releaseEdition,
    releaseTag,
    releaseVersion
}) {
    return {
        architecture: process.arch,
        artifacts: collectedArtifacts.map((currentArtifact) => ({
            fileName: currentArtifact.fileName,
            kind: currentArtifact.kind,
            relativePath: currentArtifact.fileName,
            sourcePath: relative(process.cwd(), currentArtifact.sourcePath)
        })),
        channel: releaseChannel,
        createdAt: new Date().toISOString(),
        edition: releaseEdition,
        platform: currentPlatformName,
        tag: releaseTag,
        version: releaseVersion
    };
}

function uploadArtifacts({
    collectedArtifacts,
    loadedEnvironment,
    manifest,
    releaseChannel,
    releaseEdition,
    releaseOutputDirectoryPath,
    releaseTag,
    currentPlatformName
}) {
    const rcloneRemoteName = loadedEnvironment.COGNO_RELEASE_RCLONE_REMOTE;

    if (rcloneRemoteName === undefined || rcloneRemoteName.length === 0) {
        throw new Error(
            "Upload requested but COGNO_RELEASE_RCLONE_REMOTE is not configured in ~/.cogno-secrets."
        );
    }

    const rcloneBasePath = loadedEnvironment.COGNO_RELEASE_RCLONE_BASE_PATH ?? "cogno2";
    const versionedRelativeDirectoryPath = `${rcloneBasePath}/${releaseChannel}/${releaseTag}/${releaseEdition}/${currentPlatformName}`;
    const latestRelativeDirectoryPath = `${rcloneBasePath}/${releaseChannel}/latest/${releaseEdition}/${currentPlatformName}`;
    const remoteDestination = `${rcloneRemoteName}:${versionedRelativeDirectoryPath}`;
    const remoteLatestDestination = `${rcloneRemoteName}:${latestRelativeDirectoryPath}`;

    console.log("");
    console.log(`Uploading artifacts to ${remoteDestination}`);

    runCommand("rclone", ["copy", releaseOutputDirectoryPath, remoteDestination], {
        environmentVariables: loadedEnvironment
    });

    const latestOutputDirectoryPath = createLatestDirectory({
        collectedArtifacts,
        loadedEnvironment,
        manifest,
        releaseChannel,
        releaseEdition,
        releaseTag,
        currentPlatformName,
        versionedRelativeDirectoryPath
    });

    console.log(`Uploading latest manifest to ${remoteLatestDestination}`);

    runCommand("rclone", ["copy", latestOutputDirectoryPath, remoteLatestDestination], {
        environmentVariables: loadedEnvironment
    });
}

function createLatestDirectory({
    collectedArtifacts,
    loadedEnvironment,
    manifest,
    releaseChannel,
    releaseEdition,
    releaseTag,
    currentPlatformName,
    versionedRelativeDirectoryPath
}) {
    const latestOutputDirectoryPath = join(
        artifactRootDirectoryPath,
        "latest",
        releaseChannel,
        releaseEdition,
        currentPlatformName
    );

    recreateDirectory(latestOutputDirectoryPath);

    const latestManifest = {
        ...manifest,
        artifacts: manifest.artifacts.map((currentArtifact) => ({
            ...currentArtifact,
            downloadUrl: createPublicArtifactUrl({
                artifactFileName: currentArtifact.fileName,
                loadedEnvironment,
                versionedRelativeDirectoryPath
            })
        })),
        latestPath: `${releaseChannel}/latest/${releaseEdition}/${currentPlatformName}/manifest.json`,
        tag: releaseTag
    };

    writeFileSync(
        join(latestOutputDirectoryPath, "manifest.json"),
        JSON.stringify(latestManifest, null, 2)
    );

    for (const currentArtifact of collectedArtifacts) {
        const latestArtifactFileName = createLatestArtifactFileName({
            artifactKind: currentArtifact.kind,
            artifactFileName: currentArtifact.fileName,
            releaseEdition,
            currentPlatformName
        });

        copyFileSync(currentArtifact.path, join(latestOutputDirectoryPath, latestArtifactFileName));
    }

    return latestOutputDirectoryPath;
}

function createPublicArtifactUrl({
    artifactFileName,
    loadedEnvironment,
    versionedRelativeDirectoryPath
}) {
    const publicBaseUrl = loadedEnvironment.COGNO_RELEASE_PUBLIC_BASE_URL;

    if (publicBaseUrl === undefined || publicBaseUrl.length === 0) {
        return undefined;
    }

    const normalizedPublicBaseUrl = publicBaseUrl.replace(/\/+$/u, "");

    return `${normalizedPublicBaseUrl}/${versionedRelativeDirectoryPath}/${artifactFileName}`;
}

function createLatestArtifactFileName({
    artifactKind,
    artifactFileName,
    releaseEdition,
    currentPlatformName
}) {
    const artifactExtension = determineTargetArtifactExtension(artifactFileName);

    return [
        "cogno2",
        releaseEdition,
        currentPlatformName,
        process.arch,
        "latest",
        artifactKind
    ].join("-") + artifactExtension;
}

function runCommand(commandName, commandArguments, options = {}) {
    const { environmentVariables, runnerType } = options;
    const resolvedCommandName = resolveCommandName(commandName);
    const resolvedArguments =
        runnerType === "pnpm-run" ? ["run", ...commandArguments] : commandArguments;

    console.log(`> ${[resolvedCommandName, ...resolvedArguments].join(" ")}`);
    execFileSync(resolvedCommandName, resolvedArguments, {
        env: environmentVariables,
        stdio: "inherit"
    });
}

function runCommandAndCollectOutput(commandName, commandArguments) {
    const resolvedCommandName = resolveCommandName(commandName);

    return execFileSync(resolvedCommandName, commandArguments, {
        encoding: "utf-8"
    }).trim();
}

function resolveCommandName(commandName) {
    if (process.platform === "win32" && commandName === "pnpm") {
        return "pnpm.cmd";
    }

    return commandName;
}
