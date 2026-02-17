import {IPathAdapter} from "../adapter/base/path-adapter.interface";
import {DB} from "../../../../_tauri/db";
import {isWslContext, ShellContext} from "../model/models";
import {Hash} from "../../../../common/hash/hash";

type IdRow = { id: number };
type PathRow = {
    id: number;
    parent_id?: number | null;
    path_hash?: number | null;
    basename?: string | null;
    depth?: number | null;
    deleted_at?: number | null;
};
export type DirectoryHistoryRow = {
    path: string;
    basename: string;
    visitCount: number;
    selectCount: number;
    lastVisitAt: number;
};
export type CommandHistoryRow = {
    command: string;
    execCount: number;
    selectCount: number;
    lastExecAt: number;
};

function nowMs(): number { return Date.now(); }

function firstToken(cmd: string): string {
    const t = cmd.trim();
    if (!t) return "";
    const i = t.search(/\s/);
    return i === -1 ? t : t.slice(0, i);
}

function isLockError(e: unknown): boolean {
    const msg = String((e as any)?.message ?? e ?? "");
    return /database is locked|SQLITE_BUSY|SQLITE_LOCKED|busy|locked/i.test(msg);
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function safeNormalize(adapter: IPathAdapter, raw: string): string | undefined {
    try {
        return adapter.normalize(raw);
    } catch {
        return undefined;
    }
}

/**
 * One instance == one contextId + one path adapter.
 * Create via HistoryRepositoryFactory.
 */
export class HistoryRepository {
    private _inTransaction = false;
    private readonly _pathCache = new Map<string, { id: number; parentId: number | null }>();
    private readonly _commandCache = new Map<string, number>();

    private constructor(
        private readonly contextId: number,
        private readonly adapter: IPathAdapter,
    ) {}

    static async createForContext(shellContext: ShellContext, adapter: IPathAdapter): Promise<HistoryRepository> {
        const contextId = await HistoryRepository.ensureContextId(shellContext);
        return new HistoryRepository(contextId, adapter);
    }

    private static contextKey(ctx: ShellContext): string {
        // include only fields that define behavior/normalization
        const base = `backendOs=${ctx.backendOs}|shell=${ctx.shellType}`;

        if (isWslContext(ctx)) {
            // distro affects path normalization -> must be part of the key
            return `${base}|wsl=${ctx.wslDistroName}`;
        }

        return base;
    }


    private static async ensureContextId(ctx: ShellContext): Promise<number> {
        const key = this.contextKey(ctx);
        const ts = nowMs();

        await DB.execute(
            `INSERT INTO context(context_key, created_at, deleted_at)
       VALUES(?, ?, NULL)
       ON CONFLICT(context_key) DO UPDATE SET deleted_at = NULL`,
            [key, ts]
        );

        const rows = await DB.select<IdRow[]>(
            `SELECT id FROM context WHERE context_key = ? LIMIT 1`,
            [key]
        );
        if (rows.length === 0) throw new Error("ensureContextId failed");
        return rows[0].id;
    }

    async upsertWorkingDirectory(cwdRaw: string): Promise<void> {
        const ts = nowMs();
        const cwd = safeNormalize(this.adapter, cwdRaw);
        if (!cwd) return;
        const parent = this.adapter.parentOf(cwd);

        await this.tx(async () => {
            const cwdId = await this.ensurePathId(cwd, parent);

            // optional tree learning
            if (parent) {
                const parentId = await this.ensurePathId(parent, this.adapter.parentOf(parent));
                await this.upsertDirectoryEdge(parentId, cwdId, ts);
            }

            await this.exec(
                `INSERT INTO dir_stat(
           context_id, to_path_id,
           visit_count, last_visit_at,
           select_count, last_select_at,
           created_at, deleted_at
         ) VALUES(?, ?, 1, ?, 0, NULL, ?, NULL)
         ON CONFLICT(context_id, to_path_id) DO UPDATE SET
           visit_count = dir_stat.visit_count + 1,
           last_visit_at = excluded.last_visit_at,
           deleted_at = NULL`,
                [this.contextId, cwdId, ts, ts]
            );
        });
    }

    async deleteWorkingDirectory(cwdRaw: string): Promise<void> {
        const ts = nowMs();
        const cwd = safeNormalize(this.adapter, cwdRaw);
        if (!cwd) return;

        await this.tx(async () => {
            const rows = await this.sel<IdRow[]>(
                `SELECT id FROM path WHERE path = ? LIMIT 1`,
                [cwd]
            );
            if (rows.length === 0) return;

            await this.exec(
                `UPDATE dir_stat
         SET deleted_at = ?
         WHERE context_id = ? AND to_path_id = ? AND deleted_at IS NULL`,
                [ts, this.contextId, rows[0].id]
            );
        });
    }

    async upsertCommandExecution(commandRaw: string, cwdRaw: string): Promise<void> {
        const command = commandRaw.trim();
        if (!command) return;

        const ts = nowMs();
        const cwd = safeNormalize(this.adapter, cwdRaw);
        if (!cwd) return;
        const parent = this.adapter.parentOf(cwd);

        await this.tx(async () => {
            const cwdId = await this.ensurePathId(cwd, parent);
            const cmdId = await this.ensureCommandId(command);

            await this.exec(
                `INSERT INTO command_stat(
                    context_id, cwd_path_id, command_id,
                    exec_count, last_exec_at,
                    select_count, last_select_at,
                    avg_duration_ms, success_count, last_return_code,
                    created_at, deleted_at
                ) VALUES(?, ?, ?, 1, ?, 0, NULL, NULL, 0, NULL, ?, NULL)
                     ON CONFLICT(context_id, cwd_path_id, command_id) DO UPDATE SET
                    exec_count = command_stat.exec_count + 1,
                                                                             last_exec_at = excluded.last_exec_at,
                                                                             deleted_at = NULL`,
                [this.contextId, cwdId, cmdId, ts, ts]
            );
        });
    }

    async deleteCommandExecution(commandRaw: string, cwdRaw: string): Promise<void> {
        const command = commandRaw.trim();
        if (!command) return;

        const ts = nowMs();
        const cwd = safeNormalize(this.adapter, cwdRaw);
        if (!cwd) return;

        await this.tx(async () => {
            const cmdRows = await this.sel<IdRow[]>(
                `SELECT id FROM command WHERE command_text = ? LIMIT 1`,
                [command]
            );
            const cwdRows = await this.sel<IdRow[]>(
                `SELECT id FROM path WHERE path = ? LIMIT 1`,
                [cwd]
            );
            if (cmdRows.length === 0 || cwdRows.length === 0) return;

            await this.exec(
                `UPDATE command_stat
                 SET deleted_at = ?
                 WHERE context_id = ? AND cwd_path_id = ? AND command_id = ? AND deleted_at IS NULL`,
                [ts, this.contextId, cwdRows[0].id, cmdRows[0].id]
            );
        });
    }

    async searchDirectories(fragmentRaw: string, limit: number = 50): Promise<DirectoryHistoryRow[]> {
        const fragment = fragmentRaw.trim().toLowerCase();
        const q = `%${fragment}%`;
        return this.sel<DirectoryHistoryRow[]>(
            `SELECT
                 p.path AS path,
                 p.basename AS basename,
                 ds.visit_count AS visitCount,
                 ds.select_count AS selectCount,
                 ds.last_visit_at AS lastVisitAt
             FROM dir_stat ds
                      JOIN path p ON p.id = ds.to_path_id
             WHERE ds.context_id = ?
               AND ds.deleted_at IS NULL
               AND p.deleted_at IS NULL
               AND (
                 LOWER(p.path) LIKE ?
                 OR LOWER(p.basename) LIKE ?
               )
             ORDER BY ds.select_count DESC, ds.visit_count DESC, ds.last_visit_at DESC
             LIMIT ?`,
            [this.contextId, q, q, limit]
        );
    }

    async searchCommands(fragmentRaw: string, limit: number = 50): Promise<CommandHistoryRow[]> {
        const fragment = fragmentRaw.trim().toLowerCase();
        const q = `%${fragment}%`;
        return this.sel<CommandHistoryRow[]>(
            `SELECT
                 c.command_text AS command,
                 CAST(SUM(cs.exec_count) AS INTEGER) AS execCount,
                 CAST(SUM(cs.select_count) AS INTEGER) AS selectCount,
                 CAST(MAX(cs.last_exec_at) AS INTEGER) AS lastExecAt
             FROM command_stat cs
                      JOIN command c ON c.id = cs.command_id
             WHERE cs.context_id = ?
               AND cs.deleted_at IS NULL
               AND c.deleted_at IS NULL
               AND LOWER(c.command_text) LIKE ?
             GROUP BY c.id
             ORDER BY SUM(cs.select_count) DESC, SUM(cs.exec_count) DESC, MAX(cs.last_exec_at) DESC
             LIMIT ?`,
            [this.contextId, q, limit]
        );
    }

    async markDirectorySelected(pathRaw: string): Promise<void> {
        const ts = nowMs();
        const path = safeNormalize(this.adapter, pathRaw);
        if (!path) return;
        const parent = this.adapter.parentOf(path);

        await this.tx(async () => {
            const pathId = await this.ensurePathId(path, parent);
            await this.exec(
                `INSERT INTO dir_stat(
                    context_id, to_path_id,
                    visit_count, last_visit_at,
                    select_count, last_select_at,
                    created_at, deleted_at
                ) VALUES(?, ?, 0, ?, 1, ?, ?, NULL)
                 ON CONFLICT(context_id, to_path_id) DO UPDATE SET
                    select_count = dir_stat.select_count + 1,
                    last_select_at = excluded.last_select_at,
                    deleted_at = NULL`,
                [this.contextId, pathId, ts, ts, ts]
            );
        });
    }

    async markCommandSelected(commandRaw: string, cwdRaw: string): Promise<void> {
        const command = commandRaw.trim();
        if (!command) return;

        const ts = nowMs();
        const cwd = safeNormalize(this.adapter, cwdRaw);
        if (!cwd) return;
        const parent = this.adapter.parentOf(cwd);

        await this.tx(async () => {
            const cwdId = await this.ensurePathId(cwd, parent);
            const cmdId = await this.ensureCommandId(command);

            await this.exec(
                `INSERT INTO command_stat(
                    context_id, cwd_path_id, command_id,
                    exec_count, last_exec_at,
                    select_count, last_select_at,
                    avg_duration_ms, success_count, last_return_code,
                    created_at, deleted_at
                ) VALUES(?, ?, ?, 0, NULL, 1, ?, NULL, 0, NULL, ?, NULL)
                 ON CONFLICT(context_id, cwd_path_id, command_id) DO UPDATE SET
                    select_count = command_stat.select_count + 1,
                    last_select_at = excluded.last_select_at,
                    deleted_at = NULL`,
                [this.contextId, cwdId, cmdId, ts, ts]
            );
        });
    }

    // ---- internals (race-safe UPSERT-first) ----

    private async ensurePathId(pathNorm: string, parentNorm?: string | null): Promise<number> {
        const ts = nowMs();
        const h = Hash.create(pathNorm);
        const basename = this.adapter.basenameOf(pathNorm);
        const depth = this.adapter.depthOf(pathNorm);

        let parentId: number | null = null;
        if (parentNorm) {
            parentId = await this.ensurePathId(parentNorm, this.adapter.parentOf(parentNorm));
        }

        const cached = this._pathCache.get(pathNorm);
        if (cached && cached.parentId === parentId) {
            return cached.id;
        }

        const existing = await this.sel<PathRow[]>(
            `SELECT id, parent_id, path_hash, basename, depth, deleted_at FROM path WHERE path = ? LIMIT 1`,
            [pathNorm]
        );

        if (existing.length > 0) {
            const row = existing[0];
            const needsUpdate =
                row.deleted_at != null
                || row.path_hash !== h
                || row.basename !== basename
                || row.depth !== depth
                || (parentId !== null && row.parent_id !== parentId);

            if (needsUpdate) {
                await this.exec(
                    `UPDATE path
                     SET path_hash = ?, basename = ?, depth = ?, parent_id = ?, deleted_at = NULL
                     WHERE id = ?`,
                    [h, basename, depth, parentId, row.id]
                );
            }

            this._pathCache.set(pathNorm, { id: row.id, parentId });
            return row.id;
        }

        await this.exec(
            `INSERT INTO path(path, path_hash, parent_id, basename, depth, created_at, deleted_at)
       VALUES(?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(path) DO UPDATE SET
         path_hash = excluded.path_hash,
         parent_id = excluded.parent_id,
         basename = excluded.basename,
         depth = excluded.depth,
         deleted_at = NULL`,
            [pathNorm, h, parentId, basename, depth, ts]
        );

        const rows = await this.sel<PathRow[]>(
            `SELECT id, parent_id FROM path WHERE path = ? LIMIT 1`,
            [pathNorm]
        );
        if (rows.length === 0) throw new Error("ensurePathId failed");
        this._pathCache.set(pathNorm, { id: rows[0].id, parentId });
        return rows[0].id;
    }

    private async upsertDirectoryEdge(parentId: number, childId: number, ts: number): Promise<void> {
        await this.exec(
            `INSERT INTO directory_edge(parent_id, child_id, first_seen_at, last_seen_at, seen_count, deleted_at)
       VALUES(?, ?, ?, ?, 1, NULL)
       ON CONFLICT(parent_id, child_id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         seen_count = directory_edge.seen_count + 1,
         deleted_at = NULL`,
            [parentId, childId, ts, ts]
        );
    }

    private async ensureCommandId(commandText: string): Promise<number> {
        const cached = this._commandCache.get(commandText);
        if (cached) return cached;

        const ts = nowMs();
        const h = Hash.create(commandText);

        await this.exec(
            `INSERT INTO command(command_text, command_hash, first_token, created_at, deleted_at)
       VALUES(?, ?, ?, ?, NULL)
       ON CONFLICT(command_text) DO UPDATE SET
         command_hash = excluded.command_hash,
         first_token = excluded.first_token,
         deleted_at = NULL`,
            [commandText, h, firstToken(commandText), ts]
        );

        const rows = await this.sel<IdRow[]>(
            `SELECT id FROM command WHERE command_text = ? LIMIT 1`,
            [commandText]
        );
        if (rows.length === 0) throw new Error("ensureCommandId failed");
        this._commandCache.set(commandText, rows[0].id);
        return rows[0].id;
    }

    // ---- DB wrappers with retry + tx ----

    private async exec(query: string, params?: unknown[]): Promise<void> {
        await DB.execute(query, params);
    }

    private async sel<T>(query: string, params?: unknown[]): Promise<T> {
        return DB.select<T>(query, params);
    }

    private async tx(fn: () => Promise<void>): Promise<void> {
        // Prevent nested transactions
        if (this._inTransaction) {
            // Already in a transaction, just execute fn
            await fn();
            return;
        }

        // Retry the entire transaction as a unit
        await this.withRetry(async () => {
            this._inTransaction = true;
            try {
                await DB.transaction(fn);
                this._inTransaction = false;
            } catch (e) {
                this._inTransaction = false;
                throw e;
            }
        });
    }

    private async withRetry<T>(op: () => Promise<T>): Promise<T> {
        const delays = [0, 10, 30, 80];
        let lastErr: unknown;

        for (let i = 0; i < delays.length; i++) {
            try {
                if (delays[i] > 0) await sleep(delays[i]);
                return await op();
            } catch (e) {
                lastErr = e;
                if (!isLockError(e) || i === delays.length - 1) break;
            }
        }
        throw lastErr;
    }
}
