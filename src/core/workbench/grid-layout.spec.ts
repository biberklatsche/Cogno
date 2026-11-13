import { describe, expect, it } from "vitest";
import { asNewLocalPane } from "./grid-layout";

describe("asNewLocalPane", () => {
  it("drops the machine and its directory of a pane of another machine", () => {
    const remote = { shellName: "zsh", workingDir: "/home/lars", terminalId: "t1", host: "office" };

    expect(asNewLocalPane(remote, "t2")).toEqual({ shellName: "zsh", terminalId: "t2" });
  });

  it("keeps the directory of a pane of this machine, and leaves the id to be made up", () => {
    const local = { shellName: "zsh", workingDir: "C:\\dev", terminalId: "t1", title: "build" };

    expect(asNewLocalPane(local)).toEqual({
      shellName: "zsh",
      workingDir: "C:\\dev",
      title: "build",
    });
  });
});
