import type { PairingPort } from "@cogno/core/api/pairing-port";
import { describe, expect, it, vi } from "vitest";
import type { RemotePairingRequestPrompt } from "./remote-pairing-request.prompt";
import type { RemotePanelService } from "./remote-panel.service";
import { RemoteSideMenuLifecycle } from "./remote-side-menu.lifecycle";

describe("RemoteSideMenuLifecycle", () => {
  it("makes this machine reachable for paired machines only while Remote is on", () => {
    const pairing = {
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
    };
    const listen = vi.fn();
    const stop = vi.fn();
    const lifecycle = new RemoteSideMenuLifecycle(
      {} as RemotePanelService,
      pairing as unknown as PairingPort,
      { listen, stop } as unknown as RemotePairingRequestPrompt,
    ).create();
    expect(listen).not.toHaveBeenCalled();

    lifecycle.onModeChange?.("on");
    expect(pairing.enable).toHaveBeenCalledOnce();
    expect(pairing.disable).not.toHaveBeenCalled();
    // Another machine may ask to pair with this one, while Remote is on.
    expect(listen).toHaveBeenCalledOnce();

    lifecycle.onModeChange?.("off");
    expect(pairing.disable).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });
});
