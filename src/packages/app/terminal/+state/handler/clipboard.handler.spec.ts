import { Clipboard } from "@cogno/app-tauri/clipboard";
import type { ShellLineEditorDefinitionContract } from "@cogno/core-api";
import { posixInsertSanitizer } from "@cogno/features/shell/common/posix-insert-sanitizer";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { ConfigService } from "../../../config/+state/config.service";
import type { IPty } from "../pty/pty";
import type { TerminalStateManager } from "../state";
import { ClipboardHandler } from "./clipboard.handler";
import { SelectionHandler } from "./selection.handler";

vi.mock("@cogno/app-tauri/clipboard", () => ({
  bytesToBase64: (bytes: Uint8Array): string => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  },
  Clipboard: {
    writeText: vi.fn(),
    readText: vi.fn(),
    readImageFromClipboard: vi.fn().mockResolvedValue(null),
  },
}));

function makeConfigService(
  overrides: {
    read?: "allow" | "deny";
    write?: "allow" | "deny";
    trim_trailing_spaces?: boolean;
    clear_on_copy?: boolean;
  } = {},
): ConfigService {
  return {
    config: {
      clipboard: {
        read: overrides.read ?? "allow",
        write: overrides.write ?? "allow",
        trim_trailing_spaces: overrides.trim_trailing_spaces ?? true,
      },
      selection: {
        clear_on_copy: overrides.clear_on_copy ?? false,
      },
    },
  } as unknown as ConfigService;
}

function makeMockSelectionHandler(): SelectionHandler {
  return {
    hasSelection: vi.fn().mockReturnValue(false),
    getSelection: vi.fn().mockReturnValue(""),
    getSelectionPosition: vi.fn().mockReturnValue(undefined),
    clearSelection: vi.fn(),
  } as unknown as SelectionHandler;
}

