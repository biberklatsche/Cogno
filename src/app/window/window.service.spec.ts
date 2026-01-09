import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(() => Promise.resolve())
}));

import { WindowService } from './window.service';
import { AppBus } from '../app-bus/app-bus';
import { clear, getAppBus, getWindowService } from "../../__test__/test-factory";
import { Process } from '../_tauri/process';
import { invoke } from '@tauri-apps/api/core';
import { AppWindow } from '../_tauri/window';
import { Logger } from '../_tauri/logger';

describe('WindowService', () => {
    let service: WindowService;
    let bus: AppBus;

    beforeEach(() => {
        bus = getAppBus();
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
            const event = { type: 'ActionFired', payload: 'close_window', path: ['app', 'action'] } as any;
            bus.publish(event);

            await vi.waitFor(() => {
                expect(AppWindow.close).toHaveBeenCalled();
                expect(event.performed).toBe(true);
            });
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
        it('should publish close_all_tabs when window close is requested', () => {
            (AppWindow.onCloseRequested$ as Subject<any>).next({});
            
            expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({
                type: "ActionFired",
                path: ['app', 'action'],
                payload: 'close_all_tabs'
            }));
        });
    });
});
