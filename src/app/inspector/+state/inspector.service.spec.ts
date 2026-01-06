import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { InspectorService } from './inspector.service';
import { AppBus } from '../../app-bus/app-bus';
import { ConfigService } from '../../config/+state/config.service';
import { KeybindService } from '../../keybinding/keybind.service';
import { SideMenuService } from '../../menu/side-menu/+state/side-menu.service';
import { DestroyRef } from '@angular/core';
import {Config} from "../../config/+models/config";
import {
    createConfigServiceMock,
    createDestroyRefMock,
    createKeybindServiceMock
} from "../../../__test__/test-factory";

describe('InspectorService', () => {
    let service: InspectorService;
    let appBus: AppBus;
    let configService: Mocked<ConfigService>;
    let keybindService: Mocked<KeybindService>;
    let sideMenuService: SideMenuService;
    let destroyRef: Mocked<DestroyRef>;

    const mockConfig: Partial<Config> = {
        inspector: { mode: 'visible' }
    };

    beforeEach(() => {
        appBus = new AppBus();
        sideMenuService = new SideMenuService(appBus);

        configService = createConfigServiceMock(mockConfig);
        keybindService = createKeybindServiceMock();
        destroyRef = createDestroyRefMock();

        // Spy on methods called by SideMenuFeature
        vi.spyOn(sideMenuService, 'addMenuItem');
        vi.spyOn(sideMenuService, 'removeMenuItem');
        vi.spyOn(sideMenuService, 'close');

        service = new InspectorService(
            sideMenuService,
            appBus,
            configService,
            keybindService,
            destroyRef
        );
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Event Handling when Open', () => {
        beforeEach(() => {
            // Open the inspector
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
        });

        it('should update firedKeybinding on keybind event', () => {
            const keybinding = { shortcut: 'Ctrl+C', action: 'copy' };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'keybind', data: keybinding }
            });

            expect(service.firedKeybinding()).toEqual(keybinding);
        });

        it('should update terminal mouse position', () => {
            const data = { terminalId: 'term1', col: 10, row: 5, char: 'A', viewportCol: 10, viewportRow: 5 };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'terminal-mouse-position', data }
            });

            expect(service.terminalMouseById()['term1']).toEqual(data);
            expect(service.terminalIds()).toContain('term1');
        });

        it('should update terminal cursor position', () => {
            const data = { terminalId: 'term1', col: 2, row: 3, char: '_', viewportCol: 2, viewportRow: 3 };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'terminal-cursor-position', data }
            });

            expect(service.terminalCursorById()['term1']).toEqual(data);
            expect(service.terminalIds()).toContain('term1');
        });

        it('should update terminal dimensions', () => {
            const data = { terminalId: 'term1', cols: 80, rows: 24, width: 640, height: 480 };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'terminal-dimensions', data }
            });

            expect(service.terminalDimsById()['term1']).toEqual(data);
            expect(service.terminalIds()).toContain('term1');
        });

        it('should track global mouse movement', () => {
            const mouseEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 200 });
            window.dispatchEvent(mouseEvent);

            expect(service.mousePosition()).toEqual({ x: 100, y: 200 });
        });

        it('should remove terminal data on TerminalRemoved event', () => {
            // Setup data first
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'terminal-mouse-position', data: { terminalId: 'term1', col: 1 } }
            });
            expect(service.terminalIds()).toContain('term1');

            // Trigger removal
            appBus.publish({
                type: 'TerminalRemoved',
                path: ['app', 'terminal'],
                payload: 'term1'
            });

            expect(service.terminalMouseById()['term1']).toBeUndefined();
            expect(service.terminalIds()).not.toContain('term1');
        });

        it('should register Escape key listener', () => {
            expect(keybindService.registerListener).toHaveBeenCalledWith(
                'inspector',
                ['Escape'],
                expect.any(Function)
            );
        });
    });

    describe('Lifecycle and Modes', () => {
        it('should unregister listeners when closed', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
            appBus.publish({ type: 'SideMenuViewClosed', payload: { label: 'Inspector' } });

            expect(keybindService.unregisterListener).toHaveBeenCalledWith('inspector');
        });

        it('should stop listening to events when closed', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
            appBus.publish({ type: 'SideMenuViewClosed', payload: { label: 'Inspector' } });

            const keybinding = { shortcut: 'Ctrl+V', action: 'paste' };
            appBus.publish({
                type: 'Inspector',
                path: ['inspector'],
                payload: { type: 'keybind', data: keybinding }
            });

            expect(service.firedKeybinding()).toBeUndefined();
        });

        it('should handle mode off by closing', () => {
            appBus.publish({ type: 'SideMenuViewOpened', payload: { label: 'Inspector' } });
            
            configService.config$.next({ inspector: { mode: 'off' } });

            expect(sideMenuService.removeMenuItem).toHaveBeenCalledWith('Inspector');
            // Check if keybind listener was unregistered via handleClose
            expect(keybindService.unregisterListener).toHaveBeenCalledWith('inspector');
        });
    });
});
