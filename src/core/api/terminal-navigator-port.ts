export abstract class TerminalNavigator {
  abstract navigateToTerminal(terminalId: string): Promise<void>;
  /**
   * Opens a new tab in `cwd`, with the shell of the terminal `besideTerminalId`
   * and in its workspace, and shows it. `cwd` is in that shell's own form, as
   * a command run there reports it.
   */
  abstract openTabAt(cwd: string, besideTerminalId: string): Promise<void>;
}
