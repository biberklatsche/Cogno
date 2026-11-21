import { afterEach, describe, expect, it } from "vitest";
import { focusPanel } from "./side-menu.component";

describe("focusPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function panelWithField() {
    const panel = document.createElement("aside");
    panel.tabIndex = -1;
    const field = document.createElement("input");
    panel.append(field);
    const terminal = document.createElement("textarea");
    document.body.append(panel, terminal);
    return { panel, field, terminal };
  }

  it("takes the keyboard to the panel when it is elsewhere", () => {
    const { panel, terminal } = panelWithField();
    terminal.focus();

    focusPanel(panel);

    expect(document.activeElement).toBe(panel);
  });

  it("leaves it in a field of the panel that a click just focused", () => {
    const { panel, field } = panelWithField();
    field.focus();

    focusPanel(panel);

    expect(document.activeElement).toBe(field);
  });
});
