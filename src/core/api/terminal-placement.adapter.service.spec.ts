import { provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { WorkspaceState } from "@cogno/shared/domain";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalPlacementAdapterService } from "./terminal-placement.adapter.service";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("TerminalPlacementAdapterService", () => {
  let grids$: Subject<unknown>;
  let tabs$: Subject<unknown>;
  let workspaceList: ReturnType<typeof signal<WorkspaceState[]>>;
  let service: TerminalPlacementAdapterService;

  beforeEach(() => {
    grids$ = new Subject();
    tabs$ = new Subject();
    workspaceList = signal<WorkspaceState[]>([
      { id: "ws-a", name: "Alpha", grids: [], tabs: [], isSelected: false },
      { id: "ws-b", name: "Beta", color: "blue", grids: [], tabs: [], isSelected: true },
    ]);

    const gridListService = {
      grids$,
      findWorkspaceIdentifierByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "t-1" ? "ws-b" : undefined,
      ),
      findTabIdByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "t-1" ? "tab-2" : undefined,
      ),
    };
    const tabListService = {
      tabs$,
      getTabConfigs: vi.fn(() => [
        { tabId: "tab-1", systemTitle: "first" },
        { tabId: "tab-2", systemTitle: "zsh", userTitle: "Agent" },
      ]),
    };

    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.runInInjectionContext(
      () =>
        new TerminalPlacementAdapterService(
          gridListService as unknown as GridListService,
          tabListService as unknown as TabListService,
          { workspaceList } as unknown as WorkspaceHostApplicationService,
        ),
    );
  });

  it("resolves workspace and tab in display order", () => {
    expect(service.getPlacement("t-1")).toEqual({
      workspaceId: "ws-b",
      workspaceName: "Beta",
      workspaceColor: "blue",
      workspacePosition: 1,
      tabTitle: "Agent",
      tabIndex: 1,
    });
  });

  it("returns undefined for a terminal that is not laid out", () => {
    expect(service.getPlacement("unknown")).toBeUndefined();
  });

  it("signals a change when tabs, grids or workspaces change", () => {
    const changes = vi.fn();
    const subscription = service.changes$.subscribe(changes);

    tabs$.next([]);
    grids$.next([]);
    workspaceList.set([]);
    TestBed.tick();

    expect(changes).toHaveBeenCalledTimes(3);
    subscription.unsubscribe();
  });
});
