import { Fs } from "@cogno/app-tauri/fs";
import { Path } from "@cogno/app-tauri/path";
import { BackendOsContract, ShellTypeContract } from "@cogno/core-api";

export type ShellHistoryEntry = {
  command: string;
  timestamp: number;
};

async function resolveHistoryFilePath(
  shellType: ShellTypeContract,
  backendOs: BackendOsContract,
  homeDir: string,
): Promise<string | null> {
  switch (shellType) {
    case "Bash":
    case "GitBash":
      return Path.join(homeDir, ".bash_history");
    case "ZSH":
      return Path.join(homeDir, ".zsh_history");
    case "PowerShell":
      if (backendOs === "windows") {
        return Path.join(
          homeDir,
          "AppData",
          "Roaming",
          "Microsoft",
          "Windows",
          "PowerShell",
          "PSReadLine",
          "ConsoleHost_history.txt",
        );
      }
      return Path.join(
        homeDir,
        ".local",
        "share",
        "powershell",
        "PSReadLine",
        "ConsoleHost_history.txt",
      );
    case "Fish":
      return null;
  }
}

export function parseBashHistory(content: string): ShellHistoryEntry[] {
  const now = Date.now();
  const lines = content.split("\n");
  const entries: ShellHistoryEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const command = lines[i].trim();
    if (command) {
      entries.push({ command, timestamp: now - (lines.length - i) });
    }
  }
  return entries;
}

export function parseZshHistory(content: string): ShellHistoryEntry[] {
  // Extended format:  ": <unix_seconds>:<elapsed>;<command>"
  // Simple format:    "<command>"
  const now = Date.now();
  const entries: ShellHistoryEntry[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const extended = line.match(/^:\s*(\d+):\d+;(.+)$/);
    if (extended) {
      entries.push({ command: extended[2], timestamp: Number(extended[1]) * 1000 });
    } else {
      entries.push({ command: line, timestamp: now - (lines.length - i) });
    }
  }
  return entries;
}

export const ShellHistoryReader = {
  async read(
    shellType: ShellTypeContract,
    backendOs: BackendOsContract,
    homeDir: string,
  ): Promise<ShellHistoryEntry[]> {
    const filePath = await resolveHistoryFilePath(shellType, backendOs, homeDir);
    if (!filePath) return [];

    const exists = await Fs.exists(filePath);
    if (!exists) return [];

    const content = await Fs.readTextFile(filePath);

    switch (shellType) {
      case "ZSH":
        return parseZshHistory(content);
      case "Bash":
      case "GitBash":
      case "PowerShell":
        return parseBashHistory(content);
      case "Fish":
        return [];
    }
  },
};
