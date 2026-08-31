// Spike for step 13 (Umsetzungsplan): can the command-line model run on a
// Terminal that was never open()ed? Step 14's display axis (detached ↔
// attached) depends on the answer: a session must parse output, anchor
// prompt markers and mirror the input line while no DOM is attached.
//
// The byte streams below are synthesized from the real integration scripts
// (integration.bash.txt, integration.zsh.txt, bootstrap.ps1.txt): OSC 733
// COGNO:CAPS once at boot, then per prompt an OSC 733 COGNO:PROMPT followed
// by the concealed `^^#<id>` marker line. bash/zsh terminate the OSC with
// ST (ESC \), PowerShell with BEL — both must parse.
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptMarkerRegistry } from "./decoration/prompt-marker.registry";
import { TerminalCommandHistoryStore } from "./model/command-history.store";
import { CommandLineBuffer } from "./model/command-line.buffer";
import { CommandLineObserver } from "./model/command-line.observer";
import { SessionModel } from "./model/session-model";
import { CommandRecorder } from "./recorder/command-recorder";

const ESC = "\x1b";
const ST = `${ESC}\\`;
const BEL = "\x07";
const CONCEAL = `${ESC}[8m`;
const RESET = `${ESC}[0m`;

const clipboardStub = { writeText: vi.fn(async () => undefined) } as unknown as ClipboardAccess;

type ShellStream = {
  caps: string;
  /** One prompt cycle: the OSC 733 prompt report plus the marker line PS1 prints. */
  prompt(id: number, opts?: { command?: string; returnCode?: number; directory?: string }): string;
  directory: string;
};

const bashLike = (shell: "bash" | "zsh", directory: string): ShellStream => ({
  directory,
  caps: `${ESC}]733;COGNO:CAPS;shell=${shell};shellVersion=5.2;nativeActions=replaceCurrentInput;bracketedPaste=true;${ST}`,
  prompt: (id, opts = {}) =>
    `${ESC}]733;COGNO:PROMPT;returnCode=${opts.returnCode ?? 0};user=dev;machine=box;directory=${
      opts.directory ?? directory
    };id=${id};command=${opts.command ?? ""};commandExists=${opts.command ? "true" : "false"};${ST}` +
    `\r\n${CONCEAL}^^#${id}${RESET}\r\n`,
});

const pwsh = (directory: string): ShellStream => ({
  directory,
  caps: `${ESC}]733;COGNO:CAPS;shell=pwsh;shellVersion=5.1.22621;nativeActions=clearLine,replaceCurrentInput;bracketedPaste=false;${BEL}`,
  prompt: (id, opts = {}) =>
    `${ESC}]733;COGNO:PROMPT;returnCode=${opts.returnCode ?? 0};user=dev;machine=box;directory=${
      opts.directory ?? directory
    };id=${id};command=${opts.command ?? ""};commandExists=${opts.command ? "true" : "false"};${BEL}` +
    `\r\n${CONCEAL}^^#${id}${RESET}\r\n`,
});

const STREAMS: ReadonlyArray<{
  name: string;
  shellType: "Bash" | "ZSH" | "PowerShell";
  backendOs: "linux" | "windows";
  stream: ShellStream;
}> = [
  { name: "bash", shellType: "Bash", backendOs: "linux", stream: bashLike("bash", "/home/dev") },
  { name: "zsh", shellType: "ZSH", backendOs: "linux", stream: bashLike("zsh", "/home/dev") },
  { name: "pwsh", shellType: "PowerShell", backendOs: "windows", stream: pwsh("C:\\Users\\dev") },
];

function createHeadlessSession(
  shellType: "Bash" | "ZSH" | "PowerShell",
  backendOs: "linux" | "windows",
  cols = 80,
) {
  const recorder = {
    initialize: vi.fn(),
    onCwdChanged: vi.fn(),
    onCommandExecuted: vi.fn(),
  } as unknown as CommandRecorder;
  const model = new SessionModel(backendOs, new TerminalCommandHistoryStore(), recorder);
  model.initialize("headless-1", shellType, undefined, backendOs);

  // The machine, never opened: no element, no renderer, no DOM.
  const terminal = new Terminal({ cols, rows: 24, allowProposedApi: true });
  const registry = new PromptMarkerRegistry();
  const buffer = new CommandLineBuffer(registry);
  const observer = new CommandLineObserver(
    model,
    [],
    { openAtElement: vi.fn() },
    clipboardStub,
    registry,
    buffer,
  );
  observer.registerTerminal(terminal);

  const write = (data: string) => new Promise<void>((resolve) => terminal.write(data, resolve));
  return { model, terminal, registry, buffer, observer, write, recorder };
}

