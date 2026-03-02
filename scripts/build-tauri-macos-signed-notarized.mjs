#!/usr/bin/env node
// Build, sign, notarize and staple Cogno2 DMG

import { execSync } from "child_process";
import { readFileSync, readdirSync, rmSync, renameSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ─── Config ───────────────────────────────────────────────────────────────────
const CREDENTIALS_FILE = join(homedir(), ".apple", "credentials");
const SIGNING_IDENTITY = "Developer ID Application: Lars Wolfram (28K66AW32D)";
const APP_PATH = "src-tauri/target/release/bundle/macos/Cogno2.app";
const DMG_DIR = "src-tauri/target/release/bundle/dmg";
const ICNS = `${APP_PATH}/Contents/Resources/icon.icns`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, label) {
    console.log(`\n▶ ${label}...`);
    execSync(cmd, { stdio: "inherit" });
}

function step(label) {
    console.log(`\n${"─".repeat(60)}\n▶ ${label}`);
}

// ─── Read credentials ─────────────────────────────────────────────────────────
const credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
const { appleId, teamId, appleIdPassword } = credentials;

// ─── 1. Build ─────────────────────────────────────────────────────────────────
step("Building app");
run("npm run tauri build -- --bundles app", "tauri build");

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

// Remove old DMGs
readdirSync(DMG_DIR)
    .filter((f) => f.endsWith(".dmg"))
    .forEach((f) => {
        rmSync(join(DMG_DIR, f));
        console.log(`  Removed old DMG: ${f}`);
    });

run(
    `create-dmg --volicon "${ICNS}" --overwrite "${APP_PATH}" "${DMG_DIR}"`,
    "create-dmg"
);

const createdDmg = readdirSync(DMG_DIR)
    .filter((f) => f.endsWith(".dmg"))
    .map((f) => join(DMG_DIR, f))[0];

const dmgPath = join(DMG_DIR, "cogno.dmg");
renameSync(createdDmg, dmgPath);

console.log(`✔ DMG created: ${dmgPath}`);

// ─── 4. Notarize ──────────────────────────────────────────────────────────────
step("Notarizing DMG (this may take a few minutes)");
run(
    `xcrun notarytool submit "${dmgPath}" \
    --apple-id "${appleId}" \
    --team-id "${teamId}" \
    --password "${appleIdPassword}" \
    --wait`,
    "notarytool"
);
console.log("✔ Notarization accepted");

// ─── 5. Staple ────────────────────────────────────────────────────────────────
step("Stapling ticket");
run(`xcrun stapler staple "${dmgPath}"`, "stapler");

console.log(`\n${"═".repeat(60)}`);
console.log(`✅ Done! DMG is ready: ${dmgPath}`);
