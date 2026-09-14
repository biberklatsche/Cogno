# Schritt 27 — Sitzungs-Wiederherstellung (Design, revidiert)

Ziel: Cogno kommt **so zurück, wie man es verlassen hat** — Workspaces, Tabs,
Panes **und** Terminal-Scrollback; ein beim Beenden laufendes Kommando steht im
Command-Log als abgebrochen. Kein Verlauf/keine Historie. Speichern ist für den
Nutzer **unmerklich** und **abschaltbar**.

> Status: **Implementiert (Kern).** Siehe „Implementierungsstand (final)" am Ende —
> der Scrollback-Ansatz weicht bewusst vom ursprünglichen Design ab (Farb-Restore
> + ConPTY-Handhabung). Offen/aufgeschoben: Auto-Save-Status-UI (27g),
> abgebrochenes Kommando (27b-2).
> Dieser Schritt verfeinert/weicht bewusst vom ursprünglichen Plantext (Schritt 27)
> ab (mit Nutzer abgestimmt): Modell „zuletzt gelebt" mit Auto-Save, **keine
> `windowId`-Spalten**, Auto- **und** Manuell-Speichern koexistieren.

---

## Modell (abgestimmte Entscheidungen)

- **„Zuletzt gelebt".** Restore stellt den letzten *gelebten* Zustand her, nicht ein
  kuratiertes Template. Keine Historie (in-place überschrieben).
- **Ein Speicher-Pfad, konfigurierbarer Auslöser.** „Speichern" = **Layout**
  (`workspace`/`workspace_tab`/`workspace_grid`) **und** Scrollback-Snapshot
  (`terminal_session`) zusammen, für einen Workspace. Autosave persistiert also
  **Layout *und* Snapshots** (nicht nur Scrollback) — sonst driftet das
  wiederhergestellte Layout vom zuletzt gelebten Zustand.
- **Der Default-Workspace wird mitpersistiert.** Er ist ein besonderer, immer
  existierender Workspace, aber in „zuletzt gelebt" wird auch sein Layout +
  Scrollback gespeichert und wiederhergestellt. **Modelländerung:** heute
  überspringt `saveWorkspace()` `DEFAULT_WORKSPACE_ID` und der Default wird beim
  Start frisch erzeugt; der Autosave-Pfad umgeht diesen Skip und persistiert/
  restauriert den Default wie jeden Workspace (eigene `workspace`-Zeile mit
  `DEFAULT_WORKSPACE_ID`). Der **explizite** Save (Autosave AUS) lässt den Default
  weiterhin aus (unverändert).
- **Setting `terminal.restore.enabled`** (Default `true`):
  - **AN (Autosave):** persistiert automatisch bei **(1) Idle-Debounce des aktiven
    Workspace**, **(2) Workspace-Wechsel** (verlassener WS), **(3) Beenden**
    (Zeitbudget). Save-Button + Dirty-Indikator werden durch einen **Auto-Save-
    Status** ersetzt („speichert…" / „✓ automatisch gespeichert vor X s").
  - **AUS:** kein Auto-Speichern; klassischer **Save-Button + Dirty-Indikator**;
    Restore = zuletzt **explizit** Gespeichertes.
- **Idle-Auto-Save** (nur bei AN): feuert erst nach ~2–3 s **Ausgabe-Ruhe**, nur
  aktiver Workspace, gecappt, **async** geschrieben → unmerklich; Bonus:
  Absturz-Resilienz (Verlust nur wenige Sekunden) und macht den „✓ gespeichert"-
  Indikator ehrlich.
- **Scrollback = reiner Text** (SerializeAddon), beim Restore oberhalb einer
  **Trennzeile** in den Buffer geschrieben; darunter startet der frische Prompt.
  **Zurückscrollen im wiederhergestellten Terminal geht.** **Kein PTY-Replay.**
- **Zeitbudget beim Beenden** ist nur ein **Sicherheitsventil** gegen Hänger (lässt
  im pathologischen Langsamfall den Scrollback aus, speichert Layout) — greift
  praktisch nie, weil Idle/Wechsel schon persistiert haben.
- **Start-cwd = Basis-Kontext** (Kontext-Stack Eintrag 0) + `pane.workingDir`;
  transiente WSL/SSH-Inner-Kontexte werden ignoriert.
- **Kein `windowId`.** Ein Workspace gehört via Rust `claim_workspace` genau einem
  Fenster; `terminal_session` hängt an `workspace_id` → implizit fenster-scoped.

---

## Speicher & Performance (abgeschätzt)

