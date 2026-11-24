import { afterEach, describe, expect, it } from "vitest";
import { focusPanel, resizedPanelWidth } from "./side-menu.component";

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

  it("takes the keyboard to the panel's search field and selects its text", () => {
    const { panel, field, terminal } = panelWithField();
    field.dataset["sideMenuAutofocus"] = "true";
    field.value = "git";
    terminal.focus();

    focusPanel(panel);

    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(3);
  });

  it("stays in its own panel: the search field of another panel is left alone", () => {
    const first = panelWithField();
    first.field.dataset["sideMenuAutofocus"] = "true";
    const second = panelWithField();
    second.field.dataset["sideMenuAutofocus"] = "true";

    focusPanel(second.panel);

    expect(document.activeElement).toBe(second.field);
  });

  it("leaves it in a field of the panel that a click just focused", () => {
    const { panel, field } = panelWithField();
    field.focus();

    focusPanel(panel);

    expect(document.activeElement).toBe(field);
  });
});

describe("resizedPanelWidth", () => {
  it("follows the pointer while the terminals have room left", () => {
    expect(resizedPanelWidth(360, 100, 300)).toBe(460);
  });

  it("stops where the terminals reach their floor", () => {
    expect(resizedPanelWidth(360, 500, 300)).toBe(660);
  });

  it("gets narrower freely", () => {
    expect(resizedPanelWidth(360, -50, 0)).toBe(310);
  });

  it("does not grow while the terminals are below their floor already", () => {
    expect(resizedPanelWidth(360, 80, -40)).toBe(360);
  });
});
