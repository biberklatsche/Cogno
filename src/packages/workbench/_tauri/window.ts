import { getCurrentWindow } from "@tauri-apps/api/window";
import type { CloseRequestedEvent, DragDropEvent } from "@tauri-apps/api/window";
import { Observable } from "rxjs";
import { UnlistenFn } from "@tauri-apps/api/event";
import { distinctUntilChanged } from "rxjs/operators";

const win = getCurrentWindow();

export const AppWindow = {
    isFocused(): Promise<boolean> { return win.isFocused()},
    isVisible(): Promise<boolean>{ return win.isVisible()},
    isMaximized(): Promise<boolean>{return win.isMaximized()},
    isMinimized(): Promise<boolean>{return win.isMinimized()},
    setFocus(): Promise<void> {return win.setFocus()},
    close(): Promise<void> {return win.close()},
    minimize(): Promise<void> {return win.minimize()},
    unminimize(): Promise<void> {return win.unminimize()},
    maximize(): Promise<void> {return win.maximize()},
    unmaximize(): Promise<void> {return win.unmaximize()},

    /**
     * Observable stream of window close requests, similar to windowSize$.
     * - Emits on every close request event until unsubscribed.
     * - Properly unregisters the native listener on teardown.
     */
    onCloseRequested$: new Observable<CloseRequestedEvent>((subscriber) => {
        let unlisten: UnlistenFn | null = null;
        let unsubscribed = false;

        win
            .onCloseRequested((evt) => {
                // Emit every time the user requests to close the window
                subscriber.next(evt);
            })
            .then((fn) => {
                if (unsubscribed) {
                    try { fn(); } catch {}
                } else {
                    unlisten = fn;
                }
            })
            .catch((err) => subscriber.error(err));

        return () => {
            unsubscribed = true;
            if (unlisten) {
                try { unlisten(); } catch {}
            }
        };
    }),

    windowSize$: new Observable<{ width: number; height: number }>(
        (subscriber) => {
            let unlisten: UnlistenFn | null = null;
            let unsubscribed = false;

            // 1) Send initial size once
            win
                .innerSize()
                .then(({width, height}) => subscriber.next({width, height}))
                .catch((err) => subscriber.error(err));

            // 2) Listen for resize events
            win
                .onResized(({payload}) => {
                    // payload: { width: number; height: number }
                    subscriber.next({width: payload.width, height: payload.height});
                })
                .then((fn) => {
                    // UnlistenFn received
                    if (unsubscribed) {
                        // If unsubscribed in the meantime -> clean up immediately
                        try {
                            fn();
                        } catch {
                        }
                    } else {
                        unlisten = fn;
                    }
                })
                .catch((err) => subscriber.error(err));

            // 3) Teardown: beim Unsubscribe unlisten aufrufen
            return () => {
                unsubscribed = true;
                if (unlisten) {
                    try {
                        unlisten();
                    } catch {
                    }
                }
            };
        }
    ).pipe(distinctUntilChanged((a, b) => a.width === b.width && a.height === b.height)),

    /**
     * Observable stream of window focus state changes, similar to windowSize$.
     * - Emits the current focus state immediately on subscription.
     * - Emits on every subsequent focus change until unsubscribed.
     * - Properly unregisters the native listener on teardown.
     */
    onFocusChanged$: new Observable<boolean>((subscriber) => {
        let unlisten: UnlistenFn | null = null;
        let unsubscribed = false;

        // 1) Emit the current focus state once at subscription
        win
            .isFocused()
            .then((focused) => subscriber.next(focused))
            .catch((err) => subscriber.error(err));

        // 2) Listen for focus change events
        win
            .onFocusChanged(({ payload }) => {
                subscriber.next(!!payload);
            })
            .then((fn) => {
                if (unsubscribed) {
                    try { fn(); } catch {}
                } else {
                    unlisten = fn;
                }
            })
            .catch((err) => subscriber.error(err));

        // 3) Teardown
        return () => {
            unsubscribed = true;
            if (unlisten) {
                try { unlisten(); } catch {}
            }
        };
    }).pipe(distinctUntilChanged()),

    onDragDrop$: new Observable<DragDropEvent>((subscriber) => {
        let unlisten: UnlistenFn | null = null;
        let unsubscribed = false;

        win
            .onDragDropEvent((event) => {
                subscriber.next(event.payload);
            })
            .then((fn) => {
                if (unsubscribed) {
                    try { fn(); } catch {}
                } else {
                    unlisten = fn;
                }
            })
            .catch((err) => subscriber.error(err));

        return () => {
            unsubscribed = true;
            if (unlisten) {
                try { unlisten(); } catch {}
            }
        };
    }),
}

export type WindowSize = { width: number, height: number };
