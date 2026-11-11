// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import type { DatabaseAccess } from "@cogno/platform";
import type { IPathAdapter } from "@cogno/shared/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandLogRepository } from "../command-log.repository";
import schema from "./001_init_history.sql?raw";
import indexes from "./003_recent_history_indexes.sql?raw";
import contextHost from "./004_shell_context_host.sql?raw";

/**
 * The migration rebuilds a table the whole history refers to. It runs the way
 * the app's migration runner runs it: foreign keys on, in one transaction.
 */
describe("migration shell-context-host", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(schema);
    db.exec(indexes);
    db.exec(`
      INSERT INTO shell_context VALUES (1, 'linux', 'Bash', '', 5), (4, 'windows', 'Bash', 'Ubuntu', 6);
      INSERT INTO path VALUES (1, '/work', NULL, 'work', 1, 0);
      INSERT INTO command VALUES (1, 'git status', 0);
      INSERT INTO command_log VALUES (1, 1, 's', 1, 1, 10, NULL, NULL), (2, 4, 's', 1, 1, 11, NULL, NULL);
      INSERT INTO dir_stat (context_id, path_id, last_visit_at) VALUES (4, 1, 12);
    `);
  });

  afterEach(() => db.close());

  function migrate(): void {
    db.exec("BEGIN");
    db.exec(contextHost);
    db.exec("COMMIT");
  }

  function access(): DatabaseAccess {
    return {
      select: async (sql: string, parameters: never[] = []) => db.prepare(sql).all(...parameters),
      execute: async (sql: string, parameters: never[] = []) => {
        const result = db.prepare(sql).run(...parameters);
        return {
          rowsAffected: Number(result.changes),
          lastInsertId: Number(result.lastInsertRowid),
        };
      },
    } as unknown as DatabaseAccess;
  }

  it("keeps every context under its id, as one of this machine", () => {
    migrate();

    expect(db.prepare("SELECT * FROM shell_context ORDER BY id").all()).toEqual([
      { id: 1, backend_os: "linux", shell_type: "Bash", wsl_distro: "", host: "", created_at: 5 },
      {
        id: 4,
        backend_os: "windows",
        shell_type: "Bash",
        wsl_distro: "Ubuntu",
        host: "",
        created_at: 6,
      },
    ]);
  });

  it("leaves the history attached to its contexts", () => {
    migrate();

    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(db.prepare("SELECT id, context_id FROM command_log ORDER BY id").all()).toEqual([
      { id: 1, context_id: 1 },
      { id: 2, context_id: 4 },
    ]);
    expect(db.prepare("SELECT context_id FROM dir_stat").all()).toEqual([{ context_id: 4 }]);
  });

  it("still refuses a history row without a context", () => {
    migrate();

    expect(() =>
      db.exec("INSERT INTO command_log VALUES (3, 99, 's', 1, 1, 12, NULL, NULL)"),
    ).toThrow(/FOREIGN KEY/);
  });

  it("gives a shell on another machine a history of its own", async () => {
    migrate();
    const adapter = { normalize: (path: string) => path } as IPathAdapter;
    const contextOf = async (context: object) => {
      await CommandLogRepository.createForContext(access(), context as never, adapter);
      return db.prepare("SELECT id, host FROM shell_context ORDER BY id").all();
    };

    // This machine's linux bash is the context it always was.
    expect(await contextOf({ backendOs: "linux", shellType: "Bash" })).toHaveLength(2);
    const withBox = await contextOf({ backendOs: "linux", shellType: "Bash", host: "box" });
    expect(withBox).toHaveLength(3);
    expect(withBox.at(-1)).toMatchObject({ host: "box" });
    // The same machine again is the same context.
    expect(await contextOf({ backendOs: "linux", shellType: "Bash", host: "box" })).toHaveLength(3);
  });
});
