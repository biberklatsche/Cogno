import { signal } from "@angular/core";
import type { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import type { Opener } from "@cogno/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MachineShells, RemotePanelService } from "./remote-panel.service";
import { RemoteSideComponent } from "./remote-side.component";

describe("RemoteSideComponent", () => {
  let panel: {
    hosts: ReturnType<typeof signal<readonly RemoteHost[]>>;
    shells: ReturnType<typeof signal<ReadonlyMap<string, MachineShells>>>;
    failure: ReturnType<typeof signal<string | undefined>>;
    end: ReturnType<typeof vi.fn>;
    removeHost: ReturnType<typeof vi.fn>;
  };
  let component: RemoteSideComponent;
  const shell: RemoteShell = { terminalId: "t1", shown: false, shownHere: false };

  beforeEach(() => {
    panel = {
      hosts: signal<readonly RemoteHost[]>([]),
      shells: signal<ReadonlyMap<string, MachineShells>>(new Map()),
      failure: signal<string | undefined>(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      removeHost: vi.fn().mockResolvedValue(undefined),
    };
    component = new RemoteSideComponent(
      panel as unknown as RemotePanelService,
      { openUrl: vi.fn() } as unknown as Opener,
    );
  });

  it("shows every branch at first and folds each one on its own", () => {
    expect(component.isOpen("")).toBe(true);
    expect(component.isOpen("office", "Cogno", "build")).toBe(true);

    component.toggle("office", "Cogno");

    expect(component.isOpen("office", "Cogno")).toBe(false);
    // The same workspace name on another machine, and what is around it.
    expect(component.isOpen("", "Cogno")).toBe(true);
    expect(component.isOpen("office")).toBe(true);
    expect(component.isOpen("office", "Cogno", "build")).toBe(true);

    component.toggle("office", "Cogno");
    expect(component.isOpen("office", "Cogno")).toBe(true);
  });

  it("ends a shell only on the second click", () => {
    component.end("office", shell);
    expect(panel.end).not.toHaveBeenCalled();
    expect(component.isArmed("end", "t1")).toBe(true);

    component.end("office", shell);
    expect(panel.end).toHaveBeenCalledWith("office", shell);
    expect(component.isArmed("end", "t1")).toBe(false);
  });

  it("forgets the first click once the pointer has left", () => {
    const host: RemoteHost = { name: "office", destination: "office", connection: "connected" };
    component.remove(host);
    component.disarm();

    component.remove(host);

    expect(panel.removeHost).not.toHaveBeenCalled();
  });
});
