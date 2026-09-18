export interface CognoMessage {
  command: string;
  args?: string[];
  terminalId?: string;
  /** Arbitrary JSON forwarded as-is (e.g. an agent hook's stdin payload). */
  payload?: unknown;
}
