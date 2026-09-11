import { Injectable } from "@angular/core";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
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
  ) {}

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
        if (!host) {
          return [];
        }
        return [{ terminalId, sessionData: JSON.stringify(host.snapshot(maxLines)) }];
      });
    await this.workspaceRepository.saveTerminalSessions(workspaceId, sessions);
  }
}
