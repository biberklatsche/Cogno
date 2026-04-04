import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Renderer } from './renderer';
import { Config } from '../../../config/+models/config';
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';

// Mock xterm and addons
vi.mock('@xterm/xterm', () => {
    return {
        Terminal: vi.fn().mockImplementation(function() {
            return {
                loadAddon: vi.fn(),
                open: vi.fn(),
                dispose: vi.fn(),
                unicode: { activeVersion: '' }
            };
        })
    };
});

vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn() }));
vi.mock('@xterm/addon-search', () => ({ SearchAddon: vi.fn() }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: vi.fn() }));
vi.mock('@xterm/addon-webgl', () => ({ WebglAddon: vi.fn() }));
vi.mock('@xterm/addon-ligatures', () => ({ LigaturesAddon: vi.fn() }));

describe('Renderer', () => {
    let renderer: Renderer;
    let mockConfig: Config;

    beforeEach(() => {
        mockConfig = {
            scrollbar: {
                width: 10,
                scrollback_lines: 1000,
            },
            cursor: {
                alt_click_moves_cursor: false
            },
            terminal: {
                tab_stop_width: 8,
            },
            selection: {
                right_click_selects_word: true
            },
            font: {
                custom_glyphs: true,
                draw_bold_text_in_bright_colors: true,
                rescale_overlapping_glyphs: true
            }
        };
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
        expect(terminalInstance.loadAddon).toHaveBeenCalledTimes(3); // Fit, Search, Unicode
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

    it('should use WebGL addon if enabled in config', () => {
        mockConfig.terminal = { ...(mockConfig.terminal ?? {}), webgl: true };
        renderer = new Renderer(mockConfig);
        const terminalInstance = vi.mocked(Terminal).mock.results[vi.mocked(Terminal).mock.results.length - 1].value;
        expect(WebglAddon).toHaveBeenCalled();
        expect(terminalInstance.loadAddon).toHaveBeenCalled();
    });

    it('should open terminal in container and use ligatures if enabled', () => {
        const container = document.createElement('div');
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        
        renderer.open(container, true);
        
        expect(terminalInstance.open).toHaveBeenCalledWith(container);
        expect(terminalInstance.loadAddon).toHaveBeenCalled(); // Ligatures addon
    });

    it('should dispose terminal', () => {
        renderer.dispose();
        const terminalInstance = vi.mocked(Terminal).mock.results[0].value;
        expect(terminalInstance.dispose).toHaveBeenCalled();
    });
});


