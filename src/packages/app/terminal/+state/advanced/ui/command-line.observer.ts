import { IDisposable } from "@cogno/core-support";
import { ContextMenuOverlayService } from "@cogno/core-ui";
import { Terminal } from "@xterm/xterm";
import { debounceTime, Subject } from "rxjs";
import { AppBus } from "../../../../app-bus/app-bus";
import { ErrorReporter } from "../../../../common/error/error-reporter";
import { PromptSegment } from "../../../../config/+models/prompt-config";
import { ITerminalHandler } from "../../handler/handler";
import { TerminalStateManager } from "../../state";
import { ExecutedCommand } from "../history/terminal-command-history.store";
import OscParser from "../osc/cogno-osc.parser";
import { toSessionCapabilities } from "../osc/session-capabilities.parser";
import { MarkerManager } from "./marker-manager";

type CommandLineObserverContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openAtElement">;

export class CommandLineObserver implements ITerminalHandler {
  private _disposables: IDisposable[] = [];
  private _terminal?: Terminal;
  private _markerManager: MarkerManager;
  private _refreshMarkerSubject = new Subject<void>();

  constructor(
    private stateManager: TerminalStateManager,
    promptSegments: PromptSegment[],
    contextMenuOverlayService: CommandLineObserverContextMenuOverlayPort,
    private readonly appBus: AppBus,
    private readonly commandCompletedHandler?: (executedCommand: ExecutedCommand) => void,
  ) {
    this._markerManager = new MarkerManager(
      stateManager,
      promptSegments,
      contextMenuOverlayService,
      appBus,
    );

    // Debounce marker refresh to improve performance with long outputs
    // 16ms = ~60fps, which batches rapid render events without noticeable lag
    this._refreshMarkerSubject.pipe(debounceTime(16)).subscribe(() => {
      this._markerManager.refreshMarkers();
    });
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this._markerManager.setTerminal(terminal);

    this._disposables.push(
      terminal.onCursorMove(() => {
        if (!terminal?.buffer?.active) return;
        if (this.stateManager.isCommandRunning) return;
        try {
          const buffer = terminal.buffer?.active;
          const startInputY = this.findLastCognoMarkerY() + 1;
          const cursorX = buffer.cursorX;
          const cursorYViewport = buffer.cursorY;
          const viewportY = buffer.viewportY;
          const cursorYAbsolute = cursorYViewport + viewportY;
          const promptHeight = cursorYAbsolute - startInputY;
          const cursorIndex = cursorX + terminal.cols * promptHeight;
          const input = this.stateManager.input;
          const maxCursorIndex =
            cursorIndex > input.maxCursorIndex ? cursorIndex : input.maxCursorIndex;
          this.stateManager.updateInput({
            ...input,
            cursorIndex: cursorIndex,
            maxCursorIndex: maxCursorIndex,
          });
        } catch (error) {
          ErrorReporter.reportException({
            error,
            handled: true,
            source: "CommandLineObserver",
            context: {
              operation: "onCursorMove",
            },
          });
        }
      }),
    );
    this._disposables.push(
      this._terminal.onRender(() => {
        this._refreshMarkerSubject.next();
      }),
    );

    this._disposables.push(
      this._terminal.onScroll(() => {
        this._refreshMarkerSubject.next();
      }),
    );

    this._disposables.push(
      this._terminal.onResize(() => {
        this._markerManager.disposeMarkers();
        this._markerManager.refreshMarkers();
      }),
    );
    this._disposables.push(
      this._terminal.onWriteParsed(() => {
        if (this.stateManager.isCommandRunning) return;
        const text = this.readCurrentText();
        const input = this.stateManager.input;
        this.stateManager.updateInput({ ...input, text: text });
      }),
    );
    this._disposables.push(
      this._terminal.onKey((event) => {
        if (event.key === "\r" || event.key === "\n") {
          this.stateManager.startCommand();
          return;
        }
        if (this.stateManager.isCommandRunning) return;
        this.shrinkMaxCursorIndexOnDelete(event.domEvent);
      }),
    );
    this._disposables.push(
      terminal.parser.registerOscHandler(733, (data: string) => {
        // The capability handshake arrives once while the integration script
        // loads, before the first prompt — it must not run the prompt logic
        // (endCommand, cursor restore, command update).
        if (data.startsWith("COGNO:CAPS;")) {
          const caps = OscParser.parse(data.slice("COGNO:CAPS;".length));
          if (caps) {
            this.stateManager.updateSessionCapabilities(toSessionCapabilities(caps));
          }
          return true;
        }
        this.stateManager.endCommand();
        this.appBus.publish({
          path: ["app", "terminal", this.stateManager.terminalId],
          type: "TerminalCursorRestoreRequested",
        });
        const kv = OscParser.parse(data);
        if (!kv) return true;
        kv["duration"] = this.stateManager.getCommandDuration()?.toString() ?? "";
        const executedCommand = this.stateManager.updateCommand(kv);
        const directory = kv["directory"];
        if (directory?.trim()) {
          this.stateManager.updateCwd(directory);
        }
        if (executedCommand) {
          this.commandCompletedHandler?.(executedCommand);
        }
        return true;
      }),
    );
    return this;
  }

