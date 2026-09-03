import { Injectable } from "@angular/core";
import { Command } from "@cogno/core/session/model/command.model";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TauriPty } from "@cogno/platform/pty";
import { isWslShellContext } from "@cogno/shared/domain";
import {
  CommandRunner,
  TerminalBusyStateChangeContract,
  TerminalGateway,
  TerminalId,
  TerminalInputRequestContract,
  TerminalSnapshotCommandContract,
  TerminalSnapshotContract,
  TerminalSnapshotOptionsContract,
} from "@cogno/shared/ports";
import { filter, map, Observable } from "rxjs";
import { BoundSession, BoundSessionIdentity } from "./bound-session";
import { BoundRuntimeStatus, BoundSessionTracker } from "./bound-session.tracker";
import { SessionRunRequest, SessionRunResult } from "./session-run";

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
    private readonly commandRunner: CommandRunner,
  ) {
    super();
    this.focusedTerminalId$ = this.appBus
      .onType$("FocusTerminal", { path: ["app", "terminal"] })
      .pipe(map((event) => event.payload));
    this.busyStateChanges$ = this.terminalSessionRegistry.facts$.pipe(
      map(({ terminalId, fact }) =>
        fact.type === "busyChanged" ? { terminalId, isBusy: fact.isBusy } : undefined,
      ),
      filter((change): change is TerminalBusyStateChangeContract => change !== undefined),
    );
    this.cwdChanges$ = this.terminalSessionRegistry.facts$.pipe(
      filter(({ fact }) => fact.type === "cwdReported"),
      map(() => undefined),
    );

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

  /**
   * Write into a session. When an `identity` is given (the future, guarded
   * path) the write is rechecked against the live bound session immediately
   * before it goes out: it only lands if that session is still active and
   * still carries the same terminal and trust token the caller captured.
   * After a focus change, or once the session was replaced, the old identity
   * no longer matches and nothing is written. Without an identity the legacy
   * fire-and-forget behaviour is kept for features until they migrate (23-25).
   */
  injectInput(request: TerminalInputRequestContract, identity?: BoundSessionIdentity): void {
    if (identity && !this.boundSessionMatches(identity)) {
      return;
    }
    this.appBus.publish({
      path: ["app", "terminal"],
      type: "WriteRawToPty",
      payload: request,
    });
  }

  /** True only if `identity` is the session bound right now, still live. */
  private boundSessionMatches(identity: BoundSessionIdentity): boolean {
    const bound = this.boundSessionTracker.boundSession;
    if (bound.status !== "active") {
      return false;
    }
    if (
      bound.identity.terminalId !== identity.terminalId ||
      bound.identity.sessionToken !== identity.sessionToken
    ) {
      return false;
    }
    // Recheck against the live session: it may have been replaced (new token)
    // since the binding last emitted.
    const live = this.identityOf(identity.terminalId);
    return live !== undefined && live.sessionToken === identity.sessionToken;
  }

  /**
   * Run a command on the bound session, in its own context. Rejected unless
   * the identity is still the live bound session, the caller's context
   * revision still matches (nothing opened/closed under it), and the context
   * is known (a foreign shell such as ssh is refused). A WSL session runs the
   * command inside its distro via `wsl.exe -d`; a local one runs it directly,
   * both in the session's current working directory.
   */
  async run(request: SessionRunRequest, identity: BoundSessionIdentity): Promise<SessionRunResult> {
    if (!this.boundSessionMatches(identity)) {
      return { status: "rejected", reason: "unbound" };
    }
    const entry = this.terminalSessionRegistry.get(identity.terminalId);
    if (!entry) {
      return { status: "rejected", reason: "unbound" };
    }

    const state = entry.host.state;
    if (state.contextRevision !== request.contextRevision) {
      return { status: "rejected", reason: "stale-context" };
    }
    if (!state.isContextKnown) {
      return { status: "rejected", reason: "unknown-context" };
    }

    const shellContext = state.shellContext;
    const requestedArgs = request.args ?? [];
    const isWsl = isWslShellContext(shellContext);
    const program = isWsl ? "wsl.exe" : request.executable;
    const args = isWsl
      ? ["-d", shellContext.wslDistroName, request.executable, ...requestedArgs]
      : requestedArgs;

    const result = await this.commandRunner.run({
      cwd: state.cwd,
      shellContext,
      program,
      args,
      timeoutMs: request.timeoutMs,
    });
    return { status: "ran", result };
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
