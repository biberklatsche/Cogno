import { Terminal } from "@xterm/xterm";
import { describe, expect, it } from "vitest";
import { PromptMarkerRegistry } from "./prompt-marker.registry";

const write = (terminal: Terminal, data: string) =>
  new Promise<void>((resolve) => terminal.write(data, resolve));

/** The prompt as the shell integration prints it: blank line, concealed marker, input line. */
const PROMPT = "\r\n\x1b[8m^^#5\x1b[0m\r\n";
/**
 * What zsh writes on SIGWINCH (recorded from a real zsh): up two lines, erase to
 * the end of the screen, print the prompt again. No precmd runs, so no OSC 733.
 */
const ZSH_REDRAW_ON_RESIZE = `\r\x1b[A\x1b[A\x1b[0m\x1b[27m\x1b[24m\x1b[J${PROMPT}\x1b[K`;

/**
 * Against a real xterm, because the point is xterm's behaviour: erasing a line
 * disposes the markers on it.
 */
describe("PromptMarkerRegistry across a resize (real xterm)", () => {
  async function promptAnchored() {
    const terminal = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    const registry = new PromptMarkerRegistry();
    registry.setTerminal(terminal);
    await write(terminal, "some output\r\n");
    registry.expectMarker();
    await write(terminal, PROMPT);
    registry.onWriteParsed();
    return { terminal, registry };
  }

  const anchored = (registry: PromptMarkerRegistry) =>
    registry.markers.map((entry) => `${entry.commandId}@${entry.marker.line}`);

  it("anchors the prompt the shell reprints after a resize", async () => {
    const { terminal, registry } = await promptAnchored();
    expect(anchored(registry)).toEqual(["5@2"]);

    terminal.resize(40, 24);
    registry.resync();
    await write(terminal, ZSH_REDRAW_ON_RESIZE);
    registry.onWriteParsed();

    expect(anchored(registry)).toEqual(["5@2"]);
  });

  it("keeps the marker when the shell does not redraw", async () => {
    const { terminal, registry } = await promptAnchored();

    terminal.resize(40, 24);
    registry.resync();
    await write(terminal, "");
    registry.onWriteParsed();

    expect(anchored(registry)).toEqual(["5@2"]);
  });
});
