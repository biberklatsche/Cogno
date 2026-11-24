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

  it("handles a feature's action while the feature is active, and no longer after", () => {
    const handler = vi.fn();
    const stop = handlers.handleWhileActive("open_git", handler);

    const result = bus.publish(ActionFired.create("open_git"));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.performed).toBe(true);

    stop();
    bus.publish(ActionFired.create("open_git"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("lets a feature that comes back register its action again", () => {
    handlers.handleWhileActive("open_git", () => undefined)();

    expect(() => handlers.handleWhileActive("open_git", () => undefined)).not.toThrow();
  });

  it("rejects a second handler for a feature's action as well", () => {
    handlers.handleWhileActive("open_git", () => undefined);

    expect(() => handlers.handleWhileActive("open_git", () => undefined)).toThrow(
      "Action already has a handler: open_git",
    );
  });

  it("rejects a second handler for the same action", () => {
    handlers.handle("new_tab", () => undefined);

    expect(() => handlers.handle("new_tab", () => undefined)).toThrow(
      "Action already has a handler: new_tab",
    );
  });
});
