import {IPathAdapter} from "../adapter/base/path-adapter.interface";
import {DB} from "../../../../_tauri/db";
import {isWslContext, ShellContext} from "../data/models";

type IdRow = { id: number };
type PathRow = { id: number; parent_id?: number | null };

function nowMs(): number { return Date.now(); }

function hash64(input: string): string {
    // Replace with stable hash (xxhash/blake3). Must be stable across OS.
    let h = 0n;
    for (let i = 0; i < input.length; i++) h = (h * 131n + BigInt(input.charCodeAt(i))) & ((1n << 64n) - 1n);
    return h.toString(16).padStart(16, "0");
}

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

/**
 * One instance == one contextId + one path adapter.
 * Create via HistoryRepositoryFactory.
 */
export class HistoryRepository {
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
        const cwd = this.adapter.normalize(cwdRaw);
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
        const cwd = this.adapter.normalize(cwdRaw);
        const cwdHash = hash64(cwd);

        await this.tx(async () => {
            const rows = await this.sel<IdRow[]>(
                `SELECT id FROM path WHERE path_hash = ? LIMIT 1`,
                [cwdHash]
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

        console.log('#####safe',commandRaw,cwdRaw );

        const command = commandRaw.trim();
        if (!command) return;

        const ts = nowMs();
        const cwd = this.adapter.normalize(cwdRaw);
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
        const cwd = this.adapter.normalize(cwdRaw);

        const cmdHash = hash64(command);
        const cwdHash = hash64(cwd);

        await this.tx(async () => {
            const cmdRows = await this.sel<IdRow[]>(
                `SELECT id FROM command WHERE command_hash = ? LIMIT 1`,
                [cmdHash]
            );
            const cwdRows = await this.sel<IdRow[]>(
                `SELECT id FROM path WHERE path_hash = ? LIMIT 1`,
                [cwdHash]
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

    // ---- internals (race-safe UPSERT-first) ----

    private async ensurePathId(pathNorm: string, parentNorm?: string | null): Promise<number> {
        const ts = nowMs();
        const h = hash64(pathNorm);

        await this.exec(
            `INSERT INTO path(path, path_hash, parent_id, basename, depth, created_at, deleted_at)
       VALUES(?, ?, NULL, ?, ?, ?, NULL)
       ON CONFLICT(path_hash) DO UPDATE SET deleted_at = NULL`,
            [pathNorm, h, this.adapter.basenameOf(pathNorm), this.adapter.depthOf(pathNorm), ts]
        );

        const rows = await this.sel<PathRow[]>(
            `SELECT id, parent_id FROM path WHERE path_hash = ? LIMIT 1`,
            [h]
        );
        if (rows.length === 0) throw new Error("ensurePathId failed");
        const id = rows[0].id;

        if (parentNorm) {
            const parentId = await this.ensurePathId(parentNorm, this.adapter.parentOf(parentNorm));
            if (rows[0].parent_id == null || rows[0].parent_id !== parentId) {
                await this.exec(`UPDATE path SET parent_id = ? WHERE id = ?`, [parentId, id]);
            }
        }

        return id;
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
        const ts = nowMs();
        const h = hash64(commandText);

        await this.exec(
            `INSERT INTO command(command_text, command_hash, first_token, created_at, deleted_at)
       VALUES(?, ?, ?, ?, NULL)
       ON CONFLICT(command_hash) DO UPDATE SET deleted_at = NULL`,
            [commandText, h, firstToken(commandText), ts]
        );

        const rows = await this.sel<IdRow[]>(
            `SELECT id FROM command WHERE command_hash = ? LIMIT 1`,
            [h]
        );
        if (rows.length === 0) throw new Error("ensureCommandId failed");
        return rows[0].id;
    }

    // ---- DB wrappers with retry + tx ----

    private async exec(query: string, params?: unknown[]): Promise<void> {
        await this.withRetry(() => DB.execute(query, params));
    }

    private async sel<T>(query: string, params?: unknown[]): Promise<T> {
        return this.withRetry(() => DB.select<T>(query, params));
    }

    private async tx(fn: () => Promise<void>): Promise<void> {
        await this.exec("BEGIN;");
        try {
            await fn();
            await this.exec("COMMIT;");
        } catch (e) {
            await this.exec("ROLLBACK;");
            throw e;
        }
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
