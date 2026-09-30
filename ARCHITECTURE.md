# Architecture

Diese Datei beschreibt die Architektur von Cogno. Sie ist die einzige Quelle
der Wahrheit; wo Code ihr widerspricht, ist der Code falsch oder die Datei
wird geändert — nicht stillschweigend beides nebeneinander gelassen.

Der Code liegt vollständig unter `shared/`, `platform/`, `core/`,
`features/` und `bootstrap/`; die Schichtregeln erzwingt `pnpm lint:architecture`.

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
   Das Schema kennt nur `on | off`; der Config-Reader liest die Werte
   `hidden` und `visible` aus bestehenden Dateien als `on`.
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
8. **Toter Code raus.** Code ohne Konsumenten wird entfernt, nicht
   für später aufbewahrt.
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
shared/              allgemeine, frameworkfreie Bausteine und Domänenmodelle; keine Verträge
  domain/            Domänenmodelle und reine Logik (Shell-Kontext, Pfadadapter, Benachrichtigungen, …)
  support/           reine Hilfsfunktionen
  ui/                generische UI-Bausteine
platform/            Tauri-Grenze; kein Produktwissen
core/                das Produkt, immer an
  api/               das Protokoll zwischen Core und Features, in beide Richtungen — nur Verträge (Abschnitt 3)
    contributions/   was Features beitragen (FeatureDefinition, Side-Menu, Settings, Migrationen, Notification-Kanäle)
  infrastructure/    Config, Theming, DB-Bridge, Migrations-Runner, Fehler, Logging, Pfade, Bus, Keybind-Parser
  terminal/          die Maschine: pty, renderer, byte-I/O, resize
  command-log/       Kommandodaten: Schema, Migrationen, Schreib- und Abfrage-API
  session/           Session-Host, Modell und sitzungsgebundene Konsumenten
  workbench/         übergreifend; besitzt die Sessions; implementiert die meisten API-Verträge
    api-adapters/    Implementierungen der API-Verträge, die Session und Workbench zusammensetzen
