# Schritt 27 — Sitzungs-Wiederherstellung (Design)

Ziel: nach App-Neustart sind Workspaces, Tabs, Panes **und** der Terminal-Scrollback
wieder da; ein Kommando, das beim Beenden lief, steht im Command-Log als
abgebrochen. Layout-Persistenz existiert bereits (Workspace-Modul); dieser Schritt
ergänzt **pro Terminal einen Snapshot** (Scrollback + Start-Kontext) und den
Serialisierungs-/Restore-Fluss.

> Status: **Design, noch nicht implementiert.** Erst abstimmen (v. a. die
> „Zu entscheiden"-Punkte), dann in grünen Teilcommits umsetzen.

---

## Ausgangslage (aus dem Code verifiziert)

- **`terminal_session`-Tabelle existiert schon** (`workspace/migrations/001_init_workspace.sql`):
  `(workspace_id, terminal_id, session_data TEXT, updated_at)`. `WorkspaceRepository`
  hat `create/update/get/deleteTerminalSession` — **produktiv aber nirgends genutzt**
  (nur Spec). Genau der Slot für den Snapshot; `session_data` = JSON(SessionSnapshot).
- **`SessionHost`** hält das xterm-`Terminal` nur über `this.renderer.terminal`.
  Präzedenzfall fürs Buffer-Lesen: `getRecentOutputSnapshot()`. Kein snapshot/restore.
  `start()` spawnt immer eine frische PTY; Restore muss den Scrollback **nach** dem
  Spawn in `renderer.terminal` schreiben. `close()` ist der letzte sichere Lesepunkt.
- **SerializeAddon fehlt** (`@xterm/addon-serialize` nicht installiert). Wird in
  `core/terminal/renderer.ts` geladen (wie fit/search-Addon) + über `IRenderer`
  freigegeben.
- **DB-Transaktion**: einzige Atomarität ist `DatabaseAccess.batch(statements)` (ein
  Tauri-`db_batch` = eine Transaktion). Der Serializer sammelt **erst** alle Snapshots,
  baut dann **ein** `DatabaseStatement[]` und ruft `batch()` **einmal** — kein `await`
  in der „Transaktion".
- **Save/Restore-Fluss**: `WorkspaceHostApplicationService` lädt bei `DBInitialized` →
  `activateWorkspace` → `tabListService.restoreTabs` + `gridListService.restoreGridsForWorkspace`.
  Der Session-Serializer lebt daneben.
- **Quit**: `WindowService.quit()/closeWindow()` (async) — Hook zwischen Busy-Confirm
  und `process.exit()`; `onCloseRequested$` als frühester OS-Close-Abfangpunkt.
- **Start-Kontext**: Start-cwd = `pane.workingDir` + Basis-Kontext (Kontext-Stack
  Eintrag 0). WSL/SSH sind transiente Inner-Kontexte (nicht persistiert) → Restore
  nutzt bewusst den Basis-Kontext, auch wenn zuletzt WSL/SSH aktiv war.
- **`aborted` existiert nicht** im Command-Log — neues Konzept (siehe Entscheidung 2).
- **Fenster-Identität = Tauri-Window-Label** (Rust `WindowRegistry`), kein numerischer
  `windowId`. Ein Workspace gehört via `claim_workspace` genau einem Fenster (siehe
  Entscheidung 1).

---

## Datenmodell

`SessionSnapshot` (in `core/session/`, versioniert):

```
{
  version: 1,
  start: { shellName: string; workingDir: string; shellContext: <Basis-Kontext> },
  scrollback: string | null,   // serialisierter Buffer (ohne Alt-Screen), gekappt
  history?: string[],          // optional (terminal.history)
  abortedCommand?: { text: string; startedAt: number } // lief beim Snapshot
}
```

Ablage: `terminal_session.session_data = JSON(SessionSnapshot)`, Key
`(workspace_id, terminal_id)`.

---

## Slices

- **27a — SerializeAddon**: `@xterm/addon-serialize` als dep; in `renderer.ts` laden;
  `IRenderer.serialize(maxLines): string` (ohne Alt-Screen). Klein, isoliert.
- **27b — Host snapshot/restore**: `SessionHost.snapshot(): SessionSnapshot` (nutzt
  `renderer.serialize`, kappt auf `terminal.restore.max_lines`, Start = Basis-Kontext,
  `abortedCommand` wenn `isCommandRunning`); `SessionHost.restore(snapshot)` schreibt
  nach dem Spawn den Scrollback + **Trennzeile** in `renderer.terminal`, dann läuft der
  frische Prompt an. Start-cwd = `snapshot.start.workingDir`. Bei laufендem Kommando:
  Eintrag `aborted` ins Command-Log. Roundtrip-/Unlesbar-Tests.
- **27c — Settings + Action**: `terminal.restore.scrollback` (on/off) +
  `terminal.restore.max_lines` in `TerminalSettingsSchema` **und**
  `default-config-values.ts` (→ `pnpm generate:actions` schreibt die Configs, Schritt K);
  Katalog-Action `exclude_from_restore` (+ Handler: markiert das fokussierte Terminal).
- **27d — Serializer (Transaktion)**: neuer Service im Workspace-Modul: sammelt Snapshots
  aller lebenden `SessionHost`s (über `SessionHostFactory`/Registry), baut **ein**
  `batch()` (Upsert `terminal_session`), **kein `await` innerhalb**. Auslöser:
  Dirty/Debounce + Workspace-Wechsel. Test: verzögertes `snapshot()` darf die Transaktion
  nicht aufreißen.
- **27e — Quit + Zeitbudget**: Hook in `quit()`/`closeWindow()`:
  `await serializer.serializeAll({ budgetMs })`; bei Überschreitung Layout speichern,
  Scrollback weglassen, kein Hänger. Test mit langsamer Serialisierung.
- **27f — Restore beim Start + Lifecycle**: bei `activateWorkspace` `terminal_session`
  lesen → beim `ensureSession` den Snapshot an `restore()` reichen. Löschung bei Terminal-
  Close; Verwaisten-Prune beim Start. `scrollback=off` → Spalte leer.
- **27g — Fenster-Scoping**: siehe Entscheidung 1 (vermutlich **kein** `windowId`-Spalten-
  Umbau nötig, da Workspaces via `claim_workspace` schon fenster-exklusiv sind).

Jeder Slice ein grüner Commit (biome, depcruise, guard, tsc, vitest, ng build; wo Rust
berührt: `cargo check`).

---

## Zu entscheiden (vor der Umsetzung)

1. **`windowId` — brauchen wir die Spalten überhaupt?** Der Plan (Schritt 27) nennt
   „`windowId` in `terminal_session` und `side_menu_state`". Real ist Fenster-Identität
   ein Tauri-Label, und ein Workspace gehört via `claim_workspace` schon genau einem
   Fenster. `terminal_session` hängt an `workspace_id` → ist damit **implizit fenster-
   scoped**. **Empfehlung:** keine `windowId`-Spalten; Scoping über die bestehende
   Workspace↔Fenster-Bindung. (Abweichung vom Plantext — bitte bestätigen.)
2. **`aborted`-Kommando — wie darstellen?** Es gibt kein `aborted`-Konzept. **Empfehlung:**
   beim Snapshot eines laufenden Kommandos einen Command-Log-Eintrag mit einem neuen
   Status/Flag `aborted` schreiben (kein `returnCode`), das die UI als „abgebrochen"
   zeigt. Minimal-invasiv: neues optionales Feld im Command-Log-Writer, kein Schema-
   Umbau der bestehenden Felder.
3. **Scrollback-Replay = reiner Text.** SerializeAddon liefert Text mit ANSI-Farben, aber
   kein Interaktions-Zustand. Der replayte Scrollback ist „totes" Terminal-Output oberhalb
   einer Trennzeile; darunter startet der echte Prompt. Das ist gewollt (kein PTY-Replay).
4. **Auslöser-Debounce-Fenster** (z. B. 2 s nach Ausgabe-Ruhe) + ob bei jedem Workspace-
   Wechsel voll serialisiert wird — Feinwerte beim Bau festlegen.

---

## Akzeptanz (Tests im Schritt)

- Roundtrip: Snapshot → Restore → Buffer hat Scrollback bis Limit, Trennzeile, dann
  neuer Prompt; Start-cwd = Basis-Kontext, auch wenn zuletzt WSL/SSH.
- Unlesbarer Snapshot → Shell startet ohne Scrollback, Meldung.
- Serializer: kein `await` in der Transaktion (Test mit verzögertem `snapshot()`).
- Beenden mit langsamer Serialisierung → Zeitbudget greift, Layout gespeichert,
  Scrollback fehlt, kein Hänger.
- `scrollback = off` → Spalte leer.
- Manuell: App beenden/starten → Workspaces, Tabs, Panes, Scrollback da; laufendes
  Kommando steht im Command-Log als abgebrochen.
