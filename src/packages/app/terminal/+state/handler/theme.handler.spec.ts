import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { ThemeHandler } from './theme.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { ConfigServiceMock } from '../../../../__test__/mocks/config-service.mock';

describe('ThemeHandler', () => {
  let handler: ThemeHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockConfig: ConfigServiceMock;
  let container: HTMLDivElement;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    mockConfig = new ConfigServiceMock();
    mockConfig.setConfig({
      scrollbar: {scrollback_lines: 1000},
      font: { size: 12, family: 'monospace', weight: 'normal', weight_bold: 'bold' },
      color: { foreground: 'ffffff', highlight: '00ff00', black: '000000', red: 'ff0000', green: '00ff00', yellow: 'ffff00', blue: '0000ff', magenta: 'ff00ff', cyan: '00ffff', white: 'ffffff' },
      cursor: { width: 2, blink: true, style: 'bar', color: 'ffffff' },
      padding: { remove_on_full_screen_app: false }
    });
    container = document.createElement('div');
    handler = new ThemeHandler(terminalId, mockConfig as any, mockBus, container);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe('configureTerminal', () => {
    it('should throw error if terminal is not registered', () => {
      expect(() => handler.configureTerminal(mockConfig.config)).toThrow('Terminal has no terminal');
    });

    it('should apply config options to terminal', () => {
      handler.registerTerminal(mockTerminal);
      
      const config = { ...mockConfig.config };
      config.scrollbar!.scrollback_lines = 5000;
      config.font = { size: 14, family: 'Fira Code', weight: 'normal', weight_bold: 'bold' };
      
      handler.configureTerminal(config);

      expect(mockTerminal.options.scrollback).toBe(5000);
      expect(mockTerminal.options.fontSize).toBe(14);
      expect(mockTerminal.options.fontFamily).toContain("Fira Code");
      expect(mockTerminal.options.theme?.foreground).toBe(`#${config.color!.foreground}`);
    });

    it('should publish TerminalThemeChanged event', () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      handler.registerTerminal(mockTerminal);
      publishSpy.mockClear(); // Clear initial publish from register/configureTerminal
      handler.configureTerminal(mockConfig.config);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TerminalThemeChanged',
        path: ['app', 'terminal', terminalId]
      }));
    });
  });

  describe('bus events', () => {
    beforeEach(() => {
      handler.registerTerminal(mockTerminal);
    });

    it('should remove padding when FullScreenAppEntered and configured', () => {
      mockConfig.setConfig({
        ...mockConfig.config,
        padding: { remove_on_full_screen_app: true }
      });
      const publishSpy = vi.spyOn(mockBus, 'publish');
      
      mockBus.publish({ type: 'FullScreenAppEntered', path: ['app', 'terminal', terminalId], payload: terminalId });

      expect(container.style.getPropertyValue('--padding-xterm')).toBe('0');
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'TerminalThemePaddingRemoved' }));
    });

    it('should restore padding when FullScreenAppLeaved and configured', () => {
      mockConfig.setConfig({
        ...mockConfig.config,
        padding: { remove_on_full_screen_app: true }
      });
      container.style.setProperty('--padding-xterm', '0');
      const publishSpy = vi.spyOn(mockBus, 'publish');
      
      mockBus.publish({ type: 'FullScreenAppLeaved', path: ['app', 'terminal', terminalId], payload: terminalId });

      expect(container.style.getPropertyValue('--padding-xterm')).toBe('');
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'TerminalThemePaddingAdded' }));
    });

    it('should not change padding if not configured', () => {
      mockConfig.setConfig({
        ...mockConfig.config,
        padding: { remove_on_full_screen_app: false }
      });
      
      mockBus.publish({ type: 'FullScreenAppEntered', path: ['app', 'terminal', terminalId], payload: terminalId });

      expect(container.style.getPropertyValue('--padding-xterm')).toBe('');
    });
  });

  describe('Lifecycle', () => {
    it('should unsubscribe on dispose', () => {
      handler.registerTerminal(mockTerminal);
      const configureSpy = vi.spyOn(handler, 'configureTerminal');
      
      handler.dispose();
      mockConfig.setConfig(mockConfig.config);

      expect(configureSpy).not.toHaveBeenCalled();
    });
  });
});


