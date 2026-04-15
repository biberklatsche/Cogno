import { InjectionToken } from "@angular/core";
import {
  ActionKeybindingContract,
  CommandPaletteHostPortContract,
  CommandRunnerContract,
  DatabaseAccessContract,
  FilesystemContract,
  NotificationCenterPortContract,
  NotificationChannelContract,
  TerminalSearchHostPortContract,
  WorkspaceCloseGuardContract,
  WorkspaceHostPortContract,
} from "@cogno/core-api";

export const actionKeybindingToken = new InjectionToken<ActionKeybindingContract>(
  "action-keybinding-token",
);
export const commandPaletteHostPortToken = new InjectionToken<CommandPaletteHostPortContract>(
  "command-palette-host-port-token",
);
export const commandRunnerToken = new InjectionToken<CommandRunnerContract>("command-runner-token");
export const databaseAccessToken = new InjectionToken<DatabaseAccessContract>(
  "database-access-token",
);
export const filesystemToken = new InjectionToken<FilesystemContract>("filesystem-token");
export const additionalNotificationChannelsToken = new InjectionToken<
  ReadonlyArray<NotificationChannelContract>
>("additional-notification-channels-token");
export const notificationCenterPortToken = new InjectionToken<NotificationCenterPortContract>(
  "notification-center-port-token",
);
export const terminalSearchHostPortToken = new InjectionToken<TerminalSearchHostPortContract>(
  "terminal-search-host-port-token",
);
export const workspaceCloseGuardToken = new InjectionToken<WorkspaceCloseGuardContract>(
  "workspace-close-guard-token",
);
export const workspaceHostPortToken = new InjectionToken<WorkspaceHostPortContract>(
  "workspace-host-port-token",
);
