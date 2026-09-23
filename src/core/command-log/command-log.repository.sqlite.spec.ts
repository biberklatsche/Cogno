// @vitest-environment node
import { DatabaseSync, SQLInputValue, SQLOutputValue } from "node:sqlite";
import type { DatabaseAccessContract } from "@cogno/platform";
import type { IPathAdapter } from "@cogno/shared/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandLogRepository } from "./command-log.repository";
import schema from "./schema/001_init_history.sql?raw";
import indexes from "./schema/003_recent_history_indexes.sql?raw";

describe("command log queries against SQLite", () => {
  let db: DatabaseSync;
  let repository: CommandLogRepository;
  let select: ReturnType<
    typeof vi.fn<
      (sql: string, parameters?: SQLInputValue[]) => Promise<Record<string, SQLOutputValue>[]>
    >
  >;

  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    db.exec(schema);
    db.exec(indexes);
    select = vi.fn(async (sql: string, parameters: SQLInputValue[] = []) => {
      const statement = db.prepare(sql);
      if (!/\?\d/.test(sql)) return statement.all(...parameters);
      statement.setAllowUnknownNamedParameters(true);
      return statement.all(
        Object.fromEntries(parameters.map((value, index) => [`?${index + 1}`, value])),
      );
    });
    repository = await CommandLogRepository.createForContext(
      {
        select,
        execute: async (sql: string, parameters: SQLInputValue[] = []) => {
          const result = db.prepare(sql).run(...parameters);
          return {
            rowsAffected: Number(result.changes),
            lastInsertId: Number(result.lastInsertRowid),
          };
        },
      } as unknown as DatabaseAccessContract,
      { backendOs: "linux", shellType: "Bash" } as never,
      { normalize: (path: string) => path } as IPathAdapter,
    );
    db.exec(`
      INSERT INTO shell_context VALUES (2, 'macos', 'Zsh', '', 0);
      INSERT INTO path VALUES (1, '/work', NULL, 'work', 1, 0), (2, '/other', NULL, 'other', 1, 0);
      INSERT INTO command VALUES (1, 'git status', 0), (2, 'ls', 0), (3, 'pwd', 0);
    `);
  });

  afterEach(() => db.close());

  it.each([
    "global",
    "cwd",
    "session",
  ] as const)("preserves consecutive-repeat collapse, timestamp ties and origin in %s scope", async (scope) => {
    const insert = db.prepare("INSERT INTO command_log VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)");
    const executions = Array.from({ length: 180 }, (_, index) => ({
      id: index + 1,
      context: index % 7 === 0 ? 2 : 1,
      session: index % 3 === 0 ? "other" : "current",
      cwd: index % 4 === 0 ? 2 : 1,
      command: ["git status", "ls", "pwd"][Math.floor(index / 5) % 3],
      commandId: (Math.floor(index / 5) % 3) + 1,
      time: Math.floor(index / 8),
    }));
    for (const row of executions) {
      insert.run(row.id, row.context, row.session, row.cwd, row.commandId, row.time);
    }
    const scoped = executions
      .reverse()
      .filter((row) => row.context === 1)
      .filter((row) => scope !== "cwd" || row.cwd === 1)
      .filter((row) => scope !== "session" || row.session === "current");
    const expected = scoped
      .filter((row, index) => index === 0 || row.command !== scoped[index - 1].command)
      .slice(0, 12)
      .map((row) => ({
        command: row.command,
        executedAt: row.time,
        isCurrentSession: Number(row.session === "current"),
        isCurrentCwd: Number(row.cwd === 1),
      }));

    expect(
      await repository.getRecentCommands({ scope, cwdRaw: "/work", groupId: "current", limit: 12 }),
    ).toEqual(expected);

    // A full temporary sort would defeat LIMIT and scan the unlimited log.
    const [sql, parameters] = select.mock.calls.at(-1)!;
    const plan = await select(`EXPLAIN QUERY PLAN ${sql}`, parameters);
    expect(plan.map((row) => row["detail"]).join("\n")).not.toContain("TEMP B-TREE");
  });

  it.each([
    false,
    true,
  ])("fills the result after a long run of repeats (equal timestamps: %s)", async (equalTimestamps) => {
    db.exec(`
      INSERT INTO command_log VALUES (1, 1, 'current', 1, 2, 1, NULL, NULL);
      WITH RECURSIVE n(x) AS (VALUES(2) UNION ALL SELECT x + 1 FROM n WHERE x < 1200)
      INSERT INTO command_log SELECT x, 1, 'current', 1, 1, x, NULL, NULL FROM n;
    `);
    if (equalTimestamps) db.exec("UPDATE command_log SET executed_at = 1");
    expect(await repository.getRecentCommands({ scope: "global", limit: 2 })).toEqual([
      {
        command: "git status",
        executedAt: equalTimestamps ? 1 : 1200,
        isCurrentSession: 0,
        isCurrentCwd: 0,
      },
      { command: "ls", executedAt: 1, isCurrentSession: 0, isCurrentCwd: 0 },
    ]);
    expect(await repository.getRecentCommands({ scope: "global", limit: 0 })).toEqual([]);
  });

  it("ranks autocomplete with transitions from only the current context and previous command", async () => {
    db.exec(`
      INSERT INTO command_stat VALUES (1, 1, 2, 3, 10, 0, NULL), (1, 2, 2, 2, 20, 1, 30);
      INSERT INTO command_transition_stat VALUES
        (1, 1, 2, 4, 40), (1, 1, 3, 6, 50), (1, 3, 2, 100, 60), (2, 1, 2, 200, 70);
    `);
    const rows = await repository.searchCommands("ls", "/work", "git status");
    expect(rows).toEqual([
      {
        command: "ls",
        execCount: 5,
        selectCount: 1,
        lastExecAt: 20,
        lastSelectAt: 30,
        cwdExecCount: 3,
        cwdSelectCount: 0,
        cwdLastExecAt: 10,
        cwdLastSelectAt: 0,
        transitionCount: 4,
        outgoingTransitionCount: 10,
        lastTransitionAt: 40,
      },
    ]);
    expect((await repository.searchCommands("ls", "/work"))[0].outgoingTransitionCount).toBe(0);
  });
});
