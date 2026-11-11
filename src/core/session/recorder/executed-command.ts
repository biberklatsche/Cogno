/** What the shell reported about one finished command. */
export type ExecutedCommand = {
  command: string;
  duration?: number;
  directory: string;
  returnCode?: number;
  /** `false` when the shell could not find the command it was asked to run. */
  commandExists?: boolean;
};
