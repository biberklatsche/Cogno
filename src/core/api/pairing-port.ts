import { Observable } from "rxjs";

/** A machine in the local network that has pairing open too. */
export type NearbyMachine = {
  /** What `pair` takes. */
  readonly id: string;
  readonly name: string;
};

/** What there is to see of pairing on this machine. */
export type PairingState =
  | {
      readonly available: true;
      /**
       * What the user gives to someone in another network to pair with this
       * machine; none when only the local network is reached.
       */
      readonly invitation?: string;
      /** Whether pairing is open: this machine is seen nearby and takes requests to pair. */
      readonly open: boolean;
      /** The machines nearby to pair with; none unless pairing is open here. */
      readonly nearby: readonly NearbyMachine[];
    }
  | {
      readonly available: false;
      /** Why pairing does not work here, in words for the user. */
      readonly reason: string;
    };

/** The number both machines show, and what the user says to it. */
export type PairingCheck = {
  readonly check: string;
  /** What the other machine is called: as it calls itself. */
  readonly name: string;
  /** Whether the other machine shows the same number. */
  answer(same: boolean): void;
};

/**
 * Pairing this machine with others (ARCHITECTURE.md 2.7.3): opening pairing,
 * so two machines of one network see each other, and asking one to pair -
 * one seen nearby, or one in another network by its invitation. The paired machines themselves are remotes (`RemoteShellsPort`).
 * Failures reject with a `HostError` whose code says why (`pairingDeclined`,
 * `pairingUnreachable`, `pairingOff`) and whose message is for the user.
 */
export abstract class PairingPort {
  /** What there is to see of pairing; the current state first. */
  abstract readonly state$: Observable<PairingState>;

  /** The Remote feature is on: this machine becomes reachable. A failure shows on `state$`. */
  abstract enable(): Promise<void>;
  /** The Remote feature is off: nothing is reachable any more. */
  abstract disable(): Promise<void>;

  /** Opens or closes pairing. While open, this machine is seen nearby and takes requests. */
  abstract setOpen(open: boolean): Promise<void>;

  /**
   * Asks the machine with `id` to pair: one nearby, or one whose invitation
   * the user was given. `onCheck` gets the number
   * both machines show; the user says there whether they are the same.
   * Resolves, once both users confirmed, with the name the machine is a
   * remote under.
   */
  abstract pair(id: string, onCheck: (check: PairingCheck) => void): Promise<string>;
}
