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

import { MachineState } from "@cogno/core/terminal/machine-state";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptMarkerRegistry } from "./decoration/prompt-marker.registry";
import { TerminalNotificationHandler } from "./handlers/terminal-notification.handler";
import { TerminalTitleHandler } from "./handlers/terminal-title.handler";
import { TerminalCommandHistoryStore } from "./model/command-history.store";
import { CommandLineBuffer } from "./model/command-line.buffer";
import { CommandLineObserver } from "./model/command-line.observer";
import { SessionModel } from "./model/session-model";
import { CommandRecorder } from "./recorder/command-recorder";
import type { SessionFact } from "./session-facts";

const ESC = "\x1b";
const ST = `${ESC}\\`;
const BEL = "\x07";
const CONCEAL = `${ESC}[8m`;
const RESET = `${ESC}[0m`;

const TOKEN = "test-session-token";

const clipboardStub = { writeText: vi.fn(async () => undefined) } as unknown as ClipboardAccess;

type ShellStream = {
  caps: string;
  /** One prompt cycle: the OSC 733 prompt report plus the marker line PS1 prints. */
  prompt(id: number, opts?: { command?: string; returnCode?: number; directory?: string }): string;
  directory: string;
};

const bashLike = (shell: "bash" | "zsh", directory: string): ShellStream => ({
  directory,
  caps: `${ESC}]733;COGNO:CAPS;token=${TOKEN};shell=${shell};os=linux;distro=;shellVersion=5.2;nativeActions=replaceCurrentInput;bracketedPaste=true;${ST}`,
  prompt: (id, opts = {}) =>
    `${ESC}]733;COGNO:PROMPT;token=${TOKEN};returnCode=${opts.returnCode ?? 0};user=dev;machine=box;directory=${
      opts.directory ?? directory
    };id=${id};command=${opts.command ?? ""};commandExists=${opts.command ? "true" : "false"};${ST}` +
    `\r\n${CONCEAL}^^#${id}${RESET}\r\n`,
});

