import { TerminalId } from "@cogno/shared/domain";
import { Observable } from "rxjs";

/** A machine from `remote.hosts`, and how far the connection to it is. */
export type RemoteHost = {
  readonly name: string;
  /** Where ssh connects. */
  readonly destination: string;
  /** What ssh runs there to reach the Cogno; found by itself when left out. */
  readonly command?: string;
  readonly connection: "disconnected" | "connecting" | "connected" | "failed";
  /** Why the connection failed; only while `failed`. */
  readonly failure?: RemoteHostFailure;
};

/** Why connecting to a machine failed. */
export type RemoteHostFailure = {
  readonly message: string;
  /** Whether connecting again can help; when not, the settings or a Cogno must change first. */
  readonly worthRetrying: boolean;
};

/** What the user says about a machine. */
export type RemoteHostSettings = Pick<RemoteHost, "name" | "destination" | "command">;

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
 * The machines whose shells Cogno can show, and the shells that run on them.
 * A machine is named as in `remote.hosts`.
 */
export abstract class RemoteShellsPort {
  /** The machines of `remote.hosts`, again whenever one of them changes. */
  abstract readonly hosts$: Observable<readonly RemoteHost[]>;
  /**
   * Which shells this window shows changed: it began or stopped showing one,
   * or lost one to another Cogno. What a machine says of its shells is worth
   * reading again then.
   */
  abstract readonly shownInThisWindowChanged$: Observable<void>;

  /**
   * Writes a machine to the config. `previousName` is what it was called
   * when it is renamed. Rejects with a text for the user.
   */
  abstract saveHost(host: RemoteHostSettings, previousName?: string): Promise<void>;
  /** Takes a machine out of the config and hangs up on it. */
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
