# Cogno — Fähigkeitsinventar (Stand 2026-08-26)

Grundlage für die Architekturdiskussion. Bewusst ohne Paket-/Architekturbegriffe.
Je Gruppe: was es ist · was es können muss · was es besitzt (Daten, Config, OS-Zugriff).

## 1. Terminal-Sitzung
PTY spawnen (ConPTY/pty), Tastatur→Shell, Ausgabe→Renderer mit Ack-Flow-Control, Resize, Kill, Scrollback, Auswahl, Cursor-/Maus-Tracking, Alt-Screen-Erkennung, WebGL-Renderer, Kontrast/Screenreader/Transparenz.
Muss: Bytes verlustfrei in beide Richtungen; nie den Renderer ertränken; Fokus/Größe pro Pane; eine laufende Sitzung über Reparenting, Tab- und Workspace-Wechsel erhalten; nur durch explizites Schließen beenden, nicht durch das Zerstören einer View.
Besitzt: `shell.profiles.*`, `scrollbar.*`, `cursor.*`, `selection.*`, `terminal.*`, `padding.*`; Rust `pty.rs`.

## 2. Ausgabe-Interpretation (OSC & Links)
OSC 2 Titel, OSC 9 Nachricht, OSC 9;4 Fortschritt, OSC 52 Clipboard, OSC 733 `COGNO:PROMPT`/`COGNO:CAPS`; klickbare URLs, Dateipfade (gegen cwd), „resume“-Links.
Muss: Sequenzen parsen und als Ereignisse weitergeben; nichts davon darf die Sitzung stören.
Besitzt: `clipboard.read/write`, `terminal.notifications.osc9`, `terminal.progress_bar`, `feature.ai.resume_pattern`.

## 3. Clipboard & Eingabe-Komfort
Copy (Trim, Prompt-Marker weg), Paste (bracketed), Bild-Paste → Temp-Datei-Pfad, Paste-über-Auswahl, Multiline-Paste → Composer, Datei-Drop → Pfade, Alt-Click Cursor, Rechtsklick Wort.
Besitzt: `clipboard.*`, `selection.*`; Rust `clipboard_image.rs`.

## 4. Kommandozeilen-Modell & Editor-Aktionen
Live-Modell der Eingabezeile aus dem Buffer (Text, Cursor, Wrapping); 18 Editor-Aktionen (Wort/Zeile löschen, springen, selektieren); nativ in der Shell, wenn CAPS es meldet, sonst synthetisierte Tasten.
Muss: wissen, was gerade in der Eingabezeile steht und wo der Cursor ist — Grundlage für 6, 7, 8, 12.
Besitzt: Shell-Definitionen (bash/zsh/pwsh), Line-Editor-Pipe (pwsh).

## 5. Shell-Integration
Shell-Erkennung, Integrationsskripte nach `~/.cogno/shell-integration/` (versioniert), Hooks für Prompt/Command-Ereignisse, CAPS-Handshake, Session-Env (`COGNO_*`), Login-Env-Capture, `cogno`-CLI auf PATH, Pfadübersetzung (Win/GitBash/WSL), rc-Dateien überspringen.
Muss: Cogno erfährt Beginn/Ende/Exit-Code/cwd jedes Kommandos. Ohne 5 gibt es kein 6, 7, 9, 11.
Besitzt: `shell.*`; Rust `shells.rs`, `environment_builder.rs`, `login_environment.rs`; Skripte.

## 6. Cogno-Prompt
Eigener Prompt-Block über der Shell-Zeile: Profile, Segmente (Feld/Text), Styling, `when`-Bedingungen, Formatierung; Command-Block-Dekorationen im Scrollback.
Besitzt: `prompt.*`, `terminal.decoration.*`.

## 7. Command-Memory (History)
Jedes Kommando loggen (Kontext OS×Shell×WSL, cwd, Dauer, Exit); Dropdown mit Scopes Global/Dir/Tab; FTS5-Suche; Dir-History; Übergangs-Statistik (nach A meist B); Pattern-Mining mit Slots; Selection-Feedback; Löschen, Prune, Import nativer Shell-History, Legacy-Import.
Muss: schreiben ohne die Sitzung zu bremsen; lesen in <100 ms für 8.
Zwei Rollen, heute in einer Klasse: **Erfassung** (Shell-Ereignis → Datensatz, schreibt nur) und **Nutzung** (History-Dropdown, Autocomplete, künftig Statistik, lesen nur). Siehe Zielarchitektur 2.4 (`core/command-log/`).
Besitzt: Tabellen `command*`, `command_log`, `command_stat`, `command_transition_stat`, `command_pattern*`, `path`, `dir_stat`, `shell_context`, `command_fts`; `terminal.history.*`.

