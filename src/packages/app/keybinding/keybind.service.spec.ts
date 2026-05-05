import { BehaviorSubject } from "rxjs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OS } from "@cogno/app-tauri/os";
import { getDestroyRef } from "../../features/__test__/destroy-ref";
import { AppBus } from "../app-bus/app-bus";
import type { ConfigService } from "../config/+state/config.service";
import { TerminalFullscreenService } from "../terminal/terminal-fullscreen.service";
import { KeybindService } from "./keybind.service";
import type { KeyboardMappingService } from "./keyboard/keyboard-layout.loader";
import { TerminalKeybindingContextService } from "./terminal-keybinding-context.service";

describe("KeybindService", () => {
  const config$ = new BehaviorSubject<{ keybind: never[] }>({ keybind: [] });
  const keyboardMappingService: Pick<KeyboardMappingService, "loadLayout"> = {
    loadLayout: vi.fn().mockResolvedValue({
      keymapInfo: {
        mapping: {},
      },
    }),
  };
  const configService: Pick<ConfigService, "config$"> = {
    config$,
  };
  const bus = new AppBus();
  const terminalFullscreenService = new TerminalFullscreenService(bus);
  const terminalKeybindingContext = new TerminalKeybindingContextService(
    bus,
    terminalFullscreenService,
  );

  let service: KeybindService;

  beforeAll(() => {
    service = new KeybindService(
      keyboardMappingService as KeyboardMappingService,
      configService as ConfigService,
      bus,
      terminalKeybindingContext,
      getDestroyRef(),
    );
  });

  afterEach(() => {
    service.unregisterListener("test-listener");
    document.body.innerHTML = "";
    config$.next({ keybind: [] });
    vi.restoreAllMocks();
  });

  it("handles registered arrow key listeners outside dialogs", () => {
    const handler = vi.fn();
    service.registerListener("test-listener", ["ArrowDown"], handler);

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    const dispatchResult = window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(dispatchResult).toBe(false);
  });

  it("does not route registered arrow key listeners when the event target is inside a dialog", () => {
    const handler = vi.fn();
    service.registerListener("test-listener", ["ArrowDown"], handler);

    const dialogElement = document.createElement("app-dialog");
    const inputElement = document.createElement("input");
    dialogElement.appendChild(inputElement);
    document.body.appendChild(dialogElement);

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    const dispatchResult = inputElement.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    expect(dispatchResult).toBe(true);
  });

  it("suppresses Cogno keybindings while the focused selected terminal is in fullscreen mode", () => {
    const handler = vi.fn();
    service.registerListener("test-listener", ["ArrowDown"], handler);

    bus.publish({ path: ["app", "terminal"], type: "FocusTerminal", payload: "terminal-1" });
    bus.publish({ type: "TerminalFocused", payload: "terminal-1" });
    bus.publish({
      path: ["app", "terminal", "terminal-1"],
      type: "FullScreenAppEntered",
      payload: "terminal-1",
    });

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    const dispatchResult = window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    expect(dispatchResult).toBe(true);
  });

  it("does not route registered listeners when the event target is an editable field", () => {
    const handler = vi.fn();
    service.registerListener("test-listener", ["v"], handler);

    const inputElement = document.createElement("input");
    document.body.appendChild(inputElement);

    const event = new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatchResult = inputElement.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    expect(dispatchResult).toBe(true);
  });

  it("keeps native macOS copy/paste shortcuts in editable fields", () => {
    vi.spyOn(OS, "platform").mockReturnValue("macos");
    const handler = vi.fn();
    service.registerListener("test-listener", ["c"], handler);

    const inputElement = document.createElement("input");
    document.body.appendChild(inputElement);

    const event = new KeyboardEvent("keydown", {
      key: "c",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatchResult = inputElement.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    expect(dispatchResult).toBe(true);
  });

  it("does not treat non-editing shortcuts as native editable field shortcuts", () => {
    const inputElement = document.createElement("input");
    document.body.appendChild(inputElement);

    const event = new KeyboardEvent("keydown", {
      key: "1",
      code: "Digit1",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    inputElement.dispatchEvent(event);

    const result = (
      service as unknown as {
        shouldUseNativeEditableFieldHandling: (keyboardEvent: KeyboardEvent) => boolean;
      }
    ).shouldUseNativeEditableFieldHandling(event);

    expect(result).toBe(false);
  });
});
