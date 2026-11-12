import { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";

/** What is known of the shells of one host. */
export type HostShells =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly shells: readonly RemoteShell[] }
  | { readonly status: "failed"; readonly reason: string };

/**
 * A line of the panel's tree: a host, under it its workspaces, their tabs
 * and the shells - or a line that says why there is nothing to show yet.
 */
export type RemoteTreeNode = {
  readonly key: string;
  readonly children: readonly RemoteTreeNode[];
} & (
  | { readonly kind: "host"; readonly host: RemoteHost }
  | { readonly kind: "workspace" | "tab"; readonly name: string }
  | {
      readonly kind: "shell";
      readonly hostName: string;
      readonly shell: RemoteShell;
      /** What the shell is called in the tree. */
      readonly name: string;
    }
  | { readonly kind: "status"; readonly text: string; readonly failure: boolean }
);

const NO_WORKSPACE = "No workspace";

/** What a shell is called in the tree: its title, else where it is, else its id. */
export function shellName(shell: RemoteShell): string {
  return shell.title || lastSegment(shell.directory) || shell.tab || shell.terminalId;
}

function lastSegment(directory: string | undefined): string | undefined {
  const segments = directory?.split(/[\\/]/).filter((segment) => segment !== "");
  return segments?.at(-1) ?? directory;
}

/** The panel's tree: every host of the config, with what is known of its shells. */
export function hostNodes(
  hosts: readonly RemoteHost[],
  shells: ReadonlyMap<string, HostShells>,
): RemoteTreeNode[] {
  return hosts.map((host) => ({
    kind: "host",
    key: keyOf("host", host.name),
    host,
    children: underHost(host, shells.get(host.name)),
  }));
}

/** What stands under a host: its shells, or how far getting them is. */
function underHost(host: RemoteHost, shells: HostShells | undefined): RemoteTreeNode[] {
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
  return workspaceNodes(host.name, shells.shells);
}

/**
 * A host's shells under workspace and tab, the way the Cogno they belong to
 * shows them, each level sorted by name. A shell that said no tab stands
 * under its workspace directly. A shell that nothing shows right now stays
 * where it was: its Cogno is closed, or it let the shell go.
 */
function workspaceNodes(hostName: string, shells: readonly RemoteShell[]): RemoteTreeNode[] {
  const workspaces = new Map<string, Map<string, RemoteShell[]>>();
  for (const shell of shells) {
    const tabs = getOrAdd(workspaces, shell.workspace ?? NO_WORKSPACE, () => new Map());
    getOrAdd(tabs, shell.tab ?? "", () => []).push(shell);
  }
  return sortedByName(workspaces).map(([workspace, tabs]) => ({
    kind: "workspace",
    key: keyOf("workspace", hostName, workspace),
    name: workspace,
    children: sortedByName(tabs).flatMap(([tab, tabShells]): RemoteTreeNode[] =>
      tab === ""
        ? shellNodes(hostName, tabShells)
        : [
            {
              kind: "tab",
              key: keyOf("tab", hostName, workspace, tab),
              name: tab,
              children: shellNodes(hostName, tabShells),
            },
          ],
    ),
  }));
}

function shellNodes(hostName: string, shells: readonly RemoteShell[]): RemoteTreeNode[] {
  return shells
    .map((shell) => ({ shell, name: shellName(shell) }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.shell.terminalId.localeCompare(b.shell.terminalId),
    )
    .map(({ shell, name }) => ({
      kind: "shell",
      key: keyOf("shell", hostName, shell.terminalId),
      hostName,
      shell,
      name,
      children: [],
    }));
}

function status(hostName: string, text: string, failure = false): RemoteTreeNode {
  return { kind: "status", key: keyOf("status", hostName), text, failure, children: [] };
}

function keyOf(...path: string[]): string {
  return JSON.stringify(path);
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
