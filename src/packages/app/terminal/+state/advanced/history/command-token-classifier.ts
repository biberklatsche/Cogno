import { ClassifiedCommandToken, CommandToken } from "./command-pattern.models";

export class CommandTokenClassifier {
  classify(commandTokens: CommandToken[]): ClassifiedCommandToken[] {
    return commandTokens.map((commandToken, tokenIndex) => ({
      ...commandToken,
      kind: this.resolveKind(commandToken, tokenIndex),
    }));
  }

  private resolveKind(
    commandToken: CommandToken,
    tokenIndex: number,
  ): ClassifiedCommandToken["kind"] {
    // The command name (index 0) and option flags are always stable.
    if (tokenIndex === 0 || commandToken.value.startsWith("-")) {
      return "stable";
    }

    // Index 1 is stable for subcommand-like tokens (pure alphabetic words like "commit",
    // "push", "run") but variable for value-like tokens (paths, hosts, URLs, filenames).
    if (tokenIndex === 1) {
      return this.looksLikeValue(commandToken) ? "variable" : "stable";
    }

    // All other positional arguments are variable. Tokens that consistently take the same
    // value (e.g. a subcommand at position 2) are filtered out by the slot variance checks
    // in SuggestionPatternReducer.isHelpfulPattern before they ever surface as suggestions.
    return "variable";
  }

  private looksLikeValue(token: CommandToken): boolean {
    if (token.wasQuoted) return true;
    // Paths, hostnames, URLs, filenames contain these characters
    return /[./\-@:~]/.test(token.value) || /\d/.test(token.value);
  }
}
