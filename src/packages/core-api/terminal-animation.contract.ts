export type AnimationSpec = {
  readonly keyframes: number[][];
  readonly priority: number;
};

export abstract class TerminalAnimationPort {
  abstract register(terminalId: string, registrationKey: string, spec: AnimationSpec): void;
  abstract unregister(terminalId: string, registrationKey: string): void;
}
