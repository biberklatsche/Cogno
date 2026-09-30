import { CommandLogRepository } from "@cogno/core/command-log/command-log.repository";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import type { DatabaseAccess } from "@cogno/platform";
import type { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MAX_PENDING_WRITES, SessionCommandLog } from "./session-command-log";

const shellContext: ResolvedShellContextContract = { shellType: "Bash", backendOs: "macos" };

const pathAdapter: IPathAdapter = {
  normalize: (input: string) => input.trim(),
  render: (cognoPath: string) => cognoPath,
  parentOf: () => null,
  basenameOf: (cognoPath: string) => cognoPath.split("/").at(-1) ?? cognoPath,
  depthOf: (cognoPath: string) => cognoPath.split("/").filter(Boolean).length,
};

const databaseAccess = {} as DatabaseAccess;

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Opens a log whose repository is a stand-in we can make fail on demand. */
async function openLog() {
  const repository = {
    upsertWorkingDirectory: vi.fn().mockResolvedValue(undefined),
  } as unknown as CommandLogRepository;
  vi.spyOn(CommandLogRepository, "createForContext").mockResolvedValue(repository);

  const log = new SessionCommandLog(databaseAccess);
  await log.open(shellContext, pathAdapter);
  await settle();
  return { log, repository };
}

describe("SessionCommandLog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("drops the oldest write when the queue is full", async () => {
    // The repository opens late, so the queue really fills up first.
    let openRepository!: (repository: CommandLogRepository) => void;
    vi.spyOn(CommandLogRepository, "createForContext").mockReturnValue(
      new Promise((resolve) => {
        openRepository = resolve;
      }),
    );
    const log = new SessionCommandLog(databaseAccess);
    void log.open(shellContext, pathAdapter);

    const ran: number[] = [];
    for (let i = 0; i <= DEFAULT_MAX_PENDING_WRITES; i++) {
      log.write(async () => {
        ran.push(i);
      });
    }
    openRepository({} as CommandLogRepository);

    await vi.waitFor(() => expect(ran).toHaveLength(DEFAULT_MAX_PENDING_WRITES));
    expect(ran[0]).toBe(1);
    expect(ran.at(-1)).toBe(DEFAULT_MAX_PENDING_WRITES);
  });

  it("retries a failing write once before giving up on it", async () => {
    const { log } = await openLog();
    const report = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => {});
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValueOnce(undefined);

    log.write(action);
    await settle();

    expect(action).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });

  it("reports a write that fails twice as lost", async () => {
    const { log } = await openLog();
    const report = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => {});

    log.write(vi.fn().mockRejectedValue(new Error("disk full")));
    await settle();

    expect(report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ notify: true, context: { operation: "write", dropped: "1" } }),
    );
  });

  it("notifies once while writes keep failing, backs off, and again after a recovery", async () => {
    const { log } = await openLog();
    const report = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => {});

    for (let i = 0; i < 3; i++) {
      log.write(vi.fn().mockRejectedValue(new Error("gone")));
      await settle();
    }
    expect(report.mock.calls.map(([event]) => event.notify)).toEqual([true, false, false]);

    // Three failures in a row: the next write waits before it runs.
    vi.useFakeTimers();
    const recovered = vi.fn().mockResolvedValue(undefined);
    log.write(recovered);
    await vi.advanceTimersByTimeAsync(0);
    expect(recovered).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
    expect(recovered).toHaveBeenCalledTimes(1);

    log.write(vi.fn().mockRejectedValue(new Error("gone again")));
    await settle();
    expect(report.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ notify: true, context: { operation: "write", dropped: "4" } }),
    );
  });

  it("answers a failed read empty and reports it once while reads keep failing", async () => {
    const { log, repository } = await openLog();
    const report = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => {});
    const searchCommands = vi.fn().mockRejectedValue(new Error("database is locked"));
    Object.assign(repository, { searchCommands });

    await expect(log.searchCommands("g", "/tmp")).resolves.toEqual([]);
    await expect(log.searchCommands("gi", "/tmp")).resolves.toEqual([]);
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0][0]).toEqual(
      expect.objectContaining({ handled: true, context: { operation: "read" } }),
    );

    searchCommands.mockResolvedValueOnce([]);
    await log.searchCommands("git", "/tmp");
    searchCommands.mockRejectedValueOnce(new Error("database is locked"));
    await log.searchCommands("git ", "/tmp");
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("answers queries empty while no repository is open", async () => {
    const log = new SessionCommandLog(undefined);
    await log.open(shellContext, pathAdapter);

    await expect(log.getRecentCommands({ scope: "global" })).resolves.toEqual([]);
    await expect(log.searchCommands("g", "/tmp")).resolves.toEqual([]);
    await expect(log.searchDirectories("t")).resolves.toEqual([]);
    await expect(log.searchCommandPatterns("g")).resolves.toEqual([]);
  });
});
