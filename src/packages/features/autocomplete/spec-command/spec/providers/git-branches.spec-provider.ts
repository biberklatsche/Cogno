import { CommandRunnerContract } from "@cogno/core-sdk";
import { SpecProvidedSuggestion, SpecProviderContext, SpecSuggestionProvider } from "../spec.types";
import { CommandListSpecProvider } from "./command-list.spec-provider";

export class GitBranchesSpecProvider implements SpecSuggestionProvider {
    readonly id = "git-branches";
    private readonly delegate: CommandListSpecProvider;

    constructor(commandRunner: CommandRunnerContract) {
        this.delegate = new CommandListSpecProvider(commandRunner);
    }

    suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>> {
        const params = this.readParams(context.binding.params);

        return this.delegate.suggest({
            ...context,
            binding: {
                ...context.binding,
                providerId: "command-list",
                params: {
                    ...params,
                    program: "git",
                    args: ["for-each-ref", "--sort=-HEAD", "--sort=refname", "--format=%(refname:short)", "refs/heads", "refs/remotes"],
                    itemLabel: "git branch",
                },
            },
        });
    }

    private readParams(value: unknown): Record<string, unknown> {
        return value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
    }
}
