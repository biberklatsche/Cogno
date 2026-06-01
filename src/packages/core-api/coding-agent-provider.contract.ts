import { BackendOsContract } from "./filesystem.contract";

export interface ICodingAgentProvider {
  readonly id: string;
  readonly name: string;
  readonly processNames: ReadonlyArray<string>;
  readonly resumeLinkPattern: string | undefined;

  isHookInstalled(): Promise<boolean>;
  installHook(platform: BackendOsContract): Promise<void>;
  removeHook(): Promise<void>;
}
