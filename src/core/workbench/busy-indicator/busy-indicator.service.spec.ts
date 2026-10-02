import type { DestroyRef } from "@angular/core";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import { BusyIndicatorRegistration, BusyIndicatorService } from "./busy-indicator.service";

const defaultKeyframes = [
  [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
  ],
];
const providerKeyframes = [
  [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
];
const highPriorityKeyframes = [
  [
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
  ],
];

describe("BusyIndicatorService", () => {
  let bus: AppBus;
  let service: BusyIndicatorService;
  let terminalTabIds: Map<string, string>;
  let grids$: BehaviorSubject<unknown[]>;

  beforeEach(() => {
    bus = new AppBus();
    terminalTabIds = new Map();
    grids$ = new BehaviorSubject<unknown[]>([]);
    service = new BusyIndicatorService(
      bus,
      createGridListServiceStub(terminalTabIds, grids$),
      createDestroyRefStub(),
    );
  });

  /** Lays the terminal's pane out in another tab, as dragging it to a new tab does. */
  function movePane(terminalId: string, tabId: string): void {
    terminalTabIds.set(terminalId, tabId);
    grids$.next([]);
  }

  it("moves a terminal's animation along when its pane moves to another tab", () => {
    terminalTabIds.set("terminal-1", "tab-1");
    const oldTab = observeRegistrations(service.forTab$("tab-1"));
    const newTab = observeRegistrations(service.forTab$("tab-2"));
    registerTerminalAnimation("terminal-busy-terminal-1", "terminal-1", defaultKeyframes, 1);

    movePane("terminal-1", "tab-2");

    expect(oldTab.current).toEqual([]);
    expect(newTab.current.map((r) => r.registrationId)).toEqual(["terminal-busy-terminal-1"]);
  });

  it("stores all registrations for the same terminal concurrently", () => {
    const terminalRegistrations = observeRegistrations(service.forTerminal$("terminal-1"));

    registerTerminalAnimation("terminal-busy-terminal-1", "terminal-1", defaultKeyframes, 1);
    registerTerminalAnimation(
      "coding-agent-status-terminal-1",
      "terminal-1",
      providerKeyframes,
      50,
    );

    expect(terminalRegistrations.current).toHaveLength(2);
    expect(terminalRegistrations.current.map((r) => r.registrationId)).toContain(
      "terminal-busy-terminal-1",
    );
    expect(terminalRegistrations.current.map((r) => r.registrationId)).toContain(
      "coding-agent-status-terminal-1",
    );
  });

  it("keeps all registrations regardless of registration order", () => {
    const terminalRegistrations = observeRegistrations(service.forTerminal$("terminal-1"));

    registerTerminalAnimation(
      "coding-agent-status-terminal-1",
      "terminal-1",
      providerKeyframes,
      50,
    );
    registerTerminalAnimation("terminal-busy-terminal-1", "terminal-1", defaultKeyframes, 1);

    expect(terminalRegistrations.current).toHaveLength(2);
  });

  it("aggregates all terminal registrations for a tab with multiple terminals", () => {
    terminalTabIds.set("terminal-1", "tab-1");
    terminalTabIds.set("terminal-2", "tab-1");
    const tabRegistrations = observeRegistrations(service.forTab$("tab-1"));

    registerTerminalAnimation("terminal-busy-terminal-1", "terminal-1", defaultKeyframes, 1);
    registerTerminalAnimation(
      "coding-agent-status-terminal-1",
      "terminal-1",
      providerKeyframes,
      50,
    );
    registerTerminalAnimation("terminal-busy-terminal-2", "terminal-2", highPriorityKeyframes, 75);

    expect(tabRegistrations.current).toHaveLength(3);
    expect(tabRegistrations.current.map((r) => r.registrationId)).toEqual(
      expect.arrayContaining([
        "terminal-busy-terminal-1",
        "coding-agent-status-terminal-1",
        "terminal-busy-terminal-2",
      ]),
    );
  });

  it("removes only the unregistered animation, leaving others intact", () => {
    const terminalRegistrations = observeRegistrations(service.forTerminal$("terminal-1"));

    registerTerminalAnimation("terminal-busy-terminal-1", "terminal-1", defaultKeyframes, 1);
    registerTerminalAnimation(
      "coding-agent-status-terminal-1",
      "terminal-1",
      providerKeyframes,
      50,
    );
    unregisterAnimation("coding-agent-status-terminal-1");

    expect(terminalRegistrations.current).toEqual([
      expect.objectContaining({ registrationId: "terminal-busy-terminal-1" }),
    ]);
  });

  it("does not remove the current terminal animation when an older registration is unregistered", () => {
    const terminalRegistrations = observeRegistrations(service.forTerminal$("terminal-1"));

    registerTerminalAnimation("terminal-busy-terminal-1", "terminal-1", defaultKeyframes, 1);
    registerTerminalAnimation(
      "coding-agent-status-terminal-1",
      "terminal-1",
      providerKeyframes,
      50,
    );
    unregisterAnimation("terminal-busy-terminal-1");

    expect(terminalRegistrations.current).toEqual([
      expect.objectContaining({
        registrationId: "coding-agent-status-terminal-1",
      }),
    ]);
  });

  it("clears all registrations for a terminal on BusyIndicatorClearForTerminal", () => {
    terminalTabIds.set("terminal-1", "tab-1");
    terminalTabIds.set("terminal-2", "tab-1");
    const t1Registrations = observeRegistrations(service.forTerminal$("terminal-1"));
    const t2Registrations = observeRegistrations(service.forTerminal$("terminal-2"));

    registerTerminalAnimation("terminal-busy-terminal-1", "terminal-1", defaultKeyframes, 1);
    registerTerminalAnimation(
      "coding-agent-status-terminal-1",
      "terminal-1",
      providerKeyframes,
      50,
    );
    registerTerminalAnimation("terminal-busy-terminal-2", "terminal-2", defaultKeyframes, 1);

    clearForTerminal("terminal-1");

    expect(t1Registrations.current).toHaveLength(0);
    expect(t2Registrations.current).toHaveLength(1);
  });

  function registerTerminalAnimation(
    registrationId: string,
    terminalId: string,
    keyframes: number[][][],
    priority: number,
  ): void {
    bus.publish({
      type: "BusyIndicatorRegister",
      payload: {
        registrationId,
        terminalId,
        keyframes,
        priority,
      },
    });
  }

  function unregisterAnimation(registrationId: string): void {
    bus.publish({
      type: "BusyIndicatorUnregister",
      payload: { registrationId },
    });
  }

  function clearForTerminal(terminalId: string): void {
    bus.publish({
      type: "BusyIndicatorClearForTerminal",
      payload: { terminalId },
    });
  }
});

function observeRegistrations(registrations$: {
  subscribe: (next: (registrations: BusyIndicatorRegistration[]) => void) => {
    unsubscribe: () => void;
  };
}): { readonly current: BusyIndicatorRegistration[] } {
  let current: BusyIndicatorRegistration[] = [];
  registrations$.subscribe((registrations) => {
    current = registrations;
  });
  return {
    get current(): BusyIndicatorRegistration[] {
      return current;
    },
  };
}

function createGridListServiceStub(
  terminalTabIds: ReadonlyMap<string, string>,
  grids$: BehaviorSubject<unknown[]>,
): GridListService {
  return {
    grids$,
    findTabIdByTerminalId: (terminalId: string): string | undefined =>
      terminalTabIds.get(terminalId),
  } as unknown as GridListService;
}

function createDestroyRefStub(): DestroyRef {
  return {
    onDestroy:
      (_callback: () => void): (() => void) =>
      () =>
        undefined,
    destroyed: false,
  };
}
