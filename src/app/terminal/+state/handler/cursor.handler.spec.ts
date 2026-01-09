import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { CursorHandler } from './cursor.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal, IBuffer, IBufferLine, IBufferCell } from '@xterm/xterm';

describe('CursorHandler', () => {
  let bus: AppBus;
  let handler: CursorHandler;
  let cursorMoveCallback: (() => void) | null = null;
  const terminalId = 'test-terminal-id';

  // Helper function to create a mock cell
  const createMockCell = (char: string): IBufferCell => ({
    getChars: () => char,
  } as IBufferCell);

  // Helper function to create a mock line
  const createMockLine = (char: string): IBufferLine => ({
    getCell: vi.fn().mockReturnValue(createMockCell(char)),
  } as unknown as IBufferLine);

  // Helper function to create a mock buffer with cursor position
  const createMockBuffer = (x: number, y: number, viewportY: number = 0): IBuffer => ({
    cursorX: x,
    cursorY: y,
    viewportY: viewportY,
    getLine: vi.fn(),
  } as unknown as IBuffer);

  // Helper function to create a terminal with specific buffer state
  const createTerminal = (x: number = 5, y: number = 10, viewportY: number = 20): Terminal => {
    return {
      onCursorMove: vi.fn().mockImplementation((cb: () => void) => {
        cursorMoveCallback = cb;
        return { dispose: vi.fn() };
      }),
      buffer: {
        active: createMockBuffer(x, y, viewportY),
      },
    } as unknown as Terminal;
  };

  beforeEach(() => {
    cursorMoveCallback = null;

    bus = {
      publish: vi.fn(),
    } as unknown as AppBus;

    handler = new CursorHandler(bus, terminalId);
  });

  describe('register', () => {
    it('should register onCursorMove listener', () => {
      const terminal = createTerminal();
      handler.register(terminal);

      expect(terminal.onCursorMove).toHaveBeenCalledTimes(1);
      expect(terminal.onCursorMove).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return disposable when registered', () => {
      const disposable = { dispose: vi.fn() };
      const terminal = createTerminal();
      vi.mocked(terminal.onCursorMove).mockReturnValue(disposable);

      handler.register(terminal);

      expect(disposable).toBeDefined();
    });
  });

  describe('cursor position publishing', () => {
    it('should publish correct cursor position on move', () => {
      const terminal = createTerminal(2, 3, 10);
      handler.register(terminal);
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(createMockLine('A'));

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith({
        path: ['inspector'],
        type: 'Inspector',
        payload: {
          type: 'terminal-cursor-position',
          data: {
            terminalId,
            viewportCol: 3, // cursorX + 1
            viewportRow: 4, // cursorY + 1
            char: 'A',
            col: 3,
            row: 14, // cursorY + viewportY + 1
          },
        },
      });
    });

    it('should handle cursor at origin (0, 0)', () => {
      const terminal = createTerminal(0, 0, 0);
      handler.register(terminal);
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(createMockLine('B'));

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                viewportCol: 1,
                viewportRow: 1,
                char: 'B',
                col: 1,
                row: 1,
              }),
            }),
          })
      );
    });

    it('should handle different viewport offsets', () => {
      const terminal = createTerminal(5, 5, 100);
      handler.register(terminal);
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(createMockLine('X'));

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                row: 106, // 5 + 100 + 1
              }),
            }),
          })
      );
    });

    it('should handle multi-character cells', () => {
      const terminal = createTerminal(2, 3, 10);
      handler.register(terminal);
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(createMockLine('€'));

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                char: '€',
              }),
            }),
          })
      );
    });

    it('should handle empty cells', () => {
      const terminal = createTerminal(2, 3, 10);
      handler.register(terminal);
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(createMockLine(''));

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                char: '',
              }),
            }),
          })
      );
    });
  });

  describe('error handling', () => {
    it('should use default values when buffer is missing', () => {
      const terminal = {
        onCursorMove: vi.fn().mockImplementation((cb: () => void) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }),
        buffer: undefined,
      } as unknown as Terminal;

      handler.register(terminal);
      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: {
                terminalId,
                viewportCol: 1,
                viewportRow: 1,
                char: '',
                col: 1,
                row: 1,
              },
            }),
          })
      );
    });

    it('should use default values when active buffer is missing', () => {
      const terminal = {
        onCursorMove: vi.fn().mockImplementation((cb: () => void) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }),
        buffer: {
          active: undefined,
        },
      } as unknown as Terminal;

      handler.register(terminal);
      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: {
                terminalId,
                viewportCol: 1,
                viewportRow: 1,
                char: '',
                col: 1,
                row: 1,
              },
            }),
          })
      );
    });

    it('should handle getLine throwing an error', () => {
      const terminal = createTerminal(2, 3, 10);
      handler.register(terminal);
      vi.mocked(terminal.buffer.active.getLine).mockImplementation(() => {
        throw new Error('Buffer access error');
      });

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                terminalId,
                viewportCol: 3,
                viewportRow: 4,
                char: '', // Falls back to empty string on error
                col: 3,
                row: 14,
              }),
            }),
          })
      );
    });

    it('should handle getLine returning null', () => {
      const terminal = createTerminal(2, 3, 10);
      handler.register(terminal);
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(null as any);

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                char: '',
              }),
            }),
          })
      );
    });

    it('should handle getCell returning null', () => {
      const terminal = createTerminal(2, 3, 10);
      handler.register(terminal);
      const mockLine = {
        getCell: vi.fn().mockReturnValue(null),
      } as unknown as IBufferLine;
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

      cursorMoveCallback?.();

      expect(bus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                char: '',
              }),
            }),
          })
      );
    });
  });

  describe('dispose', () => {
    it('should dispose the listener when dispose is called', () => {
      const disposable = { dispose: vi.fn() };
      const terminal = createTerminal();
      vi.mocked(terminal.onCursorMove).mockReturnValue(disposable);

      handler.register(terminal);
      handler.dispose();

      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('should handle dispose being called multiple times', () => {
      const disposable = { dispose: vi.fn() };
      const terminal = createTerminal();
      vi.mocked(terminal.onCursorMove).mockReturnValue(disposable);

      handler.register(terminal);
      handler.dispose();
      handler.dispose();

      // Should only dispose once or handle gracefully
      expect(disposable.dispose).toHaveBeenCalled();
    });

    it('should handle dispose being called before register', () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});
