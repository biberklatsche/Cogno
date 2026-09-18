import type { ActionDispatcher } from "@cogno/shared/ports";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionNameRegistry } from "./action-name-registry";
import { ActionRunner } from "./action-runner";

describe("ActionRunner", () => {
  let registry: ActionNameRegistry;
  let isActionActive: ReturnType<typeof vi.fn>;
  let dispatchAction: ReturnType<typeof vi.fn>;
  let runner: ActionRunner;

  beforeEach(() => {
    registry = new ActionNameRegistry();
    registry.register(["open_git"]);
    isActionActive = vi.fn().mockReturnValue(false);
    dispatchAction = vi.fn();
    runner = new ActionRunner(
      registry,
      { isActionActive } as never,
      { dispatchAction } as unknown as ActionDispatcher,
    );
  });

  it("dispatches a core action (always available)", () => {
    expect(runner.run("new_tab")).toBe("dispatched");
    expect(dispatchAction).toHaveBeenCalledWith({ actionName: "new_tab", args: undefined });
  });

  it("reports an unknown action and does not dispatch", () => {
    expect(runner.run("does_not_exist")).toBe("unknown");
    expect(dispatchAction).not.toHaveBeenCalled();
  });

  it("reports a feature action whose feature is off as inactive", () => {
    isActionActive.mockReturnValue(false);
    expect(runner.run("open_git")).toBe("inactive");
    expect(dispatchAction).not.toHaveBeenCalled();
  });

  it("dispatches a feature action whose feature is active", () => {
    isActionActive.mockReturnValue(true);
    expect(runner.run("open_git", ["arg"])).toBe("dispatched");
    expect(dispatchAction).toHaveBeenCalledWith({ actionName: "open_git", args: ["arg"] });
  });
});