const pwsh = (directory: string): ShellStream => ({
  directory,
  caps: `${ESC}]733;COGNO:CAPS;token=${TOKEN};shell=pwsh;os=windows;distro=;shellVersion=5.1.22621;nativeActions=clearLine,replaceCurrentInput;bracketedPaste=false;${BEL}`,
  prompt: (id, opts = {}) =>
    `${ESC}]733;COGNO:PROMPT;token=${TOKEN};returnCode=${opts.returnCode ?? 0};user=dev;machine=box;directory=${
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
    recordAbortedCommand: vi.fn().mockResolvedValue(undefined),
  } as unknown as CommandRecorder;
  const model = new SessionModel(backendOs, new TerminalCommandHistoryStore(), recorder);
  model.initialize("headless-1", shellType, undefined, backendOs);
  // The host sets the session's token before the shell spawns; the streams
  // above echo it, as the real integration scripts do since 1.3.0.
  model.setSessionToken(TOKEN);

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

describe("headless session (handshake token)", () => {
  let session: ReturnType<typeof createHeadlessSession>;
  const stream = bashLike("bash", "/home/dev");

  beforeEach(async () => {
    session = createHeadlessSession("Bash", "linux");
    await session.write(stream.caps);
    await session.write(stream.prompt(1));
  });

  it("drops a prompt without a token and leaves the model untouched", async () => {
    const facts: SessionFact[] = [];
    session.model.facts$.subscribe((fact) => facts.push(fact));

    await session.write(
      `${ESC}]733;COGNO:PROMPT;returnCode=0;directory=/somewhere/else;id=99;command=evil;${ST}`,
    );

    expect(session.model.commands).toHaveLength(1);
    expect(session.model.state.cwd).not.toBe("/somewhere/else");
    expect(session.model.untrustedSequenceCount).toBe(1);
    expect(facts).toEqual([]);
  });

  it("treats a wrong token like a missing one", async () => {
    await session.write(
      `${ESC}]733;COGNO:CAPS;token=not-the-token;shell=bash;os=linux;nativeActions=clearLine;bracketedPaste=true;${ST}`,
    );

    expect(session.model.sessionCapabilities?.nativeActions).not.toContain("clearLine");
    expect(session.model.untrustedSequenceCount).toBe(1);
  });

  it("says so once when the third untrusted sequence is dropped", async () => {
    const facts: SessionFact[] = [];
    session.model.facts$.subscribe((fact) => facts.push(fact));

    for (let i = 0; i < 4; i++) {
      await session.write(`${ESC}]733;COGNO:PROMPT;returnCode=0;id=9${i};${ST}`);
    }

    expect(session.model.untrustedSequenceCount).toBe(4);
    expect(facts.filter((fact) => fact.type === "untrustedSequencesIgnored")).toEqual([
      { type: "untrustedSequencesIgnored", count: 3 },
    ]);
  });

  it("still processes OSC 2 and OSC 9, which carry no token", async () => {
    const facts: SessionFact[] = [];
    session.model.facts$.subscribe((fact) => facts.push(fact));
    new TerminalTitleHandler(session.model).registerTerminal(session.terminal);
    new TerminalNotificationHandler(session.model, new MachineState()).registerTerminal(
      session.terminal,
    );

    await session.write(`${ESC}]2;my title${BEL}`);
    await session.write(`${ESC}]9;hello${BEL}`);

    expect(facts).toContainEqual({ type: "titleChanged", oscCode: 2, title: "my title" });
    expect(facts).toContainEqual({ type: "notificationRequested", message: "hello" });
  });
});

describe("headless session (context timeline)", () => {
  // A prompt cycle in the current context, token included, that ends the
  // command that opened an inner context.
  function outerPrompt(
    session: ReturnType<typeof createHeadlessSession>,
    id: number,
    command: string,
  ) {
    return session.write(
      `${ESC}]733;COGNO:PROMPT;token=${TOKEN};returnCode=0;user=dev;machine=box;directory=/home/dev;id=${id};command=${command};${ST}`,
    );
  }

  it("pushes an inner context on a second handshake and pops it on command end", async () => {
    const session = createHeadlessSession("PowerShell", "windows");
    await session.write(pwsh("C:\\Users\\dev").caps);
    await session.write(pwsh("C:\\Users\\dev").prompt(1));
    expect(session.model.state.shellContext).toEqual({
      shellType: "PowerShell",
      backendOs: "windows",
    });
    const baseRevision = session.model.state.contextRevision;

    // A command runs, and inside it a Linux bash authenticates.
    session.model.startCommand("wsl");
    expect(session.model.isCommandRunning).toBe(true);
    await session.write(
      `${ESC}]733;COGNO:CAPS;token=${TOKEN};shell=bash;os=linux;distro=;shellVersion=5.2;nativeActions=clearLine;bracketedPaste=true;${ST}`,
    );

    expect(session.model.state.shellContext).toEqual({ shellType: "Bash", backendOs: "linux" });
    expect(session.model.state.isContextKnown).toBe(true);
    expect(session.model.state.contextRevision).not.toBe(baseRevision);
    expect(session.model.sessionCapabilities?.nativeActions).toContain("clearLine");

    // The wsl command ends: the outer PowerShell context is back.
    await outerPrompt(session, 2, "wsl");

    expect(session.model.state.shellContext).toEqual({
      shellType: "PowerShell",
      backendOs: "windows",
    });
    expect(session.model.sessionCapabilities?.nativeActions).toContain(
      "clearLine,replaceCurrentInput".split(",")[1],
    );
  });

  it("reads a distro on a Windows host as a WSL context, not the reported linux os", async () => {
    const session = createHeadlessSession("PowerShell", "windows");
    await session.write(pwsh("C:\\Users\\dev").caps);
    await session.write(pwsh("C:\\Users\\dev").prompt(1));

    session.model.startCommand("wsl");
    await session.write(
      `${ESC}]733;COGNO:CAPS;token=${TOKEN};shell=bash;os=linux;distro=Ubuntu;shellVersion=5.2;nativeActions=;bracketedPaste=true;${ST}`,
    );

    expect(session.model.state.shellContext).toEqual({
      shellType: "Bash",
      backendOs: "windows",
      wslDistroName: "Ubuntu",
    });
  });

  it("degrades into an unknown context on ssh without a handshake and recovers on return", async () => {
    const session = createHeadlessSession("Bash", "linux");
    await session.write(bashLike("bash", "/home/dev").caps);
    await session.write(bashLike("bash", "/home/dev").prompt(1));
    expect(session.model.pathAdapter).toBeDefined();

    session.model.startCommand("ssh remote-host");

    // No handshake from the remote host: path translation and editor
    // actions are off until the command returns.
    expect(session.model.state.isContextKnown).toBe(false);
    expect(session.model.pathAdapter).toBeUndefined();
    expect(session.model.sessionCapabilities).toBeUndefined();

    await session.write(
      `${ESC}]733;COGNO:PROMPT;token=${TOKEN};returnCode=0;user=dev;machine=box;directory=/home/dev;id=2;command=ssh remote-host;${ST}`,
    );

    expect(session.model.state.isContextKnown).toBe(true);
    expect(session.model.pathAdapter).toBeDefined();
  });

  it("does not record commands run in a foreign context", async () => {
    const session = createHeadlessSession("Bash", "linux");
    await session.write(bashLike("bash", "/home/dev").caps);
    await session.write(bashLike("bash", "/home/dev").prompt(1));
    vi.mocked(session.recorder.onCommandExecuted).mockClear();

    session.model.startCommand("ssh remote-host");
    // A prompt-shaped line arrives, but the token proves it is still ours;
    // it ends the ssh command and returns - the command inside is not recorded.
    await session.write(
      `${ESC}]733;COGNO:PROMPT;token=${TOKEN};returnCode=0;user=dev;machine=box;directory=/home/dev;id=2;command=ssh remote-host;${ST}`,
    );

    // The ssh command itself (base context) is recorded on its completion.
    expect(session.recorder.onCommandExecuted).toHaveBeenCalled();
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

// M2

describe("headless session (aborted command on quit)", () => {
  it("records the running command as aborted (step 27b-2)", async () => {
    const session = createHeadlessSession("Bash", "linux");
    session.model.updateCommand({ id: "1" });
    session.model.startCommand("sleep 100");
    expect(session.model.isCommandRunning).toBe(true);

    await session.model.recordAbortedCommand();

    expect(session.recorder.recordAbortedCommand).toHaveBeenCalledWith(
      expect.objectContaining({ command: "sleep 100", returnCode: undefined }),
    );
  });

  it("records nothing when no command is running", async () => {
    const session = createHeadlessSession("Bash", "linux");
    session.model.updateCommand({ id: "1" });

    await session.model.recordAbortedCommand();

    expect(session.recorder.recordAbortedCommand).not.toHaveBeenCalled();
  });
});
