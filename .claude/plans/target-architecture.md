# Zielarchitektur

Stand 2026-08-26. Ergebnis der Bestandsaufnahme (`capability-inventory.md`).
Dieses Dokument ist die Zielarchitektur und ersetzt bei ihrer Übernahme die
bisherige `ARCHITECTURE.md` vollständig. Konzept, kein Umsetzungsplan —
der steht in `umsetzungsplan.md` (30 Schritte, je ein Commit).

---

## 1. Entscheidungen (fest)

1. **Ein Build.** Features sind ein Laufzeit-Array, keine Build-Varianten.
2. **`advanced/` ist Cogno.** Was ein normales Terminal zu Cogno macht, ist nicht
   abschaltbar — es muss extrem robust sein. Abschaltbarkeit war das falsche
   Mittel für das richtige Ziel.
3. **Degradation ist Pflicht, Abschaltung ist Produktentscheidung.** Zwei
   unabhängige Eigenschaften, nicht zwei Ebenen.
4. **Zwei Begriffe: Core und Feature.** Der Ordner entscheidet: was in
   `features/` liegt, ist ein Feature und hat `mode: "on" | "off"`; was
   keinen `mode` braucht, liegt in `core/` und ist immer an. Ein Feature
   ohne `mode` gibt es nicht. Laufzeitfehler und Degradation sind Status,
   keine weiteren Modi.
   Der heutige Modus `hidden` (und `visible` bei AI) wird zu `on`: das Schema
   kennt nur noch `on | off`, der Config-Reader liest `hidden`/`visible` aus
   bestehenden Dateien als `on`.
5. **Schichten als Ordner mit Pfadregeln**, keine zusätzlichen Pakete.
6. **Kommandodaten: Erfassung und Nutzung sind getrennt.** Ein
   **Recorder** schreibt, was die Shell meldet (welches Kommando, wann, wo, in
   welchem Shell-Kontext, mit welchem Ergebnis) nur in die Datenbank — er
   kennt keinen Konsumenten. History, Autocomplete und künftige Sichten
   (Statistik) lesen über eine gemeinsame Abfrage-API und besitzen keine
   Tabellen. Siehe 2.4.
7. **Notification-Dispatch ist Core (Workbench)**, die Übersicht ist ein
   Feature. Der Dispatch braucht Layout-Identität, Fokus und Seitenleiste —
   er ist deshalb Workbench, nicht `core/infrastructure/`.
8. **Toter Code raus**, außer `encrypt`/`decrypt` (für `api_key`, der heute im
   Klartext liegt).
9. Nightly-Kanal: nicht Teil dieser Architektur.
10. **Wessen Fakt ist es?** Der Core besitzt Fakten über Sitzung und
    Workbench. Ein Feature besitzt Fakten über seine eigene Domäne und
    ermittelt sie selbst — über `platform/` für Kontextfreies (HTTP, Opener,
    Clipboard) und über die API für alles im Sitzungskontext (Kommandos im
    cwd, Pfade, Dateien), nie über Session- oder Terminal-Interna. Ein Fakt
    mit zweitem Konsumenten wandert ins Modell (siehe 2.2).

---

## 2. Das Modell

Cogno ist dreierlei: eine **Maschine** (Terminal), eine Schicht, die den
Bytestrom plus OSC in ein **Modell** übersetzt (Kommandos, Eingabezeile, cwd,
Shell-Kontext, Capabilities), und **Konsumenten**, die dieses Modell lesen und
teilweise zurückschreiben.

Das Modell ist die Architektur. Ereignisse bauen es auf, Abfragen lesen es,
Ports schützen die Außengrenze. Hexagonal gilt an der Außengrenze (Platform,
Features), nicht als Gesamtmodell — die Domäne ist dafür zu dünn.
Ereignisgesteuert gilt für die Richtung Shell → Cogno, nicht als Alleinmittel —
Konsumenten entstehen lazy und müssen ziehen können.

### 2.1 Schichten

```
shared/              Fundament: reine Logik, generische UI, Utilities — kein Produktwissen
platform/            Fundament: Tauri-Grenze — kein Produktwissen
core/                das Produkt, immer an
  infrastructure/    Config, Theming, DB-Bridge, Migrations-Runner, Fehler, Logging, Pfade, Bus, Keybind-Parser
  terminal/          die Maschine: pty, renderer, byte-I/O, resize
  command-log/       Kommandodaten: Schema, Migrationen, Schreib- und Abfrage-API
  session/           Session-Host, Modell und sitzungsgebundene Konsumenten
  workbench/         übergreifend; besitzt die Sessions
  api/               die Sicht der Features auf Session und Workbench (das „Protokoll", Abschnitt 3)
features/            das Produkt, abschaltbar
bootstrap/           Kompositionswurzel — kennt alle, niemand hängt daran
```

Zwei Fragen ordnen die oberste Ebene: *Weiß der Code, dass er Cogno ist?*
(`shared/`, `platform/`: nein — sie könnten in jeder Tauri-App liegen) und
*Ist er abschaltbar?* (nur `features/`). Alles mit Produktwissen, das immer
an ist, liegt in `core/` — auch die Maschine: xterm-Renderer, Ack-Flow-Control
und ConPTY-Handling sind Cogno-Code, nur der unterste.

**Infrastructure** ist alles, was jede Schicht braucht und was selbst weder
eine Sitzung noch das Layout kennt. Test: braucht der Code eine `sessionId`
oder die Tab-/Pane-Struktur? Nein — und würden Session, Workbench und
Command-Log ihn alle brauchen? Ja. Drin: Config (Datei, Plattform-Defaults,
Hot-Reload, Zod-Validierung mit Diagnosen, CLI-Overrides, Zusammenführen der
Feature-Schemas), Theming als Werte (angewendet in Terminal und Workbench),
Datenbank-Bridge und Migrations-Runner mit Checksummen, Recovery,
WAL-Checkpoint, Fehlerbehandlung und Logging, Pfade (exe, home, config, db,
log), der App-Bus als Mechanismus (nicht die Nachrichtentypen — die gehören
dem Sender), Keybind-Parser und Tastaturlayouts (die Ausführung ist
Workbench). Nicht drin: `command-log/` (Produktdaten mit eigenem Schema; es
*benutzt* die DB-Bridge) und Feature-Tabellen/-Migrationen (gehören dem
Feature; Infrastructure stellt nur den Runner). `terminal/` importiert
Infrastructure nicht.

Der heutige Pfeil `app → features` zeigt verkehrt herum, weil `app` zwei Rollen
hat: Kern **und** Kompositionswurzel. Trennt man sie, zeigt er richtig und die
Regel „nichts importiert app" wird überflüssig.

**Terminal** ist die Maschine: PTY, xterm-Renderer, Byte-I/O, Größe, Fokus,
Theme, Buffer-Zugriff, Marker-/Decoration-API und rohe Sequenz-Hooks. Sie kennt
keinen der Begriffe Kommando, Prompt, cwd, Shell-Kontext, Capability oder
History und importiert weder Config noch `core/`. Der Test: aus ihr allein
ließe sich ein Terminal ohne Cogno bauen. Schnittstelle nach oben — rein:
`write`, `resize`, `focus`, `attach(element)`/`detach()`, `setOptions`,
`dispose`; raus: Ausgabe-Bytes, OSC/CSI-Hooks, Cursor-/Größen-/Fokus-/
Selektions-/Scroll-/Alt-Screen-Änderungen, PTY-Exit; Zugriff: Buffer lesen,
Marker, Search-Addon. Heutige Dateien: `pty/pty.ts`, `renderer/renderer.ts`,
`input-writer.ts`, die Handler `pty`, `resize`, `cursor`, `mouse`,
`selection`, `scroll-state`, `focus`, `input`, `theme`, und der
Maschinen-Anteil von `TerminalStateManager` (Cursor, Maße, Fokus, Selektion,
Scroll, Progress).

