import { Terminal, IBuffer, IBufferLine, IBufferCell } from '@xterm/xterm';
import { vi } from 'vitest';

export interface TerminalMockOptions {
  cursorX?: number;
  cursorY?: number;
  viewportY?: number;
  cols?: number;
  rows?: number;
  onCursorMove?: (callback: () => void) => { dispose: () => void };
  onData?: (callback: (data: string) => void) => { dispose: () => void };
  onResize?: (callback: (event: { cols: number; rows: number }) => void) => { dispose: () => void };
  onTitleChange?: (callback: (title: string) => void) => { dispose: () => void };
  onSelectionChange?: (callback: () => void) => { dispose: () => void };
  onWriteParsed?: (callback: () => void) => { dispose: () => void };
  onKey?: (callback: (event: { key: string; domEvent: KeyboardEvent }) => void) => { dispose: () => void };
  onScroll?: (callback: () => void) => { dispose: () => void };
  onRender?: (callback: (event: { start: number; end: number }) => void) => { dispose: () => void };
}

export interface BufferMockOptions {
  cursorX?: number;
  cursorY?: number;
  viewportY?: number;
  baseY?: number;
  length?: number;
}

export interface CellMockOptions {
  width?: number;
  isCombined?: boolean;
}

export class TerminalMockFactory {
  static createTerminal(options: TerminalMockOptions = {}): Terminal {
    const {
      cursorX = 0,
      cursorY = 0,
      viewportY = 0,
      cols = 80,
      rows = 24,
      onCursorMove = () => ({ dispose: vi.fn() }),
      onData = () => ({ dispose: vi.fn() }),
      onResize = () => ({ dispose: vi.fn() }),
      onTitleChange = () => ({ dispose: vi.fn() }),
      onSelectionChange = () => ({ dispose: vi.fn() }),
      onWriteParsed = () => ({ dispose: vi.fn() }),
      onKey = () => ({ dispose: vi.fn() }),
      onScroll = () => ({ dispose: vi.fn() }),
      onRender = () => ({ dispose: vi.fn() }),
    } = options;

    const buffer = this.createBuffer({ cursorX, cursorY, viewportY });

    return {
      cols,
      rows,
      buffer: {
        active: buffer,
        normal: buffer,
        alternate: buffer,
      },
      onCursorMove: vi.fn().mockImplementation(onCursorMove),
      onData: vi.fn().mockImplementation(onData),
      onResize: vi.fn().mockImplementation(onResize),
      onTitleChange: vi.fn().mockImplementation(onTitleChange),
      onSelectionChange: vi.fn().mockImplementation(onSelectionChange),
      onWriteParsed: vi.fn().mockImplementation(onWriteParsed),
      onKey: vi.fn().mockImplementation(onKey),
      onScroll: vi.fn().mockImplementation(onScroll),
      onRender: vi.fn().mockImplementation(onRender),
      parser: {
        registerCsiHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        registerDcsHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        registerEscHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        registerOscHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      },
      focus: vi.fn(),
      blur: vi.fn(),
      resize: vi.fn(),
      write: vi.fn(),
      writeln: vi.fn(),
      clear: vi.fn(),
      scrollToLine: vi.fn(),
      scrollToBottom: vi.fn(),
      scrollToTop: vi.fn(),
      input: vi.fn(),
      paste: vi.fn(),
      dispose: vi.fn(),
      getSelection: vi.fn(),
      getSelectionPosition: vi.fn(),
      hasSelection: vi.fn(),
      clearSelection: vi.fn(),
      select: vi.fn(),
      attachCustomKeyEventHandler: vi.fn(),
      registerLinkProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      registerMarker: vi.fn().mockImplementation((cursorYOffset?: number) => ({
        id: cursorYOffset ?? 0,
        line: (buffer.baseY ?? 0) + (buffer.cursorY ?? 0) + (cursorYOffset ?? 0),
        isDisposed: false,
        onDispose: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
      })),
      registerDecoration: vi.fn().mockImplementation((decorationOptions: { marker: { line: number } }) => ({
        marker: decorationOptions.marker,
        element: undefined,
        options: {},
        isDisposed: false,
        onRender: vi.fn().mockImplementation((listener: (element: HTMLElement) => void) => {
          listener(document.createElement('div'));
          return { dispose: vi.fn() };
        }),
        onDispose: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
      })),
      options: {},
      element: document.createElement('div'),
      textarea: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        focus: vi.fn(),
        blur: vi.fn(),
      } as unknown as HTMLTextAreaElement,
    } as unknown as Terminal;
  }

  static createBuffer(options: BufferMockOptions = {}): IBuffer {
    const {
      cursorX = 0,
      cursorY = 0,
      viewportY = 0,
      baseY = 0,
      length = 100,
    } = options;

    return {
      cursorX,
      cursorY,
      viewportY,
      baseY,
      length,
      getLine: vi.fn(),
      getNullCell: vi.fn(() => this.createCell('')),
    } as unknown as IBuffer;
  }

  static createLine(content: string | IBufferCell[]): IBufferLine {
    const cells = typeof content === 'string'
      ? content.split('').map(char => this.createCell(char))
      : content;

    return {
      length: cells.length,
      getCell: vi.fn((index: number) => cells[index] || null),
      translateToString: vi.fn((trimRight?: boolean, startColumn?: number, endColumn?: number) => {
        let str = typeof content === 'string' ? content : cells.map(c => c.getChars()).join('');
        if (startColumn !== undefined || endColumn !== undefined) {
          str = str.substring(startColumn || 0, endColumn);
        }
        if (trimRight) {
          str = str.trimEnd();
        }
        return str;
      }),
      isWrapped: false,
    } as unknown as IBufferLine;
  }

  static createCell(char: string, options: CellMockOptions = {}): IBufferCell {
    const { width = char.length > 0 ? 1 : 0, isCombined = false } = options;

    return {
      getChars: () => char,
      getWidth: () => width,
      isCombined: () => (isCombined ? 1 : 0),
      getCode: () => char.charCodeAt(0) || 0,
      getFgColorMode: () => 0,
      getBgColorMode: () => 0,
      getFgColor: () => -1,
      getBgColor: () => -1,
      isBold: () => 0,
      isItalic: () => 0,
      isDim: () => 0,
      isUnderline: () => 0,
      isBlink: () => 0,
      isInverse: () => 0,
      isInvisible: () => 0,
      isStrikethrough: () => 0,
      isOverline: () => 0,
      isFgRGB: () => false,
      isBgRGB: () => false,
      isFgPalette: () => false,
      isBgPalette: () => false,
      isFgDefault: () => true,
      isBgDefault: () => true,
      isAttributeDefault: () => true,
    } as unknown as IBufferCell;
  }

  static createLineWithContent(
    content: string,
    cursorPosition?: number
  ): IBufferLine {
    return this.createLine(content);
  }
}
