import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalSession } from './terminal.session';
import { AppBus } from '../../app-bus/app-bus';
import { Renderer } from './renderer/renderer';
import {getStateManager, getConfigService, getAppBus} from "../../../__test__/test-factory";
import {ShellProfile} from "../../config/+models/shell-config";
import {ConfigService} from "../../config/+state/config.service";
import { TerminalAutocompleteFeatureSuggestorService } from "../../app-host/terminal-autocomplete-feature-suggestor.service";
import { AppWiringService } from "@cogno/app-setup/app-host/app-wiring.service";
import {DialogService} from "../../common/dialog";
import {DialogRef} from "../../common/dialog/dialog-ref";
import { PathFactory } from "@cogno/core-host";
import { NotificationChannelContract } from "@cogno/core-sdk";
import { featureShellPathAdapterDefinitions } from "@cogno/features";
import { ContextMenuOverlayService } from "../../menu/context-menu-overlay/context-menu-overlay.service";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { TerminalStateManager } from "./state";

// Mocking dependencies that are not passed in constructor but used internally
vi.mock('./renderer/renderer', () => {
    return {
        Renderer: vi.fn().mockImplementation(function() {
            return {
                open: vi.fn(),
                register: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                dispose: vi.fn(),
                terminal: TerminalMockFactory.createTerminal(),
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
    let mockFeatureSuggestorService: TerminalAutocompleteFeatureSuggestorService;
    let mockDialogService: DialogService;
    let mockProcessInfoDialogReference: DialogRef<void>;
    let mockWiringService: AppWiringService;
    let mockContextMenuOverlayService: ContextMenuOverlayService;
    let stateManager: TerminalStateManager;
    const terminalId = 'test-terminal-id';

    beforeEach(() => {
        PathFactory.setDefinitions([
            ...featureShellPathAdapterDefinitions,
        ]);
        mockConfigService = getConfigService() as unknown as ConfigService;
        mockBus = getAppBus();
        vi.spyOn(mockBus, 'publish');
        
        mockShellProfile = {
            shell_type: 'Bash',
            inject_cogno_cli: false,
            enable_shell_integration: false
        };

        mockFeatureSuggestorService = {
            getSharedSuggestors: vi.fn().mockReturnValue([]),
            preloadForShellIntegration: vi.fn(),
        } as unknown as TerminalAutocompleteFeatureSuggestorService;

        mockProcessInfoDialogReference = {
            id: 1,
            closed: vi.fn() as unknown as DialogRef<void>['closed'],
            close: vi.fn()
        } as unknown as DialogRef<void>;

        mockDialogService = {
            open: vi.fn().mockReturnValue(mockProcessInfoDialogReference)
        } as unknown as DialogService;

        mockWiringService = {
            getShellDefinitions: vi.fn().mockReturnValue([]),
            getNotificationChannels: vi.fn().mockReturnValue([
                { displayName: "App", id: "app", dispatch: vi.fn() },
                { displayName: "OS", id: "os", dispatch: vi.fn() },
            ] satisfies ReadonlyArray<NotificationChannelContract>),
        } as unknown as AppWiringService;

        mockContextMenuOverlayService = {
            openContextForElement: vi.fn(),
        } as unknown as ContextMenuOverlayService;

        stateManager = getStateManager();

        session = new TerminalSession(
            mockConfigService,
            mockBus,
            stateManager,
            mockFeatureSuggestorService,
            mockDialogService,
            mockWiringService,
            mockContextMenuOverlayService,
        );
    });

    it('should initialize with correct renderer settings based on config', () => {
        const config = { terminal: { webgl: true }, font: { family: 'Fira Code' } } as any;
        (mockConfigService as any).setConfig(config);
        session = new TerminalSession(
            mockConfigService,
            mockBus,
            stateManager,
            mockFeatureSuggestorService,
            mockDialogService,
            mockWiringService,
            mockContextMenuOverlayService,
        );
        
        expect(Renderer).toHaveBeenCalledWith(expect.objectContaining({ terminal: { webgl: true } }));
    });

    it('should initialize terminal and register handlers', () => {
        const config = { font: { enable_ligatures: false } } as any;
        (mockConfigService as any).setConfig(config);
        const mockElement = document.createElement('div');
        session.initialize(terminalId, mockShellProfile);
        session.initializeTerminal(mockElement);

        const rendererInstance = vi.mocked(Renderer).mock.results[0].value;
        expect(rendererInstance.open).toHaveBeenCalledWith(mockElement, false);
        expect(rendererInstance.register).toHaveBeenCalledTimes(14);
    });

    it('should enable shell integration features if configured', () => {
        const config = { font: { enable_ligatures: false } } as any;
        (mockConfigService as any).setConfig(config);
        mockShellProfile.enable_shell_integration = true;
        const mockElement = document.createElement('div');
        session.initialize(terminalId, mockShellProfile);
        session.initializeTerminal(mockElement);

        const rendererInstance = vi.mocked(Renderer).mock.results[vi.mocked(Renderer).mock.results.length - 1].value;
        expect(rendererInstance.register).toHaveBeenCalledTimes(16);
        expect(mockFeatureSuggestorService.preloadForShellIntegration).toHaveBeenCalledWith('Bash');
    });

    it('should build context menu', () => {
        session.initialize(terminalId, mockShellProfile);
        const items = session.buildContextMenu();
        expect(items.length).toBeGreaterThan(0);
        expect(items.find(i => i.label === 'Paste')).toBeDefined();
        expect(items.find(i => i.label === 'Maximize')).toBeDefined();
        expect(items.find(i => i.label === 'Process Info')).toBeUndefined();
        expect(items.find(i => i.label?.includes('Notifications'))).toBeUndefined();
    });

    it('should show Minimize when pane is maximized', () => {
        session.initialize(terminalId, mockShellProfile);
        mockBus.publish({
            type: 'PaneMaximizedChanged',
            payload: { terminalId }
        } as any);

        const items = session.buildContextMenu();
        expect(items.find(i => i.label === 'Minimize')).toBeDefined();
        expect(items.find(i => i.label === 'Maximize')).toBeUndefined();
    });

    it('should only show available notification channels in header menu', () => {
        (mockConfigService as any).setConfig({
            notification: {
                long_running_commands: {
                    enabled: true,
                    minimum_duration_seconds: 10,
                },
            },
            notifications: {
                app: { available: true, enabled: false },
                os: { available: false, enabled: false },
            }
        });
        session.initialize(terminalId, mockShellProfile);

        const items = session.buildHeaderMenu();
        expect(items[0]).toEqual(expect.objectContaining({ header: true, label: 'Command Alerts' }));
        const longRunningCommandToggle = items.find(i => i.label === 'Long Commands');
        expect(items).toContainEqual(expect.objectContaining({ header: true, label: 'Channels' }));
        expect(items[items.findIndex(i => i.label === 'Process Info') - 1]).toEqual(expect.objectContaining({ separator: true }));
        const appToggle = items.find(i => i.label === 'App');
        expect(longRunningCommandToggle).toBeDefined();
        expect(longRunningCommandToggle?.toggle).toBe(true);
        expect(longRunningCommandToggle?.toggled).toBe(true);
        expect(appToggle).toBeDefined();
        expect(appToggle?.toggle).toBe(true);
        expect(appToggle?.toggled).toBe(false);
        expect(items.find(i => i.label === 'OS')).toBeUndefined();
    });

    it('should include command menu items in the header menu for the first command out of view', () => {
        session.initialize(terminalId, mockShellProfile);
        stateManager.updateCommand({ id: '1' });
        const rendererInstance = vi.mocked(Renderer).mock.results[0].value;
        vi.mocked(rendererInstance.terminal.buffer.active.getLine).mockImplementation((lineIndex: number) => {
            if (lineIndex === 0) return TerminalMockFactory.createLine('^^#1');
            if (lineIndex === 1) return TerminalMockFactory.createLine('first output line');
            if (lineIndex === 2) return TerminalMockFactory.createLine('second output line');
            if (lineIndex === 3) return TerminalMockFactory.createLine('^^#2');
            return null;
        });
        rendererInstance.terminal.buffer.active.length = 4;

        stateManager.updateCommands([
            Object.assign(stateManager.commands[0], {
                isFirstCommandOutOfViewport: true,
            }),
        ]);
        stateManager.commands[0].set('command', 'cat bible.txt');

        const items = session.buildHeaderCommandMenu();

        expect(items.find(item => item.label === 'Copy Command')).toBeDefined();
        expect(items.find(item => item.label === 'Copy Output')).toBeDefined();
        expect(items.find(item => item.label === 'Scroll to Top')).toBeDefined();
        expect(items.find(item => item.label === 'Scroll to Bottom')).toBeDefined();
        expect(items.find(item => item.label === 'Filter Block')).toBeDefined();
        expect(items[2]).toEqual(expect.objectContaining({ separator: true }));
        expect(items[5]).toEqual(expect.objectContaining({ separator: true }));

        items.find(item => item.label === 'Scroll to Top')?.action?.();
        items.find(item => item.label === 'Scroll to Bottom')?.action?.();

        expect(rendererInstance.terminal.scrollToLine).toHaveBeenNthCalledWith(1, 0);
        expect(rendererInstance.terminal.scrollToLine).toHaveBeenNthCalledWith(2, 2);
    });

    it('should allow toggling long-running command notifications from the header menu', () => {
        (mockConfigService as any).setConfig({
            notification: {
                long_running_commands: {
                    enabled: true,
                    minimum_duration_seconds: 10,
                },
            },
            notifications: {
                app: { available: true, enabled: true },
            },
        });
        session.initialize(terminalId, mockShellProfile);

        const toggleItem = session.buildHeaderMenu().find(item => item.label === 'Long Commands');
        expect(toggleItem?.toggled).toBe(true);

        toggleItem?.action?.(toggleItem);

        expect(toggleItem?.toggled).toBe(false);
    });

    it('should publish a notification when a long-running command has finished', () => {
        (mockConfigService as any).setConfig({
            notification: {
                long_running_commands: {
                    enabled: true,
                    minimum_duration_seconds: 10,
                },
            },
            notifications: {
                app: { available: true, enabled: true },
            },
        });
        session.initialize(terminalId, mockShellProfile);

        (session as any).completedCommandNotificationHandler.handleCompletedCommand({
            command: 'pnpm test',
            duration: 12_000,
            directory: '/workspace',
            returnCode: 0,
        });

        expect(mockBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            path: ['notification'],
            type: 'Notification',
            payload: expect.objectContaining({
                header: 'Long-running command finished',
                terminalId,
                channels: { app: true, os: false },
            }),
        }));
    });

    it('should not publish a notification when a command is shorter than the configured threshold', () => {
        (mockConfigService as any).setConfig({
            notification: {
                long_running_commands: {
                    enabled: true,
                    minimum_duration_seconds: 10,
                },
            },
            notifications: {
                app: { available: true, enabled: true },
            },
        });
        session.initialize(terminalId, mockShellProfile);
        vi.clearAllMocks();

        (session as any).completedCommandNotificationHandler.handleCompletedCommand({
            command: 'pnpm test',
            duration: 9_000,
            directory: '/workspace',
            returnCode: 0,
        });

        expect(mockBus.publish).not.toHaveBeenCalled();
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

    it('should close process info dialog when terminal session is disposed', () => {
        session.initialize(terminalId, mockShellProfile);
        const processInfoItem = session.buildHeaderMenu().find(item => item.label === 'Process Info');

        processInfoItem?.action?.();
        expect(mockDialogService.open).toHaveBeenCalledTimes(1);

        session.dispose();
        expect(mockProcessInfoDialogReference.close).toHaveBeenCalledTimes(1);
    });

    it("should inject dropped file paths as shell-safe terminal input", () => {
        session.initialize(terminalId, mockShellProfile);

        session.insertPaths([
            "C:\\temp\\plain.txt",
            "C:\\temp\\with space.txt",
        ]);

        expect(mockBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            path: ["app", "terminal"],
            type: "InjectTerminalInput",
            payload: {
                terminalId,
                text: "/c/temp/plain.txt '/c/temp/with space.txt'",
            },
        }));
    });
});
