import { Observable } from "rxjs";

export type TerminalIdentifierContract = string;

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
  readonly terminalId: TerminalIdentifierContract;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly shellType?: string;
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
  readonly terminalId: TerminalIdentifierContract;
  readonly text: string;
  readonly appendNewline?: boolean;
}

export interface TerminalBusyStateChangeContract {
  readonly terminalId: TerminalIdentifierContract;
  readonly isBusy: boolean;
}

export interface TerminalGatewayContract {
  readonly focusedTerminalId$: Observable<TerminalIdentifierContract | undefined>;
  readonly busyStateChanges$: Observable<TerminalBusyStateChangeContract>;
  getFocusedTerminalId(): TerminalIdentifierContract | undefined;
  hasTerminal(terminalId: TerminalIdentifierContract | undefined): boolean;
  focusTerminal(terminalId: TerminalIdentifierContract): void;
  injectInput(request: TerminalInputRequestContract): void;
  captureFocusedSnapshot(
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
  captureSnapshot(
    terminalId: TerminalIdentifierContract,
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
}

export abstract class TerminalGateway implements TerminalGatewayContract {
  abstract readonly focusedTerminalId$: Observable<TerminalIdentifierContract | undefined>;
  abstract readonly busyStateChanges$: Observable<TerminalBusyStateChangeContract>;
  abstract getFocusedTerminalId(): TerminalIdentifierContract | undefined;
  abstract hasTerminal(terminalId: TerminalIdentifierContract | undefined): boolean;
  abstract focusTerminal(terminalId: TerminalIdentifierContract): void;
  abstract injectInput(request: TerminalInputRequestContract): void;
  abstract captureFocusedSnapshot(
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
  abstract captureSnapshot(
    terminalId: TerminalIdentifierContract,
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined>;
}
