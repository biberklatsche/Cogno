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
      /** The id of the machine the shell runs on. */
      readonly host: string;
      readonly shell: RemoteShell;
      /** What the shell is called in the tree. */
      readonly name: string;
    }
  | { readonly kind: "status"; readonly text: string; readonly failure: boolean }
);

/** What a workspace is called that a shell's Cogno did not name. */
const UNNAMED_WORKSPACE = "No workspace";

/** What a shell is called in the tree: its title, else where it is, else its id. */
export function shellName(shell: RemoteShell): string {
  return shell.title || lastSegment(shell.directory) || shell.tab || shell.terminalId;
}

function lastSegment(directory: string | undefined): string | undefined {
  const segments = directory?.split(/[\\/]/).filter((segment) => segment !== "");
  return segments?.at(-1) ?? directory;
}

/** The panel's tree: every remote, with what is known of its shells. */
export function hostNodes(
  hosts: readonly RemoteHost[],
  shells: ReadonlyMap<string, HostShells>,
): RemoteTreeNode[] {
  return hosts.map((host) => ({
    kind: "host",
    key: keyOf("host", host.id),
    host,
    children: underHost(host, shells.get(host.id)),
  }));
}

/** What stands under a host: its shells, or how far getting them is. */
function underHost(host: RemoteHost, shells: HostShells | undefined): RemoteTreeNode[] {
  switch (host.connection) {
    case "disconnected":
      return [];
    case "connecting":
      return [statusNode(host.id, `Connecting to ${host.name}...`)];
    case "failed":
      return [failureNode(host.id, host.failure?.message ?? "Could not connect.")];
  }
  if (!shells || shells.status === "loading") {
    return [statusNode(host.id, "Looking for shells...")];
  }
  if (shells.status === "failed") {
    return [failureNode(host.id, shells.reason)];
  }
  if (shells.shells.length === 0) {
    return [statusNode(host.id, "No shells are running.")];
  }
  return workspaceNodes(host.id, shells.shells);
}

/**
 * A host's shells under workspace and tab, the way the Cogno they belong to
 * shows them, each level sorted by name. A shell that said no tab stands
 * under its workspace directly. A shell that nothing shows right now stays
 * where it was: its Cogno is closed, or it let the shell go.
 */
function workspaceNodes(host: string, shells: readonly RemoteShell[]): RemoteTreeNode[] {
  const workspaces = new Map<string | undefined, Map<string | undefined, RemoteShell[]>>();
  for (const shell of shells) {
    const tabs = getOrAdd(workspaces, shell.workspace, () => new Map());
    getOrAdd(tabs, shell.tab, () => []).push(shell);
  }
  return sortedByName(workspaces, "unnamedLast").map(([workspace, tabs]) => ({
    kind: "workspace",
    key: keyOf("workspace", host, workspace),
    name: workspace ?? UNNAMED_WORKSPACE,
    children: sortedByName(tabs, "unnamedFirst").flatMap(([tab, tabShells]): RemoteTreeNode[] =>
      tab === undefined
        ? shellNodes(host, tabShells)
        : [
            {
              kind: "tab",
              key: keyOf("tab", host, workspace, tab),
              name: tab,
              children: shellNodes(host, tabShells),
            },
          ],
    ),
  }));
}

function shellNodes(host: string, shells: readonly RemoteShell[]): RemoteTreeNode[] {
  return shells
    .map((shell) => ({ shell, name: shellName(shell) }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.shell.terminalId.localeCompare(b.shell.terminalId),
    )
    .map(({ shell, name }) => ({
      kind: "shell",
      key: keyOf("shell", host, shell.terminalId),
      host,
      shell,
      name,
      children: [],
    }));
}

/** A line that says how far getting the host's shells is. */
function statusNode(host: string, text: string): RemoteTreeNode {
  return { kind: "status", key: keyOf("status", host), text, failure: false, children: [] };
}

/** A line that says why the host's shells cannot be shown. */
function failureNode(host: string, text: string): RemoteTreeNode {
  return { kind: "status", key: keyOf("status", host), text, failure: true, children: [] };
}

/** A path of names; one that is not given stays apart from every name. */
function keyOf(...path: (string | undefined)[]): string {
  return JSON.stringify(path.map((segment) => segment ?? null));
}

function getOrAdd<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

/**
 * By name. What has no name stands apart: last among workspaces (the shells
 * no workspace claims), first among the tabs of one (the shells right under
 * it).
 */
function sortedByName<V>(
  map: Map<string | undefined, V>,
  unnamed: "unnamedFirst" | "unnamedLast",
): [string | undefined, V][] {
  const unnamedOrder = unnamed === "unnamedFirst" ? -1 : 1;
  return [...map.entries()].sort(([a], [b]) => {
    if (a === b) return 0;
    if (a === undefined) return unnamedOrder;
    if (b === undefined) return -unnamedOrder;
    return a.localeCompare(b);
  });
}
