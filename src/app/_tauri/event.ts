export interface IDisposable {
    dispose(): void;
}
export interface IEvent<T> {
    (listener: (e: T) => any): IDisposable;
}
