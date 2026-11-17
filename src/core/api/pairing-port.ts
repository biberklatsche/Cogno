import { Observable } from "rxjs";

/** The code this machine shows for another one to pair with it. */
export type PairingCode = {
  readonly code: string;
  /** When it runs out, in milliseconds as `Date.now()` counts them. */
  readonly expiresAt: number;
};

/** What there is to see of pairing on this machine. */
export type PairingState =
  | {
      readonly available: true;
      /** Whether paired machines may connect while Cogno runs. */
      readonly accepting: boolean;
      /** The code this machine shows, while it is valid. */
      readonly code?: PairingCode;
    }
  | {
      readonly available: false;
      /** Why pairing does not work here, in words for the user. */
      readonly reason: string;
    };

/**
 * Pairing this machine with others (ARCHITECTURE.md 2.7.3): showing a code
 * for another machine, pairing with one by its code, and whether paired
 * machines may connect. The paired machines themselves are remotes
 * (`RemoteShellsPort`). Failures reject with a `HostError` whose code says
 * why (`pairingCodeUnknown`, `pairingDeclined`, `pairingUnreachable`,
 * `pairingOff`) and whose message is for the user.
 */
export abstract class PairingPort {
  /** What there is to see of pairing; the current state first. */
  abstract readonly state$: Observable<PairingState>;

  /** The Remote feature is on: this machine becomes reachable. A failure shows on `state$`. */
  abstract enable(): Promise<void>;
  /** The Remote feature is off: nothing is reachable any more. */
  abstract disable(): Promise<void>;

  /** Shows a code for another machine to pair with this one; one shown before is gone. */
  abstract createCode(): Promise<void>;
  abstract cancelCode(): Promise<void>;
  abstract setAccepting(on: boolean): Promise<void>;

  /**
   * Pairs with the machine that shows `code`. `onCheck` gets the number to
   * compare while that machine asks its user. Resolves with the name the
   * machine is a remote under.
   */
  abstract pairByCode(code: string, onCheck: (check: string) => void): Promise<string>;
}