features/            das Produkt, abschaltbar
bootstrap/           Kompositionswurzel — kennt alle, niemand hängt daran
```

Zwei Fragen ordnen die oberste Ebene: *Kennt der Code die laufende
Anwendung — ihre Sitzungen, ihr Layout, ihre Fenster, ihre Features?*
(`shared/` und `platform/`: nein) und *Ist er abschaltbar?* (nur
`features/`). Alles, was die Anwendung kennt und immer an ist, liegt in
`core/` — auch die Maschine: xterm-Renderer, Ack-Flow-Control und
ConPTY-Handling sind Cogno-Code, nur der unterste.

**Shared** trägt allgemeine, frameworkfreie Bausteine **und
Domänenmodelle**, die mehrere Schichten teilen (Shell-Kontext, Pfadadapter,
Benachrichtigungsmodell, Aktionen, Terminal-Suche); schwere Logik soll nicht zweimal
existieren. Domänenwissen ist erlaubt, Wissen über die *laufende* Anwendung
nicht: keine Services, kein Zustand, keine Verträge zwischen Core und
Features. Drei Grenzen halten das sauber:

1. **Keine Abhängigkeit nach innen.** `shared/` importiert nichts aus
   `platform/`, `core/`, `features/` oder `bootstrap/`.
2. **Keine Fremdtechnik.** Kein Tauri, kein xterm; in `shared/domain` und
   `shared/support` auch kein Angular und kein RxJS.
3. **Kein Vertrag zwischen Core und Features.** Was dort liegt, ist für sich
   allgemein und an keinen Aufrufer gebunden — man muss es verstehen können,
   ohne zu wissen, wer es benutzt. Ports, die der Core implementiert und
   Features benutzen, und Contributions, die Features erfüllen und der Core
   liest, sind das Protokoll und liegen in `core/api/`. Was nur eine Schicht
   oder ein Feature braucht, liegt dort, nicht in `shared/`.

**Infrastructure** ist alles, was jede Schicht braucht und was selbst weder
eine Sitzung noch das Layout kennt. Test: braucht der Code eine `sessionId`
oder die Tab-/Pane-Struktur? Nein — und würden Session, Workbench und
Command-Log ihn alle brauchen? Ja. Drin: Config (Datei, Plattform-Defaults,
Hot-Reload, Zod-Validierung mit Diagnosen, CLI-Overrides, Zusammenführen der
Feature-Schemas), Theming als Werte (angewendet in Terminal und Workbench),
Datenbank-Bridge und Migrations-Runner mit Checksummen, Recovery,
WAL-Checkpoint, Fehlerbehandlung und Logging, Pfade (exe, home, config, db,
log), Keybind-Parser und Tastaturlayouts (die Ausführung ist Workbench),
dazu `ActionKeybindingPort`: Session und Workbench zeigen Tastenkürzel an,
kennen tut sie nur die Workbench, die ihn implementiert.
Der App-Bus gehört nicht dazu: ihn benutzt nur die Workbench, deshalb liegt
er in `core/workbench/bus/`. Nicht drin: `command-log/` (Produktdaten mit eigenem Schema; es
*benutzt* die DB-Bridge) und Feature-Tabellen/-Migrationen (gehören dem
Feature; Infrastructure stellt nur den Runner). `terminal/` importiert
Infrastructure nicht.

Kern und Kompositionswurzel sind getrennte Ordner, weil sie entgegengesetzte
Rollen haben: `core/` kennt keine Features, `bootstrap/` kennt alle und wird
von niemandem importiert. Nur so zeigt der Pfeil zu `features/` in die
richtige Richtung.

**Terminal** ist die Maschine: PTY, xterm-Renderer, Byte-I/O, Größe, Fokus,
Theme, Buffer-Zugriff, Marker-/Decoration-API und rohe Sequenz-Hooks. Sie kennt
keinen der Begriffe Kommando, Prompt, cwd, Shell-Kontext, Capability oder
History und importiert weder Config noch `core/`. Der Test: aus ihr allein
ließe sich ein Terminal ohne Cogno bauen. Schnittstelle nach oben — rein:
`write`, `resize`, `focus`, `attach(element)`/`detach()`, `setOptions`,
`dispose`; raus: Ausgabe-Bytes, OSC/CSI-Hooks, Cursor-/Größen-/Fokus-/
Selektions-/Scroll-/Alt-Screen-Änderungen, PTY-Exit; Zugriff: Buffer lesen,
Marker, Search-Addon. **Das Basis-Terminal ohne Zauber.** Dateien in
`core/terminal/`: `pty.ts`, `renderer.ts`, die Handler `pty`, `resize`, `cursor`,
`mouse`, `selection`, `scroll-state` und `focus` (nur fokussieren und melden —
das Löschen des Ungelesen-Abzeichens nicht), und `machine-state.ts`, der
Maschinenzustand (Cursor, Maße, Fokus, Selektion, Scroll, Progress).

`input.handler` gehört **nicht** hierher: er schreibt Text in das Terminal,
als wäre er getippt, und leert es — Sitzungsarbeit. Vom Theme kennt die
Maschine nur, was `setOptions`
anwendet; die Werte liefert der Session-Host.

`input-writer.ts` gehört ebenfalls nicht hierher, obwohl sein Name danach klingt:
die Maschine schreibt Bytes (`pty.write`), er entscheidet *welche* — um aus
„git sta" ein „git status" zu machen, muss er wissen, was in der Eingabezeile
steht, wo der Cursor ist und ob die Shell „Zeile ersetzen" im
`COGNO:CAPS`-Handshake gemeldet hat. Alle drei sind Sitzungswissen; er liegt
mit den Editor-Aktionen in `core/session/editor/`.

**Session** ist die Bedeutung einer laufenden Sitzung: der Session-Host, der
eine Maschine besitzt und konfiguriert, das Sitzungsmodell (siehe unten), die
Interpretation der Sequenzen und alle sitzungsgebundenen Konsumenten —
Prompt-Dekoration, Editor-Aktionen, History, Recorder, Autocomplete, Composer,
Such-Engine, Links, Menüs, Snapshots. Alles darin lebt und stirbt mit der
Sitzung. Prüfkriterium: der Code braucht genau eine `sessionId` und wäre ohne
diese Sitzung sinnlos. Aufbau von `core/session/`: `host/` (der Session-Host,
`session-host.ts`), `model/` (das Sitzungsmodell mit Kommandos, cwd,
Capabilities, Eingabezeile und Shell-Kontext), `editor/` (u. a.
`input-writer.ts`), die Handler in `handlers/` (`input`, `terminal-padding`,
`terminal-title`, `terminal-notification`, `full-screen-app`¹, `link`,
`resume-link`, `clipboard`, `terminal-search`), die sitzungsgebundenen
Konsumenten (`autocomplete/`, `composer/`, `decoration/`, `history/`,
`recorder/`, `dropdown/`, `exec/`) und die Shell-Integration als `shells/`
(Shell-Definitionen, Support, Pfadadapter, Line-Editor-Wissen,
Integrationsskripte, CAPS-Handshake, `COGNO_*`-Env) — sie stellt den Kontext
einer Sitzung her und ist Core (Entscheidung 2): ohne sie gibt es keinen
Sitzungskontext, auf dem die übrigen Konsumenten aufbauen. Sie hat weder
`mode` noch eigene UI oder Settings und ist deshalb kein Feature;
`FeatureDefinition` hat keinen Contribution-Punkt `shells?`, und es gibt
keinen Shell-Typ ohne Definition.
¹ Alt-Screen-*Erkennung* ist Maschine (Buffer-Typ), die *Reaktion* ist Session.

Drei Entscheidungen an dieser Grenze:

1. Terminal-Zustand ist geteilt in Maschinenzustand
   (`core/terminal/machine-state.ts`) und Sitzungsmodell
   (`core/session/model/session-model.ts`).
2. Die Maschine importiert keine Config. Sie bekommt Optionen als Werte, und
   der Session-Host liest sie aus der Config und schiebt sie bei Hot-Reload
   nach. Dasselbe in Gegenrichtung: die Maschine loggt und meldet nicht
   selbst, sondern veröffentlicht Fehler und Diagnosen als Ereignisse; der
   Host reicht sie an den Reporter weiter.
3. Fokus meldet die Maschine, die Workbench entscheidet. `focus.handler`
   meldet DOM-Fokus an den Session-Host, der ihn als Fakt veröffentlicht, und
   die Workbench setzt daraus den aktiven Pane.

**Das Sitzungsmodell ist veränderlich.** Eine Sitzung startet mit einem
Shell-Kontext (OS × Shell × WSL-Distro), aber der Kontext kann sich während der
Laufzeit ändern: `ssh` in einen Linux-Host, `wsl` aus der PowerShell, `bash`
aus `cmd`, `su`, ein Container. Ab da gelten Pfadinterpretation, Shell-
Definition, Capabilities, verfügbare Editor-Aktionen und die Zuordnung im
Recorder (Kontext-Spalte der History) nicht mehr. Ein einmal beim Start aus
dem Profil abgeleiteter Kontext reicht deshalb nicht.

Das Sitzungsmodell führt eine **Kontext-Zeitachse**. Ein Kontext hat
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
Wechsel funktioniert ohne Zutun. Rein informative Sequenzen (OSC 0/2 Titel,
OSC 9 Nachricht, 9;4 Fortschritt) bleiben ohne Token — sie ändern kein
Modell, nur Anzeige.

**Der lokale HTTP-Server ist ebenso geschützt.** Über ihn melden
Coding-Agent-Hooks ihren Status und löst `cogno action run` Aktionen aus.
Rust erzeugt je Start ein Geheimnis `COGNO_TOKEN` und gibt es jeder Shell mit
(neben `COGNO_PORT`); jede Anfrage muss es im Header `X-Cogno-Token` tragen
und die Loopback-Adresse (`127.0.0.1:<port>`, `localhost:<port>`) als Host
nennen. So erreicht den Server nur, was in einem Cogno-Terminal gestartet
wurde — kein anderer lokaler Prozess und keine Webseite, die ihren Namen per
DNS-Rebinding auf 127.0.0.1 umbiegt.

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
(„welches Pane ist aktiv") ist Workbench-Zustand. Ordner in `core/workbench/`
u. a.: `tab-list/`, `grid-list/`, `terminal/` (Einhängen der Session-Hosts,
`TerminalSessionRegistry`), `workspace/`, `side-menu/` (Rail, Panel,
`ui-state`), `window/`, `app-buttons/`, `header/`, `app-menu/`,
`native-menu/`, `notification/`, `actions/`, `keybindings/`, `external/`
(CLI/HTTP), `bus/`, `feature-host/` und `api-adapters/`.

`command-log/` hängt in `core/` nur von `infrastructure/` ab (DB-Bridge);
`session/` und `workbench/` dürfen es importieren.

**Zwischen Session und Workbench gibt es genau eine Richtung: `workbench →
session`.** Die Workbench hält die Session-Hosts
(`TerminalSessionRegistry`), hängt sie ein und aus, und liest ihr Modell. Die
Session importiert nichts aus der Workbench und weiß nicht, ob sie in einem
Tab, einem Pane oder gar nicht angezeigt wird.

Informationen fließen trotzdem nach oben — als **Fakten über das Modell**, nie
als Befehle an die Workbench. Die Session veröffentlicht auf ihrem Modell bzw.
ihrem Lebenszyklus: cwd geändert, Titel geändert oder gelöscht (OSC 0/2), Kommando
begonnen/beendet mit Dauer und Exit-Code, Shell-Kontext gewechselt,
OSC-9-Nachricht empfangen, Fortschritt (OSC 9;4), Prozess beendet. Die
Workbench abonniert das und entscheidet selbst: Tab-Titel und Busy-Indikator
aktualisieren, bei Prozessende Pane und — wenn es das letzte Pane war — Tab
entfernen. Auch Benachrichtigungen entstehen so: die Session meldet „Kommando
endete nach 90 s" oder „OSC 9 kam", der Notification-Dispatch der Workbench
entscheidet Schwelle, Kanal und Unread-Badge (für lange Kommandos
`completed-command-notification.handler` in `core/workbench/terminal/`).
Das Ungelesen-Abzeichen setzt die Workbench; es liegt aber im
Sitzungsmodell, weil die Session es selbst löscht — bei Eingabe und bei
Fokus — und es mit ihr stirbt. Welches Pane maximiert ist, ist dagegen
reiner Workbench-Zustand und liegt im `GridListService`.
PTY-Exit meldet die Session als Fakt `exited` (siehe 2.3), nicht als Befehl
`RemovePane` an das Layout. Die Session kennt keinen Bus: sie veröffentlicht
ihre Fakten auf `facts$` (`SessionHost`, `SessionModel`), ausschließlich als
Ereignisse in Vergangenheitsform; Aktionsnamen der Workbench (`RemovePane`,
`CloseTab`, `FocusPane` …) kommen darin nicht vor — prüfbar per Typregel.
Die Workbench liest sie über die Session-Registry.

Der App-Bus der Workbench (`core/workbench/bus/`) ist **ein Strom, abonniert
nach Nachrichtentyp**
(`on$(type)`, `once$(type)`, `publish`): jeder Abonnent eines Typs bekommt
eine Nachricht genau einmal, synchron, in Abo-Reihenfolge. Pfade und
Capture-/Target-/Bubble-Phasen gibt es nicht — niemand hat sie genutzt, und
sie ließen einen Abonnenten oberhalb des Zielpfads dieselbe Nachricht zweimal
bekommen. Der Bus verbindet Teile, die **weit voneinander entfernt** liegen:
Sender und Empfänger kennen sich nicht und importieren sich nicht
(`ActionFired`, `FocusTerminal`, `TerminalRemoved`, `Notification`). Das
verhindert, dass jeder jeden importiert. Liegen zwei Teile nah beieinander —
im selben Bereich, einer besitzt den anderen —, ruft der eine den anderen
direkt auf; der Bus wäre dort ein Umweg.

Die Grenze bleibt damit per Pfadregel prüfbar: `session/` importiert
`workbench/` nicht.

Warum die Richtung so herum: **der Besitzer kennt das Besessene, nie
umgekehrt.** Die Workbench erzeugt Sessions (Tab öffnen, Split), hängt sie
ein und aus, schließt sie und liest ihr Modell für Titel, Busy und Badge —
das geht nicht ohne die Host-Schnittstelle. Die Session dagegen muss ohne
Workbench sinnvoll sein: im Test, beim Restore in einem unsichtbaren Tab, in
einem künftigen Headless-Betrieb über CLI/HTTP. Dieselbe Richtung gilt eine
Ebene tiefer: der Session-Host besitzt die Maschine und importiert sie, die
Maschine weiß nichts von der Session.

```
features/            Git, Coding-Agents, Palette, …
    │  benutzen Ports, erfüllen Contributions
    ▼
core/api/            nur Verträge: SessionApi, TerminalMonitor, TerminalNavigator,
    ▲                TerminalPlacement, Ports (Config, Actions, Dateisystem, …), contributions/
    │  implementieren Ports, lesen Contributions
    ├────────  core/workbench/   Fokus, Layout-Identität, Reveal, Feature-Host, api-adapters/
    │                 │  besitzt
    │                 ▼
    ├────────  core/session/     Host, Modell, sitzungsgebundene Konsumenten
    │                 │  besitzt
    │                 ▼
    │           core/terminal/    die Maschine (kennt die API nicht)
    └────────  core/infrastructure/, core/command-log/
