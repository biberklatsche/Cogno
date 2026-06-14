export interface ICodingAgentProvider {
  readonly id: string;
  readonly name: string;

  isAgentInstalled(): Promise<boolean>;
  isHookInstalled(): Promise<boolean>;
  /** @param shellType The Cogno shell profile type (e.g. "PowerShell", "Bash"). Determines which hook command syntax to write. */
  installHook(shellType?: string): Promise<void>;
  removeHook(): Promise<void>;
}
