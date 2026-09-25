import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { OsPlatform } from "@cogno/platform";
import type { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CodingAgentConfirmDialogService } from "./coding-agent-confirm-dialog.service";
import type { CodingAgentProviderRegistry } from "./coding-agent-provider-registry.service";
import { CodingAgentStartupService } from "./coding-agent-startup.service";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function providerDouble(id: string, options: { installed?: boolean; hook?: boolean } = {}) {
  let hook = options.hook ?? false;
  return {
    id,
    name: id.toUpperCase(),
    isAgentInstalled: vi.fn(async () => options.installed ?? true),
    isHookInstalled: vi.fn(async () => hook),
    installHook: vi.fn(async () => {
      hook = true;
    }),
    removeHook: vi.fn(async () => {
      hook = false;
    }),
    interpretHook: vi.fn(),
  };
}

describe("CodingAgentStartupService", () => {
  let confirm: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    confirm = vi.fn(async () => false);
    dispatch = vi.fn();
  });

  function start(providers: ReadonlyArray<ReturnType<typeof providerDouble>>, mode = "on") {
    return new CodingAgentStartupService(
      { providers } as unknown as CodingAgentProviderRegistry,
      { confirm } as unknown as CodingAgentConfirmDialogService,
      {
        getConfiguration: () => ({ feature: { coding_agents: { mode } } }),
      } as unknown as ApplicationConfigurationPort,
      { platform: () => "macos" } as unknown as OsPlatform,
      { dispatch } as unknown as NotificationCenterPort,
    );
  }

  const hookOf = (service: CodingAgentStartupService, id: string) =>
    service.installedProviders().find((entry) => entry.provider.id === id)?.hasHook;

  describe("scanning", () => {
    it("lists the installed agents with their hook status", async () => {
      const service = start([
        providerDouble("claude", { hook: true }),
        providerDouble("codex", { hook: false }),
        providerDouble("gemini", { installed: false }),
      ]);
      await settle();

      expect(service.installedProviders().map((entry) => entry.provider.id)).toEqual([
        "claude",
        "codex",
      ]);
      expect(hookOf(service, "claude")).toBe(true);
      expect(hookOf(service, "codex")).toBe(false);
    });

    it("does nothing while the feature is off", async () => {
      const provider = providerDouble("claude");
      start([provider], "off");
      await settle();

      expect(provider.isAgentInstalled).not.toHaveBeenCalled();
    });
  });

  describe("offering the hook after a scan", () => {
    it("asks once for every agent without a hook and installs on yes", async () => {
      confirm.mockResolvedValue(true);
      const claude = providerDouble("claude", { hook: false });
      const codex = providerDouble("codex", { hook: true });
      const service = start([claude, codex]);
      await settle();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][1]).toContain("CLAUDE");
      expect(claude.installHook).toHaveBeenCalledExactlyOnceWith("Bash");
      expect(codex.installHook).not.toHaveBeenCalled();
      expect(hookOf(service, "claude")).toBe(true);
    });

    it("remembers a no and does not ask that agent again", async () => {
      confirm.mockResolvedValue(false);
      const claude = providerDouble("claude", { hook: false });
      const service = start([claude]);
      await settle();
      expect(confirm).toHaveBeenCalledTimes(1);

      await service.rescan();
      const restarted = start([providerDouble("claude", { hook: false })]);
      await settle();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(claude.installHook).not.toHaveBeenCalled();
      expect(hookOf(restarted, "claude")).toBe(false);
    });

    it("still asks for an agent that appears later", async () => {
      confirm.mockResolvedValue(false);
      const service = start([providerDouble("claude", { hook: false })]);
      await settle();

      (service as unknown as { registry: { providers: unknown[] } }).registry.providers.push(
        providerDouble("codex", { hook: false }),
      );
      await service.rescan();

      expect(confirm).toHaveBeenCalledTimes(2);
      expect(confirm.mock.calls[1][1]).toContain("CODEX");
      expect(confirm.mock.calls[1][1]).not.toContain("CLAUDE");
    });
  });

  describe("from the panel", () => {
    it("removeHook removes it, rescans and is not offered again", async () => {
      confirm.mockResolvedValue(false);
      const claude = providerDouble("claude", { hook: true });
      const service = start([claude]);
      await settle();

      await service.removeHook(claude);

      expect(claude.removeHook).toHaveBeenCalledTimes(1);
      expect(hookOf(service, "claude")).toBe(false);
      expect(confirm).not.toHaveBeenCalled();

      const restarted = start([providerDouble("claude", { hook: false })]);
      await settle();
      expect(confirm).not.toHaveBeenCalled();
      expect(hookOf(restarted, "claude")).toBe(false);
    });

    it("installHook installs it and forgets an earlier no", async () => {
      confirm.mockResolvedValue(false);
      const claude = providerDouble("claude", { hook: false });
      const service = start([claude]);
      await settle();
      expect(confirm).toHaveBeenCalledTimes(1);

      await service.installHook(claude);
      expect(claude.installHook).toHaveBeenCalledExactlyOnceWith("Bash");
      expect(hookOf(service, "claude")).toBe(true);

      // The hook vanishes outside Cogno (the user edits settings.json): ask again.
      claude.isHookInstalled.mockResolvedValue(false);
      await service.rescan();
      expect(confirm).toHaveBeenCalledTimes(2);
    });

    it("reports a provider that fails and leaves the list intact", async () => {
      const claude = providerDouble("claude", { hook: true });
      claude.removeHook.mockRejectedValue(new Error("settings.json is read-only"));
      const service = start([claude]);
      await settle();

      await service.removeHook(claude);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          type: "error",
          body: expect.stringContaining("settings.json is read-only"),
        }),
      );
      expect(hookOf(service, "claude")).toBe(true);
    });
  });
});