- Kosten nur durch Scrollback; Layout = KB. Pro Terminal ≈ `max_lines` ×
  ~200–400 B/Zeile. Default-Cap **1000 Zeilen** ≈ ~0,3 MB/Terminal.
- Typisch 5–15 Terminals → ~1,5–4,5 MB; 30 → ~9 MB. Keine Historie → wächst nicht.
- Serialisieren läuft nur bei Idle/Wechsel/Beenden, gecappt, Write async → keine
  spürbare Last; Beenden zeitbudgetiert.

---

## Datenmodell

`SessionSnapshot` (in `core/session/`, versioniert), abgelegt als JSON in
`terminal_session.session_data`, Key `(workspace_id, terminal_id)`:

```
{ version: 1,
  start: { shellName, workingDir, shellContext /* Basis-Kontext */ },
  scrollback: string | null,        // SerializeAddon, ohne Alt-Screen, gecappt
  abortedCommand?: { text, startedAt } }
```

Bereits vorhanden (ungenutzt): Tabelle `terminal_session` +
`WorkspaceRepository.create/update/get/deleteTerminalSession`.

---

## Slices

- **27a — SerializeAddon**: `@xterm/addon-serialize` dep; in `renderer.ts` laden;
  `IRenderer.serialize(maxLines): string`.
- **27b — Host snapshot/restore**: `SessionSnapshot`; `SessionHost.snapshot()`
  (serialize + Cap + Basis-Kontext + abortedCommand wenn `isCommandRunning`);
  `SessionHost.restore(snapshot)` (nach Spawn Scrollback + Trennzeile schreiben,
  Start-cwd = Basis-Kontext; abortedCommand → Command-Log-Eintrag `aborted`).
  Tests: Roundtrip, unlesbarer Snapshot.
- **27c — Settings**: `terminal.restore.enabled` / `.scrollback` / `.max_lines` in
  `TerminalSettingsSchema` **und** `default-config-values.ts` (Schritt-K-Generator
  schreibt die Configs). (`.idle_debounce_ms` / Zeitbudget: intern, ggf. Setting.)
- **27d — Snapshot-Serializer (fertig, `c9aa241a`)**: `SessionPersistenceService`
  `persistWorkspace(workspaceId)` = Scrollback-Snapshots aller Terminals des WS
  **einsammeln (sync), dann ein `batch()`** (`WorkspaceRepository.saveTerminalSessions`,
  delete+insert = prunt entfernte). Gated by `terminal.restore.enabled`/`.scrollback`.
  Accessors `SessionHostFactory.getSessionHost`, `GridListService.terminalIdsForWorkspace`.
- **27e — Layout-Autosave + Auslöser + Modus**: `persistWorkspace` um den
  **Layout-Autosave** erweitern (Layout + Snapshots zusammen), **inkl. Default-
  Workspace** (Autosave-Pfad umgeht den `saveWorkspace`-Default-Skip; explizite
  Save-UI bleibt default-frei). Auslöser gated by `enabled`: **Idle-Debounce**
  (Aktivität via `sessionRegistry.facts$ outputReceived`, ~2–3 s, aktiver WS),
  **Workspace-Wechsel** (verlassenen WS vor dem Umschalten in `activateWorkspace`),
  **Beenden** (Zeitbudget in `quit()`/`closeWindow()`). AUS: nur expliziter Save.
  Test: Zeitbudget greift bei langsamer Serialisierung (Layout da, Scrollback fehlt,
  kein Hänger); Default-WS wird persistiert.
- **27f — Restore beim Start + Lifecycle**: Startup restauriert **alle** persistierten
  Workspaces **inkl. Default** (Default-`workspace`-Zeile lesen statt frisch erzeugen);
  Layout-Restore (`activateWorkspace`) um Scrollback erweitern (`terminal_session`
  lesen → `SessionHost.restore` beim `ensureSession`). Löschung bei Terminal-Close;
  Verwaisten-Prune beim Start. `scrollback=off` → Scrollback leer, Layout da.
- **27g — UI**: Auto-Save-Status-Indikator (ersetzt Dirty/Save bei Autosave AN:
  „speichert…" / „✓ vor X s"); Dirty-Indikator + Save-Button bleiben bei Autosave
  AUS. Save/Dirty-Logik **bleibt** (nicht entfernt), nur modusabhängig sichtbar.

Jeder Slice ein grüner Commit (biome, depcruise, guard, tsc, vitest, ng build; bei
Rust `cargo check`).

---

## Offen / beim Bau festzulegen

- Idle-Debounce-Fenster (Start ~2–3 s Ruhe) und Beenden-Zeitbudget (großzügig,
  sodass normale Beenden den Scrollback immer mitnehmen).