  dispose(): void {
    this._disposables.forEach((d) => {
      d.dispose();
    });
    this._disposables = [];
    this._refreshMarkerSubject.complete();
    this._markerManager.dispose();
    this._terminal = undefined;
  }

  /**
   * maxCursorIndex is the ghost-text defense: readCurrentText stops at the
   * furthest cursor position, so shell predictions (zsh-autosuggestions,
   * PSReadLine inline prediction) rendered beyond it never count as input.
   * The bound only grows while typing — after a deletion the real input is
   * shorter and freshly rendered ghost text would fall inside the stale
   * window. Shrink by one per deleting keystroke; word-wise deletes via
   * modifier keys shrink less than actually deleted, which errs on the safe
   * side — the bound must never drop below the real input length.
   */
  private shrinkMaxCursorIndexOnDelete(domEvent: KeyboardEvent | undefined): void {
    const key = domEvent?.key;
    if (key !== "Backspace" && key !== "Delete") return;

    const input = this.stateManager.input;
    // Only shrink when the keystroke deletes something real. For Delete the
    // inferred text length may over-approximate (leaked ghost), but then the
    // bound sits at least one above the real length, so shrinking by one
    // still keeps it valid.
    const deletesSomething =
      key === "Backspace" ? input.cursorIndex > 0 : input.cursorIndex < input.text.length;
    if (!deletesSomething) return;

    const cursorAfterDelete = key === "Backspace" ? input.cursorIndex - 1 : input.cursorIndex;
    this.stateManager.updateInput({
      ...input,
      maxCursorIndex: Math.max(cursorAfterDelete, input.maxCursorIndex - 1),
    });
  }

  private findLastCognoMarkerY(): number {
    let lastPromptRow = -1;
    if (!this._terminal?.buffer?.active) return lastPromptRow;
    for (let i = this._terminal.buffer.active.length - 1; i >= 0; i--) {
      const line = this._terminal.buffer.active.getLine(i);
      if (line?.translateToString().startsWith("^^#")) {
        lastPromptRow = i;
        break;
      }
    }
    return lastPromptRow;
  }

  private readCurrentText(): string {
    const terminal = this._terminal;
    const buffer = terminal?.buffer?.active;
    if (!terminal || !buffer) return "";
    const lastCognoMarkerY = this.findLastCognoMarkerY();
    const input = this.stateManager.input;
    const heightOfPrompt = Math.ceil(input.maxCursorIndex / terminal.cols);
    let text = "";
    for (let i = lastCognoMarkerY + 1; i <= lastCognoMarkerY + heightOfPrompt; i++) {
      const line = buffer.getLine(i);
      if (!line) continue;
      text += line.translateToString(false);
    }
    if (text.length > input.maxCursorIndex) {
      text = text.substring(0, input.maxCursorIndex);
    }
    return text.trimEnd();
  }
}
