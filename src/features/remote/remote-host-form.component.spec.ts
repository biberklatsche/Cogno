import type { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteHostFormComponent } from "./remote-host-form.component";
import type { RemotePanelService } from "./remote-panel.service";

const FOR_POWERSHELL = '& ".cogno/bin/cogno" server --stdio';

describe("RemoteHostFormComponent", () => {
  let saveHost: ReturnType<typeof vi.fn>;
  let form: RemoteHostFormComponent;
  let closed: ReturnType<typeof vi.fn>;

  function open(host?: RemoteHost): void {
    form = new RemoteHostFormComponent({ saveHost } as unknown as RemotePanelService);
    form.host = host;
    form.closed.subscribe(closed);
    form.ngOnChanges();
  }

  const type = (field: "name" | "destination" | "command", value: string) =>
    form.setField(field, { target: { value } } as unknown as Event);

  beforeEach(() => {
    saveHost = vi.fn().mockResolvedValue(undefined);
    closed = vi.fn();
  });

  it("starts with what a host is; a command only where it names one", () => {
    open({ name: "office", destination: "lars@office", connection: "connected" });
    expect(form.values()).toEqual({ name: "office", destination: "lars@office", command: "" });

    open({
      name: "office",
      destination: "lars@office",
      command: FOR_POWERSHELL,
      connection: "connected",
    });
    expect(form.values().command).toBe(FOR_POWERSHELL);
  });

  it("saves no command unless one is given, so Cogno finds it, and closes", async () => {
    open();
    type("name", "office");
    type("destination", "lars@office");

    await form.save(new Event("submit"));
    expect(saveHost).toHaveBeenLastCalledWith(
      { name: "office", destination: "lars@office", command: undefined },
      undefined,
    );
    expect(closed).toHaveBeenCalledOnce();

    open();
    type("name", "office");
    type("destination", "lars@office");
    type("command", ` ${FOR_POWERSHELL} `);
    await form.save(new Event("submit"));
    expect(saveHost).toHaveBeenLastCalledWith(
      { name: "office", destination: "lars@office", command: FOR_POWERSHELL },
      undefined,
    );
  });

  it("shows the other remote when the panel switches to it while it is open", async () => {
    open({ name: "office", destination: "lars@office", connection: "connected" });
    type("destination", "changed@office");

    form.host = { name: "home", destination: "lars@home", connection: "disconnected" };
    form.ngOnChanges();
    await form.save(new Event("submit"));

    expect(saveHost).toHaveBeenCalledWith(
      { name: "home", destination: "lars@home", command: undefined },
      "home",
    );
  });

  it("says why it did not save, and stays open", async () => {
    saveHost.mockResolvedValue("There is a remote called 'office' already.");
    open({ name: "lab", destination: "lab", connection: "disconnected" });
    type("name", "office");

    await form.save(new Event("submit"));

    expect(saveHost).toHaveBeenCalledWith(
      { name: "office", destination: "lab", command: undefined },
      "lab",
    );
    expect(form.error()).toBe("There is a remote called 'office' already.");
    expect(closed).not.toHaveBeenCalled();
  });
});
