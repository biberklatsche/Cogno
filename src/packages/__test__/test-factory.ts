import type { DestroyRef } from "@angular/core";
import type { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { SelectionHandler } from "@cogno/core/terminal/handlers/selection.handler";
import { MachineState } from "@cogno/core/terminal/machine-state";
import { OsPlatform, OsType } from "@cogno/platform/os";
import { Process } from "@cogno/platform/process";
import { AppWindow } from "@cogno/platform/window";
import { WindowCore } from "@cogno/platform/window-core";
import type { TerminalId } from "@cogno/shared/ports";
import type { ContextMenuOverlayService } from "@cogno/shared/ui";
import { vi } from "vitest";
import { AppBus } from "../app/app-bus/app-bus";
import type { TerminalAutocompleteFeatureSuggestorService } from "../app/app-host/terminal-autocomplete-feature-suggestor.service";
import { GridListService } from "../app/grid-list/+state/grid-list.service";
import type { TerminalComponentFactory } from "../app/grid-list/+state/terminal-component.factory";
import { KeybindService } from "../app/keybinding/keybind.service";
import { KeyboardMappingService } from "../app/keybinding/keyboard/keyboard-layout.loader";
import type { TerminalKeybindingContextService } from "../app/keybinding/terminal-keybinding-context.service";
import { SideMenuService } from "../app/menu/side-menu/+state/side-menu.service";
import type { NotificationTargetResolverService } from "../app/notification/+state/notification-target-resolver.service";
import { TabListService } from "../app/tab-list/+state/tab-list.service";
import type { TerminalBusyStateService } from "../app/terminal/terminal-busy-state.service";
import { WindowService } from "../app/window/window.service";
import { ConfigServiceMock } from "./mocks/config-service.mock";

let appBus: AppBus | undefined;
let sideMenuService: SideMenuService | undefined;
let configService: ConfigServiceMock | undefined;
let keybindService: KeybindService | undefined;
let keybindMappingService: KeyboardMappingService | undefined;
let gridListService: GridListService | undefined;
let tabListService: TabListService | undefined;
let terminalComponentFactory: TerminalComponentFactory | undefined;
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
let terminalKeybindingContextService: TerminalKeybindingContextService | undefined;

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

export function getTerminalKeybindingContextService(): TerminalKeybindingContextService {
  if (!terminalKeybindingContextService) {
    terminalKeybindingContextService = {
      shouldSuppressAppKeybindings: vi.fn().mockReturnValue(false),
    } as unknown as TerminalKeybindingContextService;
  }
  return terminalKeybindingContextService;
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

export function getKeybindService(): KeybindService {
  if (!keybindService)
    keybindService = new KeybindService(
      getOsPlatform(),
      getKeyboardMappingService(),
      getConfigService(),
      getAppBus(),
      getTerminalKeybindingContextService() as any,
      getDestroyRef(),
    );
  return keybindService;
}

export function getKeybindServiceMock(): Pick<KeybindService, "getKeybinding"> {
  return { getKeybinding: vi.fn().mockReturnValue(undefined) };
}

export function getKeyboardMappingService(): KeyboardMappingService {
  if (!keybindMappingService) keybindMappingService = new KeyboardMappingService(getOsPlatform());
  return keybindMappingService;
}

export function getGridListService(): GridListService {
  if (!gridListService) {
    gridListService = new GridListService(
      getAppBus(),
      getTerminalComponentFactory(),
      getDestroyRef(),
    );
  }
  return gridListService;
}

export function getTabListService(): TabListService {
  if (!tabListService) {
    tabListService = new TabListService(
      getOsPlatform(),
      getAppBus(),
      getConfigService(),
      getKeybindServiceMock() as KeybindService,
      getDestroyRef(),
    );
  }
  return tabListService;
}

export function getTerminalComponentFactory(): TerminalComponentFactory {
  if (!terminalComponentFactory) {
    terminalComponentFactory = {
      destroy: vi.fn(),
      getSnapshot: vi.fn(),
      attach: vi.fn(),
    } as unknown as TerminalComponentFactory;
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
  keybindService = undefined;
  keybindMappingService = undefined;
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
  terminalKeybindingContextService = undefined;
}
