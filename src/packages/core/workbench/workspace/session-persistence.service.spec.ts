import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import type { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionPersistenceService } from "./session-persistence.service";
import type { WorkspaceRepository } from "./workspace.repository";

describe("SessionPersistenceService", () => {
  let saveTerminalSessions: ReturnType<typeof vi.fn>;
  let terminalIds: string[];
  let restore: Record<string, unknown> | undefined;
  const snapshotOf = (id: string) => ({ version: 1, scrollback: `SB-${id}` });

  function make(): SessionPersistenceService {
    const factory = {
      getSessionHost: (id: string) => ({ snapshot: vi.fn(() => snapshotOf(id)) }),
    } as unknown as SessionHostFactory;
    const gridList = {
      terminalIdsForWorkspace: () => terminalIds,
    } as unknown as GridListService;
    saveTerminalSessions = vi.fn().mockResolvedValue(undefined);
    const repo = { saveTerminalSessions } as unknown as WorkspaceRepository;
    const config = { config: { terminal: { restore } } } as unknown as ConfigService;
    return new SessionPersistenceService(factory, gridList, repo, config);
  }

  beforeEach(() => {
    terminalIds = ["t1", "t2"];
    restore = { enabled: true, scrollback: true, max_lines: 500 };
  });

  it("saves one snapshot per terminal in a single call", async () => {
    await make().persistWorkspace("ws-1");

    expect(saveTerminalSessions).toHaveBeenCalledTimes(1);
    expect(saveTerminalSessions).toHaveBeenCalledWith("ws-1", [
      { terminalId: "t1", sessionData: JSON.stringify(snapshotOf("t1")) },
      { terminalId: "t2", sessionData: JSON.stringify(snapshotOf("t2")) },
    ]);
  });

  it("does nothing when restore is disabled", async () => {
    restore = { enabled: false };
    await make().persistWorkspace("ws-1");
    expect(saveTerminalSessions).not.toHaveBeenCalled();
  });

  it("captures no scrollback (maxLines 0) when scrollback is off", async () => {
    restore = { enabled: true, scrollback: false, max_lines: 500 };
    const factory = {
      getSessionHost: () => ({ snapshot: vi.fn((maxLines: number) => ({ version: 1, maxLines })) }),
    } as unknown as SessionHostFactory;
    const gridList = { terminalIdsForWorkspace: () => ["t1"] } as unknown as GridListService;
    saveTerminalSessions = vi.fn().mockResolvedValue(undefined);
    const repo = { saveTerminalSessions } as unknown as WorkspaceRepository;
    const config = { config: { terminal: { restore } } } as unknown as ConfigService;
    await new SessionPersistenceService(factory, gridList, repo, config).persistWorkspace("ws-1");

    const saved = saveTerminalSessions.mock.calls[0][1][0];
    expect(JSON.parse(saved.sessionData).maxLines).toBe(0);
  });
});
