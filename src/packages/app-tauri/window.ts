import { UnlistenFn } from "@tauri-apps/api/event";
import { CloseRequestedEvent, DragDropEvent, getCurrentWindow } from "@tauri-apps/api/window";
import { Observable } from "rxjs";
import { distinctUntilChanged } from "rxjs/operators";

function currentWindow() {
  return getCurrentWindow();
}

export const AppWindow = {
  isFocused(): Promise<boolean> {
    return currentWindow().isFocused();
  },
  isVisible(): Promise<boolean> {
    return currentWindow().isVisible();
  },
  isMaximized(): Promise<boolean> {
    return currentWindow().isMaximized();
  },
  isMinimized(): Promise<boolean> {
    return currentWindow().isMinimized();
  },
  setFocus(): Promise<void> {
    return currentWindow().setFocus();
  },
  close(): Promise<void> {
    return currentWindow().close();
  },
  minimize(): Promise<void> {
    return currentWindow().minimize();
  },
  unminimize(): Promise<void> {
    return currentWindow().unminimize();
  },
  maximize(): Promise<void> {
    return currentWindow().maximize();
  },
  unmaximize(): Promise<void> {
    return currentWindow().unmaximize();
  },

  onCloseRequested$: new Observable<CloseRequestedEvent>((subscriber) => {
    const win = currentWindow();
    let unlisten: UnlistenFn | null = null;
    let unsubscribed = false;

    win
      .onCloseRequested((evt) => {
        subscriber.next(evt);
      })
      .then((fn) => {
        if (unsubscribed) {
          try {
            fn();
          } catch {}
        } else {
          unlisten = fn;
        }
      })
      .catch((err) => subscriber.error(err));

    return () => {
      unsubscribed = true;
      if (unlisten) {
        try {
          unlisten();
        } catch {}
      }
    };
  }),

  windowSize$: new Observable<{ width: number; height: number }>((subscriber) => {
    const win = currentWindow();
    let unlisten: UnlistenFn | null = null;
    let unsubscribed = false;

    win
      .innerSize()
      .then(({ width, height }) => subscriber.next({ width, height }))
      .catch((err) => subscriber.error(err));

    win
      .onResized(({ payload }) => {
        subscriber.next({ width: payload.width, height: payload.height });
      })
      .then((fn) => {
        if (unsubscribed) {
          try {
            fn();
          } catch {}
        } else {
          unlisten = fn;
        }
      })
      .catch((err) => subscriber.error(err));

    return () => {
      unsubscribed = true;
      if (unlisten) {
        try {
          unlisten();
        } catch {}
      }
    };
  }).pipe(distinctUntilChanged((a, b) => a.width === b.width && a.height === b.height)),

  onFocusChanged$: new Observable<boolean>((subscriber) => {
    const win = currentWindow();
    let unlisten: UnlistenFn | null = null;
    let unsubscribed = false;

    win
      .isFocused()
      .then((focused) => subscriber.next(focused))
      .catch((err) => subscriber.error(err));

    win
      .onFocusChanged(({ payload }) => {
        subscriber.next(!!payload);
      })
      .then((fn) => {
        if (unsubscribed) {
          try {
            fn();
          } catch {}
        } else {
          unlisten = fn;
        }
      })
      .catch((err) => subscriber.error(err));

    return () => {
      unsubscribed = true;
      if (unlisten) {
        try {
          unlisten();
        } catch {}
      }
    };
  }).pipe(distinctUntilChanged()),

  onDragDrop$: new Observable<DragDropEvent>((subscriber) => {
    const win = currentWindow();
    let unlisten: UnlistenFn | null = null;
    let unsubscribed = false;

    win
      .onDragDropEvent((event) => {
        subscriber.next(event.payload);
      })
      .then((fn) => {
        if (unsubscribed) {
          try {
            fn();
          } catch {}
        } else {
          unlisten = fn;
        }
      })
      .catch((err) => subscriber.error(err));

    return () => {
      unsubscribed = true;
      if (unlisten) {
        try {
          unlisten();
        } catch {}
      }
    };
  }),
};

export type WindowSize = { width: number; height: number };
