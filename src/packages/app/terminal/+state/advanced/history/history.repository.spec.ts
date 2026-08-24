import type { DatabaseAccessContract, DatabaseStatementContract } from "@cogno/platform";
import type { IPathAdapter } from "@cogno/shared/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryRepository } from "./history.repository";

function createPathAdapter(): IPathAdapter {
  return {
    normalize: vi.fn((raw: string) => raw.trim().replace(/\/+/g, "/")),
    parentOf: vi.fn((path: string) => {
      const lastSlashIndex = path.lastIndexOf("/");
      return lastSlashIndex > 0 ? path.slice(0, lastSlashIndex) : null;
    }),
    basenameOf: vi.fn((path: string) => path.split("/").filter(Boolean).at(-1) ?? ""),
    depthOf: vi.fn((path: string) => path.split("/").filter(Boolean).length),
    render: vi.fn((path: string) => path),
  } as unknown as IPathAdapter;
}

type DatabaseDouble = {
  execute: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
};

function createDatabase(): DatabaseDouble {
  return {
    execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 }),
    select: vi.fn().mockResolvedValue([]),
    batch: vi.fn().mockResolvedValue([]),
  };
}

async function createRepository(database: DatabaseDouble): Promise<HistoryRepository> {
  database.select.mockResolvedValueOnce([{ id: 7 }]);
  return HistoryRepository.createForContext(
    database as unknown as DatabaseAccessContract,
    { backendOs: "linux", shellType: "Bash" } as never,
    createPathAdapter(),
  );
}

function batchedStatements(database: DatabaseDouble, call = 0): DatabaseStatementContract[] {
  return database.batch.mock.calls[call][0] as DatabaseStatementContract[];
}

