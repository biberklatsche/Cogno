import { CommandSpec } from "../spec.types";

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
            scriptProviderId: spec.scriptProviderId,
        });
    }

    return [...byName.values()];
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

