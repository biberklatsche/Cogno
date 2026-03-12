#!/usr/bin/env node
// Build, sign, notarize and staple Cogno2 DMG

import { execSync } from "child_process";
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
const SIGNING_IDENTITY = "Developer ID Application: Lars Wolfram (28K66AW32D)";
const releaseVariantArgument = process.argv[2] ?? "pro";
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
function run(cmd, label) {
    console.log(`\n▶ ${label}...`);
    execSync(cmd, { stdio: "inherit" });
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
        run(
            `hdiutil create -volname "${DMG_VOLUME_NAME}" -srcfolder "${temporaryDirectory}" -ov -format UDZO "${DMG_PATH}"`,
            "hdiutil create"
        );
    } finally {
        rmSync(temporaryDirectory, { force: true, recursive: true });
    }
}

// ─── Read credentials ─────────────────────────────────────────────────────────
const credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
const { appleId, teamId, appleIdPassword } = credentials;

// ─── 1. Build ─────────────────────────────────────────────────────────────────
step(`Building app (${releaseVariantArgument})`);
run(
    `npm run tauri build -- --bundles app --config ${releaseVariantConfiguration.tauriConfigPath}`,
    "tauri build"
);

// ─── 2. Sign ──────────────────────────────────────────────────────────────────
step("Signing app");
run(
    `codesign --force --deep \
    --sign "${SIGNING_IDENTITY}" \
    --options runtime \
    --timestamp \
    "${APP_PATH}"`,
    "codesign"
);
run(
    `codesign --verify --deep --verbose=2 "${APP_PATH}"`,
    "verify signature"
);
console.log("✔ Signing done");

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
step("Notarizing DMG (this may take a few minutes)");
run(
    `xcrun notarytool submit "${DMG_PATH}" \
    --apple-id "${appleId}" \
    --team-id "${teamId}" \
    --password "${appleIdPassword}" \
    --wait`,
    "notarytool"
);
console.log("✔ Notarization accepted");

// ─── 5. Staple ────────────────────────────────────────────────────────────────
step("Stapling ticket");
run(`xcrun stapler staple "${DMG_PATH}"`, "stapler");

console.log(`\n${"═".repeat(60)}`);
console.log(`✅ Done! DMG is ready: ${DMG_PATH}`);
