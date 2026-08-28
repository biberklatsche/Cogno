import { DatabaseAccessContract, DatabaseStatementContract } from "@cogno/platform";
import {
  IPathAdapter,
  isWslShellContext,
  ResolvedShellContextContract,
} from "@cogno/shared/domain";
import type { CommandLogReader, CommandLogWriter } from "./command-log.api";

import {
  CommandPattern,
  CommandPatternSlotStatistics,
  CommandSignaturePart,
} from "./command-pattern.models";
import { CommandPatternAnalyzer } from "./derive/command-pattern-analyzer";
import { CommandSignatureBuilder } from "./derive/command-signature-builder";
import { CommandTokenClassifier } from "./derive/command-token-classifier";
import { CommandTokenizer } from "./derive/command-tokenizer";

type IdRow = { id: number };
type PathSegment = { path: string; basename: string; depth: number };

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
export type CommandExecutionDetails = {
  durationMs?: number;
  returnCode?: number;
};
type CommandPatternStatRow = {
  signatureKey: string;
  signaturePartsJson: string;
  stableTokenCount: number;
  nonOptionStableTokenCount: number;
  variableSlotCount: number;
  totalCount: number;
  lastSeenAt: number;
  selectedCount: number;
  lastSelectedAt: number | null;
};
type CommandPatternSlotStatRow = CommandPatternSlotStatistics & { signatureKey: string };

const PATH_ID = "(SELECT id FROM path WHERE path = ?)";
const COMMAND_ID = "(SELECT id FROM command WHERE command_text = ?)";
/** Trigram FTS needs at least this many characters; shorter fragments use LIKE. */
const FTS_MINIMUM_FRAGMENT_LENGTH = 3;
const BULK_IMPORT_BATCH_SIZE = 500;

function nowMs(): number {
  return Date.now();
}

function firstToken(cmd: string): string {
  const t = cmd.trim();
  if (!t) return "";
  const i = t.search(/\s/);
  return i === -1 ? t : t.slice(0, i);
}

