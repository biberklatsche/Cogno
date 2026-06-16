import { DestroyRef, Injectable } from "@angular/core";
import { AppBus } from "../../app-bus/app-bus";
import { BusyIndicatorTarget } from "./+bus/events";

export interface BusyIndicatorHandle {
  unregister: () => void;
}

export interface BusyIndicatorRegistrationOptions {
  registrationId: string;
  /** See BusyIndicatorRegisterEvent.slot — prevents ghost accumulation on re-register. */
  slot?: string;
  target: BusyIndicatorTarget;
  keyframes: number[][][];
  priority: number;
  /** When provided, the registration is automatically removed when the ref is destroyed. */
  destroyRef?: DestroyRef;
}

@Injectable({ providedIn: "root" })
export class BusyIndicatorHelper {
  constructor(private readonly bus: AppBus) {}

  register(options: BusyIndicatorRegistrationOptions): BusyIndicatorHandle {
    this.bus.publish({
      type: "BusyIndicatorRegister",
      payload: {
        registrationId: options.registrationId,
        slot: options.slot,
        target: options.target,
        keyframes: options.keyframes,
        priority: options.priority,
      },
    });

    const unregister = () => {
      this.bus.publish({
        type: "BusyIndicatorUnregister",
        payload: { registrationId: options.registrationId },
      });
    };

    options.destroyRef?.onDestroy(unregister);

    return { unregister };
  }
}
