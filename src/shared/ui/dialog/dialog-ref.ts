import { Signal, signal, WritableSignal } from "@angular/core";

export class DialogRef<TResult = unknown> {
  private readonly _closed: WritableSignal<TResult | undefined> = signal(undefined);
  private isClosed = false;
  readonly closed: Signal<TResult | undefined> = this._closed.asReadonly();
  private readonly onClose: Array<() => void> = [];

  /** What the dialog closed with; undefined when it was dismissed. */
  get result(): Promise<TResult | undefined> {
    if (this.isClosed) return Promise.resolve(this._closed());
    return new Promise((resolve) => this.onClose.push(() => resolve(this._closed())));
  }

  constructor(
    public readonly id: number,
    private readonly _destroy: () => void,
  ) {}

  close(result?: TResult) {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this._closed.set(result as TResult);
    for (const listener of this.onClose.splice(0)) listener();
    this._destroy();
  }
}