function escapeLike(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Quotes a fragment as one FTS5 phrase so operators inside it are literal. */
function ftsPhrase(fragment: string): string {
  return `"${fragment.replace(/"/g, '""')}"`;
}

function safeNormalize(adapter: IPathAdapter, raw: string): string | undefined {
  try {
    return adapter.normalize(raw);
  } catch {
    return undefined;
  }
}

/**
 * One instance == one shell context + one path adapter.
 * Every write is a single batch, so it either lands completely or not at
 * all; ids are resolved inside the statements rather than round-tripped.
 */
export class CommandLogRepository implements CommandLogWriter, CommandLogReader {
  private readonly commandPatternAnalyzer = new CommandPatternAnalyzer(
    new CommandTokenizer(),
    new CommandTokenClassifier(),
    new CommandSignatureBuilder(),
  );

  private constructor(
    private readonly database: DatabaseAccessContract,
    private readonly contextId: number,
    private readonly adapter: IPathAdapter,
  ) {}

  static async createForContext(
    database: DatabaseAccessContract,
    shellContext: ResolvedShellContextContract,
    adapter: IPathAdapter,
  ): Promise<CommandLogRepository> {
    // The WSL distro affects path normalisation, so it is part of the key.
    const key = [
      shellContext.backendOs,
      shellContext.shellType,
      isWslShellContext(shellContext) ? shellContext.wslDistroName : "",
    ];
    await database.execute(
      `INSERT OR IGNORE INTO shell_context (backend_os, shell_type, wsl_distro, created_at)
       VALUES (?, ?, ?, ?)`,
      [...key, nowMs()],
    );
    const rows = await database.select<IdRow[]>(
      "SELECT id FROM shell_context WHERE backend_os = ? AND shell_type = ? AND wsl_distro = ?",
      key,
    );
    if (rows.length === 0) throw new Error("ensureContextId failed");
    return new CommandLogRepository(database, rows[0].id, adapter);
  }

  async upsertWorkingDirectory(cwdRaw: string): Promise<void> {
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;
    const ts = nowMs();

    await this.database.batch([
      ...this.ensurePathStatements(cwd),
      {
        sql: `INSERT INTO dir_stat (context_id, path_id, visit_count, last_visit_at, select_count, last_select_at)
              VALUES (?, ${PATH_ID}, 1, ?, 0, NULL)
              ON CONFLICT (context_id, path_id) DO UPDATE SET
                  visit_count = dir_stat.visit_count + 1,
                  last_visit_at = excluded.last_visit_at`,
        params: [this.contextId, cwd, ts],
      },
    ]);
  }

  async deleteWorkingDirectory(cwdRaw: string): Promise<void> {
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;
    await this.database.execute(
      `DELETE FROM dir_stat WHERE context_id = ? AND path_id = ${PATH_ID}`,
      [this.contextId, cwd],
    );
  }

  async upsertCommandExecution(
    commandRaw: string,
    cwdRaw: string,
    groupId?: string,
    maxEntries?: number,
    details: CommandExecutionDetails = {},
  ): Promise<void> {
    const command = commandRaw.trim();
    if (!command) return;
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;
    const ts = nowMs();

    const statements: DatabaseStatementContract[] = [
      ...this.ensurePathStatements(cwd),
      this.ensureCommandStatement(command, ts),
      {
        sql: `INSERT INTO command_stat (context_id, cwd_path_id, command_id, exec_count, last_exec_at)
              VALUES (?, ${PATH_ID}, ${COMMAND_ID}, 1, ?)
              ON CONFLICT (context_id, cwd_path_id, command_id) DO UPDATE SET
                  exec_count = command_stat.exec_count + 1,
                  last_exec_at = excluded.last_exec_at`,
        params: [this.contextId, cwd, command, ts],
      },
      {
        sql: `INSERT INTO command_log (context_id, session_id, cwd_path_id, command_id, executed_at, duration_ms, return_code)
              VALUES (?, ?, ${PATH_ID}, ${COMMAND_ID}, ?, ?, ?)`,
        params: [
          this.contextId,
          groupId ?? null,
          cwd,
          command,
          ts,
          details.durationMs ?? null,
          details.returnCode ?? null,
        ],
      },
    ];

    if (maxEntries !== undefined && maxEntries > 0) {
      statements.push({
        sql: `DELETE FROM command_log
              WHERE context_id = ?1
                AND id NOT IN (
                  SELECT id FROM command_log WHERE context_id = ?1 ORDER BY executed_at DESC, id DESC LIMIT ?2
                )`,
        params: [this.contextId, maxEntries],
      });
    }

    await this.database.batch(statements);
  }

  async getRecentCommands(options: {
    scope: "global" | "cwd" | "session";
    cwdRaw?: string;
    groupId?: string;
    limit?: number;
  }): Promise<RecentCommandRow[]> {
    const limit = options.limit ?? 500;
    const cwd = safeNormalize(this.adapter, options.cwdRaw ?? "") || null;
    const sessionId = options.groupId || null;

    let scopeSql = "";
    if (options.scope === "cwd") {
      if (!cwd) return [];
      scopeSql = "AND p.path = ?2";
    } else if (options.scope === "session") {
      if (!sessionId) return [];
      scopeSql = "AND cl.session_id = ?1";
    }

    // Every row is tagged with whether it belongs to the current session /
    // cwd regardless of scope, so the UI can mark entries that also fall
    // into a narrower scope. Consecutive repeats of a command collapse.
    return this.database.select<RecentCommandRow[]>(
      `WITH ordered AS (
         SELECT
           c.command_text AS command,
           cl.executed_at AS executedAt,
           CASE WHEN cl.session_id = ?1 THEN 1 ELSE 0 END AS isCurrentSession,
           CASE WHEN p.path = ?2 THEN 1 ELSE 0 END AS isCurrentCwd,
           LAG(c.command_text) OVER (ORDER BY cl.executed_at DESC, cl.id DESC) AS previous
         FROM command_log cl
         JOIN command c ON c.id = cl.command_id
         JOIN path p ON p.id = cl.cwd_path_id
         WHERE cl.context_id = ?3 ${scopeSql}
       )
       SELECT command, executedAt, isCurrentSession, isCurrentCwd
       FROM ordered
       WHERE previous IS NULL OR previous != command
       ORDER BY executedAt DESC
       LIMIT ?4`,
      [sessionId, cwd, this.contextId, limit],
    );
  }

  async hasAnyCommands(): Promise<boolean> {
    const rows = await this.database.select<{ found: number }[]>(
      "SELECT 1 AS found FROM command_log WHERE context_id = ? LIMIT 1",
      [this.contextId],
    );
    return rows.length > 0;
  }

  async bulkImportCommands(
    entries: { command: string; timestamp: number }[],
    cwdRaw: string,
  ): Promise<void> {
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;
    const valid = entries.filter((entry) => entry.command.trim().length > 0);
    if (valid.length === 0) return;

    for (let offset = 0; offset < valid.length; offset += BULK_IMPORT_BATCH_SIZE) {
      const batch = valid.slice(offset, offset + BULK_IMPORT_BATCH_SIZE);
      await this.database.batch([
        ...this.ensurePathStatements(cwd),
        ...batch.flatMap((entry): DatabaseStatementContract[] => {
          const command = entry.command.trim();
          return [
            this.ensureCommandStatement(command, entry.timestamp),
            {
              sql: `INSERT INTO command_stat (context_id, cwd_path_id, command_id, exec_count, last_exec_at)
                    VALUES (?, ${PATH_ID}, ${COMMAND_ID}, 1, ?)
                    ON CONFLICT (context_id, cwd_path_id, command_id) DO UPDATE SET
                        exec_count = command_stat.exec_count + 1,
                        last_exec_at = MAX(COALESCE(command_stat.last_exec_at, 0), excluded.last_exec_at)`,
              params: [this.contextId, cwd, command, entry.timestamp],
            },
            {
              sql: `INSERT INTO command_log (context_id, session_id, cwd_path_id, command_id, executed_at)
                    VALUES (?, NULL, ${PATH_ID}, ${COMMAND_ID}, ?)`,
              params: [this.contextId, cwd, command, entry.timestamp],
            },
          ];
        }),
      ]);
    }
  }

  async upsertCommandTransition(previousCommandRaw: string, nextCommandRaw: string): Promise<void> {
    const previousCommand = previousCommandRaw.trim();
    const nextCommand = nextCommandRaw.trim();
    if (!previousCommand || !nextCommand || previousCommand === nextCommand) return;
    const ts = nowMs();

    await this.database.batch([
      this.ensureCommandStatement(previousCommand, ts),
      this.ensureCommandStatement(nextCommand, ts),
      {
        sql: `INSERT INTO command_transition_stat
                  (context_id, previous_command_id, next_command_id, transition_count, last_transition_at)
              VALUES (?, ${COMMAND_ID}, ${COMMAND_ID}, 1, ?)
              ON CONFLICT (context_id, previous_command_id, next_command_id) DO UPDATE SET
                  transition_count = command_transition_stat.transition_count + 1,
                  last_transition_at = excluded.last_transition_at`,
        params: [this.contextId, previousCommand, nextCommand, ts],
      },
    ]);
  }

  /** Forgets a command at a directory: its ranking row and its log entries. */
  async deleteCommandExecution(commandRaw: string, cwdRaw: string): Promise<void> {
    const command = commandRaw.trim();
    if (!command) return;
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;

    await this.database.batch([
      {
        sql: `DELETE FROM command_stat WHERE context_id = ? AND cwd_path_id = ${PATH_ID} AND command_id = ${COMMAND_ID}`,
        params: [this.contextId, cwd, command],
      },
      {
        sql: `DELETE FROM command_log WHERE context_id = ? AND cwd_path_id = ${PATH_ID} AND command_id = ${COMMAND_ID}`,
        params: [this.contextId, cwd, command],
      },
    ]);
  }

  async searchDirectories(fragmentRaw: string, limit: number = 50): Promise<DirectoryHistoryRow[]> {
    const q = `%${escapeLike(fragmentRaw.trim().toLowerCase())}%`;
    return this.database.select<DirectoryHistoryRow[]>(
      `SELECT
           p.path AS path,
           p.basename AS basename,
           ds.visit_count AS visitCount,
           ds.select_count AS selectCount,
           ds.last_visit_at AS lastVisitAt,
           COALESCE(ds.last_select_at, 0) AS lastSelectAt
       FROM dir_stat ds
       JOIN path p ON p.id = ds.path_id
       WHERE ds.context_id = ?1
         AND (LOWER(p.path) LIKE ?2 ESCAPE '\\' OR LOWER(p.basename) LIKE ?2 ESCAPE '\\')
       ORDER BY ds.select_count DESC, ds.visit_count DESC, ds.last_visit_at DESC
       LIMIT ?3`,
      [this.contextId, q, limit],
    );
  }

  async searchCommands(
    fragmentRaw: string,
    cwdRaw: string,
    previousCommandRaw?: string,
    limit: number = 50,
  ): Promise<CommandHistoryRow[]> {
    const cwd = safeNormalize(this.adapter, cwdRaw) ?? "";
    const previousCommand = previousCommandRaw?.trim() || null;
    const { sql: filterSql, param: filterParam } = this.commandFilter(fragmentRaw);

    return this.database.select<CommandHistoryRow[]>(
      `SELECT
           c.command_text AS command,
           CAST(SUM(cs.exec_count) AS INTEGER) AS execCount,
           CAST(SUM(cs.select_count) AS INTEGER) AS selectCount,
           CAST(COALESCE(MAX(cs.last_exec_at), 0) AS INTEGER) AS lastExecAt,
           CAST(COALESCE(MAX(cs.last_select_at), 0) AS INTEGER) AS lastSelectAt,
           CAST(COALESCE(SUM(CASE WHEN p.path = ?1 THEN cs.exec_count ELSE 0 END), 0) AS INTEGER) AS cwdExecCount,
           CAST(COALESCE(SUM(CASE WHEN p.path = ?1 THEN cs.select_count ELSE 0 END), 0) AS INTEGER) AS cwdSelectCount,
           CAST(COALESCE(MAX(CASE WHEN p.path = ?1 THEN cs.last_exec_at END), 0) AS INTEGER) AS cwdLastExecAt,
           CAST(COALESCE(MAX(CASE WHEN p.path = ?1 THEN cs.last_select_at END), 0) AS INTEGER) AS cwdLastSelectAt,
           CAST(COALESCE(MAX(t.transition_count), 0) AS INTEGER) AS transitionCount,
           CAST(COALESCE(MAX(outgoing.total), 0) AS INTEGER) AS outgoingTransitionCount,
           CAST(COALESCE(MAX(t.last_transition_at), 0) AS INTEGER) AS lastTransitionAt
       FROM command_stat cs
       JOIN command c ON c.id = cs.command_id
       JOIN path p ON p.id = cs.cwd_path_id
       LEFT JOIN command_transition_stat t
              ON t.context_id = cs.context_id
             AND t.previous_command_id = (SELECT id FROM command WHERE command_text = ?2)
             AND t.next_command_id = c.id
       LEFT JOIN (
           SELECT context_id, previous_command_id, SUM(transition_count) AS total
           FROM command_transition_stat
           GROUP BY context_id, previous_command_id
       ) outgoing
              ON outgoing.context_id = cs.context_id
             AND outgoing.previous_command_id = (SELECT id FROM command WHERE command_text = ?2)
       WHERE cs.context_id = ?3
         ${filterSql}
       GROUP BY c.id
       ORDER BY SUM(cs.select_count) DESC, SUM(cs.exec_count) DESC, MAX(cs.last_exec_at) DESC
       LIMIT ?5`,
      [cwd, previousCommand, this.contextId, filterParam, limit],
    );
  }

  async searchCommandPatterns(fragmentRaw: string, limit: number = 50): Promise<CommandPattern[]> {
    const fragment = fragmentRaw.trim().toLowerCase();
    if (!fragment) return [];

    const q = `%${escapeLike(firstToken(fragment))}%`;
    const patternRows = await this.database.select<CommandPatternStatRow[]>(
      `SELECT
           signature_key AS signatureKey,
           signature_parts_json AS signaturePartsJson,
           stable_token_count AS stableTokenCount,
           non_option_stable_token_count AS nonOptionStableTokenCount,
           variable_slot_count AS variableSlotCount,
           total_count AS totalCount,
           last_seen_at AS lastSeenAt,
           selected_count AS selectedCount,
           last_selected_at AS lastSelectedAt
       FROM command_pattern
       WHERE context_id = ?
         AND selected_count > 0
         AND LOWER(pattern_text) LIKE ? ESCAPE '\\'
       ORDER BY total_count DESC, last_seen_at DESC
       LIMIT ?`,
      [this.contextId, q, limit],
    );
    if (patternRows.length === 0) return [];

    // Slot statistics are derived from the value table, not stored.
    const signatureKeys = patternRows.map((row) => row.signatureKey);
    const placeholders = signatureKeys.map(() => "?").join(", ");
    const slotRows = await this.database.select<CommandPatternSlotStatRow[]>(
      `SELECT
           v.signature_key AS signatureKey,
           v.slot_index AS slotIndex,
           CAST(SUM(v.value_count) AS INTEGER) AS totalCount,
           COUNT(*) AS distinctValueCount,
           (SELECT slot_value FROM command_pattern_slot_value top
             WHERE top.context_id = v.context_id
               AND top.signature_key = v.signature_key
               AND top.slot_index = v.slot_index
             ORDER BY top.value_count DESC, top.last_seen_at DESC, top.slot_value
             LIMIT 1) AS topValue,
           CAST(MAX(v.value_count) AS INTEGER) AS topValueCount
       FROM command_pattern_slot_value v
       WHERE v.context_id = ? AND v.signature_key IN (${placeholders})
       GROUP BY v.signature_key, v.slot_index
       ORDER BY v.signature_key, v.slot_index`,
      [this.contextId, ...signatureKeys],
    );

    const slotsBySignature = new Map<string, CommandPatternSlotStatistics[]>();
    for (const { signatureKey, ...slot } of slotRows) {
      const slots = slotsBySignature.get(signatureKey) ?? [];
      slots.push(slot);
      slotsBySignature.set(signatureKey, slots);
    }

    return patternRows.map((row) => ({
      signature: {
        key: row.signatureKey,
        parts: JSON.parse(row.signaturePartsJson) as CommandSignaturePart[],
      },
      totalCount: row.totalCount,
      stableTokenCount: row.stableTokenCount,
      nonOptionStableTokenCount: row.nonOptionStableTokenCount,
      variableSlotCount: row.variableSlotCount,
      lastSeenAt: row.lastSeenAt,
      selectedCount: row.selectedCount,
      lastSelectedAt: row.lastSelectedAt ?? undefined,
      slotStatistics: slotsBySignature.get(row.signatureKey) ?? [],
    }));
  }

  async confirmLivePattern(originalCommands: string[]): Promise<void> {
    const representative = originalCommands[0]?.trim() ?? "";
    const occurrence = this.commandPatternAnalyzer.analyzeCommand(representative);
    if (!occurrence) return;
    const ts = nowMs();
    const signatureKey = occurrence.signature.key;

    const slotValueStatements = originalCommands.flatMap((cmd): DatabaseStatementContract[] => {
      const cmdOccurrence = this.commandPatternAnalyzer.analyzeCommand(cmd.trim());
      if (!cmdOccurrence || cmdOccurrence.signature.key !== signatureKey) return [];
      return cmdOccurrence.slotValues.map((slotValue) => ({
        sql: `INSERT INTO command_pattern_slot_value
                  (context_id, signature_key, slot_index, slot_value, value_count, last_seen_at)
              VALUES (?, ?, ?, ?, 1, ?)
              ON CONFLICT (context_id, signature_key, slot_index, slot_value) DO UPDATE SET
                  value_count = command_pattern_slot_value.value_count + 1,
                  last_seen_at = excluded.last_seen_at`,
        params: [this.contextId, signatureKey, slotValue.slotIndex, slotValue.value, ts],
      }));
    });

    await this.database.batch([
      {
        sql: `INSERT INTO command_pattern (
                  context_id, signature_key, signature_parts_json, pattern_text,
                  stable_token_count, non_option_stable_token_count, variable_slot_count,
                  total_count, last_seen_at, selected_count, last_selected_at, created_at
              ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, 1, ?8, ?8)
              ON CONFLICT (context_id, signature_key) DO UPDATE SET
                  total_count = command_pattern.total_count + 1,
                  selected_count = command_pattern.selected_count + 1,
                  last_seen_at = excluded.last_seen_at,
                  last_selected_at = excluded.last_selected_at`,
        params: [
          this.contextId,
          signatureKey,
          JSON.stringify(occurrence.signature.parts),
          occurrence.patternText,
          occurrence.stableTokenCount,
          occurrence.nonOptionStableTokenCount,
          occurrence.variableSlotCount,
          ts,
        ],
      },
      ...slotValueStatements,
    ]);
  }

  async markCommandPatternSelected(signatureKeyRaw: string): Promise<void> {
    const signatureKey = signatureKeyRaw.trim();
    if (!signatureKey) return;
    await this.database.execute(
      `UPDATE command_pattern
       SET selected_count = selected_count + 1, last_selected_at = ?
       WHERE context_id = ? AND signature_key = ?`,
      [nowMs(), this.contextId, signatureKey],
    );
  }

  async markDirectorySelected(pathRaw: string): Promise<void> {
    const path = safeNormalize(this.adapter, pathRaw);
    if (!path) return;
    await this.database.execute(
      `UPDATE dir_stat
       SET select_count = select_count + 1, last_select_at = ?
       WHERE context_id = ? AND path_id = ${PATH_ID}`,
      [nowMs(), this.contextId, path],
    );
  }

  async markCommandSelected(commandRaw: string, cwdRaw: string): Promise<void> {
    const command = commandRaw.trim();
    if (!command) return;
    const cwd = safeNormalize(this.adapter, cwdRaw);
    if (!cwd) return;
    await this.database.execute(
      `UPDATE command_stat
       SET select_count = select_count + 1, last_select_at = ?
       WHERE context_id = ? AND cwd_path_id = ${PATH_ID} AND command_id = ${COMMAND_ID}`,
      [nowMs(), this.contextId, cwd, command],
    );
  }

  // ---- statement builders ----

  /**
   * Inserts the directory and every ancestor, root first, so parent ids can
   * be resolved by subselect within the same batch.
   */
  private ensurePathStatements(cwd: string): DatabaseStatementContract[] {
    const chain: PathSegment[] = [];
    const seen = new Set<string>();
    let current: string | null = cwd;
    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push({
        path: current,
        basename: this.adapter.basenameOf(current),
        depth: this.adapter.depthOf(current),
      });
      current = this.adapter.parentOf(current);
    }

    const ts = nowMs();
    return chain.reverse().map((segment, index) => ({
      sql: `INSERT INTO path (path, parent_id, basename, depth, created_at)
            VALUES (?, ${PATH_ID}, ?, ?, ?)
            ON CONFLICT (path) DO UPDATE SET
                parent_id = COALESCE(excluded.parent_id, path.parent_id),
                basename = excluded.basename,
                depth = excluded.depth`,
      params: [segment.path, chain[index - 1]?.path ?? null, segment.basename, segment.depth, ts],
    }));
  }

  private ensureCommandStatement(command: string, ts: number): DatabaseStatementContract {
    return {
      sql: "INSERT OR IGNORE INTO command (command_text, created_at) VALUES (?, ?)",
      params: [command, ts],
    };
  }

  /** Binds to `?4` of the search query. */
  private commandFilter(fragmentRaw: string): { sql: string; param: string | null } {
    const fragment = fragmentRaw.trim();
    if (!fragment) return { sql: "AND ?4 IS NULL", param: null };
    if (fragment.length >= FTS_MINIMUM_FRAGMENT_LENGTH) {
      return {
        sql: "AND c.id IN (SELECT rowid FROM command_fts WHERE command_fts MATCH ?4)",
        param: ftsPhrase(fragment),
      };
    }
    return {
      sql: "AND c.command_text LIKE ?4 ESCAPE '\\'",
      param: `%${escapeLike(fragment)}%`,
    };
  }
}
