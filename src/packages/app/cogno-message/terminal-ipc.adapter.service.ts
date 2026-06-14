import { Injectable } from "@angular/core";
import { TerminalIpcMessage, TerminalIpcPort } from "@cogno/core-api";
import { filter, map } from "rxjs/operators";
import { AppBus } from "../app-bus/app-bus";

@Injectable({ providedIn: "root" })
export class TerminalIpcAdapterService extends TerminalIpcPort {
  readonly messages$;

  constructor(bus: AppBus) {
    super();
    this.messages$ = bus.onType$("TerminalIpcMessage").pipe(
      filter((e): e is typeof e & { payload: TerminalIpcMessage } => e.payload !== undefined),
      map((e) => e.payload),
    );
  }
}
