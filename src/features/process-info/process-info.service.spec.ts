import type { DestroyRef } from "@angular/core";
import type { BoundSession, BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import type { ProcessTreeSnapshot } from "@cogno/platform/pty";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProcessInfoService } from "./process-info.service";

function tree(rootProcessId: number): ProcessTreeSnapshot {
  return { rootProcessId, descendants: [] } as unknown as ProcessTreeSnapshot;
}

function session(processTree: () => Promise<ProcessTreeSnapshot>): BoundSessionHandle {
  return { processTree: vi.fn(processTree) } as unknown as BoundSessionHandle;
}

describe("ProcessInfoService", () => {
  let boundSession$: BehaviorSubject<BoundSession>;
  let service: ProcessInfoService;

  function bind(handle: BoundSessionHandle): void {
    boundSession$.next({ status: "active", session: handle });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    boundSession$ = new BehaviorSubject<BoundSession>({ status: "unbound" });
    service = new ProcessInfoService(
      { boundSession$, hold: vi.fn(), release: vi.fn() } as unknown as SessionApi,
      { onDestroy: vi.fn() } as unknown as DestroyRef,
    );
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it("shows the newly focused terminal's tree at once, not the one still loading", async () => {
    let answerFirst!: () => void;
    bind(
      session(
        () =>
          new Promise((resolve) => {
            answerFirst = () => resolve(tree(1));
          }),
      ),
    );
    service.start();

    bind(session(() => Promise.resolve(tree(2))));
    answerFirst();
    await vi.waitFor(() => expect(service.snapshot()?.rootProcessId).toBe(2));

    expect(service.loading()).toBe(false);
  });
});
