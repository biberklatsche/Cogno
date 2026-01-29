import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalSession } from './terminal.session';
import { AppBus } from '../../app-bus/app-bus';
import { Renderer } from './renderer/renderer';
import {getStateManager, getConfigService, getAppBus} from "../../../__test__/test-factory";
import {ShellProfile} from "../../config/+models/shell-config";
import {ConfigService} from "../../config/+state/config.service";

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
    let mockConfigService: ConfigService;
    let mockBus: AppBus;
    let mockShellProfile: ShellProfile;
    const terminalId = 'test-terminal-id';

    beforeEach(() => {
        mockConfigService = getConfigService() as unknown as ConfigService;
        mockBus = getAppBus();
        vi.spyOn(mockBus, 'publish');
        
        mockShellProfile = {
            shell_type: 'Bash',
            inject_path: false,
            enable_shell_integration: false
        };

        session = new TerminalSession(mockConfigService, mockBus, getStateManager());
    });

    it('should initialize with correct renderer settings based on config', () => {
        const config = { enable_webgl: true, font: { family: 'Fira Code' } } as any;
        (mockConfigService as any).setConfig(config);
        session = new TerminalSession(mockConfigService, mockBus, getStateManager());
        
        expect(Renderer).toHaveBeenCalledWith(expect.objectContaining({ enable_webgl: true }));
    });

    it('should initialize terminal and register handlers', () => {
        const config = { font: { enable_ligatures: false } } as any;
        (mockConfigService as any).setConfig(config);
        const mockElement = document.createElement('div');
        session.initialize(terminalId, mockShellProfile);
        session.initializeTerminal(mockElement);

        const rendererInstance = vi.mocked(Renderer).mock.results[0].value;
        expect(rendererInstance.open).toHaveBeenCalledWith(mockElement, false);
        // Handlers: Pty, Resize, Theme, Title, FullScreen, Focus, Selection, Input, Mouse, Cursor = 10
        expect(rendererInstance.register).toHaveBeenCalledTimes(10);
    });

    it('should enable shell integration features if configured', () => {
        const config = { font: { enable_ligatures: false } } as any;
        (mockConfigService as any).setConfig(config);
        mockShellProfile.enable_shell_integration = true;
        const mockElement = document.createElement('div');
        session.initialize(terminalId, mockShellProfile);
        session.initializeTerminal(mockElement);

        const rendererInstance = vi.mocked(Renderer).mock.results[vi.mocked(Renderer).mock.results.length - 1].value;
        // Handlers: 10 base + CognoOsc (handled by CommandLineObserver), CommandLineObserver, CommandLineEditor = 12
        expect(rendererInstance.register).toHaveBeenCalledTimes(12);
    });

    it('should build context menu', () => {
        session.initialize(terminalId, mockShellProfile);
        const items = session.buildContextMenu();
        expect(items.length).toBeGreaterThan(0);
        expect(items.find(i => i.label === 'Paste')).toBeDefined();
    });

    it('should publish TerminalRemoved event and dispose resources on dispose', () => {
        session.initialize(terminalId, mockShellProfile);
        session.dispose();
        expect(mockBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'TerminalRemoved',
            payload: terminalId
        }));
        
        const rendererInstance = vi.mocked(Renderer).mock.results[0].value;
        expect(rendererInstance.dispose).toHaveBeenCalled();
        // session.pty is private, but it's part of the disposables. 
        // We can't easily check pty.dispose without reaching into private, 
        // but the code calls it.
    });

    it('should not dispose twice', () => {
        session.initialize(terminalId, mockShellProfile);
        session.dispose();
        vi.clearAllMocks();
        session.dispose();
        expect(mockBus.publish).not.toHaveBeenCalled();
    });
});
