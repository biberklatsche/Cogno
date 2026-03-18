import { AutocompleteSuggestion, QueryContext } from "../../autocomplete.types";
import { LearnedCommandPattern } from "../../../history/command-pattern.models";
import { HistoryCommandScorer } from "./history-command.scorer";

const PATTERN_RULES = {
    minimumPatternCount: 2,
    minimumSlotCount: 1,
    minimumStableTokenCount: 3,
    minimumNonOptionStableTokenCount: 2,
    minimumSlotDistinctValueCount: 2,
    minimumSlotVarianceRatio: 0.45,
    maximumTopValueDominanceRatio: 0.8,
    minimumScore: 55,
    genericPenalty: 24,
    staleExposurePenaltyThreshold: 4,
    rejectionPenaltyWeight: 28,
    maximumRejectionPenalty: 42,
    selectionBonusWeight: 18,
    patternAgeHalfLifeMs: 14 * 24 * 60 * 60 * 1000,
    stalePatternMaxPenalty: 42,
    staleUnselectedPatternGracePeriodMs: 3 * 24 * 60 * 60 * 1000,
    staleUnselectedPatternHalfLifeMs: 7 * 24 * 60 * 60 * 1000,
    staleUnselectedPatternMaxPenalty: 36,
} as const;

export class SuggestionPatternReducer {
    reduce(learnedCommandPatterns: LearnedCommandPattern[], context: QueryContext): AutocompleteSuggestion[] {
        const query = context.mode === "command" ? context.query : "";
        const queryTokens = HistoryCommandScorer.uniqueTokens(query);
        const inputCommandToken = HistoryCommandScorer.firstToken(context.inputText);

        return learnedCommandPatterns.flatMap((learnedCommandPattern) => {
            const reducedSuggestion = this.toSuggestion(learnedCommandPattern, context, queryTokens, inputCommandToken);
            return reducedSuggestion === undefined ? [] : [reducedSuggestion];
        });
    }

