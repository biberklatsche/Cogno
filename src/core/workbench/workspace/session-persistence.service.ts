import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { PendingSessionSnapshots } from "@cogno/core/session/host/pending-session-snapshots";
import { SessionSnapshot } from "@cogno/core/session/host/session-snapshot";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { WorkspaceTerminalSession } from "@cogno/shared/domain/workspace";
import { WorkspaceRepository } from "./workspace.repository";

const DEFAULT_MAX_LINES = 1000;

/**
 * Persists a workspace's terminal snapshots for session restore (step 27):
 * collects every terminal's scrollback snapshot synchronously, then writes them
 * in one transaction (no await inside). Gated by terminal.restore.
 */
@Injectable({ providedIn: "root" })
export class SessionPersistenceService {
  constructor(
    private readonly sessionHostFactory: SessionHostFactory,
    private readonly gridListService: GridListService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly configService: ConfigService,
    private readonly pendingSnapshots: PendingSessionSnapshots,
  ) {}

  /**
   * Read the stored snapshots for these workspaces into the pending store so the
   * session-host factory can replay each when it (re)creates the terminal (step
   * 27f). An unreadable snapshot is skipped - that terminal starts without
   * scrollback. No-op when restore is off.
   */
  async loadPendingSnapshots(workspaceIds: ReadonlyArray<string>): Promise<void> {
    if (this.configService.config.terminal?.restore?.enabled === false) {
      return;
    }
    for (const workspaceId of workspaceIds) {
      const sessions = await this.workspaceRepository.getTerminalSessions(workspaceId);
      for (const session of sessions) {
        try {
          this.pendingSnapshots.set(
            session.terminalId,
            JSON.parse(session.sessionData) as SessionSnapshot,
          );
        } catch {
          // Unreadable snapshot: skip; the terminal starts without scrollback.
        }
      }
    }
  }

  /**
   * Record every live session's running command as aborted before the app exits,
   * so a command running at quit isn't lost from history (step 27b-2). Independent
   * of session restore - the command log persists regardless of that setting.
   */
  async recordAbortedCommands(): Promise<void> {
    await Promise.all(
      this.sessionHostFactory.getAllSessionHosts().map((host) => host.recordAbortedCommand()),
    );
  }

  async persistWorkspace(workspaceId: string): Promise<void> {
    const restore = this.configService.config.terminal?.restore;
    if (restore?.enabled === false) {
      return;
    }
    const maxLines = restore?.scrollback === false ? 0 : (restore?.max_lines ?? DEFAULT_MAX_LINES);
    const sessions: WorkspaceTerminalSession[] = this.gridListService
      .terminalIdsForWorkspace(workspaceId)
      .flatMap((terminalId) => {
        const host = this.sessionHostFactory.getSessionHost(terminalId);
        if (host) {
          return [{ terminalId, sessionData: JSON.stringify(host.snapshot(maxLines)) }];
        }
        // A tab not opened this run has no live host to snapshot; carry its
        // still-pending snapshot forward so the delete-then-insert save does not
        // drop it (step 27).
        const pending = this.pendingSnapshots.peek(terminalId);
        return pending ? [{ terminalId, sessionData: JSON.stringify(pending) }] : [];
      });
    await this.workspaceRepository.saveTerminalSessions(workspaceId, sessions);
  }
}
