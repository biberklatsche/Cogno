import { Injectable } from "@angular/core";
import { CloseRequestedEvent, DragDropEvent, getCurrentWindow } from "@tauri-apps/api/window";
import { distinctUntilChanged } from "rxjs/operators";
import { fromTauriListener } from "./tauri-listener";

function currentWindow() {
  return getCurrentWindow();
}

@Injectable({ providedIn: "root" })
export class AppWindow {
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
