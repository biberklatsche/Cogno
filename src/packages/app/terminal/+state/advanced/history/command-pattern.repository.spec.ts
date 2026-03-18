import { describe, expect, it } from "vitest";

import { CommandPatternLearner } from "./command-pattern-learner";
import { CommandPatternRepository } from "./command-pattern.repository";
import { CommandSignatureBuilder } from "./command-signature-builder";
import { CommandTokenClassifier } from "./command-token-classifier";
import { CommandTokenizer } from "./command-tokenizer";

function createCommandPatternRepository(): CommandPatternRepository {
    return new CommandPatternRepository(
        new CommandPatternLearner(
            new CommandTokenizer(),
            new CommandTokenClassifier(),
            new CommandSignatureBuilder(),
        ),
    );
}

describe("CommandPatternRepository", () => {
    it("learns git commit message patterns with slot statistics", () => {
        const commandPatternRepository = createCommandPatternRepository();

        commandPatternRepository.learn('git commit -am "fix bug"', 100);
        commandPatternRepository.learn('git commit -am "update readme"', 200);

        const learnedPatterns = commandPatternRepository.search("git comm", 10);

        expect(learnedPatterns).toHaveLength(1);
        expect(learnedPatterns[0].signature.parts).toEqual([
            { kind: "stable", value: "git" },
            { kind: "stable", value: "commit" },
            { kind: "stable", value: "-am" },
            { kind: "slot", slotIndex: 0 },
        ]);
        expect(learnedPatterns[0].slotStatistics).toEqual([
            {
                slotIndex: 0,
                totalCount: 2,
                distinctValueCount: 2,
                topValue: "fix bug",
                topValueCount: 1,
            },
        ]);
    });

    it("does not learn patterns from fully stable commands", () => {
        const commandPatternRepository = createCommandPatternRepository();

        commandPatternRepository.learn("git status", 100);
        commandPatternRepository.learn("git stash", 200);

        expect(commandPatternRepository.search("git", 10)).toEqual([]);
    });
});
