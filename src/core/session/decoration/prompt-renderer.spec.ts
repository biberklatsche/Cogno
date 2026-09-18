import type { PromptSegment } from "@cogno/core/infrastructure/config/models/prompt-config";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import type { ContextMenuOverlayService } from "@cogno/shared/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import { SessionModel } from "../model/session-model";
import { CommandRecorder } from "../recorder/command-recorder";
import type { SessionFact } from "../session-facts";

function createModel(terminalId: string): SessionModel {
  const recorder = {
    initialize: vi.fn(),
    onCwdChanged: vi.fn(),
    onCommandExecuted: vi.fn(),
  } as unknown as CommandRecorder;
  const model = new SessionModel("linux", new TerminalCommandHistoryStore(), recorder);
  model.initialize(terminalId, "Bash", undefined, "linux");
  return model;
}

import { PromptMarkerRenderer } from "./prompt-renderer";

const clipboardStub = {
  writeText: vi.fn(async () => undefined),
  readText: vi.fn(async () => ""),
  readImageFromClipboard: vi.fn(async () => null),
} as unknown as ClipboardAccess;

describe("PromptMarkerRenderer", () => {
  let stateManager: SessionModel;
  let facts: SessionFact[];
  let hostElement: HTMLElement;
  let contextMenuOverlayService: Pick<ContextMenuOverlayService, "openAtElement">;

  beforeEach(() => {
    stateManager = createModel("test-term");
    facts = [];
    stateManager.facts$.subscribe((fact) => facts.push(fact));
    hostElement = document.createElement("div");
    contextMenuOverlayService = {
      openAtElement: vi.fn(),
    };
  });

  it("should render default label when no segments are provided", () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const renderer = new PromptMarkerRenderer(stateManager, [], clipboardStub);
    renderer.render(hostElement, 0);

    const marker = hostElement.querySelector(".cogno-marker");
    expect(marker).toBeTruthy();
    expect(marker?.textContent).toBe("COGNO");
  });

  it("renders nothing for the integration bootstrap command", () => {
    // The first prompt creates the command; the next prompt fills its data,
    // so the bootstrap dot-source lands on commands[0].
    stateManager.updateCommand({ id: "1" });
    stateManager.updateCommand({
      id: "2",
      command: ". '/home/x/.cogno/shell-integration/bash/bootstrap.bash'",
    });

    const renderer = new PromptMarkerRenderer(stateManager, [{ text: "X" }], clipboardStub);
    renderer.render(hostElement, 0);

    expect(hostElement.querySelector(".cogno-marker")).toBeNull();
    expect(hostElement.childElementCount).toBe(0);
  });

  it("should render text segments", () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const segments: PromptSegment[] = [{ text: "Hello " }, { text: "World" }];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    renderer.render(hostElement, 0);

    const spans = hostElement.querySelectorAll(".prompt-segment");
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe("Hello ");
    expect(spans[1].textContent).toBe("World");
  });

  it("should render a cover sized to the marker text and keep the prompt on one line", () => {
    stateManager.updateCommand({ id: "123" });

    const renderer = new PromptMarkerRenderer(stateManager, [{ text: "Prompt" }], clipboardStub);
    renderer.render(hostElement, { commandIndex: 0, markerText: "^^#123" });

    const cover = hostElement.querySelector(".cogno-marker__cover") as HTMLElement;
    const content = hostElement.querySelector(".cogno-marker__content") as HTMLElement;

    expect(cover).toBeTruthy();
    expect(cover.style.width).toBe("6ch");
    expect(content.style.flexWrap).toBe("nowrap");
    expect(content.style.whiteSpace).toBe("nowrap");
    expect(content.style.overflow).toBe("hidden");
  });

  it("should render field segments from command", () => {
    stateManager.updateCommand({
      id: "cmd-1",
      user: "tester",
      machine: "localhost",
      directory: "~/projects",
    });

    const segments: PromptSegment[] = [
      { field: "user" },
      { text: "@" },
      { field: "machine" },
      { text: ":" },
      { field: "directory" },
    ];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    renderer.render(hostElement, 0);

    const marker = hostElement.querySelector(".cogno-marker");
    expect(marker?.textContent).toBe("tester@localhost:~/projects");
  });

  it("resolves bright color names to their theme variable", () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const segments: PromptSegment[] = [
      { text: "Bright", foreground: "brightRed", background: "brightBlack" },
    ];
    new PromptMarkerRenderer(stateManager, segments, clipboardStub).render(hostElement, 0);

    const span = hostElement.querySelector(".prompt-segment") as HTMLElement;
    expect(span.style.color).toBe("var(--color-bright-red)");
    expect(span.style.backgroundColor).toBe("var(--color-bright-black)");
  });

  it("draws the separator between the segments that show, not around hidden ones", () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const segments: PromptSegment[] = [
      { text: "a" },
      { text: "hidden", when: "returnCode==42" },
      { text: "b" },
    ];
    const renderer = new PromptMarkerRenderer(
      stateManager,
      segments,
      clipboardStub,
      undefined,
      " | ",
    );
    renderer.render(hostElement, 0);

    const content = hostElement.querySelector(".prompt-segment")?.parentElement;
    expect(content?.textContent).toBe("a | b");
    expect(hostElement.querySelectorAll(".prompt-separator")).toHaveLength(1);
  });

  it("should apply styles correctly", () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const segments: PromptSegment[] = [
      {
        text: "Styled",
        foreground: "red",
        // As the schema stores it: the config holds hex colors without `#`.
        background: "00ff00",
        bold: true,
        italic: true,
        underline: true,
        size: 14,
        padding_left: 5,
        margin_right: 10,
        radius_left: 4,
        className: "custom-class",
        title: "Hover me",
      },
    ];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    renderer.render(hostElement, 0);

    const span = hostElement.querySelector(".prompt-segment") as HTMLElement;
    expect(span.style.color).toBe("var(--color-red)");
    expect(span.style.backgroundColor).toBe("#00ff00");
    expect(span.style.fontWeight).toBe("600");
    expect(span.style.fontStyle).toBe("italic");
    expect(span.style.textDecoration).toBe("underline");
    expect(span.style.fontSize).toBe("14px");
    expect(span.style.paddingLeft).toBe("5px");
    expect(span.style.marginRight).toBe("10px");
    expect(span.style.borderTopLeftRadius).toBe("4px");
    expect(span.classList.contains("custom-class")).toBe(true);
    expect(span.title).toBe("Hover me");
  });

  it('should evaluate "when" conditions correctly', () => {
    // Create first command
    stateManager.updateCommand({
      id: "cmd-1",
      user: "tester",
    });
    // Add second command, which updates first command with data (returnCode=0)
    stateManager.updateCommand({
      id: "cmd-2",
      returnCode: "0",
    });

    const segments: PromptSegment[] = [
      { text: "OK", when: "returnCode == 0" },
      { text: "FAIL", when: "returnCode != 0" },
    ];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);

    // Render cmd-1 (index 0).
    // In createCommandRecord for index 0:
    // isLastCommand = commands[0].command === undefined.
    // It IS undefined, so it returns isInput: true and ONLY directory, user, machine.
    // Thus returnCode is missing!

    // We need to make it NOT the last command by giving it a command text
    stateManager.commands[0].set("command", "ls");

    renderer.render(hostElement, 0);
    expect(hostElement.textContent).toBe("OK");
  });

  it("should format values correctly", () => {
    stateManager.updateCommand({
      id: "cmd-1",
      user: "john",
    });

    const segments: PromptSegment[] = [
      { field: "user", format: "upper" },
      { text: "|" },
      { field: "user", format: "json" },
    ];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    renderer.render(hostElement, 0);

    expect(hostElement.textContent).toBe('JOHN|"john"');
  });

  it('should add "input" class for the last command', () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const renderer = new PromptMarkerRenderer(stateManager, [{ text: "Prompt" }], clipboardStub);
    renderer.render(hostElement, 0);

    const marker = hostElement.querySelector(".cogno-marker");
    expect(marker?.classList.contains("input")).toBe(true);
  });

  it("should handle missing fields with fallback", () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const segments: PromptSegment[] = [{ field: "nonexistent", fallback: "MISSING" }];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    renderer.render(hostElement, 0);

    expect(hostElement.textContent).toBe("MISSING");
  });

  it("should handle undefined commandId gracefully", () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const segments: PromptSegment[] = [{ field: "user", fallback: "anonymous" }];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    renderer.render(hostElement, 0);

    expect(hostElement.textContent).toBe("anonymous");
  });

  it('should not render segments with false "when" condition', () => {
    stateManager.updateCommand({ id: "cmd-1" });

    const segments: PromptSegment[] = [
      { text: "Hidden", when: "isInput == true" },
      { text: "Visible", when: "isInput == false" },
    ];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    // Command at index 0 with undefined command field returns isInput: true
    // So we need to add a command field to make it not the input line
    stateManager.commands[0].set("command", "ls");
    renderer.render(hostElement, 0);

    expect(hostElement.textContent).toBe("Visible");
  });

  it('should handle invalid "when" expressions', () => {
    const segments: PromptSegment[] = [{ text: "ShouldNotAppear", when: "invalid expression" }];
    const renderer = new PromptMarkerRenderer(stateManager, segments, clipboardStub);
    renderer.render(hostElement, undefined);

    expect(hostElement.textContent).toBe("");
  });

  it("should render a menu button and open a command menu", () => {
    stateManager.updateCommand({ id: "cmd-1" });
    stateManager.commands[0].set("command", "pnpm test");
    const getCommandOutput = vi.fn().mockReturnValue("test output");

    const renderer = new PromptMarkerRenderer(
      stateManager,
      [{ text: "Prompt" }],
      clipboardStub,
      contextMenuOverlayService,
    );
    renderer.render(hostElement, { commandIndex: 0, getCommandOutput });

    const menuButton = hostElement.querySelector(".prompt-marker-menu-button") as HTMLButtonElement;
    expect(menuButton).toBeTruthy();
    expect(getCommandOutput).not.toHaveBeenCalled();

    menuButton.click();

    expect(getCommandOutput).toHaveBeenCalledTimes(1);
    expect(contextMenuOverlayService.openAtElement).toHaveBeenCalledWith(
      menuButton,
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ label: "Copy Command", disabled: false }),
          expect.objectContaining({ label: "Copy Output", disabled: false }),
          expect.objectContaining({ label: "Scroll to Top", disabled: true }),
          expect.objectContaining({ label: "Scroll to Bottom", disabled: true }),
          expect.objectContaining({ label: "Filter Block", disabled: true }),
        ]),
      }),
    );

    const menuItems =
      vi.mocked(contextMenuOverlayService.openAtElement).mock.calls[0][1]?.items ?? [];
    expect(menuItems[2]).toEqual(expect.objectContaining({ separator: true }));
    expect(menuItems[5]).toEqual(expect.objectContaining({ separator: true }));
  });

  it("should copy the command text from the marker menu action", async () => {
    stateManager.updateCommand({ id: "cmd-1" });
    stateManager.commands[0].set("command", "pnpm test");
    const getCommandOutput = vi.fn().mockReturnValue("test output");

    const renderer = new PromptMarkerRenderer(
      stateManager,
      [{ text: "Prompt" }],
      clipboardStub,
      contextMenuOverlayService,
    );
    renderer.render(hostElement, { commandIndex: 0, getCommandOutput });

    const menuButton = hostElement.querySelector(".prompt-marker-menu-button") as HTMLButtonElement;
    menuButton.click();
    const menuItems =
      vi.mocked(contextMenuOverlayService.openAtElement).mock.calls[0][1]?.items ?? [];
    const copyCommandItem = menuItems.find((item) => item.label === "Copy Command");

    await copyCommandItem?.action?.();

    expect(clipboardStub.writeText).toHaveBeenCalledWith("pnpm test");
  });

  it("should not resolve command output before the menu is opened", () => {
    stateManager.updateCommand({ id: "cmd-1" });
    stateManager.commands[0].set("command", "pnpm test");
    const getCommandOutput = vi.fn().mockReturnValue("test output");

    const renderer = new PromptMarkerRenderer(
      stateManager,
      [{ text: "Prompt" }],
      clipboardStub,
      contextMenuOverlayService,
    );
    renderer.render(hostElement, { commandIndex: 0, getCommandOutput });

    expect(getCommandOutput).not.toHaveBeenCalled();
  });

  it("states a filter-block request from the marker menu", () => {
    stateManager.updateCommand({ id: "cmd-1" });
    stateManager.commands[0].set("command", "pnpm test");
    const getBlockRange = vi.fn().mockReturnValue({
      beginBufferLine: 12,
      endBufferLine: 20,
    });

    const renderer = new PromptMarkerRenderer(
      stateManager,
      [{ text: "Prompt" }],
      clipboardStub,
      contextMenuOverlayService,
    );
    renderer.render(hostElement, { commandIndex: 0, getBlockRange });

    const menuButton = hostElement.querySelector(".prompt-marker-menu-button") as HTMLButtonElement;
    menuButton.click();
    const menuItems =
      vi.mocked(contextMenuOverlayService.openAtElement).mock.calls[0][1]?.items ?? [];
    const filterBlockItem = menuItems.find((item) => item.label === "Filter Block");

    filterBlockItem?.action?.();

    expect(getBlockRange).toHaveBeenCalledTimes(1);
    expect(facts).toEqual([
      { type: "filterBlockRequested", range: { beginBufferLine: 12, endBufferLine: 20 } },
    ]);
  });

  it("should execute scroll actions from the marker menu", () => {
    stateManager.updateCommand({ id: "cmd-1" });
    stateManager.commands[0].set("command", "pnpm test");
    const scrollToCommandTop = vi.fn();
    const scrollToCommandBottom = vi.fn();

    const renderer = new PromptMarkerRenderer(
      stateManager,
      [{ text: "Prompt" }],
      clipboardStub,
      contextMenuOverlayService,
    );
    renderer.render(hostElement, {
      commandIndex: 0,
      scrollToCommandTop,
      scrollToCommandBottom,
    });

    const menuButton = hostElement.querySelector(".prompt-marker-menu-button") as HTMLButtonElement;
    menuButton.click();
    const menuItems =
      vi.mocked(contextMenuOverlayService.openAtElement).mock.calls[0][1]?.items ?? [];

    menuItems.find((item) => item.label === "Scroll to Top")?.action?.();
    menuItems.find((item) => item.label === "Scroll to Bottom")?.action?.();

    expect(scrollToCommandTop).toHaveBeenCalledTimes(1);
    expect(scrollToCommandBottom).toHaveBeenCalledTimes(1);
  });
});
