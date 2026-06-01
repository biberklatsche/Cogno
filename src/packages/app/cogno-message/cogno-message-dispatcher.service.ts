import { Injectable } from "@angular/core";
import { ActionFired } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";
import { CognoMessage } from "./cogno-message.models";

@Injectable({
  providedIn: "root",
})
export class CognoMessageDispatcher {
  constructor(private bus: AppBus) {}

  dispatch(message: CognoMessage): void {
    this.bus.publish(
      ActionFired.create(message.action, undefined, message.args, message.terminalId),
    );
  }
}
