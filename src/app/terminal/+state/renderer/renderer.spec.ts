import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Renderer } from './renderer';
import { Config } from '../../../config/+models/config';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';

// Mock xterm and addons
vi.mock('@xterm/xterm', () => {
    return {
        Terminal: vi.fn().mockImplementation(() => ({
            loadAddon: vi.fn(),
            open: vi.fn(),
            dispose: vi.fn(),
            unicode: { activeVersion: '' }
        }))
    };
});

vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn() }));
vi.mock('@xterm/addon-search', () => ({ SearchAddon: vi.fn() }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: vi.fn() }));
vi.mock('@xterm/addon-webgl', () => ({ WebglAddon: vi.fn() }));
vi.mock('@xterm/addon-canvas', () => ({ CanvasAddon: vi.fn() }));

describe('Renderer', () => {
    let renderer: Renderer;
    let mockConfig: Config;

    beforeEach(() => {
        mockConfig = {
            overview_ruler_width: 10,
            scrollback_lines: 1000,
            tab_stop_width: 8,
            font: {
                custom_glyphs: true,
                drawBoldTextInBrightColors: true,
                rescaleOverlappingGlyphs: true
            }
        } as any;
        renderer = new Renderer(mockConfig);
    });

    it('should initialize terminal with config', () => {
        expect(Terminal).toHaveBeenCalledWith(expect.objectContaining({
            scrollback: 1000,
            tabStopWidth: 8
        }));
    });

    it('should load default addons', () => {
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        expect(terminalInstance.loadAddon).toHaveBeenCalledTimes(4); // Fit, Search, Unicode, Webgl/Canvas
    });

    it('should register terminal handler', () => {
        const mockHandler = {
            registerTerminal: vi.fn().mockReturnValue({ dispose: vi.fn() })
        } as any;
        renderer.register(mockHandler);
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        expect(mockHandler.registerTerminal).toHaveBeenCalledWith(terminalInstance);
    });

    it('should register fit handler', () => {
        const mockHandler = {
            registerFitAddon: vi.fn(),
            registerTerminal: vi.fn().mockReturnValue({ dispose: vi.fn() })
        } as any;
        renderer.register(mockHandler);
        expect(mockHandler.registerFitAddon).toHaveBeenCalled();
    });

    it('should use WebGL addon', () => {
        renderer.useWebGl();
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        expect(WebglAddon).toHaveBeenCalled();
        expect(terminalInstance.loadAddon).toHaveBeenCalled();
    });

    it('should use Canvas addon', () => {
        renderer.useCanvas();
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        expect(CanvasAddon).toHaveBeenCalled();
        expect(terminalInstance.loadAddon).toHaveBeenCalled();
    });

    it('should open terminal in container', () => {
        const container = document.createElement('div');
        renderer.open(container);
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        expect(terminalInstance.open).toHaveBeenCalledWith(container);
    });

    it('should dispose terminal', () => {
        renderer.dispose();
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        expect(terminalInstance.dispose).toHaveBeenCalled();
    });
});
