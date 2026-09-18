import { Observable } from "rxjs";

type Unlisten = () => void;

/**
 * An Observable over a Tauri listener. Tauri registers listeners asynchronously,
 * so a subscriber may leave before the registration resolves; the listener is
 * then released right away instead of leaking. `initial` emits the current
 * value once, next to the events.
 */
export function fromTauriListener<T>(
  register: (emit: (value: T) => void) => Promise<Unlisten>,
  initial?: () => Promise<T>,
): Observable<T> {
  return new Observable<T>((subscriber) => {
    let unlisten: Unlisten | undefined;
    let unsubscribed = false;
    const release = (fn: Unlisten) => {
      try {
        fn();
      } catch {}
    };

    initial?.()
      .then((value) => subscriber.next(value))
      .catch((error) => subscriber.error(error));

    register((value) => subscriber.next(value))
      .then((fn) => {
        if (unsubscribed) {
          release(fn);
        } else {
          unlisten = fn;
        }
      })
      .catch((error) => subscriber.error(error));

    return () => {
      unsubscribed = true;
      if (unlisten) release(unlisten);
    };
  });
}
