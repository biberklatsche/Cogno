#!/usr/bin/env node
// Build the macOS DMG with Tauri and optionally notarize/staple it.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const credentialsFilePath = join(homedir(), ".apple", "credentials");
const tauriConfigPath = "src-tauri/tauri.conf.json";
const dmgPath = "src-tauri/target/release/bundle/dmg/cogno.dmg";
const entitlementsPath = "src-tauri/entitlements.plist";
const commandLineArguments = process.argv.slice(2);

if (commandLineArguments.includes("--help") || commandLineArguments.includes("-h")) {
  console.log("Builds the macOS DMG with Tauri and optionally notarizes it.");
  console.log("");
  console.log("Usage:");
  console.log("  node ./scripts/build-tauri-macos-signed-notarized.mjs");
  process.exit(0);
}

if (commandLineArguments.length > 0) {
  throw new Error("This script does not accept additional arguments.");
}

function run(commandName, commandArguments, label, environmentVariables = process.env) {
  console.log(`\n▶ ${label}...`);
  execFileSync(commandName, commandArguments, {
    env: environmentVariables,
    stdio: "inherit",
  });
}

function step(label) {
  console.log(`\n${"─".repeat(60)}\n▶ ${label}`);
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

  if (!existsSync(credentialsFilePath)) {
    return undefined;
  }

  const credentials = JSON.parse(readFileSync(credentialsFilePath, "utf-8"));

  return {
    appleId: credentials.appleId,
    appleIdPassword: credentials.appleIdPassword,
    teamId: credentials.teamId,
  };
}

function resolveSigningIdentity() {
  return process.env.COGNO_APPLE_SIGNING_IDENTITY;
}

function createTauriMacosBuildConfig() {
  const baseConfig = JSON.parse(readFileSync(tauriConfigPath, "utf-8"));
  const signingIdentity = resolveSigningIdentity();
  const macosBundleConfig = {
    ...(baseConfig.bundle?.macOS ?? {}),
  };

  if (signingIdentity !== undefined && signingIdentity.length > 0) {
    macosBundleConfig.signingIdentity = signingIdentity;
    macosBundleConfig.entitlements ??= entitlementsPath;
  }

  return {
    ...baseConfig,
    bundle: {
      ...baseConfig.bundle,
      macOS: macosBundleConfig,
    },
  };
}

function buildMacosDmg() {
  const temporaryConfigDirectoryPath = mkdtempSync(join(tmpdir(), "cogno2-tauri-config-"));
  const temporaryConfigPath = join(temporaryConfigDirectoryPath, "tauri.macos.build.json");

  try {
    const tauriMacosBuildConfig = createTauriMacosBuildConfig();
    writeFileSync(temporaryConfigPath, JSON.stringify(tauriMacosBuildConfig, null, 2));

    run(
      "pnpm",
      ["exec", "tauri", "build", "--bundles", "dmg", "--config", temporaryConfigPath],
      "tauri build dmg",
    );
  } finally {
    rmSync(temporaryConfigDirectoryPath, { force: true, recursive: true });
  }
}

step("Building DMG");
buildMacosDmg();

if (!existsSync(dmgPath)) {
  throw new Error(`DMG was not created at expected path: ${dmgPath}`);
}

console.log(`✔ DMG created: ${dmgPath}`);

const appleCredentials = resolveAppleCredentials();
const signingIdentity = resolveSigningIdentity();

if (appleCredentials !== undefined && signingIdentity !== undefined && signingIdentity.length > 0) {
  step("Notarizing DMG (this may take a few minutes)");
  run(
    "xcrun",
    [
      "notarytool",
      "submit",
      dmgPath,
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

  step("Stapling ticket");
  run("xcrun", ["stapler", "staple", dmgPath], "stapler");
} else {
  console.log("\nSkipping notarization because Apple credentials or signing identity are missing.");
}

console.log(`\n${"═".repeat(60)}`);
console.log(`✅ Done! DMG is ready: ${dmgPath}`);
