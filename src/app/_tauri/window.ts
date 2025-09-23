import {getCurrentWindow} from "@tauri-apps/api/window";
import {Observable} from "rxjs";
import {UnlistenFn} from "@tauri-apps/api/event";
import {distinctUntilChanged} from "rxjs/operators";

const win = getCurrentWindow();
export const AppWindow = {
    isFocused(): Promise<boolean> { return win.isFocused()},
    isVisible(): Promise<boolean>{ return win.isVisible()},
    isMaximized(): Promise<boolean>{return win.isMaximized()},
    isMinimized(): Promise<boolean>{return win.isMinimized()},
    close(): Promise<void> {return win.close()},
    minimize(): Promise<void> {return win.minimize()},
    unminimize(): Promise<void> {return win.unminimize()},
    maximize(): Promise<void> {return win.maximize()},
    unmaximize(): Promise<void> {return win.unmaximize()},

    windowSize$: new Observable<{ width: number; height: number }>(
        (subscriber) => {
            let unlisten: UnlistenFn | null = null;
            let unsubscribed = false;

            // 1) Initialgröße einmalig senden
            win
                .innerSize()
                .then(({width, height}) => subscriber.next({width, height}))
                .catch((err) => subscriber.error(err));

            // 2) Resize-Events hören
            win
                .onResized(({payload}) => {
                    // payload: { width: number; height: number }
                    subscriber.next({width: payload.width, height: payload.height});
                })
                .then((fn) => {
                    // UnlistenFn angekommen
                    if (unsubscribed) {
                        // Falls währenddessen schon unsubscribed wurde -> sofort aufräumen
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
}

export type WindowSize = { width: number, height: number };
