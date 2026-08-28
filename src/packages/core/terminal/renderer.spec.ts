import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Renderer, WebglContextPool } from "./renderer";
import type { TerminalMachineOptions } from "./terminal-machine.options";

let webglContextLossListener: (() => void) | undefined;
let webglContextLossDisposable: { dispose: ReturnType<typeof vi.fn> } | undefined;
let webglAddonDisposeSpy: ReturnType<typeof vi.fn> | undefined;

// Mock xterm and addons
vi.mock("@xterm/xterm", () => {
  class TerminalMock {
    loadAddon = vi.fn();
    open = vi.fn();
    dispose = vi.fn();
    unicode = { activeVersion: "" };
  }

  return {
    Terminal: vi.fn(TerminalMock),
  };
});

vi.mock("@xterm/addon-fit", () => ({ FitAddon: vi.fn() }));
vi.mock("@xterm/addon-search", () => ({ SearchAddon: vi.fn() }));
vi.mock("@xterm/addon-unicode11", () => ({ Unicode11Addon: vi.fn() }));
vi.mock("@xterm/addon-webgl", () => ({
  WebglAddon: class WebglAddonMock {
    dispose = vi.fn();

    constructor() {
      webglAddonDisposeSpy = this.dispose;
      webglContextLossDisposable = { dispose: vi.fn() };
    }

    onContextLoss(listener: () => void) {
      webglContextLossListener = listener;
      return webglContextLossDisposable;
    }
  },
}));
vi.mock("@xterm/addon-ligatures", () => ({ LigaturesAddon: vi.fn() }));

