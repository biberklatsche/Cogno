import { beforeEach, describe, expect, it, vi } from "vitest";
import { clear, getAppBus } from "../../../../__test__/test-factory";
import { AppBus } from "../../../app-bus/app-bus";
import { KeybindExecutor, KeybindExecutorSession } from "./keybind.executor";

type SessionStub = { -readonly [K in keyof KeybindExecutorSession]: KeybindExecutorSession[K] };

function sessionStub(terminalId: string, isFocused: boolean): SessionStub {
  return { terminalId, isFocused, hasSelection: true };
}

describe("KeybindExecutor", () => {
  let executor: KeybindExecutor;
  let mockBus: AppBus;
  let terminalStateManager: SessionStub;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    clear();
    mockBus = getAppBus();

    terminalStateManager = sessionStub(terminalId, true);

    executor = new KeybindExecutor(mockBus, terminalStateManager);
  });

  it("should publish SplitPaneRight when split_right action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "split_right",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SplitPaneRight",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish SplitPaneLeft when split_left action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "split_left",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SplitPaneLeft",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish SplitPaneDown when split_down action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "split_down",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SplitPaneDown",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish SplitPaneUp when split_up action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "split_up",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SplitPaneUp",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish SelectNextPane when select_next_pane action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "select_next_pane",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SelectNextPane",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish SelectPreviousPane when select_previous_pane action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "select_previous_pane",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SelectPreviousPane",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish Copy when copy action is fired and has selection", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "copy",
      performed: false,
      trigger: { performable: true },
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Copy",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should NOT publish Copy when copy action is fired but NO selection", async () => {
    terminalStateManager.hasSelection = false;
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "copy",
      performed: false,
      trigger: { performable: true },
    };

    mockBus.publish(event);

    // check that Copy was not published (except the original event)
    const copyPublish = publishSpy.mock.calls.find((call) => call[0].type === "Copy");
    expect(copyPublish).toBeUndefined();
    expect(event.performed).toBe(false);
  });

  it("should publish Paste when paste action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "paste",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Paste",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish ClearBuffer when clear_buffer action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "clear_buffer",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ClearBuffer",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should publish RemovePane when close_terminal action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "close_terminal",
      performed: false,
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RemovePane",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should maximize pane when maximize_pane action is fired and pane is not maximized", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "maximize_pane",
      performed: false,
      trigger: { performable: true },
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "MaximizePane",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should request pane toggle when maximize_pane action is fired and pane is already maximized", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "maximize_pane",
      performed: false,
      trigger: { performable: true },
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "MaximizePane",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should request pane toggle when minimize_pane action is fired", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "minimize_pane",
      performed: false,
      trigger: { performable: true },
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "MaximizePane",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should ignore events if terminal has no focus", async () => {
    terminalStateManager.isFocused = false;
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "split_right",
      performed: false,
    };

    mockBus.publish(event);

    const splitPublish = publishSpy.mock.calls.find((call) => call[0].type === "SplitPaneRight");
    expect(splitPublish).toBeUndefined();
    expect(event.performed).toBe(false);
  });

  it("should NOT ignore events if trigger.broadcast is true even without focus", async () => {
    terminalStateManager.isFocused = false;
    const publishSpy = vi.spyOn(mockBus, "publish");
    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "split_right",
      performed: false,
      trigger: { broadcast: true },
    };

    mockBus.publish(event);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SplitPaneRight",
        payload: terminalId,
        path: ["app", "terminal"],
      }),
    );
    expect(event.performed).toBe(true);
  });

  it("should stop listening after dispose", async () => {
    const publishSpy = vi.spyOn(mockBus, "publish");
    executor.dispose();

    const event: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "split_right",
      performed: false,
    };

    mockBus.publish(event);

    const splitPublish = publishSpy.mock.calls.find((call) => call[0].type === "SplitPaneRight");
    expect(splitPublish).toBeUndefined();
    expect(event.performed).toBe(false);
  });

  it("should handle ActionFired only once even if focus changes during handling", async () => {
    const bus = new AppBus();
    const firstTerminalStateManager = sessionStub("terminal-1", true);
    const secondTerminalStateManager = sessionStub("terminal-2", false);

    const firstExecutor = new KeybindExecutor(bus, firstTerminalStateManager);
    const secondExecutor = new KeybindExecutor(bus, secondTerminalStateManager);

    const selectNextPanePayloads: string[] = [];
    bus.on$({ path: ["app", "terminal"], type: "SelectNextPane" }).subscribe((event) => {
      if (!event.payload) return;
      selectNextPanePayloads.push(event.payload);
      if (event.payload === "terminal-1") {
        bus.publish({ type: "FocusTerminal", payload: "terminal-2", path: ["app", "terminal"] });
      }
    });

    const actionFiredEvent: any = {
      path: ["app", "action"],
      type: "ActionFired",
      payload: "select_next_pane",
      performed: false,
    };
    bus.publish(actionFiredEvent);

    expect(selectNextPanePayloads).toEqual(["terminal-1"]);

    firstExecutor.dispose();
    secondExecutor.dispose();
  });
});
