import {
  ApplicationConfig,
  ErrorHandler,
  Injector,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { ActionCatalogAdapterService } from "@cogno/app/app-host/action-catalog.adapter.service";
import { ActionKeybindingPortAdapterService } from "@cogno/app/app-host/action-keybinding-port.adapter.service";
import { additionalNotificationChannelsToken } from "@cogno/app/app-host/app-host.tokens";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { ApplicationConfigurationPortAdapterService } from "@cogno/app/app-host/application-configuration-port.adapter.service";
import { CommandRunnerHostService } from "@cogno/app/app-host/command-runner-host.service";
import { ConfirmDialogAdapterService } from "@cogno/app/app-host/confirm-dialog.adapter.service";
import { DatabaseAccessHostService } from "@cogno/app/app-host/database-access-host.service";
import { FilesystemHostService } from "@cogno/app/app-host/filesystem-host.service";
import { GitBlobReaderHostService } from "@cogno/app/app-host/git-blob-reader-host.service";
import { HttpClientPortAdapterService } from "@cogno/app/app-host/http-client-port.adapter.service";
import { OpenerAdapterService } from "@cogno/app/app-host/opener.adapter.service";
import { OsPlatformAdapterService } from "@cogno/app/app-host/os-platform.adapter.service";
import { SideMenuLifecycleRuntimeService } from "@cogno/app/app-host/side-menu-lifecycle-runtime.service";
import { SideMenuStatePersistenceService } from "@cogno/app/app-host/side-menu-state-persistence.service";
import { SimpleFileAccessAdapterService } from "@cogno/app/app-host/simple-file-access.adapter.service";
import { TerminalAnimationAdapterService } from "@cogno/app/app-host/terminal-animation.adapter.service";
import { TerminalGatewayAdapterService } from "@cogno/app/app-host/terminal-gateway.adapter.service";
import { TerminalLinkPatternAdapterService } from "@cogno/app/app-host/terminal-link-pattern.adapter.service";
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
  ApplicationConfigurationPort,
  ApplicationProduct,
  CommandRunner,
  ConfigurationTransformer,
  ConfirmDialogPort,
  DatabaseAccess,
  Filesystem,
  HttpClientPort,
  NotificationCenterPort,
  Opener,
  OsPlatformPort,
  SimpleFileAccess,
  TerminalAnimationPort,
  TerminalGateway,
  TerminalIpcPort,
  TerminalLinkPatternPort,
  TerminalMonitorPort,
  TerminalNavigator,
  TerminalSearchHostPort,
  WorkspaceHostPort,
} from "@cogno/core-api";
import { AiConfigurationTransformerService } from "@cogno/features/ai/ai-configuration-transformer.service";
import { AI_DETECTABLE_PROVIDER_DEFINITIONS_TOKEN } from "@cogno/features/ai/ai-detection.models";
import { AiProviderDetectionService } from "@cogno/features/ai/ai-provider-detection.service";
import { CodingAgentStartupService, CodingAgentStatusService } from "@cogno/features/coding-agent";
import { GitBlobReader } from "@cogno/features/side-menu/git/git-blob-reader.port";
import { WorkspaceCloseGuard } from "@cogno/features/side-menu/workspace/workspace-close-guard.port";
import { WorkspaceShortcutActionService } from "@cogno/features/side-menu/workspace/workspace-shortcut-action.service";
import { aiDetectableProviderDefinitions } from "../products/ai-detectable-provider-definitions";
import { productDefinition } from "../products/product-definition.instance";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
    { provide: CommandRunner, useExisting: CommandRunnerHostService },
    { provide: GitBlobReader, useExisting: GitBlobReaderHostService },
    { provide: Opener, useExisting: OpenerAdapterService },
    { provide: ActionKeybindingPort, useExisting: ActionKeybindingPortAdapterService },
    { provide: DatabaseAccess, useExisting: DatabaseAccessHostService },
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
    { provide: ApplicationProduct, useValue: productDefinition.applicationProduct },
    { provide: HttpClientPort, useExisting: HttpClientPortAdapterService },
    { provide: NotificationCenterPort, useExisting: NotificationCenterPortAdapterService },
    {
      provide: sideMenuFeatureDefinitionsToken,
      useValue: [...sideMenuFeatureDefinitions, ...productDefinition.sideMenuFeatureDefinitions],
    },
    { provide: TerminalGateway, useExisting: TerminalGatewayAdapterService },
    { provide: TerminalSearchHostPort, useExisting: TerminalSearchHostPortAdapterService },
    { provide: WorkspaceCloseGuard, useExisting: WorkspaceCloseGuardAdapterService },
    { provide: WorkspaceHostPort, useExisting: WorkspaceHostPortAdapterService },
    { provide: SimpleFileAccess, useExisting: SimpleFileAccessAdapterService },
    { provide: TerminalMonitorPort, useExisting: TerminalMonitorAdapterService },
    { provide: OsPlatformPort, useExisting: OsPlatformAdapterService },
    { provide: TerminalAnimationPort, useExisting: TerminalAnimationAdapterService },
    { provide: TerminalLinkPatternPort, useExisting: TerminalLinkPatternAdapterService },
    { provide: TerminalNavigator, useExisting: TerminalNavigatorAdapterService },
    { provide: ConfirmDialogPort, useExisting: ConfirmDialogAdapterService },
    { provide: TerminalIpcPort, useExisting: TerminalIpcAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      void Logger.initialize();
      inject(StyleService);
      inject(AppWiringService);
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
      }, 0);
    }),
  ],
};
