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
import { CommandLineBuffer } from "./command-line.buffer";
import { MarkerManager } from "./marker-manager";
import { PromptMarkerRegistry } from "./prompt-marker.registry";

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
    private readonly _markerRegistry: PromptMarkerRegistry = new PromptMarkerRegistry(),
    private readonly _commandLineBuffer: CommandLineBuffer = new CommandLineBuffer(_markerRegistry),
  ) {
    this._markerManager = new MarkerManager(
      stateManager,
      promptSegments,
      contextMenuOverlayService,
      appBus,
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
        if (this.stateManager.isCommandRunning) return;
        try {
          const cursorIndex = this._commandLineBuffer.cursorInputIndex();
          const input = this.stateManager.input;
          if (cursorIndex === input.cursorIndex) return;
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
        // Reflow may have shifted marker lines — re-anchor before re-rendering.
        this._markerRegistry.resync();
        this._markerManager.disposeMarkers();
        this._markerManager.refreshMarkers();
      }),
    );
    this._disposables.push(
      this._terminal.onWriteParsed(() => {
        this._markerRegistry.onWriteParsed();
        if (this.stateManager.isCommandRunning) return;
        const input = this.stateManager.input;
        const text = this._commandLineBuffer.readInputText(input.maxCursorIndex);
        if (text === input.text) return;
        this.stateManager.updateInput({ ...input, text: text });
      }),
    );
    this._disposables.push(
      this._terminal.onKey((event) => {
        if (event.key === "\r" || event.key === "\n") {
          this.stateManager.startCommand();
        }
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
        // PS1 prints the `^^#<id>` marker line right after this sequence —
        // arm the registry so the next parsed writes anchor it.
        this._markerRegistry.expectMarker();
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
}
