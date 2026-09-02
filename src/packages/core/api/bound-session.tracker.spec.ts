import { TerminalId } from "@cogno/shared/ports";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import { BoundSession } from "./bound-session";
import { BoundRuntimeStatus, BoundSessionTracker } from "./bound-session.tracker";

function setup() {
  const focus$ = new BehaviorSubject<TerminalId | undefined>(undefined);
  const runtimes = new Map<TerminalId, BehaviorSubject<BoundRuntimeStatus>>();
  const runtimeOf = (terminalId: TerminalId) => {
    let subject = runtimes.get(terminalId);
    if (!subject) {
      subject = new BehaviorSubject<BoundRuntimeStatus>("active");
      runtimes.set(terminalId, subject);
    }
    return subject;
  };
  const tracker = new BoundSessionTracker(
    focus$,
    (terminalId) => ({ terminalId, sessionToken: `token-${terminalId}` }),
    runtimeOf,
  );
  const emissions: BoundSession[] = [];
  tracker.boundSession$.subscribe((boundSession) => emissions.push(boundSession));
  return { focus$, runtimeOf, tracker, emissions };
}

describe("BoundSessionTracker", () => {
  it("follows focus while following", () => {
    const { focus$, tracker } = setup();

    focus$.next("t1");
    expect(tracker.boundSession).toEqual({
      status: "active",
      identity: { terminalId: "t1", sessionToken: "token-t1" },
      mode: "following",
    });

    focus$.next("t2");
    expect(tracker.boundSession).toMatchObject({
      status: "active",
      identity: { terminalId: "t2" },
    });
  });

  it("goes unbound when focus clears", () => {
    const { focus$, tracker } = setup();
    focus$.next("t1");

    focus$.next(undefined);

    expect(tracker.boundSession).toEqual({ status: "unbound" });
  });

  it("stays on the held session across focus changes, then release re-follows", () => {
    const { focus$, tracker } = setup();
    focus$.next("t1");

    tracker.hold();
    expect(tracker.boundSession).toMatchObject({ status: "active", mode: "held" });

    focus$.next("t2");
    expect(tracker.boundSession).toMatchObject({
      status: "active",
      identity: { terminalId: "t1" },
      mode: "held",
    });

    tracker.release();
    expect(tracker.boundSession).toMatchObject({
      status: "active",
      identity: { terminalId: "t2" },
      mode: "following",
    });
  });

  it("surfaces closing then closed, and a following binding moves on with the next focus", () => {
    const { focus$, runtimeOf, tracker, emissions } = setup();
    focus$.next("t1");

    runtimeOf("t1").next("closing");
    expect(tracker.boundSession).toEqual({
      status: "closing",
      identity: { terminalId: "t1", sessionToken: "token-t1" },
    });

    runtimeOf("t1").next("closed");
    expect(tracker.boundSession).toEqual({
      status: "closed",
      identity: { terminalId: "t1", sessionToken: "token-t1" },
    });

    // the closed pane's removal focuses another session
    focus$.next("t2");
    expect(tracker.boundSession).toMatchObject({
      status: "active",
      identity: { terminalId: "t2" },
    });

    expect(emissions.map((boundSession) => boundSession.status)).toEqual([
      "unbound",
      "active",
      "closing",
      "closed",
      "active",
    ]);
  });

  it("falls back to unbound when a held session closes", () => {
    const { focus$, runtimeOf, tracker } = setup();
    focus$.next("t1");
    tracker.hold();

    runtimeOf("t1").next("closing");
    expect(tracker.boundSession).toMatchObject({ status: "closing" });

    runtimeOf("t1").next("closed");
    expect(tracker.boundSession).toEqual({ status: "unbound" });

    // following resumes: the next focus binds again
    focus$.next("t2");
    expect(tracker.boundSession).toMatchObject({
      status: "active",
      identity: { terminalId: "t2" },
      mode: "following",
    });
  });
});
