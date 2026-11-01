import {
  ClassifiedCommandToken,
  CommandPatternOccurrence,
  CommandSignature,
  CommandSignaturePart,
  CommandToken,
} from "../command-pattern.models";

/** Splits a command line into tokens; quotes group, backslashes escape inside them. */
export function tokenizeCommand(commandText: string): CommandToken[] {
  const trimmedCommandText = commandText.trim();
  if (!trimmedCommandText) {
    return [];
  }

  const commandTokens: CommandToken[] = [];
  let currentTokenCharacters = "";
  let activeQuoteCharacter: '"' | "'" | null = null;
  let tokenWasQuoted = false;

  const pushCurrentToken = (): void => {
    if (!currentTokenCharacters) {
      return;
    }

    commandTokens.push({
      value: currentTokenCharacters,
      rawValue: currentTokenCharacters,
      wasQuoted: tokenWasQuoted,
    });
    currentTokenCharacters = "";
    tokenWasQuoted = false;
  };

  for (let characterIndex = 0; characterIndex < trimmedCommandText.length; characterIndex += 1) {
    const currentCharacter = trimmedCommandText[characterIndex];

    if (activeQuoteCharacter !== null) {
      if (currentCharacter === "\\" && characterIndex + 1 < trimmedCommandText.length) {
        characterIndex += 1;
        currentTokenCharacters += trimmedCommandText[characterIndex];
        continue;
      }

      if (currentCharacter === activeQuoteCharacter) {
        activeQuoteCharacter = null;
        continue;
      }

      currentTokenCharacters += currentCharacter;
      continue;
    }

    if (currentCharacter === '"' || currentCharacter === "'") {
      activeQuoteCharacter = currentCharacter;
      tokenWasQuoted = true;
      continue;
    }

    if (/\s/u.test(currentCharacter)) {
      pushCurrentToken();
      continue;
    }

    currentTokenCharacters += currentCharacter;
  }

  pushCurrentToken();
  return commandTokens;
}

/** Marks each token as part of the command's shape (stable) or as an argument that varies. */
export function classifyTokens(commandTokens: CommandToken[]): ClassifiedCommandToken[] {
  return commandTokens.map((commandToken, tokenIndex) => ({
    ...commandToken,
    kind: resolveKind(commandToken, tokenIndex),
  }));
}

function resolveKind(
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
    return looksLikeValue(commandToken) ? "variable" : "stable";
  }

  // All other positional arguments are variable. Tokens that consistently take the same
  // value (e.g. a subcommand at position 2) are filtered out by the slot variance checks
  // in SuggestionPatternReducer.isHelpfulPattern before they ever surface as suggestions.
  return "variable";
}

function looksLikeValue(token: CommandToken): boolean {
  if (token.wasQuoted) return true;
  // Paths, hostnames, URLs, filenames contain these characters
  return /[./\-@:~]/.test(token.value) || /\d/.test(token.value);
}

/** The signature of a classified command, or undefined when nothing in it varies. */
export function buildSignature(
  classifiedCommandTokens: ClassifiedCommandToken[],
): CommandSignature | undefined {
  let variableSlotCount = 0;
  const parts = classifiedCommandTokens.map<CommandSignaturePart>((classifiedCommandToken) => {
    if (classifiedCommandToken.kind === "stable") {
      return { kind: "stable", value: classifiedCommandToken.value };
    }
    const part: CommandSignaturePart = { kind: "slot", slotIndex: variableSlotCount };
    variableSlotCount += 1;
    return part;
  });

  if (variableSlotCount === 0) {
    return undefined;
  }

  return {
    key: parts
      .map((part) =>
        part.kind === "stable" ? `stable:${part.value.toLowerCase()}` : `slot:${part.slotIndex}`,
      )
      .join("|"),
    parts,
  };
}

const SHELL_OPERATORS = new Set(["|", "||", "&&", ";", ">", ">>", "<", "{"]);

function isCompoundCommand(tokens: CommandToken[]): boolean {
  return tokens.some((token) => SHELL_OPERATORS.has(token.value));
}

function createPatternText(signature: CommandSignature): string {
  return signature.parts
    .map((part) => (part.kind === "stable" ? part.value : `{arg${part.slotIndex + 1}}`))
    .join(" ");
}

/**
 * The pattern a single command line is an occurrence of: its signature, the
 * text with `{argN}` placeholders, and the values that filled each slot.
 * Undefined for compound commands (pipes, chains, redirects) and for commands
 * without a variable part.
 */
export function analyzeCommand(commandText: string): CommandPatternOccurrence | undefined {
  const commandTokens = tokenizeCommand(commandText);
  if (isCompoundCommand(commandTokens)) {
    return undefined;
  }
  const classifiedCommandTokens = classifyTokens(commandTokens);
  const signature = buildSignature(classifiedCommandTokens);

  if (signature === undefined) {
    return undefined;
  }

  const stableTokenCount = signature.parts.filter((part) => part.kind === "stable").length;
  const nonOptionStableTokenCount = signature.parts.filter(
    (part) => part.kind === "stable" && !part.value.startsWith("-"),
  ).length;
  const variableSlotCount = signature.parts.filter((part) => part.kind === "slot").length;

  return {
    signature,
    patternText: createPatternText(signature),
    stableTokenCount,
    nonOptionStableTokenCount,
    variableSlotCount,
    slotValues: classifiedCommandTokens.flatMap((classifiedCommandToken, tokenIndex) => {
      const currentPart = signature.parts[tokenIndex];
      if (currentPart?.kind !== "slot") {
        return [];
      }

      return [
        {
          slotIndex: currentPart.slotIndex,
          value: classifiedCommandToken.value,
        },
      ];
    }),
  };
}
