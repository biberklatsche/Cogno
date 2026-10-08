#!/usr/bin/env node
// Deploys the worker with the Cloudflare credentials from the release settings:
//   node infra/dl-worker/deploy.mjs

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const settingsFilePath = join(homedir(), ".cogno-secrets", "release.settings.json");
const { accountId, apiToken } =
  JSON.parse(readFileSync(settingsFilePath, "utf-8")).cloudflare ?? {};

if (!accountId || !apiToken) {
  throw new Error(`"cloudflare.accountId" and "cloudflare.apiToken" are missing in ${settingsFilePath}.`);
}

execSync("npx -y wrangler@4 deploy", {
  cwd: dirname(fileURLToPath(import.meta.url)),
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: apiToken },
  stdio: "inherit",
});
