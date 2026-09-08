import {
  ApplicationConfig,
  ErrorHandler,
  Injector,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { AboutDialogAdapterService } from "@cogno/app/app-host/about-dialog.adapter.service";
import { featuresToken } from "@cogno/app/app-host/app-host.tokens";
import { ApplicationConfigurationPortAdapterService } from "@cogno/app/app-host/application-configuration-port.adapter.service";
import { ConfirmDialogAdapterService } from "@cogno/app/app-host/confirm-dialog.adapter.service";
import { TerminalAnimationAdapterService } from "@cogno/app/app-host/terminal-animation.adapter.service";
import { TerminalMonitorAdapterService } from "@cogno/app/app-host/terminal-monitor.adapter.service";
import { TerminalNavigatorAdapterService } from "@cogno/app/app-host/terminal-navigator.adapter.service";
import { ErrorReportingRuntimeService } from "@cogno/app/common/error/error-reporting-runtime.service";
import { ConfigBootstrapAdapter } from "@cogno/app/config/config-bootstrap.adapter";
import { features } from "@cogno/app/features";
import { NativeMenuService } from "@cogno/app/menu/native-menu/native-menu.service";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { NotificationCenterPortAdapterService } from "@cogno/core/api/notification-center-port.adapter.service";
import { SessionApi } from "@cogno/core/api/session-api";
import { TerminalGatewayService } from "@cogno/core/api/terminal-gateway.service";
import { TerminalSearchApi } from "@cogno/core/api/terminal-search-api";
import { TerminalSearchApiService } from "@cogno/core/api/terminal-search-api.service";
import { ConfigService, RealConfigService } from "@cogno/core/infrastructure/config/config.service";
import { GlobalErrorHandler } from "@cogno/core/infrastructure/error/global-error.handler";
import { StyleService } from "@cogno/core/infrastructure/theme/style.service";
import { CommandRunnerHostService } from "@cogno/core/session/exec/command-runner-host.service";
import { FilesystemHostService } from "@cogno/core/session/exec/filesystem-host.service";
import { ActionCatalogAdapterService } from "@cogno/core/workbench/actions/action-catalog.adapter.service";
import { ConfigActionsHandler } from "@cogno/core/workbench/actions/config-actions.handler";
import { CliActionService } from "@cogno/core/workbench/external/cli-action.service";
import { HttpMessageAdapterService } from "@cogno/core/workbench/external/http-message-adapter.service";
import { FEATURE_DEFINITIONS } from "@cogno/core/workbench/feature-host/feature-definitions.token";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { ActionKeybindingPortAdapterService } from "@cogno/core/workbench/keybindings/action-keybinding-port.adapter.service";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { NotificationChannelsPortAdapterService } from "@cogno/core/workbench/notification/+state/notification-channels-port.adapter.service";
import { NotificationDispatchService } from "@cogno/core/workbench/notification/+state/notification-dispatch.service";
import { NotificationTargetRuntimeService } from "@cogno/core/workbench/notification/+state/notification-target-runtime.service";
import { SideMenuStatePersistenceService } from "@cogno/core/workbench/side-menu/side-menu-state-persistence.service";
import { TerminalInputDispatcher } from "@cogno/core/workbench/terminal/+state/terminal-input.dispatcher";
import { WindowService } from "@cogno/core/workbench/window/window.service";
import { WorkspaceHostService } from "@cogno/core/workbench/workspace/workspace-host.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { WorkspaceShortcutActionService } from "@cogno/core/workbench/workspace/workspace-shortcut-action.service";
import { CodingAgentStartupService, CodingAgentStatusService } from "@cogno/features/coding-agent";
import {
  ConfirmDialogPort,
  TerminalIpcPort,
  TerminalMonitorPort,
} from "@cogno/features/coding-agent/ports";
import { Logger } from "@cogno/platform/logger";
import {
  ActionCatalog,
  ActionDispatcher,
  ActionKeybindingPort,
  ApplicationConfigurationPort,
  CommandRunner,
  Filesystem,
  NotificationChannelsPort,
  TerminalAnimationPort,
  TerminalGateway,
  TerminalNavigator,
} from "@cogno/shared/ports";
import { TerminalIpcAdapterService } from "../app-host/terminal-ipc.adapter.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
    { provide: CommandRunner, useExisting: CommandRunnerHostService },
    { provide: ActionKeybindingPort, useExisting: ActionKeybindingPortAdapterService },
    { provide: Filesystem, useExisting: FilesystemHostService },
    { provide: ActionCatalog, useExisting: ActionCatalogAdapterService },
    { provide: ActionDispatcher, useExisting: ActionCatalogAdapterService },
    {
      provide: ApplicationConfigurationPort,
      useExisting: ApplicationConfigurationPortAdapterService,
    },
    { provide: featuresToken, useValue: features },
    { provide: FEATURE_DEFINITIONS, useValue: features },
    { provide: NotificationCenterPort, useExisting: NotificationCenterPortAdapterService },
    { provide: NotificationChannelsPort, useExisting: NotificationChannelsPortAdapterService },
    { provide: TerminalGateway, useExisting: TerminalGatewayService },
    { provide: SessionApi, useExisting: TerminalGatewayService },
    { provide: TerminalSearchApi, useExisting: TerminalSearchApiService },
    { provide: TerminalMonitorPort, useExisting: TerminalMonitorAdapterService },
    { provide: TerminalAnimationPort, useExisting: TerminalAnimationAdapterService },
    { provide: TerminalNavigator, useExisting: TerminalNavigatorAdapterService },
    { provide: ConfirmDialogPort, useExisting: ConfirmDialogAdapterService },
    { provide: TerminalIpcPort, useExisting: TerminalIpcAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      void Logger.initialize();
      inject(StyleService);
      // The feature-host's declaration phase: whole-set validation, then the
      // migrations and path adapters that must exist before the config is read.
      inject(FeatureHost);
      // MIGRATION-TEMP(step 28): keeps the config's notifications and shell
      // bootstrap alive until they reach their own layer. Must exist before
      // WindowService publishes InitConfigCommand.
      inject(ConfigBootstrapAdapter);
      // The config actions now live in the workbench; instantiate the handler
      // so it listens.
      inject(ConfigActionsHandler);
      // Routes bus messages addressed to a session onto its host.
      inject(TerminalInputDispatcher);
      inject(ErrorReportingRuntimeService).initialize();

      const injector = inject(Injector);
      setTimeout(() => {
        injector.get(NotificationDispatchService);
        injector.get(NotificationTargetRuntimeService);
        injector.get(WorkspaceHostApplicationService);
        injector.get(KeybindService);
        injector.get(CliActionService);
        injector.get(HttpMessageAdapterService);
        injector.get(NativeMenuService);
        injector.get(WindowService);
        injector.get(SideMenuStatePersistenceService);
        injector.get(ActionCatalogAdapterService);
        injector.get(ActionKeybindingPortAdapterService);
        injector.get(TerminalSearchApiService);
        injector.get(WorkspaceHostService);
        injector.get(WorkspaceShortcutActionService);
        injector.get(CodingAgentStatusService);
        injector.get(CodingAgentStartupService);
        injector.get(AboutDialogAdapterService);
      }, 0);
    }),
  ],
};
