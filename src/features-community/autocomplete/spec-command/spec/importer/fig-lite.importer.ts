import {
    CommandSpec,
    ArgSpec,
    OptionSpec,
    SubcommandSpec,
    ShellConstraint,
    SpecProviderBinding
} from "../spec.types";

export function importFigSubsetSpecs(importedSpecs: CommandSpec[]): CommandSpec[] {
    const byName = new Map<string, CommandSpec>();

    for (const spec of importedSpecs) {
        const name = (spec.name ?? "").trim();
        if (!name) continue;
        byName.set(name, {
            name,
            source: "fig",
            sourceUrl: spec.sourceUrl,
            description: spec.description?.trim() || undefined,
            subcommands: mergeLegacySubcommandOptions(
                normalizeSubcommands(spec.subcommands),
                dedupeSubcommandOptions(spec.subcommandOptions)
            ),
            options: normalizeOptions(spec.options),
            subcommandOptions: dedupeSubcommandOptions(spec.subcommandOptions),
            providers: sanitizeProviders(spec.providers),
            shells: sanitizeShellConstraints(spec.shells),
            excludeShells: sanitizeShellConstraints(spec.excludeShells),
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
            source: provider.source?.trim() || undefined,
            baseScore: provider.baseScore,
            params: normalizeProviderParams(provider.params),
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

function normalizeProviderParams(source: unknown): SpecProviderBinding["params"] | undefined {
    if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;

    const out: NonNullable<SpecProviderBinding["params"]> = {};
    for (const [key, value] of Object.entries(source)) {
        if (!key.trim()) continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            out[key] = value;
            continue;
        }
        if (
            Array.isArray(value) &&
            (value.every(item => typeof item === "string") ||
                value.every(item => typeof item === "number") ||
                value.every(item => typeof item === "boolean"))
        ) {
            out[key] = value as string[] | number[] | boolean[];
        }
    }

    return Object.keys(out).length ? out : undefined;
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

function normalizeNames(name: string | string[] | undefined): string[] {
    if (name === undefined) return [];
    const raw = Array.isArray(name) ? name : [name];
    return dedupe(raw);
}

function normalizeArgs(args?: ArgSpec | ArgSpec[]): ArgSpec[] | undefined {
    if (!args) return undefined;
    const raw = Array.isArray(args) ? args : [args];
    const out: ArgSpec[] = [];
    const seen = new Set<string>();
    for (const arg of raw) {
        const name = arg.name?.trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        out.push({
            name,
            description: arg.description?.trim() || undefined,
        });
    }
    return out.length ? out : undefined;
}

function normalizeOptions(source?: Array<string | OptionSpec>): OptionSpec[] | undefined {
    if (!source?.length) return undefined;
    const out: OptionSpec[] = [];
    const seen = new Set<string>();
    for (const item of source) {
        const normalized = normalizeOption(item);
        if (!normalized) continue;
        const key = JSON.stringify(normalized);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(normalized);
    }
    return out.length ? out : undefined;
}

function normalizeOption(source: string | OptionSpec): OptionSpec | undefined {
    if (typeof source === "string") {
        const names = normalizeNames(source);
        if (!names.length) return undefined;
        return { name: names[0] };
    }
    const names = normalizeNames(source.name);
    if (!names.length) return undefined;
    const args = normalizeArgs(source.args);
    return {
        name: names.length === 1 ? names[0] : names,
        description: source.description?.trim() || undefined,
        args,
        isRepeatable: source.isRepeatable ? true : undefined,
        providers: sanitizeProviders(source.providers),
    };
}

function normalizeSubcommands(source?: Array<string | SubcommandSpec>): SubcommandSpec[] | undefined {
    if (!source?.length) return undefined;
    const byPrimary = new Map<string, SubcommandSpec>();
    for (const item of source) {
        const normalized = normalizeSubcommand(item);
        if (!normalized) continue;
        const primary = namesOf(normalized.name)[0]?.toLowerCase();
        if (!primary) continue;

        const existing = byPrimary.get(primary);
        if (!existing) {
            byPrimary.set(primary, normalized);
            continue;
        }

        const mergedName = dedupe([...namesOf(existing.name), ...namesOf(normalized.name)]);
        const mergedOptions = normalizeOptions([...(existing.options ?? []), ...(normalized.options ?? [])]);
        const mergedSubs = normalizeSubcommands([...(existing.subcommands ?? []), ...(normalized.subcommands ?? [])]);
        byPrimary.set(primary, {
            name: mergedName.length === 1 ? mergedName[0] : mergedName,
            description: existing.description ?? normalized.description,
            args: normalizeArgs([...(Array.isArray(existing.args) ? existing.args : existing.args ? [existing.args] : []), ...(Array.isArray(normalized.args) ? normalized.args : normalized.args ? [normalized.args] : [])]),
            providers: sanitizeProviders([...(existing.providers ?? []), ...(normalized.providers ?? [])]),
            options: mergedOptions,
            subcommands: mergedSubs,
        });
    }
    return byPrimary.size ? [...byPrimary.values()] : undefined;
}

function normalizeSubcommand(source: string | SubcommandSpec): SubcommandSpec | undefined {
    if (typeof source === "string") {
        const names = normalizeNames(source);
        if (!names.length) return undefined;
        return { name: names[0] };
    }

    const names = normalizeNames(source.name);
    if (!names.length) return undefined;
    return {
        name: names.length === 1 ? names[0] : names,
        description: source.description?.trim() || undefined,
        args: normalizeArgs(source.args),
        providers: sanitizeProviders(source.providers),
        subcommands: normalizeSubcommands(source.subcommands),
        options: normalizeOptions(source.options),
    };
}

function namesOf(name: string | string[]): string[] {
    return Array.isArray(name) ? name : [name];
}

function sanitizeShellConstraints(source?: ShellConstraint[]): ShellConstraint[] | undefined {
    if (!source?.length) return undefined;
    const allowed: ShellConstraint[] = ["PowerShell", "ZSH", "Bash", "GitBash", "Fish"];
    const set = new Set<ShellConstraint>();
    for (const value of source) {
        if (allowed.includes(value)) set.add(value);
    }
    return set.size ? [...set] : undefined;
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

function mergeLegacySubcommandOptions(
    subcommands: SubcommandSpec[] | undefined,
    legacy: Record<string, string[]> | undefined
): SubcommandSpec[] | undefined {
    if (!legacy || Object.keys(legacy).length === 0) return subcommands;
    const next = [...(subcommands ?? [])];

    for (const [subcommand, optionNames] of Object.entries(legacy)) {
        const key = subcommand.trim().toLowerCase();
        if (!key) continue;
        const idx = next.findIndex(s => namesOf(s.name).some(n => n.toLowerCase() === key));
        const legacyOptions = normalizeOptions(optionNames);
        if (!legacyOptions?.length) continue;
        if (idx === -1) {
            next.push({
                name: subcommand,
                options: legacyOptions,
            });
            continue;
        }
        next[idx] = {
            ...next[idx],
            options: normalizeOptions([...(next[idx].options ?? []), ...legacyOptions]),
        };
    }
    return next.length ? next : undefined;
}
