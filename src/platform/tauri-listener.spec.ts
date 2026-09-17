import { describe, expect, it, vi } from "vitest";
import { fromTauriListener } from "./tauri-listener";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("fromTauriListener", () => {
  it("registers on subscribe and forwards what the listener emits", async () => {
    let emit!: (value: number) => void;
    const register = vi.fn((emitValue: (value: number) => void) => {
      emit = emitValue;
      return Promise.resolve(() => undefined);
    });
    const received: number[] = [];

    const source = fromTauriListener<number>(register);
    expect(register).not.toHaveBeenCalled();
    source.subscribe((value) => received.push(value));
    emit(1);
    emit(2);

    expect(register).toHaveBeenCalledTimes(1);
    expect(received).toEqual([1, 2]);
  });

  it("releases the listener on unsubscribe", async () => {
    const unlisten = vi.fn();
    const subscription = fromTauriListener<number>(() => Promise.resolve(unlisten)).subscribe();
    await flush();

    subscription.unsubscribe();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("releases the listener right away when the subscriber left before it was registered", async () => {
    const registration = deferred<() => void>();
    const unlisten = vi.fn();
    const subscription = fromTauriListener<number>(() => registration.promise).subscribe();

    subscription.unsubscribe();
    expect(unlisten).not.toHaveBeenCalled();
    registration.resolve(unlisten);
    await flush();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("emits the initial value when one is given", async () => {
    const received: string[] = [];

    fromTauriListener<string>(
      () => Promise.resolve(() => undefined),
      () => Promise.resolve("now"),
    ).subscribe((value) => received.push(value));
    await flush();

    expect(received).toEqual(["now"]);
  });

  it("errors when the registration fails", async () => {
    const error = vi.fn();

    fromTauriListener<number>(() => Promise.reject(new Error("no window"))).subscribe({ error });
    await flush();

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: "no window" }));
  });

  it("errors when the initial value fails", async () => {
    const error = vi.fn();

    fromTauriListener<number>(
      () => Promise.resolve(() => undefined),
      () => Promise.reject(new Error("no size")),
    ).subscribe({ error });
    await flush();

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: "no size" }));
  });

  it("swallows an unlisten that throws", async () => {
    const subscription = fromTauriListener<number>(() =>
      Promise.resolve(() => {
        throw new Error("already gone");
      }),
    ).subscribe();
    await flush();

    expect(() => subscription.unsubscribe()).not.toThrow();
  });
});
