import { Injectable } from "@angular/core";
import {
  BoundSessionIdentity,
  BoundSessionMode,
  SessionBinding,
} from "@cogno/core/api/bound-session";
import { CommandRunner } from "@cogno/core/api/command-runner-port";
import {
  BoundSession,
  BoundSessionHandle,
  SessionApi,
  SessionHandle,
} from "@cogno/core/api/session-api";
import {
  SessionInsertResult,
  SessionRunRejection,
  SessionRunRequest,
  SessionRunResult,
} from "@cogno/core/api/session-run";
import { Filesystem } from "@cogno/core/session/exec/filesystem";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ProcessPromptService } from "@cogno/core/workbench/external/process-prompt.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { ProcessTreeSnapshot } from "@cogno/platform/pty";
import { isWslShellContext, TerminalId } from "@cogno/shared/domain";
import {
  defer,
  distinctUntilChanged,
  filter,
  map,
  merge,
  Observable,
  shareReplay,
  startWith,
} from "rxjs";
import { BoundRuntimeStatus, BoundSessionTracker } from "./bound-session.tracker";

@Injectable({ providedIn: "root" })
export class TerminalGatewayService implements SessionApi {
  readonly cwdChanges$: Observable<void>;

  /** The session the API is bound to; follows focus unless held. */
  readonly boundSession$: Observable<BoundSession>;
  /** Every live session, as a handle that runs in it; a new list per start or end. */
  readonly sessions$: Observable<ReadonlyArray<SessionHandle>>;
  private readonly boundSessionTracker: BoundSessionTracker;

  constructor(
    private readonly appBus: AppBus,
    private readonly terminalSessionRegistry: TerminalSessionRegistry,
    private readonly commandRunner: CommandRunner,
    private readonly filesystem: Filesystem,
    private readonly processPrompts: ProcessPromptService,
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
    this.sessions$ = this.terminalSessionRegistry.changes$.pipe(
      startWith(undefined),
      map(() =>
        this.terminalSessionRegistry.entries.map((entry) =>
          this.createSessionHandle(entry.terminalId, entry.host),
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /**
   * A handle on one session of the directory. It names the session by its
   * host, not a token: a restored session gets its token only when its shell
   * starts, later than it is registered, and the handle must stay valid across
   * that.
   */
  private createSessionHandle(terminalId: TerminalId, host: SessionHost): SessionHandle {
    return {
      terminalId,
      get contextRevision() {
        return host.state.contextRevision;
      },
      run: (request) =>
        this.runOn(request, () =>
          this.terminalSessionRegistry.get(terminalId)?.host === host
            ? { host, state: host.state }
            : { reason: "unbound" },
        ),
    };
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
      insertInput: (text, contextRevision) => this.insertInput(text, contextRevision, identity),
      fs: {
        readTextFile: (path) => this.readBoundTextFile(path, identity),
        normalizePath: (path) => this.normalizeBoundPath(path, identity),
        watch$: (path) => this.watchBoundPath(path, identity),
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

  /** Watch a path in the bound session's context; errors like `run` rejects. */
  private watchBoundPath(path: string, identity: BoundSessionIdentity): Observable<void> {
    return defer(() => this.filesystem.watch$(path, this.boundShellContextOrThrow(identity)));
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
    return this.runOn(request, () => this.boundTarget(identity));
  }

  /**
   * Run `request` on the session `target` resolves to, once it passed the
   * context guards shared by the bound handle and the directory handles.
   */
  private async runOn(
    request: SessionRunRequest,
    resolve: () => SessionTarget | { reason: SessionRunRejection },
  ): Promise<SessionRunResult> {
    const target = this.writableTarget(resolve, request.contextRevision);
    if ("reason" in target) {
      return { status: "rejected", reason: target.reason };
    }

    const shellContext = target.state.shellContext;
    const requestedArgs = request.args ?? [];
    const isWsl = isWslShellContext(shellContext);
    const program = isWsl ? "wsl.exe" : request.executable;
    const args = isWsl
      ? ["-d", shellContext.wslDistroName, request.executable, ...requestedArgs]
      : requestedArgs;

    const result = await this.commandRunner.run({
      cwd: target.state.cwd,
      shellContext,
      program,
      args,
      timeoutMs: request.timeoutMs,
      stdin: request.stdin,
      onPrompt: request.onPrompt ?? ((prompt) => this.processPrompts.ask(prompt)),
    });
    return { status: "ran", result };
  }

  /**
   * Put `text` on the bound session's input line, guarded like `run` and
   * only while the shell is at its prompt - a running command or a
   * full-screen program would get the text instead. Enter is never sent: the
   * person reads what is there and runs it.
   */
  private async insertInput(
    text: string,
    contextRevision: number,
    identity: BoundSessionIdentity,
  ): Promise<SessionInsertResult> {
    const target = this.writableTarget(() => this.boundTarget(identity), contextRevision);
    if ("reason" in target) {
      return { status: "rejected", reason: target.reason };
    }
    if (target.state.isCommandRunning || target.state.isInFullScreenMode) {
      return { status: "rejected", reason: "busy" };
    }
    target.host.writeRaw(text);
    return { status: "inserted" };
  }

  /** The bound session, while the identity is still the live binding. */
  private boundTarget(identity: BoundSessionIdentity): SessionTarget | { reason: "unbound" } {
    if (!this.boundSessionMatches(identity)) {
      return { reason: "unbound" };
    }
    const entry = this.terminalSessionRegistry.get(identity.terminalId);
    if (!entry) {
      return { reason: "unbound" };
    }
    return { host: entry.host, state: entry.host.state };
  }

  /**
   * A session as something a feature may write to: `resolve` still finds
   * it (for the bound handle: the identity is still the live binding; for a
   * directory handle: the terminal still runs this session), the caller's
   * context revision still matches (nothing opened/closed under it), and the
   * context is known (a foreign shell such as ssh is refused).
   */
  private writableTarget(
    resolve: () => SessionTarget | { reason: SessionRunRejection },
    contextRevision: number,
  ): SessionTarget | { reason: SessionRunRejection } {
    const resolved = resolve();
    if ("reason" in resolved) {
      return resolved;
    }
    if (resolved.state.contextRevision !== contextRevision) {
      return { reason: "stale-context" };
    }
    if (!resolved.state.isContextKnown) {
      return { reason: "unknown-context" };
    }
    // Without a cwd the command would fail before it starts, and a feature
    // would read that failure as its own (git "not installed").
    if (!resolved.state.cwd) {
      return { reason: "starting" };
    }
    return resolved;
  }
}

/** A live session a run is about to go to. */
type SessionTarget = { host: SessionHost; state: SessionHost["state"] };
