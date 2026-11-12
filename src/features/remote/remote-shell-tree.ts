import { RemoteShell } from "@cogno/core/api/remote-shells-port";

/** The shells of one tab, as the Cogno they belong to calls it. */
export type ShellTab = {
  readonly name: string;
  readonly shells: readonly RemoteShell[];
};

/** The tabs of one workspace. */
export type ShellGroup = {
  readonly name: string;
  readonly tabs: readonly ShellTab[];
};

const NO_WORKSPACE = "No workspace";

/** What a shell is called in the tree: its title, else where it is, else its id. */
export function shellName(shell: RemoteShell): string {
  return shell.title || lastSegment(shell.directory) || shell.tab || shell.terminalId;
}

function lastSegment(directory: string | undefined): string | undefined {
  const segments = directory?.split(/[\\/]/).filter((segment) => segment !== "");
  return segments?.at(-1) ?? directory;
}

/**
 * Sorts a machine's shells into workspace, tab and shell, the way the Cogno
 * they belong to shows them. A shell that nothing shows right now stays where
 * it was: its Cogno is closed, or it let the shell go.
 */
export function groupShells(shells: readonly RemoteShell[]): ShellGroup[] {
  const workspaces = new Map<string, Map<string, RemoteShell[]>>();
  for (const shell of shells) {
    const tabs = getOrAdd(workspaces, shell.workspace ?? NO_WORKSPACE, () => new Map());
    getOrAdd(tabs, shell.tab ?? "", () => []).push(shell);
  }
  return sortedByName(workspaces).map(([name, tabs]) => ({
    name,
    tabs: sortedByName(tabs).map(([tabName, tabShells]) => ({
      name: tabName,
      shells: sortedShells(tabShells),
    })),
  }));
}

function getOrAdd<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

function sortedByName<V>(map: Map<string, V>): [string, V][] {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function sortedShells(shells: readonly RemoteShell[]): RemoteShell[] {
  return [...shells].sort(
    (a, b) => shellName(a).localeCompare(shellName(b)) || a.terminalId.localeCompare(b.terminalId),
  );
}
