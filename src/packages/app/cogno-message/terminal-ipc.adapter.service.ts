import { Injectable } from "@angular/core";
import { TerminalIpcPort } from "@cogno/core-api";
import { map } from "rxjs/operators";
import { AppBus } from "../app-bus/app-bus";

@Injectable({ providedIn: "root" })
export class TerminalIpcAdapterService extends TerminalIpcPort {
  readonly messages$;

  constructor(bus: AppBus) {
    super();
    this.messages$ = bus.onType$("TerminalIpcMessage").pipe(
      map((e) => e.payload!),
    );
  }
}
