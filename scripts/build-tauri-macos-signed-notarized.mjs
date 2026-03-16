#!/usr/bin/env node
// Build, sign, notarize and staple Cogno2 DMG

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// ─── Config ───────────────────────────────────────────────────────────────────
const CREDENTIALS_FILE = join(homedir(), ".apple", "credentials");
const commandLineArguments = process.argv.slice(2);

if (commandLineArguments.includes("--help") || commandLineArguments.includes("-h")) {
  console.log("Builds the macOS app bundle, creates a DMG and optionally signs/notarizes it.");
  console.log("");
  console.log("Usage:");
  console.log("  node ./scripts/build-tauri-macos-signed-notarized.mjs");
  process.exit(0);
}

if (commandLineArguments.length > 0) {
  throw new Error("This script no longer accepts an edition argument.");
}

const APP_PATH = "src-tauri/target/release/bundle/macos/Cogno2.app";
const DMG_DIR = "src-tauri/target/release/bundle/dmg";
const DMG_PATH = join(DMG_DIR, "cogno.dmg");
const DMG_VOLUME_NAME = "Cogno2";
const DMG_STAGING_FILE_NAME = "cogno-staging.dmg";
const DMG_STAGING_PATH = join(DMG_DIR, DMG_STAGING_FILE_NAME);
const DMG_WINDOW_BOUNDS = { left: 160, top: 120, right: 780, bottom: 460 };
const DMG_APP_ICON_POSITION = { x: 170, y: 190 };
const DMG_APPLICATIONS_ICON_POSITION = { x: 450, y: 190 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(commandName, commandArguments, label) {
  console.log(`\n▶ ${label}...`);
  execFileSync(commandName, commandArguments, { stdio: "inherit" });
}

function step(label) {
  console.log(`\n${"─".repeat(60)}\n▶ ${label}`);
}

function runAndCapture(commandName, commandArguments, label) {
  console.log(`\n▶ ${label}...`);
  return execFileSync(commandName, commandArguments, { encoding: "utf-8" }).trim();
}

function escapeAppleScriptString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function styleMountedDiskImage() {
  const finderWindowBounds = `{${DMG_WINDOW_BOUNDS.left}, ${DMG_WINDOW_BOUNDS.top}, ${DMG_WINDOW_BOUNDS.right}, ${DMG_WINDOW_BOUNDS.bottom}}`;

  const appleScript = `
tell application "Finder"
  tell disk "${escapeAppleScriptString(DMG_VOLUME_NAME)}"
    open
    delay 1
    set currentContainerWindow to container window
    set current view of currentContainerWindow to icon view
    set toolbar visible of currentContainerWindow to false
    set statusbar visible of currentContainerWindow to false
    set pathbar visible of currentContainerWindow to false
    set sidebar width of currentContainerWindow to 0
    set bounds of currentContainerWindow to ${finderWindowBounds}
    set currentIconViewOptions to the icon view options of currentContainerWindow
    set arrangement of currentIconViewOptions to not arranged
    set icon size of currentIconViewOptions to 128
    set text size of currentIconViewOptions to 16
    set position of item "Cogno2.app" to {${DMG_APP_ICON_POSITION.x}, ${DMG_APP_ICON_POSITION.y}}
    set position of item "Applications" to {${DMG_APPLICATIONS_ICON_POSITION.x}, ${DMG_APPLICATIONS_ICON_POSITION.y}}
    close
    open
    update without registering applications
    delay 2
  end tell
end tell
`;

  run("osascript", ["-e", appleScript], "style dmg Finder window");
}

function createDiskImageFromApp() {
  mkdirSync(DMG_DIR, { recursive: true });

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "cogno2-dmg-"));
  const temporaryAppPath = join(temporaryDirectory, "Cogno2.app");
  const applicationsSymlinkPath = join(temporaryDirectory, "Applications");
  let mountedVolumeDevice;

  cpSync(APP_PATH, temporaryAppPath, { recursive: true });
  symlinkSync("/Applications", applicationsSymlinkPath);

  try {
    run(
      "hdiutil",
      [
        "create",
        "-volname",
        DMG_VOLUME_NAME,
        "-srcfolder",
        temporaryDirectory,
        "-ov",
        "-format",
        "UDRW",
        DMG_STAGING_PATH,
      ],
      "hdiutil create staging image",
    );

    mountedVolumeDevice = runAndCapture(
      "hdiutil",
      [
        "attach",
        DMG_STAGING_PATH,
        "-mountpoint",
        `/Volumes/${DMG_VOLUME_NAME}`,
        "-noautoopen",
        "-readwrite",
        "-nobrowse",
      ],
      "attach staging image",
    )
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("/dev/"))
      ?.split(/\s+/)[0];

    if (mountedVolumeDevice === undefined) {
      throw new Error("Unable to determine mounted disk device for staging DMG.");
    }

    styleMountedDiskImage();

    run("hdiutil", ["detach", mountedVolumeDevice], "detach staging image");
    mountedVolumeDevice = undefined;

    run(
      "hdiutil",
      ["convert", DMG_STAGING_PATH, "-ov", "-format", "UDZO", "-o", DMG_PATH],
      "convert staging image to final dmg",
    );
  } finally {
    if (mountedVolumeDevice !== undefined) {
      try {
        run("hdiutil", ["detach", mountedVolumeDevice, "-force"], "force detach staging image");
      } catch {
        console.warn("Unable to force-detach staging image during cleanup.");
      }
    }

    if (existsSync(DMG_STAGING_PATH)) {
      rmSync(DMG_STAGING_PATH);
    }

    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function resolveAppleCredentials() {
  const appleId = process.env.COGNO_APPLE_ID;
  const teamId = process.env.COGNO_APPLE_TEAM_ID;
  const appleIdPassword = process.env.COGNO_APPLE_APP_PASSWORD;

  if (appleId !== undefined && teamId !== undefined && appleIdPassword !== undefined) {
    return {
      appleId,
      appleIdPassword,
      teamId,
    };
  }

  if (!existsSync(CREDENTIALS_FILE)) {
    return undefined;
  }

  const credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));

  return {
    appleId: credentials.appleId,
    appleIdPassword: credentials.appleIdPassword,
    teamId: credentials.teamId,
  };
}

function resolveSigningIdentity() {
  return process.env.COGNO_APPLE_SIGNING_IDENTITY;
}

// ─── 1. Build ─────────────────────────────────────────────────────────────────
step("Building app");
run(
  "pnpm",
  ["exec", "tauri", "build", "--bundles", "app", "--config", "src-tauri/tauri.conf.json"],
  "tauri build",
);

// ─── 2. Sign ──────────────────────────────────────────────────────────────────
const signingIdentity = resolveSigningIdentity();

if (signingIdentity !== undefined && signingIdentity.length > 0) {
  step("Signing app");
  run(
    "codesign",
    [
      "--force",
      "--deep",
      "--sign",
      signingIdentity,
      "--options",
      "runtime",
      "--timestamp",
      APP_PATH,
    ],
    "codesign",
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

if (existsSync(DMG_STAGING_PATH)) {
  rmSync(DMG_STAGING_PATH);
  console.log(`  Removed old staging DMG: ${DMG_STAGING_PATH}`);
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
      "--wait",
    ],
    "notarytool",
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
