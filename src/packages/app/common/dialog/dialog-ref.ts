import { Signal, signal, WritableSignal } from "@angular/core";

export class DialogRef<TResult = unknown> {
  private readonly _closed: WritableSignal<TResult | undefined> = signal(undefined);
  private isClosed = false;
  readonly closed: Signal<TResult | undefined> = this._closed.asReadonly();

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
    this._destroy();
  }
}
