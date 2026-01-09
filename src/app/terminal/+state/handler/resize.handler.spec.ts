import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { ResizeHandler } from './resize.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { IPty } from '../pty/pty';
import { FitAddon } from '@xterm/addon-fit';

describe('ResizeHandler', () => {
  let handler: ResizeHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockPty: IPty;
  let mockFitAddon: FitAddon;
  let container: HTMLDivElement;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    vi.useFakeTimers();
    mockBus = new AppBus();
    mockPty = {
      resize: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPty;
    
    container = document.createElement('div');
    
    mockFitAddon = {
      proposeDimensions: vi.fn(),
      fit: vi.fn(),
    } as unknown as FitAddon;

    handler = new ResizeHandler(terminalId, mockPty, mockBus, container);
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registration', () => {
    it('should setup ResizeObserver and subscribe to bus', () => {
      const observeSpy = vi.spyOn(ResizeObserver.prototype, 'observe');
      const subscribeSpy = vi.spyOn(mockBus, 'on$');

      handler.register(mockTerminal, mockFitAddon);

      expect(observeSpy).toHaveBeenCalledWith(container, { box: 'content-box' });
      expect(subscribeSpy).toHaveBeenCalled();
    });
  });

  describe('resize logic', () => {
    it('should not call fit if dimensions are equal', () => {
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 80, rows: 24 });
      
      handler.resize(mockTerminal, mockFitAddon);

      expect(mockFitAddon.fit).not.toHaveBeenCalled();
    });

    it('should call fit and notify PTY when dimensions change', () => {
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 100, rows: 30 });
      
      // We need to simulate terminal updating its cols/rows after fit()
      vi.mocked(mockFitAddon.fit).mockImplementation(() => {
        (mockTerminal as any).cols = 100;
        (mockTerminal as any).rows = 30;
      });

      handler.resize(mockTerminal, mockFitAddon);

      expect(mockFitAddon.fit).toHaveBeenCalled();
      
      // PTY resize is debounced with setTimeout
      vi.runAllTimers();
      expect(mockPty.resize).toHaveBeenCalledWith({ cols: 100, rows: 30 });
    });

    it('should publish inspector event on resize', () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 100, rows: 30 });
      vi.mocked(mockFitAddon.fit).mockImplementation(() => {
        (mockTerminal as any).cols = 100;
        (mockTerminal as any).rows = 30;
      });

      handler.resize(mockTerminal, mockFitAddon);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'Inspector',
        payload: {
          type: 'terminal-dimensions',
          data: { terminalId, cols: 100, rows: 30 }
        }
      }));
    });

    it('should throw error if terminal does not match proposed dimensions after fit', () => {
        vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 100, rows: 30 });
        // terminal remains 80x24
        
        expect(() => handler.resize(mockTerminal, mockFitAddon)).toThrow('dimensions are not equal!');
    });
  });

  describe('bus events', () => {
    it('should trigger resize on TerminalThemeChanged', () => {
        handler.register(mockTerminal, mockFitAddon);
        const resizeSpy = vi.spyOn(handler, 'resize');
        
        mockBus.publish({ type: 'TerminalThemeChanged', path: ['app', 'terminal', terminalId] });
        
        vi.runAllTimers();
        expect(resizeSpy).toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should disconnect observer and unsubscribe on dispose', () => {
      const disconnectSpy = vi.spyOn(ResizeObserver.prototype, 'disconnect');
      handler.register(mockTerminal, mockFitAddon);
      handler.dispose();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
