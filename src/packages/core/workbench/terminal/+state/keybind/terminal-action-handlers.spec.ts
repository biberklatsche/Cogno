import { DestroyRef } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import type { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAppBus } from "../../../../../__test__/test-factory";
import { TerminalActionHandlers } from "./terminal-action-handlers";

const destroyRefStub = { onDestroy: vi.fn() } as unknown as DestroyRef;
const performableCopy = { broadcast: false, unconsumed: false, performable: true, always: true };

describe("TerminalActionHandlers", () => {
  let bus: AppBus;
  let focusedTerminalId: string | undefined;
  let hasSelection: boolean;
  let publishSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    bus = getAppBus();
    focusedTerminalId = "t1";
    hasSelection = true;
    const gridList = {
      getFocusedTerminalId: () => focusedTerminalId,
    } as unknown as GridListService;
    const registry = {
      get: () => ({ host: { hasSelection } }),
    } as unknown as TerminalSessionRegistry;
    new TerminalActionHandlers(new ActionHandlers(bus, destroyRefStub), bus, gridList, registry);
    publishSpy = vi.spyOn(bus, "publish");
  });

  it("publishes a pane command onto the focused terminal", () => {
    bus.publish(ActionFired.create("split_right"));

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SplitPaneRight", payload: "t1", path: ["app", "terminal"] }),
    );
  });

  it("does not perform when there is no focused terminal", () => {
    focusedTerminalId = undefined;

    const result = bus.publish(ActionFired.create("split_right"));

    expect(result.performed).toBe(false);
  });

  it("copies when a performable trigger has a selection", () => {
    const result = bus.publish(ActionFired.create("copy", performableCopy));

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Copy", payload: "t1" }),
    );
    expect(result.performed).toBe(true);
  });

  it("falls through when a performable copy has no selection", () => {
    hasSelection = false;

    const result = bus.publish(ActionFired.create("copy", performableCopy));

    expect(publishSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "Copy" }));
    expect(result.performed).toBe(false);
  });
});