describe("Renderer", () => {
  let renderer: Renderer;
  let mockOptions: TerminalMachineOptions;

  beforeEach(() => {
    vi.useFakeTimers();
    webglContextLossListener = undefined;
    webglContextLossDisposable = undefined;
    webglAddonDisposeSpy = undefined;
    mockOptions = {
      overviewRulerWidth: 10,
      scrollbackLines: 1000,
      altClickMovesCursor: false,
      tabStopWidth: 8,
      rightClickSelectsWord: true,
      customGlyphs: true,
      drawBoldTextInBrightColors: true,
      rescaleOverlappingGlyphs: true,
    };
    renderer = new Renderer(mockOptions, "linux", new WebglContextPool());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize terminal with config", () => {
    expect(Terminal).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollback: 1000,
        tabStopWidth: 8,
      }),
    );
  });

  it("should load default addons", () => {
    const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
    expect(terminalInstance.loadAddon).toHaveBeenCalledTimes(3); // Fit, Search, Unicode
  });

  it("should register terminal handler", () => {
    const mockHandler = {
      registerTerminal: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    } as any;
    renderer.register(mockHandler);
    const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
    expect(mockHandler.registerTerminal).toHaveBeenCalledWith(terminalInstance);
  });

  it("should register fit handler", () => {
    const mockHandler = {
      registerFitAddon: vi.fn(),
      registerTerminal: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    } as any;
    renderer.register(mockHandler);
    expect(mockHandler.registerFitAddon).toHaveBeenCalled();
  });

  it("should use WebGL addon when the option asks for it", () => {
    mockOptions = { ...mockOptions, webgl: true };
    renderer = new Renderer(mockOptions, "linux", new WebglContextPool());
    const terminalInstance =
      vi.mocked(Terminal).mock.results[vi.mocked(Terminal).mock.results.length - 1].value;
    expect(webglContextLossDisposable).toBeDefined();
    expect(terminalInstance.loadAddon).toHaveBeenCalled();
  });

  it("should dispose WebGL addon on context loss", () => {
    mockOptions = { ...mockOptions, webgl: true };
    renderer = new Renderer(mockOptions, "linux", new WebglContextPool());

    webglContextLossListener?.();

    expect(webglContextLossDisposable?.dispose).toHaveBeenCalled();
    expect(webglAddonDisposeSpy).toHaveBeenCalled();
  });

  it("should try to restore WebGL after context loss", () => {
    mockOptions = { ...mockOptions, webgl: true };
    renderer = new Renderer(mockOptions, "linux", new WebglContextPool());
    const terminalInstance =
      vi.mocked(Terminal).mock.results[vi.mocked(Terminal).mock.results.length - 1].value;

    webglContextLossListener?.();
    vi.runOnlyPendingTimers();

    expect(terminalInstance.loadAddon).toHaveBeenCalledTimes(5);
  });

  it("should expose WebGL context loss state during restore", () => {
    mockOptions = { ...mockOptions, webgl: true };
    renderer = new Renderer(mockOptions, "linux", new WebglContextPool());
    const states: boolean[] = [];
    const subscription = renderer.isWebglContextLost$.subscribe((state) => states.push(state));

    webglContextLossListener?.();
    vi.runOnlyPendingTimers();

    expect(states).toEqual([false, true, false]);
    subscription.unsubscribe();
  });

  it("should keep the WebGL addon alive when becoming invisible", () => {
    mockOptions = { ...mockOptions, webgl: true };
    renderer = new Renderer(mockOptions, "linux", new WebglContextPool());
    const terminalInstance =
      vi.mocked(Terminal).mock.results[vi.mocked(Terminal).mock.results.length - 1].value;
    const loadAddonCallsBefore = terminalInstance.loadAddon.mock.calls.length;

    renderer.setVisible(false);
    expect(webglAddonDisposeSpy).not.toHaveBeenCalled();

    // Switching back must not rebuild the context.
    renderer.setVisible(true);
    expect(terminalInstance.loadAddon.mock.calls.length).toBe(loadAddonCallsBefore);
  });

  it("should recreate the WebGL addon on becoming visible after a pool eviction", () => {
    mockOptions = { ...mockOptions, webgl: true };
    const pool = new WebglContextPool(1);
    renderer = new Renderer(mockOptions, "linux", pool);
    renderer.setVisible(false);
    const firstAddonDisposeSpy = webglAddonDisposeSpy;

    // A second renderer exceeds the budget of 1 and evicts the hidden one.
    const evictingRenderer = new Renderer(mockOptions, "linux", pool);
    expect(firstAddonDisposeSpy).toHaveBeenCalled();

    const terminalInstance =
      vi.mocked(Terminal).mock.results[vi.mocked(Terminal).mock.results.length - 2].value;
    const loadAddonCallsBefore = terminalInstance.loadAddon.mock.calls.length;
    renderer.setVisible(true);
    expect(terminalInstance.loadAddon.mock.calls.length).toBeGreaterThan(loadAddonCallsBefore);
    evictingRenderer.dispose();
  });

  it("should evict hidden members before visible ones when over budget", () => {
    const pool = new WebglContextPool(2);
    const makeMember = (visible: boolean) => ({
      isVisible: () => visible,
      dropWebglContext: vi.fn(),
    });

    const hiddenMember = makeMember(false);
    const oldestVisibleMember = makeMember(true);
    const newestMember = makeMember(true);

    pool.registerActive(oldestVisibleMember);
    pool.registerActive(hiddenMember);
    pool.registerActive(newestMember);

    expect(hiddenMember.dropWebglContext).toHaveBeenCalled();
    expect(oldestVisibleMember.dropWebglContext).not.toHaveBeenCalled();
    expect(newestMember.dropWebglContext).not.toHaveBeenCalled();
  });

  it("should cancel a pending WebGL restore when becoming invisible", () => {
    mockOptions = { ...mockOptions, webgl: true };
    renderer = new Renderer(mockOptions, "linux", new WebglContextPool());
    const terminalInstance =
      vi.mocked(Terminal).mock.results[vi.mocked(Terminal).mock.results.length - 1].value;

    webglContextLossListener?.();
    renderer.setVisible(false);
    const loadAddonCallsAfterHide = terminalInstance.loadAddon.mock.calls.length;

    vi.runOnlyPendingTimers();

    expect(terminalInstance.loadAddon.mock.calls.length).toBe(loadAddonCallsAfterHide);
  });

  it("should not dispose the WebGL addon when becoming invisible if WebGL is disabled", () => {
    renderer.setVisible(false);
    expect(webglAddonDisposeSpy).toBeUndefined();
  });

  it("should open terminal in container and use ligatures if enabled", () => {
    const container = document.createElement("div");
    const terminalInstance = vi.mocked(Terminal).mock.results[0].value;

    renderer.open(container, true);

    expect(terminalInstance.open).toHaveBeenCalledWith(container);
    expect(terminalInstance.loadAddon).toHaveBeenCalled(); // Ligatures addon
  });

  it("should dispose terminal", () => {
    renderer.dispose();
    const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
    expect(terminalInstance.dispose).toHaveBeenCalled();
  });
});
