import { ErrorReporter } from "@cogno/app/common/error/error-reporter";
import { Hash } from "@cogno/app/common/hash/hash";
import { DB, IDatabase } from "@cogno/app-tauri/db";
import { IPathAdapter } from "@cogno/core-api";
import { sleep } from "@cogno/core-support";
import { isWslContext, ShellContext } from "../model/models";
import {
  CommandPattern,
  CommandPatternSlotStatistics,
  CommandSignaturePart,
} from "./command-pattern.models";
import { CommandPatternAnalyzer } from "./command-pattern-analyzer";
import { CommandSignatureBuilder } from "./command-signature-builder";
import { CommandTokenClassifier } from "./command-token-classifier";
import { CommandTokenizer } from "./command-tokenizer";

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
  lastSelectAt: number;
};
export type RecentCommandRow = {
  command: string;
  executedAt: number;
  isCurrentSession?: number;
  isCurrentCwd?: number;
};
export type CommandHistoryRow = {
  command: string;
  execCount: number;
  selectCount: number;
  lastExecAt: number;
  lastSelectAt: number;
  cwdExecCount: number;
  cwdSelectCount: number;
  cwdLastExecAt: number;
  cwdLastSelectAt: number;
  transitionCount: number;
  outgoingTransitionCount: number;
  lastTransitionAt: number;
};
type CommandPatternStatRow = {
  signatureKey: string;
  signaturePartsJson: string;
  patternText: string;
  stableTokenCount: number;
  nonOptionStableTokenCount: number;
  variableSlotCount: number;
  totalCount: number;
  lastSeenAt: number;
  selectedCount: number;
  lastSelectedAt?: number;
};
type CommandPatternSlotStatRow = {
  signatureKey: string;
  slotIndex: number;
  totalCount: number;
  distinctValueCount: number;
  topValue: string;
  topValueCount: number;
};
type CommandPatternSlotValueCountRow = {
  valueCount: number;
};
type CommandPatternSlotStatExistingRow = {
  totalCount: number;
  distinctValueCount: number;
  topValue: string;
  topValueCount: number;
};

function nowMs(): number {
  return Date.now();
}

function firstToken(cmd: string): string {
  const t = cmd.trim();
  if (!t) return "";
  const i = t.search(/\s/);
  return i === -1 ? t : t.slice(0, i);
}