```

`core/api/` liegt damit **unter** den übrigen Core-Schichten, nicht über
ihnen: Verträge hängen von nichts ab, die Implementierungen hängen von den
Verträgen ab. Deshalb kann jede Core-Schicht einen Vertrag benutzen oder
implementieren, den auch Features brauchen — ohne dass er nach `shared/`
ausweichen muss. `bootstrap/` bindet jeden Port an seine Implementierung.

Die Importmatrix, mit Dependency Cruiser erzwungen (Zeile darf Spalte
importieren):

| von ↓ | `shared` | `platform` | `core/api` | `core/infrastructure` | `core/terminal` | `core/command-log` | `core/session` | `core/workbench` | `features` |
|---|---|---|---|---|---|---|---|---|---|
| `shared` | – | | | | | | | | |
| `platform` | ✔ | – | | | | | | | |
| `core/api` | ✔ | ✔ | – | | | | | | |
| `core/infrastructure` | ✔ | ✔ | ✔ | – | | | | | |
| `core/terminal` | ✔ | ✔ | | | – | | | | |
| `core/command-log` | ✔ | ✔ | ✔ | ✔ | | – | | | |
| `core/session` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | | |
| `core/workbench` | ✔ | ✔ | ✔ | ✔ | | ✔ | ✔ | – | |
| `features` | ✔ | ✔ | ✔ | | | | | | nur über `index.ts` |
| `bootstrap` | alles | | | | | | | | |

**Die Matrix als Dependency-Cruiser-Regeln** (`.dependency-cruiser.cjs`,
`pnpm lint:architecture`). Sinngemäß, Pfade unter `src/`:

```js
// Fundament
{ name: "tauri-only-in-platform", from: { pathNot: "^platform/" },
  to: { path: "^@tauri-apps/" } },
{ name: "shared-imports-nothing", from: { path: "^shared/" },
  to: { path: "^(platform|core|features|bootstrap)/" } },
{ name: "shared-domain-framework-free",
  from: { path: "^shared/(domain|support)/" }, to: { path: "^(@angular/|rxjs)" } },
{ name: "shared-domain-knows-no-ui",
  from: { path: "^shared/(domain|support)/" }, to: { path: "^shared/ui/" } },
{ name: "platform-imports-only-shared", from: { path: "^platform/" },
  to: { path: "^(core|features|bootstrap)/" } },

