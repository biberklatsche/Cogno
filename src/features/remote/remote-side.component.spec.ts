import { signal } from "@angular/core";
import type { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import type { Opener } from "@cogno/platform";
import type { ContextMenuItem, ContextMenuOverlayService } from "@cogno/shared/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RemotePanelService } from "./remote-panel.service";
import type { HostShells } from "./remote-shell-tree";
import { RemoteSideComponent } from "./remote-side.component";

/** The component's own decisions, without its template. */
class TestableRemoteSide extends RemoteSideComponent {
  override nextStep(host: RemoteHost) {
    return super.nextStep(host);
  }
  override onHostAction(action: "copy" | "edit" | "delete", host: RemoteHost): void {
    super.onHostAction(action, host);
  }
  override onShellAction(
    action: "copy" | "edit" | "delete",
    hostName: string,
    shell: RemoteShell,
  ): void {
    super.onShellAction(action, hostName, shell);
  }
}

function office(overrides: Partial<Omit<RemoteHost, "kind">> = {}): RemoteHost {
  return {
    kind: "ssh",
    name: "office",
    destination: "lars@office",
    connection: "connected",
    ...overrides,
  };
}

describe("RemoteSideComponent", () => {
  let panel: {
    hosts: ReturnType<typeof signal<readonly RemoteHost[]>>;
    shells: ReturnType<typeof signal<ReadonlyMap<string, HostShells>>>;
    failure: ReturnType<typeof signal<string | undefined>>;
    removeHost: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  let openMenu: ReturnType<typeof vi.fn>;
  let component: TestableRemoteSide;
  const shell: RemoteShell = { terminalId: "t1", shown: "nowhere" };

  beforeEach(() => {
    panel = {
      hosts: signal<readonly RemoteHost[]>([]),
      shells: signal<ReadonlyMap<string, HostShells>>(new Map()),
      failure: signal<string | undefined>(undefined),
      removeHost: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
    };
    openMenu = vi.fn();
    component = new TestableRemoteSide(
      panel as unknown as RemotePanelService,
      { openUrl: vi.fn() } as unknown as Opener,
      { openAtElement: openMenu } as unknown as ContextMenuOverlayService,
    );
  });

  it("offers to cancel a connection that is being set up", () => {
    expect(component.nextStep(office({ connection: "connecting" }))).toBe("cancel");
    expect(component.nextStep(office({ connection: "connected" }))).toBe("disconnect");
    expect(component.nextStep(office({ connection: "disconnected" }))).toBe("connect");
  });

  it("offers to connect again only where that can help, else to change the settings", () => {
    const failed = (worthRetrying: boolean) =>
      office({ connection: "failed", failure: { message: "No", worthRetrying } });

    expect(component.nextStep(failed(true))).toBe("connect");
    expect(component.nextStep(failed(false))).toBe("edit");
  });

  it("opens the form for a host to edit, and removes one to delete", () => {
    component.onHostAction("edit", office());
    expect(component.form()).toEqual({ kind: "host", host: office() });
    expect(panel.removeHost).not.toHaveBeenCalled();

    component.onHostAction("delete", office());
    expect(panel.removeHost).toHaveBeenCalledWith("office");
  });

  it("ends a shell only when its deletion is confirmed", () => {
    component.onShellAction("edit", "office", shell);
    expect(panel.end).not.toHaveBeenCalled();

    component.onShellAction("delete", "office", shell);
    expect(panel.end).toHaveBeenCalledWith("office", shell);
  });

  it("connects a paired machine like any remote, and offers to remove one no longer paired", () => {
    const laptop: RemoteHost = { kind: "paired", name: "laptop", connection: "disconnected" };
    expect(component.nextStep(laptop)).toBe("connect");
    expect(
      component.nextStep({
        ...laptop,
        connection: "failed",
        failure: { message: "not paired any more", worthRetrying: false },
      }),
    ).toBe("remove");
  });

  it("adds a remote by pairing with it or over ssh, as the user chooses", () => {
    component.chooseHowToAdd({ currentTarget: {} } as unknown as MouseEvent);
    const [pair, ssh] = openMenu.mock.calls[0][1].items as ContextMenuItem[];

    pair.action?.();
    expect(component.form()).toEqual({ kind: "pair" });

    ssh.action?.();
    expect(component.form()).toEqual({ kind: "host" });
  });
});
