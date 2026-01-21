import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { FocusHandler } from './focus.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { clear, getAppBus, getFocusHandler } from '../../../../__test__/test-factory';

describe('FocusHandler', () => {
  let handler: FocusHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    clear();
    mockBus = getAppBus();
    handler = getFocusHandler(terminalId);
  });

  describe('registration', () => {
    it('should register event listeners on terminal textarea', () => {
      mockTerminal = TerminalMockFactory.createTerminal();
      const addEventListenerSpy = vi.spyOn(mockTerminal.textarea!, 'addEventListener');
      
      handler.registerTerminal(mockTerminal);

      expect(addEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('should update hasFocus when textarea focus event fires', () => {
      mockTerminal = TerminalMockFactory.createTerminal();
      handler.registerTerminal(mockTerminal);

      const focusCallback = vi.mocked(mockTerminal.textarea!.addEventListener).mock.calls.find(call => call[0] === 'focus')![1] as Function;
      focusCallback();

      expect(handler.hasFocus()).toBe(true);
    });

    it('should update hasFocus when textarea blur event fires', () => {
      mockTerminal = TerminalMockFactory.createTerminal();
      handler.registerTerminal(mockTerminal);

      const focusCallback = vi.mocked(mockTerminal.textarea!.addEventListener).mock.calls.find(call => call[0] === 'focus')![1] as Function;
      const blurCallback = vi.mocked(mockTerminal.textarea!.addEventListener).mock.calls.find(call => call[0] === 'blur')![1] as Function;
      
      focusCallback();
      expect(handler.hasFocus()).toBe(true);

      blurCallback();
      expect(handler.hasFocus()).toBe(false);
    });
  });

  describe('bus events', () => {
    beforeEach(() => {
      mockTerminal = TerminalMockFactory.createTerminal();
      handler.registerTerminal(mockTerminal);
    });

    it('should focus terminal when FocusTerminal event for this id is received', () => {
      const focusSpy = vi.spyOn(mockTerminal, 'focus');
      const publishSpy = vi.spyOn(mockBus, 'publish');

      mockBus.publish({ type: 'FocusTerminal', payload: terminalId, path: ['app', 'terminal'], phase: 'target' });

      expect(focusSpy).toHaveBeenCalled();
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'TerminalFocused', payload: terminalId }));
    });

    it('should blur terminal when FocusTerminal event for other id is received', () => {
      const blurSpy = vi.spyOn(mockTerminal, 'blur');
      const publishSpy = vi.spyOn(mockBus, 'publish');

      mockBus.publish({ type: 'FocusTerminal', payload: 'other-id', path: ['app', 'terminal'], phase: 'target' });

      expect(blurSpy).toHaveBeenCalled();
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'TerminalBlurred', payload: terminalId }));
    });

    it('should focus terminal when PtyInitialized event is received', () => {
      const focusSpy = vi.spyOn(mockTerminal, 'focus');
      
      mockBus.publish({ type: 'PtyInitialized', payload: terminalId, path: ['app', 'terminal', terminalId], phase: 'target' });

      expect(focusSpy).toHaveBeenCalled();
    });

    it('should blur terminal when BlurTerminal event for this id is received', () => {
      const blurSpy = vi.spyOn(mockTerminal, 'blur');
      
      mockBus.publish({ type: 'BlurTerminal', payload: terminalId, path: ['app', 'terminal'], phase: 'target' });

      expect(blurSpy).toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should unsubscribe on dispose', () => {
      mockTerminal = TerminalMockFactory.createTerminal();
      handler.registerTerminal(mockTerminal);
      
      const focusSpy = vi.spyOn(mockTerminal, 'focus');
      handler.dispose();

      mockBus.publish({ type: 'FocusTerminal', payload: terminalId, path: ['app', 'terminal'], phase: 'target' });

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });
});
