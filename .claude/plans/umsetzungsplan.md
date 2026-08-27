# Umsetzungsplan Zielarchitektur

Stand 2026-08-27. Setzt `target-architecture.md` um; Abschnittsnummern
darin werden mit „ZA x.y" zitiert. Konzeptfragen werden hier nicht neu
entschieden — wer eine findet, ändert erst die Zielarchitektur.

## Regeln für jeden Schritt

- **Die Zielarchitektur wird nicht nebenbei geändert.** Wer bei der
  Umsetzung einen Widerspruch oder eine Lücke findet, hält an, benennt
  sie und fragt — auch bei Kleinigkeiten. Keine Entscheidung „per
  Annahme". Der Schritt wartet, bis die Zielarchitektur geändert ist.
- **Nichts auf Vorrat.** Kein Feld, kein Zustand, kein Hook, keine
  Abstraktion ohne Konsumenten in genau diesem Schritt. Was „später mal
  gebraucht" wird, wird später gebaut.
- **Nicht komplizierter als jetzt nötig.** Die einfachste Lösung, die die
  Akzeptanzkriterien erfüllt und die Regeln einhält.
- **Ein Schritt = ein Commit.** Titel `arch(<nr>): <titel>`.
- **Grün heißt:** `pnpm lint` (Code + `lint:architecture`), `pnpm test`,
  `pnpm build` laufen durch; die App startet, ein Terminal öffnet, ein
  Kommando läuft, ein Workspace lässt sich speichern und laden. Diese fünf
  Handgriffe sind die Smoke-Prüfung und stehen nicht bei jedem Schritt
  einzeln.
- **Übergangsregeln (ZA 2.1)** gelten ab Schritt 0: nichts in `core/` oder
  `bootstrap/` importiert `app/` (Ausnahme `bootstrap/` bis Schritt 27),
  `@cogno/app` bekommt keine neuen Verbraucher, `app/` schrumpft monoton,
  jede umgezogene Scheibe erfüllt sofort ihre endgültigen Regeln.
- **Verhaltensändernde Schritte bringen ihre Tests mit** (ZA 4, Regel 2).
  Reine Umzüge bringen keine neuen Tests, aber alle alten laufen weiter.
- **Umzug heißt:** `git mv`, Importe anpassen, Alias wechseln, nichts
  umbenennen, was nicht umbenannt werden muss. Umbenennungen sind eigene
  Schritte oder gehören ausdrücklich zum Schritt.
- Pfade sind relativ zu `src/packages/`. Dateizahlen sind Quelldateien
  ohne Specs (Stand 2026-08-27).

## Phasen

| Phase | Schritte | Ziel |
|---|---|---|
| A Gerüst | 0 | Regeln, Aliase, leere Ordner |
| B Fundament | 1–5 | Infrastructure, shared/domain, Shells, Plattformklassen, `hidden` |
| C Kommandodaten | 6–8 | command-log, Recorder, Backpressure |
| D Maschine und Session | 9–15 | Terminal/Session-Grenze, Modell, Session-Host, Kontext, Token |
| E Workbench und API | 16–21 | Workbench-Umzug, API, Bindung, Fakten, Fenster-Routing |
| F Features | 22–26 | Feature-Host, Feature-Umzüge, Prozess-Info, Aktionskatalog |
| G Wiederherstellung und Abschluss | 27–29 | Snapshot, Bootstrap, Aufräumen |

Reihenfolge-Zwänge (aus den Delta-Zeilen der ZA): 6 vor 7 vor 8; 9 vor
10 vor 11 vor 12; 12 vor 13 (Spike) vor 14 (Session-Host); 14 vor 27;
17 (API) vor jedem Feature-Schritt; 22 (Feature-Host) vor 23–25. Schritte
ohne Zwang sind so eingereiht, dass `app/` früh schrumpft und riskante
Schritte spät kommen, wenn die Regeln sich bewährt haben.

---

## Phase A — Gerüst

### Schritt 0: Gerüst und Regeln — **erledigt (2026-08-27)**

**Voraussetzungen:** keine. `pnpm lint:architecture` ist grün (581 Module,
1 938 Abhängigkeiten).

**Was:**

1. `ARCHITECTURE.md` durch den Inhalt von `.claude/plans/target-architecture.md`
   ersetzen. Die Migrationstabelle darin durch einen Verweis auf dieses
   Dokument und eine Zeile „aktueller Schritt" ersetzen.
2. `AGENTS.md`, Abschnitt „Architecture rule": Schichten aus ZA 2.1, fünf
   Aliase, Übergangsregeln in einem Satz. „Angular DI rule": `inject()` nur
   in `bootstrap/app.config.ts` (bis Schritt 28 zusätzlich in
   `app/bootstrap/app.config.ts`).
3. `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`: Aliase
   `@cogno/core` → `src/packages/core`, `@cogno/bootstrap` →
   `src/packages/bootstrap`. `@cogno/app` bleibt.
4. `.dependency-cruiser.cjs`: die 14 Regeln aus ZA 2.1 **zusätzlich** zu
   den bestehenden; dazu der Übergangsblock
   `target-never-imports-legacy` (`^core/` → `^app/`; `bootstrap/` ist
   ausgenommen, es verdrahtet bis Schritt 28 die alte Welt). Kommentar
   „entfällt in Schritt 29". Der Alias-Freeze ist **keine**
   Depcruise-Regel: Depcruise vergleicht aufgelöste Pfade, ein Alias lässt
   sich darüber nicht verbieten. Er wird vom Guard-Skript gezählt.
5. `scripts/architecture-guard.mjs`: zählt Quelldateien und Abhängigkeiten
   unter `app/` und Importe von `@cogno/app`, vergleicht mit
   `.architecture-baseline.json` im Repo, schlägt fehl, wenn eine Zahl
   steigt, und schreibt bei Erfolg die neue Baseline. In `pnpm lint`
   einhängen. Baseline mit den heutigen Zahlen einchecken (260 Quelldateien
   ohne Specs, 20 `@cogno/app`-Importe).
6. `package.json`: `lint:architecture` cruist zusätzlich
   `src/packages/core/**/*.ts` und `src/packages/bootstrap/**/*.ts`.
7. Leere Ordner mit `.gitkeep`: `core/infrastructure`, `core/terminal`,
   `core/command-log`, `core/session`, `core/workbench`, `core/api`,
   `bootstrap`.
8. `docs-playbook.md`: Hinweis am Kopf, dass Pfade und Config-Keys in
   Überarbeitung sind; inhaltliche Korrektur ist Schritt 26.

**Akzeptanzkriterien:**

