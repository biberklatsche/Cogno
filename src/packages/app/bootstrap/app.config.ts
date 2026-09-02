import {
  ApplicationConfig,
  ErrorHandler,
  Injector,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { AboutDialogAdapterService } from "@cogno/app/app-host/about-dialog.adapter.service";
import { ActionCatalogAdapterService } from "@cogno/app/app-host/action-catalog.adapter.service";
import { ActionKeybindingPortAdapterService } from "@cogno/app/app-host/action-keybinding-port.adapter.service";
import {
  additionalNotificationChannelsToken,
  featuresToken,
} from "@cogno/app/app-host/app-host.tokens";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { ApplicationConfigurationPortAdapterService } from "@cogno/app/app-host/application-configuration-port.adapter.service";
import { CommandRunnerHostService } from "@cogno/app/app-host/command-runner-host.service";
import { ConfirmDialogAdapterService } from "@cogno/app/app-host/confirm-dialog.adapter.service";
import { FilesystemHostService } from "@cogno/app/app-host/filesystem-host.service";
import { NotificationChannelsFeatureSourceService } from "@cogno/app/app-host/notification-channels-feature-source.service";
import { SideMenuLifecycleRuntimeService } from "@cogno/app/app-host/side-menu-lifecycle-runtime.service";
import { TerminalAnimationAdapterService } from "@cogno/app/app-host/terminal-animation.adapter.service";
import { TerminalAutocompleteFeatureSuggestorService } from "@cogno/app/app-host/terminal-autocomplete-feature-suggestor.service";
import { TerminalGatewayAdapterService } from "@cogno/app/app-host/terminal-gateway.adapter.service";
import { TerminalMonitorAdapterService } from "@cogno/app/app-host/terminal-monitor.adapter.service";
import { TerminalNavigatorAdapterService } from "@cogno/app/app-host/terminal-navigator.adapter.service";
import { TerminalSearchHostPortAdapterService } from "@cogno/app/app-host/terminal-search-host-port.adapter.service";
import { WorkspaceCloseGuardAdapterService } from "@cogno/app/app-host/workspace-close-guard.adapter.service";
import { WorkspaceHostApplicationService } from "@cogno/app/app-host/workspace-host-application.service";
import { WorkspaceHostPortAdapterService } from "@cogno/app/app-host/workspace-host-port.adapter.service";
import { CliActionService } from "@cogno/app/cli-command/cli-action.service";
import { HttpMessageAdapterService } from "@cogno/app/cogno-message/http-message-adapter.service";
import { TerminalIpcAdapterService } from "@cogno/app/cogno-message/terminal-ipc.adapter.service";
import { ErrorReportingRuntimeService } from "@cogno/app/common/error/error-reporting-runtime.service";
import { ConfigBootstrapAdapter } from "@cogno/app/config/config-bootstrap.adapter";
import { features } from "@cogno/app/features";
import { KeybindService } from "@cogno/app/keybinding/keybind.service";
import { NativeMenuService } from "@cogno/app/menu/native-menu/native-menu.service";
import { NotificationTargetRuntimeService } from "@cogno/app/notification/+state/notification-target-runtime.service";
import { ConfigService, RealConfigService } from "@cogno/core/infrastructure/config/config.service";
import { GlobalErrorHandler } from "@cogno/core/infrastructure/error/global-error.handler";
import { StyleService } from "@cogno/core/infrastructure/theme/style.service";
import { AutocompleteSuggestorSource } from "@cogno/core/session/autocomplete/autocomplete-suggestor.source";
import { NotificationCenterPortAdapterService } from "@cogno/core/workbench/notification/+state/notification-center-port.adapter.service";
import { NotificationChannelsPortAdapterService } from "@cogno/core/workbench/notification/+state/notification-channels-port.adapter.service";
import { NotificationDispatchService } from "@cogno/core/workbench/notification/+state/notification-dispatch.service";
import { NotificationChannelsSource } from "@cogno/core/workbench/notification/notification-channels.source";
import { SideMenuStatePersistenceService } from "@cogno/core/workbench/side-menu/side-menu-state-persistence.service";
import { WindowService } from "@cogno/core/workbench/window/window.service";
import { AiConfigurationTransformerService } from "@cogno/features/ai/ai-configuration-transformer.service";
import { AI_DETECTABLE_PROVIDER_DEFINITIONS_TOKEN } from "@cogno/features/ai/ai-detection.models";
import { AiProviderDetectionService } from "@cogno/features/ai/ai-provider-detection.service";
import { CodingAgentStartupService, CodingAgentStatusService } from "@cogno/features/coding-agent";
import {
  ConfirmDialogPort,
  TerminalIpcPort,
  TerminalMonitorPort,
} from "@cogno/features/coding-agent/ports";
import {
  TerminalNavigator,
  TerminalSearchHostPort,
  WorkspaceHostPort,
} from "@cogno/features/side-menu/ports";
import { WorkspaceCloseGuard } from "@cogno/features/side-menu/workspace/workspace-close-guard.port";
import { WorkspaceShortcutActionService } from "@cogno/features/side-menu/workspace/workspace-shortcut-action.service";
import { Logger } from "@cogno/platform/logger";
import { ConfigurationTransformer } from "@cogno/shared/contributions";
import {
  ActionCatalog,
  ActionDispatcher,
  ActionKeybindingPort,
  ApplicationConfigurationPort,
  CommandRunner,
  Filesystem,
  NotificationCenterPort,
  NotificationChannelsPort,
  TerminalAnimationPort,
  TerminalGateway,
} from "@cogno/shared/ports";
import { aiDetectableProviderDefinitions } from "./ai-detectable-providers";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
    { provide: CommandRunner, useExisting: CommandRunnerHostService },
    { provide: ActionKeybindingPort, useExisting: ActionKeybindingPortAdapterService },
    {
      provide: AutocompleteSuggestorSource,
      useExisting: TerminalAutocompleteFeatureSuggestorService,
    },
    {
      provide: NotificationChannelsSource,
      useExisting: NotificationChannelsFeatureSourceService,
    },
    { provide: Filesystem, useExisting: FilesystemHostService },
    { provide: additionalNotificationChannelsToken, useValue: [] },
    { provide: ActionCatalog, useExisting: ActionCatalogAdapterService },
    { provide: ActionDispatcher, useExisting: ActionCatalogAdapterService },
    {
      provide: ApplicationConfigurationPort,
      useExisting: ApplicationConfigurationPortAdapterService,
    },
    {
      provide: AI_DETECTABLE_PROVIDER_DEFINITIONS_TOKEN,
      useValue: aiDetectableProviderDefinitions,
    },
    {
      provide: ConfigurationTransformer,
      useExisting: AiConfigurationTransformerService,
      multi: true,
    },
    { provide: featuresToken, useValue: features },
    { provide: NotificationCenterPort, useExisting: NotificationCenterPortAdapterService },
    { provide: NotificationChannelsPort, useExisting: NotificationChannelsPortAdapterService },
    { provide: TerminalGateway, useExisting: TerminalGatewayAdapterService },
    { provide: TerminalSearchHostPort, useExisting: TerminalSearchHostPortAdapterService },
    { provide: WorkspaceCloseGuard, useExisting: WorkspaceCloseGuardAdapterService },
    { provide: WorkspaceHostPort, useExisting: WorkspaceHostPortAdapterService },
    { provide: TerminalMonitorPort, useExisting: TerminalMonitorAdapterService },
    { provide: TerminalAnimationPort, useExisting: TerminalAnimationAdapterService },
    { provide: TerminalNavigator, useExisting: TerminalNavigatorAdapterService },
    { provide: ConfirmDialogPort, useExisting: ConfirmDialogAdapterService },
    { provide: TerminalIpcPort, useExisting: TerminalIpcAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      void Logger.initialize();
      inject(StyleService);
      inject(AppWiringService);
      // MIGRATION-TEMP(step 19): keeps the config's actions, notifications and
      // shell bootstrap alive until they reach their own layer. Must exist
      // before WindowService publishes InitConfigCommand.
      inject(ConfigBootstrapAdapter);
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
        injector.get(SideMenuLifecycleRuntimeService);
        injector.get(SideMenuStatePersistenceService);
        injector.get(ActionCatalogAdapterService);
        injector.get(ActionKeybindingPortAdapterService);
        injector.get(TerminalSearchHostPortAdapterService);
        injector.get(WorkspaceHostPortAdapterService);
        injector.get(WorkspaceShortcutActionService);
        injector.get(AiProviderDetectionService);
        injector.get(CodingAgentStatusService);
        injector.get(CodingAgentStartupService);
        injector.get(AboutDialogAdapterService);
      }, 0);
    }),
  ],
};
