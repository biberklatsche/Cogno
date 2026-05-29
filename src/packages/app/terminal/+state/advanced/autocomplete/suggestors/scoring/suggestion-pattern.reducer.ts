import {
  CommandPattern,
  CommandPatternSlotStatistics,
} from "../../../history/command-pattern.models";
import { AutocompleteSuggestion, QueryContext } from "../../autocomplete.types";
import { HistoryCommandScorer } from "./history-command.scorer";

const PATTERN_RULES = {
  minimumPatternCount: 2,
  minimumSlotCount: 1,
  minimumStableTokenCount: 2,
  minimumNonOptionStableTokenCount: 1,
  minimumSlotDistinctValueCount: 2,
  maximumTopValueDominanceRatio: 0.9,
  minimumScore: 55,
  genericPenalty: 24,
  selectionBonusWeight: 18,
  patternAgeHalfLifeMs: 14 * 24 * 60 * 60 * 1000,
  stalePatternMaxPenalty: 42,
} as const;

export class SuggestionPatternReducer {
  reduce(patterns: CommandPattern[], context: QueryContext): AutocompleteSuggestion[] {
    const query = context.mode === "command" ? context.query : "";
    const queryTokens = HistoryCommandScorer.uniqueTokens(query);
    const inputCommandToken = HistoryCommandScorer.firstToken(context.inputText);

    return patterns.flatMap((pattern) => {
      const reducedSuggestion = this.toSuggestion(pattern, context, queryTokens, inputCommandToken);
      return reducedSuggestion === undefined ? [] : [reducedSuggestion];
    });
  }

  private toSuggestion(
    pattern: CommandPattern,
    context: QueryContext,
    queryTokens: string[],
    inputCommandToken: string,
  ): AutocompleteSuggestion | undefined {
    if (!this.isHelpfulPattern(pattern)) {
      return undefined;
    }

    const patternLabel = this.createPatternLabel(pattern);
    const rowLikePattern = {
      command: patternLabel,
      execCount: pattern.totalCount,
      selectCount: 0,
      lastExecAt: pattern.lastSeenAt,
      lastSelectAt: 0,
      cwdExecCount: 0,
      cwdSelectCount: 0,
      cwdLastExecAt: 0,
      cwdLastSelectAt: 0,
      transitionCount: 0,
      outgoingTransitionCount: 0,
      lastTransitionAt: 0,
    };
    const corpus = [rowLikePattern];
    const documentFrequency = HistoryCommandScorer.buildDocFreq(corpus, queryTokens);
    const baseScore = HistoryCommandScorer.scoreRow(
      rowLikePattern,
      queryTokens,
      documentFrequency,
      1,
      inputCommandToken,
      Date.now(),
    );

    if (baseScore === null) {
      return undefined;
    }

    const slotVarietyScore = pattern.slotStatistics.reduce((score, slotStatistics) => {
      const varianceRatio =
        slotStatistics.totalCount === 0
          ? 0
          : slotStatistics.distinctValueCount / slotStatistics.totalCount;
      return score + varianceRatio;
    }, 0);

    const genericPenalty =
      pattern.stableTokenCount < PATTERN_RULES.minimumStableTokenCount
        ? PATTERN_RULES.genericPenalty
        : 0;
    const selectionBonus = pattern.selectedCount * PATTERN_RULES.selectionBonusWeight;
    const patternAgePenalty = this.calculatePatternAgePenalty(pattern, Date.now());
    const score =
      baseScore +
      slotVarietyScore * 14 +
      pattern.totalCount * 2 +
      selectionBonus -
      genericPenalty -
      patternAgePenalty;

    if (score < PATTERN_RULES.minimumScore) {
      return undefined;
    }

    return {
      label: patternLabel,
      description: "Learned command pattern",
      insertText: patternLabel.split(/{arg\d+}/)[0],
      score,
      source: "history-pattern",
      replaceStart: 0,
      replaceEnd: context.inputText.length,
      selectedPatternSignature: pattern.signature.key,
      completionBehavior: "continue",
    };
  }

  private isHelpfulPattern(pattern: CommandPattern): boolean {
    if (pattern.selectedCount < 1) {
      return false;
    }
    if (pattern.totalCount < PATTERN_RULES.minimumPatternCount) {
      return false;
    }
    if (pattern.variableSlotCount < PATTERN_RULES.minimumSlotCount) {
      return false;
    }
    if (pattern.stableTokenCount < PATTERN_RULES.minimumStableTokenCount) {
      return false;
    }
    if (pattern.nonOptionStableTokenCount < PATTERN_RULES.minimumNonOptionStableTokenCount) {
      return false;
    }

    const hasAtLeastOneVariableSlot = pattern.slotStatistics.some((stat) =>
      this.isGenuinelyVariableSlot(stat),
    );

    if (!hasAtLeastOneVariableSlot) {
      return false;
    }

    const firstPart = pattern.signature.parts[0];
    return firstPart?.kind === "stable";
  }

  private isGenuinelyVariableSlot(stat: CommandPatternSlotStatistics): boolean {
    return (
      stat.totalCount >= PATTERN_RULES.minimumPatternCount &&
      stat.distinctValueCount >= PATTERN_RULES.minimumSlotDistinctValueCount &&
      stat.topValueCount / stat.totalCount <= PATTERN_RULES.maximumTopValueDominanceRatio
    );
  }

  private createPatternLabel(pattern: CommandPattern): string {
    const slotStatsMap = new Map(pattern.slotStatistics.map((s) => [s.slotIndex, s]));
    let displayArgCounter = 1;
    return pattern.signature.parts
      .map((part) => {
        if (part.kind === "stable") return part.value;
        const stat = slotStatsMap.get(part.slotIndex);
        if (stat && !this.isGenuinelyVariableSlot(stat)) return stat.topValue;
        return `{arg${displayArgCounter++}}`;
      })
      .join(" ");
  }

  private calculatePatternAgePenalty(pattern: CommandPattern, now: number): number {
    const patternAgeInMilliseconds = this.safeAge(now, pattern.lastSeenAt);
    const freshness = this.calculateHalfLifeDecay(
      patternAgeInMilliseconds,
      PATTERN_RULES.patternAgeHalfLifeMs,
    );

    return (1 - freshness) * PATTERN_RULES.stalePatternMaxPenalty;
  }

  private calculateHalfLifeDecay(
    ageInMilliseconds: number,
    halfLifeInMilliseconds: number,
  ): number {
    if (
      !Number.isFinite(ageInMilliseconds) ||
      ageInMilliseconds < 0 ||
      halfLifeInMilliseconds <= 0
    ) {
      return 0;
    }

    return Math.exp(-Math.LN2 * (ageInMilliseconds / halfLifeInMilliseconds));
  }

  private safeAge(now: number, timestamp?: number): number {
    if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, now - timestamp);
  }
}
