import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CursorHandler } from './cursor.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';

describe('CursorHandler', () => {
  let bus: AppBus;
  let handler: CursorHandler;
  let cursorMoveCallback: (() => void) | null = null;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    cursorMoveCallback = null;

    bus = {
      publish: vi.fn(),
    } as unknown as AppBus;

    handler = new CursorHandler(bus, terminalId);
  });

  describe('register', () => {
    it('should register onCursorMove listener', () => {
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      handler.register(terminal);

      expect(terminal.onCursorMove).toHaveBeenCalledTimes(1);
      expect(terminal.onCursorMove).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return disposable when registered', () => {
      const disposable = { dispose: vi.fn() };
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: () => disposable
      });

      const result = handler.register(terminal);

      expect(result).toBeDefined();
    });
  });

  describe('cursor position publishing', () => {
    it('should publish correct cursor position on move', () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      handler.register(terminal);

      const mockLine = TerminalMockFactory.createLine('  A'); // A at index 2
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

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
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 0,
        cursorY: 0,
        viewportY: 0,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      handler.register(terminal);

      const mockLine = TerminalMockFactory.createLine('B');
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

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
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 5,
        cursorY: 5,
        viewportY: 100,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      handler.register(terminal);

      const mockLine = TerminalMockFactory.createLine('X');
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

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
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      handler.register(terminal);

      const mockLine = TerminalMockFactory.createLine('  €'); // Euro at index 2
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

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
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      handler.register(terminal);

      const mockLine = TerminalMockFactory.createLine('');
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

  describe('error handling', () => {
    it('should use default values when buffer is missing', () => {
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      // @ts-ignore - manual override for error case
      terminal.buffer = undefined;

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
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      // @ts-ignore - manual override for error case
      terminal.buffer.active = undefined;

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
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
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
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
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
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        }
      });
      handler.register(terminal);

      const mockLine = TerminalMockFactory.createLine('ABC');
      vi.mocked(mockLine.getCell).mockReturnValue(null);
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
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: () => disposable
      });

      handler.register(terminal);
      handler.dispose();

      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('should handle dispose being called multiple times', () => {
      const disposable = { dispose: vi.fn() };
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: () => disposable
      });

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
