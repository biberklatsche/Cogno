import { Injectable } from "@angular/core";
import { TauriPty } from "@cogno/app-tauri/pty";
import {
  TerminalBusyStateChangeContract,
  TerminalGateway,
  TerminalIdentifierContract,
  TerminalInputRequestContract,
  TerminalSnapshotCommandContract,
  TerminalSnapshotContract,
  TerminalSnapshotOptionsContract,
} from "@cogno/core-api";
import { map, Observable } from "rxjs";
import { AppBus } from "../app-bus/app-bus";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { Command } from "../terminal/+state/state";
import { TerminalSessionRegistry } from "../terminal/+state/terminal-session.registry";

@Injectable({ providedIn: "root" })
export class TerminalGatewayAdapterService extends TerminalGateway {
  readonly focusedTerminalId$: Observable<TerminalIdentifierContract | undefined>;
  readonly busyStateChanges$: Observable<TerminalBusyStateChangeContract>;

  constructor(
    private readonly appBus: AppBus,
    private readonly gridListService: GridListService,
    private readonly terminalSessionRegistry: TerminalSessionRegistry,
  ) {
    super();
    this.focusedTerminalId$ = this.appBus
      .onType$("FocusTerminal", { path: ["app", "terminal"] })
      .pipe(map((event) => event.payload));
    this.busyStateChanges$ = this.appBus
      .onType$("TerminalBusyChanged", { path: ["app", "terminal"] })
      .pipe(
        map((event) => ({
          terminalId: event.payload?.terminalId ?? "",
          isBusy: event.payload?.isBusy ?? false,
        })),
      );
  }

  getFocusedTerminalId(): TerminalIdentifierContract | undefined {
    return this.gridListService.getFocusedTerminalId();
  }

  hasTerminal(terminalId: TerminalIdentifierContract | undefined): boolean {
    return this.terminalSessionRegistry.has(terminalId);
  }

  focusTerminal(terminalId: TerminalIdentifierContract): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "FocusTerminal",
      payload: terminalId,
    });
  }

  injectInput(request: TerminalInputRequestContract): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "InjectTerminalInput",
      payload: request,
    });
  }

  async captureFocusedSnapshot(
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined> {
    const focusedTerminalId = this.getFocusedTerminalId();
    if (!focusedTerminalId) {
      return undefined;
    }

    return this.captureSnapshot(focusedTerminalId, options);
  }

  async captureSnapshot(
    terminalId: TerminalIdentifierContract,
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined> {
    const terminalSessionEntry = this.terminalSessionRegistry.get(terminalId);
    if (!terminalSessionEntry) {
      return undefined;
    }

    const maxCommands = options?.maxCommands ?? 8;
    const maxOutputChars = options?.maxOutputChars ?? 4000;
    const terminalState = terminalSessionEntry.stateManager.state;
    const commandSummaries = terminalSessionEntry.stateManager.commands
      .slice(-maxCommands)
      .map((command) => this.toCommandSummary(command));

    let process: TerminalSnapshotContract["process"];
    if (options?.includeProcessSummary) {
      try {
        const processTreeSnapshot = await TauriPty.getProcessTreeByTerminalId(terminalId);
        process = {
          processId: processTreeSnapshot.rootProcess.processId,
          name: processTreeSnapshot.rootProcess.name,
          cwd: processTreeSnapshot.rootProcess.currentWorkingDirectory ?? undefined,
        };
      } catch {
        process = undefined;
      }
    }

    return {
      terminalId,
      tabId: this.gridListService.findTabIdByTerminalId(terminalId),
      workspaceId: this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId),
      shellType: terminalState.shellContext.shellType,
      cwd: terminalState.cwd,
      input: terminalState.input.text,
      isCommandRunning: terminalState.isCommandRunning,
      commands: commandSummaries,
      lastOutput: terminalSessionEntry.session.getRecentOutputSnapshot(60, maxOutputChars),
      latestCommandOutput: terminalSessionEntry.session.getLatestCommandOutputSnapshot(
        Math.min(maxOutputChars, 3000),
      ),
      process,
    };
  }

  private toCommandSummary(command: Command): TerminalSnapshotCommandContract {
    return {
      id: command.id,
      text: command.command,
      cwd: command.directory,
      durationMs: command.duration,
      returnCode: command.returnCode,
    };
  }
}
