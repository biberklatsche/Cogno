import { Injectable } from "@angular/core";
import {
  BoundSessionIdentity,
  BoundSessionMode,
  SessionBinding,
} from "@cogno/core/api/bound-session";
import { CommandRunner } from "@cogno/core/api/command-runner-port";
import { BoundSession, BoundSessionHandle, SessionApi } from "@cogno/core/api/session-api";
import { SessionRunRequest, SessionRunResult } from "@cogno/core/api/session-run";
import { Filesystem } from "@cogno/core/session/exec/filesystem";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { ProcessTreeSnapshot } from "@cogno/platform/pty";
import { isWslShellContext, TerminalId } from "@cogno/shared/domain";
import { distinctUntilChanged, filter, map, merge, Observable } from "rxjs";
import { BoundRuntimeStatus, BoundSessionTracker } from "./bound-session.tracker";

@Injectable({ providedIn: "root" })
export class TerminalGatewayService implements SessionApi {
  readonly cwdChanges$: Observable<void>;

  /** The session the API is bound to; follows focus unless held. */
  readonly boundSession$: Observable<BoundSession>;
  private readonly boundSessionTracker: BoundSessionTracker;

  constructor(
    private readonly appBus: AppBus,
    private readonly terminalSessionRegistry: TerminalSessionRegistry,
    private readonly commandRunner: CommandRunner,
    private readonly filesystem: Filesystem,
  ) {
    // Focus reaches the binding two ways: an explicit FocusTerminal command
    // (keybind, palette, reveal) and the focusChanged fact a terminal reports
    // when it actually takes focus - a plain click only does the latter, so the
    // binding must follow both or it lags behind clicks.
    const focusFromCommand$: Observable<TerminalId | undefined> = this.appBus
      .on$("FocusTerminal")
      .pipe(map((event) => event.payload));
    const focusFromFact$: Observable<TerminalId | undefined> =
      this.terminalSessionRegistry.facts$.pipe(
        filter(({ fact }) => fact.type === "focusChanged" && fact.focused),
        map(({ terminalId }) => terminalId),
      );
    const focusedTerminalId$ = merge(focusFromCommand$, focusFromFact$).pipe(
      distinctUntilChanged(),
    );
    this.cwdChanges$ = this.terminalSessionRegistry.facts$.pipe(
      filter(({ fact }) => fact.type === "cwdReported"),
      map(() => undefined),
    );

    this.boundSessionTracker = new BoundSessionTracker(
      focusedTerminalId$,
      (terminalId) => this.identityOf(terminalId),
      (terminalId) => this.runtimeOf(terminalId),
    );
    this.boundSession$ = this.boundSessionTracker.binding$.pipe(
      map((binding) => this.toBoundSession(binding)),
    );
  }

  /** Turn the tracker's binding into the public bound session (a handle when active). */
  private toBoundSession(binding: SessionBinding): BoundSession {
    if (binding.status === "active") {
      return { status: "active", session: this.createHandle(binding.identity, binding.mode) };
    }
    return binding;
  }

  /** A live handle bound to `identity`: run/fs recheck it before they act. */
  private createHandle(identity: BoundSessionIdentity, mode: BoundSessionMode): BoundSessionHandle {
    const stateOf = () => this.terminalSessionRegistry.get(identity.terminalId)?.host.state;
    return {
      identity,
      mode,
      get cwd() {
        return stateOf()?.cwd ?? "";
      },
      get shellContext() {
        const state = stateOf();
        if (!state) {
          throw new Error("Bound session has ended.");
        }
        return state.shellContext;
      },
      get contextRevision() {
        return stateOf()?.contextRevision ?? -1;
      },
      run: (request) => this.run(request, identity),
      fs: {
        readTextFile: (path) => this.readBoundTextFile(path, identity),
        normalizePath: (path) => this.normalizeBoundPath(path, identity),
      },
      processTree: () => this.boundProcessTree(identity),
    };
  }

  /**
   * The bound session's live process tree. Needs no shell context (works for
   * remote/ssh sessions), only that the identity is still the live binding.
   */
  private async boundProcessTree(identity: BoundSessionIdentity): Promise<ProcessTreeSnapshot> {
    if (!this.boundSessionMatches(identity)) {
      throw new Error("The bound session is no longer active.");
    }
    const entry = this.terminalSessionRegistry.get(identity.terminalId);
    if (!entry) {
      throw new Error("The bound session is no longer active.");
    }
    return entry.host.getProcessTree();
  }

  /** Read a file in the bound session's live context; rejects like `run`. */
  private async readBoundTextFile(path: string, identity: BoundSessionIdentity): Promise<string> {
    const shellContext = this.boundShellContextOrThrow(identity);
    return this.filesystem.readTextFile(path, shellContext);
  }

  private normalizeBoundPath(path: string, identity: BoundSessionIdentity): string {
    const shellContext = this.boundShellContextOrThrow(identity);
    return this.filesystem.normalizePath(path, shellContext);
  }

  private boundShellContextOrThrow(identity: BoundSessionIdentity) {
    if (!this.boundSessionMatches(identity)) {
      throw new Error("The bound session is no longer active.");
    }
    const state = this.terminalSessionRegistry.get(identity.terminalId)?.host.state;
    if (!state) {
      throw new Error("The bound session is no longer active.");
    }
    if (!state.isContextKnown) {
      throw new Error("The bound session's context is not available (remote or unknown shell).");
    }
    return state.shellContext;
  }

  /** Pin the binding to the current session across focus changes. */
  hold(): void {
    this.boundSessionTracker.hold();
  }

  /** Return to following focus. */
  release(): void {
    this.boundSessionTracker.release();
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

  /** True only if `identity` is the session bound right now, still live. */
  private boundSessionMatches(identity: BoundSessionIdentity): boolean {
    const bound = this.boundSessionTracker.binding;
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
}
