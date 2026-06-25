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

  it("also logs the execution to command_log with the given groupId", async () => {
    const transactionDatabase: Pick<IDatabase, "execute" | "select"> = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, parent_id: null }])
        .mockResolvedValueOnce([{ id: 10 }]),
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

    await repository.upsertCommandExecution("npm test", "/workspace", "TE123-abc");

    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO command_log"),
      [7, "TE123-abc", 1, 10, expect.any(Number)],
    );
  });

  it("logs a null groupId when none is provided", async () => {
    const transactionDatabase: Pick<IDatabase, "execute" | "select"> = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, parent_id: null }])
        .mockResolvedValueOnce([{ id: 10 }]),
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

    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO command_log"),
      [7, null, 1, 10, expect.any(Number)],
    );
  });

  it("prunes command_log beyond maxEntries when given", async () => {
    const transactionDatabase: Pick<IDatabase, "execute" | "select"> = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, parent_id: null }])
        .mockResolvedValueOnce([{ id: 10 }]),
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

    await repository.upsertCommandExecution("npm test", "/workspace", undefined, 500);

    expect(transactionDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM command_log"),
      [7, 7, 500],
    );
  });

  it("does not prune command_log when maxEntries is not given", async () => {
    const transactionDatabase: Pick<IDatabase, "execute" | "select"> = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, parent_id: null }])
        .mockResolvedValueOnce([{ id: 10 }]),
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

    const pruneCalls = (transactionDatabase.execute as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([sql]) => sql.includes("DELETE FROM command_log"),
    );
    expect(pruneCalls).toHaveLength(0);
  });

  describe("getRecentCommands", () => {
    function makeRepository(): HistoryRepository {
      return new (
        HistoryRepository as unknown as new (
          contextId: number,
          adapter: IPathAdapter,
        ) => HistoryRepository
      )(7, pathAdapter);
    }

    it("queries globally scoped, without a cwd or group filter, but tags origin", async () => {
      const selectSpy = vi.spyOn(DB, "select").mockResolvedValue([
        { command: "git status", executedAt: 100, isCurrentSession: 0, isCurrentCwd: 0 },
      ] as never);

      const repository = makeRepository();
      const rows = await repository.getRecentCommands({
        scope: "global",
        groupId: "TE123-abc",
        cwdRaw: "/workspace/project",
      });

      expect(rows).toEqual([
        { command: "git status", executedAt: 100, isCurrentSession: 0, isCurrentCwd: 0 },
      ]);
      const [sql, params] = selectSpy.mock.calls[0];
      expect(sql).toContain("FROM command_log cl");
      expect(sql).toContain("LEFT JOIN path p");
      expect(sql).toContain("CASE WHEN cl.group_id = ? THEN 1 ELSE 0 END AS isCurrentSession");
      expect(sql).toContain("CASE WHEN p.path = ? THEN 1 ELSE 0 END AS isCurrentCwd");
      expect(sql).not.toContain("WHERE cl.context_id = ? AND c.deleted_at IS NULL AND");
      expect(params).toEqual(["TE123-abc", "/workspace/project", 7, 50]);
    });

    it("filters by normalized cwd for the cwd scope, while still tagging origin", async () => {
      const selectSpy = vi.spyOn(DB, "select").mockResolvedValue([] as never);

      const repository = makeRepository();
      await repository.getRecentCommands({ scope: "cwd", cwdRaw: "/workspace//project" });

      const [sql, params] = selectSpy.mock.calls[0];
      expect(sql).toContain("p.path = ?");
      expect(sql).toContain("LEFT JOIN path p");
      expect(params).toEqual([null, "/workspace/project", 7, "/workspace/project", 50]);
    });

    it("returns an empty list for cwd scope when cwd cannot be normalized", async () => {
      const repository = makeRepository();
      const rows = await repository.getRecentCommands({ scope: "cwd", cwdRaw: "" });
      expect(rows).toEqual([]);
    });

    it("filters by groupId for the session scope, while still tagging origin", async () => {
      const selectSpy = vi.spyOn(DB, "select").mockResolvedValue([] as never);

      const repository = makeRepository();
      await repository.getRecentCommands({ scope: "session", groupId: "TE123-abc" });

      const [sql, params] = selectSpy.mock.calls[0];
      expect(sql).toContain("cl.group_id = ?");
      expect(sql).toContain("LEFT JOIN path p");
      expect(params).toEqual(["TE123-abc", "", 7, "TE123-abc", 50]);
    });

    it("returns an empty list for session scope when no groupId is given", async () => {
      const repository = makeRepository();
      const rows = await repository.getRecentCommands({ scope: "session" });
      expect(rows).toEqual([]);
    });
  });

  it("confirmLivePattern seeds slot values from all original commands, not just the first", async () => {
    const transactionDatabase: Pick<IDatabase, "execute" | "select"> = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        // command 1 ("npm install express"): slot value check → none; slot stat check → none
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        // command 2 ("npm install react"): slot value check → none; slot stat → exists
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { totalCount: 1, distinctValueCount: 1, topValue: "express", topValueCount: 1 },
        ])
        // command 3 ("npm install lodash"): slot value check → none; slot stat → exists
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { totalCount: 2, distinctValueCount: 2, topValue: "express", topValueCount: 1 },
        ]),
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

    await repository.confirmLivePattern([
      "npm install express",
      "npm install react",
      "npm install lodash",
    ]);

    const executeCalls = (transactionDatabase.execute as ReturnType<typeof vi.fn>).mock.calls as [
      string,
      unknown[],
    ][];
    const slotValueInserts = executeCalls.filter(([sql]) =>
      sql.includes("command_pattern_slot_value_stat"),
    );
    expect(slotValueInserts).toHaveLength(3);
  });

  it("returns parsed command patterns and updates selected counter", async () => {
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
        selectedCount: 1,
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

    await repository.markCommandPatternSelected("sig-1");

    expect(selectSpy).toHaveBeenCalledTimes(2);
    expect(executeSpy).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE command_pattern_stat"),
      expect.arrayContaining([7, "sig-1"]),
    );
  });
});
