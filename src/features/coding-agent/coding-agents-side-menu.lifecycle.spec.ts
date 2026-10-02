import { Injector, provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CodingAgentStartupService } from "./coding-agent-startup.service";
import type { AgentAttention, CodingAgentStatusService } from "./coding-agent-status.service";
import { CodingAgentsSideMenuLifecycle } from "./coding-agents-side-menu.lifecycle";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("CodingAgentsSideMenuLifecycle", () => {
  let attention: ReturnType<typeof signal<AgentAttention>>;
  let rescan: ReturnType<typeof vi.fn>;
  let statusService: {
    attention: typeof attention;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let handle: SideMenuFeatureHandleContract<string>;
  let lifecycle: ReturnType<CodingAgentsSideMenuLifecycle["create"]>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    attention = signal<AgentAttention>(undefined);
    rescan = vi.fn().mockResolvedValue(undefined);
    statusService = { attention, start: vi.fn(), stop: vi.fn() };
    handle = {
      close: vi.fn(),
      registerKeybindListener: vi.fn(),
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
      updateBadgeColor: vi.fn(),
    };
    lifecycle = new CodingAgentsSideMenuLifecycle(
      { rescan } as unknown as CodingAgentStartupService,
      statusService as unknown as CodingAgentStatusService,
    ).create(TestBed.inject(Injector), handle);
  });

  it("follows the agents and scans for them while the feature is on, and stops when it is off", () => {
    lifecycle.onModeChange?.("on");
    expect(statusService.start).toHaveBeenCalledOnce();
    expect(rescan).toHaveBeenCalledOnce();

    lifecycle.onModeChange?.("off");
    expect(statusService.stop).toHaveBeenCalledOnce();
  });

  it("colours the menu badge by attention while the feature is on", () => {
    lifecycle.onModeChange?.("on");
    TestBed.tick();
    expect(handle.updateBadgeColor).toHaveBeenLastCalledWith(undefined);

    attention.set("question");
    TestBed.tick();
    expect(handle.updateBadgeColor).toHaveBeenLastCalledWith("var(--color-yellow)");

    attention.set("error");
    TestBed.tick();
    expect(handle.updateBadgeColor).toHaveBeenLastCalledWith("var(--color-red)");
  });

  it("stops updating the badge once the feature is off", () => {
    lifecycle.onModeChange?.("on");
    TestBed.tick();
    lifecycle.onModeChange?.("off");
    const calls = vi.mocked(handle.updateBadgeColor).mock.calls.length;

    attention.set("error");
    TestBed.tick();
    expect(vi.mocked(handle.updateBadgeColor).mock.calls.length).toBe(calls);
  });

  it("rescans on open and binds Escape while focused", () => {
    lifecycle.onOpen?.();
    expect(rescan).toHaveBeenCalled();

    lifecycle.onFocus?.();
    expect(handle.registerKeybindListener).toHaveBeenCalledWith(["Escape"], expect.any(Function));
    lifecycle.onBlur?.();
    expect(handle.unregisterKeybindListener).toHaveBeenCalled();
  });
});
