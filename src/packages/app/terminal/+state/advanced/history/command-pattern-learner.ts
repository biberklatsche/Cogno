import {
  CommandPatternOccurrence,
  CommandPatternSlotStatistics,
  CommandSignature,
  CommandSignaturePart,
  LearnedCommandPattern,
} from "./command-pattern.models";
import { CommandSignatureBuilder } from "./command-signature-builder";
import { CommandTokenClassifier } from "./command-token-classifier";
import { CommandTokenizer } from "./command-tokenizer";

type SlotAccumulator = {
  slotIndex: number;
  totalCount: number;
  valueCounts: Map<string, number>;
};

type PatternAccumulator = {
  signature: CommandSignature;
  totalCount: number;
  lastSeenAt: number;
  slotAccumulators: SlotAccumulator[];
};

export class CommandPatternLearner {
  constructor(
    private readonly commandTokenizer: CommandTokenizer,
    private readonly commandTokenClassifier: CommandTokenClassifier,
    private readonly commandSignatureBuilder: CommandSignatureBuilder,
  ) {}

  updatePattern(
    existingPatternAccumulator: PatternAccumulator | undefined,
    commandText: string,
    timestamp: number,
  ): PatternAccumulator | undefined {
    const commandPatternOccurrence = this.analyzeCommand(commandText);
    if (commandPatternOccurrence === undefined) {
      return undefined;
    }

    const signature = commandPatternOccurrence.signature;
    const slotValuesByIndex = new Map(
      commandPatternOccurrence.slotValues.map((slotValue) => [
        slotValue.slotIndex,
        slotValue.value,
      ]),
    );

    const slotAccumulators =
      existingPatternAccumulator?.slotAccumulators.map((slotAccumulator) => ({
        ...slotAccumulator,
        valueCounts: new Map(slotAccumulator.valueCounts),
      })) ?? this.createSlotAccumulators(signature.parts);

    for (const currentPart of signature.parts) {
      if (currentPart.kind !== "slot") continue;
      const currentSlotAccumulator = slotAccumulators.find(
        (slotAccumulator) => slotAccumulator.slotIndex === currentPart.slotIndex,
      );
      if (!currentSlotAccumulator) {
        continue;
      }

      const slotValue = slotValuesByIndex.get(currentPart.slotIndex);
      if (slotValue === undefined) {
        continue;
      }
      currentSlotAccumulator.totalCount += 1;
      currentSlotAccumulator.valueCounts.set(
        slotValue,
        (currentSlotAccumulator.valueCounts.get(slotValue) ?? 0) + 1,
      );
    }

    return {
      signature,
      totalCount: (existingPatternAccumulator?.totalCount ?? 0) + 1,
      lastSeenAt: timestamp,
      slotAccumulators,
    };
  }

  toLearnedPattern(patternAccumulator: PatternAccumulator): LearnedCommandPattern {
    const stableTokenCount = patternAccumulator.signature.parts.filter(
      (part) => part.kind === "stable",
    ).length;
    const nonOptionStableTokenCount = patternAccumulator.signature.parts.filter(
      (part) => part.kind === "stable" && !part.value.startsWith("-"),
    ).length;
    const variableSlotCount = patternAccumulator.signature.parts.filter(
      (part) => part.kind === "slot",
    ).length;

    return {
      signature: patternAccumulator.signature,
      totalCount: patternAccumulator.totalCount,
      stableTokenCount,
      nonOptionStableTokenCount,
      variableSlotCount,
      lastSeenAt: patternAccumulator.lastSeenAt,
      shownCount: 0,
      selectedCount: 0,
      lastShownAt: undefined,
      lastSelectedAt: undefined,
      slotStatistics: patternAccumulator.slotAccumulators.map((slotAccumulator) =>
        this.toSlotStatistics(slotAccumulator),
      ),
    };
  }

  analyzeCommand(commandText: string): CommandPatternOccurrence | undefined {
    const commandTokens = this.commandTokenizer.tokenize(commandText);
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

  private createSlotAccumulators(signatureParts: CommandSignaturePart[]): SlotAccumulator[] {
    return signatureParts.flatMap((signaturePart) =>
      signaturePart.kind === "slot"
        ? [
            {
              slotIndex: signaturePart.slotIndex,
              totalCount: 0,
              valueCounts: new Map<string, number>(),
            },
          ]
        : [],
    );
  }

  private toSlotStatistics(slotAccumulator: SlotAccumulator): CommandPatternSlotStatistics {
    let topValue = "";
    let topValueCount = 0;

    for (const [value, valueCount] of slotAccumulator.valueCounts.entries()) {
      if (valueCount > topValueCount) {
        topValue = value;
        topValueCount = valueCount;
      }
    }

    return {
      slotIndex: slotAccumulator.slotIndex,
      totalCount: slotAccumulator.totalCount,
      distinctValueCount: slotAccumulator.valueCounts.size,
      topValue,
      topValueCount,
    };
  }

  private createPatternText(signature: CommandSignature): string {
    return signature.parts
      .map((part) => (part.kind === "stable" ? part.value : `{arg${part.slotIndex + 1}}`))
      .join(" ");
  }
}
