# Release process

Releases are built locally on each platform with `pnpm release:build` and
published to Cloudflare R2. The Tauri auto-updater points directly at a
static `updater/latest.json` file in the bucket — no separate server is
required for `dev`/`prod`.

## `~/.cogno-secrets/release.settings.json`

All credentials and per-machine settings live outside the repo in
`~/.cogno-secrets/release.settings.json`. Example:

```json
{
  "storage": {
    "bucketName": "cogno-releases",
    "region": "auto",
    "endpoint": "https://<account-id>.r2.cloudflarestorage.com",
    "accessKeyId": "...",
    "secretAccessKey": "...",
    "forcePathStyle": true,
    "basePath": "cogno",
    "publicBaseUrl": "https://pub-xxxxxxxx.r2.dev"
  },
  "apple": {
    "signingIdentity": "Developer ID Application: ...",
    "appleId": "...",
    "teamId": "...",
    "appleIdPassword": "..."
  },
  "requiredPlatforms": ["linux", "macos", "windows"],
  "updater": {
    "enabled": true,
    "privateKeyPath": "~/.cogno-secrets/cogno-updater.key",
    "privateKeyPassword": "",
    "publicKeyPath": "~/.cogno-secrets/cogno-updater.key.pub"
  },
  "cloudflare": {
    "accountId": "...",
    "apiToken": "..."
  }
}
```

### `storage`

S3-compatible credentials for the R2 bucket `cogno-releases`. `endpoint` and
`accessKeyId`/`secretAccessKey` come from an R2 API token (Cloudflare
dashboard: R2 → Manage API Tokens — this step has no CLI equivalent).
`publicBaseUrl` is the R2 bucket's public dev URL, printed by
`pnpm r2:setup`.

### `updater`

Configures Tauri updater artifact signing during `pnpm release:build`.
`privateKeyPath`/`publicKeyPath` point at the ed25519 keypair generated once
with:

```bash
pnpm exec tauri signer generate --ci -p "" -w ~/.cogno-secrets/cogno-updater.key
```

The public key also goes into `plugins.updater.pubkey` in
`src-tauri/tauri.conf.json` and `tauri.dev.conf.json`.

### `cloudflare`

Used by `scripts/r2-setup.mjs` to drive `wrangler` non-interactively:

- `accountId` / `apiToken`: Cloudflare account ID and an API token with R2
  permissions.

## Channels

Builds are published under a channel path segment: `dev` or `prod`
(`pnpm release:build --channel dev|prod`). A future `pro` (licensed) channel
can be added by extending `supportedChannels` in `scripts/release-build.mjs`
and adding a corresponding `plugins.updater.endpoints` entry — no other code
changes are required for `dev`/`prod`.

If `pro` needs server-side license checks before serving updates, that's the
point to introduce a small Cloudflare Worker in front of R2 — not needed for
`dev`/`prod`.

## R2 setup (one-time)

```bash
pnpm r2:setup
```

Creates the `cogno-releases` R2 bucket and enables its public dev URL. After
running it:

1. Set `storage.publicBaseUrl` in `release.settings.json` to the printed
   `https://pub-xxxxxxxx.r2.dev` URL.
2. Update `plugins.updater.endpoints` in `src-tauri/tauri.conf.json` (channel
   `prod`) and `src-tauri/tauri.dev.conf.json` (channel `dev`) to:
   ```
   https://pub-xxxxxxxx.r2.dev/cogno/<channel>/updater/latest.json
   ```
3. Create an R2 API token (Cloudflare dashboard: R2 → Manage API Tokens) and
   add `accessKeyId`/`secretAccessKey`/`endpoint` to `storage` in
   `release.settings.json` (no CLI equivalent).

## Verifying

After a finalized release (`pnpm release:build --channel dev --finalize`),
`https://pub-xxxxxxxx.r2.dev/cogno/dev/updater/latest.json` should return the
Tauri updater manifest (`version`, `notes`, `pub_date`, `platforms`). Start an
older build and use "Check for Updates" in Cogno to verify the update dialog
appears.
