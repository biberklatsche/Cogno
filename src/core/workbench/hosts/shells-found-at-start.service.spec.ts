import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { HostError } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TauriMockFactory } from "../../../__test__/mocks/tauri-mock.factory";
import { ShellsFoundAtStart } from "./shells-found-at-start.service";

function found(sessions: ReturnType<Hosts["sessions"]>): ShellsFoundAtStart {
  return new ShellsFoundAtStart({ sessions: vi.fn(() => sessions) } as unknown as Hosts);
}

describe("ShellsFoundAtStart", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hands each shell to the pane that shows it, once", async () => {
    const shells = found(Promise.resolve([TauriMockFactory.createSessionInfo("t1")]));
    await shells.find();

    expect(shells.claim("t1")?.terminalId).toBe("t1");
    expect(shells.claim("t1")).toBeUndefined();
  });

  it("names the shells no Cogno showed", async () => {
    const shown = {
      ...TauriMockFactory.createSessionInfo("t2"),
      attached: { to: "thisClient" as const },
    };
    const shells = found(Promise.resolve([TauriMockFactory.createSessionInfo("t1"), shown]));
    await shells.find();

    expect(shells.unshown()).toEqual(["t1"]);
  });

  it("goes on with nothing when the host does not answer", async () => {
    const reported = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => undefined);
    const shells = found(Promise.reject(new HostError("hostNotStarted", "no host")));

    await shells.find();

    expect(reported).toHaveBeenCalledOnce();
    expect(shells.unshown()).toEqual([]);
    expect(shells.claim("t1")).toBeUndefined();
  });
});
