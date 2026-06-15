import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const releaseSettingsFilePath = join(homedir(), ".cogno-secrets", "release.settings.json");
const bucketName = "cogno-releases";

await main();

async function main() {
  const cloudflare = loadCloudflareSettings();
  const env = {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: cloudflare.accountId,
    CLOUDFLARE_API_TOKEN: cloudflare.apiToken,
  };

  console.log(`Creating R2 bucket "${bucketName}"...`);
  runWranglerIdempotent(["r2", "bucket", "create", bucketName], env);

  console.log(`Enabling public dev URL for "${bucketName}"...`);
  const devUrlOutput = runWranglerIdempotent(
    ["r2", "bucket", "dev-url", "enable", bucketName],
    env,
  );

  const devUrlMatch = devUrlOutput.match(/https:\/\/pub-[a-z0-9]+\.r2\.dev/u);
  if (devUrlMatch) {
    console.log(`\nR2 public dev URL: ${devUrlMatch[0]}`);
    console.log(`Set "storage.publicBaseUrl" to this value in ${releaseSettingsFilePath},`);
    console.log(
      `and update the updater "endpoints" in src-tauri/tauri.conf.json / tauri.dev.conf.json to:`,
    );
    console.log(`  ${devUrlMatch[0]}/cogno/prod/updater/latest.json`);
    console.log(`  ${devUrlMatch[0]}/cogno/dev/updater/latest.json`);
  } else {
    console.log(devUrlOutput);
  }

  console.log(
    "\nManual step (no wrangler CLI equivalent): create an R2 API token in the Cloudflare " +
      `dashboard (R2 -> Manage API Tokens) and add accessKeyId/secretAccessKey/endpoint to "storage" in ${releaseSettingsFilePath}.`,
  );
}

function loadCloudflareSettings() {
  const parsedSettings =
    existsSync(releaseSettingsFilePath) && statSync(releaseSettingsFilePath).isFile()
      ? JSON.parse(readFileSync(releaseSettingsFilePath, "utf-8"))
      : {};

  const cloudflare = parsedSettings.cloudflare ?? {};

  if (!cloudflare.accountId || !cloudflare.apiToken) {
    throw new Error(
      `Missing "cloudflare.accountId" / "cloudflare.apiToken" in ${releaseSettingsFilePath}.`,
    );
  }

  return cloudflare;
}

function runWrangler(args, env) {
  return execFileSync("pnpm", ["dlx", "wrangler", ...args], { env, encoding: "utf-8" });
}

function runWranglerIdempotent(args, env) {
  try {
    return runWrangler(args, env);
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    if (/already exists|already enabled/iu.test(output)) {
      console.log("  (already set up, continuing)");
      return output;
    }
    throw error;
  }
}
