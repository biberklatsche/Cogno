import { Observable } from "rxjs";
import { ShellContextContract } from "./filesystem.contract";

export type TerminalId = string;

export interface TerminalSnapshotCommandContract {
  readonly id: string;
  readonly text?: string;
  readonly cwd?: string;
  readonly durationMs?: number;
  readonly returnCode?: number;
}

export interface TerminalSnapshotProcessContract {
  readonly processId?: number;
  readonly name?: string;
  readonly cwd?: string;
}

export interface TerminalSnapshotContract {
  readonly terminalId: TerminalId;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly shellType?: string;
  readonly shellContext?: ShellContextContract;
  readonly cwd?: string;
  readonly input?: string;
  readonly isCommandRunning: boolean;
  readonly commands: ReadonlyArray<TerminalSnapshotCommandContract>;
  readonly lastOutput?: string;
  readonly latestCommandOutput?: string;
  readonly process?: TerminalSnapshotProcessContract;
}

export interface TerminalSnapshotOptionsContract {
  readonly maxCommands?: number;
  readonly maxOutputChars?: number;
  readonly includeProcessSummary?: boolean;
}

export interface TerminalInputRequestContract {
  readonly terminalId: TerminalId;
  readonly text: string;
  readonly appendNewline?: boolean;
}

export interface TerminalBusyStateChangeContract {
  readonly terminalId: TerminalId;
  readonly isBusy: boolean;
}

export interface TerminalGatewayContract {
  readonly focusedTerminalId$: Observable<TerminalId | undefined>;
  readonly busyStateChanges$: Observable<TerminalBusyStateChangeContract>;
  readonly cwdChanges$: Observable<void>;
  getFocusedTerminalId(): TerminalId | undefined;
  hasTerminal(terminalId: TerminalId | undefined): boolean;
  focusTerminal(terminalId: TerminalId): void;
  injectInput(request: TerminalInputRequestContract): void;
  captureFocusedSnapshot(
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
  captureSnapshot(
    terminalId: TerminalId,
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
}

export abstract class TerminalGateway implements TerminalGatewayContract {
  abstract readonly focusedTerminalId$: Observable<TerminalId | undefined>;
  abstract readonly busyStateChanges$: Observable<TerminalBusyStateChangeContract>;
  abstract readonly cwdChanges$: Observable<void>;
  abstract getFocusedTerminalId(): TerminalId | undefined;
  abstract hasTerminal(terminalId: TerminalId | undefined): boolean;
  abstract focusTerminal(terminalId: TerminalId): void;
  abstract injectInput(request: TerminalInputRequestContract): void;
  abstract captureFocusedSnapshot(
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
  abstract captureSnapshot(
    terminalId: TerminalId,
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
}
