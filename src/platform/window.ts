import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CloseRequestedEvent, DragDropEvent, getCurrentWindow } from "@tauri-apps/api/window";
import { distinctUntilChanged } from "rxjs/operators";
import { fromTauriListener } from "./tauri-listener";

function currentWindow() {
  return getCurrentWindow();
}

/** The label Tauri gives the window the app starts with; further windows are `win-…`. */
const MAIN_WINDOW_LABEL = "main";

@Injectable({ providedIn: "root" })
export class AppWindow {
  readonly prepareQuit$ = fromTauriListener<{ requestId: string; phase: "confirm" | "persist" }>(
    (emit) =>
      listen<{ requestId: string; phase: "confirm" | "persist" }>("cogno-prepare-quit", (event) =>
        emit(event.payload),
      ),
  );

  prepareQuit(): Promise<boolean> {
    return invoke("window_prepare_quit");
  }

  answerQuit(requestId: string, accepted: boolean, error?: string): Promise<void> {
    return invoke("window_answer_quit", { requestId, accepted, error });
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
