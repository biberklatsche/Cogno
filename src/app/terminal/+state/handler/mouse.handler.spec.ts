import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { MouseHandler } from './mouse.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { SessionState } from '../session.state';

describe('MouseHandler', () => {
  let handler: MouseHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let container: HTMLDivElement;
  let screenElement: HTMLDivElement;
  let sessionState: SessionState;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    sessionState = new SessionState(terminalId, 'Bash', mockBus);
    container = document.createElement('div');
    screenElement = document.createElement('div');
    screenElement.className = 'xterm-screen';
    container.appendChild(screenElement);
    
    // Mock getBoundingClientRect for coordinate calculations
    vi.spyOn(screenElement, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 480,
      top: 10,
      left: 10,
      bottom: 490,
      right: 810,
      x: 10,
      y: 10,
      toJSON: () => {}
    });

    handler = new MouseHandler(container, sessionState);
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  describe('registration', () => {
    it('should add mousemove listener to screen element', () => {
      const addEventListenerSpy = vi.spyOn(screenElement, 'addEventListener');
      handler.registerTerminal(mockTerminal);
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), { passive: true });
    });
  });

  describe('mouse movement', () => {
    beforeEach(() => {
      handler.registerTerminal(mockTerminal);
    });

    it('should update sessionState with correct coordinates and character', () => {
      // Setup buffer line with content
      const mockLine = TerminalMockFactory.createLine('Hello World');
      vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue(mockLine);

      // Mouse at col 1, row 1 (10, 10 in screen coords + small offset)
      // cellW = 800/80 = 10, cellH = 480/24 = 20
      // x=15 (relX=5), y=25 (relY=15) -> col=1, row=1
      const event = new MouseEvent('mousemove', {
        clientX: 15,
        clientY: 25
      });

      screenElement.dispatchEvent(event);

      expect(sessionState.mousePosition).toEqual({
        viewport: { col: 1, row: 1 },
        col: 1,
        row: 1,
        char: 'H'
      });
    });

    it('should handle viewport offset correctly', () => {
      // Update terminal with viewport offset
      const mockTerminalWithOffset = TerminalMockFactory.createTerminal({ 
        cols: 80, 
        rows: 24,
        viewportY: 10 
      });
      handler.registerTerminal(mockTerminalWithOffset);

      const mockLine = TerminalMockFactory.createLine('Viewport Line');
      vi.mocked(mockTerminalWithOffset.buffer.active.getLine).mockReturnValue(mockLine);

      // x=15, y=25 -> col=1, row=1 (viewport relative)
      // absRow = 10 + (1-1) = 10
      const event = new MouseEvent('mousemove', {
        clientX: 15,
        clientY: 25
      });

      screenElement.dispatchEvent(event);

      expect(sessionState.mousePosition.viewport.row).toBe(1);
      expect(sessionState.mousePosition.row).toBe(11); // absRow + 1
    });

    it('should clamp coordinates to terminal bounds', () => {
      handler.registerTerminal(mockTerminal);

      // Outside to the right and bottom
      const event = new MouseEvent('mousemove', {
        clientX: 1000,
        clientY: 1000
      });

      screenElement.dispatchEvent(event);

      expect(sessionState.mousePosition.viewport.col).toBe(80);
      expect(sessionState.mousePosition.viewport.row).toBe(24);
    });

    it('should handle missing buffer line or cell gracefully', () => {
      handler.registerTerminal(mockTerminal);

      vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue(undefined as any);

      const event = new MouseEvent('mousemove', { clientX: 15, clientY: 25 });
      screenElement.dispatchEvent(event);

      expect(sessionState.mousePosition.char).toBe('');
    });
  });

  describe('Lifecycle', () => {
    it('should remove event listener on dispose', () => {
      const removeEventListenerSpy = vi.spyOn(screenElement, 'removeEventListener');
      handler.registerTerminal(mockTerminal);
      handler.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });
  });
});
