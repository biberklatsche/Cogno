import { CommandRunnerContract } from "@cogno/core-api";
import { SpecProvidedSuggestion, SpecProviderContext, SpecSuggestionProvider } from "../spec.types";

type ProcessEntry = {
  readonly processId: string;
  readonly processName: string;
};

export class ProcessListSpecProvider implements SpecSuggestionProvider {
  readonly id = "process-list";
  private static readonly CACHE_TTL_MS = 1_500;

  private cacheExpiresAt = 0;
  private cachedSuggestions: ReadonlyArray<SpecProvidedSuggestion> = [];

  constructor(private readonly commandRunner: CommandRunnerContract) {}

  async suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>> {
    if (context.binding.providerId !== "process-list") return [];

    const now = Date.now();
    if (this.cacheExpiresAt > now) {
      return this.cachedSuggestions;
    }

    const entries = await this.loadProcesses(context);
    const suggestions = entries.map((entry) => ({
      label: `${entry.processId} ${entry.processName}`,
      insertText: entry.processId,
      description: entry.processName,
    }));

    this.cacheExpiresAt = now + ProcessListSpecProvider.CACHE_TTL_MS;
    this.cachedSuggestions = suggestions;
    return suggestions;
  }

  private async loadProcesses(context: SpecProviderContext): Promise<ProcessEntry[]> {
    const backendOs = context.queryContext.shellContext.backendOs;
    if (backendOs === "windows") {
      return this.loadWindowsProcesses(context);
    }
    return this.loadUnixProcesses(context);
  }

  private async loadUnixProcesses(context: SpecProviderContext): Promise<ProcessEntry[]> {
    const result = await this.commandRunner.run({
      cwd: context.queryContext.cwd,
      shellContext: context.queryContext.shellContext,
      program: "ps",
      args: ["-e", "-o", "pid=", "-o", "comm="],
    });
    if (result.exitCode !== 0 || !result.stdout.trim()) return [];

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (!match) return undefined;
        const processId = match[1]?.trim();
        const processName = match[2]?.trim();
        if (!processId || !processName) return undefined;
        return { processId, processName } satisfies ProcessEntry;
      })
      .filter((entry): entry is ProcessEntry => !!entry);
  }

  private async loadWindowsProcesses(context: SpecProviderContext): Promise<ProcessEntry[]> {
    const result = await this.commandRunner.run({
      cwd: context.queryContext.cwd,
      shellContext: context.queryContext.shellContext,
      program: "tasklist",
      args: ["/FO", "CSV", "/NH"],
    });
    if (result.exitCode !== 0 || !result.stdout.trim()) return [];

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.parseCsvFields(line))
      .map((fields) => {
        const processName = fields[0]?.trim();
        const processId = fields[1]?.trim();
        if (!processId || !/^\d+$/.test(processId) || !processName) return undefined;
        return { processId, processName } satisfies ProcessEntry;
      })
      .filter((entry): entry is ProcessEntry => !!entry);
  }

  private parseCsvFields(line: string): string[] {
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        const nextCharacter = line[index + 1];
        if (inQuotes && nextCharacter === '"') {
          currentField += '"';
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (character === "," && !inQuotes) {
        fields.push(currentField);
        currentField = "";
        continue;
      }

      currentField += character;
    }

    fields.push(currentField);
    return fields;
  }
}
