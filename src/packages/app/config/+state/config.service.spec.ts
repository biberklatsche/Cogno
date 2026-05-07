import type { DestroyRef } from "@angular/core";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../app-bus/app-bus";
import { Config } from "../+models/config";
import { ShellConfigurator } from "../shell-configurator";
import { RealConfigService } from "./config.service";

function createService(config?: Partial<Config>): RealConfigService {
  const appBus = new AppBus();
  const destroyRef = {
    onDestroy: vi.fn(),
  } as unknown as DestroyRef;
  const shellConfigurator = {
    apply: vi.fn(),
  } as unknown as ShellConfigurator;
  const appWiringService = {
    getSettingsExtensions: vi.fn().mockReturnValue([]),
    getShellSupportDefinitions: vi.fn().mockReturnValue([]),
  } as unknown as AppWiringService;

  const service = new RealConfigService(appBus, destroyRef, shellConfigurator, appWiringService);
  if (config) {
    (service as unknown as { _config: BehaviorSubject<Config | undefined> })._config.next(
      config as Config,
    );
  }
  return service;
}

describe("RealConfigService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves shell profiles by explicit name, default and fallback order", () => {
    const service = createService({
      shell: {
        default: "zsh",
        profiles: {
          bash: {
            shell_type: "Bash",
            path: "/bin/bash",
          },
          zsh: {
            shell_type: "Zsh",
            path: "/bin/zsh",
          },
        },
      },
    });

    expect(service.getShellProfileOrDefault("bash")).toEqual({
      shell_type: "Bash",
      path: "/bin/bash",
    });
    expect(service.getShellProfileOrDefault("missing")).toEqual({
      shell_type: "Zsh",
      path: "/bin/zsh",
    });

    const fallbackService = createService({
      shell: {
        profiles: {
          fish: {
            shell_type: "Fish",
            path: "/usr/bin/fish",
          },
        },
      },
    });

    expect(fallbackService.getShellProfileOrDefault()).toEqual({
      shell_type: "Fish",
      path: "/usr/bin/fish",
    });
  });

  it("orders shell profiles predictably and supports shortcut lookup", () => {
    const service = createService({
      shell: {
        default: "zsh",
        order: ["bash", "zsh", "fish", "missing"],
        profiles: {
          fish: {
            shell_type: "Fish",
            path: "/usr/bin/fish",
          },
          bash: {
            shell_type: "Bash",
            path: "/bin/bash",
          },
          zsh: {
            shell_type: "Zsh",
            path: "/bin/zsh",
          },
        },
      },
    });

    expect(service.getOrderedShellProfiles()).toEqual([
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
      {
        name: "fish",
        profile: { shell_type: "Fish", path: "/usr/bin/fish" },
        isDefault: false,
      },
    ]);
    expect(service.getOrderedShellProfiles(2)).toHaveLength(2);
    expect(service.getShellProfileByShortcutIndex(2)?.name).toBe("bash");
    expect(service.getShellProfileByShortcutIndex(0)).toBeUndefined();
    expect(service.getShellProfileByShortcutIndex(10)).toBeUndefined();
  });

  it("returns prompt segments in active profile order", () => {
    const service = createService({
      prompt: {
        active: "default",
        profile: {
          default: {
            order: ["cwd", "git"],
          },
        },
        segment: {
          cwd: {
            background: "111111",
            foreground: "ffffff",
            label: "cwd",
            type: "cwd",
          },
          git: {
            background: "222222",
            foreground: "ffffff",
            label: "git",
            type: "git_branch",
          },
        },
      },
    });

    expect(service.getPromptSegments()).toEqual([
      {
        background: "111111",
        foreground: "ffffff",
        label: "cwd",
        type: "cwd",
      },
      {
        background: "222222",
        foreground: "ffffff",
        label: "git",
        type: "git_branch",
      },
    ]);
  });

  it("throws clear errors when config, shell or prompt data is missing", () => {
    const unloadedService = createService();
    expect(() => unloadedService.config).toThrow("Config is not loaded!");
    expect(() => unloadedService.getShellProfileOrDefault()).toThrow("Config is not loaded!");

    const shelllessService = createService({});
    expect(() => shelllessService.getShellProfileOrDefault()).toThrow(
      "No shell configuration defined!",
    );

    const profilelessService = createService({
      shell: {
        profiles: {},
      },
    });
    expect(() => profilelessService.getShellProfileOrDefault()).toThrow(
      "No shell profiles defined!",
    );

    const promptlessService = createService({});
    expect(() => promptlessService.getPromptSegments()).toThrow("No prompt configuration defined!");
  });
});