- Kein Produktcode geändert (Diff nur Konfiguration, Doku, `.gitkeep`).
- 19 Depcruise-Regeln aktiv (14 Ziel, 4 Legacy, 1 Übergang), Check grün.
- Guard-Skript läuft in `pnpm lint`; Gegenprobe (nicht eingecheckt): ein
  Import von `@cogno/app` in `core/` lässt `x1` **und** den Guard-Zähler
  rot werden, ein Import `core/session → core/workbench` lässt `t8` rot
  werden.

**Erlaubter Übergangszustand:** Sämtlicher Code liegt noch in `app/` und
`features/`. Die neuen Ordner sind leer.

---

## Phase B — Fundament

### Schritt 1: `core/infrastructure/` — Config, DB, Fehler, Pfade — **erledigt (2026-08-27)**

**Voraussetzungen:** 0.

**Was:** Umzug ohne Verhaltensänderung:

| von (`app/`) | nach (`core/infrastructure/`) |
|---|---|
| `config/+models/`, `config/+state/`, `config/+bus/`, `application-settings-definition.ts` | `config/` |
| `app-host/database-migration.service.ts`, `migrations/migrate.ts`, `migrations/*.sql` | `database/` |
| `common/error/` | `error/` |
| `common/environment/` | `environment/` |
| `app-bus/app-bus.ts` (Mechanismus) | `bus/` — `messages.ts` bleibt in `app/` (Nachrichtentypen gehören den Sendern; sie ziehen mit ihnen um) |
| `style/` (Theming-Werte) | `theme/` |

`config/shell-configurator.ts` und `shell-integration.writer.ts` bleiben
in `app/` bis Schritt 3 (sie gehören zu Shells).

**Bei der Umsetzung entschieden (dünner Schnitt + Aufteilung):**

- `ConfigService` wurde geteilt. Der Kern in `core/infrastructure/config/`
  liest, validiert, überwacht und veröffentlicht `config$`, `diagnostics$`
  und `loaded$`; er kennt weder Actions noch Shells noch Notifications.
  Zwei optionale Callbacks in `load()` (`completeDefaults`, `beforeWatch`)
  sind die Erweiterungspunkte — sie bleiben dauerhaft, nur ihr Aufrufer
  wandert (Schritt 3, 22).
- `app/config/config-bootstrap.adapter.ts` behält bis Schritt 19 das
  Action-Abo, die drei Notifications und den Shell-Erststart; markiert mit
  `MIGRATION-TEMP(step 19)`, mit eigener Spec (5 Tests), die das Verhalten
  festnagelt.
- Der App-Bus zieht **nicht** mit: `app-bus.ts` ist auf die konkrete
  Nachrichten-Union getippt. Generisch machen heißt 72 Importstellen
  anfassen; das passiert in Schritt 16, wenn `messages.ts` ohnehin zur
  Workbench zieht. `error-reporting-runtime.service.ts` bleibt deshalb
  ebenfalls in `app/`.
- `style.service.ts` zieht in Schritt 2 nach, sobald `Color` in `shared/`
  liegt.
- Der Guard prüft zusätzlich `MIGRATION-TEMP(step N)`-Marker: sobald
  `currentStep` in `.architecture-baseline.json` N erreicht, ist der Marker
  ein Fehler. Damit kann kein Provisorium überleben.

**Akzeptanzkriterien:**

- Regel `infrastructure-knows-no-product-layer` grün: nichts unter
  `core/infrastructure/` importiert `app/` (Übergangsregel 2). Was heute
  aus `config/` nach `app/` zeigt (z. B. `ShellProfile`-Typen aus Shells),
  wird vorher nach `shared/domain` gezogen oder in diesem Schritt als
  Typ-Import aufgelöst.
- `app/` verliert 26 Quelldateien (260 → 234), `@cogno/app`-Importe 20 → 18.

**Erlaubter Übergangszustand:** `app/` importiert `@cogno/core/infrastructure`
(erlaubt: alt → neu). Migrationen laufen wie bisher.

### Schritt 2: Reine Logik nach `shared/domain`

**Voraussetzungen:** 0.

**Was:** Die ~1 500 Zeilen aus der Delta-Zeile: alles unter `app/common/`,
das weder Angular noch RxJS importiert (`hash/`, `id-creator/`, `text/`,
`time-ago/`, `timespan/`, `tree/`, `color/`), sowie reine Logik aus
`app/terminal/+state/advanced/` (`command-tokenizer.ts`,
`command-signature-builder.ts`, `command-token-classifier.ts`,
`suggestion-collapser.ts`, `suggestion-highlighter.ts`,
`autocomplete-context.parser.ts`, `token-match.ts`, `cogno-osc.parser.ts`,
`session-capabilities.parser.ts`) und
`features/side-menu/navigation/directional-navigation.engine.ts`
(räumliche Listen-Navigation, 273 Zeilen, drei Konsumenten). Angular-UI
aus `common/` (`busy-indicator/`, `checkbox/`, `drag-preview/`, `grid/`,
`autofocus/`) und `directional-navigation.dom.ts` nach `shared/ui`.

**Akzeptanzkriterien:**

- Regel `shared-domain-framework-free` grün für jede verschobene Datei.
- Specs ziehen mit; keine Spec wird gelöscht.

**Erlaubter Übergangszustand:** keiner nötig — Umzug in eine bestehende
Schicht.

### Schritt 3: `features/shell/` → `core/session/shells/`

**Voraussetzungen:** 1.

**Was:** `features/shell/` (11 Dateien, Skripte, Pfadadapter) nach
`core/session/shells/`; `app/config/shell-configurator.ts` und
`shell-integration.writer.ts` dazu. `shellFeature` und Contribution-Punkt
`shells?` in `FeatureDefinition` entfernen; `AppWiringService` liest die
Shell-Liste direkt aus `core/session/shells/`. `Fish` und `GitBash` aus
`ShellType` entfernen samt Verzweigungen.

**Akzeptanzkriterien:**

- Regel `session-knows-no-workbench` grün; `core/session/shells/`
  importiert nur `shared`, `platform`, `core/infrastructure`.
- Kein Verweis auf `shellFeature` mehr; `features.ts` hat einen Eintrag
  weniger.
- Shell-Integrationsdateien werden beim Start unverändert nach
  `~/.cogno/shell-integration/` geschrieben (Byte-Vergleich vorher/nachher).

**Erlaubter Übergangszustand:** `app/terminal/` importiert
`@cogno/core/session/shells` (alt → neu, erlaubt).

### Schritt 4: Plattform-Objektliterale zu injectable Klassen

**Voraussetzungen:** 0.

**Was:** `platform/` (26 Dateien): jedes exportierte Objektliteral
(`TauriPty`, `Clipboard`, `OS`, `Opener`, …) wird eine `@Injectable`-Klasse
mit gleicher Oberfläche; Verbraucher bekommen sie per Konstruktor. Specs
mit `vi.mock("@cogno/platform…")` auf Stub-Provider umstellen (ZA 3.1).