describe("HistoryRepository", () => {
  let database: DatabaseDouble;

  beforeEach(() => {
    database = createDatabase();
  });

  it("resolves the shell context from its parts and keeps the id", async () => {
    await createRepository(database);

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO shell_context"),
      ["linux", "Bash", "", expect.any(Number)],
    );
    expect(database.select).toHaveBeenCalledWith(expect.stringContaining("FROM shell_context"), [
      "linux",
      "Bash",
      "",
    ]);
  });

  it("includes the WSL distro in the context key", async () => {
    database.select.mockResolvedValueOnce([{ id: 1 }]);
    await HistoryRepository.createForContext(
      database as unknown as DatabaseAccessContract,
      { backendOs: "windows", shellType: "Bash", wslDistroName: "Ubuntu" } as never,
      createPathAdapter(),
    );

    expect(database.execute).toHaveBeenCalledWith(expect.any(String), [
      "windows",
      "Bash",
      "Ubuntu",
      expect.any(Number),
    ]);
  });

  it("writes a directory visit and its ancestors in one batch, root first", async () => {
    const repository = await createRepository(database);

    await repository.upsertWorkingDirectory("/workspace//project");

    const statements = batchedStatements(database);
    const pathInserts = statements.filter((s) => s.sql.includes("INSERT INTO path"));
    expect(pathInserts.map((s) => s.params?.[0])).toEqual(["/workspace", "/workspace/project"]);
    expect(pathInserts[0].params?.[1]).toBeNull();
    expect(pathInserts[1].params?.[1]).toBe("/workspace");
    expect(statements.at(-1)?.sql).toContain("INSERT INTO dir_stat");
    expect(statements.at(-1)?.params).toEqual([7, "/workspace/project", expect.any(Number)]);
  });

  it("records an execution as log, ranking row and command in one batch", async () => {
    const repository = await createRepository(database);

    await repository.upsertCommandExecution("npm test", "/workspace", "TE123-abc", undefined, {
      durationMs: 118,
      returnCode: 0,
    });

    const statements = batchedStatements(database);
    expect(statements.some((s) => s.sql.includes("INSERT OR IGNORE INTO command"))).toBe(true);
    expect(statements.some((s) => s.sql.includes("INSERT INTO command_stat"))).toBe(true);
    const log = statements.find((s) => s.sql.includes("INSERT INTO command_log"));
    expect(log?.params).toEqual([
      7,
      "TE123-abc",
      "/workspace",
      "npm test",
      expect.any(Number),
      118,
      0,
    ]);
    expect(statements.some((s) => s.sql.includes("DELETE FROM command_log"))).toBe(false);
  });

  it("logs a null session id and null details when none are given", async () => {
    const repository = await createRepository(database);

    await repository.upsertCommandExecution("npm test", "/workspace");

    const log = batchedStatements(database).find((s) => s.sql.includes("INSERT INTO command_log"));
    expect(log?.params).toEqual([
      7,
      null,
      "/workspace",
      "npm test",
      expect.any(Number),
      null,
      null,
    ]);
  });

  it("trims the log to maxEntries within the same batch", async () => {
    const repository = await createRepository(database);

    await repository.upsertCommandExecution("npm test", "/workspace", undefined, 500);

    const trim = batchedStatements(database).find((s) => s.sql.includes("DELETE FROM command_log"));
    expect(trim?.params).toEqual([7, 500]);
  });

  it("ignores blank commands and unnormalisable directories", async () => {
    const repository = await createRepository(database);

    await repository.upsertCommandExecution("   ", "/workspace");
    await repository.upsertCommandExecution("ls", "");

    expect(database.batch).not.toHaveBeenCalled();
  });

  it("forgets a command at a directory including its log rows", async () => {
    const repository = await createRepository(database);

    await repository.deleteCommandExecution("npm test", "/workspace");

    const statements = batchedStatements(database);
    expect(statements.map((s) => s.sql.split(" ")[2])).toEqual(["command_stat", "command_log"]);
    for (const statement of statements) {
      expect(statement.params).toEqual([7, "/workspace", "npm test"]);
    }
  });

  it("records a transition together with both commands", async () => {
    const repository = await createRepository(database);

    await repository.upsertCommandTransition("git add .", "git commit");
    await repository.upsertCommandTransition("ls", "ls");

    expect(database.batch).toHaveBeenCalledTimes(1);
    const transition = batchedStatements(database).find((s) =>
      s.sql.includes("INSERT INTO command_transition_stat"),
    );
    expect(transition?.params).toEqual([7, "git add .", "git commit", expect.any(Number)]);
  });

  it("imports shell history in batches of 500 entries", async () => {
    const repository = await createRepository(database);
    const entries = Array.from({ length: 1200 }, (_, i) => ({
      command: `cmd${i}`,
      timestamp: i,
    }));

    await repository.bulkImportCommands(entries, "/home/me");

    expect(database.batch).toHaveBeenCalledTimes(3);
    const lastBatch = batchedStatements(database, 2);
    // 200 entries × 3 statements + the path chain
    expect(lastBatch.filter((s) => s.sql.includes("INSERT INTO command_log"))).toHaveLength(200);
  });

  describe("searchCommands", () => {
    it("uses the full-text index for fragments of three characters or more", async () => {
      const repository = await createRepository(database);

      await repository.searchCommands("lint", "/workspace", "pnpm install", 25);

      const [sql, params] = database.select.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("command_fts MATCH ?4");
      expect(params).toEqual(["/workspace", "pnpm install", 7, '"lint"', 25]);
    });

    it("falls back to LIKE for short fragments and escapes wildcards", async () => {
      const repository = await createRepository(database);

      await repository.searchCommands("g%", "/workspace");

      const [sql, params] = database.select.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("c.command_text LIKE ?4");
      expect(params).toEqual(["/workspace", null, 7, "%g\\%%", 50]);
    });

    it("applies no filter for an empty fragment", async () => {
      const repository = await createRepository(database);

      await repository.searchCommands("  ", "/workspace");

      const [sql, params] = database.select.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).not.toContain("MATCH");
      expect(sql).not.toContain("LIKE ?4");
      expect(params[3]).toBeNull();
    });
  });

  describe("getRecentCommands", () => {
    it("queries globally but still tags session and cwd origin", async () => {
      const repository = await createRepository(database);
      database.select.mockResolvedValueOnce([
        { command: "git status", executedAt: 100, isCurrentSession: 0, isCurrentCwd: 1 },
      ]);

      const rows = await repository.getRecentCommands({
        scope: "global",
        groupId: "TE123-abc",
        cwdRaw: "/workspace/project",
      });

      expect(rows).toEqual([
        { command: "git status", executedAt: 100, isCurrentSession: 0, isCurrentCwd: 1 },
      ]);
      const [sql, params] = database.select.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).not.toContain("AND p.path = ?2");
      expect(sql).not.toContain("AND cl.session_id = ?1");
      expect(params).toEqual(["TE123-abc", "/workspace/project", 7, 500]);
    });

    it("filters by the normalised cwd for the cwd scope", async () => {
      const repository = await createRepository(database);

      await repository.getRecentCommands({ scope: "cwd", cwdRaw: "/workspace//project" });

      const [sql, params] = database.select.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("AND p.path = ?2");
      expect(params).toEqual([null, "/workspace/project", 7, 500]);
    });

    it("filters by the session id for the session scope", async () => {
      const repository = await createRepository(database);

      await repository.getRecentCommands({ scope: "session", groupId: "TE123-abc", limit: 10 });

      const [sql, params] = database.select.mock.calls.at(-1) as [string, unknown[]];
      expect(sql).toContain("AND cl.session_id = ?1");
      expect(params).toEqual(["TE123-abc", null, 7, 10]);
    });

    it("returns nothing when the narrowing scope has no key", async () => {
      const repository = await createRepository(database);

      await expect(repository.getRecentCommands({ scope: "cwd", cwdRaw: "" })).resolves.toEqual([]);
      await expect(repository.getRecentCommands({ scope: "session" })).resolves.toEqual([]);
      expect(database.select).toHaveBeenCalledTimes(1);
    });
  });

  it("confirms a pattern with slot values from every matching command", async () => {
    const repository = await createRepository(database);

    await repository.confirmLivePattern([
      "npm install express",
      "npm install react",
      "npm install lodash",
    ]);

    const statements = batchedStatements(database);
    expect(statements[0].sql).toContain("INSERT INTO command_pattern (");
    const slotValues = statements.filter((s) => s.sql.includes("command_pattern_slot_value"));
    expect(slotValues.map((s) => s.params?.[3])).toEqual(["express", "react", "lodash"]);
  });

  it("returns parsed patterns with derived slot statistics", async () => {
    const repository = await createRepository(database);
    database.select
      .mockResolvedValueOnce([
        {
          signatureKey: "sig-1",
          signaturePartsJson: JSON.stringify([{ kind: "stable", value: "npm" }]),
          stableTokenCount: 1,
          nonOptionStableTokenCount: 1,
          variableSlotCount: 1,
          totalCount: 4,
          lastSeenAt: 100,
          selectedCount: 1,
          lastSelectedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          signatureKey: "sig-1",
          slotIndex: 0,
          totalCount: 4,
          distinctValueCount: 2,
          topValue: "test",
          topValueCount: 3,
        },
      ]);

    await expect(repository.searchCommandPatterns("npm")).resolves.toEqual([
      {
        signature: { key: "sig-1", parts: [{ kind: "stable", value: "npm" }] },
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
    const [slotSql, slotParams] = database.select.mock.calls.at(-1) as [string, unknown[]];
    expect(slotSql).toContain("GROUP BY v.signature_key, v.slot_index");
    expect(slotParams).toEqual([7, "sig-1"]);
  });

  it("marks selections without a round trip for ids", async () => {
    const repository = await createRepository(database);

    await repository.markCommandPatternSelected("sig-1");
    await repository.markDirectorySelected("/workspace");
    await repository.markCommandSelected("npm test", "/workspace");

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE command_pattern"),
      [expect.any(Number), 7, "sig-1"],
    );
    expect(database.execute).toHaveBeenCalledWith(expect.stringContaining("UPDATE dir_stat"), [
      expect.any(Number),
      7,
      "/workspace",
    ]);
    expect(database.execute).toHaveBeenCalledWith(expect.stringContaining("UPDATE command_stat"), [
      expect.any(Number),
      7,
      "/workspace",
      "npm test",
    ]);
  });
});
