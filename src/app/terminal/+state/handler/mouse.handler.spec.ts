import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { MouseHandler } from './mouse.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';

describe('MouseHandler', () => {
  let handler: MouseHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let container: HTMLDivElement;
  let screenElement: HTMLDivElement;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
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

    handler = new MouseHandler(mockBus, container, terminalId);
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  describe('registration', () => {
    it('should add mousemove listener to screen element', () => {
      const addEventListenerSpy = vi.spyOn(screenElement, 'addEventListener');
      handler.register(mockTerminal);
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), { passive: true });
    });
  });

  describe('mouse movement', () => {
    beforeEach(() => {
      handler.register(mockTerminal);
    });

    it('should publish inspector event with correct coordinates and character', () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      
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

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'Inspector',
        payload: {
          type: 'terminal-mouse-position',
          data: {
            terminalId,
            viewportCol: 1,
            viewportRow: 1,
            char: 'H',
            col: 1,
            row: 1
          }
        }
      }));
    });

    it('should handle viewport offset correctly', () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      
      // Update terminal with viewport offset
      const mockTerminalWithOffset = TerminalMockFactory.createTerminal({ 
        cols: 80, 
        rows: 24,
        viewportY: 10 
      });
      handler.register(mockTerminalWithOffset);

      const mockLine = TerminalMockFactory.createLine('Viewport Line');
      vi.mocked(mockTerminalWithOffset.buffer.active.getLine).mockReturnValue(mockLine);

      // x=15, y=25 -> col=1, row=1 (viewport relative)
      // absRow = 10 + (1-1) = 10
      const event = new MouseEvent('mousemove', {
        clientX: 15,
        clientY: 25
      });

      screenElement.dispatchEvent(event);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
          data: expect.objectContaining({
            viewportRow: 1,
            row: 11 // absRow + 1
          })
        })
      }));
    });

    it('should clamp coordinates to terminal bounds', () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      handler.register(mockTerminal);

      // Outside to the right and bottom
      const event = new MouseEvent('mousemove', {
        clientX: 1000,
        clientY: 1000
      });

      screenElement.dispatchEvent(event);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
          data: expect.objectContaining({
            viewportCol: 80,
            viewportRow: 24
          })
        })
      }));
    });

    it('should handle missing buffer line or cell gracefully', () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      handler.register(mockTerminal);

      vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue(undefined as any);

      const event = new MouseEvent('mousemove', { clientX: 15, clientY: 25 });
      screenElement.dispatchEvent(event);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
          data: expect.objectContaining({
            char: ''
          })
        })
      }));
    });
  });

  describe('Lifecycle', () => {
    it('should remove event listener on dispose', () => {
      const removeEventListenerSpy = vi.spyOn(screenElement, 'removeEventListener');
      handler.register(mockTerminal);
      handler.dispose();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });
  });
});
