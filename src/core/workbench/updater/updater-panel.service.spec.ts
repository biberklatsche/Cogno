import { Injector, provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import type { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import type { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import type { UpdaterState } from "@cogno/platform/updater";
import { describe, expect, it, vi } from "vitest";
import type { UpdaterService } from "./updater.service";
import { UPDATER_PANEL_LABEL, UpdaterPanelService } from "./updater-panel.service";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("UpdaterPanelService", () => {
  function create() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const state = signal<UpdaterState | undefined>(undefined);
    const sideMenu = { addMenuItem: vi.fn(), toggle: vi.fn(), updateBadgeColor: vi.fn() };
    const handlers = new Map<string, () => void>();
    const actions = {
      handle: vi.fn((name: string, handler: () => void) => handlers.set(name, handler)),
    };
    const updater = { start: vi.fn(), state };
    new UpdaterPanelService(
      sideMenu as unknown as SideMenuService,
      actions as unknown as ActionHandlers,
      updater as unknown as UpdaterService,
      TestBed.inject(Injector),
    );
    return { state, sideMenu, handlers, updater };
  }

  it("puts the updates at the bottom of the side menu, starts checking and toggles on open_updater", () => {
    const { sideMenu, handlers, updater } = create();

    expect(sideMenu.addMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        label: UPDATER_PANEL_LABEL,
        bottom: true,
        actionName: "open_updater",
      }),
    );
    expect(updater.start).toHaveBeenCalled();
    handlers.get("open_updater")?.();
    expect(sideMenu.toggle).toHaveBeenCalledWith(UPDATER_PANEL_LABEL);
  });

  it("shows the badge while a new version waits for the user", () => {
    const { state, sideMenu } = create();
    TestBed.flushEffects();

    state.set({ phase: "available", version: "1.0.0", installable: true } as UpdaterState);
    TestBed.flushEffects();
    expect(sideMenu.updateBadgeColor).toHaveBeenLastCalledWith(
      UPDATER_PANEL_LABEL,
      "var(--color-green)",
    );

    state.set({ phase: "idle" } as UpdaterState);
    TestBed.flushEffects();
    expect(sideMenu.updateBadgeColor).toHaveBeenLastCalledWith(UPDATER_PANEL_LABEL, undefined);
  });
});
