import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalSession } from './terminal.session';
import { AppBus } from '../../app-bus/app-bus';
import { BehaviorSubject } from 'rxjs';
import { ShellConfig } from '../../config/+models/config';

import { Renderer } from './renderer/renderer';

// Mocking dependencies that are not passed in constructor but used internally
vi.mock('./renderer/renderer', () => {
    return {
        Renderer: vi.fn().mockImplementation(function() {
            return {
                open: vi.fn(),
                register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                dispose: vi.fn()
            };
        })
    };
});

vi.mock('./pty/pty', () => {
    return {
        Pty: vi.fn().mockImplementation(function() {
            return {
                dispose: vi.fn(),
                write: vi.fn(),
                spawn: vi.fn().mockResolvedValue(undefined)
            };
        })
    };
});

describe('TerminalSession', () => {
    let session: TerminalSession;
    let mockConfigService: any;
    let mockBus: AppBus;
    let mockShellConfig: ShellConfig;
    const terminalId = 'test-terminal-id';

    beforeEach(() => {
        const configSubject = new BehaviorSubject<any>({ enable_webgl: false });
        mockConfigService = {
            config: { enable_webgl: false },
            config$: configSubject, // Use Subject directly
            configSubject: configSubject, // Keep reference for next()
            getPromptSegments: vi.fn().mockReturnValue([])
        };
        mockBus = new AppBus();
        vi.spyOn(mockBus, 'publish');
        
        mockShellConfig = {
            shell_type: 'Bash',
            inject_path: false,
            enable_shell_integration: false
        } as any;

        session = new TerminalSession(mockConfigService, mockBus, terminalId, mockShellConfig);
    });

    it('should initialize with correct renderer settings based on config', () => {
        mockConfigService.config = { enable_webgl: true, font: { family: 'Fira Code' } };
        session = new TerminalSession(mockConfigService, mockBus, terminalId, mockShellConfig);
        
        expect(Renderer).toHaveBeenCalledWith(expect.objectContaining({ enable_webgl: true }));
    });

    it('should initialize terminal and register handlers', () => {
        const mockElement = document.createElement('div');
        session.initializeTerminal(mockElement);

        expect((session as any).renderer.open).toHaveBeenCalledWith(mockElement, false);
        // Check if some handlers were registered
        // Handlers: Pty, Resize, Theme, Title, FullScreen, Focus, Selection, Input, Mouse, Cursor = 10
        expect((session as any).renderer.register).toHaveBeenCalledTimes(10);
    });

    it('should enable shell integration features if configured', () => {
        mockShellConfig.enable_shell_integration = true;
        const mockElement = document.createElement('div');
        session.initializeTerminal(mockElement);

        // Handlers: 10 base + CognoOsc, CommandLineObserver, CommandLineEditor = 12
        expect((session as any).renderer.register).toHaveBeenCalledTimes(12);
    });

    it('should build context menu', () => {
        const items = session.buildContextMenu();
        expect(items.length).toBeGreaterThan(0);
        expect(items.find(i => i.label === 'Paste')).toBeDefined();
    });

    it('should publish TerminalRemoved event and dispose resources on dispose', () => {
        session.dispose();
        expect(mockBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'TerminalRemoved',
            payload: terminalId
        }));
        expect((session as any).renderer.dispose).toHaveBeenCalled();
        expect((session as any).pty.dispose).toHaveBeenCalled();
    });

    it('should not dispose twice', () => {
        session.dispose();
        vi.clearAllMocks();
        session.dispose();
        expect(mockBus.publish).not.toHaveBeenCalled();
    });
});
