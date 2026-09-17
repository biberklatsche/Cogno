import {
  ApplicationConfig,
  ErrorHandler,
  Injector,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { ApplicationConfigurationPortAdapterService } from "@cogno/core/api/application-configuration-port.adapter.service";
import { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import { NotificationCenterPortAdapterService } from "@cogno/core/api/notification-center-port.adapter.service";
import { SessionApi } from "@cogno/core/api/session-api";
import { TerminalAnimationAdapterService } from "@cogno/core/api/terminal-animation.adapter.service";
import { TerminalAnimationPort } from "@cogno/core/api/terminal-animation-port";
import { TerminalGatewayService } from "@cogno/core/api/terminal-gateway.service";
import { TerminalIpcAdapterService } from "@cogno/core/api/terminal-ipc.adapter.service";
import { TerminalIpcPort } from "@cogno/core/api/terminal-ipc-port";
import { TerminalMonitorAdapterService } from "@cogno/core/api/terminal-monitor.adapter.service";
import { TerminalMonitorPort } from "@cogno/core/api/terminal-monitor-port";
import { TerminalNavigatorAdapterService } from "@cogno/core/api/terminal-navigator.adapter.service";
import { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import { TerminalSearchApi } from "@cogno/core/api/terminal-search-api";
import { TerminalSearchApiService } from "@cogno/core/api/terminal-search-api.service";
import { ConfigService, RealConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { GlobalErrorHandler } from "@cogno/core/infrastructure/error/global-error.handler";
import { StyleService } from "@cogno/core/infrastructure/theme/style.service";
import { CommandRunnerHostService } from "@cogno/core/session/exec/command-runner-host.service";
import { FilesystemHostService } from "@cogno/core/session/exec/filesystem-host.service";
import { AboutDialogAdapterService } from "@cogno/core/workbench/about/about-dialog.adapter.service";
import { ActionCatalogAdapterService } from "@cogno/core/workbench/actions/action-catalog.adapter.service";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ConfigActionsHandler } from "@cogno/core/workbench/actions/config-actions.handler";
import { ConfigBootstrapAdapter } from "@cogno/core/workbench/config-bootstrap/config-bootstrap.adapter";
import { ErrorReportingRuntimeService } from "@cogno/core/workbench/error/error-reporting-runtime.service";
import { CliActionService } from "@cogno/core/workbench/external/cli-action.service";
import { HttpMessageAdapterService } from "@cogno/core/workbench/external/http-message-adapter.service";
import { RunnableActionsPublisher } from "@cogno/core/workbench/external/runnable-actions-publisher.service";
import { FEATURE_DEFINITIONS } from "@cogno/core/workbench/feature-host/feature-definitions.token";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { ActionKeybindingPortAdapterService } from "@cogno/core/workbench/keybindings/action-keybinding-port.adapter.service";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { NativeMenuService } from "@cogno/core/workbench/native-menu/native-menu.service";
import { NotificationChannelsPortAdapterService } from "@cogno/core/workbench/notification/+state/notification-channels-port.adapter.service";
import { NotificationDispatchService } from "@cogno/core/workbench/notification/+state/notification-dispatch.service";
import { NotificationTargetRuntimeService } from "@cogno/core/workbench/notification/+state/notification-target-runtime.service";
import { SideMenuStatePersistenceService } from "@cogno/core/workbench/side-menu/side-menu-state-persistence.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { TerminalActionHandlers } from "@cogno/core/workbench/terminal/+state/keybind/terminal-action-handlers";
import { SessionActionHandlers } from "@cogno/core/workbench/terminal/+state/session-action-handlers";
import { TerminalInputDispatcher } from "@cogno/core/workbench/terminal/+state/terminal-input.dispatcher";
import { WindowService } from "@cogno/core/workbench/window/window.service";
import { WorkspaceHostService } from "@cogno/core/workbench/workspace/workspace-host.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { WorkspaceShortcutActionService } from "@cogno/core/workbench/workspace/workspace-shortcut-action.service";
import { CodingAgentStartupService, CodingAgentStatusService } from "@cogno/features/coding-agent";
import { Logger } from "@cogno/platform/logger";
import {
  ActionCatalog,
  ActionDispatcher,
  ActionKeybindingPort,
  ApplicationConfigurationPort,
  CommandRunner,
  Filesystem,
  NotificationChannelsPort,
} from "@cogno/shared/ports";
import { features } from "./features";

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
    { provide: FEATURE_DEFINITIONS, useValue: features },
    { provide: NotificationCenterPort, useExisting: NotificationCenterPortAdapterService },
    { provide: NotificationChannelsPort, useExisting: NotificationChannelsPortAdapterService },
    { provide: SessionApi, useExisting: TerminalGatewayService },
    { provide: TerminalSearchApi, useExisting: TerminalSearchApiService },
    { provide: TerminalMonitorPort, useExisting: TerminalMonitorAdapterService },
    { provide: TerminalAnimationPort, useExisting: TerminalAnimationAdapterService },
    { provide: TerminalNavigator, useExisting: TerminalNavigatorAdapterService },
    { provide: TerminalIpcPort, useExisting: TerminalIpcAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      void Logger.initialize();
      inject(StyleService);
      // The feature-host's declaration phase: whole-set validation, then the
      // migrations and path adapters that must exist before the config is read.
      inject(FeatureHost);
      // The config-load orchestrator: applies shell defaults, writes the shell
      // integration and turns diagnostics into notifications. Must exist before
      // WindowService publishes InitConfigCommand.
      inject(ConfigBootstrapAdapter);
      // The config actions now live in the workbench; instantiate the handler
      // so it listens.
      inject(ConfigActionsHandler);
      // The central terminal-action handlers (step 26): construct so they
      // register on ActionHandlers and the ActionFired subscription is live.
      inject(TerminalActionHandlers);
      // The session-scoped keybinding actions (autocomplete/history/cycle),
      // dispatched to the focused session.
      inject(SessionActionHandlers);
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
        injector.get(RunnableActionsPublisher);
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
        // Construct the tab-list so its actions register, then verify every core
        // action has a handler (a catalog action nothing handles is a bug).
        injector.get(TabListService);
        const unhandledActions = injector.get(ActionHandlers).unhandledCoreActions();
        if (unhandledActions.length > 0) {
          ErrorReporter.reportException({
            error: new Error(`Core actions without a handler: ${unhandledActions.join(", ")}`),
            handled: true,
            source: "app.config",
            context: { operation: "action-handler-coverage" },
          });
        }
      }, 0);
    }),
  ],
};
