import { Observable } from "rxjs";

export type TerminalIpcMessage = {
  command: string;
  args?: string[];
  terminalId?: string;
};

export abstract class TerminalIpcPort {
  abstract messages$: Observable<TerminalIpcMessage>;
}
