import { TerminalId } from "@cogno/shared/domain";
import { Observable } from "rxjs";

/**
 * A machine whose shells Cogno can show, and how far the connection to it
 * is: one paired with this machine (ARCHITECTURE.md 2.7.3).
 */
export type RemoteHost = {
  /** What the machine is known by: panes and every call here name it by this. */
  readonly id: string;
  /** What the user calls it; free to change. */
  readonly name: string;
  readonly connection: "disconnected" | "connecting" | "connected" | "failed";
  /** Why the connection failed; only while `failed`. */
  readonly failure?: RemoteHostFailure;
};

/** Why connecting to a machine failed. */
export type RemoteHostFailure = {
  readonly message: string;
  /** Whether connecting again can help; when not, the machine is not paired any more. */
  readonly worthRetrying: boolean;
};

/** A shell that runs on a machine. */
export type RemoteShell = {
  readonly terminalId: TerminalId;
  /** Where it sits in the Cogno it belongs to, as far as that Cogno said. */
  readonly workspace?: string;
  readonly tab?: string;
  readonly title?: string;
  readonly directory?: string;
  /** Who shows it right now: nobody, this window, another window of this Cogno or another Cogno. */
  readonly shown: "nowhere" | "thisWindow" | "otherWindow" | "otherCogno";
  /** What the machine of the other Cogno is called, when it said; only `otherCogno`. */
  readonly shownBy?: string;
};

/**
 * The machines whose shells Cogno can show - the ones paired with this
 * machine - and the shells that run on them. `host` is a machine's id.
 */
export abstract class RemoteShellsPort {
  /** The paired machines; again whenever one changes. */
  abstract readonly hosts$: Observable<readonly RemoteHost[]>;
  /**
   * Which shells this window shows changed: it began or stopped showing one,
   * or lost one to another Cogno. What a machine says of its shells is worth
   * reading again then.
   */
  abstract readonly shownInThisWindowChanged$: Observable<void>;

  /** Calls the machine `name` from now on. Rejects with a text for the user. */
  abstract renameHost(host: string, name: string): Promise<void>;
  /** Hangs up on a machine and removes the pairing with it, here and there. */
  abstract removeHost(host: string): Promise<void>;

  /** Settles once the connection stands; how it fails shows on `hosts$`. */
  abstract connect(host: string): Promise<void>;
  /** Hangs up. The machine's shells shown here close; they run on there. */
  abstract disconnect(host: string): Promise<void>;

  /** The shells that run on `host` now; a machine not connected rejects. */
  abstract shells(host: string): Promise<readonly RemoteShell[]>;
  /**
   * Shows the shell in this window: goes to the pane that shows it, takes it
   * back from another Cogno, or opens a tab for it.
   */
  abstract show(host: string, terminalId: TerminalId): Promise<void>;
  /** Ends the shell, whoever shows it. A shell that ended already is no failure. */
  abstract end(host: string, terminalId: TerminalId): Promise<void>;
}
