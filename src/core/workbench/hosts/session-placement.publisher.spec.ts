import { TerminalPlacement } from "@cogno/core/api/terminal-placement-port";
import { SessionFact } from "@cogno/core/session/session-facts";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionLabelPublisher } from "./session-label.publisher";

type FakeSession = {
  terminalId: string;
  host: {
    runtime$: BehaviorSubject<{ status: string }>;
    runtime: { status: string };
    facts$: Subject<SessionFact>;
    state: { cwd?: string; shellContext: { host?: string } };
  };
};

function fakeSession(terminalId: string, remoteHost?: string): FakeSession {
  const runtime$ = new BehaviorSubject({ status: "starting" });
  return {
    terminalId,
    host: {
      runtime$,
      get runtime() {
        return runtime$.value;
      },
      facts$: new Subject<SessionFact>(),
      state: { cwd: undefined, shellContext: { host: remoteHost } },
    },
  };
}

describe("SessionLabelPublisher", () => {
  let entries: FakeSession[];
  let registryChanges: Subject<void>;
  let registryFacts: Subject<{ terminalId: string; fact: SessionFact }>;
  let placementChanges: Subject<void>;
  let placement: Partial<TerminalPlacement> | undefined;
  let label: ReturnType<typeof vi.fn>;

  function start(session: FakeSession): void {
    session.host.runtime$.next({ status: "running" });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    entries = [];
    registryFacts = new Subject();
    registryChanges = new Subject();
    placementChanges = new Subject();
    placement = { workspaceName: "Cogno", tabTitle: "build" };
    label = vi.fn().mockResolvedValue(undefined);
    new SessionLabelPublisher(
      {
        get entries() {
          return entries;
        },
        has: (terminalId: string) => entries.some((entry) => entry.terminalId === terminalId),
        changes$: registryChanges,
        facts$: registryFacts,
      } as never,
      { getPlacement: () => placement, changes$: placementChanges } as never,
      { label } as never,
      { onDestroy: vi.fn() } as never,
    );
  });

  afterEach(() => vi.useRealTimers());

  function add(session: FakeSession): FakeSession {
    entries.push(session);
    registryChanges.next();
    return session;
  }

  it("says where a shell sits once it runs, and not before", () => {
    const session = add(fakeSession("t1"));
    vi.advanceTimersByTime(1000);
    expect(label).not.toHaveBeenCalled();

    session.host.state.cwd = "/home/lars/cogno";
    start(session);
    vi.advanceTimersByTime(1000);

    expect(label).toHaveBeenCalledExactlyOnceWith("t1", {
      workspace: "Cogno",
      tab: "build",
      title: undefined,
      directory: "/home/lars/cogno",
    });
  });

  it("says it again when title, directory or place changed, and only then", () => {
    const session = add(fakeSession("t1"));
    start(session);
    vi.advanceTimersByTime(1000);
    label.mockClear();

    registryFacts.next({ terminalId: "t1", fact: { type: "titleChanged", title: "vim" } });
    vi.advanceTimersByTime(1000);
    expect(label).toHaveBeenLastCalledWith("t1", expect.objectContaining({ title: "vim" }));

    session.host.state.cwd = "/tmp";
    registryFacts.next({ terminalId: "t1", fact: { type: "cwdReported", cwd: "/tmp" } });
    vi.advanceTimersByTime(1000);
    expect(label).toHaveBeenLastCalledWith("t1", expect.objectContaining({ directory: "/tmp" }));

    placement = { workspaceName: "Other", tabTitle: "build" };
    placementChanges.next();
    vi.advanceTimersByTime(1000);
    expect(label).toHaveBeenLastCalledWith("t1", expect.objectContaining({ workspace: "Other" }));
    expect(label).toHaveBeenCalledTimes(3);

    // Something moved, but not this shell.
    placementChanges.next();
    vi.advanceTimersByTime(1000);
    expect(label).toHaveBeenCalledTimes(3);
  });

  it("leaves the label of a shell of another machine to the Cogno it belongs to", () => {
    start(add(fakeSession("t1", "office")));
    vi.advanceTimersByTime(1000);

    expect(label).not.toHaveBeenCalled();
  });

  it("says a label again that did not arrive", async () => {
    label.mockRejectedValueOnce(new Error("Unknown terminal"));
    start(add(fakeSession("t1")));
    await vi.advanceTimersByTimeAsync(1000);

    placementChanges.next();
    await vi.advanceTimersByTimeAsync(1000);

    expect(label).toHaveBeenCalledTimes(2);
  });

  it("lets go of a session that is gone", () => {
    const session = add(fakeSession("t1"));
    start(session);
    vi.advanceTimersByTime(1000);
    label.mockClear();

    entries = [];
    registryChanges.next();
    registryFacts.next({ terminalId: "t1", fact: { type: "titleChanged", title: "late" } });
    vi.advanceTimersByTime(1000);

    expect(session.host.runtime$.observed).toBe(false);
    expect(label).not.toHaveBeenCalled();
  });
});
