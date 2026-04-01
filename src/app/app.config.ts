import type { ApplicationConfig } from "@angular/core";
import {
  ErrorHandler,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { ActionKeybindingPortAdapterService } from "@cogno/app/app-host/action-keybinding-port.adapter.service";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import {
  actionKeybindingToken,
  commandPaletteHostPortToken,
  commandRunnerToken,
  databaseAccessToken,
  filesystemToken,
  notificationCenterPortToken,
  terminalSearchHostPortToken,
  workspaceCloseGuardToken,
  workspaceHostPortToken,
} from "@cogno/app/app-host/app-host.tokens";
import { CommandPaletteHostPortAdapterService } from "@cogno/app/app-host/command-palette-host-port.adapter.service";
import { CommandRunnerHostService } from "@cogno/app/app-host/command-runner-host.service";
import { DatabaseAccessHostService } from "@cogno/app/app-host/database-access-host.service";
import { FilesystemHostService } from "@cogno/app/app-host/filesystem-host.service";
import { SideMenuLifecycleRuntimeService } from "@cogno/app/app-host/side-menu-lifecycle-runtime.service";
import { TerminalSearchHostPortAdapterService } from "@cogno/app/app-host/terminal-search-host-port.adapter.service";
import { WorkspaceCloseGuardAdapterService } from "@cogno/app/app-host/workspace-close-guard.adapter.service";
import { WorkspaceHostApplicationService } from "@cogno/app/app-host/workspace-host-application.service";
import { WorkspaceHostPortAdapterService } from "@cogno/app/app-host/workspace-host-port.adapter.service";
import { WorkspaceShortcutActionService } from "@cogno/app/app-host/workspace-shortcut-action.service";
import { CliActionService } from "@cogno/app/cli-command/cli-action.service";
import { ErrorReportingRuntimeService } from "@cogno/app/common/error/error-reporting-runtime.service";
import { GlobalErrorHandler } from "@cogno/app/common/error/global-error.handler";
import { ConfigService, RealConfigService } from "@cogno/app/config/+state/config.service";
import { KeybindService } from "@cogno/app/keybinding/keybind.service";
import {
  sideMenuFeatureDefinitions,
  sideMenuFeatureDefinitionsToken,
} from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { NativeMenuService } from "@cogno/app/menu/native-menu/native-menu.service";
import { NotificationCenterPortAdapterService } from "@cogno/app/notification/+state/notification-center-port.adapter.service";
import { NotificationDispatchService } from "@cogno/app/notification/+state/notification-dispatch.service";
import { StyleService } from "@cogno/app/style/style.service";
import { WindowService } from "@cogno/app/window/window.service";
import { Logger } from "@cogno/app-tauri/logger";
import {
  ActionKeybindingPort,
  ApplicationProduct,
  CommandPaletteHostPort,
  NotificationCenterPort,
  TerminalSearchHostPort,
  WorkspaceCloseGuard,
  WorkspaceHostPort,
} from "@cogno/core-api";
import { activeProductDefinition } from "../products/active-product";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
    { provide: commandRunnerToken, useExisting: CommandRunnerHostService },
    { provide: commandPaletteHostPortToken, useExisting: CommandPaletteHostPortAdapterService },
    { provide: actionKeybindingToken, useExisting: ActionKeybindingPortAdapterService },
    { provide: databaseAccessToken, useExisting: DatabaseAccessHostService },
    { provide: filesystemToken, useExisting: FilesystemHostService },
    { provide: notificationCenterPortToken, useExisting: NotificationCenterPortAdapterService },
    { provide: terminalSearchHostPortToken, useExisting: TerminalSearchHostPortAdapterService },
    { provide: workspaceCloseGuardToken, useExisting: WorkspaceCloseGuardAdapterService },
    { provide: workspaceHostPortToken, useExisting: WorkspaceHostPortAdapterService },
    { provide: ActionKeybindingPort, useExisting: ActionKeybindingPortAdapterService },
    { provide: ApplicationProduct, useValue: activeProductDefinition.applicationProduct },
    { provide: CommandPaletteHostPort, useExisting: CommandPaletteHostPortAdapterService },
    { provide: NotificationCenterPort, useExisting: NotificationCenterPortAdapterService },
    {
      provide: sideMenuFeatureDefinitionsToken,
      useValue: [...sideMenuFeatureDefinitions, ...activeProductDefinition.sideMenuFeatureDefinitions],
    },
    { provide: TerminalSearchHostPort, useExisting: TerminalSearchHostPortAdapterService },
    { provide: WorkspaceCloseGuard, useExisting: WorkspaceCloseGuardAdapterService },
    { provide: WorkspaceHostPort, useExisting: WorkspaceHostPortAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      void Logger.initialize();
      inject(StyleService);
      inject(NotificationDispatchService);
      inject(ErrorReportingRuntimeService).initialize();
      inject(WorkspaceHostApplicationService);
      inject(KeybindService);
      inject(CliActionService);
      inject(NativeMenuService);
      inject(WindowService);
      inject(AppWiringService);
      inject(SideMenuLifecycleRuntimeService);
      inject(ActionKeybindingPortAdapterService);
      inject(CommandPaletteHostPortAdapterService);
      inject(TerminalSearchHostPortAdapterService);
      inject(WorkspaceHostPortAdapterService);
      inject(WorkspaceShortcutActionService);
    }),
  ],
};
