import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DestroyRef } from "@angular/core";
import { CliConfigOverrides } from "@cogno/platform/cli-config-overrides";
import { DefaultConfig } from "@cogno/platform/default-config";
import { Fs } from "@cogno/platform/fs";
import { OsPlatform } from "@cogno/platform/os";
import { Paths } from "@cogno/platform/path";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Environment } from "../environment/environment";
import { ErrorReporter } from "../error/error-reporter";
import { RealConfigService } from "./config.service";
import { Config } from "./models/config";
import { PromptConfig } from "./models/prompt-config";
import { ShellConfig } from "./models/shell-config";

function createService(config?: Partial<Config>): RealConfigService {
  const destroyRef = {
    onDestroy: vi.fn(),
  } as unknown as DestroyRef;

  const service = new RealConfigService(
    {} as unknown as DefaultConfig,
    {} as unknown as CliConfigOverrides,
    destroyRef,
    {} as unknown as OsPlatform,
    {} as unknown as Paths,
    {} as unknown as Environment,
    {} as unknown as Fs,
  );
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
      } as unknown as ShellConfig,
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
            shell_type: "ZSH",
            path: "/usr/bin/fish",
          },
        },
      } as unknown as ShellConfig,
    });

    expect(fallbackService.getShellProfileOrDefault()).toEqual({
      shell_type: "ZSH",
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
            shell_type: "ZSH",
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
      } as unknown as ShellConfig,
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
        profile: { shell_type: "ZSH", path: "/usr/bin/fish" },
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
      } as unknown as PromptConfig,
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
      } as unknown as ShellConfig,
    });
    expect(() => profilelessService.getShellProfileOrDefault()).toThrow(
      "No shell profiles defined!",
    );

    const promptlessService = createService({});
    expect(() => promptlessService.getPromptSegments()).toThrow("No prompt configuration defined!");
  });
});

describe("RealConfigService hot reload", () => {
  it("keeps watching after a reload fails, and picks up the next change", async () => {
    const defaults = readFileSync(
      join(process.cwd(), "src-tauri", "src", "default_windows.config"),
      "utf-8",
    );
    const changes = new Subject<void>();
    let userConfig = "cursor.blink = false\n";
    const fs = {
      exists: vi.fn().mockResolvedValue(true),
      mkdir: vi.fn(),
      readTextFile: vi.fn(async () => userConfig),
      writeTextFile: vi.fn(),
      watchChanges$: vi.fn(() => changes.asObservable()),
    } as unknown as Fs;
    const service = new RealConfigService(
      { read: async () => defaults } as unknown as DefaultConfig,
      { getSerializedOverrides: async () => "" } as unknown as CliConfigOverrides,
      { onDestroy: vi.fn() } as unknown as DestroyRef,
      { platform: () => "linux" } as unknown as OsPlatform,
      { dirname: async () => "/config" } as unknown as Paths,
      {
        configDir: () => "/config",
        configFilePath: () => "/config/cogno.config",
      } as unknown as Environment,
      fs,
    );
    const report = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => {});
    await service.load({ settingsExtensions: [] });
    expect(service.config.cursor?.blink).toBe(false);

    vi.mocked(fs.readTextFile).mockRejectedValueOnce(new Error("file is locked"));
    changes.next();
    await vi.waitFor(() => expect(report).toHaveBeenCalledTimes(1));

    userConfig = "cursor.blink = true\n";
    changes.next();
    await vi.waitFor(() => expect(service.config.cursor?.blink).toBe(true));
  });

  describe("update", () => {
    function createLoadedService(userConfig: { text: string }) {
      const defaults = readFileSync(
        join(process.cwd(), "src-tauri", "src", "default_windows.config"),
        "utf-8",
      );
      const fs = {
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn(),
        readTextFile: vi.fn(async () => userConfig.text),
        writeTextFile: vi.fn(async (_path: string, text: string) => {
          userConfig.text = text;
        }),
        watchChanges$: vi.fn(() => new Subject<void>().asObservable()),
      } as unknown as Fs;
      const service = new RealConfigService(
        { read: async () => defaults } as unknown as DefaultConfig,
        { getSerializedOverrides: async () => "" } as unknown as CliConfigOverrides,
        { onDestroy: vi.fn() } as unknown as DestroyRef,
        { platform: () => "linux" } as unknown as OsPlatform,
        { dirname: async () => "/config" } as unknown as Paths,
        {
          configDir: () => "/config",
          configFilePath: () => "/config/cogno.config",
        } as unknown as Environment,
        fs,
      );
      return { service, fs };
    }

    it("writes the entries into the file and reads them back", async () => {
      const userConfig = { text: "# mine\ncursor.blink = false\n" };
      const { service, fs } = createLoadedService(userConfig);
      await service.load({ settingsExtensions: [] });

      await service.update({
        "cursor.blink": true,
        "notification.channel.os.enabled": true,
      });

      expect(userConfig.text).toBe(
        "# mine\ncursor.blink = true\nnotification.channel.os.enabled = true\n",
      );
      expect(service.config.cursor?.blink).toBe(true);
      expect(service.config.notification?.channel?.os?.enabled).toBe(true);
      expect(fs.writeTextFile).toHaveBeenCalledTimes(1);
    });

    it("refuses an unknown key and writes nothing", async () => {
      const userConfig = { text: "cursor.blink = false\n" };
      const { service, fs } = createLoadedService(userConfig);
      await service.load({ settingsExtensions: [] });

      await expect(service.update({ "cursor.blink": true, "cursor.nope": true })).rejects.toThrow(
        "Unknown config key: cursor.nope",
      );

      expect(fs.writeTextFile).not.toHaveBeenCalled();
      expect(service.config.cursor?.blink).toBe(false);
    });

    it("refuses a value of the wrong type and writes nothing", async () => {
      const userConfig = { text: "" };
      const { service, fs } = createLoadedService(userConfig);
      await service.load({ settingsExtensions: [] });

      await expect(service.update({ "cursor.blink": "maybe" })).rejects.toThrow(
        "Invalid value for cursor.blink",
      );

      expect(fs.writeTextFile).not.toHaveBeenCalled();
    });

    it("removes a key when its value is undefined and tells which keys the file sets", async () => {
      const userConfig = { text: "cursor.blink = false\nterminal.webgl = false\n" };
      const { service } = createLoadedService(userConfig);
      await service.load({ settingsExtensions: [] });
      let userKeys: ReadonlySet<string> = new Set();
      service.userKeys$.subscribe((keys) => (userKeys = keys));
      expect([...userKeys]).toEqual(["cursor.blink", "terminal.webgl"]);

      await service.update({ "cursor.blink": undefined });

      expect(userConfig.text).toBe("terminal.webgl = false\n");
      expect([...userKeys]).toEqual(["terminal.webgl"]);
      expect(service.config.cursor?.blink).toBe(true);
      expect(service.schema.shape["cursor"]).toBeDefined();
    });

    it("renders a list the way the file spells it", async () => {
      const userConfig = { text: "cursor.blink = false\n" };
      const { service } = createLoadedService(userConfig);
      await service.load({ settingsExtensions: [] });

      await service.update({ "terminal.history.allowed_return_codes": [0, 1] });

      expect(userConfig.text).toBe(
        "cursor.blink = false\nterminal.history.allowed_return_codes = [0,1]\n",
      );
      expect(service.config.terminal?.history?.allowed_return_codes).toEqual([0, 1]);
    });
  });
});
