import { Injectable } from "@angular/core";
import { Channel } from "@tauri-apps/api/core";
import { invokeHost } from "./host-error";
import { listenInThisWindow } from "./window-events";

/** A machine this one is paired with, and how it is reached. */
export type PairedMachineContract = {
  name: string;
  endpointId: string;
  /** Only directly - in the local network or at `address` - never over Cogno's relay. */
  directOnly?: boolean;
  /** Where it is reached directly: a host name or IP address, with a port when not the default. */
  address?: string;
};

/** What the user says about a paired machine. */
export type PairedMachineSettingsContract = {
  name: string;
  directOnly: boolean;
  /** None when left empty. */
  address: string | null;
};

/** The code this machine shows for another one to pair with it. */
export type PairingCodeContract = { code: string; expiresInSecs: number };

/** What the user sees of pairing on this machine. */
export type PairingStateContract = {
  /** Whether paired machines may connect while Cogno runs. */
  accepting: boolean;
  machines: PairedMachineContract[];
  /** Where this machine is reached directly; none while pairing is off. */
  addresses: string[];
  /** The code this machine shows, while it is valid. */
  code: PairingCodeContract | null;
};

/** A machine asks to be paired with this one. */
export type PairingRequestContract = {
  id: number;
  /** How the asking machine calls itself, when it says. */
  name: string | null;
  /** The number the asking machine shows too. */
  check: string;
};

/** A machine asks to pair; to the window that was focused last. */
const PAIRING_REQUEST_EVENT = "pairing-request";
/** A request is over: answered, given up or timed out; to every window. */
const PAIRING_REQUEST_ENDED_EVENT = "pairing-request-ended";
/** What `state` returns changed; to every window. */
const PAIRING_CHANGED_EVENT = "pairing-changed";

/**
 * Pairing with other machines (ARCHITECTURE.md 2.7.3): a short code on one,
 * typed on the other, and a check number both show while the first one asks
 * its user. Every failure is a `HostError`; until Cogno's pairing server is
 * set up, every command but `disable` fails with `pairingUnreachable`.
 */
@Injectable({ providedIn: "root" })
export class Pairing {
  state(): Promise<PairingStateContract> {
    return invokeHost<PairingStateContract>("pairing_state");
  }

  /** Makes this machine reachable for the machines it is paired with. */
  enable(): Promise<void> {
    return invokeHost("pairing_enable");
  }

  /** Nothing is reachable any more; a code shown is gone, a request declined. */
  disable(): Promise<void> {
    return invokeHost("pairing_disable");
  }

  /** A code for another machine to pair with this one; one shown before is gone. */
  createCode(): Promise<PairingCodeContract> {
    return invokeHost<PairingCodeContract>("pairing_create_code");
  }

  cancelCode(): Promise<void> {
    return invokeHost("pairing_cancel_code");
  }

  /**
   * Pairs with the machine that shows `code`. `onCheck` gets the check
   * number while that machine asks its user. The new machine gets none of
   * the names `taken`.
   */
  pair(
    code: string,
    taken: readonly string[],
    onCheck: (check: string) => void,
  ): Promise<PairedMachineContract> {
    const checks = new Channel<string>();
    checks.onmessage = onCheck;
    return invokeHost<PairedMachineContract>("pairing_add", { code, taken, onCheck: checks });
  }

  /** The user's answer to request `id`: the name to pair it under, or null to decline. */
  answer(id: number, name: string | null): Promise<void> {
    return invokeHost("pairing_answer", { id, name });
  }

  setAccepting(on: boolean): Promise<void> {
    return invokeHost("pairing_set_accepting", { on });
  }

  /** Saves the machine paired as `previous`: its name and how it is reached. */
  saveMachine(previous: string, settings: PairedMachineSettingsContract): Promise<void> {
    return invokeHost("pairing_save_machine", { previous, ...settings });
  }

  /**
   * Removes the pairing here and tells the other machine; resolves with
   * whether it heard. When not, it is refused the next time it connects.
   */
  remove(name: string): Promise<boolean> {
    return invokeHost<boolean>("pairing_remove", { name });
  }

  onRequest(listener: (request: PairingRequestContract) => void): Promise<() => void> {
    return listenInThisWindow<PairingRequestContract>(PAIRING_REQUEST_EVENT, listener);
  }

  onRequestEnded(listener: (id: number) => void): Promise<() => void> {
    return listenInThisWindow<number>(PAIRING_REQUEST_ENDED_EVENT, listener);
  }

  onChanged(listener: () => void): Promise<() => void> {
    return listenInThisWindow<null>(PAIRING_CHANGED_EVENT, () => listener());
  }
}
