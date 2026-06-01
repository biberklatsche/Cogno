export abstract class TerminalProcessPort {
  abstract getDescendantProcessNames(terminalId: string): Promise<ReadonlySet<string>>;
}
