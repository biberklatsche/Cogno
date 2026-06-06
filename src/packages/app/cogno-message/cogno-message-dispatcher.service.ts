import { Injectable } from "@angular/core";
import { AppBus } from "../app-bus/app-bus";
import { CognoMessage } from "./cogno-message.models";

@Injectable({
  providedIn: "root",
})
export class CognoMessageDispatcher {
  constructor(private bus: AppBus) {}

  dispatch(message: CognoMessage): void {
    this.bus.publish({
      type: "TerminalIpcMessage",
      payload: {
        command: message.command,
        args: message.args,
        terminalId: message.terminalId,
      },
    });
  }
}
