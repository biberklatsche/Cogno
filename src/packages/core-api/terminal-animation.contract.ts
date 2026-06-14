import { Observable } from "rxjs";

export type AnimationSpec = {
  /** Grid keyframes: keyframes[frame][row][col], row 0 = top, values 0–1. */
  readonly keyframes: number[][][];
  readonly priority: number;
};

export abstract class TerminalAnimationPort {
  abstract register(terminalId: string, registrationKey: string, spec: AnimationSpec): void;
  abstract unregister(terminalId: string, registrationKey: string): void;
  /** Emits the current animation specs registered for the given terminal, sorted by priority. */
  abstract observe$(terminalId: string): Observable<ReadonlyArray<AnimationSpec>>;
}
