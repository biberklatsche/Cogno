import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { OsPlatform } from "@cogno/platform/os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppMenuService } from "./app-menu.service";

const osStub = { platform: () => "linux" } as unknown as OsPlatform;

describe("AppMenuService", () => {
  let appBus: AppBus;
  let keybindService: KeybindService;
  let configService: ConfigService;
  let service: AppMenuService;

  beforeEach(() => {
    appBus = new AppBus();
    keybindService = {
      getActionDefinition: vi.fn().mockImplementation((actionName: string) => ({
        actionName,
      })),
      getKeybinding: vi.fn().mockReturnValue(undefined),
    } as unknown as KeybindService;
    configService = {
      get config() {
        return {} as never;
      },
      get config$(): never {
        throw new Error("not implemented");
      },
      get diagnostics$(): never {
        throw new Error("not implemented");
      },
      get loaded$(): never {
        throw new Error("not implemented");
      },
      load: () => Promise.resolve(),
      reload: () => Promise.resolve(),
      getShellProfileOrDefault: vi.fn(),
      getOrderedShellProfiles: vi.fn().mockReturnValue([
        {
          name: "zsh",
          profile: { shell_type: "Zsh", path: "/bin/zsh" },
          isDefault: true,
        },
        {
          name: "bash",
          profile: { shell_type: "Bash", path: "/bin/bash" },
          isDefault: false,
        },
      ]),
      getShellProfileByShortcutIndex: vi.fn(),
      getPromptSegments: vi.fn(),
    };
    service = new AppMenuService(osStub, appBus, keybindService, configService);
  });

  it("builds terminal items, separator and default actions", () => {
    const menu = service.buildMenu();

    expect(menu).toHaveLength(8);
    expect(menu[0]).toEqual(expect.objectContaining({ label: "zsh" }));
    expect(menu[1]).toEqual(expect.objectContaining({ label: "bash" }));
    expect(menu[2]).toEqual({ separator: true });
    expect(menu[3]).toEqual(expect.objectContaining({ label: "New Window" }));
    expect(menu[4]).toEqual(expect.objectContaining({ label: "Settings" }));
    expect(menu[5]).toEqual({ separator: true });
    expect(menu[6]).toEqual(expect.objectContaining({ label: "Documentation" }));
    expect(menu[7]).toEqual(expect.objectContaining({ label: "About Cogno" }));
  });

  it("publishes direct shell actions and action-definition-based items", () => {
    const publishSpy = vi.spyOn(appBus, "publish");
    const menu = service.buildMenu();

    menu[0]?.action?.();
    menu[3]?.action?.();

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining(ActionFired.create("open_shell_1")),
    );
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining(
        ActionFired.createFromDefinition({ actionName: "new_window" } as never),
      ),
    );
  });

  it("omits the shell separator when no shell profiles exist", () => {
    vi.mocked(configService.getOrderedShellProfiles).mockReturnValue([]);

    const menu = service.buildMenu();

    expect(menu).toHaveLength(5);
    expect(menu[0]).toEqual(expect.objectContaining({ label: "New Window" }));
    expect(menu[1]).toEqual(expect.objectContaining({ label: "Settings" }));
    expect(menu[2]).toEqual({ separator: true });
    expect(menu[3]).toEqual(expect.objectContaining({ label: "Documentation" }));
    expect(menu[4]).toEqual(expect.objectContaining({ label: "About Cogno" }));
  });

  it("throws when a standard menu item lacks an action definition", () => {
    vi.mocked(keybindService.getActionDefinition).mockReturnValue(undefined as never);

    const menu = service.buildMenu();

    expect(() => menu[3]?.action?.()).toThrow("Action definition new_window not found.");
  });
});
