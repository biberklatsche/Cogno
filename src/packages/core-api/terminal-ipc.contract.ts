import { Observable } from "rxjs";

export type TerminalIpcMessage = {
  command: string;
  args?: string[];
  terminalId?: string;
  /** Arbitrary JSON forwarded as-is (e.g. an agent hook's stdin payload). */
  payload?: unknown;
};

export abstract class TerminalIpcPort {
  abstract messages$: Observable<TerminalIpcMessage>;
}
