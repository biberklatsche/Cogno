import { DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  RemoteHost,
  RemoteHostSettings,
  RemoteShell,
  RemoteShellsPort,
} from "@cogno/core/api/remote-shells-port";

/** What is known of the shells of one machine. */
export type MachineShells =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly shells: readonly RemoteShell[] }
  | { readonly status: "failed"; readonly reason: string };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * What the Remote panel shows: the machines of the config, and the shells
 * that run on every connected one. The shells are read
 * while the panel is open - when it opens, when a machine connects and when
 * the user asks - not watched.
 */
@Injectable({ providedIn: "root" })
export class RemotePanelService {
  private readonly hostsSignal = signal<readonly RemoteHost[]>([]);
  private readonly shellsSignal = signal<ReadonlyMap<string, MachineShells>>(new Map());
  private readonly failureSignal = signal<string | undefined>(undefined);
  private opened = false;

  readonly hosts = this.hostsSignal.asReadonly();
  /** The shells by machine name. */
  readonly shells = this.shellsSignal.asReadonly();
  /** Why the last thing the user asked for did not work. */
  readonly failure = this.failureSignal.asReadonly();

  constructor(
    private readonly port: RemoteShellsPort,
    destroyRef: DestroyRef,
  ) {
    this.port.hosts$.pipe(takeUntilDestroyed(destroyRef)).subscribe((hosts) => {
      this.hostsSignal.set(hosts);
      if (this.opened) this.followConnections();
    });
  }

  open(): void {
    this.opened = true;
    this.refresh();
  }

  close(): void {
    this.opened = false;
    this.shellsSignal.set(new Map());
    this.failureSignal.set(undefined);
  }

  /** Asks every connected machine what runs there now. */
  refresh(): void {
    for (const host of this.hosts()) {
      if (host.connection === "connected") void this.load(host.name);
    }
  }

  connect(name: string): void {
    // How it fails shows on the host itself.
    this.port.connect(name).catch(() => undefined);
  }

  disconnect(name: string): Promise<void> {
    return this.attempt(() => this.port.disconnect(name));
  }

  /** Writes a machine to the config; resolves with why not, if it did not. */
  async saveHost(host: RemoteHostSettings, previousName?: string): Promise<string | undefined> {
    try {
      await this.port.saveHost(host, previousName);
      return undefined;
    } catch (error) {
      return messageOf(error);
    }
  }

  removeHost(name: string): Promise<void> {
    return this.attempt(() => this.port.removeHost(name));
  }

  /** Shows the shell in this window. */
  show(host: string, shell: RemoteShell): Promise<void> {
    return this.attempt(async () => {
      await this.port.open(host, shell.terminalId);
      this.patch(host, (shells) =>
        shells.map((other) =>
          other.terminalId === shell.terminalId
            ? { ...other, shown: true, shownHere: true, shownBy: undefined }
            : other,
        ),
      );
    });
  }

  end(host: string, shell: RemoteShell): Promise<void> {
    return this.attempt(async () => {
      await this.port.end(host, shell.terminalId);
      this.patch(host, (shells) => shells.filter((other) => other.terminalId !== shell.terminalId));
    });
  }

  /** A machine that connected gets its shells read; one that is gone loses them. */
  private followConnections(): void {
    const connected = new Set(
      this.hosts()
        .filter((host) => host.connection === "connected")
        .map((host) => host.name),
    );
    const known = this.shells();
    const kept = new Map([...known].filter(([name]) => connected.has(name)));
    if (kept.size !== known.size) this.shellsSignal.set(kept);
    for (const name of connected) {
      if (!known.has(name)) void this.load(name);
    }
  }

  private async load(host: string): Promise<void> {
    if (!this.shells().has(host)) this.set(host, { status: "loading" });
    let loaded: MachineShells;
    try {
      loaded = { status: "loaded", shells: await this.port.shells(host) };
    } catch (error) {
      loaded = { status: "failed", reason: messageOf(error) };
    }
    // Closed or hung up in the meantime: nobody waits for the answer.
    if (this.shells().has(host)) this.set(host, loaded);
  }

  private patch(
    host: string,
    change: (shells: readonly RemoteShell[]) => readonly RemoteShell[],
  ): void {
    const known = this.shells().get(host);
    if (known?.status === "loaded")
      this.set(host, { status: "loaded", shells: change(known.shells) });
  }

  private set(key: string, shells: MachineShells): void {
    this.shellsSignal.update((known) => new Map(known).set(key, shells));
  }

  private async attempt(action: () => Promise<void>): Promise<void> {
    this.failureSignal.set(undefined);
    try {
      await action();
    } catch (error) {
      this.failureSignal.set(messageOf(error));
    }
  }
}