- Genaue Optik/Position des Auto-Save-Status-Indikators.
- Verhalten von `.scrollback=off` bei `enabled=true` (Layout ja, Scrollback nein).

---

## Akzeptanz (Tests im Schritt)

- Roundtrip: Snapshot → Restore → Buffer hat Scrollback bis Limit, Trennzeile,
  neuer Prompt; Start-cwd = Basis-Kontext, auch wenn zuletzt WSL/SSH.
- Unlesbarer Snapshot → Shell startet ohne Scrollback, Meldung.
- Serializer: kein `await` in der Transaktion (verzögertes `snapshot()`).
- Beenden mit langsamer Serialisierung → Zeitbudget greift, Layout da, kein Hänger.
- `terminal.restore.enabled=false` → keine Persistenz, frischer Start; Save-Button +
  Dirty sichtbar; expliziter Save funktioniert.
- `scrollback=off` → Scrollback leer, Layout da.
- Manuell: App beenden/starten → alles wie verlassen; laufendes Kommando im
  Command-Log als abgebrochen; Idle-Auto-Save-Indikator zeigt „gespeichert".

---

## Implementierungsstand (final)

Der Scrollback-Restore weicht vom ursprünglichen „Klartext/SerializeAddon"-Design
ab — bewusst, nach Nutzer-Feedback (Farben + Marker gewünscht, ConPTY-Problem):

- **Snapshot v3** (`session-snapshot.ts`, `SESSION_SNAPSHOT_VERSION = 3`; v1/v2
  ignoriert). Enthält `scrollback` (Text **mit SGR-Farben/Attributen**, inkl. der
  conceal-`^^#`-Markerzeilen) **und** `commands` (Metadaten pro Marker, sonst
  rendert `PromptMarkerRenderer` nichts).
- **Eigener Zell-Serializer** (`scrollback-serializer.ts`): nur Text + SGR, **keine**
  Cursor/Mode/OSC-Sequenzen (SerializeAddons Cursor-Tail hatte v1 zerlegt).
- **Marker-id-Offset** (`RESTORED_MARKER_ID_OFFSET = 1e15`): restaurierte `^^#`-ids
  numerisch über den Live-Bereich schieben (bash/zsh zählen pro Session ab 1 →
  sonst Kollision → Registry verwirft Live-Marker).
- **Restore erst beim ersten `attach()`** (offenes, final gefittetes Terminal),
  **PTY-Spawn danach** (`SessionHost`: `restore()` stasht nur, `start()` hält den
  PTY-Handler zurück, `attach()`→`completeRestore()` schreibt + spawnt). Grund:
  **ConPTY (Windows) repaintet beim Shell-Start den ganzen Screen** und würde den
  sichtbaren restaurierten Inhalt überschreiben. Auf Windows wird der Inhalt mit
  `rows` Leerzeilen über den Viewport geschoben (`fitTerminalWithoutPty()` liefert
  die finalen `rows`); unix hängt einfach an.
- **Seiteneffekt-Guard** `model.beginRestore()/endRestore()`: der Observer spiegelt
  den Replay nicht als Eingabe (sonst Autocomplete-Fehlöffnung). Der Serializer
  schreibt keine OSC/CSI → Title/Notification/Clipboard/Recorder feuern nicht neu,
  Kommandos werden **nicht** erneut ausgeführt.
- **Grenz-Marker** = dezente Decoration-Trennlinie auf einer **concealed Sentinel-
  Zeile** (`COGNO:RESTORE-BOUNDARY`), beim Capture gestrippt (kein Text, kein
  Doppeln/Akkumulieren). Alter `---- restored session ----`-Text wird ebenfalls
  gestrippt (Bestands-Snapshots).
- **Bootstrap-Command versteckt** (`Command.isIntegrationBootstrap`): Cognos eigener
  `. '…/shell-integration/…bootstrap.*'`-Dot-Source erscheint weder als Marker
  (`PromptMarkerRenderer` + `MarkerManager`) noch im Header (`updateViewportVisibility`)
  noch im Snapshot (`captureCommands`).
- **Persist-Fallback** (`SessionPersistenceService` + `PendingSessionSnapshots.peek`):
  nicht geöffnete Tabs (kein Host, jetzt Normalfall wegen Lazy-Attach) behalten ihren
  Snapshot beim delete-then-insert-Save.
- **Nebenbei-Fix:** `FilesystemSpecProvider` gibt bei leerem cwd `[]` zurück statt zu
  werfen („Autocomplete provider failed / Empty path").
