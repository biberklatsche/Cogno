import { Injectable } from "@angular/core";
import { Channel } from "@tauri-apps/api/core";
import { invokeHost } from "./host-error";
import { listenInThisWindow } from "./window-events";

/** A machine this one is paired with. */
export type PairedMachineContract = {
  /** What the user calls it. */
  name: string;
  /** What it is known by: it stays when the machine is renamed. */
  endpointId: string;
};

/** A machine in the local network that has pairing open. */
export type NearbyMachineContract = {
  /** What `pair` takes. */
  id: string;
  name: string;
};

/** What the user sees of pairing on this machine. */
export type PairingStateContract = {
  /** This machine's id while its endpoint runs: the invitation another machine pairs by. */
  id: string | null;
  /** Whether machines in other networks are reached: a relay is set. */
  acrossNetworks: boolean;
  machines: PairedMachineContract[];
  /** Whether the user has pairing open: this machine is seen nearby and takes requests. */
  open: boolean;
  /** The machines nearby that have pairing open too; none unless it is open here. */
  nearby: NearbyMachineContract[];
};

/** A pairing waits for this machine's user: both machines show `check`. */
export type PairingRequestContract = {
  id: number;
  /** How the other machine calls itself, when it says. */
  name: string | null;
  /** The number the other machine shows too. */
  check: string;
};

/** Another machine asks to pair; to the window that was focused last. */
const PAIRING_REQUEST_EVENT = "pairing-request";
/** A request is over: answered, given up or timed out; to every window. */
const PAIRING_REQUEST_ENDED_EVENT = "pairing-request-ended";
/** What `state` returns changed; to every window. */
const PAIRING_CHANGED_EVENT = "pairing-changed";

/**
 * Pairing with other machines (ARCHITECTURE.md 2.7.3): while pairing is open
 * on two machines of one network, each sees the other; one asks, both show
 * the same check number, and both users confirm it. Every failure is a
 * `HostError`.
 */
@Injectable({ providedIn: "root" })
export class Pairing {
  state(): Promise<PairingStateContract> {
    return invokeHost<PairingStateContract>("pairing_state");
  }

  /**
   * Makes this machine reachable for the machines it is paired with: with
   * `relay`, the address of a relay server, also for those in other
   * networks; without, in the local network only.
   */
  enable(relay: string | null): Promise<void> {
    return invokeHost("pairing_enable", { relay });
  }

  /** Nothing is reachable any more; pairing is closed, a request declined. */
  disable(): Promise<void> {
    return invokeHost("pairing_disable");
  }

  /** Opens or closes pairing: while open, this machine is seen nearby and takes requests. */
  setOpen(open: boolean): Promise<void> {
    return invokeHost("pairing_set_open", { open });
  }

  /**
   * Asks the machine with `id` to pair: one nearby, or one whose invitation
   * the user was given. `onRequest` gets the check
   * number to show; `answer` says whether the user found it the same on the
   * other machine. Resolves once both users confirmed.
   */
  pair(
    id: string,
    onRequest: (request: PairingRequestContract) => void,
  ): Promise<PairedMachineContract> {
    const requests = new Channel<PairingRequestContract>();
    requests.onmessage = onRequest;
    return invokeHost<PairedMachineContract>("pairing_pair", { id, onRequest: requests });
  }

  /** What the user says to request `id`: whether the check number is the same on both machines. */
  answer(id: number, confirmed: boolean): Promise<void> {
    return invokeHost("pairing_answer", { id, confirmed });
  }

  /** Calls the paired machine `id` `name` from now on. */
  rename(id: string, name: string): Promise<void> {
    return invokeHost("pairing_rename", { id, name });
  }

  /**
   * Removes the pairing here and tells the other machine; resolves with
   * whether it heard. When not, it is refused the next time it connects.
   */
  remove(id: string): Promise<boolean> {
    return invokeHost<boolean>("pairing_remove", { id });
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
