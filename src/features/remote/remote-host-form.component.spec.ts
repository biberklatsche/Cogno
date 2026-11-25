import type { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteHostFormComponent } from "./remote-host-form.component";
import type { RemotePanelService } from "./remote-panel.service";

function remote(name: string): RemoteHost {
  return { id: `${name}-id`, name, connection: "disconnected" };
}

describe("RemoteHostFormComponent", () => {
  let renameHost: ReturnType<typeof vi.fn>;
  let form: RemoteHostFormComponent;
  let closed: ReturnType<typeof vi.fn>;

  function open(host: RemoteHost): void {
    form = new RemoteHostFormComponent({ renameHost } as unknown as RemotePanelService);
    form.host = host;
    form.closed.subscribe(closed);
    form.ngOnChanges();
  }

  const type = (value: string) => form.setName({ target: { value } } as unknown as Event);

  beforeEach(() => {
    renameHost = vi.fn().mockResolvedValue(undefined);
    closed = vi.fn();
  });

  it("renames the machine and closes", async () => {
    open(remote("office"));
    expect(form.name()).toBe("office");
    type("work");

    await form.save(new Event("submit"));

    expect(renameHost).toHaveBeenCalledWith("office-id", "work");
    expect(closed).toHaveBeenCalledOnce();
  });

  it("saves no remote without a name", async () => {
    open(remote("office"));
    type("  ");

    expect(form.unnamed()).toBe(true);
    await form.save(new Event("submit"));

    expect(renameHost).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it("shows the other remote when the panel switches to it while it is open", async () => {
    open(remote("office"));
    type("changed");

    form.host = remote("home");
    form.ngOnChanges();
    await form.save(new Event("submit"));

    expect(renameHost).toHaveBeenCalledWith("home-id", "home");
  });

  it("says why it did not save, and stays open", async () => {
    renameHost.mockResolvedValue("A remote needs a name.");
    open(remote("lab"));
    type("office");

    await form.save(new Event("submit"));

    expect(form.error()).toBe("A remote needs a name.");
    expect(closed).not.toHaveBeenCalled();
  });
});
