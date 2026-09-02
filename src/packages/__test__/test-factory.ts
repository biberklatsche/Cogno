import type { DestroyRef } from "@angular/core";
import { signal } from "@angular/core";
import type { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { SelectionHandler } from "@cogno/core/terminal/handlers/selection.handler";
import { MachineState } from "@cogno/core/terminal/machine-state";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import type { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import type { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import type { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { OsPlatform, OsType } from "@cogno/platform/os";
import { Process } from "@cogno/platform/process";
import { AppWindow } from "@cogno/platform/window";
import { WindowCore } from "@cogno/platform/window-core";
import type { ActionKeybindingPort, TerminalId } from "@cogno/shared/ports";
import type { ContextMenuOverlayService } from "@cogno/shared/ui";
import { vi } from "vitest";
import type { TerminalAutocompleteFeatureSuggestorService } from "../app/app-host/terminal-autocomplete-feature-suggestor.service";
import { SideMenuService } from "../app/menu/side-menu/+state/side-menu.service";
import { WindowService } from "../app/window/window.service";
import { ConfigServiceMock } from "./mocks/config-service.mock";

let appBus: AppBus | undefined;
let sideMenuService: SideMenuService | undefined;
let configService: ConfigServiceMock | undefined;
let gridListService: GridListService | undefined;
let tabListService: TabListService | undefined;
let terminalComponentFactory: SessionHostFactory | undefined;
let windowService: WindowService | undefined;
let selectionHandler: SelectionHandler | undefined;
let machineState: MachineState | undefined;
let terminalAutocompleteFeatureSuggestorService:
  | TerminalAutocompleteFeatureSuggestorService
  | undefined;
let appWiringService: AppWiringService | undefined;
let terminalBusyStateService: TerminalBusyStateService | undefined;
let contextMenuOverlayService: ContextMenuOverlayService | undefined;
let notificationTargetResolverService: NotificationTargetResolverService | undefined;

/** A fixed platform so specs behave the same on every developer's machine. */
export function getOsPlatform(platform: OsType = "linux"): OsPlatform {
  return { platform: () => platform } as OsPlatform;
}

export function getAppBus(): AppBus {
  if (!appBus) appBus = new AppBus();
  return appBus;
}

export function getMachineState(): MachineState {
  if (!machineState) machineState = new MachineState();
  return machineState;
}

export function getSideMenuService(): SideMenuService {
  if (!sideMenuService) sideMenuService = new SideMenuService(getAppBus());
  return sideMenuService;
}

export function getNotificationTargetResolverService(): NotificationTargetResolverService {
  if (!notificationTargetResolverService) {
    notificationTargetResolverService = {
      resolveForTerminal: vi.fn().mockReturnValue(undefined),
    } as unknown as NotificationTargetResolverService;
  }
  return notificationTargetResolverService;
}

export function getTerminalAutocompleteFeatureSuggestorService(): TerminalAutocompleteFeatureSuggestorService {
  if (!terminalAutocompleteFeatureSuggestorService) {
    terminalAutocompleteFeatureSuggestorService = {
      getSharedSuggestors: vi.fn().mockReturnValue([]),
      preloadForShellIntegration: vi.fn(),
    } as unknown as TerminalAutocompleteFeatureSuggestorService;
  }
  return terminalAutocompleteFeatureSuggestorService;
}

export function getConfigService(): ConfigServiceMock {
  if (!configService) configService = new ConfigServiceMock();
  return configService;
}

export function getAppWiringService(): AppWiringService {
  if (!appWiringService) {
    appWiringService = {
      getShellDefinitions: vi.fn().mockReturnValue([]),
    } as unknown as AppWiringService;
  }
  return appWiringService;
}

export function getActionKeybindingPortMock(): ActionKeybindingPort {
  return {
    getKeybindingLabel: vi.fn().mockReturnValue(""),
    lastFiredKeybinding: signal<string | undefined>(undefined),
  };
}

export function getGridListService(): GridListService {
  if (!gridListService) {
    gridListService = new GridListService(getAppBus(), getSessionHostFactory(), getDestroyRef());
  }
  return gridListService;
}

export function getTabListService(): TabListService {
  if (!tabListService) {
    tabListService = new TabListService(
      getOsPlatform(),
      getAppBus(),
      getConfigService(),
      getActionKeybindingPortMock(),
      getDestroyRef(),
    );
  }
  return tabListService;
}

export function getSessionHostFactory(): SessionHostFactory {
  if (!terminalComponentFactory) {
    terminalComponentFactory = {
      destroy: vi.fn(),
      ensureSession: vi.fn(),
      attach: vi.fn(),
    } as unknown as SessionHostFactory;
  }
  return terminalComponentFactory;
}

export function getDestroyRef(): DestroyRef {
  return {
    onDestroy:
      (_callback: () => void): (() => void) =>
      () => {},
    destroyed: false,
  };
}

export function getWindowService(
  appWindow: AppWindow = {} as AppWindow,
  windowCore: WindowCore = {} as WindowCore,
  osProcess: Process = {} as Process,
): WindowService {
  if (!windowService) {
    windowService = new WindowService(
      appWindow,
      windowCore,
      osProcess,
      getAppBus(),
      getTerminalBusyStateService(),
      getDestroyRef(),
    );
  }
  return windowService;
}

export function getTerminalBusyStateService(): TerminalBusyStateService {
  if (!terminalBusyStateService) {
    terminalBusyStateService = {
      confirmProceedIfNoBusyTerminals: vi.fn().mockResolvedValue(true),
      confirmProceedIfNoBusyTerminalsInWorkspace: vi.fn().mockResolvedValue(true),
      hasBusyTerminals: vi.fn().mockReturnValue(false),
      hasBusyTerminalsInWorkspace: vi.fn().mockReturnValue(false),
      getBusyTerminalCount: vi.fn().mockReturnValue(0),
    } as unknown as TerminalBusyStateService;
  }

  return terminalBusyStateService;
}

export function getContextMenuOverlayService(): ContextMenuOverlayService {
  if (!contextMenuOverlayService) {
    contextMenuOverlayService = {
      openAtElement: vi.fn(),
      openAtPoint: vi.fn(),
      close: vi.fn(),
    } as unknown as ContextMenuOverlayService;
  }

  return contextMenuOverlayService;
}

export function getSelectionHandler(_terminalId: TerminalId): SelectionHandler {
  if (!selectionHandler) {
    selectionHandler = new SelectionHandler(getMachineState());
  }
  return selectionHandler;
}

export function clear() {
  appBus = undefined;
  sideMenuService = undefined;
  configService = undefined;
  gridListService = undefined;
  tabListService = undefined;
  terminalComponentFactory = undefined;
  windowService = undefined;
  selectionHandler = undefined;
  machineState = undefined;
  terminalAutocompleteFeatureSuggestorService = undefined;
  appWiringService = undefined;
  terminalBusyStateService = undefined;
  contextMenuOverlayService = undefined;
  notificationTargetResolverService = undefined;
}
