import { OscDataType } from "../advanced/model/models";

export class Command {
  private data: Record<OscDataType, string> = {};
  public isInViewport: boolean = false;
  public isFirstCommandOutOfViewport: boolean = false;

  constructor(
    private _id: string,
    private _directory: string,
    private _machine: string,
    private _user: string,
  ) {}

  setData(data: Record<OscDataType, string>) {
    this.data = data;
  }

  get directory(): string | undefined {
    return this._directory;
  }
  get machine(): string | undefined {
    return this._machine;
  }
  get user(): string | undefined {
    return this._user;
  }

  get command(): string | undefined {
    return this.data["command"];
  }
  get duration(): number | undefined {
    const d = this.data["duration"];
    return d !== undefined ? Number.parseInt(d, 10) : undefined;
  }
  get returnCode(): number | undefined {
    const rc = this.data["returnCode"];
    return rc !== undefined ? Number.parseInt(rc, 10) : undefined;
  }

  get commandExists(): boolean {
    const rc = this.data["commandExists"];
    return rc !== undefined ? rc === "true" : false;
  }

  get id(): string {
    return this._id;
  }

  get(key: string): string | undefined {
    return this.data[key];
  }

  set(key: string, value: string): void {
    this.data[key] = value;
  }
}
