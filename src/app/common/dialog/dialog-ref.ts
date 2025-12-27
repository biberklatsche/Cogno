import {Signal, WritableSignal, signal} from '@angular/core';

export class DialogRef<TResult = unknown> {
  private readonly _closed: WritableSignal<TResult | undefined> = signal(undefined);
  readonly closed: Signal<TResult | undefined> = this._closed.asReadonly();

  constructor(
    public readonly id: number,
    private readonly _destroy: () => void,
  ) {}

  close(result?: TResult) {
    this._closed.set(result as TResult);
    this._destroy();
  }
}
