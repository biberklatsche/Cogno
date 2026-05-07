import { describe, expect, it, vi } from "vitest";
import type { ContextMenuOverlayService } from "../context-menu-overlay/context-menu-overlay.service";
import type { ContextMenuItem } from "../context-menu-overlay/context-menu-overlay.types";
import type { AppMenuService } from "./app-menu.service";
import { AppMenuButtonComponent } from "./app-menu-button.component";

describe("AppMenuButtonComponent", () => {
  it("builds the app menu and opens it for the clicked element", () => {
    const menuItems: ContextMenuItem[] = [{ label: "Preferences", action: vi.fn() }];
    const appMenuService: Pick<AppMenuService, "buildMenu"> = {
      buildMenu: vi.fn().mockReturnValue(menuItems),
    };
    const contextMenuOverlayService: Pick<ContextMenuOverlayService, "openContextForElement"> = {
      openContextForElement: vi.fn(),
    };
    const component = new AppMenuButtonComponent(
      appMenuService as AppMenuService,
      contextMenuOverlayService as ContextMenuOverlayService,
    );
    const buttonElement = document.createElement("button");
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    component.openMenu({
      currentTarget: buttonElement,
      preventDefault,
      stopPropagation,
    } as unknown as Event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(appMenuService.buildMenu).toHaveBeenCalledTimes(1);
    expect(contextMenuOverlayService.openContextForElement).toHaveBeenCalledWith(buttonElement, {
      items: menuItems,
    });
  });
});
