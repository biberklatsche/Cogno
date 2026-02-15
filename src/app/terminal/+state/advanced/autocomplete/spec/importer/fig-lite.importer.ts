import { CommandSpec, SpecProviderBinding } from "../spec.types";

export function importFigSubsetSpecs(importedSpecs: CommandSpec[]): CommandSpec[] {
    const byName = new Map<string, CommandSpec>();

    for (const spec of importedSpecs) {
        const name = (spec.name ?? "").trim();
        if (!name) continue;
        byName.set(name, {
            name,
            source: "fig",
            sourceUrl: spec.sourceUrl,
            subcommands: dedupe(spec.subcommands ?? []),
            options: dedupe(spec.options ?? []),
            subcommandOptions: dedupeSubcommandOptions(spec.subcommandOptions),
            providers: sanitizeProviders(spec.providers),
        });
    }

    return [...byName.values()];
}

function sanitizeProviders(source?: SpecProviderBinding[]): SpecProviderBinding[] | undefined {
    if (!source?.length) return undefined;
    const out: SpecProviderBinding[] = [];
    const seen = new Set<string>();

    for (const provider of source) {
        const providerId = provider.providerId?.trim();
        if (!providerId) continue;
        const firstArgIn = dedupe(provider.when?.firstArgIn ?? []);
        const argsRegex = provider.when?.argsRegex?.trim();
        const minArgs = provider.when?.minArgs;
        const maxArgs = provider.when?.maxArgs;

        // Ignore invalid regex patterns to keep import resilient.
        if (argsRegex) {
            try {
                new RegExp(argsRegex, "i");
            } catch {
                continue;
            }
        }

        const normalized: SpecProviderBinding = {
            providerId,
            kind: provider.kind ?? "script",
            source: provider.source?.trim() || undefined,
            baseScore: provider.baseScore,
            when: firstArgIn.length || argsRegex || minArgs !== undefined || maxArgs !== undefined
                ? {
                    firstArgIn: firstArgIn.length ? firstArgIn : undefined,
                    argsRegex: argsRegex || undefined,
                    minArgs,
                    maxArgs,
                }
                : undefined,
        };

        const key = JSON.stringify(normalized);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(normalized);
    }

    return out.length ? out : undefined;
}

function dedupe(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of values) {
        const v = value.trim();
        if (!v || seen.has(v)) continue;
        seen.add(v);
        out.push(v);
    }
    return out;
}

function dedupeSubcommandOptions(
    source?: Record<string, string[]>
): Record<string, string[]> | undefined {
    if (!source) return undefined;
    const out: Record<string, string[]> = {};
    for (const [subcommand, values] of Object.entries(source)) {
        const key = subcommand.trim();
        if (!key) continue;
        out[key] = dedupe(values ?? []);
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
