import { CommandPatternOccurrence, CommandSignature, CommandToken } from "./command-pattern.models";
import { CommandSignatureBuilder } from "./command-signature-builder";
import { CommandTokenClassifier } from "./command-token-classifier";
import { CommandTokenizer } from "./command-tokenizer";

export class CommandPatternAnalyzer {
  constructor(
    private readonly commandTokenizer: CommandTokenizer,
    private readonly commandTokenClassifier: CommandTokenClassifier,
    private readonly commandSignatureBuilder: CommandSignatureBuilder,
  ) {}

  analyzeCommand(commandText: string): CommandPatternOccurrence | undefined {
    const commandTokens = this.commandTokenizer.tokenize(commandText);
    if (this.isCompoundCommand(commandTokens)) {
      return undefined;
    }
    const classifiedCommandTokens = this.commandTokenClassifier.classify(commandTokens);
    const signature = this.commandSignatureBuilder.build(classifiedCommandTokens);

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
      patternText: this.createPatternText(signature),
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

  private isCompoundCommand(tokens: CommandToken[]): boolean {
    const SHELL_OPERATORS = new Set(["|", "||", "&&", ";", ">", ">>", "<", "{"]);
    return tokens.some((token) => SHELL_OPERATORS.has(token.value));
  }

  private createPatternText(signature: CommandSignature): string {
    return signature.parts
      .map((part) => (part.kind === "stable" ? part.value : `{arg${part.slotIndex + 1}}`))
      .join(" ");
  }
}
