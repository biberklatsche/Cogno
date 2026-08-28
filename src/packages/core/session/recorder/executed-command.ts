/** What the shell reported about one finished command. */
export type ExecutedCommand = {
  command: string;
  duration?: number;
  directory: string;
  returnCode?: number;
  commandExists?: boolean;
};
