import { CommandLogRepository } from "@cogno/core/command-log/command-log.repository";
import type { DatabaseAccess } from "@cogno/platform";
import type { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";
import { firstValueFrom } from "rxjs";
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

  it("drops the oldest write when the queue is full and says so", async () => {
    // No repository yet, so nothing drains and the queue really fills up.
    vi.spyOn(CommandLogRepository, "createForContext").mockReturnValue(new Promise(() => {}));
    const log = new SessionCommandLog(databaseAccess);
    void log.open(shellContext, pathAdapter);

    const ran: string[] = [];
    for (let i = 0; i <= DEFAULT_MAX_PENDING_WRITES; i++) {
      log.write(async () => {
        ran.push(String(i));
      });
    }

    const health = await firstValueFrom(log.health$);
    expect(health.state).toBe("degraded");
    expect(health.reason).toBe("backpressure");
    expect(health.dropped).toBe(1);
    expect(health.pending).toBe(DEFAULT_MAX_PENDING_WRITES);
    expect(ran).toEqual([]);
  });

  it("retries a failing write once before giving up on it", async () => {
    const { log } = await openLog();
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValueOnce(undefined);

    log.write(action);
    await settle();

    expect(action).toHaveBeenCalledTimes(2);
    expect((await firstValueFrom(log.health$)).state).toBe("ok");
  });

  it("counts a write that fails twice as lost", async () => {
    const { log } = await openLog();

    log.write(vi.fn().mockRejectedValue(new Error("disk full")));
    await settle();

    const health = await firstValueFrom(log.health$);
    expect(health.state).toBe("degraded");
    expect(health.reason).toBe("write-error");
    expect(health.dropped).toBe(1);
  });

  it("calls itself unavailable after three failed writes and recovers on the next success", async () => {
    const { log } = await openLog();

    for (let i = 0; i < 3; i++) {
      log.write(vi.fn().mockRejectedValue(new Error("gone")));
      await settle();
    }
    expect((await firstValueFrom(log.health$)).state).toBe("unavailable");

    vi.useFakeTimers();
    log.write(vi.fn().mockResolvedValue(undefined));
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
    await settle();

    const health = await firstValueFrom(log.health$);
    expect(health.state).toBe("ok");
    expect(health.dropped).toBe(3);
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
