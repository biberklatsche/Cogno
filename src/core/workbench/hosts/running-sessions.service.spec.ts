import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { Hosts, RunningSession } from "@cogno/platform/hosts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunningSessionsService } from "./running-sessions.service";

function session(terminalId: string): RunningSession {
  return {
    terminalId,
    label: {},
    profile: { shell_type: "Bash", env: { COGNO_SESSION_TOKEN: `token-of-${terminalId}` } },
    shown: false,
    shownHere: false,
  };
}

describe("RunningSessionsService", () => {
  let sessions: ReturnType<typeof vi.fn>;
  let service: RunningSessionsService;

  beforeEach(() => {
    sessions = vi.fn();
    service = new RunningSessionsService({ sessions } as unknown as Hosts);
  });

  afterEach(() => vi.restoreAllMocks());

  it("knows nothing of a host it has not asked", () => {
    expect(service.take(undefined, "t1")).toBeUndefined();
    expect(service.take("office", "t1")).toBeUndefined();
  });

  it("hands a pane the running shell of its terminal, once", async () => {
    sessions.mockResolvedValue([session("t1"), session("t2")]);
    await service.refresh();

    expect(sessions).toHaveBeenCalledWith(undefined);
    expect(service.take(undefined, "t1")).toEqual(session("t1"));
    // The pane shows it now: a second pane of that id would start its own.
    expect(service.take(undefined, "t1")).toBeUndefined();
    expect(service.take(undefined, "t2")).toEqual(session("t2"));
  });

  it("names the shells of this machine that no Cogno shows", async () => {
    sessions.mockImplementation(async (host?: string) =>
      host === "office"
        ? [session("office-1")]
        : [session("left"), { ...session("shown"), shown: true }],
    );
    expect(service.unshownLocalShells()).toEqual([]);

    await service.refresh();
    await service.refresh("office");

    expect(service.unshownLocalShells()).toEqual([session("left")]);
  });

  it("asks a host once for everyone who asks while the answer is on its way", async () => {
    let answer!: (sessions: RunningSession[]) => void;
    sessions.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

    const first = service.refresh("office");
    const second = service.refresh("office");
    answer([session("t1")]);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(sessions).toHaveBeenCalledOnce();
    // Once answered, the next question goes out again.
    sessions.mockResolvedValueOnce([]);
    await service.refresh("office");
    expect(sessions).toHaveBeenCalledTimes(2);
  });

  it("keeps the shells of each host apart", async () => {
    sessions.mockImplementation(async (host?: string) =>
      host === "office" ? [session("office-1")] : [session("local-1")],
    );
    await service.refresh();
    await service.refresh("office");

    expect(service.take("office", "local-1")).toBeUndefined();
    expect(service.take(undefined, "office-1")).toBeUndefined();
    expect(service.take("office", "office-1")).toEqual(session("office-1"));
    expect(service.take(undefined, "local-1")).toEqual(session("local-1"));
  });

  it("replaces what it knew of a host when asked again", async () => {
    sessions.mockResolvedValueOnce([session("t1")]);
    await service.refresh("office");
    sessions.mockResolvedValueOnce([session("t2")]);
    await service.refresh("office");

    expect(service.take("office", "t1")).toBeUndefined();
    expect(service.take("office", "t2")).toEqual(session("t2"));
  });

  it("counts what a host said as current for a moment only", async () => {
    vi.useFakeTimers();
    try {
      sessions.mockResolvedValue([]);
      expect(service.isFresh("office")).toBe(false);

      await service.refresh("office");
      expect(service.isFresh("office")).toBe(true);
      expect(service.isFresh("mac")).toBe(false);

      vi.advanceTimersByTime(5000);
      expect(service.isFresh("office")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("has nothing to go on with when the host does not answer, and reports it", async () => {
    sessions.mockResolvedValueOnce([session("t1")]);
    await service.refresh();
    const error = new Error("The Cogno host did not start");
    sessions.mockRejectedValueOnce(error);
    const reported = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => undefined);

    // Not thrown: the app's start must not hang on it.
    await expect(service.refresh()).resolves.toBe(false);

    expect(service.take(undefined, "t1")).toBeUndefined();
    expect(reported).toHaveBeenCalledWith(expect.objectContaining({ error, handled: true }));
  });
});
