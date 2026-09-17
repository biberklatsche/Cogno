import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "./app-bus";
import { AppMessage } from "./messages";

describe("AppBus", () => {
  let bus: AppBus;

  beforeEach(() => {
    bus = new AppBus();
  });

  it("delivers a message to the subscribers of its type, and only to them", () => {
    const focused = vi.fn();
    const blurred = vi.fn();
    bus.on$("FocusTerminal").subscribe(focused);
    bus.on$("BlurTerminal").subscribe(blurred);

    const message: AppMessage = { type: "FocusTerminal", payload: "term-1" };
    bus.publish(message);

    expect(focused).toHaveBeenCalledExactlyOnceWith(message);
    expect(blurred).not.toHaveBeenCalled();
  });

  it("delivers exactly once per subscriber, synchronously and in subscription order", () => {
    const order: string[] = [];
    bus.on$("FocusTerminal").subscribe(() => order.push("first"));
    bus.on$("FocusTerminal").subscribe(() => order.push("second"));

    bus.publish({ type: "FocusTerminal", payload: "term-1" });

    expect(order).toEqual(["first", "second"]);
  });

  it("subscribes to several types at once", () => {
    const received: string[] = [];
    bus.on$(["FocusTerminal", "BlurTerminal"]).subscribe((message) => received.push(message.type));

    bus.publish({ type: "FocusTerminal", payload: "term-1" });
    bus.publish({ type: "BlurTerminal", payload: "term-1" });
    bus.publish({ type: "TerminalRemoved", payload: "term-1" });

    expect(received).toEqual(["FocusTerminal", "BlurTerminal"]);
  });

  it("does not replay earlier messages to a late subscriber", () => {
    bus.publish({ type: "FocusTerminal", payload: "term-1" });
    const late = vi.fn();

    bus.on$("FocusTerminal").subscribe(late);

    expect(late).not.toHaveBeenCalled();
  });

  it("once$ takes the next message of the type and completes", () => {
    const next = vi.fn();
    const complete = vi.fn();
    bus.once$("ConfigLoaded").subscribe({ next, complete });

    bus.publish({ type: "ConfigLoaded" });
    bus.publish({ type: "ConfigLoaded" });

    expect(next).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  describe("publish reports what the subscribers made of the message", () => {
    it("performed and defaultPrevented as a subscriber set them", () => {
      bus.on$("ActionFired").subscribe((message) => {
        message.performed = true;
        message.defaultPrevented = true;
      });

      const result = bus.publish({ type: "ActionFired", payload: "copy" });

      expect(result).toEqual({ performed: true, defaultPrevented: true });
    });

    it("nothing performed and nothing prevented when nobody listens", () => {
      const result = bus.publish({ type: "ActionFired", payload: "copy" });

      expect(result).toEqual({ performed: undefined, defaultPrevented: false });
    });
  });
});
