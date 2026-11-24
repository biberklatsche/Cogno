import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import type { SessionHost, SessionRuntime } from "@cogno/core/session/host/session-host";
import type { SessionFact } from "@cogno/core/session/session-facts";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  IdentifiedSessionFact,
  IdentifiedSessionRuntime,
  TerminalSessionRegistry,
} from "./terminal-session.registry";

type FakeHost = {
  readonly facts$: Subject<SessionFact>;
  readonly runtime$: BehaviorSubject<SessionRuntime>;
};

function fakeHost(): FakeHost {
  return {
    facts$: new Subject(),
    runtime$: new BehaviorSubject<SessionRuntime>({ status: "starting" } as SessionRuntime),
  };
}

describe("TerminalSessionRegistry", () => {
  let registry: TerminalSessionRegistry;
  let facts: IdentifiedSessionFact[];
  let runtimes: IdentifiedSessionRuntime[];

  beforeEach(() => {
    registry = new TerminalSessionRegistry();
    facts = [];
    runtimes = [];
    registry.facts$.subscribe((fact) => facts.push(fact));
    registry.runtimes$.subscribe((runtime) => runtimes.push(runtime));
  });

  function register(terminalId: string, host: FakeHost): void {
    registry.register(terminalId, {} as ShellProfile, host as unknown as SessionHost);
  }

  it("tags each session's facts with its terminal", () => {
    const host = fakeHost();
    register("t1", host);

    host.facts$.next({ type: "shellGone" } as SessionFact);

    expect(facts).toEqual([{ terminalId: "t1", fact: { type: "shellGone" } }]);
  });

  it("tells each session's runtime once it is registered, then on every change", () => {
    const host = fakeHost();
    register("t1", host);

    host.runtime$.next({ status: "running" } as SessionRuntime);

    expect(runtimes).toEqual([
      { terminalId: "t1", runtime: { status: "starting" } },
      { terminalId: "t1", runtime: { status: "running" } },
    ]);
  });

  it("stops following a session once it is unregistered", () => {
    const host = fakeHost();
    register("t1", host);

    registry.unregister("t1");

    expect(host.facts$.observed).toBe(false);
    expect(host.runtime$.observed).toBe(false);
  });

  it("follows only the newer session when a terminal is registered again", () => {
    const older = fakeHost();
    const newer = fakeHost();
    register("t1", older);
    register("t1", newer);

    expect(older.facts$.observed).toBe(false);
    expect(older.runtime$.observed).toBe(false);
    expect(newer.runtime$.observed).toBe(true);
  });
});
