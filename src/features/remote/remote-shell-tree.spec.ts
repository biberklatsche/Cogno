import { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import { describe, expect, it } from "vitest";
import { HostShells, hostNodes, RemoteTreeNode, shellName } from "./remote-shell-tree";

function shell(terminalId: string, overrides: Partial<RemoteShell> = {}): RemoteShell {
  return { terminalId, shown: "elsewhere", ...overrides };
}

function host(name: string, connection: RemoteHost["connection"], failure?: string): RemoteHost {
  return { name, destination: `lars@${name}`, connection, failure };
}

/** The tree as nested names, to read a test by. */
function outline(nodes: readonly RemoteTreeNode[]): unknown[] {
  return nodes.map((node) => {
    const name =
      node.kind === "host"
        ? node.host.name
        : node.kind === "shell"
          ? node.shell.terminalId
          : node.kind === "status"
            ? `(${node.text})`
            : node.name;
    return node.children.length > 0 ? [name, outline(node.children)] : name;
  });
}

/** The tree of one connected host with these shells. */
function treeOf(...shells: RemoteShell[]): RemoteTreeNode[] {
  return hostNodes(
    [host("office", "connected")],
    new Map<string, HostShells>([["office", { status: "loaded", shells }]]),
  );
}

describe("shellName", () => {
  it("is the title, else the last folder, else the tab, else the id", () => {
    expect(shellName(shell("t1", { title: "vim", directory: "/home/lars" }))).toBe("vim");
    expect(shellName(shell("t1", { directory: "C:\\dev\\cogno\\" }))).toBe("cogno");
    expect(shellName(shell("t1", { directory: "/" }))).toBe("/");
    expect(shellName(shell("t1", { tab: "build" }))).toBe("build");
    expect(shellName(shell("t1"))).toBe("t1");
  });
});

describe("hostNodes", () => {
  it("says how far each host is before its shells are known", () => {
    const nodes = hostNodes(
      [
        host("off", "disconnected"),
        host("dialing", "connecting"),
        host("refused", "failed", "Permission denied"),
        host("asking", "connected"),
        host("empty", "connected"),
        host("silent", "connected"),
      ],
      new Map<string, HostShells>([
        ["asking", { status: "loading" }],
        ["empty", { status: "loaded", shells: [] }],
        ["silent", { status: "failed", reason: "The connection was lost" }],
      ]),
    );

    expect(outline(nodes)).toEqual([
      "off",
      ["dialing", ["(Connecting to lars@dialing...)"]],
      ["refused", ["(Permission denied)"]],
      ["asking", ["(Looking for shells...)"]],
      ["empty", ["(No shells are running.)"]],
      ["silent", ["(The connection was lost)"]],
    ]);
    expect(nodes[2]?.children[0]).toMatchObject({ kind: "status", failure: true });
    expect(nodes[3]?.children[0]).toMatchObject({ kind: "status", failure: false });
  });

  it("sorts shells into workspace and tab, each by name", () => {
    const nodes = treeOf(
      shell("t3", { workspace: "Site", tab: "dev", title: "pnpm" }),
      shell("t1", { workspace: "Cogno", tab: "build", title: "cargo" }),
      shell("t2", { workspace: "Cogno", tab: "build", title: "bash" }),
      shell("t4", { workspace: "Cogno", tab: "agent", title: "claude" }),
    );

    expect(outline(nodes)).toEqual([
      [
        "office",
        [
          [
            "Cogno",
            [
              ["agent", ["t4"]],
              ["build", ["t2", "t1"]],
            ],
          ],
          ["Site", [["dev", ["t3"]]]],
        ],
      ],
    ]);
  });

  it("names each shell and knows its host", () => {
    const shellNode = treeOf(shell("t1", { workspace: "Cogno", title: "vim" }))[0]?.children[0]
      ?.children[0];

    expect(shellNode).toMatchObject({ kind: "shell", hostName: "office", name: "vim" });
  });

  it("puts shells without a tab under their workspace, and without one under 'No workspace'", () => {
    const nodes = treeOf(
      shell("t1", { workspace: "Cogno", tab: "build" }),
      shell("t2", { workspace: "Cogno" }),
      shell("t3"),
    );

    expect(outline(nodes)).toEqual([
      [
        "office",
        [
          ["Cogno", ["t2", ["build", ["t1"]]]],
          ["No workspace", ["t3"]],
        ],
      ],
    ]);
  });

  it("leaves a shell in its workspace that nothing shows right now", () => {
    const nodes = treeOf(shell("t1", { workspace: "Cogno", tab: "build", shown: "nowhere" }));

    expect(outline(nodes)).toEqual([["office", [["Cogno", [["build", ["t1"]]]]]]]);
  });

  it("tells every line from every other, also the same names on two hosts", () => {
    const shells: HostShells = {
      status: "loaded",
      shells: [shell("t1", { workspace: "Cogno", tab: "Cogno" })],
    };
    const nodes = hostNodes(
      [host("office", "connected"), host("Cogno", "connected")],
      new Map([
        ["office", shells],
        ["Cogno", shells],
      ]),
    );

    const keys: string[] = [];
    const collect = (level: readonly RemoteTreeNode[]) => {
      for (const node of level) {
        keys.push(node.key);
        collect(node.children);
      }
    };
    collect(nodes);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(8);
  });
});
