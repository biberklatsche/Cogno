import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { TabTitleHandler } from './tab-title.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';

describe('TabTitleHandler', () => {
  let handler: TabTitleHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    handler = new TabTitleHandler(terminalId, mockBus);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe('registration', () => {
    it('should register OSC handlers for 0 and 2', () => {
      handler.register(mockTerminal);
      expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(0, expect.any(Function));
      expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(2, expect.any(Function));
    });
  });

  describe('OSC handler logic', () => {
    let publishSpy: any;

    beforeEach(() => {
      publishSpy = vi.spyOn(mockBus, 'publish');
      handler.register(mockTerminal);
    });

    it('should publish TabTitleChanged when OSC 0 is received', () => {
      const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls.find(call => 
        call[0] === 0
      )![1];

      const result = oscHandler('New Title 0');

      expect(result).toBe(true);
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TabTitleChanged',
        payload: { terminalId, title: 'New Title 0' }
      }));
    });

    it('should publish TabTitleChanged when OSC 2 is received', () => {
      const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls.find(call => 
        call[0] === 2
      )![1];

      const result = oscHandler('New Title 2');

      expect(result).toBe(true);
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TabTitleChanged',
        payload: { terminalId, title: 'New Title 2' }
      }));
    });
  });

  describe('Lifecycle', () => {
    it('should dispose all registered OSC handlers', () => {
      const disposeSpy = vi.fn();
      vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });
      
      handler.register(mockTerminal);
      handler.dispose();

      expect(disposeSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle dispose before register', () => {
        expect(() => handler.dispose()).not.toThrow();
    });
  });
});
