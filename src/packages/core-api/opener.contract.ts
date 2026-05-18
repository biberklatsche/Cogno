export interface OpenerContract {
  openPath(path: string): Promise<void>;
  openUrl(url: string): Promise<void>;
}

export abstract class Opener implements OpenerContract {
  abstract openPath(path: string): Promise<void>;
  abstract openUrl(url: string): Promise<void>;
}
