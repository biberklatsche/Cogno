import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeybindExecutor } from './keybind.executor';
import { AppBus } from '../../../app-bus/app-bus';
import { FocusHandler } from '../handler/focus.handler';
import { SelectionHandler } from '../handler/selection.handler';
import { clear, getAppBus, getFocusHandler, getSelectionHandler } from '../../../../__test__/test-factory';

describe('KeybindExecutor', () => {
    let executor: KeybindExecutor;
    let mockBus: AppBus;
    let mockFocusHandler: FocusHandler;
    let mockSelectionHandler: SelectionHandler;
    const terminalId = 'test-terminal-id';

    beforeEach(() => {
        clear();
        mockBus = getAppBus();
        
        mockFocusHandler = getFocusHandler(terminalId);
        vi.spyOn(mockFocusHandler, 'hasFocus').mockReturnValue(true);
        
        mockSelectionHandler = getSelectionHandler(terminalId);
        vi.spyOn(mockSelectionHandler, 'hasSelection').mockReturnValue(true);

        executor = new KeybindExecutor(
            mockBus,
            mockFocusHandler,
            mockSelectionHandler,
            terminalId
        );
    });

    it('should publish SplitPaneRight when split_right action is fired', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'split_right',
            performed: false
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'SplitPaneRight',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should publish SplitPaneLeft when split_left action is fired', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'split_left',
            performed: false
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'SplitPaneLeft',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should publish SplitPaneDown when split_down action is fired', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'split_down',
            performed: false
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'SplitPaneDown',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should publish SplitPaneUp when split_up action is fired', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'split_up',
            performed: false
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'SplitPaneUp',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should publish Copy when copy action is fired and has selection', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'copy',
            performed: false,
            trigger: { performable: true }
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'Copy',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should NOT publish Copy when copy action is fired but NO selection', async () => {
        vi.mocked(mockSelectionHandler.hasSelection).mockReturnValue(false);
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'copy',
            performed: false,
            trigger: { performable: true }
        };

        mockBus.publish(event);

        // check that Copy was not published (except the original event)
        const copyPublish = publishSpy.mock.calls.find(call => call[0].type === 'Copy');
        expect(copyPublish).toBeUndefined();
        expect(event.performed).toBe(false);
    });

    it('should publish Paste when paste action is fired', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'paste',
            performed: false
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'Paste',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should publish ClearBuffer when clear_buffer action is fired', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'clear_buffer',
            performed: false
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ClearBuffer',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should publish RemovePane when close_terminal action is fired', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'close_terminal',
            performed: false
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RemovePane',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should ignore events if terminal has no focus', async () => {
        vi.mocked(mockFocusHandler.hasFocus).mockReturnValue(false);
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'split_right',
            performed: false
        };

        mockBus.publish(event);

        const splitPublish = publishSpy.mock.calls.find(call => call[0].type === 'SplitPaneRight');
        expect(splitPublish).toBeUndefined();
        expect(event.performed).toBe(false);
    });

    it('should NOT ignore events if trigger.all is true even without focus', async () => {
        vi.mocked(mockFocusHandler.hasFocus).mockReturnValue(false);
        const publishSpy = vi.spyOn(mockBus, 'publish');
        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'split_right',
            performed: false,
            trigger: { all: true }
        };

        mockBus.publish(event);

        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'SplitPaneRight',
            payload: terminalId,
            path: ['app', 'terminal']
        }));
        expect(event.performed).toBe(true);
    });

    it('should stop listening after dispose', async () => {
        const publishSpy = vi.spyOn(mockBus, 'publish');
        executor.dispose();

        const event: any = {
            path: ['app', 'action'],
            type: 'ActionFired',
            payload: 'split_right',
            performed: false
        };

        mockBus.publish(event);

        const splitPublish = publishSpy.mock.calls.find(call => call[0].type === 'SplitPaneRight');
        expect(splitPublish).toBeUndefined();
        expect(event.performed).toBe(false);
    });
});
