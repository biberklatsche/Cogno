# Release

## Konfiguration

Es gibt genau eine Konfigurationsdatei:

- `~/.cogno-secrets/release.settings.json`

Beispiele im Repository:

- [scripts/release-settings.example.json](/Users/larswolfram/projects/cogno2/scripts/release-settings.example.json)

## Ablauf

### 1. Tag erstellen

Beispiel:

```bash
git tag v1.2.3
git push origin v1.2.3
```

Danach wird auf jedem Rechner genau dieses Tag ausgecheckt.

### 2. Auf jedem Rechner bauen

Auf Windows, Linux und macOS:

```bash
pnpm run release:build -- --channel release
```

Jeder Rechner baut nur seine eigene Plattform und lädt sie nach `staging` hoch.

### 3. Einmal finalisieren

Wenn alle drei Builds fertig sind:

```bash
pnpm run release:build -- --channel release --finalize
```

Erst dieser Schritt veröffentlicht `latest.json` und `updater/latest.json`.

## S3-Struktur

Nach dem Build:

```text
cogno2/
  release/
    staging/
      v1.2.3/
        macos/
          ...
          manifest.json
        windows/
          ...
          manifest.json
        linux/
          ...
          manifest.json
```

Nach dem Finalize:

```text
cogno2/
  release/
    releases/
      v1.2.3/
        macos/
          ...
          manifest.json
        windows/
          ...
          manifest.json
        linux/
          ...
          manifest.json
    latest/
      macos/
        manifest.json
      windows/
        manifest.json
      linux/
        manifest.json
    latest.json
    updater/
      latest.json
```

## Beispiel für `release.settings.json`

```json
{
  "storage": {
    "bucketName": "downloads",
    "region": "eu-central-1",
    "endpoint": "https://s3.eu-central-1.amazonaws.com",
    "accessKeyId": "YOUR_ACCESS_KEY_ID",
    "secretAccessKey": "YOUR_SECRET_ACCESS_KEY",
    "forcePathStyle": true,
    "basePath": "cogno2",
    "publicBaseUrl": "https://downloads.example.com"
  },
  "apple": {
    "signingIdentity": "Developer ID Application: Example Name (TEAMID1234)",
    "appleId": "your-apple-id@example.com",
    "teamId": "TEAMID1234",
    "appleIdPassword": "app-specific-password"
  },
  "requiredPlatforms": ["linux", "macos", "windows"],
  "channels": {
    "dev": {
      "requiredPlatforms": ["linux", "macos", "windows"],
      "notesFilePath": "./release-notes/dev.md"
    },
    "release": {
      "requiredPlatforms": ["linux", "macos", "windows"],
      "notesFilePath": "./release-notes/release.md"
    }
  },
  "updater": {
    "enabled": true,
    "privateKeyPath": "~/.tauri/cogno.key",
    "privateKeyPassword": "",
    "publicKeyPath": "~/.tauri/cogno.pub"
  }
}
```

## Website und Channels

Website:

- `https://downloads.example.com/cogno2/release/latest.json`
- `https://downloads.example.com/cogno2/dev/latest.json`

## Test-Release ohne Tag

Rein lokal, ohne Upload:

```bash
pnpm run release:build -- --test
```

## Test im dev-Channel

Mit Upload, aber ohne offizielles Release-Tag auf `HEAD`:

```bash
pnpm run release:build -- --tag v1.2.3-test --channel dev --allow-dirty
```

Damit landet alles im `dev`-Channel und nichts im `release`-Channel.