## 8. Autocomplete
Panel am Cursor (80 ms debounce, ≤100 Vorschläge); Quellen: History-Commands, History-Dirs, Patterns, 1468 CLI-Specs, dynamische Provider (npm-Scripts, Dateisystem, Git-Branches, System-Commands); Filtermodi; Highlighting; Timeout je Provider.
Muss: Quellen unabhängig voneinander; eine langsame/defekte Quelle darf das Panel nicht blockieren (heute schon so).
Besitzt: `autocomplete.provider.timeout_ms`, localStorage `filterMode`, Spec-Daten.

## 9. Composer
Mehrzeiliges Eingabefenster, Submit/Insert, automatisch bei Multiline-Paste.
Besitzt: nichts Persistentes.

## 10. Layout: Tabs & Panes
Tabs (neu, per Profil-Slot, springen, schließen, umbenennen, färben, ziehen, Kontextmenü); Panes (Split ×4, Fokus-Zyklus, maximieren, schließen, Swap per Drag, Pane→neuer Tab, Ratio); Fenster-Buttons.
Muss: Baum der Panes pro Tab; stabile `{windowId, workspaceId, tabId, sessionId}`-Zuordnung; Terminals überleben Layout-Änderungen; ein Startfehler erhält das Pane mit Retry und Close.
Besitzt: Zustand in `workspace_tab`, `workspace_grid` (über 11).

## 11. Workspaces & Session-Wiederherstellung
Benannte Workspaces mit Tabs/Layout/Sitzungen; anlegen, umbenennen, färben, speichern, wiederherstellen, auto-restore, schließen (Busy-Guard), löschen, sortieren, per Slot springen; Live-Wechsel ohne Terminal-Neustart; Header-Anzeige.
Muss: Layoutbaum + Terminal-Sitzungsdaten serialisieren; Dirty-Tracking; beim Laden alle Sitzungen sofort starten, auch in nicht sichtbaren Tabs und Panes; das Schließen eines Workspaces beendet seine Sitzungen explizit.
Besitzt: `workspace`, `workspace_tab`, `workspace_grid`, `terminal_session`; `feature.workspace.*`.

## 12. Suche
Scrollback-Suche (Case, Regex), Block-Suche auf ein Kommando, Paginierung, Springen/Highlight, Overview-Ruler.
Besitzt: `feature.search.*`; braucht 4/6 (Command-Blöcke).

## 13. Benachrichtigungen
Quellen: lange Kommandos, OSC 9, Exceptions (handled/unhandled), Coding-Agent-Status. Kanäle: Toast (max 3), OS-Notification. Unread-Badge am Tab; Klick springt zu Workspace/Tab/Pane; Pro-Terminal-Präferenz; Übersichts-Panel.
Muss: Quelle und Kanal entkoppelt; Ziel (Terminal) auflösbar.
Besitzt: `notification.*`, `terminal.notifications.*`, `feature.notification_overview.*`.

## 14. Seitenleiste (Rail + Panel)
Icon-Rail, Panel öffnen/schließen/pinnen, Displacement, Breite, Zustand über Neustart, Richtungsnavigation, Icon-Updates, Opazität; View-Menü (macOS) daraus generiert.
Besitzt: `side_menu_state`, `menu.opacity`, `feature.<x>.mode/order`; Feature-Modi sind ausschließlich `on` oder `off`.

## 15. Command-Palette
Alle Aktionen mit Keybinding, filtern, ausführen.
Besitzt: `feature.command_palette.*`.

## 16. AI-Chat
Panel; Prompt mit Terminal-Kontext (letzte Kommandos/Ausgaben, optional Prozessbaum); Streaming; Abbrechen; Kommandos extrahieren → einfügen/ausführen-und-weiter/neues Terminal; Provider (openai_compatible, ollama_native), Auto-Detection Ollama/LM Studio; Proxy über Rust (kein CORS).
Besitzt: `feature.ai.*` (inkl. `api_key` im Klartext); Rust `ai_http.rs`.

## 17. Coding-Agents
Panel; 5 Provider (Claude Code, Codex, Gemini, Kimi, Antigravity); Installations-Erkennung; Hook-Installation in Agent-Config (mit Bestätigung), Drift-Erkennung; Hooks POSTen an lokalen HTTP-Server; Status je Terminal (working/question/ready/error); Aktivitätszeile; Animation; Status-Notifications.
Besitzt: `feature.coding_agents.*`; schreibt fremde Config-Dateien (`~/.claude/settings.json` …).

