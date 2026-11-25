import { Injectable } from "@angular/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { HostErrorCode, invokeHost } from "./host-error";
import { OsType } from "./os";
import { SeenSessionContract } from "./session-contracts";

/** What a connected host on another machine says about itself. */
export type HostInfo = {
  os: OsType;
};

/**
 * How far the app's connection to a paired machine is; a machine without
 * one is not connected. The same for every window.
 */
export type HostConnectionContract =
  | { status: "connecting" }
  | ({ status: "connected" } & HostInfo)
  | { status: "failed"; failure: { code: HostErrorCode; message: string } };

/** To every window: what `connections` returns changed. */
const HOST_CONNECTIONS_CHANGED_EVENT = "host-connections-changed";

/**
 * The machines whose shells Cogno shows: this one, and the ones paired with
 * it, with a Cogno there as the other end. Every failure is a `HostError`.
 */
@Injectable({ providedIn: "root" })
export class Hosts {
  /**
   * Connects to the paired machine `id` (ARCHITECTURE.md 2.7.3), unless
   * the connection already stands.
   */
  connect(id: string): Promise<HostInfo> {
    return invokeHost<HostInfo>("host_connect", { id });
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
   * The shells that run on `host`, this machine when none is named.
   */
  sessions(host: string | undefined): Promise<SeenSessionContract[]> {
    return invokeHost<SeenSessionContract[]>("host_sessions", { host: host ?? null });
  }

  /**
   * The shell `terminalId` on `host`, this machine when none is named.
   * Rejects with `sessionNotFound` when it does not run there.
   */
  session(host: string | undefined, terminalId: string): Promise<SeenSessionContract> {
    return invokeHost<SeenSessionContract>("host_session", {
      host: host ?? null,
      terminalId,
    });
  }

  /** Ends a shell on the host `host` on another machine, whoever shows it. */
  killSession(host: string, terminalId: string): Promise<void> {
    return invokeHost("host_kill_session", { host, terminalId });
  }

  /**
   * Hangs up on the host `id`, or gives up connecting to it. Its terminals
   * end as hung up on; their shells run on there.
   */
  disconnect(id: string): Promise<void> {
    return invokeHost("host_disconnect", { id });
  }

  /** How far the connection to each paired machine is, by its id. */
  connections(): Promise<Record<string, HostConnectionContract>> {
    return invokeHost("host_connections");
  }

  /** What `connections` returns changed, whichever window caused it. */
  onConnectionsChanged(listener: () => void): Promise<UnlistenFn> {
    return listen(HOST_CONNECTIONS_CHANGED_EVENT, () => listener());
  }
}
