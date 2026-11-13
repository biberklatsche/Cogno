import { Injectable } from "@angular/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invokeHost } from "./host-error";
import { OsType } from "./os";
import { SessionInfoContract } from "./session-contracts";

/** What a connected host on another machine says about itself. */
export type HostInfo = {
  os: OsType;
  /**
   * The command that reached Cogno there, when the remote names none and the
   * default one did not: worth remembering for the next time.
   */
  foundCommand: string | null;
};

/** To every window: the connection to a host on another machine ended. */
const HOST_DISCONNECTED_EVENT = "host-disconnected";

/**
 * The machines whose shells Cogno shows: this one, and others reached over
 * ssh with a Cogno there as the other end. Every failure is a `HostError`.
 */
@Injectable({ providedIn: "root" })
export class Hosts {
  /**
   * Connects to the host `name` at the ssh `destination`, unless the
   * connection already stands. Without a `command`, the ones Cogno knows are
   * tried in turn. What ssh asks on the way arrives as askpass prompts of
   * `promptSession`; the promise settles once they are answered.
   */
  connect(
    name: string,
    destination: string,
    command: string | undefined,
    promptSession: string,
  ): Promise<HostInfo> {
    return invokeHost<HostInfo>("host_connect", {
      name,
      destination,
      command: command ?? null,
      promptSession,
    });
  }

  /**
   * Makes sure the shell integration scripts of `version` lie in
   * `shell-integration` of this machine's Cogno home. Scripts that are there
   * in this version are left alone.
   */
  installShellIntegration(
    version: string,
    files: ReadonlyArray<{ relativePath: string; content: string }>,
  ): Promise<void> {
    return invokeHost("host_install_shell_integration", { version, files });
  }

  /**
   * The shells that run on `host`, this machine when none is named. Asking
   * this machine starts its background process if none runs.
   */
  sessions(host: string | undefined): Promise<SessionInfoContract[]> {
    return invokeHost<SessionInfoContract[]>("host_sessions", { host: host ?? null });
  }

  /**
   * The shell `terminalId` on `host`, this machine when none is named.
   * Rejects with `sessionNotFound` when it does not run there.
   */
  session(host: string | undefined, terminalId: string): Promise<SessionInfoContract> {
    return invokeHost<SessionInfoContract>("host_session", {
      host: host ?? null,
      terminalId,
    });
  }

  /** Ends a shell on the host `host` on another machine, whoever shows it. */
  killSession(host: string, terminalId: string): Promise<void> {
    return invokeHost("host_kill_session", { host, terminalId });
  }

  /**
   * Hangs up on the host `name`, or gives up connecting to it. Its terminals
   * end as hung up on; their shells run on there.
   */
  disconnect(name: string): Promise<void> {
    return invokeHost("host_disconnect", { name });
  }

  /**
   * Ends this machine's host and the shells in it, whatever its version: for
   * one from an older Cogno that this one cannot talk to (`hostTooOld`). The
   * next terminal starts a host of this Cogno.
   */
  endLocalHost(): Promise<void> {
    return invokeHost("host_end_local");
  }

  /** The connection to a host broke without this Cogno hanging up. */
  onDisconnected(listener: (name: string) => void): Promise<UnlistenFn> {
    return listen<{ host: string }>(HOST_DISCONNECTED_EVENT, ({ payload }) =>
      listener(payload.host),
    );
  }
}
