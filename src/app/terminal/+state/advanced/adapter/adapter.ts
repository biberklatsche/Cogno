export interface Adapter {
    injectionScript(): Promise<string> ;
    pathInjection(path: string): string;
}
