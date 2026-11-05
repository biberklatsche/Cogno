import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { CloseRequestedEvent, DragDropEvent, getCurrentWindow } from "@tauri-apps/api/window";
import { Observable } from "rxjs";
import { distinctUntilChanged, mergeMap } from "rxjs/operators";
import { Logger } from "./logger";
import { fromTauriListener } from "./tauri-listener";

function currentWindow() {
  return getCurrentWindow();
}

/** The label Tauri gives the window the app starts with; further windows are `win-…`. */
const MAIN_WINDOW_LABEL = "main";

/** A step of a coordinated quit: every window confirms, then every window saves. */
export type QuitPhase = "confirm" | "persist";

type QuitRequest = { readonly requestId: string; readonly phase: QuitPhase };

@Injectable({ providedIn: "root" })
export class AppWindow {
  /** Quits after every window agreed and saved; false when one said no. */
  prepareQuit(): Promise<boolean> {
    return invoke("window_prepare_quit");
  }

  /**
   * Answers the quit coordinator's requests to this window with `handler`.
   * Receipt is confirmed at once, since the coordinator does not wait for a
   * window that stays silent, while the answer may wait for the user's
   * dialog. A handler that throws answers yes: a technical failure never
   * keeps the app open. Listens on this window only: a global listener would
   * also get every other window's requests.
   */
  answerQuitRequests(handler: (phase: QuitPhase) => Promise<boolean>): Observable<void> {
    return fromTauriListener<QuitRequest>((emit) =>
      getCurrentWebviewWindow().listen<QuitRequest>("cogno-prepare-quit", (event) =>
        emit(event.payload),
      ),
    ).pipe(mergeMap((request) => answerQuitRequest(request, handler)));
  }

  /** The window the app started with - the only one that restores the last session. */
  get isMain(): boolean {
    return currentWindow().label === MAIN_WINDOW_LABEL;
  }

  /**
   * Claims a workspace for this window. False when another window holds it; the
   * backend brings that window to the front instead. Anything else that goes
   * wrong is thrown, not taken for "open elsewhere".
   */
  async claimWorkspace(workspaceId: string): Promise<boolean> {
    const holder = await invoke<string | null>("window_claim_workspace", { workspaceId });
    return holder === null;
  }

  releaseWorkspace(workspaceId: string): Promise<void> {
    return invoke("window_release_workspace", { workspaceId });
  }

  isFocused(): Promise<boolean> {
    return currentWindow().isFocused();
  }

  isVisible(): Promise<boolean> {
    return currentWindow().isVisible();
  }

  isMaximized(): Promise<boolean> {
    return currentWindow().isMaximized();
  }

  setFocus(): Promise<void> {
    return currentWindow().setFocus();
  }

  close(): Promise<void> {
    return currentWindow().close();
  }

  minimize(): Promise<void> {
    return currentWindow().minimize();
  }

  unminimize(): Promise<void> {
    return currentWindow().unminimize();
  }

  maximize(): Promise<void> {
    return currentWindow().maximize();
  }

  unmaximize(): Promise<void> {
    return currentWindow().unmaximize();
  }

  readonly onCloseRequested$ = fromTauriListener<CloseRequestedEvent>((emit) =>
    currentWindow().onCloseRequested(emit),
  );

  readonly windowSize$ = fromTauriListener<{ width: number; height: number }>(
    (emit) =>
      currentWindow().onResized(({ payload }) =>
        emit({ width: payload.width, height: payload.height }),
      ),
    () =>
      currentWindow()
        .innerSize()
        .then(({ width, height }) => ({ width, height })),
  ).pipe(distinctUntilChanged((a, b) => a.width === b.width && a.height === b.height));

  readonly onFocusChanged$ = fromTauriListener<boolean>(
    (emit) => currentWindow().onFocusChanged(({ payload }) => emit(!!payload)),
    () => currentWindow().isFocused(),
  ).pipe(distinctUntilChanged());

  readonly onDragDrop$ = fromTauriListener<DragDropEvent>((emit) =>
    currentWindow().onDragDropEvent((event) => emit(event.payload)),
  );
}

/** One request: receipt first, then the handler's answer; a failed handler is a yes. Never throws. */
async function answerQuitRequest(
  { requestId, phase }: QuitRequest,
  handler: (phase: QuitPhase) => Promise<boolean>,
): Promise<void> {
  await invoke("window_receive_quit", { requestId }).catch(() => undefined);
  let accepted = true;
  try {
    accepted = await handler(phase);
  } catch (error) {
    Logger.warn(`Quit step "${phase}" failed, quitting anyway: ${String(error)}`);
  }
  await invoke("window_answer_quit", { requestId, accepted }).catch((error) =>
    Logger.warn(`Could not answer the quit request: ${String(error)}`),
  );
}