function isLockError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : undefined;
  const msg = String(message ?? e ?? "");
  return /database is locked|SQLITE_BUSY|SQLITE_LOCKED|busy|locked/i.test(msg);
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const delaysInMilliseconds = [0, 10, 30, 80];
  let lastError: unknown;

  for (let index = 0; index < delaysInMilliseconds.length; index += 1) {
    try {
      if (delaysInMilliseconds[index] > 0) {
        await sleep(delaysInMilliseconds[index]);
      }
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isLockError(error) || index === delaysInMilliseconds.length - 1) {
        break;
      }
    }
  }

  throw lastError;
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
  private activeDatabase: Pick<IDatabase, "execute" | "select"> | undefined;
  private readonly _pathCache = new Map<string, { id: number; parentId: number | null }>();
  private readonly _commandCache = new Map<string, number>();
  private readonly commandPatternAnalyzer = new CommandPatternAnalyzer(
    new CommandTokenizer(),
    new CommandTokenClassifier(),
    new CommandSignatureBuilder(),
  );

  private constructor(
    private readonly contextId: number,
    private readonly adapter: IPathAdapter,
  ) {}

  static async createForContext(
    shellContext: ShellContext,
    adapter: IPathAdapter,
  ): Promise<HistoryRepository> {
    const contextId = await withRetry(() => HistoryRepository.ensureContextId(shellContext));
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
    const key = HistoryRepository.contextKey(ctx);
    const ts = nowMs();

    await DB.execute(
      `INSERT INTO context(context_key, created_at, deleted_at)
       VALUES(?, ?, NULL)
       ON CONFLICT(context_key) DO UPDATE SET deleted_at = NULL`,
      [key, ts],
    );

    const rows = await DB.select<IdRow[]>(`SELECT id FROM context WHERE context_key = ? LIMIT 1`, [
      key,
    ]);
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
        [this.contextId, cwdId, ts, ts],
      );
    });
  }

  async deleteWorkingDirectory(cwdRaw: string): Promise<void> {
    const ts = nowMs();
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;

    await this.tx(async () => {
      const rows = await this.sel<IdRow[]>(`SELECT id FROM path WHERE path = ? LIMIT 1`, [cwd]);
      if (rows.length === 0) return;

      await this.exec(
        `UPDATE dir_stat
         SET deleted_at = ?
         WHERE context_id = ? AND to_path_id = ? AND deleted_at IS NULL`,
        [ts, this.contextId, rows[0].id],
      );
    });
  }

  async upsertCommandExecution(
    commandRaw: string,
    cwdRaw: string,
    groupId?: string,
    maxEntries?: number,
  ): Promise<void> {
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
        [this.contextId, cwdId, cmdId, ts, ts],
      );
      await this.exec(
        `INSERT INTO command_log(context_id, group_id, cwd_path_id, command_id, executed_at)
         VALUES(?, ?, ?, ?, ?)`,
        [this.contextId, groupId ?? null, cwdId, cmdId, ts],
      );

      if (maxEntries !== undefined && maxEntries > 0) {
        await this.exec(
          `DELETE FROM command_log
           WHERE context_id = ?
             AND id NOT IN (
               SELECT id FROM command_log WHERE context_id = ? ORDER BY executed_at DESC LIMIT ?
             )`,
          [this.contextId, this.contextId, maxEntries],
        );
      }
    });
  }

  async getRecentCommands(options: {
    scope: "global" | "cwd" | "session";
    cwdRaw?: string;
    groupId?: string;
    limit?: number;
  }): Promise<RecentCommandRow[]> {
    const limit = options.limit ?? 50;
    const conditions = ["cl.context_id = ?", "c.deleted_at IS NULL"];
    const params: unknown[] = [this.contextId];

    if (options.scope === "cwd") {
      const cwd = safeNormalize(this.adapter, options.cwdRaw ?? "");
      if (!cwd) return [];
      conditions.push("p.path = ?");
      params.push(cwd);
    } else if (options.scope === "session") {
      if (!options.groupId) return [];
      conditions.push("cl.group_id = ?");
      params.push(options.groupId);
    }

    // Every row is tagged with whether it matches the *current* session/cwd, regardless of
    // scope (SQL's NULL semantics make `column = NULL` false, so this is a no-op when the
    // current session/cwd is unknown). The UI uses this to mark entries that also belong to
    // the narrower "session"/"cwd" scopes, even while viewing a different scope.
    const originParams = [
      options.groupId ?? null,
      safeNormalize(this.adapter, options.cwdRaw ?? "") ?? null,
    ];

    return this.sel<RecentCommandRow[]>(
      `WITH ordered AS (
         SELECT
           c.command_text AS command,
           cl.executed_at AS executedAt,
           CASE WHEN cl.group_id = ? THEN 1 ELSE 0 END AS isCurrentSession,
           CASE WHEN p.path = ? THEN 1 ELSE 0 END AS isCurrentCwd,
           LAG(c.command_text) OVER (ORDER BY cl.executed_at DESC, cl.id DESC) AS prevCommand
         FROM command_log cl
                  JOIN command c ON c.id = cl.command_id
                  LEFT JOIN path p ON p.id = cl.cwd_path_id
         WHERE ${conditions.join(" AND ")}
       )
       SELECT command, executedAt, isCurrentSession, isCurrentCwd
       FROM ordered
       WHERE prevCommand IS NULL OR prevCommand != command
       ORDER BY executedAt DESC
       LIMIT ?`,
      [...originParams, ...params, limit],
    );
  }

  async upsertCommandTransition(previousCommandRaw: string, nextCommandRaw: string): Promise<void> {
    const previousCommand = previousCommandRaw.trim();
    const nextCommand = nextCommandRaw.trim();
    if (!previousCommand || !nextCommand || previousCommand === nextCommand) {
      return;
    }

    const timestamp = nowMs();

    await this.tx(async () => {
      const previousCommandId = await this.ensureCommandId(previousCommand);
      const nextCommandId = await this.ensureCommandId(nextCommand);

      await this.exec(
        `INSERT INTO command_transition_stat(
                    context_id,
                    previous_command_id,
                    next_command_id,
                    transition_count,
                    last_transition_at,
                    created_at,
                    deleted_at
                ) VALUES(?, ?, ?, 1, ?, ?, NULL)
                ON CONFLICT(context_id, previous_command_id, next_command_id) DO UPDATE SET
                    transition_count = command_transition_stat.transition_count + 1,
                    last_transition_at = excluded.last_transition_at,
                    deleted_at = NULL`,
        [this.contextId, previousCommandId, nextCommandId, timestamp, timestamp],
      );

      await this.exec(
        `INSERT INTO command_transition_outgoing_stat(
                    context_id,
                    previous_command_id,
                    outgoing_count,
                    last_transition_at,
                    created_at,
                    deleted_at
                ) VALUES(?, ?, 1, ?, ?, NULL)
                ON CONFLICT(context_id, previous_command_id) DO UPDATE SET
                    outgoing_count = command_transition_outgoing_stat.outgoing_count + 1,
                    last_transition_at = excluded.last_transition_at,
                    deleted_at = NULL`,
        [this.contextId, previousCommandId, timestamp, timestamp],
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
        [command],
      );
      const cwdRows = await this.sel<IdRow[]>(`SELECT id FROM path WHERE path = ? LIMIT 1`, [cwd]);
      if (cmdRows.length === 0 || cwdRows.length === 0) return;

      await this.exec(
        `UPDATE command_stat
                 SET deleted_at = ?
                 WHERE context_id = ? AND cwd_path_id = ? AND command_id = ? AND deleted_at IS NULL`,
        [ts, this.contextId, cwdRows[0].id, cmdRows[0].id],
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
                 ds.last_visit_at AS lastVisitAt,
                 COALESCE(ds.last_select_at, 0) AS lastSelectAt
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
      [this.contextId, q, q, limit],
    );
  }

  async searchCommands(
    fragmentRaw: string,
    cwdRaw: string,
    previousCommandRaw?: string,
    limit: number = 50,
  ): Promise<CommandHistoryRow[]> {
    const fragment = fragmentRaw.trim().toLowerCase();
    const q = `%${fragment}%`;
    const cwd = safeNormalize(this.adapter, cwdRaw) ?? "";
    const previousCommandId = await this.findActiveCommandId(previousCommandRaw);
    return this.sel<CommandHistoryRow[]>(
      `SELECT
                 c.command_text AS command,
                 CAST(SUM(cs.exec_count) AS INTEGER) AS execCount,
                 CAST(SUM(cs.select_count) AS INTEGER) AS selectCount,
                 CAST(MAX(cs.last_exec_at) AS INTEGER) AS lastExecAt,
                 CAST(MAX(COALESCE(cs.last_select_at, 0)) AS INTEGER) AS lastSelectAt,
                 CAST(COALESCE(SUM(CASE WHEN p.path = ? THEN cs.exec_count ELSE 0 END), 0) AS INTEGER) AS cwdExecCount,
                 CAST(COALESCE(SUM(CASE WHEN p.path = ? THEN cs.select_count ELSE 0 END), 0) AS INTEGER) AS cwdSelectCount,
                 CAST(COALESCE(MAX(CASE WHEN p.path = ? THEN cs.last_exec_at ELSE 0 END), 0) AS INTEGER) AS cwdLastExecAt,
                 CAST(COALESCE(MAX(CASE WHEN p.path = ? THEN cs.last_select_at ELSE 0 END), 0) AS INTEGER) AS cwdLastSelectAt,
                 CAST(COALESCE(MAX(commandTransitionStat.transition_count), 0) AS INTEGER) AS transitionCount,
                 CAST(COALESCE(MAX(commandTransitionOutgoingStat.outgoing_count), 0) AS INTEGER) AS outgoingTransitionCount,
                 CAST(COALESCE(MAX(commandTransitionStat.last_transition_at), 0) AS INTEGER) AS lastTransitionAt
             FROM command_stat cs
                      JOIN command c ON c.id = cs.command_id
                      JOIN path p ON p.id = cs.cwd_path_id
                      LEFT JOIN command_transition_stat commandTransitionStat
                                ON commandTransitionStat.context_id = cs.context_id
                               AND commandTransitionStat.previous_command_id = ?
                               AND commandTransitionStat.next_command_id = c.id
                               AND commandTransitionStat.deleted_at IS NULL
                      LEFT JOIN command_transition_outgoing_stat commandTransitionOutgoingStat
                                ON commandTransitionOutgoingStat.context_id = cs.context_id
                               AND commandTransitionOutgoingStat.previous_command_id = ?
                               AND commandTransitionOutgoingStat.deleted_at IS NULL
             WHERE cs.context_id = ?
               AND cs.deleted_at IS NULL
               AND c.deleted_at IS NULL
               AND LOWER(c.command_text) LIKE ?
             GROUP BY c.id
             ORDER BY SUM(cs.select_count) DESC, SUM(cs.exec_count) DESC, MAX(cs.last_exec_at) DESC
             LIMIT ?`,
      [cwd, cwd, cwd, cwd, previousCommandId, previousCommandId, this.contextId, q, limit],
    );
  }

  async searchCommandPatterns(fragmentRaw: string, limit: number = 50): Promise<CommandPattern[]> {
    const fragment = fragmentRaw.trim().toLowerCase();
    if (!fragment) {
      return [];
    }

    const seedToken = firstToken(fragment);
    const q = `%${seedToken}%`;
    const patternRows = await this.sel<CommandPatternStatRow[]>(
      `SELECT
                signature_key AS signatureKey,
                signature_parts_json AS signaturePartsJson,
                pattern_text AS patternText,
                stable_token_count AS stableTokenCount,
                non_option_stable_token_count AS nonOptionStableTokenCount,
                variable_slot_count AS variableSlotCount,
                total_count AS totalCount,
                last_seen_at AS lastSeenAt
                ,selected_count AS selectedCount
                ,last_selected_at AS lastSelectedAt
            FROM command_pattern_stat
            WHERE context_id = ?
              AND deleted_at IS NULL
              AND selected_count > 0
              AND LOWER(pattern_text) LIKE ?
            ORDER BY total_count DESC, last_seen_at DESC
            LIMIT ?`,
      [this.contextId, q, limit],
    );

    if (patternRows.length === 0) {
      return [];
    }

    const signatureKeys = patternRows.map((patternRow) => patternRow.signatureKey);
    const placeholders = signatureKeys.map(() => "?").join(", ");
    const slotRows = await this.sel<CommandPatternSlotStatRow[]>(
      `SELECT
                signature_key AS signatureKey,
                slot_index AS slotIndex,
                total_count AS totalCount,
                distinct_value_count AS distinctValueCount,
                top_value AS topValue,
                top_value_count AS topValueCount
            FROM command_pattern_slot_stat
            WHERE context_id = ?
              AND deleted_at IS NULL
              AND signature_key IN (${placeholders})
            ORDER BY signature_key, slot_index`,
      [this.contextId, ...signatureKeys],
    );

    const slotRowsBySignatureKey = new Map<string, CommandPatternSlotStatistics[]>();
    for (const slotRow of slotRows) {
      const existingSlotRows = slotRowsBySignatureKey.get(slotRow.signatureKey) ?? [];
      existingSlotRows.push({
        slotIndex: slotRow.slotIndex,
        totalCount: slotRow.totalCount,
        distinctValueCount: slotRow.distinctValueCount,
        topValue: slotRow.topValue,
        topValueCount: slotRow.topValueCount,
      });
      slotRowsBySignatureKey.set(slotRow.signatureKey, existingSlotRows);
    }

    return patternRows.map((patternRow) => ({
      signature: {
        key: patternRow.signatureKey,
        parts: JSON.parse(patternRow.signaturePartsJson) as CommandSignaturePart[],
      },
      totalCount: patternRow.totalCount,
      stableTokenCount: patternRow.stableTokenCount,
      nonOptionStableTokenCount: patternRow.nonOptionStableTokenCount,
      variableSlotCount: patternRow.variableSlotCount,
      lastSeenAt: patternRow.lastSeenAt,
      selectedCount: patternRow.selectedCount,
      lastSelectedAt: patternRow.lastSelectedAt ?? undefined,
      slotStatistics: slotRowsBySignatureKey.get(patternRow.signatureKey) ?? [],
    }));
  }

  async confirmLivePattern(originalCommands: string[]): Promise<void> {
    const representative = originalCommands[0]?.trim() ?? "";
    const occurrence = this.commandPatternAnalyzer.analyzeCommand(representative);
    if (!occurrence) return;

    const timestamp = nowMs();
    await this.tx(async () => {
      await this.exec(
        `INSERT INTO command_pattern_stat(
                    context_id,
                    signature_key,
                    signature_parts_json,
                    pattern_text,
                    stable_token_count,
                    non_option_stable_token_count,
                    variable_slot_count,
                    total_count,
                    last_seen_at,
                    selected_count,
                    last_selected_at,
                    created_at,
                    deleted_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, NULL)
                ON CONFLICT(context_id, signature_key) DO UPDATE SET
                    total_count = command_pattern_stat.total_count + 1,
                    selected_count = command_pattern_stat.selected_count + 1,
                    last_seen_at = excluded.last_seen_at,
                    last_selected_at = excluded.last_selected_at,
                    deleted_at = NULL`,
        [
          this.contextId,
          occurrence.signature.key,
          JSON.stringify(occurrence.signature.parts),
          occurrence.patternText,
          occurrence.stableTokenCount,
          occurrence.nonOptionStableTokenCount,
          occurrence.variableSlotCount,
          timestamp,
          timestamp,
          timestamp,
        ],
      );

      for (const cmd of originalCommands) {
        const cmdOccurrence = this.commandPatternAnalyzer.analyzeCommand(cmd.trim());
        if (!cmdOccurrence || cmdOccurrence.signature.key !== occurrence.signature.key) continue;
        for (const slotValue of cmdOccurrence.slotValues) {
          await this.upsertCommandPatternSlotValue(
            occurrence.signature.key,
            slotValue.slotIndex,
            slotValue.value,
            timestamp,
          );
        }
      }
    });
  }

  async markCommandPatternSelected(signatureKeyRaw: string): Promise<void> {
    const signatureKey = signatureKeyRaw.trim();
    if (!signatureKey) {
      return;
    }

    const timestamp = nowMs();
    await this.exec(
      `UPDATE command_pattern_stat
             SET selected_count = selected_count + 1,
                 last_selected_at = ?,
                 deleted_at = NULL
             WHERE context_id = ?
               AND signature_key = ?
               AND deleted_at IS NULL`,
      [timestamp, this.contextId, signatureKey],
    );
  }

  async markDirectorySelected(pathRaw: string): Promise<void> {
    const ts = nowMs();
    const path = safeNormalize(this.adapter, pathRaw);
    if (!path) return;

    await this.tx(async () => {
      const rows = await this.sel<IdRow[]>(
        `SELECT id FROM path WHERE path = ? AND deleted_at IS NULL LIMIT 1`,
        [path],
      );
      if (rows.length === 0) return;

      await this.exec(
        `UPDATE dir_stat
                 SET select_count = select_count + 1,
                     last_select_at = ?,
                     deleted_at = NULL
                 WHERE context_id = ?
                   AND to_path_id = ?
                   AND deleted_at IS NULL`,
        [ts, this.contextId, rows[0].id],
      );
    });
  }

  async markCommandSelected(commandRaw: string, cwdRaw: string): Promise<void> {
    const command = commandRaw.trim();
    if (!command) return;

    const ts = nowMs();
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;

    await this.tx(async () => {
      const cmdRows = await this.sel<IdRow[]>(
        `SELECT id FROM command WHERE command_text = ? AND deleted_at IS NULL LIMIT 1`,
        [command],
      );
      const cwdRows = await this.sel<IdRow[]>(
        `SELECT id FROM path WHERE path = ? AND deleted_at IS NULL LIMIT 1`,
        [cwd],
      );
      if (cmdRows.length === 0 || cwdRows.length === 0) return;

      await this.exec(
        `UPDATE command_stat
                 SET select_count = select_count + 1,
                     last_select_at = ?,
                     deleted_at = NULL
                 WHERE context_id = ?
                   AND cwd_path_id = ?
                   AND command_id = ?
                   AND deleted_at IS NULL`,
        [ts, this.contextId, cwdRows[0].id, cmdRows[0].id],
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
      [pathNorm],
    );

    if (existing.length > 0) {
      const row = existing[0];
      const needsUpdate =
        row.deleted_at != null ||
        row.path_hash !== h ||
        row.basename !== basename ||
        row.depth !== depth ||
        (parentId !== null && row.parent_id !== parentId);

      if (needsUpdate) {
        await this.exec(
          `UPDATE path
                     SET path_hash = ?, basename = ?, depth = ?, parent_id = ?, deleted_at = NULL
                     WHERE id = ?`,
          [h, basename, depth, parentId, row.id],
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
      [pathNorm, h, parentId, basename, depth, ts],
    );

    const rows = await this.sel<PathRow[]>(
      `SELECT id, parent_id FROM path WHERE path = ? LIMIT 1`,
      [pathNorm],
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
      [parentId, childId, ts, ts],
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
      [commandText, h, firstToken(commandText), ts],
    );

    const rows = await this.sel<IdRow[]>(`SELECT id FROM command WHERE command_text = ? LIMIT 1`, [
      commandText,
    ]);
    if (rows.length === 0) throw new Error("ensureCommandId failed");
    this._commandCache.set(commandText, rows[0].id);
    return rows[0].id;
  }

  private async findActiveCommandId(commandTextRaw?: string): Promise<number | null> {
    const commandText = commandTextRaw?.trim();
    if (!commandText) {
      return null;
    }

    const cachedCommandId = this._commandCache.get(commandText);
    if (cachedCommandId !== undefined) {
      return cachedCommandId;
    }

    const rows = await this.sel<IdRow[]>(
      `SELECT id FROM command WHERE command_text = ? AND deleted_at IS NULL LIMIT 1`,
      [commandText],
    );
    if (rows.length === 0) {
      return null;
    }

    this._commandCache.set(commandText, rows[0].id);
    return rows[0].id;
  }

  private async upsertCommandPatternSlotValue(
    signatureKey: string,
    slotIndex: number,
    slotValue: string,
    timestamp: number,
  ): Promise<void> {
    const existingSlotValueRows = await this.sel<CommandPatternSlotValueCountRow[]>(
      `SELECT value_count AS valueCount
             FROM command_pattern_slot_value_stat
             WHERE context_id = ?
               AND signature_key = ?
               AND slot_index = ?
               AND slot_value = ?
             LIMIT 1`,
      [this.contextId, signatureKey, slotIndex, slotValue],
    );
    const existingSlotValueCount = existingSlotValueRows[0]?.valueCount ?? 0;
    const nextSlotValueCount = existingSlotValueCount + 1;
    const isNewDistinctValue = existingSlotValueCount === 0;

    const existingSlotStatRows = await this.sel<CommandPatternSlotStatExistingRow[]>(
      `SELECT
                total_count AS totalCount,
                distinct_value_count AS distinctValueCount,
                top_value AS topValue,
                top_value_count AS topValueCount
             FROM command_pattern_slot_stat
             WHERE context_id = ?
               AND signature_key = ?
               AND slot_index = ?
             LIMIT 1`,
      [this.contextId, signatureKey, slotIndex],
    );

    const existingSlotStat = existingSlotStatRows[0];
    if (existingSlotStat === undefined) {
      await this.exec(
        `INSERT INTO command_pattern_slot_stat(
                    context_id,
                    signature_key,
                    slot_index,
                    total_count,
                    distinct_value_count,
                    top_value,
                    top_value_count,
                    last_seen_at,
                    created_at,
                    deleted_at
                ) VALUES(?, ?, ?, 1, 1, ?, 1, ?, ?, NULL)`,
        [this.contextId, signatureKey, slotIndex, slotValue, timestamp, timestamp],
      );
    } else {
      const nextDistinctValueCount =
        existingSlotStat.distinctValueCount + (isNewDistinctValue ? 1 : 0);
      const shouldReplaceTopValue = nextSlotValueCount > existingSlotStat.topValueCount;
      const nextTopValue = shouldReplaceTopValue ? slotValue : existingSlotStat.topValue;
      const nextTopValueCount = shouldReplaceTopValue
        ? nextSlotValueCount
        : existingSlotStat.topValueCount;

      await this.exec(
        `UPDATE command_pattern_slot_stat
                 SET total_count = ?,
                     distinct_value_count = ?,
                     top_value = ?,
                     top_value_count = ?,
                     last_seen_at = ?,
                     deleted_at = NULL
                 WHERE context_id = ?
                   AND signature_key = ?
                   AND slot_index = ?`,
        [
          existingSlotStat.totalCount + 1,
          nextDistinctValueCount,
          nextTopValue,
          nextTopValueCount,
          timestamp,
          this.contextId,
          signatureKey,
          slotIndex,
        ],
      );
    }

    await this.exec(
      `INSERT INTO command_pattern_slot_value_stat(
                context_id,
                signature_key,
                slot_index,
                slot_value,
                value_count,
                last_seen_at,
                created_at,
                deleted_at
            ) VALUES(?, ?, ?, ?, 1, ?, ?, NULL)
            ON CONFLICT(context_id, signature_key, slot_index, slot_value) DO UPDATE SET
                value_count = command_pattern_slot_value_stat.value_count + 1,
                last_seen_at = excluded.last_seen_at,
                deleted_at = NULL`,
      [this.contextId, signatureKey, slotIndex, slotValue, timestamp, timestamp],
    );
  }

  // ---- DB wrappers with retry + tx ----

  private async exec(query: string, params?: unknown[]): Promise<void> {
    await (this.activeDatabase ?? DB).execute(query, params);
  }

  private async sel<T>(query: string, params?: unknown[]): Promise<T> {
    return (this.activeDatabase ?? DB).select<T>(query, params);
  }

  private async tx(fn: () => Promise<void>): Promise<void> {
    // Prevent nested transactions
    if (this._inTransaction) {
      console.warn("######_inTransaction");
      // Already in a transaction, just execute fn
      await fn();
      return;
    }

    // Retry the entire transaction as a unit
    await withRetry(async () => {
      this._inTransaction = true;
      try {
        await DB.transaction(async (database) => {
          this.activeDatabase = database;
          try {
            await fn();
          } finally {
            this.activeDatabase = undefined;
          }
        });
        this._inTransaction = false;
      } catch (e) {
        ErrorReporter.reportException({
          error: e,
          handled: true,
          source: "HistoryRepository",
          context: {
            operation: "transaction",
          },
        });
        this.activeDatabase = undefined;
        this._inTransaction = false;
        throw e;
      }
    });
  }
}
