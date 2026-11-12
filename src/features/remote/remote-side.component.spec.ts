import { signal } from "@angular/core";
import type { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import type { Opener } from "@cogno/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RemotePanelService } from "./remote-panel.service";
import type { HostShells } from "./remote-shell-tree";
import { RemoteSideComponent } from "./remote-side.component";

describe("RemoteSideComponent", () => {
  let panel: {
    hosts: ReturnType<typeof signal<readonly RemoteHost[]>>;
    shells: ReturnType<typeof signal<ReadonlyMap<string, HostShells>>>;
    failure: ReturnType<typeof signal<string | undefined>>;
  };
  let component: RemoteSideComponent;
  const shell: RemoteShell = { terminalId: "t1", shown: "nowhere" };

  beforeEach(() => {
    panel = {
      hosts: signal<readonly RemoteHost[]>([]),
      shells: signal<ReadonlyMap<string, HostShells>>(new Map()),
      failure: signal<string | undefined>(undefined),
    };
    component = new RemoteSideComponent(
      panel as unknown as RemotePanelService,
      { openUrl: vi.fn() } as unknown as Opener,
    );
  });

  it("shows the machines of the config as a tree, with what is known of their shells", () => {
    panel.hosts.set([{ name: "office", destination: "lars@office", connection: "connected" }]);
    panel.shells.set(new Map([["office", { status: "loaded", shells: [shell] }]]));

    const [machine] = component.nodes();

    expect(machine).toMatchObject({ kind: "host", host: { name: "office" } });
    expect(component.childrenOf(machine as never)).toHaveLength(1);
    expect(component.keyOf(machine as never)).toBe(machine?.key);
  });

  it("opens the form with what a host is, and lets the user change it field by field", () => {
    component.edit({ name: "office", destination: "lars@office", connection: "connected" });
    const input = { value: "lars@office-2" } as HTMLInputElement;

    component.setField("destination", { target: input } as unknown as Event);

    expect(component.form()).toEqual({
      previousName: "office",
      name: "office",
      destination: "lars@office-2",
      command: "",
      saving: false,
      error: undefined,
    });
    expect(component.fields.map((field) => field.key)).toEqual(["name", "destination", "command"]);
  });
});
