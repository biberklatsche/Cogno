import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { OsType } from "./os";

/** What a connected host on another machine says about itself. */
export type HostInfo = { os: OsType };

/**
 * Machines other than this one whose shells Cogno runs: each is reached over
 * ssh, with a Cogno there as the other end.
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

  /** The connection to a host ended; its terminals ended with it. */
  onDisconnected(listener: (name: string) => void): Promise<UnlistenFn> {
    return listen<{ host: string }>("host-disconnected", ({ payload }) => listener(payload.host));
  }
}
