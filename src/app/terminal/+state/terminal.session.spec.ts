import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalSession } from './terminal.session';
import { ConfigService } from '../../config/+state/config.service';
import { AppBus } from '../../app-bus/app-bus';
import { BehaviorSubject, of } from 'rxjs';
import { ShellConfig } from '../../config/+models/config';

// Mocking dependencies that are not passed in constructor but used internally
vi.mock('./renderer/renderer', () => {
    return {
        Renderer: vi.fn().mockImplementation(() => ({
            open: vi.fn(),
            register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            useWebGl: vi.fn(),
            useCanvas: vi.fn(),
            dispose: vi.fn()
        }))
    };
});

vi.mock('./pty/pty', () => {
    return {
        Pty: vi.fn().mockImplementation(() => ({
            dispose: vi.fn(),
            write: vi.fn(),
            spawn: vi.fn().mockResolvedValue(undefined)
        }))
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
            configSubject: configSubject // Keep reference for next()
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
        const configSubject = new BehaviorSubject<any>({ enable_webgl: true });
        mockConfigService.config$ = configSubject;
        
        // Re-create session to trigger constructor subscription with new config$
        session = new TerminalSession(mockConfigService, mockBus, terminalId, mockShellConfig);
        
        expect((session as any).renderer.useWebGl).toHaveBeenCalled();
    });

    it('should initialize terminal and register handlers', () => {
        const mockElement = document.createElement('div');
        session.initializeTerminal(mockElement);

        expect((session as any).renderer.open).toHaveBeenCalledWith(mockElement);
        // Check if some handlers were registered
        // Handlers: Pty, Resize, Theme, Title, FullScreen, Focus, Selection, Input, Mouse, Cursor = 10
        expect((session as any).renderer.register).toHaveBeenCalledTimes(10);
    });

    it('should enable shell integration features if configured', () => {
        mockShellConfig.enable_shell_integration = true;
        const mockElement = document.createElement('div');
        session.initializeTerminal(mockElement);

        // Handlers: 10 base + CognoOsc, CommandLineObserver, CommandLineEditor = 13
        expect((session as any).renderer.register).toHaveBeenCalledTimes(13); 
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
