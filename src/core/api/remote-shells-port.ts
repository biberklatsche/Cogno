import { TerminalId } from "@cogno/shared/domain";
import { Observable } from "rxjs";

/**
 * A machine whose shells Cogno can show, and how far the connection to it
 * is: one of `remote.hosts`, reached over ssh, or one paired with this
 * machine (ARCHITECTURE.md 2.7.3).
 */
export type RemoteHost = SshRemoteHost | PairedRemoteHost;

type RemoteHostConnectionState = {
  readonly name: string;
  readonly connection: "disconnected" | "connecting" | "connected" | "failed";
  /** Why the connection failed; only while `failed`. */
  readonly failure?: RemoteHostFailure;
};

type SshRemoteHost = RemoteHostConnectionState & {
  readonly kind: "ssh";
  /** Where ssh connects. */
  readonly destination: string;
  /** What ssh runs there to reach the Cogno; found by itself when left out. */
  readonly command?: string;
};

type PairedRemoteHost = RemoteHostConnectionState & {
  readonly kind: "paired";
  /** Only directly - in the local network or at `address` - never through Cogno's server. */
  readonly directOnly: boolean;
  /** Where it is reached directly: a host name or IP address, with a port when not the default. */
  readonly address?: string;
};

/** Why connecting to a machine failed. */
export type RemoteHostFailure = {
  readonly message: string;
  /** Whether connecting again can help; when not, the settings must change first. */
  readonly worthRetrying: boolean;
};

/** What the user says about a machine reached over ssh. */
export type RemoteHostSettings = Pick<SshRemoteHost, "name" | "destination" | "command">;

/** What the user says about a paired machine. */
export type PairedHostSettings = Pick<PairedRemoteHost, "name" | "directOnly" | "address">;

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
 * A machine is named as in `remote.hosts` or in the list of paired machines;
 * a name belongs to one machine of either kind.
 */
export abstract class RemoteShellsPort {
  /** The machines of `remote.hosts`, then the paired ones; again whenever one changes. */
  abstract readonly hosts$: Observable<readonly RemoteHost[]>;
  /**
   * Which shells this window shows changed: it began or stopped showing one,
   * or lost one to another Cogno. What a machine says of its shells is worth
   * reading again then.
   */
  abstract readonly shownInThisWindowChanged$: Observable<void>;

  /**
   * Writes a machine reached over ssh to the config. `previousName` is what
   * it was called when it is renamed. Rejects with a text for the user.
   */
  abstract saveHost(host: RemoteHostSettings, previousName?: string): Promise<void>;
  /**
   * Saves a paired machine's name and how it is reached. Rejects with a
   * text for the user.
   */
  abstract savePairedHost(previousName: string, host: PairedHostSettings): Promise<void>;
  /**
   * Takes a machine out of the config and hangs up on it, or removes the
   * pairing with it here and there.
   */
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
