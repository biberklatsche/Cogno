import { mdiAbTesting, mdiClose, mdiGit, mdiLock, mdiRobot } from "@mdi/js";
import { describe, expect, it } from "vitest";
import { IconComponent } from "./icon.component";

describe("IconComponent", () => {
  it("should have mdiAbTesting as default icon", () => {
    const cmp = new IconComponent();
    expect(cmp.icon).toBe(mdiAbTesting);
  });

  it("should map known names to corresponding mdi icon paths", () => {
    const cmp = new IconComponent();

    cmp.name = "mdiClose";
    expect(cmp.icon).toBe(mdiClose);

    cmp.name = "mdiGit";
    expect(cmp.icon).toBe(mdiGit);

    cmp.name = "mdiLock";
    expect(cmp.icon).toBe(mdiLock);

    cmp.name = "mdiRobot";
    expect(cmp.icon).toBe(mdiRobot);
  });

  it("should fall back to mdiAbTesting when given an unknown name", () => {
    const cmp = new IconComponent();
    (cmp as any).name = "mdiUnknownValue";
    expect(cmp.icon).toBe(mdiAbTesting);
  });
});
