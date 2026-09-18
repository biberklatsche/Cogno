import { DestroyRef } from "@angular/core";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAppBus } from "../../../__test__/test-factory";
import { ActionHandlers } from "./action-handlers";

const destroyRefStub = { onDestroy: vi.fn() } as unknown as DestroyRef;

describe("ActionHandlers", () => {
  let bus: AppBus;
  let handlers: ActionHandlers;

  beforeEach(() => {
    bus = getAppBus();
    handlers = new ActionHandlers(bus, destroyRefStub);
  });

  it("routes a fired action to its handler with context", () => {
    const handler = vi.fn();
    handlers.handle("new_tab", handler);

    bus.publish(ActionFired.create("new_tab", undefined, ["profile"]));

    expect(handler).toHaveBeenCalledWith({ args: ["profile"], terminalId: undefined });
  });

  it("marks a handled action performed and consumed", () => {
    handlers.handle("new_tab", () => undefined);

    const result = bus.publish(ActionFired.create("new_tab"));

    expect(result.performed).toBe(true);
    expect(result.defaultPrevented).toBe(true);
  });

  it("leaves an action unperformed when the handler returns false", () => {
    handlers.handle("copy", () => false);

    const result = bus.publish(ActionFired.create("copy"));

    expect(result.performed).toBe(false);
    expect(result.defaultPrevented).toBe(false);
  });

  it("ignores actions with no registered handler", () => {
    const result = bus.publish(ActionFired.create("paste"));

    expect(result.performed).toBeUndefined();
  });

  it("rejects a second handler for the same action", () => {
    handlers.handle("new_tab", () => undefined);

    expect(() => handlers.handle("new_tab", () => undefined)).toThrow(
      "Action already has a handler: new_tab",
    );
  });
});
