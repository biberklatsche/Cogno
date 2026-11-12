import { TerminalId } from "@cogno/shared/domain";
import { Observable } from "rxjs";

/** A machine from `remote.hosts`, and how far the connection to it is. */
export type RemoteHost = {
  readonly name: string;
  /** Where ssh connects. */
  readonly destination: string;
  /** What ssh runs there to reach the Cogno; the default when left out. */
  readonly command?: string;
  readonly connection: "disconnected" | "connecting" | "connected" | "failed";
  /** Why the connection failed; only while `failed`. */
  readonly failure?: string;
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
  /** Whether a Cogno shows it right now. */
  readonly shown: boolean;
  /** Whether that Cogno is this one. */
  readonly shownHere: boolean;
  /** What the machine of the Cogno that shows it is called, when it said. */
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
   * Writes a machine to the config. `previousName` is what it was called
   * when it is renamed. Rejects with a text for the user.
   */
  abstract saveHost(host: RemoteHostSettings, previousName?: string): Promise<void>;
  /** Takes a machine out of the config and hangs up on it. */
  abstract removeHost(name: string): Promise<void>;

  /** Settles once the connection stands; how it fails shows on `hosts$`. */
  abstract connect(name: string): Promise<void>;
  /** Hangs up. The machine's shells shown here close; they run on there. */
  abstract disconnect(name: string): Promise<void>;

  /** The shells that run on `host` now; a machine not connected rejects. */
  abstract shells(host: string): Promise<readonly RemoteShell[]>;
  /**
   * Shows the shell in this window: goes to the pane that shows it, takes it
   * back from another Cogno, or opens a tab for it.
   */
  abstract open(host: string, terminalId: TerminalId): Promise<void>;
  /** Ends the shell, whoever shows it. */
  abstract end(host: string, terminalId: TerminalId): Promise<void>;
}
