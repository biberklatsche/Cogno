import { Injectable } from "@angular/core";
import { TerminalId } from "@cogno/shared/domain";
import { SessionSnapshot } from "./session-snapshot";

/**
 * Snapshots read from the database at startup, waiting for their session to be
 * (re)created (session restore). The workspace loader fills this; the
 * session-host factory takes each one when it spawns the matching terminal and
 * replays it. One-shot: a taken snapshot is not replayed again.
 */
@Injectable({ providedIn: "root" })
export class PendingSessionSnapshots {
  private readonly byTerminalId = new Map<TerminalId, SessionSnapshot>();

  set(terminalId: TerminalId, snapshot: SessionSnapshot): void {
    this.byTerminalId.set(terminalId, snapshot);
  }

  take(terminalId: TerminalId): SessionSnapshot | undefined {
    const snapshot = this.byTerminalId.get(terminalId);
    this.byTerminalId.delete(terminalId);
    return snapshot;
  }

  /**
   * The snapshot still waiting for its terminal, without consuming it. Persisting
   * a workspace uses this for a terminal whose session was not created yet, so
   * the save does not drop its row.
   */
  peek(terminalId: TerminalId): SessionSnapshot | undefined {
    return this.byTerminalId.get(terminalId);
  }

  /** Forget every waiting snapshot, so none is replayed or carried into the next save. */
  clear(): void {
    this.byTerminalId.clear();
  }
}
