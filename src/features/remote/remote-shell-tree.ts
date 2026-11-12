import { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import { MachineShells } from "./remote-panel.service";

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

/**
 * A line of the panel's tree: a machine, under it its workspaces, their tabs
 * and the shells - or a line that says why there is nothing to show yet.
 */
export type RemoteTreeNode = {
  readonly key: string;
  readonly children: readonly RemoteTreeNode[];
} & (
  | { readonly kind: "machine"; readonly host: RemoteHost }
  | { readonly kind: "workspace" | "tab"; readonly name: string }
  | { readonly kind: "shell"; readonly host: string; readonly shell: RemoteShell }
  | { readonly kind: "status"; readonly text: string; readonly failure: boolean }
);

function keyOf(...path: string[]): string {
  return JSON.stringify(path);
}

function status(host: string, text: string, failure = false): RemoteTreeNode {
  return { kind: "status", key: keyOf("status", host), text, failure, children: [] };
}

function shellNodes(host: string, shells: readonly RemoteShell[]): RemoteTreeNode[] {
  return shells.map((shell) => ({
    kind: "shell",
    key: keyOf("shell", host, shell.terminalId),
    host,
    shell,
    children: [],
  }));
}

/** What stands under a machine: its shells, or how far getting them is. */
function underMachine(host: RemoteHost, shells: MachineShells | undefined): RemoteTreeNode[] {
  switch (host.connection) {
    case "disconnected":
      return [];
    case "connecting":
      return [status(host.name, `Connecting to ${host.destination}...`)];
    case "failed":
      return [status(host.name, host.failure ?? "Could not connect.", true)];
  }
  if (!shells || shells.status === "loading") {
    return [status(host.name, "Looking for shells...")];
  }
  if (shells.status === "failed") {
    return [status(host.name, shells.reason, true)];
  }
  if (shells.shells.length === 0) {
    return [status(host.name, "No shells are running.")];
  }
  return groupShells(shells.shells).map((group) => ({
    kind: "workspace",
    key: keyOf("workspace", host.name, group.name),
    name: group.name,
    // Shells that said no tab stand under their workspace directly.
    children: group.tabs.flatMap((tab): RemoteTreeNode[] =>
      tab.name === ""
        ? shellNodes(host.name, tab.shells)
        : [
            {
              kind: "tab",
              key: keyOf("tab", host.name, group.name, tab.name),
              name: tab.name,
              children: shellNodes(host.name, tab.shells),
            },
          ],
    ),
  }));
}

/** The panel's tree: every machine of the config, with what is known of its shells. */
export function machineNodes(
  hosts: readonly RemoteHost[],
  shells: ReadonlyMap<string, MachineShells>,
): RemoteTreeNode[] {
  return hosts.map((host) => ({
    kind: "machine",
    key: keyOf("machine", host.name),
    host,
    children: underMachine(host, shells.get(host.name)),
  }));
}
