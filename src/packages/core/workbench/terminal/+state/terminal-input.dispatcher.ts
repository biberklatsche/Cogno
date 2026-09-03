import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ShellLineEditorActionContract } from "@cogno/shared/contributions";
import { Observable } from "rxjs";
import { TerminalSessionRegistry } from "./terminal-session.registry";

/** The editor actions the bus carries, and the host method each maps to. */
const EDITOR_ACTION_BY_MESSAGE = {
  ClearLine: "clearLine",
  ClearLineToEnd: "clearLineToEnd",
  ClearLineToStart: "clearLineToStart",
  DeletePreviousWord: "deletePreviousWord",
  DeleteNextWord: "deleteNextWord",
  GoToNextWord: "goToNextWord",
  GoToPreviousWord: "goToPreviousWord",
  GoToStartOfLine: "goToStartOfLine",
  GoToEndOfLine: "goToEndOfLine",
  SelectAll: "selectAll",
  SelectTextRight: "selectTextRight",
  SelectTextLeft: "selectTextLeft",
  SelectWordRight: "selectWordRight",
  SelectWordLeft: "selectWordLeft",
  SelectTextToEndOfLine: "selectTextToEndOfLine",
  SelectTextToStartOfLine: "selectTextToStartOfLine",
} as const satisfies Record<string, ShellLineEditorActionContract>;

/**
 * Routes the terminal bus messages addressed to a session onto its host,
 * resolving `terminalId -> host` through the registry. One root service in
 * place of the per-session subscriptions the bridge used to hold: most
 * messages carry a terminal id and hit one host; a couple are broadcasts that
 * fan out to all of them. (The keybind action triggers stay per-session - they
 * need the session's autocomplete/history and depend on focus.)
 */
@Injectable({ providedIn: "root" })
export class TerminalInputDispatcher {
  constructor(
    private readonly bus: AppBus,
    private readonly registry: TerminalSessionRegistry,
    destroyRef: DestroyRef,
  ) {
    const until = <T>(source: Observable<T>) => source.pipe(takeUntilDestroyed(destroyRef));

    until(this.bus.on$({ path: ["app", "terminal"], type: "FocusTerminal" })).subscribe((event) => {
      for (const entry of this.registry.entries) {
        if (entry.terminalId === event.payload) entry.host.focus();
        else entry.host.blur();
      }
    });
    until(this.bus.on$({ path: ["app", "terminal"], type: "BlurTerminal" })).subscribe((event) => {
      this.registry.get(event.payload)?.host.blur();
    });
    until(this.bus.onType$("PaneMaximizedChanged")).subscribe((event) => {
      for (const entry of this.registry.entries) {
        entry.host.setPaneMaximized(event.payload?.terminalId === entry.terminalId);
      }
    });
    until(this.bus.onType$("VisibleTerminalsChanged")).subscribe((event) => {
      for (const entry of this.registry.entries) {
        entry.host.setVisible(event.payload?.terminalIds.includes(entry.terminalId) ?? true);
      }
    });
    until(this.bus.on$({ path: ["app", "terminal"], type: "ClearBuffer" })).subscribe((event) => {
      this.registry.get(event.payload)?.host.clearBuffer();
    });
    until(this.bus.on$({ path: ["app", "terminal"], type: "WriteRawToPty" })).subscribe((event) => {
      const payload = event.payload;
      if (!payload) return;
      this.registry.get(payload.terminalId)?.host.writeRaw(payload.text, payload.autoExecute);
    });
    until(this.bus.on$({ path: ["app", "terminal"], type: "Paste" })).subscribe((event) => {
      void this.registry.get(event.payload)?.host.paste();
    });
    until(this.bus.on$({ path: ["app", "terminal"], type: "Copy" })).subscribe((event) => {
      void this.registry.get(event.payload)?.host.copy();
    });
    until(this.bus.on$({ path: ["app", "terminal"], type: "Cut" })).subscribe((event) => {
      this.registry.get(event.payload)?.host.cut();
    });
    for (const [type, actionId] of Object.entries(EDITOR_ACTION_BY_MESSAGE)) {
      until(
        this.bus.on$({
          path: ["app", "terminal"],
          type: type as keyof typeof EDITOR_ACTION_BY_MESSAGE,
        }),
      ).subscribe((event) => {
        this.registry.get(event.payload)?.host.runEditorAction(actionId);
      });
    }
    until(this.bus.on$({ path: ["app", "terminal"], type: "TerminalSearchRequested" })).subscribe(
      (event) => {
        const payload = event.payload;
        if (!payload) return;
        if (payload.terminalId) {
          this.registry.get(payload.terminalId)?.host.search(payload);
          return;
        }
        // No terminal id: every session searches, as before.
        for (const entry of this.registry.entries) entry.host.search(payload);
      },
    );
    until(
      this.bus.on$({ path: ["app", "terminal"], type: "TerminalSearchRevealRequested" }),
    ).subscribe((event) => {
      const payload = event.payload;
      if (!payload) return;
      this.registry.get(payload.terminalId)?.host.reveal(payload);
    });
  }
}
