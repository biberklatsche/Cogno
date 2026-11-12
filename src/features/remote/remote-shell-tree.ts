import { RemoteShell } from "@cogno/core/api/remote-shells-port";

/** The shells of one tab, as the Cogno they belong to calls it. */
export type ShellTab = {
  readonly name: string;
  readonly shells: readonly RemoteShell[];
};

/** The tabs of one workspace - or the shells that no window shows any more. */
export type ShellGroup = {
  readonly name: string;
  /** Shells of this machine that no Cogno shows: they only take up room. */
  readonly orphaned: boolean;
  readonly tabs: readonly ShellTab[];
};

const NO_WORKSPACE = "No workspace";
const ORPHANED = "Not shown in any window";

/** What a shell is called in the tree: its title, else where it is, else its id. */
export function shellName(shell: RemoteShell): string {
  return shell.title || lastSegment(shell.directory) || shell.tab || shell.terminalId;
}

function lastSegment(directory: string | undefined): string | undefined {
  const segments = directory?.split(/[\\/]/).filter((segment) => segment !== "");
  return segments?.at(-1) ?? directory;
}

/**
 * Sorts a machine's shells into workspace, tab and shell. On this machine a
 * shell that nothing shows has no place in a workspace any more; on another
 * one that only means its Cogno is closed, and the shell stays where it was.
 */
export function groupShells(shells: readonly RemoteShell[], thisMachine: boolean): ShellGroup[] {
  const orphaned = thisMachine ? shells.filter((shell) => !shell.shown) : [];
  const placed = shells.filter((shell) => !orphaned.includes(shell));

  const workspaces = new Map<string, Map<string, RemoteShell[]>>();
  for (const shell of placed) {
    const tabs = getOrAdd(workspaces, shell.workspace ?? NO_WORKSPACE, () => new Map());
    getOrAdd(tabs, shell.tab ?? "", () => []).push(shell);
  }

  const groups: ShellGroup[] = sortedByName(workspaces).map(([name, tabs]) => ({
    name,
    orphaned: false,
    tabs: sortedByName(tabs).map(([tabName, tabShells]) => ({
      name: tabName,
      shells: sortedShells(tabShells),
    })),
  }));
  if (orphaned.length > 0) {
    groups.push({
      name: ORPHANED,
      orphaned: true,
      tabs: [{ name: "", shells: sortedShells(orphaned) }],
    });
  }
  return groups;
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
