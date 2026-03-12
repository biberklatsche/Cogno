#!/usr/bin/env node
// Build, sign, notarize and staple Cogno2 DMG

import { execFileSync } from "child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync
} from "fs";
import { join } from "path";
import { homedir, tmpdir } from "os";

// ─── Config ───────────────────────────────────────────────────────────────────
const CREDENTIALS_FILE = join(homedir(), ".apple", "credentials");
const commandLineArguments = process.argv.slice(2);

if (commandLineArguments.includes("--help") || commandLineArguments.includes("-h")) {
    console.log("Builds the macOS app bundle, creates a DMG and optionally signs/notarizes it.");
    console.log("");
    console.log("Usage:");
    console.log("  node ./scripts/build-tauri-macos-signed-notarized.mjs [community|pro]");
    process.exit(0);
}

const releaseVariantArgument = commandLineArguments[0] ?? "pro";
const releaseVariantConfigurationByName = {
    community: {
        tauriConfigPath: "src-tauri/tauri.community.conf.json"
    },
    pro: {
        tauriConfigPath: "src-tauri/tauri.pro.conf.json"
    }
};
const releaseVariantConfiguration = releaseVariantConfigurationByName[releaseVariantArgument];

if (releaseVariantConfiguration === undefined) {
    throw new Error(
        `Unknown release variant "${releaseVariantArgument}". Supported variants: ${Object.keys(releaseVariantConfigurationByName).join(", ")}`
    );
}

const APP_PATH = "src-tauri/target/release/bundle/macos/Cogno2.app";
const DMG_DIR = "src-tauri/target/release/bundle/dmg";
const DMG_PATH = join(DMG_DIR, "cogno.dmg");
const DMG_VOLUME_NAME = "Cogno2";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(commandName, commandArguments, label) {
    console.log(`\n▶ ${label}...`);
    execFileSync(commandName, commandArguments, { stdio: "inherit" });
}

function step(label) {
    console.log(`\n${"─".repeat(60)}\n▶ ${label}`);
}

function createDiskImageFromApp() {
    mkdirSync(DMG_DIR, { recursive: true });

    const temporaryDirectory = mkdtempSync(join(tmpdir(), "cogno2-dmg-"));
    const temporaryAppPath = join(temporaryDirectory, "Cogno2.app");
    const applicationsSymlinkPath = join(temporaryDirectory, "Applications");

    cpSync(APP_PATH, temporaryAppPath, { recursive: true });
    symlinkSync("/Applications", applicationsSymlinkPath);

    try {
        run("hdiutil", ["create", "-volname", DMG_VOLUME_NAME, "-srcfolder", temporaryDirectory, "-ov", "-format", "UDZO", DMG_PATH], "hdiutil create");
    } finally {
        rmSync(temporaryDirectory, { force: true, recursive: true });
    }
}

function resolveAppleCredentials() {
    const appleId = process.env.COGNO_APPLE_ID;
    const teamId = process.env.COGNO_APPLE_TEAM_ID;
    const appleIdPassword = process.env.COGNO_APPLE_APP_PASSWORD;

    if (
        appleId !== undefined &&
        teamId !== undefined &&
        appleIdPassword !== undefined
    ) {
        return {
            appleId,
            appleIdPassword,
            teamId
        };
    }

    if (!existsSync(CREDENTIALS_FILE)) {
        return undefined;
    }

    const credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));

    return {
        appleId: credentials.appleId,
        appleIdPassword: credentials.appleIdPassword,
        teamId: credentials.teamId
    };
}

function resolveSigningIdentity() {
    return process.env.COGNO_APPLE_SIGNING_IDENTITY;
}

// ─── 1. Build ─────────────────────────────────────────────────────────────────
step(`Building app (${releaseVariantArgument})`);
run("pnpm", ["exec", "tauri", "build", "--bundles", "app", "--config", releaseVariantConfiguration.tauriConfigPath], "tauri build");

// ─── 2. Sign ──────────────────────────────────────────────────────────────────
const signingIdentity = resolveSigningIdentity();

if (signingIdentity !== undefined && signingIdentity.length > 0) {
    step("Signing app");
    run(
        "codesign",
        ["--force", "--deep", "--sign", signingIdentity, "--options", "runtime", "--timestamp", APP_PATH],
        "codesign"
    );
    run("codesign", ["--verify", "--deep", "--verbose=2", APP_PATH], "verify signature");
    console.log("✔ Signing done");
} else {
    console.log("\nSkipping signing because COGNO_APPLE_SIGNING_IDENTITY is not configured.");
}

// ─── 3. Create DMG ────────────────────────────────────────────────────────────
step("Creating DMG");

if (existsSync(DMG_PATH)) {
    rmSync(DMG_PATH);
    console.log(`  Removed old DMG: ${DMG_PATH}`);
}

createDiskImageFromApp();

if (!existsSync(DMG_PATH)) {
    throw new Error(`DMG was not created at expected path: ${DMG_PATH}`);
}

console.log(`✔ DMG created: ${DMG_PATH}`);

// ─── 4. Notarize ──────────────────────────────────────────────────────────────
const appleCredentials = resolveAppleCredentials();

if (appleCredentials !== undefined && signingIdentity !== undefined && signingIdentity.length > 0) {
    step("Notarizing DMG (this may take a few minutes)");
    run(
        "xcrun",
        [
            "notarytool",
            "submit",
            DMG_PATH,
            "--apple-id",
            appleCredentials.appleId,
            "--team-id",
            appleCredentials.teamId,
            "--password",
            appleCredentials.appleIdPassword,
            "--wait"
        ],
        "notarytool"
    );
    console.log("✔ Notarization accepted");

    // ─── 5. Staple ────────────────────────────────────────────────────────────
    step("Stapling ticket");
    run("xcrun", ["stapler", "staple", DMG_PATH], "stapler");
} else {
    console.log("\nSkipping notarization because Apple credentials or signing identity are missing.");
}

console.log(`\n${"═".repeat(60)}`);
console.log(`✅ Done! DMG is ready: ${DMG_PATH}`);