**Session** ist die Bedeutung einer laufenden Sitzung: der Session-Host, der
eine Maschine besitzt und konfiguriert, das Sitzungsmodell (siehe unten), die
Interpretation der Sequenzen und alle sitzungsgebundenen Konsumenten —
Prompt-Dekoration, Editor-Aktionen, History, Recorder, Autocomplete, Composer,
Such-Engine, Links, Menüs, Snapshots. Alles darin lebt und stirbt mit der
Sitzung. Prüfkriterium: der Code braucht genau eine `sessionId` und wäre ohne
diese Sitzung sinnlos. Heutige Dateien: `terminal.session.ts` (wird der Host),
der Modell-Anteil von `TerminalStateManager` (`startCommand`/`endCommand`,
`updateCwd`, `updateSessionCapabilities`, `updateInput`, Shell-Kontext), die
Handler `terminal-title`, `terminal-notification`, `full-screen-app`¹,
`link`, `resume-link`, `clipboard`, `completed-command-notification`,
`terminal-search`, sowie `advanced/*` vollständig, `header/`, und die
Shell-Integration aus `features/shell/` als `core/session/shells/`
(Shell-Definitionen, Support, Pfadadapter, Line-Editor-Wissen,
Integrationsskripte, CAPS-Handshake, `COGNO_*`-Env) — sie stellt den Kontext
einer Sitzung her und ist Core (Entscheidung 2, Inventar 5: „ohne 5 gibt es
kein 6, 7, 9, 11"). Das heutige `shellFeature` ist ein als Feature
verkleideter Core-Baustein ohne `mode`, UI oder Settings; der
Contribution-Punkt `shells?` entfällt. Die Shell-Typen `Fish` und `GitBash`
ohne Definition werden dabei entfernt.
¹ Alt-Screen-*Erkennung* ist Maschine (Buffer-Typ), die *Reaktion* ist Session.

Drei Entscheidungen an dieser Grenze:

1. `TerminalStateManager` wird in Maschinenzustand und Sitzungsmodell geteilt —
   neben dem `CommandLineObserver`-Split die zweite unvermeidliche Operation.
2. Die Maschine importiert keine Config. Heute holen `renderer.ts` und mehrere
   Handler `ConfigService` direkt; künftig bekommt die Maschine Optionen als
   Werte, und der Session-Host liest sie aus der Config und schiebt sie bei
   Hot-Reload nach. Dasselbe in Gegenrichtung: die Maschine loggt und meldet
   nicht selbst (heute importiert `renderer.ts` den Fehler-Reporter), sondern
   veröffentlicht Fehler und Diagnosen als Ereignisse; der Host reicht sie an
   den Reporter weiter.
3. Fokus meldet die Maschine, die Workbench entscheidet. `focus.handler`
   publiziert heute direkt auf den App-Bus; künftig meldet die Maschine
   DOM-Fokus an den Session-Host, der ihn als Fakt veröffentlicht, und die
   Workbench setzt daraus den aktiven Pane.

**Das Sitzungsmodell ist veränderlich.** Eine Sitzung startet mit einem
Shell-Kontext (OS × Shell × WSL-Distro), aber der Kontext kann sich während der
Laufzeit ändern: `ssh` in einen Linux-Host, `wsl` aus der PowerShell, `bash`
aus `cmd`, `su`, ein Container. Ab da gelten Pfadinterpretation, Shell-
Definition, Capabilities, verfügbare Editor-Aktionen und die Zuordnung im
Recorder (Kontext-Spalte der History) nicht mehr. Heute wird der Kontext genau
einmal beim Start aus dem Profil abgeleitet (`terminal-state.manager.ts:79`)
und nie wieder angefasst — ein Kontextwechsel ist im Modell nicht vorgesehen.

Zielbild: das Sitzungsmodell führt eine **Kontext-Zeitachse**. Ein Kontext hat
`{ shellType, backendOs, wslDistro?, remoteHost?, capabilities, since }`; der
aktuelle ist der letzte Eintrag. Kontextwechsel erkennt die Session aus
denselben Quellen wie alles andere: der neue `COGNO:CAPS`-Handshake, wenn die
innere Shell die Integration geladen hat (der erwünschte Fall), sonst
Heuristiken (Prompt-Ende ohne Cogno-Marker, `ssh`/`wsl` als laufendes
Kommando ohne Rückkehr). Ohne Handshake fällt die Session in einen
**unbekannten Kontext**: Pfadübersetzung, Editor-Aktionen und Recorder werden
sichtbar degradiert (Robustheit 4.3), nicht geraten (4.4). Kommt die äußere
Shell zurück (Exit des `ssh`-Kommandos, Prompt-Marker der äußeren Shell),
endet der Eintrag und der vorherige Kontext gilt wieder. Alle
sitzungsgebundenen Konsumenten lesen den Kontext aus dem Modell statt ihn
beim Start zu kopieren.

**Der Handshake ist authentisiert.** Jeder Prozess in der PTY kann
OSC-Sequenzen ausgeben — ein `cat` einer präparierten Datei, ein Build-Log,
die Ausgabe eines SSH-Hosts. Sobald `COGNO:CAPS` und `COGNO:PROMPT`
Pfadauflösung, Editor-Aktionen und `run` steuern, muss die Session wissen,
dass die Sequenz von *ihrer* Integration stammt. Dafür erzeugt Rust beim
Spawn ein zufälliges Sitzungsgeheimnis `COGNO_SESSION_TOKEN` in der
Umgebung (neben `COGNO_PORT`/`COGNO_TERMINAL_ID`); die Integrationsskripte
senden es in jeder modelländernden Sequenz mit (`COGNO:CAPS;token=…`,
`COGNO:PROMPT;token=…`). Die Session verwirft Sequenzen ohne passendes
Token, zählt sie und meldet ab einer Schwelle sichtbar „nicht
vertrauenswürdige Cogno-Sequenzen ignoriert" (4.3).

Was das abdeckt und was nicht: Es schützt gegen **Inhalte** — alles, was
durch die PTY läuft, ohne die Umgebung der Shell zu kennen. Es schützt nicht
gegen einen Prozess, der in derselben Shell mit derselben Umgebung läuft;
der kann das Token lesen, kann aber ohnehin alles, was der Nutzer kann. Für
SSH heißt das: der Host kennt das Token nicht, seine Ausgabe kann den
Kontext nicht umstellen — die Session bleibt im *unbekannten Kontext*,
außer der Nutzer leitet das Token bewusst weiter (`SendEnv
COGNO_SESSION_TOKEN` plus Integration auf dem Host). Dann ist der Wechsel
authentisiert und gewollt. Für WSL wird die Umgebung übernommen, der
Wechsel funktioniert ohne Zutun. Rein informative Sequenzen (OSC 2 Titel,
OSC 9 Nachricht, 9;4 Fortschritt) bleiben ohne Token — sie ändern kein
Modell, nur Anzeige.

Jeder Kontexteintrag der Zeitachse hat eine **Revision**; `run` und jede
schreibende API-Operation nennen die Revision, mit der sie geplant wurden,
und werden abgelehnt, wenn sie nicht mehr aktuell ist.

**Workbench** ist die Schicht, die Sitzungen anordnet, benennt, fokussiert,
öffnet und schließt, und die alles Übergreifende bedient, das der Nutzer
außerhalb einer Sitzung sieht: Tabs, Panes, Workspaces, Seitenleiste, Fenster,
Benachrichtigungen, Aktionen, Keybindings, externe Steuerung und den
Feature-Host. Sie kennt Sessions nur als einhängbare Hosts mit Identität —
niemals deren Inhalt. Prüfkriterium: braucht der Code die *Menge* der
Sitzungen oder die Layout-Identität `{windowId, workspaceId, tabId, sessionId}`, nicht
eine einzelne Sitzung samt Bytestrom, Eingabezeile oder cwd? Der Fokus
(„welches Pane ist aktiv") ist Workbench-Zustand. Heutige Ordner, die dorthin
gehören: `tab-list/`, `grid-list/` (inkl. `TerminalComponentFactory`),
`features/side-menu/workspace/` (heute fälschlich Feature), `features/side-menu/`
(Rail, Panel, `ui-state`), `window/`, `app-buttons/`, `header/`, `menu/`,
`notification/`, `action/`, `keybinding/`, `cli-command/`, `cogno-message/`,
sowie der heute über `app-host/`, `features.ts` und `AppWiringService`
verstreute Feature-Host.

`command-log/` hängt in `core/` nur von `infrastructure/` ab (DB-Bridge);
`session/` und `workbench/` dürfen es importieren.

**Zwischen Session und Workbench gibt es genau eine Richtung: `workbench →
session`.** Die Workbench hält die Session-Hosts (heute schon:
`TerminalComponentFactory`), hängt sie ein und aus, und liest ihr Modell. Die
Session importiert nichts aus der Workbench und weiß nicht, ob sie in einem
Tab, einem Pane oder gar nicht angezeigt wird.

Informationen fließen trotzdem nach oben — als **Fakten über das Modell**, nie
als Befehle an die Workbench. Die Session veröffentlicht auf ihrem Modell bzw.
ihrem Lebenszyklus: cwd geändert, Titel geändert (OSC 2), Kommando
begonnen/beendet mit Dauer und Exit-Code, Shell-Kontext gewechselt,
OSC-9-Nachricht empfangen, Fortschritt (OSC 9;4), Prozess beendet. Die
Workbench abonniert das und entscheidet selbst: Tab-Titel und Busy-Indikator
aktualisieren, bei Prozessende Pane und — wenn es das letzte Pane war — Tab
entfernen. Auch Benachrichtigungen entstehen so: die Session meldet „Kommando
endete nach 90 s" oder „OSC 9 kam", der Notification-Dispatch der Workbench
entscheidet Schwelle, Kanal und Unread-Badge (heute erzeugt
`completed-command-notification.handler` die Notification selbst). „Ungelesen"
ist abgeleiteter Workbench-Zustand, weil er den Fokus braucht. Heute publiziert `pty.handler.ts:55-60` bei
PTY-Exit direkt `RemovePane`; das ist ein Befehl aus der Session an das Layout
und wird zum Fakt `exited` (siehe 2.3). Der App-Bus bleibt als Mechanismus
erlaubt, aber Nachrichten aus `session/` sind ausschließlich Ereignisse in
Vergangenheitsform; Aktionsnamen der Workbench (`RemovePane`, `CloseTab`,
`FocusPane` …) kommen darin nicht vor — prüfbar per Typregel.

Die Grenze bleibt damit per Pfadregel prüfbar: `session/` importiert weder
`workbench/` noch `api/`.

Warum die Richtung so herum: **der Besitzer kennt das Besessene, nie
umgekehrt.** Die Workbench erzeugt Sessions (Tab öffnen, Split), hängt sie
ein und aus, schließt sie und liest ihr Modell für Titel, Busy und Badge —
das geht nicht ohne die Host-Schnittstelle. Die Session dagegen muss ohne
Workbench sinnvoll sein: im Test, beim Restore in einem unsichtbaren Tab, in
einem künftigen Headless-Betrieb über CLI/HTTP. Dieselbe Richtung gilt eine
Ebene tiefer: der Session-Host besitzt die Maschine und importiert sie, die
Maschine weiß nichts von der Session.

```
features/            Git, AI, Coding-Agents, Palette, …
    │  importieren nur
    ▼
core/api/            boundSession$, sessions$, revealSession, Contributions
    │  kennt beide
    ├──────────────►  core/workbench/   Fokus, Layout-Identität, Reveal, Feature-Host
    │                       │  besitzt
    │                       ▼
    └──────────────►  core/session/     Host, Modell, sitzungsgebundene Konsumenten
                            │  besitzt
                            ▼
                      core/terminal/    die Maschine
```

Die Importmatrix, mit Dependency Cruiser erzwungen (Zeile darf Spalte
importieren):

| von ↓ | `shared` | `platform` | `core/infrastructure` | `core/terminal` | `core/command-log` | `core/session` | `core/workbench` | `core/api` | `features` |
|---|---|---|---|---|---|---|---|---|---|
| `shared` | – | | | | | | | | |
| `platform` | ✔ | – | | | | | | | |
| `core/infrastructure` | ✔ | ✔ | – | | | | | | |
| `core/terminal` | ✔ | ✔ | | – | | | | | |
| `core/command-log` | ✔ | ✔ | ✔ | | – | | | | |
| `core/session` | ✔ | ✔ | ✔ | ✔ | ✔ | – | | | |
| `core/workbench` | ✔ | ✔ | ✔ | | ✔ | ✔ | – | | |
| `core/api` | ✔ | ✔ | ✔ | | ✔ | ✔ | ✔ | – | |
| `features` | ✔ | ✔ | | | | | | ✔ | nur über `index.ts` |
| `bootstrap` | alles | | | | | | | | |

**Die Matrix als Dependency-Cruiser-Regeln.** Der Check ist heute grün
(`pnpm lint:architecture`: 581 Module, 1 938 Abhängigkeiten, keine
Verstöße) und bleibt es in jedem Migrationsschritt — das ist die
Zusicherung, die den Umbau trägt. Die Regeln, die die Matrix eins zu eins
abbilden (Pfade unter `src/packages/`):

```js
// Fundament
{ name: "tauri-only-in-platform", from: { pathNot: "^platform/" },
  to: { path: "^@tauri-apps/" } },
{ name: "shared-imports-nothing", from: { path: "^shared/" },
  to: { path: "^(platform|core|features|bootstrap)/" } },
{ name: "shared-domain-framework-free",
  from: { path: "^shared/(domain|support)/" }, to: { path: "^(@angular/|rxjs)" } },
{ name: "platform-imports-only-shared", from: { path: "^platform/" },
  to: { path: "^(core|features|bootstrap)/" } },

// core, von unten nach oben
{ name: "infrastructure-knows-no-product-layer",
  from: { path: "^core/infrastructure/" },
  to: { path: "^core/(terminal|command-log|session|workbench|api)/|^features/|^bootstrap/" } },
{ name: "terminal-is-the-machine", from: { path: "^core/terminal/" },
  to: { path: "^core/(?!terminal/)|^features/|^bootstrap/" } },
{ name: "command-log-uses-only-infrastructure",
  from: { path: "^core/command-log/" },
  to: { path: "^core/(terminal|session|workbench|api)/|^features/|^bootstrap/" } },
{ name: "session-knows-no-workbench", from: { path: "^core/session/" },
  to: { path: "^core/(workbench|api)/|^features/|^bootstrap/" } },
{ name: "workbench-knows-no-api", from: { path: "^core/workbench/" },
  to: { path: "^core/(terminal|api)/|^features/|^bootstrap/" } },
{ name: "api-knows-no-features", from: { path: "^core/api/" },
  to: { path: "^core/terminal/|^features/|^bootstrap/" } },

// Features
{ name: "features-see-only-the-api", from: { path: "^features/" },
  to: { path: "^core/(?!api/)|^bootstrap/" } },
{ name: "features-import-each-other-via-index",
  from: { path: "^features/([^/]+)/" },
  to: { path: "^features/([^/]+)/.+", pathNot: "^features/([^/]+)/index\.ts$|^features/$1/" } },

// Bootstrap
{ name: "nothing-imports-bootstrap", from: { pathNot: "^bootstrap/" },
  to: { path: "^bootstrap/" } },
{ name: "known-aliases-only", from: { path: "^src/" },
  to: { dependencyTypes: ["unknown"],
        path: "^@cogno/(?!shared|platform|core|features|bootstrap)(/|$)" } },
```

Zwei Regeln lassen sich nicht als Import ausdrücken und bekommen einen
eigenen Test:

- **Fakten, keine Befehle:** Nachrichtentypen, die aus `core/session/`
  publiziert werden, sind in einer Union `SessionFact` deklariert; ein
  Typtest stellt sicher, dass `SessionFact` und `WorkbenchAction` disjunkt
  sind und `session/` nur `SessionFact` publiziert.
- **Ein Fenster kennt kein anderes:** kein Modul außer `platform/` ruft
  `emit_to`/Fenster-Labels — als `to: { path: "^@tauri-apps/api/event" }`
  ohnehin durch Regel 1 abgedeckt.

Während der Migration gilt: jeder Schritt lässt den Check grün. Ein Schritt,
der eine Regel vorübergehend verletzen müsste, ist falsch geschnitten — er
wird geteilt, nicht die Regel gelockert. Die Regeln kommen im ersten
Schritt (Gerüst, Abschnitt 8) vollständig in die Konfiguration; solange
ein Ordner leer ist, ist seine Regel trivial erfüllt.

**Übergangsregeln.** Während des Umbaus liegt Code an zwei Orten — der
alte unter `app/` und `features/` nach dem Vier-Paket-Layout, der neue
unter `core/` und `bootstrap/`. Damit dabei kein unkontrollierter Bereich
entsteht, gelten beide Regelsätze gleichzeitig, und dazu fünf
Übergangsregeln, die nur so lange existieren, wie `app/` existiert:

1. **Die alten Regeln bleiben.** Die heutigen sechs Regeln für `app/`,
   `features/`, `platform/`, `shared/` werden nicht gelöscht, sondern
   ergänzt. Sie fallen erst mit dem letzten Umzug aus `app/`.
2. **Kein Weg zurück.** Nichts unter `core/` oder `bootstrap/` importiert
   `app/` — Regel `target-never-imports-legacy`. Was eine umgezogene
   Scheibe aus `app/` braucht, zieht mit ihr um oder bekommt vorher
   seinen Zielort. Ausnahme: `bootstrap/` darf `app/` importieren, solange
   `app/bootstrap` nicht selbst umgezogen ist — Bootstrap kennt alle.
3. **`@cogno/app` ist eingefroren.** Der Alias bleibt für Altcode, bekommt
   aber keine neuen Verbraucher: eine Regel verbietet Importe von
   `@cogno/app` aus `core/`, `bootstrap/` und `features/` (Features
   durften es auch bisher nicht), und ein Zähler im CI stellt sicher, dass
   die Menge der `@cogno/app`-Importe insgesamt nur sinkt.
4. **`app/` schrumpft monoton.** Der CI-Check protokolliert Dateien und
   Abhängigkeiten unter `app/` (heute 354 Dateien) und schlägt fehl, wenn
   eine der Zahlen gegenüber dem Basis-Commit steigt. Neue Dateien
   entstehen nur noch im Zielbaum.
5. **Jede umgezogene Scheibe erfüllt sofort ihre endgültigen Regeln.** Es
   gibt keinen Zustand „liegt schon in `core/session/`, importiert aber
   noch `workbench/`". Ein Umzug, der das nicht kann, ist zu groß und wird
   geteilt — erst die Abhängigkeit an ihren Zielort, dann die Scheibe.

Die Übergangsregeln stehen als eigener Block in `.dependency-cruiser.cjs`
mit dem Kommentar „entfällt mit dem letzten Umzug aus `app/`"; der letzte
Schritt des Umsetzungsplans löscht diesen Block und den Alias.

Daraus folgen die Regeln, die man sich merken muss:

- Nur `platform/` importiert Tauri; `shared/` und `platform/` sind frei von
  Produktwissen.
- `core/terminal/` importiert nichts anderes aus `core/` — auch nicht
  `infrastructure/` (Grenz-Entscheidung 2 unten).
- `core/session/` importiert weder `workbench/` noch `api/`; `workbench/`
  darf `session/` importieren (Host-Schnittstelle, Modell). Nachrichten aus
  `session/` sind Fakten (Vergangenheitsform), nie Workbench-Aktionen.
- `core/api/` ist der einzige Ort in `core/`, den Features importieren, und
  der einzige, der `session/` und `workbench/` zusammen kennt.
- Features kennen `shared/`, `platform/` und `core/api/` — sonst nichts
  (Entscheidung 10). Logging, Fehler-Reporter und Settings erreichen ein
  Feature über die API bzw. seine Contributions, nie per Import aus
  `infrastructure/`.
- Nur `bootstrap/` kennt alle konkreten Teile und verdrahtet ihre Ports.

### 2.2 Die zwei Achsen

**Achse 1 — Bezugsgröße: eine Sitzung oder die Menge?** Prüfbar: braucht es eine
`sessionId` oder die Liste?

| | sitzungsgebunden | übergreifend |
|---|---|---|
| `core` | Modell, Command-Recorder, History, Autocomplete, Composer, Prompt-Dekoration, Editor-Aktionen, Such-Engine | Tabs, Panes, Workspaces, Seitenleiste, Fenster, Notification-Dispatch, Kommandodaten (Schema + Abfrage-API) |
| Feature | Git, AI, Prozess-Info, Such-Panel | Coding-Agents, Notification-Übersicht, Palette, Statistik (künftig) |

**Wessen Fakt ist es?** (Entscheidung 10) Die Frage ist nicht, *wer* einen
Fakt ermittelt, sondern *worüber* er ist:

- Ein Fakt **über die Sitzung** — cwd, Kommandos, Shell-Kontext, Busy,
  Prozessbaum („was läuft in meiner PTY") — ist Core: Sitzungsmodell, nach
  außen im Protokoll. Ebenso Fakten über die Workbench (Fokus, Layout).
- Ein Fakt **über etwas anderes, das man von der Sitzung aus beobachtet** —
  das Git-Repository im cwd, der Zustand eines Coding-Agents, die Antwort
  eines LLM — gehört dem Feature. Es ermittelt ihn selbst: kontextfreie
  Zugriffe (HTTP, Opener, Clipboard) direkt über `platform/`, alles im
  Sitzungskontext über die gebundene Session — `boundSession.run({
  executable, args, contextRevision })`, `boundSession.fs` — weil erst der
  *aktuelle* Shell-Kontext (2.1, Zeitachse) bestimmt, welcher Pfadadapter
  gilt. `run` nimmt **keine Shell-Zeichenkette**, sondern Programm und
  Argumentliste: kein Quoting, keine Injection über Pfade mit Leerzeichen
  oder Anführungszeichen, und die Argumente lassen sich vor dem Start
  kontextgerecht übersetzen. `contextRevision` ist die Revision des
  Kontexteintrags, mit dem das Feature geplant hat; ist sie nicht mehr
  aktuell, lehnt `run` ab statt im falschen Kontext zu laufen. `run` startet einen
  **eigenen, unsichtbaren Prozess** im Kontext der Sitzung (cwd, Env; in
  einer WSL-Distro über `wsl.exe -d`), nie eine Eingabe in die PTY — das
  ist `injectInput`, und die beiden dürfen nicht verwechselbar heißen. In
  einem Remote- oder unbekannten Kontext gibt es keinen solchen Prozess:
  `run` lehnt ab, das Feature degradiert sichtbar („nicht verfügbar in
  Remote-Sitzung"), statt lokal in einem Pfad zu laufen, der auf dem Host
  liegt. Ein Feature mit rohem
  `CommandRunner` würde in einer SSH-Sitzung Windows-Pfade übersetzen; über
  die Bindung bekommt es Kontextkorrektheit und den Schreibschutz aus
  Abschnitt 3 geschenkt.

Der Test: *Wäre der Fakt noch sinnvoll, wenn Cogno kein Terminal wäre?*
Git-Status in einem Ordner: ja → Feature. Prozessbaum unter der PTY: nein →
Core. Das Ventil: **ein Fakt mit zweitem Konsumenten wandert ins Modell.**
Braucht der AI-Chat morgen den Git-Branch, wird der Branch Sitzungsfakt —
nicht ein Import des Git-Features.

`platform/` zu benutzen vermischt nichts: es ist generischer OS-Zugriff ohne
Produktwissen, keine Core-Schicht. Vermischung entstünde nur, wenn Features
`terminal/` oder Session-Interna anfassen — und das bleibt verboten. Für
Tests sind Plattformdienste injectable Klassen mit Stub-Providern.

Konkret: Prozess-Info wird ein **Panel in der Seitenleiste** — ein
sitzungsgebundenes Feature wie Git, das `boundSession$` folgt und den
Prozessbaum daraus liest. Der Dialog aus dem Kontextmenü
(`terminal.session.ts:545`) und der Menüeintrag „Process Info" entfallen; der
Baum bleibt Modell, weil auch der AI-Snapshot ihn braucht. Git bleibt eine vollständige
Scheibe — Ermittlung über `boundSession.run({ executable: "git", args: ["status", "--porcelain"], contextRevision })`, Tabellen, UI,
Settings — und
`mode: off` heißt: alles weg. Coding-Agents bleiben ein Ganzes, inklusive
Hook-Installation und Statusempfang.

**Achse 2 — Lebensdauer.** Sitzungsgebundene Teile in `core/session/` leben und
sterben mit der Session. Ein eigenständiger Session-Host besitzt ihre
Component-Provider; Pane-, Tab- und Workspace-Views hängen diesen Host nur ein
oder aus. Die heutigen `TerminalComponent`-Provider (`terminal.component.ts:44-53`)
zeigen bereits diese Richtung. Sitzungsgebundene *Features* leben dagegen
app-weit in einem Panel und sind an eine Sitzung **gebunden**. Deshalb
heißt das Feld `target`, nicht `scope`: es sagt, *worauf* ein Feature zeigt
(`"session"` oder `"workbench"`), nicht, wie lange es lebt. Die Lebensdauer
eines Features ist immer die der Anwendung (pro Fenster, 2.6); was mit
einer Sitzung lebt und stirbt, ist per Definition Core. Ein zweites Feld
`lifetime` hätte nur einen Wert und entfällt.

Diese Unterscheidung erklärt drei Dinge, die vorher als Probleme aussahen: warum
History/Autocomplete/Composer Component-Provider sind (korrekt, nicht kaputt),
warum Git beim Öffnen `captureFocusedSnapshot()` zieht (app-weites Panel über
eine Sitzung), und warum das Protokoll eine Abfrageseite braucht (ebendafür).

### 2.3 Ownership einer Sitzung

Ownership ist absichtlich geteilt, aber jede Entscheidung hat genau einen Ort:

- `core/workbench/` besitzt das **Wann und Wo**: Layout-Identität, Öffnen,
  Splitten, Verschieben und Schließen einer Sitzung.
- `core/session/` besitzt das **Wie**: Laufzeitstatus, Shell-Kontext,
  Kommandozeilen-Modell und den vollständigen Session-Lebenszyklus.
- `core/terminal/` besitzt ausschließlich die **Maschine**: PTY, Renderer,
  Ein-/Ausgabe und Resize.
- Eine Pane-/Layout-View hängt einen bestehenden Session-Host an einen DOM-Host
  oder löst ihn davon. Das Zerstören dieser Darstellungsview beendet keine
  Sitzung. Nur ein expliziter Close-Vorgang zerstört den Session-Host und seine
  Runtime.
- `bootstrap/` verdrahtet diese Rollen, enthält aber keine Session-Fachlogik.

Eine Session hat **zwei orthogonale Zustandsachsen**, weil der Terminal-Core
ohne DOM arbeitet: xterm 6 erzeugt `InputHandler` und `WriteBuffer` im
Konstruktor (`CoreTerminal.ts:125,141`), `write()` parst auch vor `open()`
in den Buffer; `open(element)` bringt nur Renderer, Viewport, Fit, WebGL und
Decorations. Buffer, Cursor, OSC-Handler und Marker — alles, worauf das
Modell beruht — sind headless verfügbar. (Ein Prüfpunkt vor der Umsetzung:
ein Spike, der einen unopened `Terminal` mit `COGNO:PROMPT`-Sequenzen
füttert und das Kommandozeilen-Modell daraus liest.)

**Achse A — Runtime** (besitzt `session/`):

```
allocated -> starting -> running          (PTY läuft, Core parst, Modell lebt)
                     \-> failed
running   -> exited  -> closed            (Prozess endete; Exit-Code im Zustand)
running   -> closing -> closed            (expliziter Close durch die Workbench)
```

**Achse B — Darstellung** (steuert die Workbench über den Host):

```
detached <-> attached                     (attach(element) / detach())
```

`attach` ruft `open()` beim ersten Mal und hängt danach nur noch um;
`detach` löst den DOM-Host und gibt den WebGL-Kontext frei (der Pool in
`renderer.ts:216ff` tut das heute schon nach Sichtbarkeit) — der Core und
damit Buffer, Modell, Recorder und History laufen weiter. Was DOM braucht,
lebt nur in `attached`: Prompt-Dekoration als Overlay, Autocomplete-Panel,
Composer, Search-Highlighting. Diese Konsumenten hängen sich beim `attach`
an und beim `detach` ab; ihr Zustand (welche Marker, welche Suche) liegt im
Modell, nicht im DOM.

Größe: ein `detached` Core hat die zuletzt bekannte Pane-Größe (aus dem
Snapshot oder dem letzten `attach`), damit Wrapping und Prompt-Layout beim
späteren Anzeigen stimmen; `attach` fittet und resized die PTY, xterm
reflowt.

`exited` ist ein Fakt der Session, `closing` ein Befehl der Workbench. Bei
`exited` entscheidet die Workbench: Pane entfernen, war es das letzte Pane
des Tabs auch den Tab — und danach den Host schließen. Ob ein Pane bei
Exit-Code ≠ 0 stattdessen mit sichtbarem Ergebnis stehen bleibt, ist eine
Workbench-Option, keine Session-Entscheidung.

Ein Startfehler lässt das Pane mit sichtbarem Fehlerzustand, Retry und Close
bestehen. Reparenting, Tab-Wechsel und Workspace-Wechsel verändern nur die
Darstellung beziehungsweise Layout-Identität; eine laufende Session wird dabei
nicht neu gestartet.

Beim Laden oder Wiederherstellen eines Workspaces werden **alle** zugehörigen
Sessions sofort gestartet (`running`), auch in nicht sichtbaren Tabs und
Panes — sie sind `detached`, nicht Platzhalter: die Shell läuft, Kommandos
werden erfasst, der Tab-Titel aktualisiert sich. Sichtbar werden nur die
Panes des aktiven Tabs `attached`. Das begrenzt zugleich die
WebGL-Kontexte auf die sichtbaren Panes.

### 2.4 Kommandodaten (`core/command-log/`): Recorder, Abfrage, Sichten

Heute liegt alles in einer Klasse pro Terminal: `HistoryRepository` und
`TerminalHistoryPersistenceService` schreiben (`upsertCommandExecution`,
`upsertCommandTransition`, cwd) **und** lesen (`searchCommands`,
`getRecentCommands`, `searchCommandPatterns`); `history-command.suggestor.ts`
setzt eigene SELECTs ab. Zielbild — drei Rollen, drei Orte:

1. **Recorder** (`core/session/`, sitzungsgebunden). Abonniert das
   Sitzungsmodell (Kommando-Beginn/-Ende, Exit-Code, cwd, Shell-Kontext) und
   ruft die Schreib-API. Er kennt keinen Konsumenten und liest nie. Er ist die
   einzige Stelle, die aus Shell-Ereignissen Datensätze macht. Schreibt
   asynchron und darf die Sitzung nicht bremsen (Inventar 7).
2. **Kommandodaten** (`core/command-log/`, übergreifend). Besitzt die Tabellen
   `command*`, `command_log`, `command_stat`, `command_transition_stat`,
   `command_pattern*`, `path`, `dir_stat`, `shell_context`, `command_fts` und
   ihre Migrationen. Zwei API-Seiten:
   - **Schreiben:** `recordExecution`, `recordCwd`, `recordTransition`,
     Import (nativ/Legacy), Prune, Löschen — plus die **Feedback-Schreiber**
     `markCommandSelected`, `markDirectorySelected`, `confirmLivePattern`,
     `markCommandPatternSelected`. Feedback ist auch Erfassung (Nutzerverhalten
     statt Shell-Ereignis), nur ein anderer Absender.
   - **Lesen:** `searchCommands`, `getRecentCommands`, `searchDirectories`,
     `searchCommandPatterns`, Übergangs-Statistik, FTS. Kein Konsument setzt
     eigenes SQL ab.
   Abgeleitete Daten (Statistik, Übergänge, Pattern-Mining) werden hier
   gepflegt, nicht beim Konsumenten — sie sind Funktionen des Logs.
3. **Sichten** — lesen nur, jede ein eigenes Submodul:
   - `core/session/history/` — das Dropdown mit Scopes Global/Dir/Tab
     (sitzungsgebunden, weil Tab- und Dir-Scope die Sitzung brauchen),
   - `core/session/autocomplete/` — Orchestrierung (Debounce, Timeout je
     Provider, Zusammenführen, Highlighting), die Suggestoren als Provider
     und das Panel; besitzt das **Suggestion-Modell**,
   - Statistik (künftig, Feature, übergreifend),
   - jede weitere Sicht, die dazukommt.

   Der Recorder ist ebenfalls ein eigenes Submodul, `core/session/recorder/`.
   History und Autocomplete importieren sich nicht gegenseitig; beide
   importieren `command-log/` (Lese-API und das **Kommando-Modell**, das
   dort liegt). Dass sie heute eine Klasse teilen
   (`TerminalHistoryPersistenceService`), ist der Zustand, den 2.4 auflöst
   — „gemeinsamer Fachbereich" heißt gemeinsame Daten, nicht gemeinsamer
   Lebenszyklus.

Konsequenz: `TerminalHistoryPersistenceService` löst sich in Recorder (der
sitzungsgebundene Teil mit `initialize`/`onCwdChanged`/`onCommandExecuted`)
und die Abfrage-API auf; `HistoryRepository` wird der `command-log/`-Kern. Die
Rückkehrcode-Whitelist (`setAllowedReturnCodes*`) ist Recorder-Konfiguration.
Der Degradationspfad „DB fehlt" liegt einmal in `command-log/`; jede Sicht sieht
dann eine leere, aber gültige Datenquelle.

**Backpressure und Health.** „DB fehlt → leere gültige Datenquelle" ist der
einfache Fall. Die anderen beiden — DB langsam, DB kaputt nach dem Start —
brauchen Regeln, die aus Abschnitt 4 folgen:

- **`commandLogHealth$`** in `command-log/`: `ok | degraded(reason) |
  unavailable(reason)` mit Zählern (`dropped`, `pending`, letzte
  Schreiblatenz). Die API reicht es durch; Seitenleiste und
  Notification-Übersicht zeigen `degraded`/`unavailable` sichtbar an
  (4.3), History und Autocomplete markieren ihre Ergebnisse als
  „unvollständig", solange der Zustand nicht `ok` ist.
- **Begrenzte Queue im Recorder** je Session: `recorder.max_pending`
  (Default 256 Einträge). Der Recorder schreibt asynchron und in Batches;
  ist die Queue voll, gilt die **Überlaufregel „ältestes verwerfen"** — das
  jüngste Kommando ist für History und Autocomplete das wertvollste, und
  die Sitzung wird unter keinen Umständen gebremst (Inventar 7). Jeder
  Verlust erhöht `dropped`; ab dem ersten wird `degraded(backpressure)`
  gemeldet, mit Zahl. Nichts geht still verloren.
- **Schreibfehler:** ein fehlgeschlagener Batch wird einmal wiederholt;
  schlägt er erneut fehl, werden seine Einträge als `dropped` gezählt und
  der Zustand wird `degraded(write-error)`. Nach drei Batches in Folge
  `unavailable`; der Recorder versucht es mit wachsendem Abstand erneut
  und kehrt bei Erfolg zu `ok` zurück — Degradation ist reversibel.
- **Atomare Statistik:** `command_stat`, `dir_stat`,
  `command_transition_stat` werden ausschließlich mit
  `INSERT … ON CONFLICT DO UPDATE SET count = count + 1`-Anweisungen
  fortgeschrieben, nie mit Lesen-Rechnen-Schreiben in TypeScript. Mehrere
  Fenster (2.6) und mehrere Sessions schreiben so ohne Lost Updates; ein
  Batch ist eine Transaktion, SQLite serialisiert Schreiber im WAL-Modus.
  Pattern-Mining, das nicht als Einzelanweisung geht, läuft als
  Hintergrundjob über das Log, nicht im Schreibpfad.
- **Lesen unter Last:** Abfragen von History und Autocomplete haben ein
  eigenes Timeout (Inventar 7: < 100 ms für Autocomplete); läuft es ab,
  liefert die Lese-API leer mit Kennzeichen `timedOut`, und der Suggestor
  ist für diesen Durchlauf `rejected` wie heute — nie ein blockiertes Panel.



### 2.5 Sitzungs-Wiederherstellung

Ziel: nach einem Neustart stehen offene Workspaces, Tabs, Panes und die
Sitzungen wieder da. Die Matrix legt die Rollen fest: `workbench → session`
ist erlaubt, also lebt der **Serializer in der Workbench** und fragt jede
Session nach ihrem Anteil. Vorher aber die Ehrlichkeit, was „wieder da"
heißen kann — nach einem Neustart existieren PTY, SSH-Verbindung und
laufendes Kommando **nicht mehr**. Drei Dinge sind zu unterscheiden:

| | Was | Wird… |
|---|---|---|
| **Neue Shell-Runtime** | Profil, Start-cwd, Titel-Override | neu gestartet — ein frischer Prozess mit frischer Umgebung, frischem Token, neuem Handshake |
| **Wiederhergestellte Darstellung** | Scrollback als Text | eingespielt, sichtbar als Vergangenheit |
| **Nicht wiederherstellbarer alter Prozess** | Kontext-Zeitachse, Capabilities, unterbrochenes Kommando, Umgebung | **nicht** wiederhergestellt — nur dokumentiert |

Daraus die Form des `SessionSnapshot` (Typ in `session/`, von der
Workbench gespeichert, nicht interpretiert):

- **`start`** — Shell-Profil, Start-cwd, Titel-Override. Das Start-cwd ist
  das cwd des **Basis-Kontexts** (der lokalen, äußersten Shell), nicht das
  des letzten. War die Sitzung zuletzt in SSH oder WSL, startet sie lokal im
  letzten lokalen cwd; der frühere Remote-Kontext wird nie „aktueller
  Kontext" — den bestimmt allein der neue Handshake (2.1).
- **`scrollback`** — Text per SerializeAddon, ohne Alt-Screen-Inhalt, auf
  `terminal.restore.max_lines` (Default 1000) begrenzt; entfällt bei
  `terminal.restore.scrollback = off` (Config, global) oder wenn das
  Terminal per Aktion `exclude_from_restore` ausgenommen ist. Nach dem
  Restore steht er als **Vergangenheit** im Buffer: durch eine sichtbare
  Trennzeile („Sitzung wiederhergestellt, <Zeit>") vom neuen Prompt getrennt,
  ohne Kommando-Blöcke oder Marker — Text, in dem man suchen und kopieren
  kann, mehr nicht.
- **`history`** — die frühere Kontext-Zeitachse als Information für das
  Modell („war zuletzt auf host X") und der Titel des Kommandos, das beim
  Beenden lief. Beim Restore markiert der Recorder dieses Kommando im
  Command-Log als **abgebrochen** (`exit: aborted`, Ende = Snapshot-Zeit);
  nichts wird erneut gestartet.
- **Nicht enthalten:** die Umgebung (Rust baut sie beim Spawn neu, inklusive
  neuem `COGNO_SESSION_TOKEN`), Capabilities (kommen vom neuen Handshake),
  laufende Bindungen, Cursorposition, Eingabezeile.

**Vertraulichkeit.** Scrollback kann Passwörter, Tokens und vertrauliche
Ausgaben enthalten. Das Command-Log speichert heute schon Kommandozeilen,
Scrollback vergrößert die Fläche aber deutlich. Deshalb: Alt-Screen wird nie
persistiert, die Persistenz ist global abschaltbar und je Terminal
ausschließbar, das Limit ist klein, und der Snapshot wird beim Schließen
einer Session oder eines Workspaces gelöscht, nicht nur überschrieben. Beim
Start werden verwaiste Snapshots (ohne zugehörige Layout-Zeile) entfernt.
Die Datenbank bleibt lokal und unverschlüsselt wie die History; wer mehr
braucht, schaltet ab.

**Ablauf.** Sichern in zwei Phasen: erst **einsammeln** — Layout aus der
Workbench, dann asynchron je Host `snapshot()` (der Scrollback wird in
Leerlaufzeit serialisiert, nicht im Eingabepfad) — und erst wenn alle
Teile im Speicher liegen, **eine kurze Schreibtransaktion**. Keine offene
Transaktion über einem `await`. Auslöser: Dirty-Tracking mit Debounce,
Workspace-Wechsel, Beenden (mit Zeitbudget; was nicht rechtzeitig
serialisiert ist, wird ohne Scrollback gespeichert). Wiederherstellen:
Layout aufbauen, je Pane einen Host mit `restore(snapshot)` erzeugen —
Scrollback in den Core schreiben, Trennzeile, dann PTY starten — und alle
sofort starten, auch unsichtbar (2.3). Die Session ist passiv: sie kann sich
beschreiben und aus einer Beschreibung entstehen, speichert nichts selbst
und kennt keine Tabelle.

`terminal_session` gehört der Workbench (Workspace-Modul, heute
`workspace.repository.ts`). Der Snapshot ist darin eine Spalte, deren
Inhalt `session/` bestimmt und versioniert; alte Versionen werden gelesen,
unlesbare als „Darstellung nicht wiederherstellbar" behandelt — die Shell
startet trotzdem. Die Tabellen-Migration bleibt bei der Workbench.

### 2.6 Fenster

Ein Tauri-Fenster ist eine eigene Webview mit eigener Angular-Instanz. Zwei
Fenster teilen keinen JS-Zustand: jedes hat seine eigene Workbench, eigene
Session-Hosts, einen eigenen Feature-Host. Geteilt ist nur der Rust-Prozess —
und der ist heute schon fensterunabhängig: alle PTYs in einer Map
`terminalId → Session` (`pty.rs:315`), eine Datenbank, ein HTTP-Server.
Was fehlt, ist Routing: `http_server.rs:129` und `lib.rs:50,115` senden per
`app.emit` an *alle* Fenster; mit zwei Fenstern führt ein globaler
CLI-Befehl in beiden aus, ein terminalgebundener kommt in beiden an.

Entscheidungen:

1. **Identität ist vierteilig:** `{windowId, workspaceId, tabId, sessionId}`.
   `windowId` ist das Tauri-Label. Alles, was ein Ziel adressiert
   (Notifications, `revealSession`, CLI/HTTP mit `terminalId`), trägt es.
2. **Rust ist der Besitzer alles Prozessglobalen** und die einzige Stelle,
   die alle Fenster kennt: PTYs, Datenbank, HTTP-Server, CLI-Empfang,
   Coding-Agent-Hook-Empfang, Config-Watcher, OS-Notification-Klicks. Rust
   führt eine Tabelle `terminalId → windowId` (gefüllt beim Spawn, der immer
   aus einem Fenster kommt) und routet: Nachricht mit `terminalId` →
   `emit_to(window)`; globale Aktion ohne Ziel → das fokussierte Fenster;
   Config-Änderung → Broadcast (der eine Fall, in dem Broadcast richtig
   ist). Diese Routing-Schicht liegt in Rust und auf der TS-Seite in
   `platform/` (`Window`, `Messaging`); keine Schicht darüber weiß, wie
   viele Fenster es gibt — sie sieht nur Nachrichten für sich.
3. **Eine Session gehört dem Fenster, dessen Webview ihren xterm-Core
   hält.** Der PTY-Prozess lebt in Rust und ist fensterfrei; nur der Buffer
   ist im JS-Heap. „Pane in anderes Fenster" ist damit kein Umhängen,
   sondern ein Restore (2.5): Snapshot im Quellfenster, neuer Core im
   Zielfenster, Übernahme derselben PTY über `terminalId`. Die Architektur
   trägt das; geplant ist es nicht (Abschnitt 9).
4. **Ein Workspace ist in höchstens einem Fenster offen.** Öffnet man ihn
   aus einem anderen, fokussiert Rust das Fenster, das ihn hält
   (`workspaceId → windowId` in derselben Rust-Tabelle). Das Schließen
   eines Fensters schließt seine Sessions explizit (Busy-Guard wie heute)
   und gibt seine Workspaces frei.
5. **Feature-Host und Status sind pro Fenster.** `mode` ist global (Config),
   der Runtime-Status nicht — ein Panel kann in einem Fenster `degraded`
   sein und im anderen laufen. Deklarationen laufen pro Fenster idempotent;
   die DB-Migrationen sind durch Checksumme und Einzeltransaktion mehrfach
   ausführbar.
6. **Notification in ein anderes Fenster:** der Dispatch des Quellfensters
   sieht am Ziel `windowId ≠ eigenes` und ruft
   `platform.window.reveal(windowId, {workspaceId, tabId, sessionId})`; Rust
   fokussiert das Fenster und `emit_to` liefert das Ziel an dessen
   Workbench, die wie bei einem lokalen Reveal springt. OS-Notifications
   tragen die volle Identität; der Klick landet in Rust und geht denselben
   Weg.
7. **Command-Log und Datenbank:** mehrere Fenster schreiben in dieselbe
   SQLite über Rust; WAL und die Einzeltransaktionen des Recorders reichen.
   Side-Menu- und Workspace-Zustand sind pro Fenster gespeichert
   (`windowId` als Spalte, „letztes Fenster" als Default beim Start).

---

## 3. Das Protokoll (`core/api/`)

Das Protokoll ist **die Schnittstelle, die Features bekommen** — die Antwort
auf die Frage, was ein Git-Panel, ein AI-Chat oder ein Coding-Agents-Panel von
Cogno wissen und tun darf. Es lebt in `core/api/`, dem einzigen Ordner
in `core/`, den Features importieren. Es muss ein eigener Ort sein, weil
`boundSession$` „dem Fokus folgt": der Fokus ist Workbench-Wissen, das Modell
ist Session-Wissen, und das Protokoll führt beides zusammen — es liegt
oberhalb von Session und Workbench (Diagramm in 2.1).

Heute existiert es bereits, verkleidet als `TerminalGatewayAdapterService` in
`app-host/`: er importiert `GridListService` (Fokus), `TerminalSessionRegistry`
(Sessions) und den Bus und bietet Features `focusedTerminalId$`,
`cwdChanges$`, `injectInput`, `captureFocusedSnapshot`, `revealTerminal`. Das
ist die Rolle — ohne Namen, ohne Bindungszustände, ohne Schreibschutz.

Das Protokoll ist zugleich die Stelle, an der Features klein gehalten werden:
Was nicht im Protokoll steht, kann ein Feature nicht tun.

Die Klassifikation formt es, statt Operationen aufzuzählen. Zwei Formen:

**Sitzungsgebundene Features** bekommen `boundSession$` — das Modell der gerade
gemeinten Sitzung: cwd, Shell-Kontext, Kommandos, Eingabezeile, Capabilities.
Damit schreiben Git, AI und Prozess-Info **keine** Fokus- und cwd-Verdrahtung
mehr (heute dupliziert in `git-status.service.ts:49-53` und
`coding-agents-side.component.ts:382-386`).

Die Bindung hat benannte Zustände (`unbound`, `active`, `closing`, `closed`).
Jede schreibende Operation prüft unmittelbar vor dem Schreiben erneut
Session-Identität und Capability. Damit kann eine verspätete asynchrone Antwort
nach einem Fokuswechsel nicht in das falsche Terminal schreiben.

**Übergreifende Features** bekommen `sessions$` und `revealSession(id)`.

Bindung: Standard „folgt dem Fokus", auf Wunsch **gehalten**. Das Wort *pin*
ist bereits für „Panel offen halten" belegt (`side-menu.service.ts:166`);
die Bindung heißt deshalb `hold`/`release` — „das Git-Panel hält Terminal 3".
Zustände: `following | held`, orthogonal zu `unbound/active/closing/closed`.

Weil `core/session/` **innen** bleibt, entfallen die teuersten Protokollteile,
die die Prüfung als schwerste Lücken markiert hatte: Overlay-Geometrie
(Cursorzelle, Zellmaße, Ausweichen vor der Seitenleiste), Dropdown-Arbitrierung
und ein `decorate(range, style)`, das die Prompt-Dekoration ohnehin nie hätte
tragen können.

Was das Protokoll zusätzlich braucht und heute fehlt: eine **Gegenrichtung**
(Features tragen Notification-Kanäle bei — heute importiert der Core dafür aus
`@cogno/features/coding-agent/ports`, `terminal.session.ts:3`), Block-Adressierung
über `commandId` statt Puffer-Zeilennummern, und Layout-Identität
(`{windowId, workspaceId, tabId, sessionId}`, 2.6) für das Zielspringen von Notifications.

### 3.1 Ports und Schnittstellen

Die alte `ARCHITECTURE.md` hatte eine Port-Regel („Feature deklariert eine
abstrakte Klasse, die App implementiert, Bootstrap bindet"). Sie wird durch
drei einfachere Regeln ersetzt, weil es die Rolle „App" nicht mehr gibt:

1. **Features haben keine eigenen Ports mehr.** Was ein Feature vom Produkt
   braucht, steht in `core/api/`. Braucht ein Feature etwas, das dort fehlt,
   wird die API erweitert — mit dem Feature als erstem Konsumenten
   (Abschnitt 9: keine Operationen ohne Konsumenten). Die heutigen
   Feature-Ports (`workspace-close-guard.port.ts`, `NotificationCenterPort`,
   `TerminalGateway` in `shared/ports` …) gehen darin auf oder entfallen,
   wenn ihr Feature Core wird.
2. **Plattformdienste sind konkrete injectable Klassen**, keine Ports
   (`DatabaseAccess`, `PtyTransport`, `HttpClient`, `Opener`, `Clipboard` …).
   Tests ersetzen sie durch Stub-Provider, nicht durch `vi.mock`. Ein Dienst,
   der Plattformaufruf und Sitzungskontext kombiniert (`CommandRunner`,
   `Filesystem` mit Pfadübersetzung nach aktuellem Shell-Kontext), gehört zu
   `core/session/` und erreicht Features als `boundSession.run`/`.fs` über
   die API.
3. **Innerhalb von `core/` gibt es Schnittstellen nur an Besitzgrenzen:**
   die Maschine nach oben (`TerminalMachine`), der Session-Host nach oben
   (`SessionHost`, `SessionModel`, `SessionSnapshot`), die API nach außen.
   Alles andere sind konkrete Klassen. `bootstrap/` bindet ausschließlich
   die Contributions-Liste und Plattform-Provider; es gibt keine
   `provide: Port, useExisting: Adapter`-Tabelle mehr.

---

## 4. Robustheit

Vier prüfbare Anforderungen:

1. **Jede Naht hat einen benannten Fehlerzustand**, nicht nur ein `try/catch`.
2. **Jeder Degradationspfad hat einen Test.** Existiert heute praktisch nicht.
3. **Degradation ist sichtbar.** Still verlorene Fähigkeit ist schlimmer als ein
   Fehler.
4. **Keine Korruption der Eingabezeile.** Im Zweifel nichts tun statt raten.

Punkt 4 ist der kritischste Bereich überhaupt: das Kommandozeilen-Modell
rekonstruiert Text und Cursorposition aus dem xterm-Buffer. Liegt es falsch,
schreibt Cogno an die falsche Stelle in einer Zeile, die der Nutzer gleich
ausführt. Ein Absturz wäre harmloser. Dorthin gehört die meiste Testarbeit.

Punkt 3 hat ein Lehrbuch-Gegenbeispiel im Code: `clipboard.handler.ts:104-110`
publiziert `OpenComposer` und gibt `true` zurück — der Aufruf erreicht das
`paste()` nie. Hört niemand zu, ist der mehrzeilige Paste **still weg**.

Fehlerisolation im Rendering geht **nicht** per `try/catch` um `ngComponentOutlet`:
`refreshView` wirft weiter *und* markiert Vorfahren erneut dirty (Dauerschleife),
`ApplicationRef.synchronizeOnce` hat keinen Guard pro View, `@defer`/`@error`
greift nur beim Nachladen. Einziger Weg: View detachen und `detectChanges()`
selbst in `try/catch` rufen.

### 4.1 Bestehende Degradationszustände

| Pfad | Zustand |
|---|---|
| History-DB fehlt | ✅ `terminal-history-persistence.service.ts:102-107, 225-249` |
| Suggestor wirft/timeout | ✅ `terminal-autocomplete.service.ts:400-431` |
| Marker desynchronisiert | ✅ `validateRange` |
| Prompt-Dekoration aus | ✅ `disposeMarkers()`/`refreshMarkers()` — der Alt-Screen-Pfad macht das täglich |
| `suggestor.matches()` wirft | ❌ ungeschützt (`:283`) |
| Composer fehlt | ❌ Paste still verloren |
| Prompt-Renderer wirft beim DOM-Bau | ❌ |
| Kommandozeilen-Modell liegt falsch | ❌ kein Erkennungspfad |
| Gebundenes Terminal stirbt | ❌ existiert noch nicht |
| Command-Log langsam oder Schreibfehler | ❌ unbegrenzte Promise-Kette im Recorder, kein Zähler, kein Health-Zustand |
| Gefälschte `COGNO:*`-Sequenz aus Programmausgabe | ❌ jede Sequenz wird geglaubt; kein Token, kein Zähler |
| Shell-Kontext wechselt (ssh/wsl/su) ohne Handshake | ❌ kein Erkennungspfad; Pfadübersetzung und Recorder arbeiten mit dem Startkontext weiter |

### 4.2 Testen

| Schicht | Wie |
|---|---|
| `shared/` | reine Unit-Tests, kein Framework (Regel: `shared/domain` und `shared/support` importieren weder Angular noch RxJS) |
| `platform/` | Rust-seitig getestet (Datenbank, PTY, Prozesse); die TypeScript-Seite ist eine dünne `invoke`-Schicht ohne eigene Tests |
| `core/terminal/` | Unit-Tests gegen xterm im Headless-Modus: Byte-Roundtrip, Resize, Flow-Control-Acks, Alt-Screen-Erkennung. Keine Tauri-Abhängigkeit — PTY als Stub |
| `core/session/` | der Schwerpunkt: Kommandozeilen-Modell und OSC-Interpretation gegen aufgezeichnete Byteströme (bash, zsh, pwsh, mit und ohne Integration, mit Kontextwechsel). Jeder Degradationspfad aus der Tabelle oben ist ein Test. Regel 4.4: ein Test, der zeigt, dass bei Unsicherheit *nichts* geschrieben wird |
| `core/workbench/` | Layoutbaum und Serializer als reine Logik; Feature-Host mit Fake-Features (aktivieren, deaktivieren, fehlschlagen, dreimal werfen) |
| `core/api/` | Bindungszustände und Schreibschutz: verspätete Antwort nach Fokuswechsel darf nicht schreiben |
| `features/` | gegen eine gestubbte API und Stub-Plattformdienste; ein Deaktivierungstest je Feature |
| `bootstrap/` | ein Start-Test: Deklarationsphase über das Manifest — keine doppelten Feature- oder Aktions-IDs, keine Zyklen in `requires`, keine kollidierenden Settings-Pfade, keine Aktion ohne Handler |

Konstruktor-Injektion überall außer `bootstrap/`, damit Tests ohne
Angular-`TestBed` auskommen, wo es geht. `vi.mock` auf interne Module ist ein
Geruch — er bedeutet, dass eine Grenze fehlt.

---

## 5. Der Aktionskatalog

Aktionen sind die gemeinsame Sprache (Inventar 23): ausgelöst per Keybinding,
Menü, Palette, CLI und HTTP. Heute ist eine Aktion an acht Orten bekannt —
`core-action-names.ts` (74 Namen), `cli.rs` (47, abgedriftet), `switch`-Blöcke
in den Handlern (`tab-list.service.ts:143`), Menü-Labels
(`native-menu.service.ts:57`), Palette, dreimal `default_*.config` (je 76
`keybind`-Zeilen), `docs-playbook.md` — und `ActionName` ist `string`.

**Eine Definition, alles andere abgeleitet.**

```ts
export const NewTab = defineAction({
  id: "new_tab",
  title: "New Tab",
  description: "Open a new terminal tab",
  target: "workbench",          // "session": braucht ein Zielterminal
  defaultKeys: { windows: "always:Ctrl+T", macos: "always:Cmd+T", linux: "always:Ctrl+T" },
  menu: "file",                 // optional: Platz im nativen Menü
});
```

Zwei Quellen, eine Form, ein Katalog:

- **Core-Aktionen** definiert die Workbench in `core/workbench/actions/`.
- **Feature-Aktionen** definiert jedes Feature in `FeatureDefinition.actions`.

`defineAction` und der Typ liegen in `shared/`, weil Features ihn brauchen.
Der Katalog in der Workbench hat zwei Mengen, nicht eine:

- **`known`** — alle Definitionen, Core und Feature, registriert in der
  Deklarationsphase des Feature-Hosts (6.1) unabhängig vom Modus. Daraus
  kommen der Typ `ActionName`, der Codegen, die Config-Validierung der
  `keybind`-Zeilen und die Antwort „unbekannt".
- **`active`** — die Teilmenge mit registriertem Handler: Core-Aktionen
  immer, Feature-Aktionen nur, solange das Feature aktiv ist. Palette und
  Menü zeigen `active`; Keybindings feuern nur für `active`.

Damit antworten CLI und HTTP dreistufig: nicht in `known` → „unbekannte
Aktion"; in `known`, nicht in `active` → „Feature *x* ist nicht aktiv";
sonst ausführen. Der Start-Test „keine Aktion ohne Handler" prüft
`known` minus `active` gegen die Menge der ausgeschalteten Features: was
übrig bleibt, ist tot.

| Ableitung | Wie |
|---|---|
| Typ `ActionName` | Union aus den `as const`-Manifesten (`bootstrap/features.ts`, `core/workbench/actions/catalog.ts`), nicht aus dem Laufzeit-Katalog (6.1); Tippfehler sind Compile-Fehler |
| Handler | Registrierung gegen die Definition (`actions.handle(NewTab, …)`) statt `switch` auf Strings; eine Aktion ohne Handler ist zur Laufzeit meldbar |
| Palette, natives Menü, Hamburger | lesen `title`, `menu` aus dem Katalog; Keybinding-Hints wie heute aus der Keybind-Konfiguration |
| CLI | Codegen zur Build-Zeit → `actions.generated.rs` (Namen + Beschreibungen), damit `cogno action list` offline funktioniert |
| Default-Keybindings | Teil der generierten Default-Konfiguration, siehe unten |
| Doku | Codegen → Markdown für die Website, analog zu Zod `.describe()` bei den Settings |
| Config-Validierung | Zod prüft `keybind = …=<name>` gegen den Katalog, unbekannte Namen als Diagnose-Notification |
| HTTP `POST /action` | validiert gegen dieselbe Liste |

Der Codegen (`scripts/generate-actions.ts`) läuft über dieselbe statische
Feature-Liste aus `bootstrap/`, kennt also auch Feature-Aktionen. CI prüft,
dass die generierten Dateien aktuell sind — sonst driftet es wieder, nur auf
andere Art.

### 5.1 Die Default-Konfiguration

Heute sind die Defaults bereits geteilt, nur unsichtbar: die drei
`default_*.config` tragen je 163 Settings-Zeilen (in allen drei identisch) und
76 Keybind-Zeilen (zwischen Windows und macOS fast vollständig verschieden);
die Zod-Schemas tragen die Beschreibungen, aber nur drei `.default()`. Die
Datei ist die Quelle der Werte, Zod die Quelle der Doku, der Code die Quelle
der Aktionen.

Regel: **Quelle ist Code, Sicht ist eine vollständige generierte Datei pro
OS.**

- Settings: Wert *und* Beschreibung in Zod (`.default(…).describe(…)`); wo ein
  Wert vom OS abhängt, steht das im Schema. Das ist dieselbe Entscheidung wie
  für die Website-Doku (`SettingsDocsPort`), nur konsequent zu Ende geführt.
- Keybindings: in der Aktionsdefinition, pro OS (`defaultKeys`). Eine Aktion
  ohne Default-Keybinding ist zulässig.
- Der Build generiert daraus `default_windows.config`, `default_macos.config`,
  `default_linux.config` — alle Settings mit ihrem Kommentar, alle Keybinds,
  nichts handgeschrieben. Der Rust-Teil lädt sie wie heute als
  Plattform-Defaults unter der Nutzerdatei.
- Der Nutzer sieht genau diese Datei: `cogno config show --defaults` und ein
  Menüpunkt „Default-Konfiguration öffnen" zeigen sie vollständig, zum
  Kopieren und Überschreiben. Was er sieht, kann nicht mehr abdriften, weil es
  nichts anderes ist als die Quelle in anderer Form.

Prüfbar: `default_*.config` stehen im Repo als generierte Dateien mit
Kopfzeile, und CI schlägt fehl, wenn sie nicht zum Code passen.

Weil die Quelle der Code ist, kann die Datei keinen toten Eintrag enthalten —
und Totes ist dort auffindbar, wo es entsteht:

- Aktion ohne registrierten Handler: `known` minus `active` minus Aktionen ausgeschalteter Features, beim Start
  gemeldet (hätte `minimize_window` gefunden).
- Keybind auf unbekannte Aktion: Typfehler.
- Setting ohne Leser: CI-Prüfung „jeder Schema-Schlüssel wird außerhalb des
  Schemas referenziert". Grob, aber sie findet den nie gelesenen Schlüssel;
  einen gelesenen, aber wirkungslosen (`terminal.history.max_entries = 0`)
  findet nur ein Test.

---

## 6. Was „Feature" heißt

```
Feature = {
  id
  requires?                              // Abhängigkeiten, transitiv aufgelöst
  target: "session" | "workbench"        // Achse 1: worauf es zeigt; Lebensdauer ist immer Anwendung
  actions?                               // Deklaration known, Handler erst bei Aktivierung (5)
  settings?, migrations?                 // Deklaration: immer registriert (6.1)
  sideMenu?, notificationChannels?, suggestors? // Aktivierung: nur bei mode: on
  mode: "on" | "off"                      // jedes Feature; Default "on"
  activate?/deactivate?                  // optional: nur wenn es beim Aktivieren etwas zu tun gibt
}
```

`mode` ist der persistierte, per Hot-Reload wechselbare Produktzustand. Davon
getrennt hat die Runtime einen nicht persistierten Status:

```
inactive | activating | active | degraded | deactivating | failed
```

Aktivierung und Deaktivierung sind idempotent. Deaktivierung meldet alle
Contributions ab und gibt Subscriptions sowie Ressourcen frei. Schlägt die
Aktivierung fehl, bleibt `mode: "on"`; der Status wird sichtbar `failed` oder
`degraded`. Einen Modus `hidden` gibt es nicht. Falls UI unabhängig von der
Aktivierung ausgeblendet werden soll, ist das eine Darstellungsoption des
Features und kein weiterer Modus.

Ein Feature besitzt seine Einstellungen (eigenes Zod-Schema — der zentrale
Sammelpunkt und die Kopie im statischen `Config`-Typ entfallen), seine Tabellen
und Migrationen, seine Contributions und seine UI.

`requires` bleibt, weil ausdrücklich gewünscht — mit der ehrlichen Anmerkung,
dass der reale Baum nach dem Zusammenlegen der Panel/Service-Paare null Kanten
hat. Der Feature-Host löst es trotzdem auf (6.1), damit die erste echte
Kante keine Sonderbehandlung braucht.

### 6.1 Der Feature-Host (`core/workbench/feature-host/`)

Abschnitt 6 sagt, was ein Feature *ist*; der Feature-Host ist der eine
Dienst, der damit *umgeht*. Heute existiert er in drei Bruchstücken:
`features.ts` (die Liste), `AppWiringService` (sammelt Contributions einmalig
im Konstruktor in `readonly`-Arrays), `side-menu-lifecycle-runtime.service.ts`
(Lazy-Laden der Panels). Kein Code liest `mode` nach dem Start; nichts kann
wieder abgemeldet werden.

Vier Aufgaben:

1. **Deklaration (statisch, immer).** Bekommt beim Start die Liste aus
   `bootstrap/` und registriert *vor* dem ersten Config-Lesen alles, was
   unabhängig vom Modus bekannt sein muss: IDs, `requires`,
   **Settings-Schemas** (sonst kann die Config, in der `mode` steht, nicht
   validiert werden — das wäre ein Zirkel), **Migrationen** (laufen einmal,
   Daten werden nicht abgeschaltet) und **Aktionsdefinitionen** (damit CLI,
   HTTP und Palette den Namen kennen). Erst danach liest er `mode` und führt
   je Feature den Runtime-Status:
   `inactive → activating → active → deactivating → inactive`, dazu
   `activating → failed` und `active → degraded`.
2. **Aktivierung (dynamisch, nur bei `mode: on`).** Löst `requires`
   transitiv auf, aktiviert in Abhängigkeitsreihenfolge, deaktiviert
   umgekehrt. Aktivieren = die *aktiven* Contributions anmelden —
   Side-Menu-Panel, **Aktions-Handler**, Notification-Kanäle, Suggestoren,
   Hintergrunddienste — und `activate()` rufen; Deaktivieren = abmelden,
   `deactivate()`, Subscriptions freigeben. Beides idempotent. Was in Phase
   1 registriert wurde, bleibt.

   Die Trennlinie: Phase 1 ist, was das Produkt über ein Feature *weiß*;
   Phase 2 ist, was das Feature *tut*. Eine Deklaration hat keine
   Seiteneffekte; Fehler in Phase 1 sind Startfehler (unten), alles, was
   zur Laufzeit fehlschlagen kann, ist Aktivierung.
3. **Hot-Reload.** Abonniert die Config; ändert sich `feature.<id>.mode`,
   aktiviert oder deaktiviert er. Schlägt Aktivierung fehl, bleibt
   `mode: "on"`, Status `failed`, sichtbar in der Seitenleiste (Icon mit
   Fehlerzustand, Grund, Retry) und als Notification.
4. **Fehlerisolation.** Rendert Panels mit detachter View und eigenem
   `detectChanges()` im `try/catch` (Abschnitt 4). Wirft ein Panel, wird der
   Status `degraded` und eine Ersatzansicht mit Retry gezeigt; wirft es
   dreimal in Folge, deaktiviert der Host es und meldet das.

**Übergänge.** Der Host arbeitet als Abgleich: die Config liefert je
Feature den *gewünschten* Modus, der Host führt den *tatsächlichen* Status
und gleicht an. Dafür gelten sieben Regeln:

1. **Eine Operation je Feature zur Zeit.** Läuft `activating` oder
   `deactivating`, wird ein neuer Wunsch nur gemerkt. Nach Abschluss —
   Erfolg oder Fehler — gleicht der Host erneut ab. `on → off` während
   `activate()` heißt also: Aktivierung zu Ende bringen, dann deaktivieren.
2. **Aktivierung ist ganz oder gar nicht.** Reihenfolge: Contributions
   anmelden (Listeneinträge, können per Konstruktion nicht fehlschlagen),
   dann `activate()`. Wirft `activate()`, meldet der Host alle Contributions
   in umgekehrter Reihenfolge ab, Status `failed` mit Grund. Es gibt keinen
   halb aktiven Zustand; ein Panel, das schon sichtbar war, verschwindet.
3. **Deaktivierung endet immer in `inactive`.** Reihenfolge: `deactivate()`
   *zuerst*, solange die Contributions noch angemeldet sind (das Feature darf
   sie zum Aufräumen benutzen — Panel schließen, offene Schreibvorgänge
   beenden), dann Contributions abmelden, dann Subscriptions freigeben. Wirft
   `deactivate()`, wird trotzdem alles abgemeldet und der Fehler gemeldet;
   der Status ist danach `inactive`, nie `failed`.
4. **`requires` ist eine Bedingung, keine Kaskade in die Config.** Ist ein
   benötigtes Feature `off` oder `failed`, bleibt das abhängige Feature
   `inactive` mit Grund „braucht *x*", sichtbar in der Seitenleiste; der
   Host schreibt nie in die Config. Wird *x* aktiv, aktiviert der nächste
   Abgleich die Abhängigen; wird *x* deaktiviert, deaktiviert der Host
   vorher die Abhängigen in umgekehrter Reihenfolge.
5. **`degraded` ist ein Laufzeitzustand, `failed` ein Endzustand.** Ein
   Panel, das beim Rendern wirft, setzt `degraded` und bekommt eine
   Ersatzansicht mit Retry; die Contributions bleiben angemeldet. Wirft es
   dreimal in Folge, deaktiviert der Host das Feature nach Regel 3 und setzt
   danach `failed` mit Grund — ein geöffneter Schutzschalter. `mode` bleibt
   `on`; die Config wird nicht angefasst.
6. **Aus `failed` kommt man nur durch Anstoß heraus:** Retry des Nutzers
   (Seitenleiste, Aktion `retry_feature`) oder eine Config-Änderung des
   Features. Kein automatischer Wiederholungsversuch.
7. **Der Status wird nicht persistiert.** Nach einem Neustart beginnt jedes
   Feature bei `inactive` und der Abgleich läuft neu. Persistiert ist nur
   `mode`, und der gehört dem Nutzer.

Damit ist jeder Übergang bestimmt:

```
inactive     --on, requires erfüllt-->  activating
activating   --activate() ok------->  active
activating   --activate() wirft---->  failed       (Contributions zurückgerollt)
active       --off oder requires--->  deactivating
active       --Panel wirft---------->  degraded     (bleibt angemeldet)
degraded     --Retry ok------------->  active
degraded     --3. Fehler------------>  deactivating -> failed
deactivating --immer---------------->  inactive     (dann ggf. -> failed, Regel 5)
failed       --Retry / Config------->  inactive     (Abgleich läuft neu)
```

**Deklarationsfehler sind Startfehler.** „Kann nicht fehlschlagen" gilt
für die einzelne Deklaration, nicht für die Menge: doppelte Feature-IDs,
zyklische oder unbekannte `requires`, kollidierende Settings-Pfade
(`feature.git.*` zweimal), doppelte Aktions-IDs. Der Host prüft das in
Phase 1 vollständig, *bevor* er `mode` liest, und bricht bei einem Befund
den Start kontrolliert ab: die App startet mit leerem Feature-Satz und
einer nicht wegklickbaren Meldung, die jeden Konflikt benennt. Das ist
ein Programmierfehler, kein Laufzeitzustand — deshalb kein `failed` eines
einzelnen Features, sondern der Start-Test aus 4.2 in Produktionsform.

**Der Typ `ActionName` braucht Literale.** `typeof` liefert nur dann eine
Union, wenn die Quelle ihre Literaltypen behält. Der Katalog zur Laufzeit
ist eine `Map` und liefert `string`. Deshalb gibt es ein reines
**Manifest**: `bootstrap/features.ts` exportiert die Feature-Liste `as
const`, und `core/workbench/actions/catalog.ts` die Core-Aktionen ebenso;
`ActionName` ist die Union aus beiden, berechnet zur Compile-Zeit. Der
Codegen (5) liest dasselbe Manifest. Ein Feature, das Aktionen erst zur
Laufzeit erzeugt (etwa je Workspace-Slot), deklariert die Form mit
Platzhalter (`select_workspace_${n}`) — die Instanzen sind `known`, sobald
das Feature sie anmeldet.

**Fehlerisolation für alle Contributions**, nicht nur Panels. Der Host
umhüllt jede Contribution beim Anmelden:

| Contribution | Isolation |
|---|---|
| Panel | detachte View, eigenes `detectChanges()` (4) |
| Aktions-Handler | `try/catch` + Timeout (Default 5 s für `async`); wirft er, wird die Aktion als fehlgeschlagen gemeldet, das Feature `degraded` |
| Notification-Kanal | Timeout; ein Kanal, der wirft, wird für diese Notification übersprungen, die anderen Kanäle laufen |
| Suggestor | hat es schon: Timeout und `rejected` je Suggestor (`terminal-autocomplete.service.ts:400-431`); dazu `matches()` in den Schutz (heute ungeschützt, `:283`) |
| Hintergrund-Subscription | `activate()` bekommt einen `AbortSignal`/`DestroyRef`; unbehandelte Fehler in Subscriptions landen beim Reporter mit Feature-ID und zählen auf den Schutzschalter (Regel 5) |

Drei Fehler *einer* Contribution in Folge öffnen den Schutzschalter des
Features, nicht drei Fehler irgendwo — sonst deaktiviert ein flackernder
Suggestor das ganze Git-Panel.

**Sitzungsgebundene Contributions und die Sessions.** Suggestoren, Shell-
Hooks und ähnliche Contributions gelten *je Session*. Der Host meldet sie
nicht bei Sessions an, sondern bei einer **Registry in `session/`**
(`SuggestorRegistry`), die als Observable ihre aktuelle Menge führt. Jeder
Session-Host abonniert diese Registry beim Start und baut seine
Autocomplete-Quellen daraus; ändert sich die Menge (Feature an/aus), zieht
jede laufende Session nach — bestehende Sessions bekommen den Suggestor
sofort, später erzeugte Sessions beim Start. Kein Feature kennt Sessions,
keine Session kennt Features; beide kennen die Registry. Dasselbe Muster
für jede weitere sitzungsgebundene Contribution.

Was er nicht ist: kein Ort für Feature-Wissen (er kennt Definitionen, keine
IDs), nicht der Ort der Contributions-Konsumenten (Aktionskatalog, Side-Menu,
Notification-Dispatch bleiben eigene Workbench-Dienste; er ruft nur deren
`register`/`unregister`), nicht `bootstrap/` (das übergibt die Liste und
geht; der Host lebt und hat Zustand).

Warum Workbench: die Konsumenten, bei denen er anmeldet, sind
Workbench-Dienste oder über `workbench → session` erreichbar; er rendert in
die Seitenleiste; er liest Config (`→ infrastructure`); er ist übergreifend
und zustandsbehaftet. Die API liest aus ihm `features$` (Id, Status, Modus)
für Seitenleiste und Notification-Übersicht und reicht jedem Feature Logger,
Reporter und seine Settings — die Stelle, an der ein Feature Infrastructure
erreicht, ohne sie zu importieren.

---

## 7. Delta zu heute

| Was | Umfang |
|---|---|
| `app` in `core/terminal/`, `core/infrastructure/`, `core/session/`, `core/workbench/`, `bootstrap/` schneiden | ~260 Dateien einsortieren, Pfadregeln ersetzen die Paketregeln |
| `features/shell/` → `core/session/shells/` | Umzug; `shellFeature` und Contribution-Punkt `shells?` entfallen; `Fish`/`GitBash` aus dem `ShellType`-Enum |
| `features/side-menu/` auflösen, Panel+Service-Paare zusammenlegen | Rail, Panel, `ui-state` und `workspace/` werden Workbench; 7 Feature-Ordner mit `index.ts`: ai, coding-agent, command-palette, git, notification-overview, terminal-search, process-info |
| Feature-eigene Zod-Schemas | funktioniert schon (`mergeSettingsSchema`), drei Deklarationsorte werden einer |
| **Feature-Host (Abschnitt 6.1)** | `features.ts`-Verteilung, `AppWiringService` und `side-menu-lifecycle-runtime.service.ts` gehen in `core/workbench/feature-host/` auf; Konsumenten (Side-Menu, Aktionskatalog, Notification-Dispatch, Suggestor-Registry) bekommen `register`/`unregister` statt `readonly`-Arrays; `PathFactory` wird instanzgebunden; Config-Abo auf `feature.<id>.mode`; Panel-Rendering mit detachter View; Status-Anzeige in der Seitenleiste. Ein Deaktivierungstest je Feature. |
| `CommandLineObserver` teilen | OSC-733→Modell (Core) von `MarkerManager` (Dekoration) trennen |
| **Terminal/Session-Grenze ziehen (Abschnitt 2.1)** | `TerminalStateManager` in Maschinenzustand (`core/terminal/`) und Sitzungsmodell (`core/session/`) teilen; `terminal.session.ts` (717 Zeilen) zum Session-Host reduzieren, der Maschine und Handler nur noch komponiert; Config-Zugriffe aus `renderer.ts` und den Maschinen-Handlern in den Host ziehen; `focus.handler` vom App-Bus lösen. 17 Handler nach der Tabelle in 2.1 einsortieren. |
| **Session → Workbench nur als Fakten (Abschnitt 2.1/2.3)** | `pty.handler.ts` publiziert bei Exit `RemovePane` → wird Lebenszyklus-Fakt `exited`; `GridListService`/`TabListService` reagieren und schließen Pane/Tab/Host. Bestehende Fakten (`TerminalCwdChanged`, `TerminalTitleChanged`, `TerminalBusyChanged`) bleiben; `completed-command-notification.handler` meldet nur noch „Kommando endete (Dauer, Exit)", der Notification-Dispatch entscheidet; `renderer.ts` meldet Fehler als Ereignis statt per Reporter-Import; Typregel, dass `session/`-Nachrichten keine Workbench-Aktionen sind. |
| **Handshake-Authentisierung (Abschnitt 2.1)** | Rust `environment_builder.rs`: zufälliges `COGNO_SESSION_TOKEN` je Spawn; Integrationsskripte (bash/zsh/pwsh) senden `token=` in `COGNO:CAPS`/`COGNO:PROMPT`; `cogno-osc.parser.ts` + `command-line.observer.ts` verwerfen ohne Token, zählen, melden; Kontext-Revision in der Zeitachse; `run` mit `{executable, args, contextRevision}` statt String. Doku: `SendEnv COGNO_SESSION_TOKEN` für SSH. |
| **Veränderlicher Shell-Kontext (Abschnitt 2.1)** — Verhaltensänderung | Kontext-Zeitachse im Sitzungsmodell statt einmaliger Ableitung in `terminal-state.manager.ts:79`; erneuten `COGNO:CAPS`-Handshake als Kontextwechsel verarbeiten; Zustand „unbekannter Kontext" mit sichtbarer Degradation; Rückkehr zum äußeren Kontext bei Kommando-Ende; Pfadadapter, Editor-Aktionen, Recorder, Autocomplete lesen den Kontext aus dem Modell. Shell-Integrationsskripte: `COGNO:CAPS` muss `backendOs`/Host mitmelden. |
| **Session-Host (Abschnitt 2.3)** — Verhaltensänderung, kein Umzug | Heute ist `TerminalComponent` der Host: Session, History, Autocomplete, Composer sind ihre Provider (`terminal.component.ts:44-53`), `dispose()` hängt an `ngOnDestroy` (`:93`). Reparenting per `TerminalComponentFactory` existiert bereits (`terminal-component.factory.ts:47`) und bleibt. Neu: Session-Erzeugung aus der View-Erzeugung lösen — heute entsteht eine Session erst, wenn ein `PaneComponent` sichtbar wird und `attach()` ruft (`pane.component.ts:96`), Workspace-Restore startet also nur den sichtbaren Tab. Dazu die zwei Zustandsachsen aus 2.3 (Runtime `allocated → starting → running/failed → exited|closing → closed`; Darstellung `detached ↔ attached`), `attach` ruft `open()` lazy, und ein Startfehler-Pfad mit Retry (heute keiner). Spike vorab: Kommandozeilen-Modell aus einem unopened xterm-Core. Betrifft `GridListService`, `PaneComponent`, `TerminalComponentFactory`, `TerminalSession`. |
| `api_key` verschlüsseln (Entscheidung 8) | Config-Reader akzeptiert `feature.ai.api_key = enc:<…>` und entschlüsselt über das vorhandene Rust-`decrypt`; `cogno config set --secret feature.ai.api_key <wert>` verschlüsselt beim Schreiben; Klartext bleibt lesbar, wird aber mit Diagnose-Notification gemeldet. Die generierte Default-Config dokumentiert das Format. |
| **Fakt-Zuordnung (Entscheidung 10)** | Prozess-Info: Dialog und Kontextmenü-Eintrag aus `terminal.session.ts:401,545` und `system-info/` → Seitenleisten-Panel als sitzungsgebundenes Feature (`sideMenu`-Contribution, folgt `boundSession$`); Prozessbaum bleibt Sitzungsmodell (AI-Snapshot ist zweiter Konsument). Git, AI, Coding-Agents bleiben vollständige Scheiben und ermitteln ihre Domänenfakten selbst — kontextfrei über `platform/`, im Sitzungskontext über `boundSession.run`/`.fs`; `CommandRunner`/`Filesystem` (`app-host/*-host.service.ts`) → `core/session/`. Depcruise: `features/` importiert `terminal/`, `session/`, `workbench/`, `command-log/` nicht. |
| **Protokoll als Ordner (Abschnitt 3)** | `TerminalGatewayAdapterService` + `TerminalGateway`-Port (`shared/ports`) → `core/api/`; Feature-Importe von `@cogno/shared/ports`-Terminal-Contracts auf `@cogno/core/api` umstellen; Depcruise-Regel „Features importieren aus `core/` nur `api/`". |
| **Fenster-Routing (Abschnitt 2.6)** | Rust: ein `WindowRegistry`-State (`terminalId → label`, `workspaceId → label`, zuletzt fokussiertes Fenster über `WindowEvent::Focused`, Freigabe bei `Destroyed`) und eine `route(app, payload)`-Funktion; `pty_spawn` bekommt `window: tauri::Window` und schreibt das Label in `Session`; `emit_to` statt `app.emit` in `http_server.rs:129`, `lib.rs:50,115`, `pty.rs:361`; Commands `window_claim_workspace`/`window_release_workspace`; Notification-Klick (`notification.rs:32-40`, macht `emit_to` schon) routet zum Ziel- statt Ursprungsfenster. TS `platform/`: `window.reveal(windowId, target)`; `windowId` in Identität, Notification-Ziel, `side_menu_state` und Workspace-Zustand. |
| **Sitzungs-Wiederherstellung (Abschnitt 2.5)** | `SessionSnapshot` = `start` + `scrollback` + `history`, versioniert; `snapshot()`/`restore()` am Host; Serializer im Workspace-Modul: einsammeln, dann eine Transaktion; Settings `terminal.restore.scrollback`, `terminal.restore.max_lines`, Aktion `exclude_from_restore`; Trennzeile im Buffer; abgebrochenes Kommando im Command-Log; Snapshot-Löschung bei Close und Verwaisten-Prune beim Start. Baut auf dem Session-Host aus 2.3 auf. |
| **Session-Bindung (Abschnitt 3)** — Verhaltensänderung, kein Umzug | Neuer Bindungsdienst in `core/api/`: `boundSession$` mit Zuständen `unbound/active/closing/closed`, Standard „folgt dem Fokus", haltbar (`hold`/`release`). Regel „vor jedem Schreiben Identität und Capability neu prüfen" gibt es heute nirgends — AI-Chat prüft das Zielterminal nur im Klick-Moment (`ai-chat-side.component.ts:331-332`). Umstellung von Git, AI, Prozess-Info, Coding-Agents auf den Dienst; ihre eigene Fokus-Verdrahtung entfällt. |
| **Command-Log Health und Backpressure (Abschnitt 2.4)** | `commandLogHealth$` mit Zählern; begrenzte Recorder-Queue (`recorder.max_pending`) mit Überlaufregel „ältestes verwerfen"; Batch-Schreiben mit einem Retry und reversiblem `unavailable`; Statistik nur per `ON CONFLICT DO UPDATE`; Lese-Timeout mit `timedOut`-Kennzeichen; Anzeige in Seitenleiste und Notification-Übersicht. |
| **Kommandodaten trennen (Abschnitt 2.4)** | `HistoryRepository` → `core/command-log/` mit getrennter Schreib-/Lese-API; `TerminalHistoryPersistenceService` → Recorder in `core/session/`; die drei Suggestoren und `terminal-history.service.ts` auf die Lese-API umstellen; eigenes SQL aus `history-command.suggestor.ts` entfernen; Migrationen `command*`/`path`/`dir_stat`/`shell_context` wandern zu `command-log/`. Überwiegend Umzug plus eine Schnittstellentrennung. |
| `hidden` → `on` | `featureModeSchema`/`aiFeatureModeSchema` auf `on | off`; Lesetoleranz für `hidden`/`visible` im Config-Reader; ~20 Code-Stellen mit `"hidden"` entfallen. Keine DB-Migration. |
| **Aktionskatalog (Abschnitt 5)** | `core-action-names.ts` → `defineAction`-Katalog in `core/workbench/actions/`; `ActionName` von `string` auf Union; `switch`-Handler in `tab-list`, `grid-list`, `window`, `menu`, `config` … auf Registrierung; Labels aus `native-menu.service.ts` in die Definitionen; `FeatureDefinition.actions` für Panel-Aktionen; Codegen-Skript für `cli.rs` (`main.rs:56-58, 172-186`), die generierten `default_*.config` und Doku, mit CI-Aktualitätsprüfung. |
| `platform`-Objektliterale zu injectable Klassen (3.1) | entfernt `vi.mock` aus den App-Specs |
| ~1.500 Zeilen reine Logik nach `shared/domain` | reiner Datei-Umzug |

Bereits erledigt und nicht mehr Teil des Deltas: Migrationen haben eine
quellqualifizierte ID (`source/name`), Checksumme und Einzeltransaktion. Die
literalen NUL-Bytes in `terminal-history.service.ts` und `prompt-renderer.ts`
sind im aktuellen Arbeitsstand durch die sichtbare Escape-Schreibweise
`\u0000` ersetzt.

---

## 8. Bei Übernahme mitzuändern

Diese Dateien schreiben das heutige Vier-Paket-Layout fest und blockieren die
Migration, sobald der erste neue Ordner entsteht. Sie werden im selben Schritt
umgestellt wie die Importmatrix, nicht danach.

| Stelle | Heute | Wird |
|---|---|---|
| `ARCHITECTURE.md` | vier Pakete, Migrationstabelle Schritte 1–6, Schritt 5 „open" | vollständig durch dieses Dokument ersetzt. Schritt 5 (History/Autocomplete/Composer nach `features/`) ist durch Entscheidung erledigt: sie bleiben Core in `core/session/`. |
| `AGENTS.md`, „Architecture rule" | „vier Pakete, `app → features → platform → shared`, nothing imports `app`, `ARCHITECTURE.md` ist Single Source of Truth" | die Schichten aus 2.1 und deren Pfadregeln; dieses Dokument als Source of Truth |
| `AGENTS.md`, „Angular DI rule" | `inject()` nur in `app/bootstrap/app.config.ts` | Pfad `bootstrap/app.config.ts` |
| `.dependency-cruiser.cjs` | Regeln 4/5 „nichts importiert `app`", Regel 6 „nur vier `@cogno/*`-Aliase" | der Regelsatz aus 2.1 kommt im ersten Schritt vollständig **dazu**, die alten sechs Regeln bleiben bis zum letzten Umzug; zusätzlich der Übergangsblock (kein Import `core/bootstrap → app`, `@cogno/app` eingefroren, `app/` schrumpft monoton); `lint:architecture` cruist auch `core/**` und `bootstrap/**`; der Check bleibt in jedem Schritt grün |
| `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` | Aliase `@cogno/app`, `@cogno/features`, `@cogno/platform`, `@cogno/shared` | `@cogno/core` und `@cogno/bootstrap` kommen dazu; `@cogno/app` bleibt eingefroren für Altcode und fällt mit dem letzten Umzug |
| `docs-playbook.md` | veraltet (Inventar) | nicht Teil der Architektur, wird im selben Aufwasch korrigiert |

## 9. Nicht geplant

- Build-Zeit-Feature-Flags, mehrere Bundles
- Web-Worker- oder iframe-Isolation
- Umbenennung bestehender DB-Tabellen
- Protokoll-Operationen ohne heutigen Konsumenten
- Pane in ein anderes Fenster verschieben: von 2.6 getragen (Snapshot + PTY-Übernahme), aber nicht gebaut
- Feature-Funktionen in Remote-Sitzungen (SSH): `boundSession.run` gibt es dort nicht, also kein Git-Panel, keine Prozess-Info, keine Agent-Erkennung. Manches geht in SSH einfach nicht; ein Cogno-Agent auf dem Host wäre ein eigenes Vorhaben.
