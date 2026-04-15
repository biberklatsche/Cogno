import { BehaviorSubject } from "rxjs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../features/__test__/destroy-ref";
import { AppBus } from "../app-bus/app-bus";
import type { ConfigService } from "../config/+state/config.service";
import { KeybindService } from "./keybind.service";
import type { KeyboardMappingService } from "./keyboard/keyboard-layout.loader";

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

  let service: KeybindService;

  beforeAll(() => {
    service = new KeybindService(
      keyboardMappingService as KeyboardMappingService,
      configService as ConfigService,
      bus,
      getDestroyRef(),
    );
  });

  afterEach(() => {
    service.unregisterListener("test-listener");
    document.body.innerHTML = "";
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
});
