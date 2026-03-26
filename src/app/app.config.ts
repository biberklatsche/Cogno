import type { ApplicationConfig } from "@angular/core";
import {
  ErrorHandler,
  inject,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
} from "@angular/core";
import { CliActionService } from "@cogno/app/cli-command/cli-action.service";
import { GlobalErrorHandler } from "@cogno/app/common/error/global-error.handler";
import { ConfigService, RealConfigService } from "@cogno/app/config/+state/config.service";
import { KeybindService } from "@cogno/app/keybinding/keybind.service";
import { NativeMenuService } from "@cogno/app/menu/native-menu/native-menu.service";
import { NotificationDispatchService } from "@cogno/app/notification/+state/notification-dispatch.service";
import { StyleService } from "@cogno/app/style/style.service";
import { WindowService } from "@cogno/app/window/window.service";
import { NotificationService } from "@cogno/features/side-menu/notification/notification.service";
import { TerminalSearchService } from "@cogno/features/side-menu/terminal-search/terminal-search.service";
import {
  actionKeybindingToken,
  commandPaletteHostPortToken,
  commandRunnerToken,
  databaseAccessToken,
  filesystemToken,
  terminalSearchHostPortToken,
  workspaceHostPortToken,
} from "@cogno/core-sdk";
import { CommandPaletteHostPortAdapterService } from "@cogno/app/app-host/command-palette-host-port.adapter.service";
import { CommandRunnerHostService } from "@cogno/app/app-host/command-runner-host.service";
import { SideMenuLifecycleRuntimeService } from "@cogno/app/app-host/side-menu-lifecycle-runtime.service";
import { DatabaseAccessHostService } from "@cogno/app/app-host/database-access-host.service";
import { FilesystemHostService } from "@cogno/app/app-host/filesystem-host.service";
import { TerminalSearchHostPortAdapterService } from "@cogno/app/app-host/terminal-search-host-port.adapter.service";
import { WorkspaceHostApplicationService } from "@cogno/app/app-host/workspace-host-application.service";
import { WorkspaceHostPortAdapterService } from "@cogno/app/app-host/workspace-host-port.adapter.service";
import { AppWiringService } from "./app-host/app-wiring.service";
import { ActionKeybindingPortAdapterService } from "@cogno/app/app-host/action-keybinding-port.adapter.service";
import { WorkspaceShortcutActionService } from "@cogno/app/app-host/workspace-shortcut-action.service";

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: ConfigService, useClass: RealConfigService },
    { provide: commandRunnerToken, useExisting: CommandRunnerHostService },
    { provide: commandPaletteHostPortToken, useExisting: CommandPaletteHostPortAdapterService },
    { provide: actionKeybindingToken, useExisting: ActionKeybindingPortAdapterService },
    { provide: databaseAccessToken, useExisting: DatabaseAccessHostService },
    { provide: filesystemToken, useExisting: FilesystemHostService },
    { provide: terminalSearchHostPortToken, useExisting: TerminalSearchHostPortAdapterService },
    { provide: workspaceHostPortToken, useExisting: WorkspaceHostPortAdapterService },
    provideZonelessChangeDetection(),
    provideEnvironmentInitializer(() => {
      inject(StyleService);
      inject(NotificationDispatchService);
      inject(NotificationService);
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
      inject(TerminalSearchService);
    }),
  ],
};
