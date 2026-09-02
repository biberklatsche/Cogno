import { Injectable } from "@angular/core";
import { Command } from "@cogno/core/session/model/command.model";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TauriPty } from "@cogno/platform/pty";
import {
  TerminalBusyStateChangeContract,
  TerminalGateway,
  TerminalId,
  TerminalInputRequestContract,
  TerminalSnapshotCommandContract,
  TerminalSnapshotContract,
  TerminalSnapshotOptionsContract,
} from "@cogno/shared/ports";
import { map, Observable } from "rxjs";
import { BoundSession, BoundSessionIdentity } from "./bound-session";
import { BoundRuntimeStatus, BoundSessionTracker } from "./bound-session.tracker";

@Injectable({ providedIn: "root" })
export class TerminalGatewayService extends TerminalGateway {
  readonly focusedTerminalId$: Observable<TerminalId | undefined>;
  readonly busyStateChanges$: Observable<TerminalBusyStateChangeContract>;
  readonly cwdChanges$: Observable<void>;

  /** The session the API is bound to; follows focus unless held. */
  readonly boundSession$: Observable<BoundSession>;
  private readonly boundSessionTracker: BoundSessionTracker;

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
    this.cwdChanges$ = this.appBus
      .onType$("TerminalCwdChanged", { path: ["app", "terminal"] })
      .pipe(map(() => undefined));

    this.boundSessionTracker = new BoundSessionTracker(
      this.focusedTerminalId$,
      (terminalId) => this.identityOf(terminalId),
      (terminalId) => this.runtimeOf(terminalId),
    );
    this.boundSession$ = this.boundSessionTracker.boundSession$;
  }

  /** Pin the binding to the current session across focus changes. */
  hold(): void {
    this.boundSessionTracker.hold();
  }

  /** Return to following focus. */
  release(): void {
    this.boundSessionTracker.release();
  }

  /** Bring a session into view (workspace + tab + focus). */
  revealSession(terminalId: TerminalId): void {
    this.revealTerminal(terminalId);
  }

  private identityOf(terminalId: TerminalId): BoundSessionIdentity | undefined {
    const entry = this.terminalSessionRegistry.get(terminalId);
    if (!entry) {
      return undefined;
    }
    return { terminalId, sessionToken: entry.host.model.sessionToken };
  }

  private runtimeOf(terminalId: TerminalId): Observable<BoundRuntimeStatus> {
    const entry = this.terminalSessionRegistry.get(terminalId);
    if (!entry) {
      return new Observable<BoundRuntimeStatus>((subscriber) => subscriber.next("closed"));
    }
    return entry.host.runtime$.pipe(
      map((runtime): BoundRuntimeStatus => {
        if (runtime.status === "closing") {
          return "closing";
        }
        if (
          runtime.status === "exited" ||
          runtime.status === "closed" ||
          runtime.status === "failed"
        ) {
          return "closed";
        }
        return "active";
      }),
    );
  }

  getFocusedTerminalId(): TerminalId | undefined {
    return this.gridListService.getFocusedTerminalId();
  }

  hasTerminal(terminalId: TerminalId | undefined): boolean {
    return this.terminalSessionRegistry.has(terminalId);
  }

  focusTerminal(terminalId: TerminalId): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "FocusTerminal",
      payload: terminalId,
    });
  }

  revealTerminal(terminalId: TerminalId): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "RevealTerminal",
      payload: terminalId,
    });
  }

  injectInput(request: TerminalInputRequestContract): void {
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "WriteRawToPty",
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
    terminalId: TerminalId,
    options?: TerminalSnapshotOptionsContract,
  ): Promise<TerminalSnapshotContract | undefined> {
    const terminalSessionEntry = this.terminalSessionRegistry.get(terminalId);
    if (!terminalSessionEntry) {
      return undefined;
    }

    const maxCommands = options?.maxCommands ?? 8;
    const maxOutputChars = options?.maxOutputChars ?? 4000;
    const terminalState = terminalSessionEntry.host.state;
    const commandSummaries = terminalSessionEntry.host.model.commands
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
      shellContext: terminalState.shellContext,
      cwd: terminalState.cwd,
      input: terminalState.input.text,
      isCommandRunning: terminalState.isCommandRunning,
      commands: commandSummaries,
      lastOutput: terminalSessionEntry.host.getRecentOutputSnapshot(60, maxOutputChars),
      latestCommandOutput: terminalSessionEntry.host.getLatestCommandOutputSnapshot(
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