    private toSuggestion(
        learnedCommandPattern: LearnedCommandPattern,
        context: QueryContext,
        queryTokens: string[],
        inputCommandToken: string,
    ): AutocompleteSuggestion | undefined {
        if (!this.isHelpfulPattern(learnedCommandPattern)) {
            return undefined;
        }

        const patternLabel = this.createPatternLabel(learnedCommandPattern);
        const rowLikePattern = {
            command: patternLabel,
            execCount: learnedCommandPattern.totalCount,
            selectCount: 0,
            lastExecAt: learnedCommandPattern.lastSeenAt,
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

        const slotVarietyScore = learnedCommandPattern.slotStatistics.reduce((score, slotStatistics) => {
            const varianceRatio = slotStatistics.totalCount === 0
                ? 0
                : slotStatistics.distinctValueCount / slotStatistics.totalCount;
            return score + varianceRatio;
        }, 0);

        const genericPenalty = learnedCommandPattern.stableTokenCount < PATTERN_RULES.minimumStableTokenCount
            ? PATTERN_RULES.genericPenalty
            : 0;
        const shownCount = learnedCommandPattern.shownCount;
        const selectedCount = learnedCommandPattern.selectedCount;
        const acceptanceRatio = shownCount <= 0 ? 0 : selectedCount / shownCount;
        const unselectedExposureCount = Math.max(0, shownCount - selectedCount);
        const rejectionPenalty =
            shownCount >= PATTERN_RULES.staleExposurePenaltyThreshold && selectedCount === 0
                ? Math.min(
                    PATTERN_RULES.maximumRejectionPenalty,
                    unselectedExposureCount * PATTERN_RULES.rejectionPenaltyWeight * (1 - acceptanceRatio),
                )
                : 0;
        const selectionBonus = selectedCount * PATTERN_RULES.selectionBonusWeight;
        const patternAgePenalty = this.calculatePatternAgePenalty(learnedCommandPattern, Date.now());
        const unselectedAgePenalty = this.calculateUnselectedAgePenalty(learnedCommandPattern, Date.now());
        const score =
            baseScore +
            (slotVarietyScore * 14) +
            (learnedCommandPattern.totalCount * 2) +
            selectionBonus -
            genericPenalty -
            rejectionPenalty -
            patternAgePenalty -
            unselectedAgePenalty;

        if (score < PATTERN_RULES.minimumScore) {
            return undefined;
        }

        const dominantSlotStatistics = learnedCommandPattern.slotStatistics[0];
        return {
            label: patternLabel,
            description: "Learned command pattern",
            insertText: patternLabel,
            score,
            source: "history-pattern",
            replaceStart: 0,
            replaceEnd: context.inputText.length,
            selectedPatternSignature: learnedCommandPattern.signature.key,
            completionBehavior: "continue",
        };
    }

    private isHelpfulPattern(learnedCommandPattern: LearnedCommandPattern): boolean {
        if (learnedCommandPattern.totalCount < PATTERN_RULES.minimumPatternCount) {
            return false;
        }
        if (learnedCommandPattern.variableSlotCount < PATTERN_RULES.minimumSlotCount) {
            return false;
        }
        if (learnedCommandPattern.stableTokenCount < PATTERN_RULES.minimumStableTokenCount) {
            return false;
        }
        if (learnedCommandPattern.nonOptionStableTokenCount < PATTERN_RULES.minimumNonOptionStableTokenCount) {
            return false;
        }

        const hasHelpfulSlot = learnedCommandPattern.slotStatistics.every((slotStatistics) => {
            const varianceRatio = slotStatistics.totalCount === 0
                ? 0
                : slotStatistics.distinctValueCount / slotStatistics.totalCount;
            const topValueDominanceRatio = slotStatistics.totalCount === 0
                ? 1
                : slotStatistics.topValueCount / slotStatistics.totalCount;

            return (
                slotStatistics.totalCount >= PATTERN_RULES.minimumPatternCount &&
                slotStatistics.distinctValueCount >= PATTERN_RULES.minimumSlotDistinctValueCount &&
                varianceRatio >= PATTERN_RULES.minimumSlotVarianceRatio &&
                topValueDominanceRatio <= PATTERN_RULES.maximumTopValueDominanceRatio
            );
        });

        if (!hasHelpfulSlot) {
            return false;
        }

        const firstTwoParts = learnedCommandPattern.signature.parts.slice(0, 2);
        return firstTwoParts.every((part) => part?.kind === "stable");
    }

    private createPatternLabel(learnedCommandPattern: LearnedCommandPattern): string {
        return learnedCommandPattern.signature.parts
            .map((part) => part.kind === "stable" ? part.value : `{arg${part.slotIndex + 1}}`)
            .join(" ");
    }

    private calculatePatternAgePenalty(learnedCommandPattern: LearnedCommandPattern, now: number): number {
        const patternAgeInMilliseconds = this.safeAge(now, learnedCommandPattern.lastSeenAt);
        const freshness = this.calculateHalfLifeDecay(
            patternAgeInMilliseconds,
            PATTERN_RULES.patternAgeHalfLifeMs,
        );

        return (1 - freshness) * PATTERN_RULES.stalePatternMaxPenalty;
    }

    private calculateUnselectedAgePenalty(learnedCommandPattern: LearnedCommandPattern, now: number): number {
        if (learnedCommandPattern.selectedCount > 0) {
            return 0;
        }

        const mostRecentInteractionTimestamp = Math.max(
            learnedCommandPattern.lastShownAt ?? 0,
            learnedCommandPattern.lastSeenAt,
        );
        const ageSinceInteractionInMilliseconds = this.safeAge(now, mostRecentInteractionTimestamp);
        if (ageSinceInteractionInMilliseconds <= PATTERN_RULES.staleUnselectedPatternGracePeriodMs) {
            return 0;
        }

        const decayAgeInMilliseconds =
            ageSinceInteractionInMilliseconds - PATTERN_RULES.staleUnselectedPatternGracePeriodMs;
        const freshness = this.calculateHalfLifeDecay(
            decayAgeInMilliseconds,
            PATTERN_RULES.staleUnselectedPatternHalfLifeMs,
        );

        return (1 - freshness) * PATTERN_RULES.staleUnselectedPatternMaxPenalty;
    }

    private calculateHalfLifeDecay(ageInMilliseconds: number, halfLifeInMilliseconds: number): number {
        if (!Number.isFinite(ageInMilliseconds) || ageInMilliseconds < 0 || halfLifeInMilliseconds <= 0) {
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
