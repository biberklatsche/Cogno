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
        return this.delegate.suggest({
            ...context,
            binding: {
                ...context.binding,
                providerId: "command-list",
                params: {
                    ...context.binding.params,
                    program: "git",
                    args: ["for-each-ref", "--sort=-HEAD", "--sort=refname", "--format=%(refname:short)", "refs/heads", "refs/remotes"],
                    itemLabel: "git branch",
                },
            },
        });
    }
}
