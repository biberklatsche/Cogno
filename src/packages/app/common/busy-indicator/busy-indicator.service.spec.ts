import type { DestroyRef } from "@angular/core";
import { beforeEach, describe, expect, it } from "vitest";
import { AppBus } from "../../app-bus/app-bus";
import type { GridListService } from "../../grid-list/+state/grid-list.service";
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

  beforeEach(() => {
    bus = new AppBus();
    terminalTabIds = new Map();
    service = new BusyIndicatorService(
      bus,
      createGridListServiceStub(terminalTabIds),
      createDestroyRefStub(),
    );
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
        target: { kind: "terminal", id: terminalId },
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

function createGridListServiceStub(terminalTabIds: ReadonlyMap<string, string>): GridListService {
  return {
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
