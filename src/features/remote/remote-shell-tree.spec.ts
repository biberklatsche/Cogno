import { RemoteShell } from "@cogno/core/api/remote-shells-port";
import { describe, expect, it } from "vitest";
import { groupShells, shellName } from "./remote-shell-tree";

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
