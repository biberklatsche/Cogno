import { TerminalId } from "@cogno/shared/domain";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";
import { SessionBinding } from "./bound-session";
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
  const emissions: SessionBinding[] = [];
  tracker.binding$.subscribe((boundSession) => emissions.push(boundSession));
  return { focus$, runtimeOf, tracker, emissions };
}

describe("BoundSessionTracker", () => {
  it("follows focus while following", () => {
    const { focus$, tracker } = setup();

    focus$.next("t1");
    expect(tracker.binding).toEqual({
      status: "active",
      identity: { terminalId: "t1", sessionToken: "token-t1" },
      mode: "following",
    });

    focus$.next("t2");
    expect(tracker.binding).toMatchObject({
      status: "active",
      identity: { terminalId: "t2" },
    });
  });

  it("goes unbound when focus clears", () => {
    const { focus$, tracker } = setup();
    focus$.next("t1");

    focus$.next(undefined);

    expect(tracker.binding).toEqual({ status: "unbound" });
  });

  it("stays on the held session across focus changes, then release re-follows", () => {
    const { focus$, tracker } = setup();
    focus$.next("t1");

    tracker.hold();
    expect(tracker.binding).toMatchObject({ status: "active", mode: "held" });

    focus$.next("t2");
    expect(tracker.binding).toMatchObject({
      status: "active",
      identity: { terminalId: "t1" },
      mode: "held",
    });

    tracker.release();
    expect(tracker.binding).toMatchObject({
      status: "active",
      identity: { terminalId: "t2" },
      mode: "following",
    });
  });

  it("surfaces closing then closed, and a following binding moves on with the next focus", () => {
    const { focus$, runtimeOf, tracker, emissions } = setup();
    focus$.next("t1");

    runtimeOf("t1").next("closing");
    expect(tracker.binding).toEqual({
      status: "closing",
      identity: { terminalId: "t1", sessionToken: "token-t1" },
    });

    runtimeOf("t1").next("closed");
    expect(tracker.binding).toEqual({
      status: "closed",
      identity: { terminalId: "t1", sessionToken: "token-t1" },
    });

    // the closed pane's removal focuses another session
    focus$.next("t2");
    expect(tracker.binding).toMatchObject({
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
    expect(tracker.binding).toMatchObject({ status: "closing" });

    runtimeOf("t1").next("closed");
    expect(tracker.binding).toEqual({ status: "unbound" });

    // following resumes: the next focus binds again
    focus$.next("t2");
    expect(tracker.binding).toMatchObject({
      status: "active",
      identity: { terminalId: "t2" },
      mode: "following",
    });
  });
});
