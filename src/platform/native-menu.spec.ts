import { beforeEach, describe, expect, it, vi } from "vitest";

/** Every native object the mocked menu API made, in order. */
const made: { close: ReturnType<typeof vi.fn> }[] = [];
const replacedMenu = { close: vi.fn(async () => undefined) };
const make = async () => {
  const object = {
    close: vi.fn(async () => undefined),
    setAsAppMenu: vi.fn(async () => replacedMenu),
  };
  made.push(object);
  return object;
};

vi.mock("@tauri-apps/api/menu/menu", () => ({ Menu: { new: make } }));
vi.mock("@tauri-apps/api/menu/menuItem", () => ({ MenuItem: { new: make } }));
vi.mock("@tauri-apps/api/menu/predefinedMenuItem", () => ({ PredefinedMenuItem: { new: make } }));
vi.mock("@tauri-apps/api/menu/submenu", () => ({ Submenu: { new: make } }));

const { TauriMenu } = await import("./native-menu");

describe("TauriMenu", () => {
  beforeEach(() => {
    made.length = 0;
    vi.clearAllMocks();
  });

  const buildMenu = async (tauriMenu: InstanceType<typeof TauriMenu>) => {
    const item = await tauriMenu.newItem({ text: "Quit" });
    const separator = await tauriMenu.newPredefinedItem({ item: "Separator" });
    const submenu = await tauriMenu.newSubmenu({ text: "Cogno", items: [item, separator] });
    return tauriMenu.new({ items: [submenu] });
  };

  it("releases every object it made, once", async () => {
    const tauriMenu = new TauriMenu();
    await buildMenu(tauriMenu);

    await tauriMenu.releaseAll();
    await tauriMenu.releaseAll();

    expect(made).toHaveLength(4);
    for (const object of made) expect(object.close).toHaveBeenCalledOnce();
  });

  it("leaves what is made after a release to the next one", async () => {
    const tauriMenu = new TauriMenu();
    await tauriMenu.releaseAll();

    await buildMenu(tauriMenu);

    for (const object of made) expect(object.close).not.toHaveBeenCalled();
  });

  it("releases the handle of the menu that setting one replaces", async () => {
    const tauriMenu = new TauriMenu();

    await tauriMenu.setAsAppMenu(await buildMenu(tauriMenu));

    expect(replacedMenu.close).toHaveBeenCalledOnce();
  });
});