describe("ClipboardHandler", () => {
  let handler: ClipboardHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockStateManager: Pick<
    TerminalStateManager,
    "isCommandRunning" | "input" | "sessionCapabilities"
  >;
  let mockPty: Pick<IPty, "write" | "executeLineEditorAction">;
  let mockConfigService: ConfigService;
  let mockSelectionHandler: SelectionHandler;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    vi.clearAllMocks();
    mockBus = new AppBus();
    mockStateManager = {
      isCommandRunning: false,
      input: { text: "hello world", cursorIndex: 5, maxCursorIndex: 11 },
      sessionCapabilities: undefined,
    };
    mockPty = { write: vi.fn(), executeLineEditorAction: vi.fn() };
    mockConfigService = makeConfigService();
    mockSelectionHandler = makeMockSelectionHandler();
    handler = new ClipboardHandler(
      mockBus,
      terminalId,
      mockStateManager as TerminalStateManager,
      mockPty as IPty,
      mockConfigService,
      mockSelectionHandler,
    );
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  // ─── Paste ─────────────────────────────────────────────────────────────────

  describe("paste", () => {
    beforeEach(() => {
      vi.mocked(Clipboard.readImageFromClipboard).mockResolvedValue(null);
      handler.registerTerminal(mockTerminal);
    });

    it("pastes text from clipboard", async () => {
      const pasteSpy = vi.spyOn(mockTerminal, "paste");
      vi.mocked(Clipboard.readText).mockResolvedValue("pasted content");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => expect(pasteSpy).toHaveBeenCalledWith("pasted content"));
    });

    it("writes image file path instead of pasting text when clipboard contains image", async () => {
      const pasteSpy = vi.spyOn(mockTerminal, "paste");
      vi.mocked(Clipboard.readImageFromClipboard).mockResolvedValueOnce("/tmp/cogno_paste_abc.png");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() =>
        expect(mockPty.write).toHaveBeenCalledWith("/tmp/cogno_paste_abc.png"),
      );
      expect(pasteSpy).not.toHaveBeenCalled();
    });

    it("ignores paste event for other terminal", async () => {
      const pasteSpy = vi.spyOn(mockTerminal, "paste");

      mockBus.publish({ type: "Paste", payload: "other-id", path: ["app", "terminal"] });

      await new Promise((r) => setTimeout(r, 10));
      expect(pasteSpy).not.toHaveBeenCalled();
    });

    it("opens the composer instead of pasting when multiline text is pasted at the prompt", async () => {
      const publishSpy = vi.spyOn(mockBus, "publish");
      const pasteSpy = vi.spyOn(mockTerminal, "paste");
      vi.mocked(Clipboard.readText).mockResolvedValue("echo one\necho two");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      // Input "hello world" with cursor 5: the pasted block lands at the cursor.
      await vi.waitFor(() =>
        expect(publishSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "OpenComposer",
            payload: {
              terminalId,
              seedText: "helloecho one\necho two world",
              cursorIndex: 5 + "echo one\necho two".length,
            },
          }),
        ),
      );
      expect(pasteSpy).not.toHaveBeenCalled();
    });

    it("pastes multiline text directly while a command is running", async () => {
      (mockStateManager as { isCommandRunning: boolean }).isCommandRunning = true;
      const pasteSpy = vi.spyOn(mockTerminal, "paste");
      vi.mocked(Clipboard.readText).mockResolvedValue("echo one\necho two");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => expect(pasteSpy).toHaveBeenCalledWith("echo one\necho two"));
    });

    it("replaces selected input range when pasting over selection", async () => {
      (mockTerminal as { cols: number }).cols = 80;
      (mockTerminal.buffer.active as { length: number }).length = 2;
      vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((i) =>
        i === 0 ? TerminalMockFactory.createLine("^^#1 COGNO: / $ ") : undefined,
      );
      vi.mocked(mockSelectionHandler.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 5, y: 1 },
      });
      vi.mocked(Clipboard.readText).mockResolvedValue("bye");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      // Unified replace path: clear the whole line ("hello world", cursor 5),
      // write the recomposed text, then move the cursor after the pasted part.
      await vi.waitFor(() => {
        expect(mockPty.write).toHaveBeenNthCalledWith(1, "\x1b[C".repeat(6) + "\x08".repeat(11));
        expect(mockPty.write).toHaveBeenNthCalledWith(2, "bye world");
        expect(mockPty.write).toHaveBeenNthCalledWith(3, "\x1b[D".repeat(6));
      });
    });

    it("flattens continuations and bracket-pastes real newlines when pasting multiline text over a selection", async () => {
      // POSIX shells provide the insert sanitizer via their shell definition.
      handler.dispose();
      handler = new ClipboardHandler(
        mockBus,
        terminalId,
        mockStateManager as TerminalStateManager,
        mockPty as IPty,
        mockConfigService,
        mockSelectionHandler,
        { insertSanitizer: posixInsertSanitizer },
      );
      handler.registerTerminal(mockTerminal);
      (mockTerminal as { cols: number }).cols = 80;
      (mockTerminal.buffer.active as { length: number }).length = 2;
      vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((i) =>
        i === 0 ? TerminalMockFactory.createLine("^^#1 COGNO: / $ ") : undefined,
      );
      vi.mocked(mockSelectionHandler.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 5, y: 1 },
      });
      vi.mocked(Clipboard.readText).mockResolvedValue("echo a \\\n  b\necho c");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      // The backslash continuation is flattened; the remaining real newline is
      // wrapped in bracketed paste instead of being written raw (accept-line).
      // The recomposed text keeps the unselected input tail (" world").
      await vi.waitFor(() => {
        expect(mockPty.write).toHaveBeenNthCalledWith(
          2,
          "\x1b[200~echo a b\necho c world\x1b[201~",
        );
      });
    });

    it("uses native replaceCurrentInput when shell integration supports it", async () => {
      const lineEditor: ShellLineEditorDefinitionContract = {
        nativeActionsViaShellIntegration: ["replaceCurrentInput"],
      };
      // The static definition alone is not enough: the session must have
      // reported the action in the capability handshake.
      mockStateManager.sessionCapabilities = {
        nativeActions: ["replaceCurrentInput"],
        bracketedPaste: false,
      };
      handler = new ClipboardHandler(
        mockBus,
        terminalId,
        mockStateManager as TerminalStateManager,
        mockPty as IPty,
        mockConfigService,
        mockSelectionHandler,
        lineEditor,
      );
      handler.registerTerminal(mockTerminal);

      (mockStateManager as { input: typeof mockStateManager.input }).input = {
        text: "aaa bbb ccc",
        cursorIndex: 11,
        maxCursorIndex: 11,
      };
      (mockTerminal as { cols: number }).cols = 80;
      (mockTerminal.buffer.active as { length: number }).length = 2;
      vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((i) =>
        i === 0 ? TerminalMockFactory.createLine("^^#1 COGNO: / $ ") : undefined,
      );
      vi.mocked(mockSelectionHandler.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 4, y: 1 },
        end: { x: 7, y: 1 },
      });
      vi.mocked(Clipboard.readText).mockResolvedValue("ccc");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() =>
        expect(mockPty.executeLineEditorAction).toHaveBeenCalledWith("replaceCurrentInput", {
          text: "aaa ccc ccc",
          cursorIndex: 7,
        }),
      );
    });

    it("falls back to raw writes when the session has not reported replaceCurrentInput", async () => {
      const lineEditor: ShellLineEditorDefinitionContract = {
        nativeActionsViaShellIntegration: ["replaceCurrentInput"],
      };
      // No capability handshake for this session (sessionCapabilities stays
      // undefined) — the static definition must not enable the native path.
      handler = new ClipboardHandler(
        mockBus,
        terminalId,
        mockStateManager as TerminalStateManager,
        mockPty as IPty,
        mockConfigService,
        mockSelectionHandler,
        lineEditor,
      );
      handler.registerTerminal(mockTerminal);

      (mockTerminal as { cols: number }).cols = 80;
      (mockTerminal.buffer.active as { length: number }).length = 2;
      vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((i) =>
        i === 0 ? TerminalMockFactory.createLine("^^#1 COGNO: / $ ") : undefined,
      );
      vi.mocked(mockSelectionHandler.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 5, y: 1 },
      });
      vi.mocked(Clipboard.readText).mockResolvedValue("bye");

      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => expect(mockPty.write).toHaveBeenCalledWith("bye world"));
      expect(mockPty.executeLineEditorAction).not.toHaveBeenCalled();
    });
  });

  // ─── Copy ──────────────────────────────────────────────────────────────────

  describe("copy", () => {
    beforeEach(() => {
      vi.mocked(mockSelectionHandler.hasSelection).mockReturnValue(true);
      vi.mocked(mockSelectionHandler.getSelection).mockReturnValue("selected text");
      handler.registerTerminal(mockTerminal);
    });

    it("writes selection to clipboard on Copy event", async () => {
      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => expect(Clipboard.writeText).toHaveBeenCalledWith("selected text"));
    });

    it("trims trailing whitespace from each line when trim_trailing_spaces is true", async () => {
      vi.mocked(mockSelectionHandler.getSelection).mockReturnValue("line one   \nline two  \n  ");

      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() =>
        expect(Clipboard.writeText).toHaveBeenCalledWith("line one\nline two\n"),
      );
    });

    it("does not trim trailing whitespace when trim_trailing_spaces is false", async () => {
      handler = new ClipboardHandler(
        mockBus,
        terminalId,
        mockStateManager as TerminalStateManager,
        mockPty as IPty,
        makeConfigService({ trim_trailing_spaces: false }),
        mockSelectionHandler,
      );
      handler.registerTerminal(mockTerminal);
      vi.mocked(mockSelectionHandler.getSelection).mockReturnValue("line one   \n");

      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => expect(Clipboard.writeText).toHaveBeenCalledWith("line one   \n"));
    });

    it("clears selection after copy when clear_on_copy is true", async () => {
      handler = new ClipboardHandler(
        mockBus,
        terminalId,
        mockStateManager as TerminalStateManager,
        mockPty as IPty,
        makeConfigService({ clear_on_copy: true }),
        mockSelectionHandler,
      );
      handler.registerTerminal(mockTerminal);

      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => expect(Clipboard.writeText).toHaveBeenCalled());
      expect(mockSelectionHandler.clearSelection).toHaveBeenCalled();
    });

    it("ignores Copy event for other terminal", async () => {
      mockBus.publish({ type: "Copy", payload: "other-id", path: ["app", "terminal"] });

      await new Promise((r) => setTimeout(r, 10));
      expect(Clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  // ─── OSC 52 ────────────────────────────────────────────────────────────────

  describe("OSC 52", () => {
    let triggerOsc52: (data: string) => boolean;

    beforeEach(() => {
      vi.mocked(mockTerminal.parser.registerOscHandler).mockImplementation((code, oscHandler) => {
        if (code === 52) triggerOsc52 = oscHandler as (data: string) => boolean;
        return { dispose: vi.fn() };
      });
      handler.registerTerminal(mockTerminal);
    });

    it("registers handler for OSC 52", () => {
      expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(52, expect.any(Function));
    });

    describe("write (Pd = base64 data)", () => {
      it("writes decoded text to clipboard", async () => {
        const base64 = btoa(String.fromCharCode(...new TextEncoder().encode("Hello OSC")));
        triggerOsc52(`c;${base64}`);

        await vi.waitFor(() => expect(Clipboard.writeText).toHaveBeenCalledWith("Hello OSC"));
      });

      it("does nothing when clipboard.write is deny", async () => {
        handler = new ClipboardHandler(
          mockBus,
          terminalId,
          mockStateManager as TerminalStateManager,
          mockPty as IPty,
          makeConfigService({ write: "deny" }),
          mockSelectionHandler,
        );
        vi.mocked(mockTerminal.parser.registerOscHandler).mockImplementation((code, oscHandler) => {
          if (code === 52) triggerOsc52 = oscHandler as (data: string) => boolean;
          return { dispose: vi.fn() };
        });
        handler.registerTerminal(mockTerminal);

        const base64 = btoa(String.fromCharCode(...new TextEncoder().encode("secret")));
        triggerOsc52(`c;${base64}`);

        await new Promise((r) => setTimeout(r, 10));
        expect(Clipboard.writeText).not.toHaveBeenCalled();
      });
    });

    describe("read (Pd = ?)", () => {
      it("responds with base64-encoded clipboard contents", async () => {
        vi.mocked(Clipboard.readText).mockResolvedValue("clipboard text");

        triggerOsc52("c;?");

        await vi.waitFor(() => {
          const written = vi.mocked(mockPty.write).mock.calls[0]?.[0] as string;
          expect(written).toMatch(/^\x1b\]52;c;.+\x07$/);
          const base64 = written.slice(7, -1); // strip \x1b]52;c; and \x07
          const decoded = new TextDecoder().decode(
            Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
          );
          expect(decoded).toBe("clipboard text");
        });
      });

      it("responds with empty payload when clipboard.read is deny", async () => {
        handler = new ClipboardHandler(
          mockBus,
          terminalId,
          mockStateManager as TerminalStateManager,
          mockPty as IPty,
          makeConfigService({ read: "deny" }),
          mockSelectionHandler,
        );
        vi.mocked(mockTerminal.parser.registerOscHandler).mockImplementation((code, oscHandler) => {
          if (code === 52) triggerOsc52 = oscHandler as (data: string) => boolean;
          return { dispose: vi.fn() };
        });
        handler.registerTerminal(mockTerminal);

        triggerOsc52("c;?");

        await vi.waitFor(() => expect(mockPty.write).toHaveBeenCalledWith("\x1b]52;c;\x07"));
        expect(Clipboard.readText).not.toHaveBeenCalled();
      });
    });
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  describe("lifecycle", () => {
    it("stops handling events after dispose", () => {
      handler.registerTerminal(mockTerminal);
      handler.dispose();

      const pasteSpy = vi.spyOn(mockTerminal, "paste");
      mockBus.publish({ type: "Paste", payload: terminalId, path: ["app", "terminal"] });

      expect(pasteSpy).not.toHaveBeenCalled();
    });
  });
});
