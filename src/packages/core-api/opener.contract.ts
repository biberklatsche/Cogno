export abstract class Opener {
  abstract openPath(path: string): Promise<void>;
  abstract openUrl(url: string): Promise<void>;
}
