import type { SideMenuFeatureHandleContract } from "@cogno/core-api";
import { describe, expect, it, vi } from "vitest";
import { AiChatSideMenuLifecycle } from "./ai-chat-side-menu.lifecycle";

vi.mock("../focus-side-menu-autofocus-element", () => ({
  focusSideMenuAutofocusElement: vi.fn(),
}));

describe("AiChatSideMenuLifecycle", () => {
  it("focuses on open and closes on Escape", () => {
    const sideMenuFeatureHandle: SideMenuFeatureHandleContract<string> = {
      close: vi.fn(),
      registerKeybindListener: vi.fn(),
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
    };

    const lifecycle = new AiChatSideMenuLifecycle().create(sideMenuFeatureHandle);

    lifecycle.onOpen?.();
    lifecycle.onFocus?.();

    const keybindHandler = vi.mocked(sideMenuFeatureHandle.registerKeybindListener).mock
      .calls[0]?.[1];
    expect(keybindHandler).toBeTypeOf("function");

    keybindHandler?.({ key: "Escape" } as KeyboardEvent);
    lifecycle.onBlur?.();

    expect(sideMenuFeatureHandle.close).toHaveBeenCalledTimes(1);
    expect(sideMenuFeatureHandle.unregisterKeybindListener).toHaveBeenCalledTimes(1);
  });
});
