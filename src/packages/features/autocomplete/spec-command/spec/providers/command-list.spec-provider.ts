import { CommandRunnerContract } from "@cogno/core-sdk";
import { SpecProvidedSuggestion, SpecProviderContext, SpecSuggestionProvider } from "../spec.types";

type CacheEntry = {
    readonly expiresAt: number;
    readonly suggestions: ReadonlyArray<SpecProvidedSuggestion>;
};

export class CommandListSpecProvider implements SpecSuggestionProvider {
    readonly id = "command-list";
    private static readonly CACHE_TTL_MS = 1_500;
    private static readonly CACHE_MAX = 32;
    private static readonly DEFAULT_LIMIT = 100;

    private readonly cache = new Map<string, CacheEntry>();

    constructor(private readonly commandRunner: CommandRunnerContract) {}

    async suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>> {
        const program = this.readStringParam(context, "program");
        if (!program) return [];

        const args = this.readStringArrayParam(context, "args");
        const query = this.resolveQuery(context).trim().toLowerCase();
        const limit = this.readNumberParam(context, "limit") ?? CommandListSpecProvider.DEFAULT_LIMIT;
        const labelField = this.readNumberParam(context, "labelField") ?? 0;
        const descriptionField = this.readNumberParam(context, "descriptionField");
        const detailField = this.readNumberParam(context, "detailField");
        const stripLabelPrefix = this.readStringParam(context, "stripLabelPrefix");
        const itemLabel = this.readStringParam(context, "itemLabel") ?? "item";
        const cacheKey = JSON.stringify([
            context.queryContext.cwd,
            context.queryContext.shellContext.shellType,
            program,
            args,
            labelField,
            descriptionField,
            detailField,
            stripLabelPrefix,
            itemLabel,
        ]);

        const now = Date.now();
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return this.filterSuggestions(cached.suggestions, query, limit);
        }

        const result = await this.commandRunner.run({
            cwd: context.queryContext.cwd,
            shellContext: context.queryContext.shellContext,
            program,
            args,
        });
        if (result.exitCode !== 0 || !result.stdout.trim()) {
            return [];
        }

        const suggestions = result.stdout
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => this.parseLine(line, {
                labelField,
                descriptionField,
                detailField,
                stripLabelPrefix,
                itemLabel,
            }))
            .filter((value): value is SpecProvidedSuggestion => !!value);

        this.setCache(cacheKey, {
            expiresAt: now + CommandListSpecProvider.CACHE_TTL_MS,
            suggestions,
        });
        return this.filterSuggestions(suggestions, query, limit);
    }

    private filterSuggestions(
        suggestions: ReadonlyArray<SpecProvidedSuggestion>,
        query: string,
        limit: number,
    ): ReadonlyArray<SpecProvidedSuggestion> {
        const prefix: SpecProvidedSuggestion[] = [];
        const contains: SpecProvidedSuggestion[] = [];

        for (const suggestion of suggestions) {
            const lowered = suggestion.label.toLowerCase();
            if (!query) {
                prefix.push(suggestion);
            } else if (lowered.startsWith(query)) {
                prefix.push(suggestion);
            } else if (lowered.includes(query)) {
                contains.push(suggestion);
            }

            if ((prefix.length + contains.length) >= limit) break;
        }

        return [...prefix, ...contains].slice(0, limit);
    }

    private parseLine(
        line: string,
        config: {
            labelField: number;
            descriptionField?: number;
            detailField?: number;
            stripLabelPrefix?: string;
            itemLabel: string;
        },
    ): SpecProvidedSuggestion | undefined {
        const fields = line.split("\t");
        const rawLabel = fields[config.labelField]?.trim();
        if (!rawLabel) return undefined;

        const label = config.stripLabelPrefix && rawLabel.startsWith(config.stripLabelPrefix)
            ? rawLabel.slice(config.stripLabelPrefix.length)
            : rawLabel;
        if (!label) return undefined;

        return {
            label,
            description: config.descriptionField !== undefined
                ? fields[config.descriptionField]?.trim() || undefined
                : config.itemLabel,
            detail: config.detailField !== undefined
                ? fields[config.detailField]?.trim() || undefined
                : undefined,
        };
    }

    private resolveQuery(context: SpecProviderContext): string {
        if (context.queryContext.mode === "cd") {
            return context.queryContext.fragment;
        }

        const beforeCursor = context.queryContext.beforeCursor;
        if (/\s$/.test(beforeCursor)) return "";
        return context.args.at(-1) ?? "";
    }

    private readStringParam(context: SpecProviderContext, key: string): string | undefined {
        const value = context.binding.params?.[key];
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
    }

    private readStringArrayParam(context: SpecProviderContext, key: string): string[] {
        const value = context.binding.params?.[key];
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    }

    private readNumberParam(context: SpecProviderContext, key: string): number | undefined {
        const value = context.binding.params?.[key];
        return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    }

    private setCache(key: string, value: CacheEntry): void {
        if (this.cache.size >= CommandListSpecProvider.CACHE_MAX) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}
