import { Injectable } from "@angular/core";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalIpcMessage } from "@cogno/shared/domain";
import { filter, map } from "rxjs/operators";
import { TerminalIpcPort } from "./terminal-ipc-port";

@Injectable({ providedIn: "root" })
export class TerminalIpcAdapterService extends TerminalIpcPort {
  readonly messages$;

  constructor(bus: AppBus) {
    super();
    this.messages$ = bus.on$("TerminalIpcMessage").pipe(
      filter((e): e is typeof e & { payload: TerminalIpcMessage } => e.payload !== undefined),
      map((e) => e.payload),
    );
  }
}