describe.each(STREAMS)("headless session ($name)", ({ shellType, backendOs, stream }) => {
  let session: ReturnType<typeof createHeadlessSession>;

  beforeEach(async () => {
    session = createHeadlessSession(shellType, backendOs);
    await session.write(stream.caps);
    await session.write(stream.prompt(1));
  });

  it("records the capability handshake without running the prompt logic", () => {
    expect(session.model.sessionCapabilities?.nativeActions).toContain("replaceCurrentInput");
    // The handshake carried no directory; the first prompt did.
    expect(session.model.commands).toHaveLength(1);
  });

  it("anchors the prompt marker and mirrors typed input into the model", async () => {
    const markerLine = session.registry.lastMarkerLine();
    expect(markerLine).toBeGreaterThanOrEqual(0);
    expect(session.buffer.inputStartLine()).toBe(markerLine + 1);

    await session.write("echo hello");

    expect(session.buffer.cursorInputIndex()).toBe("echo hello".length);
    expect(session.model.input.text).toBe("echo hello");
    expect(session.model.input.cursorIndex).toBe("echo hello".length);
  });

  it("keeps the command list and the cwd from the prompt reports", async () => {
    await session.write("echo hello\r\n");
    await session.write("hello\r\n");
    await session.write(stream.prompt(2, { command: "echo hello", returnCode: 0 }));

    expect(session.model.commands).toHaveLength(2);
    const executed = session.model.commands[0];
    expect(executed.command).toBe("echo hello");
    expect(executed.returnCode).toBe(0);
    expect(executed.directory).toBe(stream.directory);
    expect(session.model.state.cwd).toBeTruthy();
    expect(session.recorder.onCommandExecuted).toHaveBeenCalledWith(
      expect.objectContaining({ command: "echo hello", returnCode: 0 }),
    );
    expect(session.registry.markers).toHaveLength(2);
  });
});

describe("headless session (size and reflow)", () => {
  // Documented spike findings on resize before open():
  // - An unopened terminal takes cols/rows from its options and accepts
  //   resize(); the buffer reflows exactly as it does when opened. No buffer
  //   property behaved differently before open() in this spike.
  // - The one line that never reflows - opened or not - is the line the
  //   cursor sits on, i.e. the current input line. That is xterm behavior,
  //   not a headless quirk. In the running app it does not matter: the host
  //   sends the new size to the pty and the shell redraws the prompt line
  //   after SIGWINCH. `readInputText` may read short between a detached
  //   resize and that redraw, so step 14 sizes the machine at attach time
  //   (fit after open) and otherwise leaves a detached terminal's size alone.
  it("reflows completed output lines on resize without open()", async () => {
    const session = createHeadlessSession("Bash", "linux", 20);
    const stream = bashLike("bash", "/home/dev");
    await session.write(stream.caps);
    await session.write(stream.prompt(1));
    expect(session.terminal.cols).toBe(20);
    // A finished command's output wraps onto two 20-column lines...
    await session.write("echo abcdefghijklmnopqrstu\r\nok\r\n");
    await session.write(stream.prompt(2, { command: "echo abcdefghijklmnopqrstu" }));

    session.terminal.resize(60, 24);

    // ...and is one line again after widening, marker anchoring intact.
    const buffer = session.terminal.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
    }
    expect(lines).toContain("echo abcdefghijklmnopqrstu");
    expect(session.registry.markers).toHaveLength(2);
    expect(session.buffer.inputStartLine()).toBe(session.registry.lastMarkerLine() + 1);
  });

  it("never reflows the cursor's own line, so the shell must redraw the input after a resize", async () => {
    const session = createHeadlessSession("Bash", "linux", 20);
    const stream = bashLike("bash", "/home/dev");
    await session.write(stream.caps);
    await session.write(stream.prompt(1));
    const typed = "echo abcdefghijklmnopqrstu";
    await session.write(typed);
    expect(session.model.input.text).toBe(typed);
    expect(session.buffer.cursorInputIndex()).toBe(typed.length);

    session.terminal.resize(60, 24);

    // The typed line stayed at the old width; reading with the new cols
    // comes up short until the shell redraws it.
    expect(session.buffer.readInputText(typed.length)).toBe("echo abcdefghijklmno");
  });

  it("can be opened into a detached element afterwards without disturbing the model", async () => {
    const session = createHeadlessSession("Bash", "linux");
    const stream = bashLike("bash", "/home/dev");
    await session.write(stream.caps);
    await session.write(stream.prompt(1));
    await session.write("echo hi");

    const host = document.createElement("div");
    document.body.appendChild(host);
    session.terminal.open(host);

    expect(session.model.input.text).toBe("echo hi");
    expect(session.model.commands).toHaveLength(1);
    expect(session.buffer.readInputText("echo hi".length)).toBe("echo hi");
  });
});
