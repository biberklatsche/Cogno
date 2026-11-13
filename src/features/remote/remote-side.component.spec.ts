import { signal } from "@angular/core";
import type { RemoteHost, RemoteShell } from "@cogno/core/api/remote-shells-port";
import type { Opener } from "@cogno/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RemotePanelService } from "./remote-panel.service";
import type { HostShells } from "./remote-shell-tree";
import { RemoteSideComponent } from "./remote-side.component";

const DEFAULT_COMMAND = '".cogno/bin/cogno" server --stdio';

describe("RemoteSideComponent", () => {
  let panel: {
    hosts: ReturnType<typeof signal<readonly RemoteHost[]>>;
    shells: ReturnType<typeof signal<ReadonlyMap<string, HostShells>>>;
    failure: ReturnType<typeof signal<string | undefined>>;
    saveHost: ReturnType<typeof vi.fn>;
    defaultCommand: ReturnType<typeof vi.fn>;
  };
  let component: RemoteSideComponent;
  const shell: RemoteShell = { terminalId: "t1", shown: "nowhere" };

  beforeEach(() => {
    panel = {
      hosts: signal<readonly RemoteHost[]>([]),
      shells: signal<ReadonlyMap<string, HostShells>>(new Map()),
      failure: signal<string | undefined>(undefined),
      saveHost: vi.fn().mockResolvedValue(undefined),
      defaultCommand: vi.fn().mockResolvedValue(DEFAULT_COMMAND),
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

  it("opens the form to change a host with the command ssh runs when it names none", async () => {
    const office: RemoteHost = {
      name: "office",
      destination: "lars@office",
      connection: "connected",
    };

    await component.edit(office);

    expect(component.form()).toEqual({ host: office, defaultCommand: DEFAULT_COMMAND });
  });

  it("opens an empty form to add a host", async () => {
    await component.add();

    expect(component.form()).toEqual({ host: undefined, defaultCommand: DEFAULT_COMMAND });
  });
});
