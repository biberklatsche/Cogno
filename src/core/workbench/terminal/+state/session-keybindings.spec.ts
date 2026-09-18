import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import type { SuggestorRegistry } from "@cogno/core/session/autocomplete/suggestor-registry";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { SessionKeybindings } from "./session-keybindings";

vi.mock("@cogno/core/terminal/renderer", () => {
  class RendererMock {
    open = vi.fn();
    register = vi.fn().mockReturnValue({ dispose: vi.fn() });
    dispose = vi.fn();
    setVisible = vi.fn();
    setOptions = vi.fn();
    restoreCursorColor = vi.fn();
    terminal = TerminalMockFactory.createTerminal();
    isWebglContextLost$ = new BehaviorSubject(false);
  }
  return { Renderer: vi.fn(RendererMock) };
});

vi.mock("@cogno/core/terminal/pty", () => {
  class PtyMock {
    dispose = vi.fn();
    write = vi.fn();
    spawn = vi.fn().mockResolvedValue(undefined);
    onExit = vi.fn().mockReturnValue({ dispose: vi.fn() });
    kill = vi.fn();
    faults$ = new Subject();
  }
  return { Pty: vi.fn(PtyMock) };
});

const osStub = { platform: () => "linux" } as unknown as OsPlatform;
const environmentStub = { isDevMode: () => false } as never;
const clipboardStub = { writeText: vi.fn(async () => undefined) } as unknown as ClipboardAccess;
const terminalId = "test-terminal-id";

const bashProfile: ShellProfile = {
  shell_type: "Bash",
  inject_cogno_cli: false,
  enable_shell_integration: false,
  load_user_rc: false,
};

describe("SessionKeybindings", () => {
  let host: SessionHost;
  let keybindings: SessionKeybindings;
  let configService: ConfigServiceMock;
  let preloadForShellIntegration: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigServiceMock();
    configService.setConfig({ font: { enable_ligatures: false } } as never);

    host = new SessionHost(
      osStub,
      environmentStub,
      clipboardStub,
      configService as unknown as ConfigService,
      {} as never,
      { openAtElement: vi.fn() },
      {} as never,
      new TerminalCommandHistoryStore(),
      {
        initialize: vi.fn(),
        onCwdChanged: vi.fn(),
        onCommandExecuted: vi.fn(),
      } as unknown as CommandRecorder,
    );

    preloadForShellIntegration = vi.fn();
    keybindings = new SessionKeybindings(
      host,
      { preloadForShellIntegration } as unknown as SuggestorRegistry,
      { triggerAutocomplete: vi.fn(async () => false), cycleTab: vi.fn(() => false) } as never,
      { triggerCommandHistory: vi.fn(async () => false), cycleTab: vi.fn(() => false) } as never,
    );

    host.initialize(terminalId, bashProfile);
    keybindings.start(terminalId, bashProfile);
  });

  describe("lifecycle", () => {
    it("preloads the autocomplete when the integration is on", () => {
      expect(preloadForShellIntegration).not.toHaveBeenCalled();

      const withIntegration = { ...bashProfile, enable_shell_integration: true };
      keybindings.start("other-terminal", withIntegration);

      expect(preloadForShellIntegration).toHaveBeenCalledWith("Bash");
    });
  });
});
