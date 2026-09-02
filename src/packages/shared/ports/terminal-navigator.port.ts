export abstract class TerminalNavigator {
  abstract navigateToTerminal(terminalId: string): Promise<void>;
}
