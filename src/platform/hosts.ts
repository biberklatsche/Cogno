import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { OsType } from "./os";

/** What a connected host on another machine says about itself. */
export type HostInfo = { os: OsType };

/**
 * A shell that runs on a host, as it was started: the profile's wire form
 * (its environment holds the session's token) and its size.
 */
export type RunningSession = {
  terminalId: string;
  /** Where it sits in the Cogno it belongs to, in that Cogno's words. */
  label: {
    workspace?: string | null;
    tab?: string | null;
    title?: string | null;
    directory?: string | null;
  };
  profile: {
    shell_type: string;
    env?: Record<string, string> | null;
    enable_shell_integration?: boolean | null;
  };
  cols: number;
  rows: number;
  /** Whether a Cogno shows it right now. */
  attached: boolean;
  /** Whether that Cogno is this one. */
  shownHere: boolean;
  /** What the machine of the Cogno that shows it is called, when it said. */
  shownBy?: string | null;
};

/**
 * The machines whose shells Cogno runs: this one, and others reached over
 * ssh with a Cogno there as the other end.
 */
@Injectable({ providedIn: "root" })
export class Hosts {
  /**
   * Connects to the host `name` at the ssh `destination`, unless the
   * connection already stands. What ssh asks on the way arrives as askpass
   * prompts of `promptSession`; the promise settles once they are answered.
   */
  connect(
    name: string,
    destination: string,
    command: string | undefined,
    promptSession: string,
  ): Promise<HostInfo> {
    return invoke<HostInfo>("host_connect", {
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
    devMode: boolean,
  ): Promise<void> {
    return invoke("host_install_shell_integration", {
      version,
      files,
      devMode,
    });
  }

  /**
   * The shells that run on `host`, this machine when none is named. Asking
   * this machine starts its background process if none runs.
   */
  sessions(host: string | undefined): Promise<RunningSession[]> {
    return invoke<RunningSession[]>("host_sessions", { host: host ?? null });
  }

  /**
   * Ends a shell on `host`, this machine when none is named - also one that
   * no window of this Cogno shows.
   */
  endSession(host: string | undefined, terminalId: string): Promise<void> {
    return invoke("host_end_session", { host: host ?? null, terminalId });
  }

  /** Hangs up on the host `name`; `onDisconnected` follows. */
  disconnect(name: string): Promise<void> {
    return invoke("host_disconnect", { name });
  }

  /** The connection to a host ended; its terminals ended with it. */
  onDisconnected(listener: (name: string) => void): Promise<UnlistenFn> {
    return listen<{ host: string }>("host-disconnected", ({ payload }) => listener(payload.host));
  }
}
