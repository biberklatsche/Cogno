import type { TerminalIpcMessage } from "@cogno/shared/domain";
import { Observable } from "rxjs";

export abstract class TerminalIpcPort {
  abstract messages$: Observable<TerminalIpcMessage>;
}
