import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(() => Promise.resolve())
}));

import { WindowService } from './window.service';
import { AppBus } from '../app-bus/app-bus';
import { clear, getAppBus, getTerminalBusyStateService, getWindowService } from "../../__test__/test-factory";
import { Process } from '../_tauri/process';
import { invoke } from '@tauri-apps/api/core';
import { AppWindow } from '../_tauri/window';
import { Logger } from '../_tauri/logger';
import { TerminalBusyStateService } from '../terminal/terminal-busy-state.service';

describe('WindowService', () => {
    let service: WindowService;
    let bus: AppBus;
    let terminalBusyStateService: TerminalBusyStateService;

    beforeEach(() => {
        bus = getAppBus();
        terminalBusyStateService = getTerminalBusyStateService();
        vi.spyOn(bus, 'publish');
        service = getWindowService();
    });

    afterEach(() => {
        clear();
        vi.clearAllMocks();
    });

    it('should be created and publish InitConfigCommand', () => {
        expect(service).toBeTruthy();
        expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'InitConfigCommand' }));
    });

    describe('ActionFired events', () => {
        it('should handle quit action', async () => {
            const event = { type: 'ActionFired', payload: 'quit', path: ['app', 'action'] } as any;
            bus.publish(event);

            // Wait for async operations
            await vi.waitFor(() => {
                expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith('quit the application');
                expect(Process.exit).toHaveBeenCalled();
                expect(event.performed).toBe(true);
            });
        });

        it('should handle new_window action', async () => {
            const event = { type: 'ActionFired', payload: 'new_window', path: ['app', 'action'] } as any;
            bus.publish(event);

            await vi.waitFor(() => {
                expect(invoke).toHaveBeenCalledWith('new_window');
                expect(event.performed).toBe(true);
            });
        });

        it('should handle close_window action', async () => {
            const event = { type: 'ActionFired', payload: 'close_window', path: ['app', 'action'], args: ['workspace_saved'] } as any;
            bus.publish(event);

            await vi.waitFor(() => {
                expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith('close the application window');
                expect(AppWindow.close).toHaveBeenCalled();
                expect(event.performed).toBe(true);
            });
        });

        it('should not quit when busy terminals block the action', async () => {
            vi.mocked(terminalBusyStateService.confirmProceedIfNoBusyTerminals).mockResolvedValue(false);
            const event = { type: 'ActionFired', payload: 'quit', path: ['app', 'action'] } as any;
            bus.publish(event);

            await vi.waitFor(() => {
                expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith('quit the application');
            });

            expect(Process.exit).not.toHaveBeenCalled();
            expect(event.performed).not.toBe(true);
        });

        it('should not close the window when busy terminals block the action', async () => {
            vi.mocked(terminalBusyStateService.confirmProceedIfNoBusyTerminals).mockResolvedValue(false);
            const event = { type: 'ActionFired', payload: 'close_window', path: ['app', 'action'], args: ['workspace_saved'] } as any;
            bus.publish(event);

            await vi.waitFor(() => {
                expect(terminalBusyStateService.confirmProceedIfNoBusyTerminals).toHaveBeenCalledWith('close the application window');
            });

            expect(AppWindow.close).not.toHaveBeenCalled();
            expect(event.performed).not.toBe(true);
        });

        it('should log error if new_window fails', async () => {
            vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed'));
            const event = { type: 'ActionFired', payload: 'new_window', path: ['app', 'action'] } as any;
            bus.publish(event);

            await vi.waitFor(() => {
                expect(Logger.error).toHaveBeenCalledWith('Failed to open new window', expect.any(Error));
            });
        });
    });

    describe('onCloseRequested$', () => {
        it('should publish close_window when window close is requested', () => {
            (AppWindow.onCloseRequested$ as Subject<any>).next({ preventDefault: vi.fn() });

            expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({
                type: "ActionFired",
                path: ['app', 'action'],
                payload: 'close_window'
            }));
        });
    });
});
