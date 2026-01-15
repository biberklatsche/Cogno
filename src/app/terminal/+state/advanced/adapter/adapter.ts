export interface Adapter {
    injectionScript(): Promise<string> ;
}
