import { ClassifiedCommandToken, CommandToken } from "./command-pattern.models";

export class CommandTokenClassifier {
  classify(commandTokens: CommandToken[]): ClassifiedCommandToken[] {
    const stableValues = commandTokens.map((commandToken) => commandToken.value);

    return commandTokens.map((commandToken, tokenIndex) => ({
      ...commandToken,
      kind: this.resolveKind(commandToken, tokenIndex, stableValues),
    }));
  }

  private resolveKind(
    commandToken: CommandToken,
    tokenIndex: number,
    stableValues: string[],
  ): ClassifiedCommandToken["kind"] {
    if (tokenIndex <= 1 || commandToken.value.startsWith("-")) {
      return "stable";
    }

    const previousOptionToken = this.findPreviousOptionToken(tokenIndex, stableValues);
    if (this.isVariableToken(commandToken, previousOptionToken)) {
      return "variable";
    }

    return "stable";
  }

  private findPreviousOptionToken(tokenIndex: number, stableValues: string[]): string | undefined {
    for (let currentIndex = tokenIndex - 1; currentIndex >= 0; currentIndex -= 1) {
      const currentValue = stableValues[currentIndex];
      if (currentValue.startsWith("-")) {
        return currentValue.toLowerCase();
      }
      if (!currentValue.startsWith("-") && currentIndex > 1) {
        break;
      }
    }

    return undefined;
  }

  private isVariableToken(commandToken: CommandToken, previousOptionToken?: string): boolean {
    if (commandToken.wasQuoted) {
      return true;
    }

    if (previousOptionToken !== undefined) {
      return true;
    }

    return (
      commandToken.value.startsWith("./") ||
      commandToken.value.startsWith("../") ||
      commandToken.value.startsWith("~/") ||
      commandToken.value.startsWith("/") ||
      commandToken.value.includes("/")
    );
  }
}
