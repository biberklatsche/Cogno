import { DB, IDatabase } from "@cogno/app-tauri/db";
import { IPathAdapter } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryRepository } from "./history.repository";

function createPathAdapter(): IPathAdapter {
  return {
    normalize: vi.fn((raw: string) => raw.replace(/\/+/g, "/")),
    parentOf: vi.fn((path: string) => {
      const lastSlashIndex = path.lastIndexOf("/");
      return lastSlashIndex > 0 ? path.slice(0, lastSlashIndex) : null;
    }),
    basenameOf: vi.fn((path: string) => path.split("/").filter(Boolean).at(-1) ?? ""),
    depthOf: vi.fn((path: string) => path.split("/").filter(Boolean).length),
    render: vi.fn((path: string) => path),
  } as unknown as IPathAdapter;
}

describe("HistoryRepository", () => {
  let pathAdapter: IPathAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    pathAdapter = createPathAdapter();
  });

  it("creates repositories per shell context and persists the context id", async () => {
    const executeSpy = vi.spyOn(DB, "execute").mockResolvedValue(undefined);
    const selectSpy = vi.spyOn(DB, "select").mockResolvedValue([{ id: 42 }] as never);

    const repository = await HistoryRepository.createForContext(
      {
        backendOs: "linux",
        shellType: "Bash",
      } as never,
      pathAdapter,
    );

    expect(repository).toBeInstanceOf(HistoryRepository);
    expect(executeSpy).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO context"), [
      "backendOs=linux|shell=Bash",
      expect.any(Number),
    ]);
    expect(selectSpy).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM context"), [
      "backendOs=linux|shell=Bash",
    ]);
  });

  it("upserts working directories and directory edges inside a transaction", async () => {
    const transactionDatabase: Pick<IDatabase, "execute" | "select"> = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, parent_id: null }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 2, parent_id: 1 }]),
    };
    vi.spyOn(DB, "transaction").mockImplementation(async (handler) =>
      handler(transactionDatabase as IDatabase),
    );

    const repository = new (
      HistoryRepository as unknown as new (
        contextId: number,
        adapter: IPathAdapter,
      ) => HistoryRepository
    )(7, pathAdapter);

    await repository.upsertWorkingDirectory("/workspace/project");

    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO path"),
      expect.any(Array),
    );
    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO directory_edge"),
      expect.any(Array),
    );
    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dir_stat"),
      expect.any(Array),
    );
  });

  it("upserts and deletes command executions with normalized cwd paths", async () => {
    const transactionDatabase: Pick<IDatabase, "execute" | "select"> = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, parent_id: null }])
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 1 }]),
    };
    vi.spyOn(DB, "transaction").mockImplementation(async (handler) =>
      handler(transactionDatabase as IDatabase),
    );

    const repository = new (
      HistoryRepository as unknown as new (
        contextId: number,
        adapter: IPathAdapter,
      ) => HistoryRepository
    )(7, pathAdapter);

    await repository.upsertCommandExecution("npm test", "/workspace");
    await repository.deleteCommandExecution("npm test", "/workspace");

    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO command("),
      expect.any(Array),
    );
    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO command_stat"),
      expect.any(Array),
    );
    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE command_stat"),
      expect.any(Array),
    );
  });

  it("returns parsed command patterns and updates shown and selected counters", async () => {
    const selectSpy = vi
      .spyOn(DB, "select")
      .mockResolvedValueOnce([
        {
          signatureKey: "sig-1",
          signaturePartsJson: JSON.stringify([{ kind: "stable", value: "npm" }]),
          patternText: "npm <slot>",
          stableTokenCount: 1,
          nonOptionStableTokenCount: 1,
          variableSlotCount: 1,
          totalCount: 4,
          lastSeenAt: 100,
          shownCount: 2,
          selectedCount: 1,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          signatureKey: "sig-1",
          slotIndex: 0,
          totalCount: 4,
          distinctValueCount: 2,
          topValue: "test",
          topValueCount: 3,
        },
      ] as never);
    const executeSpy = vi.spyOn(DB, "execute").mockResolvedValue(undefined);

    const repository = new (
      HistoryRepository as unknown as new (
        contextId: number,
        adapter: IPathAdapter,
      ) => HistoryRepository
    )(7, pathAdapter);

    await expect(repository.searchCommandPatterns("npm")).resolves.toEqual([
      {
        signature: {
          key: "sig-1",
          parts: [{ kind: "stable", value: "npm" }],
        },
        totalCount: 4,
        stableTokenCount: 1,
        nonOptionStableTokenCount: 1,
        variableSlotCount: 1,
        lastSeenAt: 100,
        shownCount: 2,
        selectedCount: 1,
        lastShownAt: undefined,
        lastSelectedAt: undefined,
        slotStatistics: [
          {
            slotIndex: 0,
            totalCount: 4,
            distinctValueCount: 2,
            topValue: "test",
            topValueCount: 3,
          },
        ],
      },
    ]);

    await repository.markCommandPatternsShown(["sig-1", "sig-1", "  "]);
    await repository.markCommandPatternSelected("sig-1");

    expect(selectSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE command_pattern_stat"),
      expect.arrayContaining([7, "sig-1"]),
    );
  });
});
