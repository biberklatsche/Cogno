import type { PairingPort } from "@cogno/core/api/pairing-port";
import { describe, expect, it, vi } from "vitest";
import type { RemotePanelService } from "./remote-panel.service";
import { RemoteSideMenuLifecycle } from "./remote-side-menu.lifecycle";

describe("RemoteSideMenuLifecycle", () => {
  it("makes this machine reachable for paired machines only while Remote is on", () => {
    const pairing = {
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
    };
    const lifecycle = new RemoteSideMenuLifecycle(
      {} as RemotePanelService,
      pairing as unknown as PairingPort,
    ).create();

    lifecycle.onModeChange?.("on");
    expect(pairing.enable).toHaveBeenCalledOnce();
    expect(pairing.disable).not.toHaveBeenCalled();

    lifecycle.onModeChange?.("off");
    expect(pairing.disable).toHaveBeenCalledOnce();
  });
});