## 18. Git
Panel an cwd des aktiven Terminals; Status (staged/unstaged/untracked), Branch, stage/unstage/discard/commit, Verzeichnis aufklappen, Inline-Diff (Blob via `git show`), extern öffnen.
Besitzt: `feature.git.*`; Rust `git_blob.rs`, `command_runner.rs`.

## 19. Externe Steuerung
CLI: `run`, `action list/run`, `config show/get/path`, `--config`, `--set`. HTTP: `POST /action` auf 127.0.0.1, Port-Fallback, `COGNO_PORT`/`COGNO_TERMINAL_ID` in jeder Shell. Message `{command,args,terminalId,payload}` → App-Bus.
Muss: jede Aktion von außen auslösbar; Terminal adressierbar.
Besitzt: `http_server.*`; Rust `cli.rs`, `http_server.rs`. **CLI-Aktionsliste ist eine handgepflegte Kopie und bereits abgedriftet (47 vs. 76+7 Namen).**

## 20. Konfiguration
`key = value`-Datei, Plattform-Defaults darunter, Hot-Reload, `load_config`/`open_config`, Zod-Validierung mit Diagnose-Notifications, Erststart-Bootstrap (Shell-Profile), CLI-Overrides.
Muss: Änderungen eines Feature-Modus (`on`/`off`) zur Laufzeit aktivieren beziehungsweise deaktivieren; Aktivierungsfehler sichtbar melden. Einen Modus `hidden` gibt es nicht.
Besitzt: die Datei, `enable_watch_config`; Rust `config.rs`, `default_*.config`.

## 21. Theming
16 ANSI-Farben + fg/bg/highlight, Terminal-Font (Ligaturen, Gewichte …), UI-Font, Padding, Hintergrundbild (Opazität, Blur), Scrollbar-Styling, Live-Anwendung ohne Neustart.
Besitzt: `color.*`, `font.*`, `padding.*`, `background_image.*`, `scrollbar.*`.

## 22. Keybindings
Syntax `[trigger:]combo[>combo]=action[:arg]`, Chords, Trigger `always/performable/broadcast/unconsumed`, additiv, Editable-Field-Awareness, ~30 Tastaturlayouts mit OS-Erkennung, Hints in allen Menüs, OS-spezifische Defaults.
Besitzt: `keybind`-Zeilen; Layout-Daten (5,3k Zeilen); Rust `keyboard.rs`.

## 23. Aktionen (Katalog)
76 Kern-Aktionen + 1 je Panel; ausgelöst per Keybinding, Menü, Palette, CLI, HTTP. Die gemeinsame Sprache zwischen allen Gruppen.

## 24. Fenster & OS
Neues Fenster, schließen/Quit mit Busy-Guard, OS-Close abfangen, macOS-Menüleiste, Hamburger-Menü (Win/Linux), Doku öffnen, About, Custom Chrome, Pfade (exe, home, config, db, log), Logfile, DevTools im Debug.

## 25. Prozess-Info
Prozessbaum je Pane + Sitzungs-Telemetrie; Ziel: Seitenleisten-Panel, fokusgebunden, statt Dialog (Zielarchitektur 2.2).
Besitzt: Rust `processes.rs`.

## 26. Datenbank
Eine SQLite `~/.cogno/cogno.db`; generische Bridge (`db_open/execute/select/batch`); Migrationen mit Checksumme je in eigener Transaktion, drei Namensräume (app, workspace, side-menu-ui-state); Legacy-Import; Recovery; WAL-Checkpoint beim Beenden.

## 27. Fehlerbehandlung & Logging
Globaler Handler + window.onerror; Reporter → Log + optional Notification; Logfile.

## Tot / halb verdrahtet
- `list_fonts`, `encrypt`/`decrypt` (Rust-Commands ohne TS-Aufrufer; `api_key` liegt im Klartext)
- `minimize_window`-Aktion ohne Subscriber
- Shell-Typen `Fish`, `GitBash` ohne eigene Definition/Integration
- Keybind-Trigger `broadcast:`/`unconsumed:` ohne Nutzer
- `terminal.history.max_entries = 0` → Prune läuft nie
- `docs-playbook.md` veraltet (falsche Pfade und Config-Keys, keine Seite für Git/Coding-Agents)
