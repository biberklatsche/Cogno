import { CommandPatternLearner } from "./command-pattern-learner";
import { LearnedCommandPattern } from "./command-pattern.models";

type PatternAccumulator = ReturnType<CommandPatternLearner["updatePattern"]>;

export class CommandPatternRepository {
    private readonly patternsBySignature = new Map<string, NonNullable<PatternAccumulator>>();

    constructor(private readonly commandPatternLearner: CommandPatternLearner) {}

    learn(commandText: string, timestamp: number): void {
        const learnedPattern = this.commandPatternLearner.updatePattern(
            this.findPatternAccumulator(commandText),
            commandText,
            timestamp,
        );

        if (learnedPattern === undefined) {
            return;
        }

        this.patternsBySignature.set(learnedPattern.signature.key, learnedPattern);
    }

    search(fragment: string, limit: number = 50): LearnedCommandPattern[] {
        const queryTokens = fragment
            .trim()
            .toLowerCase()
            .split(/\s+/u)
            .filter(Boolean);

        if (queryTokens.length === 0) {
            return [];
        }

        return [...this.patternsBySignature.values()]
            .map((patternAccumulator) => this.commandPatternLearner.toLearnedPattern(patternAccumulator))
            .filter((learnedPattern) => this.matchesQuery(learnedPattern, queryTokens))
            .sort((leftPattern, rightPattern) => rightPattern.lastSeenAt - leftPattern.lastSeenAt)
            .slice(0, limit);
    }

    private findPatternAccumulator(commandText: string): NonNullable<PatternAccumulator> | undefined {
        const learnedPattern = this.commandPatternLearner.updatePattern(undefined, commandText, 0);
        if (learnedPattern === undefined) {
            return undefined;
        }

        return this.patternsBySignature.get(learnedPattern.signature.key);
    }

    private matchesQuery(learnedCommandPattern: LearnedCommandPattern, queryTokens: string[]): boolean {
        const stableTokens = learnedCommandPattern.signature.parts
            .filter((part) => part.kind === "stable")
            .map((part) => part.value.toLowerCase());

        return queryTokens.every((queryToken) =>
            stableTokens.some((stableToken) => stableToken.startsWith(queryToken) || stableToken.includes(queryToken)),
        );
    }
}
