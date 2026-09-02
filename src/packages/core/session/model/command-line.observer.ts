import { PromptSegment } from "@cogno/core/infrastructure/config/models/prompt-config";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ITerminalHandler } from "@cogno/core/terminal/terminal-handler";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { IDisposable } from "@cogno/shared/support";
import { ContextMenuOverlayService } from "@cogno/shared/ui";
import { Terminal } from "@xterm/xterm";
import { debounceTime, Subject } from "rxjs";
import { MarkerManager } from "../decoration/marker-manager";
import { PromptMarkerRegistry } from "../decoration/prompt-marker.registry";
import { CommandLineBuffer } from "./command-line.buffer";
import { interpretCognoOsc } from "./osc-interpreter";
import { SessionModel } from "./session-model";

type CommandLineObserverContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openAtElement">;

/**
 * Watches the terminal for the session model: mirrors the input line and
 * the cursor into it, notices Enter, reads the shell integration's OSC 733,
 * and keeps the prompt decorations fresh. It writes to the model and states
 * facts; what follows from them is decided elsewhere (ARCHITECTURE.md 2.1).
 */
export class CommandLineObserver implements ITerminalHandler {
  private _disposables: IDisposable[] = [];
  private _terminal?: Terminal;
  private _markerManager: MarkerManager;
  private _refreshMarkerSubject = new Subject<void>();

  constructor(
    private readonly model: SessionModel,
    promptSegments: PromptSegment[],
    contextMenuOverlayService: CommandLineObserverContextMenuOverlayPort,
    clipboard: ClipboardAccess,
    private readonly _markerRegistry: PromptMarkerRegistry = new PromptMarkerRegistry(),
    private readonly _commandLineBuffer: CommandLineBuffer = new CommandLineBuffer(_markerRegistry),
  ) {
    this._markerManager = new MarkerManager(
      model,
      promptSegments,
      contextMenuOverlayService,
      clipboard,
      this._markerRegistry,
    );

    // Debounce marker refresh to improve performance with long outputs
    // 16ms = ~60fps, which batches rapid render events without noticeable lag
    this._refreshMarkerSubject.pipe(debounceTime(16)).subscribe(() => {
      this._markerManager.refreshMarkers();
    });
  }

  registerTerminal(terminal: Terminal): IDisposable {
    this._terminal = terminal;
    this._commandLineBuffer.setTerminal(terminal);
    this._markerManager.setTerminal(terminal);

    this._disposables.push(
      terminal.onCursorMove(() => {
        if (!terminal?.buffer?.active) return;
        if (this.model.isCommandRunning) return;
        try {
          const cursorIndex = this._commandLineBuffer.cursorInputIndex();
          const input = this.model.input;
          if (cursorIndex === input.cursorIndex) return;
          const maxCursorIndex =
            cursorIndex > input.maxCursorIndex ? cursorIndex : input.maxCursorIndex;
          this.model.updateInput({
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
        // Reflow may have shifted marker lines — re-anchor before re-rendering.
        this._markerRegistry.resync();
        this._markerManager.disposeMarkers();
        this._markerManager.refreshMarkers();
      }),
    );
    this._disposables.push(
      this._terminal.onWriteParsed(() => {
        this._markerRegistry.onWriteParsed();
        if (this.model.isCommandRunning) return;
        const input = this.model.input;
        const text = this._commandLineBuffer.readInputText(input.maxCursorIndex);
        if (text === input.text) return;
        this.model.updateInput({ ...input, text: text });
      }),
    );
    this._disposables.push(
      this._terminal.onKey((event) => {
        if (event.key === "\r" || event.key === "\n") {
          this.model.startCommand();
          return;
        }
        if (this.model.isCommandRunning) return;
        this.shrinkMaxCursorIndexOnDelete(event.domEvent);
      }),
    );
    this._disposables.push(
      terminal.parser.registerOscHandler(733, (data: string) => {
        const result = interpretCognoOsc(data, this.model);
        if (result === "prompt" || result === "ignored") {
          // PS1 prints the `^^#<id>` marker line right after this sequence -
          // arm the registry so the next parsed writes anchor it. An
          // untrusted sequence arms nothing: its content is not ours.
          this._markerRegistry.expectMarker();
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
   * maxCursorIndex is the ghost-text defense: readInputText stops at the
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

    const input = this.model.input;
    // Only shrink when the keystroke deletes something real. For Delete the
    // inferred text length may over-approximate (leaked ghost), but then the
    // bound sits at least one above the real length, so shrinking by one
    // still keeps it valid.
    const deletesSomething =
      key === "Backspace" ? input.cursorIndex > 0 : input.cursorIndex < input.text.length;
    if (!deletesSomething) return;

    const cursorAfterDelete = key === "Backspace" ? input.cursorIndex - 1 : input.cursorIndex;
    this.model.updateInput({
      ...input,
      maxCursorIndex: Math.max(cursorAfterDelete, input.maxCursorIndex - 1),
    });
  }
}