**Akzeptanzkriterien:**

- `grep -r "vi.mock(\"@cogno/platform" src/` liefert null Treffer.
- Regel `platform-imports-only-shared` grün.

**Erlaubter Übergangszustand:** ggf. in Teilcommits je Plattformdienst
nach gleichem Muster.

### Schritt 5: `hidden` → `on`

**Voraussetzungen:** 1.

**Was:** `featureModeSchema` und `aiFeatureModeSchema` auf `["on","off"]`;
Config-Reader mappt `hidden`/`visible` → `on` mit Info-Diagnose; die ~20
Code-Stellen mit `"hidden"` entfernen; Default-Configs anpassen.

**Akzeptanzkriterien:**

- Test: eine Config mit `feature.git.mode = hidden` lädt ohne Fehler,
  Git ist an, eine Diagnose-Notification nennt den Schlüssel.
- `grep -rn "\"hidden\"" src/packages` nur noch in Specs für die
  Lesetoleranz.

**Erlaubter Übergangszustand:** keiner.

---

## Phase C — Kommandodaten

### Schritt 6: `core/command-log/` — Schema und Lese-API

**Voraussetzungen:** 1.

**Was:** `app/terminal/+state/advanced/history/history.repository.ts` wird
der Kern von `core/command-log/`: Datei aufteilen in `schema/`
(Migrationen `command*`, `path`, `dir_stat`, `shell_context`,
`command_fts` aus `app/migrations/*.sql` und den Feature-Migrationen),
`write/` (`recordExecution`, `recordCwd`, `recordTransition`, Import,
Prune, Delete, Feedback-Schreiber `markCommandSelected`,
`markDirectorySelected`, `confirmLivePattern`, `markCommandPatternSelected`)
und `read/` (`searchCommands`, `getRecentCommands`, `searchDirectories`,
`searchCommandPatterns`, Übergangsstatistik, `hasAnyCommands`).
Kommando-Modell (`command.model.ts`, `command-pattern.models.ts`,
`recent-history.types.ts`) dazu. `command-pattern-analyzer.ts` und
`shell-history-reader.ts` nach `core/command-log/derive/` bzw. `import/`.
Das eigene SQL in `history-command.suggestor.ts` durch einen Aufruf der
Lese-API ersetzen.

**Akzeptanzkriterien:**

- Regel `command-log-uses-only-infrastructure` grün.
- Kein `SELECT`/`INSERT` außerhalb von `core/command-log/` für diese
  Tabellen (`grep` über `src/packages`).
- Alle History-/Autocomplete-Specs grün, unverändert in der Aussage.

**Erlaubter Übergangszustand:** `TerminalHistoryPersistenceService` in
`app/` delegiert an `core/command-log/` (alt → neu). History-Dropdown und
Suggestoren bleiben in `app/`.

### Schritt 7: Recorder nach `core/session/recorder/`

**Voraussetzungen:** 6.

**Was:** Aus `TerminalHistoryPersistenceService` den schreibenden Teil
(`initialize`, `onCwdChanged`, `onCommandExecuted`, Rückkehrcode-Whitelist)
als `CommandRecorder` nach `core/session/recorder/`; der lesende Teil geht
in die Sichten auf (Schritt 6 hat die Lese-API). `TerminalStateManager`
ruft den Recorder statt des Persistence-Service. Die Klasse wird gelöscht.

**Akzeptanzkriterien:**

- `core/session/recorder/` importiert nur `command-log/` (Schreib-API),
  `infrastructure/`, `shared/`, `platform/`.
- Test: der Recorder liest nie — kein Import aus `command-log/read/`
  (Depcruise-Regel `recorder-writes-only`, in diesem Schritt ergänzt).
- Test: „DB fehlt" → Recorder ist stumm, Session läuft, Health
  `unavailable` (Health kommt in Schritt 8; hier nur der Stumm-Pfad wie
  heute).

**Erlaubter Übergangszustand:** `TerminalStateManager` liegt noch in
`app/` und importiert `@cogno/core/session/recorder` (alt → neu).

### Schritt 8: Command-Log Health und Backpressure (ZA 2.4)

**Voraussetzungen:** 7.

