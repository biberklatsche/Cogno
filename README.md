# ⚡ Cogno 2.0 – Terminal Productivity, Reimagined with Tauri

> The next evolution of the modern developer terminal.

Cogno 2.0 is the spiritual successor of [Cogno](https://gitlab.com/cogno-rockers/cogno) — now rebuilt on **Tauri** for better performance, security, and native system integration.

---

## ✨ What's new in Cogno 2.0?

Cogno 2.0 retains the familiar features you love — like autocomplete, remote shell support, workspaces, and many more — but under the hood, it's powered by **Tauri** instead of Electron.

This architectural shift brings major improvements:

- 🪶 **Massively reduced bundle size** (from ~200 MB down to ~10 MB)
- 🚀 **Startup time under 100 ms** on most machines
- 🔒 **Stronger native security** (isolated system APIs, no Node.js context)
- 🛠️ **Written in Rust for speed & safety**

> 👉 Looking for the original Electron-based version? Check out [Cogno 1.x on GitLab](https://gitlab.com/cogno-rockers/cogno)

---

## 🧠 Why Tauri?

Electron has served us well, but Tauri offers a modern native-first approach:

| Feature           | Electron           | Tauri (Cogno 2.0)      |
|-------------------|--------------------|-------------------------|
| Core language     | JavaScript + Node  | Rust + Web frontend     |
| Bundle size       | ~200–250 MB        | ~10-20 MB                |
| RAM usage         | High (~200–500 MB) | Very low (~50–80 MB)    |
| App isolation     | Weak               | Strong + secure APIs    |
| Dev experience    | Node ecosystem     | Web + Rust power        |

Cogno 2.0 embraces this shift fully — no Node.js runtime, no Electron overhead, and full control over file system, shell processes, and security.

---

## 📦 Status

**Work in progress**  
This is an ongoing rebuild. Features are being reintroduced one by one in the Tauri-native architecture.

### 🦀 Rust (Backend)
- [x] Launch shell process
- [x] Detect available fonts
- [x] Detect available shells
- [x] AES crypto module
- [x] File operations
- [ ] Autoupdate process
- [ ] Save window settings

### 🌐 Frontend
- [x] Load settings
- [ ] Edit settings
- [ ] Save settings
- [ ] Watch settings file
- [x] Integrate xterm.js
- [ ] Custom window styling
- [ ] Grid management
- [ ] Tabs management
- [ ] Load workspaces
- [ ] Save workspaces
- [ ] Edit workspaces
- [ ] Simple DB implementation
- [ ] Autoupdate process
---

## 🔗 Original Cogno

The original version of [Cogno (1.x)]((https://gitlab.com/cogno-rockers/cogno)), built on Electron, is still actively maintained by me.
However, as development on Cogno 2.0 progresses, my focus is shifting more and more to this new Tauri-based version.
New features and improvements will primarily land here going forward.

---

## 🛠️ Build instructions

Tauri requires Rust and a working build toolchain, see [Tauri V2](https://v2.tauri.app/)

### macOS: Signierter und notarisiert Build

Konfiguration:
- `src-tauri/tauri.conf.json` nutzt `bundle.macOS` mit `hardenedRuntime` und `entitlements`.
- `src-tauri/entitlements.plist` ist hinterlegt.

Erforderliche Umgebungsvariablen:
- Code Signing:
  - `APPLE_SIGNING_IDENTITY` oder `APPLE_CERTIFICATE` (+ `APPLE_CERTIFICATE_PASSWORD`)
- Notarisierung:
  - `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
  - oder alternativ `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH`
- Optional:
  - `APPLE_PROVIDER_SHORT_NAME`

Alternative wie in der alten Electron-App:
- `scripts/build-tauri-macos-signed-notarized.mjs` liest automatisch `~/.apple/credentials`
- Erwartetes Format:

```json
{
  "appleId": "dein@apple.id",
  "teamId": "ABCDE12345",
  "appleIdPassword": "xxxx-xxxx-xxxx-xxxx"
}
```

Die Werte werden auf `APPLE_ID`, `APPLE_TEAM_ID` und `APPLE_PASSWORD` gemappt.

Build ausführen:

```bash
npm run tauri:build:macos:signed-notarized
```

Direkt mit Tauri CLI:

```bash
npx tauri build --bundles app,dmg
```
