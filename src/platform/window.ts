import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
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
  /** The window the app started with - the only one that restores the last session. */
  get isMain(): boolean {
    return currentWindow().label === MAIN_WINDOW_LABEL;
  }

  /**
   * Claims a workspace for this window. False when another window holds it; the
   * backend brings that window to the front instead.
   */
  async claimWorkspace(workspaceId: string): Promise<boolean> {
    try {
      await invoke("window_claim_workspace", { workspaceId });
      return true;
    } catch {
      return false;
    }
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
