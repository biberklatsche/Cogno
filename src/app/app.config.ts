import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { ActionCatalogAdapterService } from "@cogno/app/app-host/action-catalog.adapter.service";
import { ActionKeybindingPortAdapterService } from "@cogno/app/app-host/action-keybinding-port.adapter.service";
import { AiChatHostPortAdapterService } from "@cogno/app/app-host/ai-chat-host-port.adapter.service";
import { additionalNotificationChannelsToken } from "@cogno/app/app-host/app-host.tokens";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
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
import { NativeMenuService } from "@cogno/app/menu/native-menu/native-menu.service";
import {
  sideMenuFeatureDefinitions,
  sideMenuFeatureDefinitionsToken,
} from "@cogno/app/menu/side-menu/+state/side-menu-feature-definitions";
import { NotificationCenterPortAdapterService } from "@cogno/app/notification/+state/notification-center-port.adapter.service";
import { NotificationDispatchService } from "@cogno/app/notification/+state/notification-dispatch.service";
import { NotificationTargetRuntimeService } from "@cogno/app/notification/+state/notification-target-runtime.service";
import { StyleService } from "@cogno/app/style/style.service";
import { WindowService } from "@cogno/app/window/window.service";
import { Logger } from "@cogno/app-tauri/logger";
import {
  ActionCatalog,
  ActionDispatcher,
  ActionKeybindingPort,
  ApplicationProduct,
  CommandRunner,
  DatabaseAccess,
  Filesystem,
  NotificationCenterPort,
  TerminalSearchHostPort,
  WorkspaceCloseGuard,
  WorkspaceHostPort,
} from "@cogno/core-api";
import { AiChatHostPort } from "@cogno/feature-api/ai/ai-chat.port";
import { productDefinition } from "../products/product-definition.instance";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
    { provide: CommandRunner, useExisting: CommandRunnerHostService },
    { provide: ActionKeybindingPort, useExisting: ActionKeybindingPortAdapterService },
    { provide: DatabaseAccess, useExisting: DatabaseAccessHostService },
    { provide: Filesystem, useExisting: FilesystemHostService },
    { provide: additionalNotificationChannelsToken, useValue: [] },
    { provide: ActionCatalog, useExisting: ActionCatalogAdapterService },
    { provide: ActionDispatcher, useExisting: ActionCatalogAdapterService },
    { provide: ApplicationProduct, useValue: productDefinition.applicationProduct },
    { provide: AiChatHostPort, useExisting: AiChatHostPortAdapterService },
    { provide: NotificationCenterPort, useExisting: NotificationCenterPortAdapterService },
    {
      provide: sideMenuFeatureDefinitionsToken,
      useValue: [...sideMenuFeatureDefinitions, ...productDefinition.sideMenuFeatureDefinitions],
    },
    { provide: TerminalSearchHostPort, useExisting: TerminalSearchHostPortAdapterService },
    { provide: WorkspaceCloseGuard, useExisting: WorkspaceCloseGuardAdapterService },
    { provide: WorkspaceHostPort, useExisting: WorkspaceHostPortAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      void Logger.initialize();
      inject(StyleService);
      inject(NotificationDispatchService);
      inject(NotificationTargetRuntimeService);
      inject(ErrorReportingRuntimeService).initialize();
      inject(WorkspaceHostApplicationService);
      inject(KeybindService);
      inject(CliActionService);
      inject(NativeMenuService);
      inject(WindowService);
      inject(AppWiringService);
      inject(SideMenuLifecycleRuntimeService);
      inject(ActionCatalogAdapterService);
      inject(ActionKeybindingPortAdapterService);
      inject(AiChatHostPortAdapterService);
      inject(TerminalSearchHostPortAdapterService);
      inject(WorkspaceHostPortAdapterService);
      inject(WorkspaceShortcutActionService);
    }),
  ],
};