// core, von unten nach oben
{ name: "api-is-contracts-only", from: { path: "^core/api/" },
  to: { path: "^core/(?!api/)|^features/|^bootstrap/" } },
{ name: "infrastructure-knows-no-product-layer",
  from: { path: "^core/infrastructure/" },
  to: { path: "^core/(terminal|command-log|session|workbench)/|^features/|^bootstrap/" } },
{ name: "terminal-is-the-machine", from: { path: "^core/terminal/" },
  to: { path: "^core/(?!terminal/)|^features/|^bootstrap/" } },
{ name: "command-log-uses-only-infrastructure",
  from: { path: "^core/command-log/" },
  to: { path: "^core/(terminal|session|workbench)/|^features/|^bootstrap/" } },
{ name: "session-knows-no-workbench", from: { path: "^core/session/" },
  to: { path: "^core/workbench/|^features/|^bootstrap/" } },
{ name: "workbench-knows-no-machine", from: { path: "^core/workbench/" },
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

// Überall
{ name: "no-circular", from: { path: "^src/" }, to: { circular: true } },
```

`no-circular` zählt auch reine Typ-Importe: Specs laufen mit
`emitDecoratorMetadata`, dort werden Konstruktor-Typen beim Laden einer
Klasse ausgewertet, und ein Kreis kann eine Injektion `undefined` machen.

Zwei Regeln lassen sich nicht als Import ausdrücken und bekommen einen
eigenen Test:

- **Fakten, keine Befehle:** Nachrichtentypen, die aus `core/session/`
  publiziert werden, sind in einer Union `SessionFact` deklariert; ein
  Typtest stellt sicher, dass `SessionFact` und `WorkbenchAction` disjunkt
  sind und `session/` nur `SessionFact` publiziert.
- **Ein Fenster kennt kein anderes:** kein Modul außer `platform/` ruft
  `emit_to`/Fenster-Labels — als `to: { path: "^@tauri-apps/api/event" }`
  ohnehin durch Regel 1 abgedeckt.

Daraus folgen die Regeln, die man sich merken muss:

- Nur `platform/` importiert Tauri. `shared/` importiert nichts Internes und
  kennt keine Fremdtechnik; es enthält keine Verträge zwischen Core und
  Features.
- `core/api/` enthält nur Verträge und importiert nichts aus `core/`. Jede
  Core-Schicht außer `terminal/` darf sie benutzen und implementieren.
- `core/terminal/` importiert nichts anderes aus `core/` — auch nicht
  `infrastructure/` oder `api/` (Grenz-Entscheidung 2 unten).
- `core/session/` importiert `workbench/` nicht; `workbench/` darf
  `session/` importieren (Host-Schnittstelle, Modell). Nachrichten aus
  `session/` sind Fakten (Vergangenheitsform), nie Workbench-Aktionen.
- Adapter, die `session/` und `workbench/` zusammensetzen, liegen in
  `core/workbench/api-adapters/`. Ein Port, dessen Implementierung einer
  tieferen Schicht gehört, wird dort implementiert (`CommandRunner` in
  `session/`, `ApplicationConfigurationPort` in `infrastructure/`).
- `core/api/` ist der einzige Ort in `core/`, den Features importieren.
  Features kennen `shared/`, `platform/` und `core/api/` — sonst nichts
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
| Feature | Git, Prozess-Info, Such-Panel | Coding-Agents, Notification-Übersicht, Palette, Statistik (künftig) |

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
  einer WSL-Distro über `wsl.exe -d`), nie eine Eingabe in die PTY. In
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
Braucht ein zweites Feature morgen den Git-Branch, wird der Branch Sitzungsfakt —
nicht ein Import des Git-Features.

`platform/` zu benutzen vermischt nichts: es ist generischer OS-Zugriff ohne
Produktwissen, keine Core-Schicht. Vermischung entstünde nur, wenn Features
`terminal/` oder Session-Interna anfassen — und das bleibt verboten. Für
Tests sind Plattformdienste injectable Klassen mit Stub-Providern.

Konkret: Prozess-Info ist ein **Panel in der Seitenleiste** — ein
sitzungsgebundenes Feature wie Git, das `boundSession$` folgt und den
Prozessbaum daraus liest. Einen Dialog im Kontextmenü und einen Menüeintrag
„Process Info" gibt es nicht; der Baum ist kein Modell-Fakt, sondern wird über `boundSession.processTree()` bei
jedem Aufruf frisch ermittelt. Git bleibt eine vollständige
Scheibe — Ermittlung über `boundSession.run({ executable: "git", args: ["status", "--porcelain"], contextRevision })`, Tabellen, UI,
Settings — und
`mode: off` heißt: alles weg. Coding-Agents bleiben ein Ganzes, inklusive
Hook-Installation und Statusempfang.

**Achse 2 — Lebensdauer.** Sitzungsgebundene Teile in `core/session/` leben und
sterben mit der Session. Ein eigenständiger Session-Host besitzt ihre
Component-Provider; Pane-, Tab- und Workspace-Views hängen diesen Host nur ein
oder aus; das ist `core/session/host/session-host.ts`.
Sitzungsgebundene *Features* leben dagegen app-weit in einem Panel und sind
an eine Sitzung **gebunden**. Deshalb heißt das Feld `target`, nicht `scope`: es sagt, *worauf* ein Feature zeigt
(`"session"` oder `"workbench"`), nicht, wie lange es lebt. Die Lebensdauer
eines Features ist immer die der Anwendung (pro Fenster, 2.6); was mit
einer Sitzung lebt und stirbt, ist per Definition Core. Ein zweites Feld
`lifetime` hätte nur einen Wert und gibt es deshalb nicht.

Diese Unterscheidung erklärt drei Dinge, die sonst wie Probleme aussehen: warum
History/Autocomplete/Composer Component-Provider sind (korrekt, nicht kaputt),
warum das Git-Panel an eine Sitzung *gebunden* ist statt in ihr zu leben
(app-weites Panel über eine Sitzung), und warum das Protokoll eine Abfrageseite
braucht (ebendafür).

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
Modell beruht — sind headless verfügbar. (Belegt durch
`core/session/session-headless.spec.ts`, der einen unopened `Terminal` mit
`COGNO:PROMPT`-Sequenzen füttert und das Kommandozeilen-Modell daraus liest.)

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
`renderer.ts` tut das nach Sichtbarkeit) — der Core und
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

Beim Laden oder Wiederherstellen eines Workspaces werden die zugehörigen
Sessions sofort gestartet (`running`), auch in nicht sichtbaren Tabs und
Panes — sie sind `detached`, nicht Platzhalter: die Shell läuft, Kommandos
werden erfasst, der Tab-Titel aktualisiert sich. Sichtbar werden nur die
Panes des aktiven Tabs `attached`. Das begrenzt zugleich die
WebGL-Kontexte auf die sichtbaren Panes.

Eine Ausnahme: Eine wiederhergestellte Session **mit gespeichertem
Scrollback** startet ihre Shell erst, wenn ihr Pane zum ersten Mal
angezeigt wird. Der Scrollback muss in ein geöffnetes Terminal in seiner
endgültigen Größe geschrieben werden, bevor die Shell zeichnet — sonst malt
sie (ConPTY besonders) über ihn, statt unter ihm zu beginnen. Bis dahin
bleibt der Snapshot die Beschreibung der Session: Speichern liefert ihn
unverändert zurück, nicht den noch leeren Puffer.

### 2.4 Kommandodaten (`core/command-log/`): Recorder, Abfrage, Sichten

Erfassung und Nutzung sind getrennt (Entscheidung 6), und kein Konsument
setzt eigene SELECTs ab. Drei Rollen, drei Orte:

1. **Recorder** (`core/session/`, sitzungsgebunden). Abonniert das
   Sitzungsmodell (Kommando-Beginn/-Ende, Exit-Code, cwd, Shell-Kontext) und
   ruft die Schreib-API. Er kennt keinen Konsumenten und liest nie. Er ist die
   einzige Stelle, die aus Shell-Ereignissen Datensätze macht. Schreibt
   asynchron und darf die Sitzung nicht bremsen.
2. **Kommandodaten** (`core/command-log/`, übergreifend). Besitzt die Tabellen
   `command*`, `command_log`, `command_stat`, `command_transition_stat`,
   `command_pattern*`, `path`, `dir_stat`, `shell_context`, `command_fts` und
   ihre Migrationen. Zwei API-Seiten:
   - **Schreiben** (`CommandLogWriter`): `upsertCommandExecution`,
     `upsertWorkingDirectory`, `upsertCommandTransition`, Import
     (`bulkImportCommands`), Löschen — plus die **Feedback-Schreiber**
     `markCommandSelected`, `markDirectorySelected`, `confirmLivePattern`,
     `markCommandPatternSelected`. Feedback ist auch Erfassung (Nutzerverhalten
     statt Shell-Ereignis), nur ein anderer Absender.
   - **Lesen** (`CommandLogReader`): `searchCommands`, `getRecentCommands`, `searchDirectories`,
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
   dort liegt) — „gemeinsamer Fachbereich" heißt gemeinsame Daten, nicht
   gemeinsamer Lebenszyklus.

Der Recorder liegt in `core/session/recorder/`, die Abfrage-API in
`core/command-log/command-log.api.ts` (sitzungsgebunden erreichbar über
`core/session/command-log/`). Die
Rückkehrcode-Regel ist Recorder-Konfiguration und kommt aus der Config:
`terminal.history.allowed_return_codes` (leer = kein Filter, der
Auslieferungszustand; `[0]` = nur erfolgreiche Kommandos) und
`allowed_return_codes_by_command.<kommando>` als Ausnahme je erstem Wort
(`grep = [0,1]`, weil Exit 1 dort „nichts gefunden" heißt). Sie greift erst
nach der ersten Hürde: ein Kommando, das die Shell nicht gefunden hat
(`commandExists`), wird nie gespeichert, ein Tippfehler im Namen also auch bei
leerer Liste nicht. Der Recorder liest die Config bei jeder Entscheidung, ein
Reload wirkt sofort.
Der Degradationspfad „DB fehlt" liegt einmal in `command-log/`; jede Sicht sieht
dann eine leere, aber gültige Datenquelle.

**Backpressure und Health.** „DB fehlt → leere gültige Datenquelle" ist der
einfache Fall. Die anderen beiden — DB langsam, DB kaputt nach dem Start —
brauchen Regeln, die aus Abschnitt 4 folgen:

- **Begrenzte Queue** je Session (`SessionCommandLog`, 256 Einträge). Der
  Recorder schreibt asynchron; ist die Queue voll, gilt die
  **Überlaufregel „ältestes verwerfen"** — das jüngste Kommando ist für
  History und Autocomplete das wertvollste, und die Sitzung wird unter
  keinen Umständen gebremst. Jeder Verlust wird gezählt
  (`CommandLogHealthTracker`, `command-log/command-log.health.ts`).
- **Schreibfehler:** ein fehlgeschlagener Schreibvorgang wird einmal
  wiederholt; schlägt er erneut fehl, zählt er als verloren und wird mit
  der Zahl der bisherigen Verluste an den Error-Reporter gemeldet — die
  Benachrichtigung kommt einmal, bis wieder ein Schreiben gelingt. Nach
  drei Fehlern in Folge wartet der Log mit wachsendem Abstand; ein Erfolg
  setzt das zurück — Degradation ist reversibel.
- **Atomare Statistik:** `command_stat`, `dir_stat`,
  `command_transition_stat` werden ausschließlich mit
  `INSERT … ON CONFLICT DO UPDATE SET count = count + 1`-Anweisungen
  fortgeschrieben, nie mit Lesen-Rechnen-Schreiben in TypeScript. Mehrere
  Fenster (2.6) und mehrere Sessions schreiben so ohne Lost Updates; ein
  Batch ist eine Transaktion, SQLite serialisiert Schreiber im WAL-Modus.
  Pattern-Mining, das nicht als Einzelanweisung geht, läuft als
  Hintergrundjob über das Log, nicht im Schreibpfad.
- **Lesefehler:** Schlägt eine Abfrage fehl, liefert die Lese-API leer —
  wie ohne Log — und meldet den Fehler einmal je Fehlerserie, nicht bei
  jedem Tastendruck. Ein langsamer Suggestor blockiert das Panel nicht: das
  Timeout je Suggestor im Autocomplete macht ihn für diesen Durchlauf
  `rejected`.



### 2.5 Sitzungs-Wiederherstellung

Ziel: nach einem Neustart stehen offene Workspaces, Tabs, Panes und die
Sitzungen wieder da. Die Matrix legt die Rollen fest: `workbench → session`
ist erlaubt, also lebt der **Serializer in der Workbench** und fragt jede
Session nach ihrem Anteil. Zuerst aber die Ehrlichkeit, was „wieder da"
heißen kann — nach einem Neustart existieren PTY, SSH-Verbindung und
laufendes Kommando **nicht mehr**. Drei Dinge sind zu unterscheiden:

| | Was | Wird… |
|---|---|---|
| **Neue Shell-Runtime** | Profil, Start-cwd, Titel-Override | neu gestartet — ein frischer Prozess mit frischer Umgebung, frischem Token, neuem Handshake |
| **Wiederhergestellte Darstellung** | Scrollback als Text | eingespielt, sichtbar als Vergangenheit |
| **Nicht wiederherstellbarer alter Prozess** | Kontext-Zeitachse, Capabilities, unterbrochenes Kommando, Umgebung | **nicht** wiederhergestellt; das unterbrochene Kommando steht als abgebrochen im Command-Log |

Die neue Shell-Runtime startet aus dem Pane-Layout der Workbench (Profil,
Start-cwd, Titel-Override). Einen Remote-Kontext der beendeten Sitzung stellt sie nie
wieder her — den aktuellen Kontext bestimmt allein der neue Handshake (2.1).

Der `SessionSnapshot` (`session/host/session-snapshot.ts`, von der
Workbench gespeichert, nicht interpretiert) trägt nur die Darstellung:

- **`scrollback`** — der Puffer als Text mit SGR-Farben, serialisiert von
  `scrollback-serializer.ts` (nicht vom SerializeAddon: dessen
  Cursor-Restore-Schluss hat die Live-Sitzung beim Abspielen beschädigt), ohne
  Alt-Screen-Inhalt, auf `terminal.restore.max_lines` (Default 1000) begrenzt;
  entfällt bei `terminal.restore.scrollback = off` (Config, global) oder wenn
  das Terminal per Aktion `exclude_from_restore` ausgenommen ist. Die
  verdeckten Marker-Zeilen (`^^#<id>`) bleiben erhalten — ihre ids in einen
  Bereich verschoben, den die neue Sitzung nie vergibt — und werden samt den
  Kommando-Metadaten nach dem Abspielen neu verankert, damit die
  Prompt-Dekoration der alten Kommandos wieder erscheint. Nach dem Restore
  steht er als **Vergangenheit** im Buffer, durch eine Trennlinie (eine
  Dekoration auf einer verdeckten Sentinel-Zeile, die beim nächsten Aufnehmen
  wieder herausfällt) vom neuen Prompt getrennt.
  **Der wartende Prompt, auf dem die Sitzung geschlossen wurde, gehört nicht
  dazu:** er ist eine Leerzeile, die Marker-Zeile und eine leere Eingabezeile,
  und die neue Sitzung druckt ihren eigenen — abgespielt stünde der alte als
  zweiter, toter Prompt darüber. Er wird beim Aufnehmen abgeschnitten, samt
  seinen Kommando-Metadaten, und ebenso beim Abspielen (für Snapshots, die ihn
  noch enthalten). Steht hinter dem letzten Marker etwas — getippte Eingabe,
  die Ausgabe eines laufenden Kommandos —, ist das Verlauf und bleibt.
- **`commands`** — die Metadaten jedes Prompts (Verzeichnis, Rechner,
  Nutzer), damit die Prompt-Dekoration der alten Kommandos wieder erscheint.
- **Nicht enthalten:** die Kontext-Zeitachse der beendeten Sitzung — bewusst, es gibt
  keinen Leser dafür. Ein Kommando, das beim Beenden noch lief, trägt die
  Session schon beim Beenden als **abgebrochen** ins Command-Log ein; nichts
  wird erneut gestartet. Ebenso nicht: die Umgebung (Rust baut sie beim Spawn neu, inklusive
  neuem `COGNO_SESSION_TOKEN`), Capabilities (kommen vom neuen Handshake),
  laufende Bindungen, Cursorposition, Eingabezeile.

**Vertraulichkeit.** Scrollback kann Passwörter, Tokens und vertrauliche
Ausgaben enthalten. Das Command-Log speichert bereits Kommandozeilen,
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
Workspace-Wechsel (der verlassene), Beenden (alle offenen, mit Zeitbudget;
was nicht rechtzeitig serialisiert ist, wird ohne Scrollback gespeichert).
Welche Workspaces offen sind und welcher aktiv, steht an der
`workspace`-Zeile (`is_open`, `is_active`) und wird bei jedem Aktivieren
und Schließen in einem Statement nachgeführt. Wiederherstellen: jeder
Workspace, der offen war, bekommt seine Laufzeit zurück — der aktive
sichtbar, die anderen im Hintergrund —, je Pane ein Host mit
`restore(snapshot)`: Scrollback in den Core schreiben, Trennzeile, dann PTY
starten — beim ersten Anzeigen des Panes (2.3). Die Session ist passiv: sie kann sich
beschreiben und aus einer Beschreibung entstehen, speichert nichts selbst
und kennt keine Tabelle.

`terminal_session` gehört der Workbench (Workspace-Modul,
`workspace.repository.ts`). Der Snapshot ist darin eine Spalte, deren
Inhalt `session/` bestimmt und versioniert; alte Versionen werden gelesen,
unlesbare als „Darstellung nicht wiederherstellbar" behandelt — die Shell
startet trotzdem. Die Tabellen-Migration bleibt bei der Workbench.

**Eine Terminal-ID, eine Sitzung, ein Pane.** Sessions, Snapshots,
Notifications und Aktionen sind über die nackte Terminal-ID gekeyt, nicht
über `(workspace, terminal)`. Die ID ist deshalb global eindeutig, und drei
Stellen halten das:

- **Schreiben.** Ein Workspace persistiert nur seine eigene Laufzeit. Ein
  neuer Workspace entsteht als *Kopie* des Layouts des aktiven (Tabs, Splits,
  Verzeichnisse) mit frischen Tab-IDs und **ohne** Terminal-IDs — beim
  Aktivieren öffnet er neue Shells; der aktive behält seine Sitzungen. Eine
  Laufzeit wird nie verschoben.
- **Speichern.** `terminal_session` hat `terminal_id` als Primärschlüssel
  (Migration 003): ein Snapshot unter zwei Workspaces scheitert laut statt
  still das falsche Terminal wiederherzustellen.
- **Auslegen.** `GridListService` ist die einzige Stelle, die Terminal-IDs in
  Panes setzt. Beim Wiederherstellen eines Layouts bekommt ein Pane, dessen
  persistierte ID in irgendeinem Workspace schon ausgelegt ist, eine neue ID
  und einen `console.error` — Daten aus älteren Versionen heilt der Start
  außerdem einmalig (`repairDuplicateIds`: Tab- und Terminal-IDs, der
  verwaiste Snapshot wird verworfen).

### 2.6 Fenster

Ein Tauri-Fenster ist eine eigene Webview mit eigener Angular-Instanz. Zwei
Fenster teilen keinen JS-Zustand: jedes hat seine eigene Workbench, eigene
Session-Hosts, einen eigenen Feature-Host. Geteilt ist nur der Rust-Prozess —
und der ist fensterunabhängig: alle PTYs in einer Map
`terminalId → Session` (`pty.rs`), eine Datenbank, ein HTTP-Server.
Nachrichten an die Fenster routet `window_registry.rs` (Entscheidung 2),
statt sie per `app.emit` an *alle* Fenster zu senden.

Entscheidungen:

1. **Identität ist vierteilig:** `{windowId, workspaceId, tabId, sessionId}`.
   `windowId` ist das Tauri-Label. Alles, was ein Ziel adressiert
   (Notifications, `navigateToTerminal`, CLI/HTTP mit `terminalId`), trägt es.
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
   trägt das; geplant ist es nicht (Abschnitt 8).
4. **Ein Workspace ist in höchstens einem Fenster offen.** Öffnet man ihn
   aus einem anderen, fokussiert Rust das Fenster, das ihn hält
   (`workspaceId → windowId` in derselben Rust-Tabelle). Das Schließen
   eines Fensters schließt seine Sessions explizit (mit Busy-Guard)
   und gibt seine Workspaces frei.
5. **Feature-Host und Status sind pro Fenster.** `mode` ist global (Config),
   der Runtime-Status nicht — ein Feature kann in einem Fenster `failed`
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

Das Protokoll ist **die Schnittstelle zwischen Core und Features, in beide
Richtungen** — die Antwort auf die Frage, was ein Git-Panel oder ein
Coding-Agents-Panel von Cogno wissen und tun darf, und was ein Feature
beitragen kann. Es lebt in `core/api/`, dem einzigen Ordner in `core/`, den
Features importieren, und besteht **nur aus Verträgen**:

- **Ports** (Core → Feature): `SessionApi`, `TerminalMonitorPort`,
  `TerminalNavigator`, `TerminalPlacementPort`, `TerminalIpcPort`,
  `TerminalAnimationPort`, `TerminalSearchApi`, `NotificationCenterPort`,
  `NotificationChannelsPort`, `ApplicationConfigurationPort`,
  `ActionCatalog`/`ActionDispatcher`, `CommandRunner`.
- **Contributions** (Feature → Core, `core/api/contributions/`):
  `FeatureDefinition`, Side-Menu-Features, Feature-Settings,
  Datenbank-Migrationen, Notification-Kanäle.

Weil `core/api/` nichts aus `core/` importiert, liegt es unter den übrigen
Core-Schichten (Diagramm in 2.1): Core-intern darf jede Schicht außer der
Maschine einen Vertrag benutzen oder implementieren, den auch Features
brauchen. Wo ein Vertrag Session und Workbench zusammenführt — etwa
`boundSession$`, das „dem Fokus folgt": der Fokus ist Workbench-Wissen, das
Modell Session-Wissen —, liegt die Implementierung in
`core/workbench/api-adapters/`.

Was Features von der Sitzung bekommen, ist
`SessionApi` (`session-api.ts`): `boundSession$`, `cwdChanges$`, `hold()`,
`release()` — implementiert von `TerminalGatewayService`, der dafür Fokus
(Bus und Fakt `focusChanged`) und Session-Registry zusammenführt und in
`core/workbench/api-adapters/` liegt.

Das Protokoll ist zugleich die Stelle, an der Features klein gehalten werden:
Was nicht im Protokoll steht, kann ein Feature nicht tun.

Die Klassifikation formt es, statt Operationen aufzuzählen. Zwei Formen:

**Sitzungsgebundene Features** bekommen `boundSession$` — das Modell der gerade
gemeinten Sitzung: cwd, Shell-Kontext, Kommandos, Eingabezeile, Capabilities.
Damit schreiben Git und Prozess-Info **keine** eigene Fokus- und
cwd-Verdrahtung.

Die Bindung hat benannte Zustände (`unbound`, `active`, `closing`, `closed`).
Jede schreibende Operation prüft unmittelbar vor dem Schreiben erneut
Session-Identität und Capability. Damit kann eine verspätete asynchrone Antwort
nach einem Fokuswechsel nicht in das falsche Terminal schreiben.

**Übergreifende Features** bekommen `TerminalMonitorPort` (Aktivität, Ende und
cwd je Terminal, dazu `resolvePath` — ein Pfad, wie ein Programm im Terminal ihn
nennt, als Cogno-Pfad im Shell-Kontext dieses Terminals; Konsument: geänderte
Dateien auf den Coding-Agent-Karten), `TerminalNavigator.navigateToTerminal(id)` (Workspace,
Tab und Fokus auf ein Terminal bringen) und als dessen lesendes Gegenstück
`TerminalPlacementPort.getPlacement(id)` (Workspace und Tab eines Terminals
samt Anzeigereihenfolge, plus `changes$`; Konsument: Coding-Agents-Panel,
gruppiert nach Workspace in Tab-Reihenfolge). Ein Sitzungs-Verzeichnis
`sessions$` entsteht erst mit dem ersten Feature, das eines braucht.

Features schreiben nicht in die PTY; die API hat dafür keine Operation. Was
in die Eingabezeile schreibt — Autocomplete, History, Composer — ist Core
und nutzt den `InputWriter` der Session direkt. Braucht ein Feature das
einmal, kommt eine Operation mit Identitäts-Check wie bei `run` dazu.

Bindung: Standard „folgt dem Fokus", auf Wunsch **gehalten**. Das Wort *pin*
ist bereits für „Panel offen halten" belegt (`side-menu.service.ts`);
die Bindung heißt deshalb `hold`/`release` — „das Git-Panel hält Terminal 3".
Zustände: `following | held`, orthogonal zu `unbound/active/closing/closed`.

Weil `core/session/` **innen** bleibt, braucht das Protokoll seine
teuersten denkbaren Teile nicht: Overlay-Geometrie
(Cursorzelle, Zellmaße, Ausweichen vor der Seitenleiste), Dropdown-Arbitrierung
und ein `decorate(range, style)`, das die Prompt-Dekoration ohnehin nie hätte
tragen können.

Die **Gegenrichtung** sind die Contributions: Features tragen Panels,
Settings, Notification-Kanäle und Migrationen bei, indem sie
Verträge aus `core/api/contributions/` erfüllen; der Feature-Host in
`core/workbench/feature-host/` liest sie. Was dem Protokoll noch fehlt:
Block-Adressierung über `commandId` statt Puffer-Zeilennummern und
Layout-Identität (`{windowId, workspaceId, tabId, sessionId}`, 2.6) für das
Zielspringen von Notifications.

### 3.1 Ports und Schnittstellen

Für Ports und Schnittstellen gelten drei Regeln:

1. **Features haben keine eigenen Ports zum Produkt.** Was ein Feature vom
   Produkt braucht, steht in `core/api/`. Abstraktionen *innerhalb* eines
   Features (etwa die Provider-Schnittstelle der Coding-Agents) sind davon
   unberührt. Braucht ein Feature etwas, das dort fehlt,
   wird die API erweitert — mit dem Feature als erstem Konsumenten
   (Abschnitt 8: keine Operationen ohne Konsumenten).
2. **Quellen werden injiziert, Senken bleiben statisch.** Eine **Quelle**
   liefert etwas, wovon eine Entscheidung abhängt — `OsPlatform.platform()`,
   `Paths.homeDir()`, `Filesystem.readTextFile()`, `Clipboard.readText()`,
   `Database`, `PtyTransport`, `HttpServer`. Sie ist eine konkrete injectable
   Klasse, kein Port; Tests ersetzen sie durch einen Stub-Provider. Eine
   **Senke** nimmt entgegen und gibt nichts zurück, worauf jemand verzweigt —
   `Logger`, `ErrorReporter`. Sie bleibt ein statischer Zugriff, weil sie
   sonst durch jede Hilfsklasse gereicht werden müsste, die einmal etwas
   meldet.

   Der Grund für die Injektion ist nicht Geschmack: `vi.mock` gilt global je
   Testdatei und bricht, sobald sich der Modulgraph verschiebt — eine
   Sammel-Datei im Test-Setup kann Tests kippen, die mit ihr nichts zu tun
   haben. Konstruktor-Injektion kennt diesen Fehler nicht. Für Senken bleibt
   `vi.mock` erlaubt, weil niemand ihr Ergebnis auswertet.

   Ein Dienst, der Plattformaufruf und Sitzungskontext kombiniert
   (`CommandRunner`, `Filesystem` mit Pfadübersetzung nach aktuellem
   Shell-Kontext), ist in `core/session/` implementiert und erreicht
   Features als `boundSession.run`/`.fs`. Einen Vertrag in `core/api/` hat
   nur, was Features selbst benennen: `CommandRunner`; `Filesystem` liegt
   in `core/session/exec/`.
3. **Innerhalb von `core/` gibt es Schnittstellen nur an Besitzgrenzen:**
   die Maschine nach oben (`TerminalMachine`), der Session-Host nach oben
   (`SessionHost`, `SessionModel`, `SessionSnapshot`), die API nach außen.
   Alles andere sind konkrete Klassen. `bootstrap/` bindet die
   Contributions-Liste, die Plattform-Provider und jeden Port aus
   `core/api/` an seine Implementierung (`provide: Port, useExisting:
   Adapter`).

---

## 4. Robustheit

Vier prüfbare Anforderungen:

1. **Jede Naht hat einen benannten Fehlerzustand**, nicht nur ein `try/catch`.
2. **Jeder Degradationspfad hat einen Test.**
3. **Degradation ist sichtbar.** Still verlorene Fähigkeit ist schlimmer als ein
   Fehler.
4. **Keine Korruption der Eingabezeile.** Im Zweifel nichts tun statt raten.

Punkt 4 ist der kritischste Bereich überhaupt: das Kommandozeilen-Modell
rekonstruiert Text und Cursorposition aus dem xterm-Buffer. Liegt es falsch,
schreibt Cogno an die falsche Stelle in einer Zeile, die der Nutzer gleich
ausführt. Ein Absturz wäre harmloser. Dorthin gehört die meiste Testarbeit.

Punkt 3 hat ein Lehrbuch-Gegenbeispiel im Code: `clipboard.handler.ts`
meldet bei mehrzeiligem Paste `composerRequested` und kehrt zurück — der
Aufruf erreicht das `terminal.paste()` nie. Hört niemand zu, ist der mehrzeilige Paste **still weg**.

Fehlerisolation im Rendering geht **nicht** per `try/catch` um `ngComponentOutlet`:
`refreshView` wirft weiter *und* markiert Vorfahren erneut dirty (Dauerschleife),
`ApplicationRef.synchronizeOnce` hat keinen Guard pro View, `@defer`/`@error`
greift nur beim Nachladen. Einziger Weg: View detachen und `detectChanges()`
selbst in `try/catch` rufen.

### 4.1 Bestehende Degradationszustände

| Pfad | Zustand |
|---|---|
| History-DB fehlt | ✅ `session-command-log.ts` |
| Suggestor wirft/timeout | ✅ `terminal-autocomplete.service.ts` (Timeout, `rejected` je Suggestor) |
| Marker desynchronisiert | ✅ `validateRange` |
| Prompt-Dekoration aus | ✅ `disposeMarkers()`/`refreshMarkers()` — der Alt-Screen-Pfad macht das täglich |
| `suggestor.matches()` wirft | ✅ `suggestorMatches` in `terminal-autocomplete.service.ts` |
| Composer fehlt | ❌ Paste still verloren |
| Prompt-Renderer wirft beim DOM-Bau | ❌ |
| Kommandozeilen-Modell liegt falsch | ❌ kein Erkennungspfad |
| Gebundenes Terminal stirbt | ✅ Bindung meldet `closing`/`closed` (`bound-session.tracker.ts`) |
| Command-Log langsam oder Schreibfehler | ✅ begrenzte Queue, Verlustzähler, Backoff, einmalige Meldung (`session-command-log.ts`, `command-log.health.ts`) |
| Gefälschte `COGNO:*`-Sequenz aus Programmausgabe | ✅ `COGNO_SESSION_TOKEN`-Prüfung mit Zähler (`session-model.ts`) |
| Shell-Kontext wechselt (ssh/wsl/su) ohne Handshake | ✅ unbekannter Kontext in der Kontext-Zeitachse (`session-model.ts`) |

### 4.2 Testen

| Schicht | Wie |
|---|---|
| `shared/` | reine Unit-Tests, kein Framework (Regel: `shared/domain` und `shared/support` importieren weder Angular noch RxJS) |
| `platform/` | Rust-seitig getestet (Datenbank, PTY, Prozesse, Command-Runner, Layout-Parser); die TypeScript-Seite ist eine dünne `invoke`-Schicht — getestet ist dort nur, was eigene Logik hat (`fromTauriListener`: Abmelden vor der asynchronen Registrierung) |
| `core/terminal/` | Unit-Tests gegen xterm im Headless-Modus: Byte-Roundtrip, Resize, Flow-Control-Acks, Alt-Screen-Erkennung. Keine Tauri-Abhängigkeit — PTY als Stub |
| `core/session/` | der Schwerpunkt: Kommandozeilen-Modell und OSC-Interpretation gegen aufgezeichnete Byteströme (bash, zsh, pwsh, mit und ohne Integration, mit Kontextwechsel). Jeder Degradationspfad aus der Tabelle oben ist ein Test. Regel 4.4: ein Test, der zeigt, dass bei Unsicherheit *nichts* geschrieben wird |
| `core/workbench/` | Layoutbaum und Serializer als reine Logik; Feature-Host mit Fake-Features (aktivieren, deaktivieren, fehlschlagen); Terminal-Aktionen Ende-zu-Ende (`ActionFired` → Wirkung, durch den echten Bus, `ActionHandlers` und `GridListService`); Drag-Verhalten von Tabs, Workspaces und Panes über echte `window`-Events |
| `core/api/` | Bindungszustände und Schreibschutz: verspätete Antwort nach Fokuswechsel darf nicht schreiben |
| `features/` | gegen eine gestubbte API und Stub-Plattformdienste; ein Deaktivierungstest je Feature |
| `bootstrap/` | ein Start-Test: Deklarationsphase über das Manifest — keine doppelten Feature- oder Aktions-IDs, keine Zyklen in `requires`, keine kollidierenden Settings-Pfade, keine Aktion ohne Handler |

Konstruktor-Injektion überall außer `bootstrap/`, damit Tests ohne
Angular-`TestBed` auskommen, wo es geht. `vi.mock` auf eine Quelle ist ein Geruch — sie gehört injiziert (3.1);
für Senken (`Logger`, `ErrorReporter`) bleibt er erlaubt.

**Umbauen heißt: erst festhalten, dann ändern.** Vor einem Umbau ohne
Verhaltensänderung stehen Tests, die das Verhalten von außen festschreiben —
über die Einstiegspunkte, die der Umbau nicht anfasst (die Methoden, die ein
Template ruft; `ActionFired`; die öffentliche Oberfläche eines Service), nie
über den Weg dorthin (welche Nachricht publiziert wird, welcher Reducer läuft).
Sie laufen grün gegen den alten Code und mit unveränderten Assertions gegen den
neuen. Ob sie etwas taugen, zeigt eine Mutationsprobe: ein absichtlich
eingebauter Defekt muss mindestens einen Test rot machen — sonst fehlt genau
dieser Test. Seltsames, aber bestehendes Verhalten wird mit festgehalten und
benannt, nicht stillschweigend „mitkorrigiert"; ein echter Fehler wird danach
als eigener Schritt behoben.

Die Specs laufen JIT ohne den Angular-Compiler: Komponenten werden mit `new`
in `TestBed.runInInjectionContext` gebaut; ein Signal-Input wird über seinen
Signal-Knoten gesetzt, weil `fixture.setInput` dafür nicht greift.

---

## 5. Der Aktionskatalog

Aktionen sind die gemeinsame Sprache: ausgelöst per Keybinding,
Menü, Palette, CLI und HTTP. Eine Aktion wird an vielen Orten gebraucht —
Handler, Menü-Labels, Palette, CLI (`cli.rs`), Default-Konfiguration je OS,
Doku —, und jeder Ort, der sie selbst aufschreibt, kann für sich abdriften.

**Eine Definition, alles andere abgeleitet.** Eine Core-Aktion steht genau
einmal, in `core/workbench/actions/catalog.ts`:

```ts
defineAction({
  name: "new_tab",
  label: "New Tab",
  description: "Open a new terminal tab",
  defaultKeys: {
    default: [{ combo: "Ctrl+T", always: true }],   // Windows und Linux
    macos: [{ combo: "Command+T", always: true }],  // nur wo es abweicht
  },
}),
```

`name` ist der Bezeichner überall (Config, CLI, HTTP, Handler), `label` der
Anzeigename, `description` der Text für `cogno action list` und die Doku.
`defaultKeys` trägt je Keybinding die Flags `always` (feuert auch bei
fokussiertem Terminal) und `performable` (verbraucht die Taste nur, wenn die
Aktion etwas getan hat); `default` gilt für Windows und Linux, `macos`
überschreibt nur die Abweichung. Eine Aktion ohne `defaultKeys` ist zulässig.
Ob eine Aktion ein Zielterminal braucht, steht nicht in der Definition,
sondern im Handler (siehe unten).

Zwei Quellen, ein Katalog:

- **Core-Aktionen** definiert die Workbench mit `defineAction` in
  `core/workbench/actions/catalog.ts`. `CoreActionName` ist die Union ihrer
  `name`-Literale.
- **Feature-Aktionen** deklariert jedes Feature als Namen — in
  `FeatureDefinition.actions` (`{ actionName }`) oder als `actionName` seiner
  `sideMenu`-Contribution, der Aktion, die sein Panel öffnet. Ihre Beschreibung leitet der Codegen aus dem
  Panel-Titel ab, ihre Default-Keybindings stehen in `featureKeybinds`
  (`default-config-values.ts`), weil ein Feature keine Tasten besitzt, solange
  es aus ist.

`defineAction` und der Typ liegen in `shared/`, weil Features ihn brauchen.
Der Katalog in der Workbench hat zwei Mengen, nicht eine:

- **`known`** — alle Definitionen, Core und Feature, registriert in der
  Deklarationsphase des Feature-Hosts (6.1) unabhängig vom Modus. Daraus
  kommen der Typ `ActionName`, der Codegen, die Config-Validierung der
  `keybind`-Zeilen und die Antwort „unbekannt".
- **`active`** — die Teilmenge mit registriertem Handler: Core-Aktionen
  immer, Feature-Aktionen nur, solange das Feature aktiv ist. Nur `active`
  bewirkt etwas. Die Palette listet `known` (eine Aktion eines ausgeschalteten
  Features steht dort und tut nichts); das native Menü zeigt die Einträge
  ausgeschalteter Features deaktiviert.

Damit antworten CLI und HTTP dreistufig: nicht in `known` → „unbekannte
Aktion"; in `known`, nicht in `active` → „Feature *x* ist nicht aktiv";
sonst ausführen. Der Start-Test „keine Aktion ohne Handler" prüft
`known` minus `active` gegen die Menge der ausgeschalteten Features: was
übrig bleibt, ist tot.

| Ableitung | Wie |
|---|---|
| Typ `CoreActionName` | Union aus dem `as const`-Katalog (`core/workbench/actions/catalog.ts`), nicht aus dem Laufzeit-Katalog (6.1); ein Tippfehler in `actions.handle("…")` ist ein Compile-Fehler. Der allgemeine `ActionName` ist `string`, weil Feature-Namen erst zur Laufzeit dazukommen |
| Handler | Registrierung gegen den Namen (`actions.handle("new_tab", …)`) statt `switch` auf Strings, genau ein Handler je Aktion; eine Core-Aktion ohne Handler meldet der Start (`unhandledCoreActions`) |
| Beschriftung | überall `actionLabel(name)`: das `label` aus dem Katalog, und für eine Aktion ohne Label (Feature-Aktionen sind nur Namen) der Name in Worten. Kein Menü wiederholt einen Text von Hand |
| Palette | listet `known` unter der Beschriftung, mit dem Keybinding-Hint aus der Keybind-Konfiguration; gefunden wird über Beschriftung **und** Namen („Settings" ist `open_config`) |
| natives Menü, Hamburger, Kontextmenüs | feuern Katalog-Aktionen. **Wo ein Eintrag steht, bestimmt das Menü**, nicht die Aktion — der Katalog hat bewusst kein `menu`-Feld, weil dieselbe Aktion in mehreren Menüs an verschiedenen Stellen stehen darf |
| CLI | Codegen zur Build-Zeit → `actions.generated.rs` (Namen + Beschreibungen), damit `cogno action list` offline funktioniert |
| Default-Keybindings | Teil der generierten Default-Konfiguration, siehe unten |
| Doku | Codegen → `docs/actions.md`, analog zu Zod `.describe()` bei den Settings |
| Config-Validierung | das Schema prüft die Form einer `keybind`-Zeile; ob ihr Aktionsname deklariert ist, prüft `ConfigBootstrapAdapter` gegen `known` und meldet es als Config-Warnung mit Zeile und Name. Dort und nicht im Config-Reader, weil `infrastructure/` den Katalog nicht kennen darf |
| HTTP und CLI | Rust kennt die Mengen `dispatched` und `inactive` (`set_runnable_actions`) und antwortet damit dreistufig |

**Vom Auslöser zum Handler, vom Handler zur Wirkung.** Alle Auslöser —
Keybinding, Palette, natives Menü, Hamburger, Kontextmenü eines Terminals, CLI,
HTTP — feuern dasselbe `ActionFired`; `ActionHandlers` hat darauf das eine Abo
und ruft den registrierten Handler. Das ist der Bus-Teil, weil die Auslöser
einander und den Handler nicht kennen. Ab dem Handler gibt es keinen Bus mehr:
er ruft die Workbench oder die Sitzung direkt auf
(`grid.split(id, "vertical", "r")`, `host.runEditorAction("clearLine")`) und
meldet mit `false`, wenn er nichts getan hat, damit ein `performable`-Keybinding
zum Terminal durchfällt.

Eine Aktion, die ein Terminal braucht, läuft auf dem, das sie **nennt**
(`ActionFired.terminalId` — das Kontextmenü eines Panes, HTTP), sonst auf dem
fokussierten. Layout-Aktionen (Split, Pane-Wechsel, Maximieren) werden
abgelehnt, wenn das Pane nicht im sichtbaren Tab liegt; Sitzungs-Aktionen
(Paste, Clear, Editor-Aktionen, Copy/Cut) brauchen nur eine lebende Sitzung.
Das Kontextmenü ist damit ein Auslöser wie jeder andere und kennt keine
eigenen Nachrichten.

Durchnummerierte Aktionen (`open_shell_1..9`, `select_tab_1..9`,
`select_workspace_1..9`) entstehen im Katalog aus einer Liste (`SLOTS`); die
Handler iterieren dieselbe Liste.

Der Codegen (`scripts/generate-actions.ts`) läuft über dieselbe statische
Feature-Liste aus `bootstrap/`, kennt also auch Feature-Aktionen. CI prüft,
dass die generierten Dateien aktuell sind — sonst driftet es doch, nur auf
andere Art.

### 5.1 Die Default-Konfiguration

Die Defaults haben drei Teile — Werte, Beschreibungen, Keybindings — und
drei Sichten, eine Datei je OS mit denselben Settings und eigenen
Keybindings. Von Hand geschrieben, hätte jeder Teil eine eigene Quelle und
jede Datei könnte für sich abdriften.

Regel: **Quelle ist Code, Sicht ist eine vollständige generierte Datei pro
OS.**

- Settings: die Beschreibung in Zod (`.describe(…)`), der Wert an einer
  Stelle, `default-config-values.ts`, auch wo er vom OS abhängt (Abschnitt 6).
- Keybindings: Core-Aktionen in ihrer Katalogdefinition, pro OS
  (`defaultKeys`); Feature-Aktionen in `featureKeybinds`
  (`default-config-values.ts`). Eine Aktion ohne Default-Keybinding ist
  zulässig.
- Der Build generiert daraus `default_windows.config`, `default_macos.config`,
  `default_linux.config` — alle Settings mit ihrem Kommentar, alle Keybinds,
  nichts handgeschrieben. Der Rust-Teil lädt sie als
  Plattform-Defaults unter der Nutzerdatei.
- Der Nutzer sieht genau diese Datei: `cogno config show --defaults` und ein
  Menüpunkt „Default-Konfiguration öffnen" zeigen sie vollständig, zum
  Kopieren und Überschreiben. Was er sieht, kann nicht abdriften, weil es
  nichts anderes ist als die Quelle in anderer Form.

Prüfbar: `default_*.config` stehen im Repo als generierte Dateien mit
Kopfzeile, und CI schlägt fehl, wenn sie nicht zum Code passen.

Weil die Quelle der Code ist, kann die Datei keinen toten Eintrag enthalten —
und Totes ist dort auffindbar, wo es entsteht:

- Aktion ohne registrierten Handler: `known` minus `active` minus Aktionen ausgeschalteter Features, beim Start
  gemeldet.
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
inactive | activating | active | deactivating | failed
```

Aktivierung und Deaktivierung sind idempotent. Deaktivierung meldet alle
Contributions ab und gibt Subscriptions sowie Ressourcen frei. Schlägt die
Aktivierung fehl, bleibt `mode: "on"`; der Status wird `failed` und der Fehler
geht an den Error-Reporter. Einen Modus `hidden` gibt es nicht. Falls UI unabhängig von der
Aktivierung ausgeblendet werden soll, ist das eine Darstellungsoption des
Features und kein weiterer Modus.

Ein Feature besitzt seine Einstellungen (eigenes Zod-Schema — kein zentraler
Sammelpunkt, keine Kopie im statischen `Config`-Typ), seine Tabellen
und Migrationen, seine Contributions und seine UI. Die `settings`-Contribution
ist genau dieses Schema (`schemaShape`) und nichts weiter: **Default-Werte
gehören nicht dazu.** Sie stehen an einer Stelle, `default-config-values.ts`,
aus der die Default-Konfiguration generiert wird (5.1); ein zweiter Satz
Defaults am Feature würde von ihr ohnehin überschrieben und kann ihr nur
widersprechen. Ein Top-Level-Schlüssel hat genau einen Besitzer — deshalb
teilen sich alle Features eine Extension für `feature.*`.

`requires` gibt es, weil ausdrücklich gewünscht — mit der ehrlichen Anmerkung,
dass der reale Baum null Kanten hat. Der Feature-Host löst es trotzdem auf (6.1), damit die erste echte
Kante keine Sonderbehandlung braucht.

### 6.1 Der Feature-Host (`core/workbench/feature-host/`)

Abschnitt 6 sagt, was ein Feature *ist*; der Feature-Host ist der eine
Dienst, der damit *umgeht*: er hält die Feature-Liste, meldet
Contributions an und wieder ab und liest `mode` auch nach dem Start. Die
Liste übergibt `bootstrap/features.ts`.

Drei Aufgaben:

1. **Deklaration (statisch, immer).** Bekommt beim Start die Liste aus
   `bootstrap/` und registriert *vor* dem ersten Config-Lesen alles, was
   unabhängig vom Modus bekannt sein muss: IDs, `requires`,
   **Settings-Schemas** (sonst kann die Config, in der `mode` steht, nicht
   validiert werden — das wäre ein Zirkel), **Migrationen** (laufen einmal,
   Daten werden nicht abgeschaltet) und **Aktionsdefinitionen** (damit CLI,
   HTTP und Palette den Namen kennen). Erst danach liest er `mode` und führt
   je Feature den Runtime-Status:
   `inactive → activating → active → deactivating → inactive`, dazu
   `activating → failed`.
2. **Aktivierung (dynamisch, nur bei `mode: on`).** Löst `requires`
   transitiv auf, aktiviert in Abhängigkeitsreihenfolge, deaktiviert
   umgekehrt. Aktivieren = die *aktiven* Contributions anmelden —
   Side-Menu-Panel, **Aktions-Handler**, Notification-Kanäle,
   Hintergrunddienste — und `activate()` rufen; Deaktivieren = abmelden,
   `deactivate()`, Subscriptions freigeben. Beides idempotent. Was in Phase
   1 registriert wurde, bleibt.

   Die Trennlinie: Phase 1 ist, was das Produkt über ein Feature *weiß*;
   Phase 2 ist, was das Feature *tut*. Eine Deklaration hat keine
   Seiteneffekte; Fehler in Phase 1 sind Startfehler (unten), alles, was
   zur Laufzeit fehlschlagen kann, ist Aktivierung.
3. **Hot-Reload.** Abonniert die Config; ändert sich `feature.<id>.mode`,
   aktiviert oder deaktiviert er. Schlägt Aktivierung fehl, bleibt
   `mode: "on"`, Status `failed`, und der Fehler geht an den
   Error-Reporter.

**Übergänge.** Der Host arbeitet als Abgleich: die Config liefert je
Feature den *gewünschten* Modus, der Host führt den *tatsächlichen* Status
und gleicht an. Dafür gelten sechs Regeln:

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
   `inactive`; der Host schreibt nie in die Config. Wird *x* aktiv, aktiviert der nächste
   Abgleich die Abhängigen; wird *x* deaktiviert, deaktiviert der Host
   vorher die Abhängigen in umgekehrter Reihenfolge.
5. **`failed` ist ein Endzustand bis zum Neustart.** Kein automatischer
   Wiederholungsversuch, kein Retry; `mode` bleibt `on`, die Config wird
   nicht angefasst. Bewusst einfach: ein Feature, dessen Aktivierung wirft,
   ist ein Fehler, den man behebt, nicht einer, den die App verwaltet.
6. **Der Status wird nicht persistiert.** Nach einem Neustart beginnt jedes
   Feature bei `inactive` und der Abgleich läuft neu. Persistiert ist nur
   `mode`, und der gehört dem Nutzer.

Damit ist jeder Übergang bestimmt:

```
inactive     --on, requires erfüllt-->  activating
activating   --activate() ok------->  active
activating   --activate() wirft---->  failed       (Contributions zurückgerollt)
active       --off oder requires--->  deactivating
deactivating --immer---------------->  inactive
failed       --Neustart------------->  inactive     (Status wird nicht persistiert)
```

**Deklarationsfehler sind Startfehler.** „Kann nicht fehlschlagen" gilt
für die einzelne Deklaration, nicht für die Menge: doppelte Feature-IDs,
zyklische oder unbekannte `requires`, kollidierende Settings-Pfade
(`feature.git.*` zweimal), doppelte Aktions-IDs. Der Host prüft das in
Phase 1 vollständig, *bevor* er `mode` liest, und bricht bei einem Befund
den Start kontrolliert ab: die App startet mit leerem Feature-Satz, ohne
Feature-Panels im Menü, und meldet über den Error-Reporter jeden Konflikt
einzeln. Das ist
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

**Fehler einer Contribution** fängt der ab, der sie aufruft, und meldet sie
an den Error-Reporter; der Status des Features ändert sich dadurch nicht.
Einen Schutzschalter, der ein Feature nach wiederholten Fehlern abschaltet,
gibt es bewusst nicht. Der Autocomplete-Pfad schützt sich selbst: Timeout
und `rejected` je Suggestor, `matches()` geschützt
(`terminal-autocomplete.service.ts`).

**Autocomplete ist kein Feature.** Es gehört fest zu jeder Sitzung und liegt
vollständig in `core/session/autocomplete/`, samt den Befehls-Specs
(`spec-command/`). Suggestoren, die alle Sitzungen teilen, baut
`SharedSuggestors` einmal; ihre Fehler meldet die Session als Ereignis, die
Workbench macht daraus Benachrichtigungen (`AutocompleteIssueNotifier`).

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

## 7. Offene Punkte

| Was | Umfang |
|---|---|
| Deaktivierungstest je Feature (4.2) | fehlt für `git` und `process-info` |
| **Fenster, TS-Seite (Abschnitt 2.6)** | Rust routet über `WindowRegistry`; auf der TS-Seite fehlen `windowId` in Identität, Notification-Ziel, `side_menu_state` und Workspace-Zustand sowie `window.reveal(windowId, target)` in `platform/`. |
| `platform`-Quellen zu injectable Klassen (3.1) | `keyboard-layout.loader.spec.ts` ersetzt `@cogno/platform/keyboard-layout` noch per `vi.mock`. |

---

## 8. Nicht geplant

- Build-Zeit-Feature-Flags, mehrere Bundles
- Web-Worker- oder iframe-Isolation
- Umbenennung bestehender DB-Tabellen
- Protokoll-Operationen ohne Konsumenten
- Pane in ein anderes Fenster verschieben: von 2.6 getragen (Snapshot + PTY-Übernahme), aber nicht gebaut
- Feature-Funktionen in Remote-Sitzungen (SSH): `boundSession.run` gibt es dort nicht, also kein Git-Panel, keine Prozess-Info, keine Agent-Erkennung. Manches geht in SSH einfach nicht; ein Cogno-Agent auf dem Host wäre ein eigenes Vorhaben.