**Was:** `commandLogHealth$` in `command-log/` mit Zählern; begrenzte Queue
im Recorder (`recorder.max_pending`, Default 256, Überlauf „ältestes
verwerfen"), Batch-Schreiben mit einem Retry, `degraded`/`unavailable`
reversibel; Statistik-Updates ausschließlich `INSERT … ON CONFLICT DO
UPDATE`; Lese-Timeout mit `timedOut`-Kennzeichen. Anzeige des Zustands
vorerst als Notification (Seitenleisten-Anzeige kommt mit dem Feature-Host
in Schritt 22).

**Akzeptanzkriterien (Tests, alle im Schritt):**

- Queue voll → ältester Eintrag fällt, `dropped` steigt, Health
  `degraded(backpressure)` mit Zahl.
- Schreibfehler → ein Retry, dann `dropped`; dreimal → `unavailable`;
  nächster Erfolg → `ok`.
- Zwei parallele Recorder auf dieselbe `command_stat`-Zeile → Zähler
  exakt Summe (Test gegen echte SQLite).
- Lese-Timeout → leeres Ergebnis mit `timedOut`, Suggestor `rejected`.
- Verhalten unverändert bei gesunder DB: bestehende Specs grün.

**Erlaubter Übergangszustand:** keiner.

---

## Phase D — Maschine und Session

### Schritt 9: `core/terminal/` — die Maschine, Teil 1 (PTY, Renderer, Input)

**Voraussetzungen:** 1, 4.

**Was:** `app/terminal/+state/pty/pty.ts`, `renderer/renderer.ts`,
`input-writer.ts` nach `core/terminal/`. Dabei die Grenz-Entscheidungen
ZA 2.1 umsetzen, soweit diese Dateien betroffen sind: `renderer.ts`
bekommt Optionen (Theme, Font, Scrollback, Cursor) als Werte statt
`ConfigService`; Fehler werden als Ereignis (`errors$`) veröffentlicht
statt per `ErrorReporter`-Import; der Import von `../handler/resize.handler`
und `./state` wird durch ein schmales Interface `TerminalMachineState`
(Cursor, Maße, Fokus, Selektion, Scroll) ersetzt, das in diesem Schritt
in `core/terminal/` entsteht und von `TerminalStateManager` (noch in
`app/`) implementiert wird.

**Akzeptanzkriterien:**

- Regel `terminal-is-the-machine` grün: `core/terminal/` importiert nur
  `shared`, `platform`, xterm.
- `grep -rn "ConfigService\|ErrorReporter" src/packages/core/terminal` leer.
- Renderer-Spec und PTY-Spec ziehen mit und sind grün; ein neuer Test:
  Optionen-Änderung zur Laufzeit (Theme) wirkt ohne Neustart.

**Erlaubter Übergangszustand:** `terminal.session.ts` in `app/` erzeugt die
Maschine aus `@cogno/core/terminal` und reicht Config-Werte hinein
(alt → neu). `TerminalStateManager` bleibt ungeteilt in `app/` und
implementiert das Maschinen-Interface zusätzlich.

### Schritt 10: Maschine, Teil 2 — Handler einsortieren

**Voraussetzungen:** 9.

**Was:** Die neun Maschinen-Handler (`pty`, `resize`, `cursor`, `mouse`,
`selection`, `scroll-state`, `focus`, `input`, `theme`) nach
`core/terminal/handlers/`; jeder verliert seine `ConfigService`- und
`AppBus`-Importe: was er meldete, wird Ereignis am Maschinen-Objekt
(`focusChanged$`, `resized$`, …), was er las, wird Option. `focus.handler`
publiziert nicht mehr auf den Bus (ZA 2.1, Entscheidung 3);
`terminal.session.ts` übersetzt vorerst Maschinen-Ereignisse in die
bisherigen Bus-Nachrichten. `pty.handler`: `RemovePane` bei Exit wird
Ereignis `exited(exitCode)`; die Übersetzung nach `RemovePane` macht
vorerst `terminal.session.ts`.

Ggf. drei Teilcommits (Eingabe/Größe · Cursor/Maus/Selektion/Scroll ·
Fokus/Theme/PTY) nach gleichem Muster.

**Akzeptanzkriterien:**

- Regel `terminal-is-the-machine` grün für alle Handler.
- 14 Handler-Specs grün, mit angepassten Erwartungen (Ereignis statt
  Bus-Nachricht).
- Manuell: Fokuswechsel per Klick, Resize, Tab-Wechsel, Shell-Exit
  schließt das Pane wie heute.

**Erlaubter Übergangszustand:** `terminal.session.ts` ist Übersetzer
zwischen Maschinen-Ereignissen und altem Bus — das ist der einzige Ort,
der beide kennt, und er liegt in `app/`.

### Schritt 11: `TerminalStateManager` teilen

**Voraussetzungen:** 10.

**Was:** Die erste unvermeidliche Operation (ZA 2.1). Aus
`app/terminal/+state/state/terminal-state.manager.ts` (377 Zeilen) wird:

- `core/terminal/machine-state.ts` — Cursor, Maße, Fokus, Selektion,
  Scroll, Alt-Screen, Progress-Anzeige (implementiert
  `TerminalMachineState` aus Schritt 9),
- `core/session/model/session-model.ts` — `startCommand`/`endCommand`,
  `updateCwd`, `updateInput`, `updateSessionCapabilities`, Shell-Kontext,
  Kommandoliste; ruft den Recorder (Schritt 7).

`terminal.state.ts`, `command.model.ts`, `terminal-shell-context.util.ts`
werden entsprechend aufgeteilt.

**Akzeptanzkriterien:**

- Kein Import zwischen `core/terminal/machine-state.ts` und
  `core/session/model/`; die Session liest Maschinenzustand über das
  Maschinen-Objekt.
- Die zwei Specs des State-Managers werden zu je einer Spec pro Hälfte,
  gleiche Aussagen.
- Verhalten unverändert (Smoke + History-Aufzeichnung eines Kommandos mit
  cwd, Dauer, Exit-Code im Command-Log).

**Erlaubter Übergangszustand:** `terminal.session.ts` in `app/` besitzt
beide Hälften. Keine Datei in `core/session/model/` importiert `app/`.

### Schritt 12: `CommandLineObserver` teilen und Session-Handler umziehen

**Voraussetzungen:** 11.

**Was:** Die zweite unvermeidliche Operation. `advanced/ui/command-line.observer.ts`
wird geteilt: OSC-733-Interpretation (`COGNO:PROMPT`, `COGNO:CAPS` →
Sitzungsmodell) nach `core/session/model/osc-interpreter.ts`;
`MarkerManager`/`prompt-marker.registry`/`prompt-renderer` (Dekoration)
nach `core/session/decoration/`. Dazu die neun Session-Handler nach
`core/session/handlers/` (`terminal-title`, `terminal-notification`,
`full-screen-app`, `link`, `resume-link`, `clipboard`,
`completed-command-notification`, `terminal-search`) mit derselben
Übersetzungsregel wie Schritt 10: was sie an die Workbench melden, wird
Fakt am Sitzungsmodell (`titleChanged$`, `commandCompleted$` mit Dauer
und Exit statt einer fertigen Notification, `notificationRequested$` für
OSC 9). `command-line.buffer.ts`, `command-line.editor.ts`,
`command-block-resolver.ts`, `dropdown-panel-positioning.ts`,
`terminal-dropdown-coordinator.service.ts`, `advanced/path/`,
`advanced/model/` nach `core/session/`.

Ggf. zwei Teilcommits (Observer-Split · Handler).

**Akzeptanzkriterien:**

- Regel `session-knows-no-workbench` grün; kein Import aus `app/` unter
  `core/session/`.
- Test „Fakten, keine Befehle" (ZA 2.1): `SessionFact`-Union deklariert,
  Typtest gegen `WorkbenchAction` eingecheckt.
- Bestehende Specs für Observer, Buffer, Editor, Prompt-Renderer, Handler
  grün.
- Manuell: Prompt-Dekoration, Kommando-Blöcke, klickbare Links, OSC-9-
  Notification, Suche im Scrollback funktionieren wie heute.

**Erlaubter Übergangszustand:** `terminal.session.ts` in `app/` bleibt
der Übersetzer Fakt → alte Bus-Nachricht (`TerminalTitleChanged`,
`RemovePane`, Notification-Erzeugung). Er ist jetzt der einzige Rest der
alten Terminal-Welt in `app/terminal/+state/`.

### Schritt 13: Spike — Kommandozeilen-Modell aus einem ungeöffneten Core

**Voraussetzungen:** 12.

**Was:** Ein Test, kein Produktcode: `new Terminal()` ohne `open()`,
mit `registerOscHandler` und dem Interpreter aus Schritt 12 verdrahtet;
aufgezeichnete Byteströme (bash, zsh, pwsh mit Integration) einspielen;
`command-line.buffer.ts` liefert Text und Cursor; Kommandoliste und cwd
im Modell stimmen. Dazu: Größe vor `open()` setzen (`cols/rows`), danach
`open()` und `fit` — Modell bleibt konsistent, xterm reflowt.

**Akzeptanzkriterien:**

- Spec `session-headless.spec.ts` eingecheckt und grün für alle drei
  Shells.
- Dokumentiert, welche Buffer-Eigenschaften vor `open()` andere Werte
  haben (falls welche), und wie `command-line.buffer.ts` damit umgeht.
- Bei Scheitern: Schritt 14 wird nicht begonnen; die Zielarchitektur
  (ZA 2.3, Achse B) wird angepasst. Dieser Ausgang ist zulässig und ist
  der Grund für den Spike.

**Erlaubter Übergangszustand:** keiner — reiner Test.

### Schritt 14: Session-Host mit zwei Zustandsachsen (ZA 2.3)

**Voraussetzungen:** 13 grün.

**Was:** `app/terminal/+state/terminal.session.ts` (717 Zeilen) wird zu
`core/session/host/session-host.ts`: besitzt Maschine, Modell, Recorder,
Handler, die sitzungsgebundenen Konsumenten (History, Autocomplete,
Composer ziehen in diesem Schritt nach `core/session/history/`,
`core/session/autocomplete/`, `core/session/composer/` — Umzug, die
Trennung in Sichten ist durch Schritt 6 schon da). Runtime-Achse
`allocated → starting → running | failed`, `running → exited | closing →
closed`; Darstellungs-Achse `detached ↔ attached` mit `attach(element)`
(erstes Mal `open()`, sonst umhängen) und `detach()` (DOM lösen, WebGL
freigeben, Core läuft). DOM-Konsumenten (Dekoration, Autocomplete-Panel,
Composer, Search-Highlight) hängen sich bei `attach`/`detach` an und ab.
Startfehler → `failed` mit Grund, Retry-Methode. `TerminalComponent` in
`app/` wird dünn: sie ruft `attach`/`detach` und stellt den
`failed`-Zustand dar. `TerminalComponentFactory` (in `app/grid-list/`)
erzeugt Hosts statt Komponenten und startet sie sofort, auch unsichtbar;
die Übersetzung Fakt → Bus (`RemovePane` bei `exited`, Titel, Busy) zieht
in einen kleinen `SessionFactBridge` in `app/`.

Ggf. drei Teilcommits (Host ohne Achsen · Darstellungs-Achse · sofortiger
Start).

**Akzeptanzkriterien (Tests im Schritt):**

- Lifecycle-Spec: jeder Übergang beider Achsen; `detach` beendet keine
  Session; `close` beendet sie genau einmal; `exited` wird als Fakt
  veröffentlicht und löst selbst nichts aus.
- Startfehler-Spec: PTY-Spawn schlägt fehl → `failed`, Pane zeigt Fehler
  mit Retry und Close; Retry → `running`.
- Manuell: Workspace mit drei Tabs laden → alle drei Shells laufen sofort
  (`ps`/Prozessliste), nur der sichtbare Tab hat einen WebGL-Kontext;
  Pane in neuen Tab ziehen → keine neue Shell; Tab-Wechsel → kein
  Neustart.
- `app/terminal/+state/` ist leer bis auf `SessionFactBridge`.

**Erlaubter Übergangszustand:** `TerminalComponent`, `TerminalComponentFactory`
und `SessionFactBridge` in `app/` importieren `@cogno/core/session`
(alt → neu). Der alte Bus lebt weiter, gespeist nur noch von der Bridge.

### Schritt 15: Veränderlicher Shell-Kontext und Handshake-Token (ZA 2.1)

**Voraussetzungen:** 14, 3.

**Was:** Kontext-Zeitachse im Sitzungsmodell mit Revision; erneuter
`COGNO:CAPS` = neuer Eintrag; Heuristik-Wechsel in „unbekannten Kontext"
mit sichtbarer Degradation (Pfadadapter, Editor-Aktionen, Recorder);
Rückkehr bei Kommando-Ende. Rust `environment_builder.rs`: zufälliges
`COGNO_SESSION_TOKEN`; Integrationsskripte senden `token=` in
`COGNO:CAPS`/`COGNO:PROMPT`; Interpreter verwirft ohne Token, zählt,
meldet ab Schwelle. Skript-Version erhöhen (die Schreiber-Logik
versioniert bereits). Doku: `SendEnv COGNO_SESSION_TOKEN`.

**Akzeptanzkriterien (Tests im Schritt):**

- Bytestrom mit zweitem Handshake (andere Shell, anderes OS) →
  Zeitachse hat zwei Einträge, aktueller Pfadadapter ist der neue;
  Kommando-Ende → vorheriger Kontext gilt wieder.
- Sequenz ohne Token → verworfen, Zähler steigt, Modell unverändert;
  ab Schwelle Degradations-Fakt.
- Sequenz mit falschem Token → wie ohne.
- OSC 2/9/9;4 ohne Token → weiterhin verarbeitet.
- Manuell auf Windows: PowerShell → `wsl` → Prompt erscheint mit
  Dekoration, cwd ist ein Linux-Pfad, Pfad-Einfügen übersetzt korrekt;
  `exit` → zurück, Windows-Pfade.

**Erlaubter Übergangszustand:** keiner.

---

## Phase E — Workbench und API

### Schritt 16: `core/workbench/` — Layout und Fenster

**Voraussetzungen:** 14.

**Was:** Umzug: `app/tab-list/`, `app/grid-list/` (inkl.
`TerminalComponentFactory` → `session-host-factory.ts`), `app/window/`,
`app/app-buttons/`, `app/header/`, `app/menu/`, `app/notification/`,
`app/terminal/terminal.component.*` + `SessionFactBridge`,
`app/terminal/header/`, `app/terminal/terminal-busy-*`,
`terminal-file-drop.service.ts`, `terminal-fullscreen.service.ts`. Dazu
`features/side-menu/` (Rail, Panel, `ui-state/`) und
`features/side-menu/workspace/` nach `core/workbench/side-menu/` und
`core/workbench/workspace/` mit den zugehörigen Adaptern aus `app/app-host/`.
`features/side-menu/ports/` wird nicht verschoben, sondern aufgelöst:
`WorkspaceHostPort` und `WorkspaceCloseGuardContract` entfallen (Konsument
und Implementierung sind beide Workbench); `TerminalNavigator` und
`TerminalSearchHostPort` werden in Schritt 17 API-Operationen
(`revealSession`, Such-Operationen der gebundenen Session) — bis dahin
bleiben sie als Re-Export bestehen (`workspace-*`,
`side-menu-*`, `confirm-dialog`, `about-dialog`). Der Bus (`messages.ts`,
`terminal/+bus/`) zieht nach `core/workbench/bus/`; Nachrichten, die aus
`core/session/` kommen, sind ab jetzt Typen aus `core/session/facts.ts`.
Die Bridge wird zum Workbench-Dienst, der Session-Fakten abonniert.

Ggf. Teilcommits: Layout (tab-list, grid-list) · Fenster/Menü/Header ·
Notification · Side-Menu/Workspace.

**Akzeptanzkriterien:**

- Regel `workbench-knows-no-api` grün; `core/workbench/` importiert
  `core/session/` (erlaubt), nie `core/terminal/`.
- `features/side-menu/` existiert nur noch für die Panels (ai,
  coding-agents, command-palette, git, notification, terminal-search).
- Manuell: Tabs, Splits, Workspaces speichern/laden, Side-Menu
  öffnen/pinnen, Fenster-Buttons, Busy-Guard beim Schließen — wie heute.

**Erlaubter Übergangszustand:** `app/` enthält noch `action/`,
`keybinding/`, `cli-command/`, `cogno-message/`, `app-host/`-Reste
(Terminal-Gateway, Aktionskatalog-Adapter, Path-Factory), `bootstrap/`.
Feature-Panels importieren weiter ihre alten Ports aus `shared/ports`.

### Schritt 17: `core/api/` — das Protokoll (ZA 3)

**Voraussetzungen:** 16.

**Was:** `app/app-host/terminal-gateway.adapter.service.ts` und
`shared/ports/terminal-gateway.port.ts` werden `core/api/`: `sessions$`,
`revealSession(id)`, `boundSession$` mit Zuständen
`unbound/active/closing/closed` und `following | held` (`hold`/`release`);
`injectInput` mit Identitäts- und Capability-Recheck unmittelbar vor dem
Schreiben; `run({executable, args, contextRevision})` und `fs` auf der
gebundenen Session — dafür ziehen `app/app-host/command-runner-host.service.ts`
und `filesystem-host.service.ts` nach `core/session/exec/` und werden
kontextgebunden (Pfadadapter aus der Zeitachse, Ablehnung bei Remote/
unbekannt). Snapshot (`captureSnapshot` mit optionalem Prozessbaum) und
Notification-Kanal-Beitrag. Logger, Reporter, Settings-Zugang für
Features als `FeatureContext`-Objekt.

**Akzeptanzkriterien (Tests im Schritt):**

- Bindungs-Spec: Fokuswechsel → `boundSession$` folgt; `hold` → bleibt;
  Session schließt → `closing` → `closed` → bei `following` nächster
  Fokus, bei `held` `unbound`.
- Schreibschutz-Spec: `injectInput` nach Fokuswechsel mit alter Identität
  → abgelehnt, nichts geschrieben.
- `run`-Spec: Kontext-Revision veraltet → abgelehnt; Kontext `remote` →
  abgelehnt mit Grund; lokal → Prozess mit cwd; WSL → über `wsl.exe -d`.
- Regel `api-knows-no-features` grün.

**Erlaubter Übergangszustand:** Features importieren noch `shared/ports`
(alt). `core/api/` ist fertig, aber hat außer der Workbench noch keinen
Verbraucher. `shared/ports/terminal-gateway.port.ts` bleibt als
Re-Export auf `core/api/`, bis Schritt 23–25 die Features umgestellt
haben.

### Schritt 18: Fenster-Routing in Rust (ZA 2.6)

**Voraussetzungen:** keine aus dem TS-Umbau; kann jederzeit nach 0.

**Was:** `WindowRegistry` als `.manage()`-State: `terminalId → label`,
`workspaceId → label`, zuletzt fokussiertes Fenster über
`WindowEvent::Focused`, Freigabe bei `Destroyed`. `pty_spawn` bekommt
`window: tauri::Window` und schreibt das Label in `Session`. `route()`
ersetzt `app.emit` in `http_server.rs:129`, `lib.rs:50,115`,
`pty.rs:361`. Commands `window_claim_workspace`/`window_release_workspace`;
Claim schlägt fehl, wenn ein anderes Fenster hält → Rust fokussiert es.
`notification.rs`: Klick routet zum Ziel-Label aus dem Payload. TS
`platform/`: `Window.reveal(windowId, target)`, `windowId` in
`TerminalId`-Nachbarschaft der Identität.

**Akzeptanzkriterien:**

- Rust-Tests: Registry-Zuordnung, Route mit/ohne `terminal_id`, Claim-
  Konflikt.
- Manuell mit zwei Fenstern: `cogno action run new_tab` öffnet genau einen
  Tab im fokussierten Fenster; `cogno run --terminal <id> …` landet im
  richtigen Fenster; Workspace aus Fenster B öffnen, der in A offen ist →
  A wird fokussiert.

**Erlaubter Übergangszustand:** Die TS-Seite nutzt `windowId` erst ab
Schritt 19/27 in Notification-Ziel und Workspace-Zustand.

### Schritt 19: Aktionen, Keybindings, externe Steuerung nach Workbench

**Voraussetzungen:** 16, 18.

**Was:** Umzug: `app/action/` → `core/workbench/actions/`,
`app/keybinding/` → Parser und Layouts (5,3k Zeilen Daten) nach
`core/infrastructure/keybindings/`, Executor und Editable-Field-Awareness
nach `core/workbench/keybindings/`; `app/cli-command/`,
`app/cogno-message/` → `core/workbench/external/`;
`app/app-host/action-catalog.adapter.service.ts`,
`action-keybinding-port.adapter.service.ts` dazu. Notification-Ziele
tragen `windowId`; `revealSession` über Fenstergrenzen nutzt
`Window.reveal`.

**Akzeptanzkriterien:**

- `app/` enthält nur noch `app-host/`-Reste für Features
  (`path.factory`, `terminal-autocomplete-feature-suggestor`,
  `terminal-*-adapter` für Features), `app.component.ts`, `features.ts`,
  `bootstrap/`.
- Manuell: Keybindings, Palette, CLI `action run`, HTTP `POST /action`,
  Notification-Klick in anderes Fenster.

**Erlaubter Übergangszustand:** Aktionskatalog ist noch die handgepflegte
Liste (`core-action-names.ts`), `ActionName` noch `string` — Schritt 26.

### Schritt 20: Session → Workbench nur als Fakten (ZA 2.1/2.3)

**Voraussetzungen:** 16.

**Was:** Die Bridge aus Schritt 14/16 wird aufgelöst: Workbench-Dienste
abonnieren die Session-Fakten direkt (`TabListService` Titel und Busy,
`GridListService` `exited` → Pane entfernen, letztes Pane → Tab
entfernen, dann `close()`; Notification-Dispatch `commandCompleted`
mit Schwelle aus Config, `notificationRequested` für OSC 9, Unread-Badge
aus Fokus). Die alten Bus-Nachrichten `TerminalTitleChanged`,
`TerminalBusyChanged`, `TerminalCwdChanged`, `RemovePane`-aus-Session
entfallen.

**Akzeptanzkriterien (Tests im Schritt):**

- `exited` mit letztem Pane → Tab weg, Host geschlossen; mit zwei Panes →
  nur Pane weg.
- Kommando länger als Schwelle → Notification; kürzer → keine; Fokus auf
  dem Terminal → kein Unread-Badge.
- Typtest: keine `WorkbenchAction` in `SessionFact`.
- `grep -rn "RemovePane" src/packages/core/session` leer.

**Erlaubter Übergangszustand:** keiner.

### Schritt 21: Prozess-Info ins Sitzungsmodell

**Voraussetzungen:** 17.

**Was:** Prozessbaum als Fakt `processTree()` am Sitzungsmodell (Abfrage
über `platform/` `getProcessTreeByTerminalId`), in der API als Teil von
`boundSession` und Snapshot. Der Dialog in `core/session/host/`
(ehemals `terminal.session.ts:545`) und der Kontextmenü-Eintrag bleiben
bis Schritt 25, lesen aber schon das Modell.

**Akzeptanzkriterien:**

- AI-Snapshot mit `includeProcessSummary` liest aus dem Modell, nicht
  mehr direkt aus `platform/`.
- Bestehender Dialog zeigt dieselben Daten.

**Erlaubter Übergangszustand:** Dialog noch im Core.

---

## Phase F — Features

### Schritt 22: Feature-Host (ZA 6.1)

**Voraussetzungen:** 17, 19.

**Was:** `core/workbench/feature-host/`: Deklarationsphase
(IDs, `requires`, Settings-Schemas, Migrationen, Aktionsdefinitionen —
mit Startabbruch bei Duplikaten, Zyklen, Pfadkollisionen), Aktivierungs-
phase mit den sieben Übergangsregeln, Status-Maschine, Hot-Reload auf
`feature.<id>.mode`, Isolation je Contribution (Panel: detachte View;
Handler: `try/catch` + Timeout; Kanal: Timeout; Subscription:
`AbortSignal`), Schutzschalter je Contribution, Status in der
Seitenleiste mit Retry, Aktion `retry_feature`. `SuggestorRegistry` in
`core/session/autocomplete/` als Observable; Session-Hosts abonnieren
sie. `AppWiringService`, `side-menu-lifecycle-runtime.service.ts`,
`terminal-autocomplete-feature-suggestor.service.ts` gehen darin auf.
Konsumenten (Side-Menu, Aktionskatalog, Notification-Dispatch,
SuggestorRegistry) bekommen `register`/`unregister`. `FeatureDefinition`:
`mode` Pflicht, `target`, `actions?`, Feld-Kommentare nach Phase.
`features.ts` wird `as const`.

Ggf. Teilcommits: Deklaration + Startprüfung · Aktivierung + Übergänge ·
Isolation + Schutzschalter · Hot-Reload + UI.

**Akzeptanzkriterien (Tests im Schritt, mit Fake-Features):**

- Startprüfung: doppelte ID, Zyklus, Pfadkollision, doppelte Aktion → je
  ein Test, kontrollierter Abbruch mit Meldung.
- Übergänge: `activate()` wirft → alles zurückgerollt, `failed`;
  `on → off` während `activating` → erst fertig, dann deaktiviert;
  `deactivate()` wirft → trotzdem `inactive`; `requires` auf `off` →
  `inactive` mit Grund; Abhängige werden vor der Abhängigkeit
  deaktiviert.
- Isolation: Handler wirft dreimal → Feature `failed`, andere Features
  laufen; Suggestor wirft dreimal → nur dessen Feature.
- Hot-Reload: `mode` in der Datei ändern → Panel verschwindet/erscheint
  ohne Neustart.
- Bestehende Sessions bekommen einen neu aktivierten Suggestor sofort.
- Ein Deaktivierungstest je vorhandenem Feature (Git, AI, Coding-Agents,
  Palette, Notification-Übersicht, Suche): `off` → keine Subscription
  offen (Leak-Check über `DestroyRef`-Zähler).

**Erlaubter Übergangszustand:** Features importieren noch ihre alten
Ports; der Host meldet vorerst die alten Contribution-Formen an.

### Schritt 23: Git und Terminal-Suche auf die API

**Voraussetzungen:** 22.

**Was:** `features/side-menu/git/` → `features/git/` mit `index.ts`;
`git-status.service.ts` nutzt `boundSession$` (kein eigenes Fokus-Abo),
`boundSession.run({executable:"git", …})` statt `CommandRunner`,
`boundSession.fs` für Blobs, `Opener` direkt aus `platform/`. Eigene
Ports löschen. `features/side-menu/terminal-search/` → `features/terminal-search/`,
Such-Engine bleibt in `core/session/search/`, das Panel spricht über die
API (`search`, `reveal`). `features/side-menu/` wird gelöscht, sobald
alle Panels umgezogen sind (Schritt 25).

**Akzeptanzkriterien:**

- Regel `features-see-only-the-api` grün für beide.
- Git-Specs gegen gestubbte API, kein `vi.mock`.
- Manuell: Git-Panel folgt dem Fokus; `hold` auf Terminal A, Fokus auf B
  → Panel zeigt A; in einer WSL-Sitzung zeigt es das WSL-Repo; in einer
  SSH-Sitzung „nicht verfügbar".

**Erlaubter Übergangszustand:** übrige Panels noch unter
`features/side-menu/`.

### Schritt 24: AI, Coding-Agents, Palette, Notification-Übersicht auf die API

**Voraussetzungen:** 22.

**Was:** wie Schritt 23 je Feature: `features/ai/` (+ Panel),
`features/coding-agent/` (+ Panel; Hook-Installation und Statusempfang
bleiben im Feature; `NotificationChannelsPort` wird API-Contribution —
damit fällt der Import `@cogno/features/coding-agent/ports` aus dem Core),
`features/command-palette/`, `features/notification-overview/`. Feature-
eigene Zod-Schemas als einzige Deklaration (`feature-settings.schemas.ts`
und der statische `Config`-Typ-Anteil entfallen).

Ein Teilcommit je Feature.

**Akzeptanzkriterien:**

- `grep -rn "@cogno/features" src/packages/core` leer.
- `shared/ports/` enthält nur noch, was zwei Features brauchen — nach
  diesem Schritt voraussichtlich nichts; dann löschen.
- Specs je Feature gegen gestubbte API.
- Manuell je Feature: Panel öffnet, folgt Fokus, `off` in der Config
  nimmt es weg.

**Erlaubter Übergangszustand:** keiner nach dem letzten Teilcommit.

### Schritt 25: Prozess-Info als Panel; `features/side-menu/` löschen

**Voraussetzungen:** 21, 24.

**Was:** `features/process-info/` mit `sideMenu`-Contribution, liest
`boundSession.processTree()`; Dialog, Kontextmenü-Eintrag und
`system-info/` im Core löschen. `features/side-menu/` löschen.
`features/autocomplete/` (die Spec-Suggestoren) bleibt Feature und
registriert über die `SuggestorRegistry`.

**Akzeptanzkriterien:**

- `features/` enthält genau: `ai`, `autocomplete`, `coding-agent`,
  `command-palette`, `git`, `notification-overview`, `process-info`,
  `terminal-search`, je mit `index.ts` und `FeatureDefinition` mit
  `mode`.
- Manuell: Prozess-Info-Panel folgt dem Fokus, `hold` funktioniert.

**Erlaubter Übergangszustand:** keiner.

### Schritt 26: Aktionskatalog und generierte Default-Konfiguration (ZA 5)

**Voraussetzungen:** 22.

**Was:** `defineAction` in `shared/`; Core-Katalog `as const` in
`core/workbench/actions/catalog.ts` (aus `core-action-names.ts`, Labels
aus `native-menu.service.ts`, Beschreibungen aus `docs-playbook.md`,
`defaultKeys` je OS aus den drei `default_*.config`); `ActionName` als
Union; `known`/`active`; `switch`-Handler auf `actions.handle(...)`
(Teilcommits je Bereich: tab-list · grid-list · window/menu · config ·
terminal); dreistufige CLI/HTTP-Antwort. Settings-Defaults in Zod
(`.default().describe()`), per-OS im Schema. `scripts/generate-actions.ts`
erzeugt `src-tauri/src/actions.generated.rs`, die drei
`default_*.config` (Settings mit Kommentar + Keybinds) und
`docs/actions.md`; CI-Prüfung „generiert ist aktuell"; Startprüfung
„keine `known`-Aktion ohne Handler außer bei ausgeschalteten Features".
`docs-playbook.md` inhaltlich korrigieren.

**Akzeptanzkriterien:**

- `cli.rs` enthält keine handgepflegte Liste mehr; `cogno action list`
  zeigt alle Namen mit Beschreibung.
- Generierte `default_*.config` sind byteidentisch mit dem Codegen-Lauf
  in CI; ihre Settings-Werte entsprechen den bisherigen (Diff der
  Schlüssel/Werte gegen die alten Dateien: nur Kommentare neu).
- Typfehler bei `actions.handle("new_tabb", …)`.
- Test: Feature `off` → dessen Aktion antwortet „nicht aktiv", unbekannter
  Name „unbekannt".

**Erlaubter Übergangszustand:** Teilcommits dürfen `switch` und
Registrierung nebeneinander haben, solange jede Aktion genau einen
Handler hat (Startprüfung).

---

## Phase G — Wiederherstellung und Abschluss

### Schritt 27: Sitzungs-Wiederherstellung (ZA 2.5)

**Voraussetzungen:** 14, 16, 18.

**Was:** `SessionSnapshot` (`start`, `scrollback`, `history`, Version) in
`core/session/`; `snapshot()`/`restore()` am Host (SerializeAddon, ohne
Alt-Screen, `terminal.restore.max_lines`, Trennzeile, Kommando als
`aborted` ins Command-Log); Serializer im Workspace-Modul: einsammeln,
dann eine Transaktion; Auslöser Dirty/Debounce, Workspace-Wechsel,
Beenden mit Zeitbudget; Settings `terminal.restore.scrollback`,
`terminal.restore.max_lines`; Aktion `exclude_from_restore`; Löschung bei
Close, Verwaisten-Prune beim Start; `windowId` in `terminal_session` und
`side_menu_state`.

**Akzeptanzkriterien (Tests im Schritt):**

- Roundtrip: Snapshot → Restore → Buffer enthält Scrollback bis Limit,
  Trennzeile, dann neuer Prompt; Start-cwd ist der Basis-Kontext, auch
  wenn der letzte Kontext WSL/SSH war.
- Unlesbarer Snapshot → Shell startet ohne Scrollback, Meldung.
- Serializer: kein `await` innerhalb der Transaktion (Test mit
  verzögertem `snapshot()`).
- Beenden mit langsamer Serialisierung → Zeitbudget greift, Layout
  gespeichert, Scrollback fehlt, kein Hänger.
- `scrollback = off` → Spalte leer.
- Manuell: App beenden, starten → Workspaces, Tabs, Panes, Scrollback da;
  Kommando, das beim Beenden lief, steht im Command-Log als abgebrochen.

**Erlaubter Übergangszustand:** keiner.

### Schritt 28: `bootstrap/` und Ende von `app/`

**Voraussetzungen:** alle vorherigen außer 29.

**Was:** `app/bootstrap/` → `bootstrap/` (`main.ts`, `app.config.ts` ohne
Port-Tabelle — nur Feature-Manifest, Plattform-Provider, Feature-Host,
Workbench-Root); `app/app.component.ts` → `core/workbench/shell/`;
`app/features.ts` → `bootstrap/features.ts` (`as const`); Reste von
`app/app-host/` (`path.factory` → `core/session/shells/`) und
`app/common/` (`terminal-activity/` → `core/session/`) einsortieren.
`app/` löschen.

**Akzeptanzkriterien:**

- `src/packages/app/` existiert nicht.
- `bootstrap/` ist der einzige Ort mit `inject()`.
- Regel `nothing-imports-bootstrap` grün.
- `AGENTS.md`: DI-Regel ohne den Übergangszusatz.

**Erlaubter Übergangszustand:** keiner.

### Schritt 29: Übergangsregeln entfernen

**Voraussetzungen:** 28.

**Was:** Übergangsblock aus `.dependency-cruiser.cjs` löschen, die alten
sechs Regeln löschen, Alias `@cogno/app` aus tsconfig/vite/vitest
entfernen, `scripts/architecture-guard.mjs` und Baseline entfernen,
`lint:architecture` auf die fünf Pakete; `ARCHITECTURE.md`: Zeile
„aktueller Schritt" entfernen, dieses Dokument archivieren; `AGENTS.md`
ohne Übergangsregeln; `encrypt`/`decrypt` für `api_key` (ZA Delta:
`enc:`-Präfix, `cogno config set --secret`) als letzte Funktionsänderung.

**Akzeptanzkriterien:**

- `grep -rn "@cogno/app" src tsconfig.json vite.config.ts vitest.config.ts`
  leer.
- `pnpm lint` grün mit genau den 14 Regeln aus ZA 2.1.
- Test: `feature.ai.api_key = enc:…` wird entschlüsselt; Klartext lädt
  mit Diagnose.

**Erlaubter Übergangszustand:** keiner — das ist der Zielzustand.

---

## Was bewusst nicht in diesem Plan steht

- Reihenfolge der Teilcommits innerhalb eines Schritts, wo „ggf. in
  Teilcommits" steht: entscheidet der Programmierer nach gleichem Muster.
- Zeitaufwand. Die Schritte sind nach Abhängigkeit geschnitten, nicht
  nach Dauer; Schritt 14 und 22 sind die größten.
- Alles aus ZA Abschnitt 9.
