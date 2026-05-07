import { DestroyRef, Injectable, Signal, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Logger } from "@cogno/app-tauri/logger";
import { OS } from "@cogno/app-tauri/os";
import { ActionName } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";
import { ConfigService } from "../config/+state/config.service";
import { KeybindingMatcher } from "./keybind.matcher";
import { ActionDefinition } from "./keybind-action.interpreter";
import { KeyboardMappingService } from "./keyboard/keyboard-layout.loader";
import { TerminalKeybindingContextService } from "./terminal-keybinding-context.service";

type Key = string;

interface KeyListener {
  readonly id: string;
  readonly handler: (e: KeyboardEvent) => void;
}

type ListenerStack = KeyListener[];

@Injectable({
  providedIn: "root",
})
export class KeybindService {
  private _keybindMatcher: KeybindingMatcher = new KeybindingMatcher();
  // simple registry for component-specific key listeners
  private readonly listeners = new Map<Key, ListenerStack>();
  private readonly _lastFiredKeybinding = signal<string | undefined>(undefined);

  constructor(
    keyboardMappingService: KeyboardMappingService,
    configService: ConfigService,
    bus: AppBus,
    terminalKeybindingContext: TerminalKeybindingContextService,
    ref: DestroyRef,
  ) {
    keyboardMappingService
      .loadLayout()
      .then((s) => this._keybindMatcher.initKeyCodeMapping(s.keymapInfo.mapping));
    configService.config$
      .pipe(takeUntilDestroyed(ref))
      .subscribe((c) => this._keybindMatcher.initBindings(c.keybind || []));
    window.addEventListener(
      "keydown",
      (e) => {
        if (terminalKeybindingContext.shouldSuppressAppKeybindings()) {
          return;
        }
        if (this.shouldUseNativeEditableFieldHandling(e)) {
          return;
        }
        // 1) Check registered listeners first (e.g., side menu overlays)
        const stack = this.listeners.get(e.key);
        if (stack?.length && !this.isEventInsideDialog(e)) {
          stack.at(-1)?.handler(e);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const ActionFiredEvent = this._keybindMatcher.match(e);
        if (!ActionFiredEvent) return;
        this._lastFiredKeybinding.set(ActionFiredEvent.eventKey);
        Logger.info(`Action fired${ActionFiredEvent.event.payload}`);
        const result = bus.publish(ActionFiredEvent.event);
        if (ActionFiredEvent.event.trigger?.unconsumed) return;
        if (ActionFiredEvent.event.trigger?.performable && !result.performed) return;
        e.preventDefault();
        e.stopPropagation();
      },
      { capture: true },
    );
  }

  get lastFiredKeybinding(): Signal<string | undefined> {
    return this._lastFiredKeybinding.asReadonly();
  }

  private getStack(key: Key): ListenerStack {
    let stack = this.listeners.get(key);
    if (!stack) {
      stack = [];
      this.listeners.set(key, stack);
    }
    return stack;
  }

  getKeybinding(actinName: ActionName): string | undefined {
    return this._keybindMatcher.getKeybinding(actinName);
  }

  getActionDefinition(actionName: ActionName): ActionDefinition | undefined {
    return this._keybindMatcher.getAction(actionName);
  }

  getActionNames(): ReadonlyArray<string> {
    return this._keybindMatcher.getActionNames();
  }

  /** Register a temporary key listener by id. Subsequent calls with the same id overwrite keys/handler. */
  registerListener(id: string, keys: readonly Key[], handler: (e: KeyboardEvent) => void): void {
    for (const key of keys) {
      const stack = this.getStack(key);
      // remove existing registration
      const index = stack.findIndex((l) => l.id === id);
      if (index !== -1) stack.splice(index, 1);
      stack.push({ id, handler });
    }
  }

  /** Remove a previously registered listener. */
  unregisterListener(id: string): void {
    const deleteKeys: string[] = [];
    for (const key of this.listeners.keys()) {
      const stack = this.listeners.get(key);
      if (!stack) continue;
      const index = stack.findIndex((l) => l.id === id);
      if (index !== -1) stack.splice(index, 1);
      if (stack.length === 0) deleteKeys.push(key);
    }
    for (const key of deleteKeys) {
      this.listeners.delete(key);
    }
  }

  private isEventInsideDialog(event: KeyboardEvent): boolean {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) {
      return false;
    }

    return eventTarget.closest("app-dialog") !== null;
  }

  private isEventOnEditableTarget(event: KeyboardEvent): boolean {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) {
      return false;
    }

    const editableElement = eventTarget.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
    );
    return editableElement !== null;
  }

  private isEventInsideTerminalEditableSurface(event: KeyboardEvent): boolean {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) {
      return false;
    }

    const isTerminalHelperTextarea = eventTarget.closest(".xterm-helper-textarea") !== null;
    if (!isTerminalHelperTextarea) {
      return false;
    }

    return eventTarget.closest(".terminal.xterm") !== null;
  }

  private shouldUseNativeEditableFieldHandling(event: KeyboardEvent): boolean {
    if (!this.isEventOnEditableTarget(event)) {
      return false;
    }

    if (this.isEventInsideTerminalEditableSurface(event)) {
      return false;
    }

    return this.isEditableFieldShortcut(event);
  }

  private isEditableFieldShortcut(event: KeyboardEvent): boolean {
    if (event.altKey && event.ctrlKey && !event.metaKey) {
      return false;
    }

    const key = event.key;
    const lowerKey = key.toLowerCase();

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      return true;
    }

    if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      return true;
    }

    if (key.startsWith("Arrow") || key === "Home" || key === "End") {
      return true;
    }

    if (key === "Backspace" || key === "Delete" || key === "Enter" || key === "Escape") {
      return true;
    }

    const isMac = OS.platform() === "macos";
    const primaryModifierPressed = isMac ? event.metaKey : event.ctrlKey;
    if (primaryModifierPressed) {
      if (["a", "c", "v", "x", "z"].includes(lowerKey)) {
        return true;
      }

      if (!isMac && lowerKey === "y") {
        return true;
      }

      if (isMac && lowerKey === "z" && event.shiftKey) {
        return true;
      }

      if (key.startsWith("Arrow") || key === "Home" || key === "End" || key === "Backspace") {
        return true;
      }
    }

    if (event.altKey && (key.startsWith("Arrow") || key === "Backspace" || key === "Delete")) {
      return true;
    }

    return false;
  }
}
