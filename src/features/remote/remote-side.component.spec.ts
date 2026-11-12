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
    saveHost: ReturnType<typeof vi.fn>;
  };
  let component: RemoteSideComponent;
  const shell: RemoteShell = { terminalId: "t1", shown: "nowhere" };

  beforeEach(() => {
    panel = {
      hosts: signal<readonly RemoteHost[]>([]),
      shells: signal<ReadonlyMap<string, HostShells>>(new Map()),
      failure: signal<string | undefined>(undefined),
      saveHost: vi.fn().mockResolvedValue(undefined),
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
      command: '".cogno/bin/cogno" server --stdio',
      saving: false,
      error: undefined,
    });
    expect(component.fields.map((field) => field.key)).toEqual(["name", "destination", "command"]);
  });

  it("starts a new remote with the command ssh runs, and saves it only when changed", async () => {
    component.add();
    expect(component.form()?.command).toBe('".cogno/bin/cogno" server --stdio');
    const type = (field: "name" | "destination" | "command", value: string) =>
      component.setField(field, { target: { value } } as unknown as Event);
    type("name", "office");
    type("destination", "lars@office");

    await component.save(new Event("submit"));
    expect(panel.saveHost).toHaveBeenLastCalledWith(
      { name: "office", destination: "lars@office", command: undefined },
      undefined,
    );

    component.add();
    type("name", "office");
    type("destination", "lars@office");
    type("command", '& ".cogno/bin/cogno" server --stdio');
    await component.save(new Event("submit"));
    expect(panel.saveHost).toHaveBeenLastCalledWith(
      {
        name: "office",
        destination: "lars@office",
        command: '& ".cogno/bin/cogno" server --stdio',
      },
      undefined,
    );
  });
});
