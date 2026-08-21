import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { ContextMenuOverlayService, DragPreviewService } from "@cogno/core-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  getAppBus,
  getConfigService,
  getDestroyRef,
  getKeybindServiceMock,
} from "../../__test__/test-factory";
import { BusyIndicatorService } from "../common/busy-indicator/busy-indicator.service";
import type { KeybindService } from "../keybinding/keybind.service";
import type { Tab } from "./+model/tab";
import { TabListService } from "./+state/tab-list.service";
import { TabListComponent } from "./tab-list.component";

function tab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: "t1",
    systemTitle: "T1",
    isActive: true,
    activeShellType: "unknown",
    ...overrides,
  };
}

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("TabListComponent", () => {
  let tabListService: TabListService;

  function createComponent(): TabListComponent {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TabListService, useValue: tabListService },
        { provide: ContextMenuOverlayService, useValue: { openAtElement: vi.fn() } },
        { provide: DragPreviewService, useValue: { stopDragPreview: vi.fn() } },
        { provide: BusyIndicatorService, useValue: { forTab$: vi.fn() } },
      ],
    });

    return TestBed.runInInjectionContext(
      () =>
        new TabListComponent(
          TestBed.inject(TabListService),
          TestBed.inject(ContextMenuOverlayService),
          TestBed.inject(DragPreviewService),
          TestBed.inject(BusyIndicatorService),
        ),
    );
  }

  function fakeContextMenuEvent(): MouseEvent {
    return {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      currentTarget: document.createElement("button"),
    } as unknown as MouseEvent;
  }

  beforeEach(() => {
    tabListService = new TabListService(
      getAppBus(),
      getConfigService(),
      getKeybindServiceMock() as KeybindService,
      getDestroyRef(),
    );
    tabListService.activateWorkspace("ws-1");
    tabListService.addTab({
      id: "t1",
      systemTitle: "T1",
      isActive: true,
      activeShellType: "unknown",
    });
  });

  afterEach(() => {
    clear();
  });

  describe("tabColor", () => {
    it("resolves the css variable from the tab's color name", () => {
      const component = createComponent();

      expect(component.tabColor(tab({ color: "red" }))).toBe(
        "var(--color-red)",
      );
    });

    it("returns undefined for tabs without a color", () => {
      const component = createComponent();

      expect(component.tabColor(tab({ color: undefined }))).toBeUndefined();
    });
  });

  describe("context menu color picker", () => {
    it("reflects the tab's current color as soon as the menu is built", () => {
      tabListService.setColor("t1", "blue");
      const component = createComponent();

      component.buildContextMenu(fakeContextMenuEvent(), "t1");

      expect(component.contextMenuSelectedColor()).toBe("blue");
    });

    it("updates the selected color immediately after picking, without reopening the menu", () => {
      const component = createComponent();
      component.buildContextMenu(fakeContextMenuEvent(), "t1");
      expect(component.contextMenuSelectedColor()).toBeUndefined();

      component.onTabColorPick("green");

      expect(component.contextMenuSelectedColor()).toBe("green");
    });

    it("delegates the picked color to TabListService", () => {
      const component = createComponent();
      component.buildContextMenu(fakeContextMenuEvent(), "t1");

      component.onTabColorPick("magenta");

      let currentColor: string | undefined;
      tabListService.tabs$.subscribe((tabs) => {
        currentColor = tabs.find((tab) => tab.id === "t1")?.color;
      });
      expect(currentColor).toBe("magenta");
    });

    it("does nothing when no tab context menu is open", () => {
      const component = createComponent();

      component.onTabColorPick("red");

      let currentColor: string | undefined;
      tabListService.tabs$.subscribe((tabs) => {
        currentColor = tabs.find((tab) => tab.id === "t1")?.color;
      });
      expect(currentColor).toBeUndefined();
    });
  });
});
