import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

const PORT = 3001;
const ENDPOINT_PATH = "/cogno/dev/updater/latest.json";

const args = process.argv.slice(2);
const noUpdate = args.includes("--no-update");
const versionArgIdx = args.indexOf("--version");
const simulatedVersion =
  versionArgIdx !== -1 ? args[versionArgIdx + 1] : `${major}.${minor}.${patch + 1}`;
const currentVersion = pkg.version;

function makeUpdaterJson(version) {
  const fakeBase = `http://localhost:${PORT}/fake`;
  return JSON.stringify(
    {
      version,
      notes: `[Dev simulation] Cogno ${version}`,
      pub_date: new Date().toISOString(),
      platforms: {
        "darwin-aarch64": {
          url: `${fakeBase}/cogno_${version}_aarch64.app.tar.gz`,
          signature: "dev-fake-signature",
        },
        "darwin-x86_64": {
          url: `${fakeBase}/cogno_${version}_x86_64.app.tar.gz`,
          signature: "dev-fake-signature",
        },
        "linux-x86_64": {
          url: `${fakeBase}/cogno_${version}_amd64.AppImage.tar.gz`,
          signature: "dev-fake-signature",
        },
        "windows-x86_64": {
          url: `${fakeBase}/cogno_${version}_x64-setup.nsis.zip`,
          signature: "dev-fake-signature",
        },
      },
    },
    null,
    2,
  );
}

const server = createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }

  if (req.url === ENDPOINT_PATH) {
    const version = noUpdate ? currentVersion : simulatedVersion;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(makeUpdaterJson(version));
    const label = noUpdate ? `no update (${currentVersion})` : `${currentVersion} → ${version}`;
    console.log(`${new Date().toISOString()}  ${label}`);
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => {
  const mode = noUpdate ? "no update" : `update available → ${simulatedVersion}`;
  console.log(`Cogno dev update server  http://localhost:${PORT}${ENDPOINT_PATH}`);
  console.log(`  current: ${currentVersion}  |  mode: ${mode}`);
  console.log("  flags: --no-update  |  --version <x.y.z>");
  console.log("Press Ctrl+C to stop.\n");
});
