import { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import { describe, expect, it } from "vitest";
import { MachineShells } from "./remote-panel.service";
import { groupShells, machineNodes, RemoteTreeNode, shellName } from "./remote-shell-tree";

function shell(terminalId: string, overrides: Partial<RemoteShell> = {}): RemoteShell {
  return { terminalId, shown: true, shownHere: false, ...overrides };
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

describe("groupShells", () => {
  it("sorts shells into workspace and tab, by name", () => {
    const groups = groupShells([
      shell("t3", { workspace: "Site", tab: "dev", title: "pnpm" }),
      shell("t1", { workspace: "Cogno", tab: "build", title: "cargo" }),
      shell("t2", { workspace: "Cogno", tab: "build", title: "bash" }),
      shell("t4", { workspace: "Cogno", tab: "agent", title: "claude" }),
    ]);

    expect(groups.map((group) => group.name)).toEqual(["Cogno", "Site"]);
    expect(groups[0]?.tabs.map((tab) => tab.name)).toEqual(["agent", "build"]);
    expect(groups[0]?.tabs[1]?.shells.map((each) => each.terminalId)).toEqual(["t2", "t1"]);
  });

  it("keeps shells that said no workspace together", () => {
    const groups = groupShells([shell("t1"), shell("t2", { workspace: "Cogno" })]);

    expect(groups.map((group) => group.name)).toEqual(["Cogno", "No workspace"]);
  });

  it("leaves a shell in its workspace that nothing shows right now", () => {
    const groups = groupShells([shell("t1", { workspace: "Cogno", tab: "build", shown: false })]);

    expect(groups).toEqual([
      {
        name: "Cogno",
        tabs: [{ name: "build", shells: [expect.objectContaining({ terminalId: "t1" })] }],
      },
    ]);
  });
});

describe("machineNodes", () => {
  function host(name: string, connection: RemoteHost["connection"], failure?: string): RemoteHost {
    return { name, destination: `lars@${name}`, connection, failure };
  }

  /** The tree as nested names, to read a test by. */
  function outline(nodes: readonly RemoteTreeNode[]): unknown[] {
    return nodes.map((node) => {
      const name =
        node.kind === "machine"
          ? node.host.name
          : node.kind === "shell"
            ? node.shell.terminalId
            : node.kind === "status"
              ? `(${node.text})`
              : node.name;
      return node.children.length > 0 ? [name, outline(node.children)] : name;
    });
  }

  it("says how far each machine is before its shells are known", () => {
    const nodes = machineNodes(
      [
        host("off", "disconnected"),
        host("dialing", "connecting"),
        host("refused", "failed", "Permission denied"),
        host("asking", "connected"),
        host("empty", "connected"),
        host("silent", "connected"),
      ],
      new Map<string, MachineShells>([
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

  it("sets a machine's shells under workspace and tab, and tabless ones under the workspace", () => {
    const nodes = machineNodes(
      [host("office", "connected")],
      new Map<string, MachineShells>([
        [
          "office",
          {
            status: "loaded",
            shells: [
              shell("t1", { workspace: "Cogno", tab: "build" }),
              shell("t2", { workspace: "Cogno" }),
            ],
          },
        ],
      ]),
    );

    expect(outline(nodes)).toEqual([["office", [["Cogno", ["t2", ["build", ["t1"]]]]]]]);
    const shellNode = nodes[0]?.children[0]?.children[0];
    expect(shellNode).toMatchObject({ kind: "shell", host: "office" });
  });

  it("tells every line from every other, also the same names on two machines", () => {
    const shells: MachineShells = {
      status: "loaded",
      shells: [shell("t1", { workspace: "Cogno", tab: "Cogno" })],
    };
    const nodes = machineNodes(
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
