import type { DestroyRef } from "@angular/core";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import type { SessionHost } from "@cogno/core/session/host/session-host";
import type { SessionFact } from "@cogno/core/session/session-facts";
import { SelectionHandler } from "@cogno/core/terminal/handlers/selection.handler";
import { MachineState } from "@cogno/core/terminal/machine-state";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import type { NotificationTargetResolverService } from "@cogno/core/workbench/grid-list/+state/notification-target-resolver.service";
import type { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import type { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { WindowService } from "@cogno/core/workbench/window/window.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { OsPlatform, OsType } from "@cogno/platform/os";
import { Process } from "@cogno/platform/process";
import { AppWindow } from "@cogno/platform/window";
import { WindowCore } from "@cogno/platform/window-core";
import { TerminalId } from "@cogno/shared/domain";
import type { ActionKeybindingPort } from "@cogno/shared/ports";
import type { ContextMenuOverlayService } from "@cogno/shared/ui";
import { Subject } from "rxjs";
import { vi } from "vitest";
import { ConfigServiceMock } from "./mocks/config-service.mock";

let appBus: AppBus | undefined;
let sideMenuService: SideMenuService | undefined;
let configService: ConfigServiceMock | undefined;
let gridListService: GridListService | undefined;
let terminalSessionRegistry: TerminalSessionRegistry | undefined;
const sessionFactSubjects = new Map<TerminalId, Subject<SessionFact>>();
let tabListService: TabListService | undefined;
let terminalComponentFactory: SessionHostFactory | undefined;
let windowService: WindowService | undefined;
let selectionHandler: SelectionHandler | undefined;
let machineState: MachineState | undefined;
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

export function getConfigService(): ConfigServiceMock {
  if (!configService) configService = new ConfigServiceMock();
  return configService;
}

export function getActionKeybindingPortMock(): ActionKeybindingPort {
  return {
    getKeybindingLabel: vi.fn().mockReturnValue(""),
  };
}

export function getGridListService(): GridListService {
  if (!gridListService) {
    gridListService = new GridListService(
      getAppBus(),
      getSessionHostFactory(),
      getTerminalSessionRegistry(),
      getDestroyRef(),
    );
  }
  return gridListService;
}

export function getTerminalSessionRegistry(): TerminalSessionRegistry {
  if (!terminalSessionRegistry) {
    terminalSessionRegistry = new TerminalSessionRegistry();
  }
  return terminalSessionRegistry;
}

/**
 * Emit a session fact through the registry the workbench services listen to,
 * as if the session at `terminalId` reported it. Registers a stub host on first
 * use so `registry.facts$` carries the fact tagged with `terminalId`.
 */
export function emitSessionFact(terminalId: TerminalId, fact: SessionFact): void {
  const registry = getTerminalSessionRegistry();
  let subject = sessionFactSubjects.get(terminalId);
  if (!subject) {
    subject = new Subject<SessionFact>();
    sessionFactSubjects.set(terminalId, subject);
    registry.register(
      terminalId,
      {} as ShellProfile,
      {
        facts$: subject.asObservable(),
      } as unknown as SessionHost,
    );
  }
  subject.next(fact);
}

export function getTabListService(): TabListService {
  if (!tabListService) {
    tabListService = new TabListService(
      getAppBus(),
      getConfigService(),
      getActionKeybindingPortMock(),
      new ActionHandlers(getAppBus(), getDestroyRef()),
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
      {
        persistActiveWorkspace: vi.fn().mockResolvedValue(undefined),
        recordAbortedCommands: vi.fn().mockResolvedValue(undefined),
      } as unknown as WorkspaceHostApplicationService,
      new ActionHandlers(getAppBus(), getDestroyRef()),
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
  terminalSessionRegistry = undefined;
  sessionFactSubjects.clear();
  tabListService = undefined;
  terminalComponentFactory = undefined;
  windowService = undefined;
  selectionHandler = undefined;
  machineState = undefined;
  terminalBusyStateService = undefined;
  contextMenuOverlayService = undefined;
  notificationTargetResolverService = undefined;
}
