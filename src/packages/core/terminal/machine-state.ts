import { BehaviorSubject, map, Observable } from "rxjs";
import {
  TerminalCursorPosition,
  TerminalMachineState,
  TerminalMousePosition,
  TerminalViewportDimensions,
} from "./terminal-machine.state";

export type TerminalProgressState = "hidden" | "default" | "error" | "indeterminate" | "warning";

export type TerminalProgress = {
  state: TerminalProgressState;
  value: number;
};

/** Everything the machine knows about itself. */
export type MachineStateSnapshot = {
  cursorPosition: TerminalCursorPosition;
  mousePosition: TerminalMousePosition;
  dimensions: TerminalViewportDimensions;
  isFocused: boolean;
  hasSelection: boolean;
  isInFullScreenMode: boolean;
  scrolledLinesFromBottom: number;
  progress: TerminalProgress;
};

export const createInitialMachineState = (): MachineStateSnapshot => ({
  cursorPosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
  mousePosition: { viewport: { col: 1, row: 1 }, col: 1, row: 1, char: "" },
  dimensions: {
    rows: 0,
    cols: 0,
    cellHeight: 0,
    cellWidth: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  },
  isFocused: false,
  hasSelection: false,
  isInFullScreenMode: false,
  scrolledLinesFromBottom: 0,
  progress: { state: "hidden", value: 0 },
});

/**
 * The machine's half of what used to be one state manager: where the
 * cursor is, how big the terminal is, whether it has the keyboard, what is
 * selected, how far it is scrolled, whether an alternate screen is up, and
 * the progress a program reported. Facts about the terminal as a device -
 * nothing about the shell, the command or the session (ARCHITECTURE.md 2.1).
 */
export class MachineState implements TerminalMachineState {
  private readonly _state = new BehaviorSubject<MachineStateSnapshot>(createInitialMachineState());

  get state$(): Observable<MachineStateSnapshot> {
    return this._state.asObservable();
  }

  get state(): MachineStateSnapshot {
    return this._state.value;
  }

  get cursorPosition(): TerminalCursorPosition {
    return this._state.value.cursorPosition;
  }

  get cursorPosition$(): Observable<TerminalCursorPosition> {
    return this._state.pipe(map((s) => s.cursorPosition));
  }

  updateCursorPosition(position: TerminalCursorPosition): void {
    this.update({ cursorPosition: position });
  }

  get mousePosition(): TerminalMousePosition {
    return this._state.value.mousePosition;
  }

  updateMousePosition(position: TerminalMousePosition): void {
    this.update({ mousePosition: position });
  }

  get dimensions(): TerminalViewportDimensions {
    return this._state.value.dimensions;
  }

  updateDimensions(dimensions: TerminalViewportDimensions): void {
    this.update({ dimensions });
  }

  get isFocused(): boolean {
    return this._state.value.isFocused;
  }

  get isFocused$(): Observable<boolean> {
    return this._state.pipe(map((s) => s.isFocused));
  }

  setFocus(focused: boolean): void {
    this.update({ isFocused: focused });
  }

  get hasSelection(): boolean {
    return this._state.value.hasSelection;
  }

  get hasSelection$(): Observable<boolean> {
    return this._state.pipe(map((s) => s.hasSelection));
  }

  setHasSelection(hasSelection: boolean): void {
    this.update({ hasSelection });
  }

  get isInFullScreenMode$(): Observable<boolean> {
    return this._state.pipe(map((s) => s.isInFullScreenMode));
  }

  setInFullScreenMode(fullScreen: boolean): void {
    this.update({ isInFullScreenMode: fullScreen });
  }

  get scrolledLinesFromBottom(): number {
    return this._state.value.scrolledLinesFromBottom;
  }

  get scrolledLinesFromBottom$(): Observable<number> {
    return this._state.pipe(map((s) => s.scrolledLinesFromBottom));
  }

  setScrolledLinesFromBottom(scrolledLinesFromBottom: number): void {
    if (this._state.value.scrolledLinesFromBottom === scrolledLinesFromBottom) return;
    this.update({ scrolledLinesFromBottom });
  }

  setProgress(state: TerminalProgressState, value: number): void {
    const normalizedValue = Math.max(0, Math.min(100, Math.round(value)));
    this.update({ progress: { state, value: state === "hidden" ? 0 : normalizedValue } });
  }

  private update(updates: Partial<MachineStateSnapshot>): void {
    this._state.next({ ...this._state.value, ...updates });
  }
}
