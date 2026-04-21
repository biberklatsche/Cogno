import { CommandRunnerContract, FilesystemContract } from "@cogno/core-api";
import { SpecProvidedSuggestion, SpecProviderContext, SpecSuggestionProvider } from "../spec.types";

export class SshHostsSpecProvider implements SpecSuggestionProvider {
  readonly id = "ssh-hosts";
  private static readonly CACHE_TTL_MS = 3_000;

  private cacheExpiresAt = 0;
  private cachedSuggestions: ReadonlyArray<SpecProvidedSuggestion> = [];
  private cachedHomeDirectoryByBackendOs = new Map<string, string>();

  constructor(
    private readonly filesystem: FilesystemContract,
    private readonly commandRunner: CommandRunnerContract,
  ) {}

  async suggest(context: SpecProviderContext): Promise<ReadonlyArray<SpecProvidedSuggestion>> {
    if (context.binding.providerId !== "ssh-hosts") return [];

    const now = Date.now();
    if (this.cacheExpiresAt > now) {
      return this.cachedSuggestions;
    }

    const homeDirectory = await this.resolveHomeDirectory(context);
    if (!homeDirectory) return [];

    const shellContext = context.queryContext.shellContext;
    const sshConfigPath = this.filesystem.resolvePath(homeDirectory, ".ssh/config", shellContext);
    const knownHostsPath = this.filesystem.resolvePath(
      homeDirectory,
      ".ssh/known_hosts",
      shellContext,
    );

    const hostNames = new Set<string>();
    if (sshConfigPath && (await this.filesystem.exists(sshConfigPath, shellContext))) {
      const text = await this.filesystem.readTextFile(sshConfigPath, shellContext);
      for (const host of this.parseConfigHosts(text)) {
        hostNames.add(host);
      }
    }

    if (knownHostsPath && (await this.filesystem.exists(knownHostsPath, shellContext))) {
      const text = await this.filesystem.readTextFile(knownHostsPath, shellContext);
      for (const host of this.parseKnownHosts(text)) {
        hostNames.add(host);
      }
    }

    const suggestions = [...hostNames]
      .sort((leftHost, rightHost) => leftHost.localeCompare(rightHost))
      .map((host) => ({
        label: host,
        description: "ssh host",
      }));

    this.cacheExpiresAt = now + SshHostsSpecProvider.CACHE_TTL_MS;
    this.cachedSuggestions = suggestions;
    return suggestions;
  }

  private async resolveHomeDirectory(context: SpecProviderContext): Promise<string | undefined> {
    const backendOs = context.queryContext.shellContext.backendOs;
    const cachedHomeDirectory = this.cachedHomeDirectoryByBackendOs.get(backendOs);
    if (cachedHomeDirectory) return cachedHomeDirectory;

    const result = await this.commandRunner.run({
      cwd: context.queryContext.cwd,
      shellContext: context.queryContext.shellContext,
      program: backendOs === "windows" ? "cmd.exe" : "sh",
      args:
        backendOs === "windows" ? ["/d", "/c", "echo %USERPROFILE%"] : ["-lc", 'printf %s "$HOME"'],
      timeoutMs: context.timeoutMs,
    });
    if (result.exitCode !== 0) return undefined;

    const homeDirectory = result.stdout.trim();
    if (!homeDirectory) return undefined;

    this.cachedHomeDirectoryByBackendOs.set(backendOs, homeDirectory);
    return homeDirectory;
  }

  private parseConfigHosts(text: string): string[] {
    const hostNames = new Set<string>();

    for (const line of text.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;
      if (!/^host\s+/i.test(trimmedLine)) continue;

      const hostPatterns = trimmedLine
        .replace(/^host\s+/i, "")
        .trim()
        .split(/\s+/);
      for (const hostPattern of hostPatterns) {
        const normalizedHost = hostPattern.trim();
        if (!normalizedHost) continue;
        if (normalizedHost === "*" || normalizedHost.includes("*") || normalizedHost.includes("?"))
          continue;
        if (normalizedHost.startsWith("!")) continue;
        hostNames.add(normalizedHost);
      }
    }

    return [...hostNames];
  }

  private parseKnownHosts(text: string): string[] {
    const hostNames = new Set<string>();

    for (const line of text.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#") || trimmedLine.startsWith("|")) continue;

      const firstField = trimmedLine.split(/\s+/)[0]?.trim();
      if (!firstField) continue;

      for (const hostToken of firstField.split(",")) {
        const normalizedHost = this.normalizeKnownHostToken(hostToken);
        if (!normalizedHost) continue;
        hostNames.add(normalizedHost);
      }
    }

    return [...hostNames];
  }

  private normalizeKnownHostToken(hostToken: string): string | undefined {
    const trimmedToken = hostToken.trim();
    if (!trimmedToken) return undefined;
    if (trimmedToken.includes("*") || trimmedToken.includes("?")) return undefined;

    if (trimmedToken.startsWith("[")) {
      const bracketEndIndex = trimmedToken.indexOf("]");
      if (bracketEndIndex > 1) {
        return trimmedToken.slice(1, bracketEndIndex);
      }
    }

    const colonIndex = trimmedToken.indexOf(":");
    if (colonIndex > 0 && !trimmedToken.includes("::")) {
      return trimmedToken.slice(0, colonIndex);
    }

    return trimmedToken;
  }
}
