import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GridListService } from './grid-list.service';
import { AppBus } from '../../app-bus/app-bus';
import { clear, getAppBus, getTerminalComponentFactory, getDestroyRef } from "../../../__test__/test-factory";
import { TerminalComponentFactory } from "./terminal-component.factory";
import { IdCreator } from "../../common/id-creator/id-creator";
import {TerminalConfig} from "../../workspace/+model/workspace";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../../tab-list/+bus/events";
import {Grid} from "../+model/model";
import {
    FocusActiveTerminalAction,
    RemovePaneAction,
    SplitPaneDownAction,
    SplitPaneRightAction
} from "../+bus/actions";
import {TerminalFocusedEvent} from "../../terminal/+state/handler/focus.handler";
import {TerminalTitleChangedEvent} from "../../terminal/+state/handler/terminal-title.handler";

describe('GridListService', () => {
    let service: GridListService;
    let bus: AppBus;
    let componentFactory: TerminalComponentFactory;

    beforeEach(() => {
        bus = getAppBus();
        componentFactory = getTerminalComponentFactory();
        service = new GridListService(bus, componentFactory, getDestroyRef());
    });

    afterEach(() => {
        clear();
        vi.restoreAllMocks();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Tab Event Handling', () => {
        it('should handle TabAdded event and restore grid', () => {
            const tabId = 'tab-1';
            const workingDir = '/test/dir';
            
            bus.publish({
                type: 'TabAdded',
                payload: { tabId, workingDir, isActive: true }
            } as TabAddedEvent);

            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            
            expect(grids.length).toBe(1);
            expect(grids[0].tabId).toBe(tabId);
            
            let activeTabId: string | undefined;
            service.activeTabId$.subscribe(id => activeTabId = id);
            expect(activeTabId).toBe(tabId);
        });

        it('should handle TabRemoved event', () => {
            const tabId = 'tab-1';
            bus.publish({
                type: 'TabAdded',
                payload: { tabId, isActive: true }
            } as TabAddedEvent);

            bus.publish({
                type: 'TabRemoved',
                payload: tabId
            } as TabRemovedEvent);

            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            expect(grids.length).toBe(0);
        });

        it('should handle TabSelected event', () => {
            const tabId = 'tab-1';
            bus.publish({
                type: 'TabAdded',
                payload: { tabId, isActive: false }
            } as TabAddedEvent);

            bus.publish({
                type: 'TabSelected',
                payload: tabId
            } as TabSelectedEvent);

            let activeTabId: string | undefined;
            service.activeTabId$.subscribe(id => activeTabId = id);
            expect(activeTabId).toBe(tabId);
        });
    });

    describe('Split and Pane Management', () => {
        const tabId = 'tab-1';
        let initialTerminalId: string;

        beforeEach(() => {
            vi.spyOn(IdCreator, 'newTerminalId').mockReturnValue('term-1');
            bus.publish({
                type: 'TabAdded',
                payload: { tabId, isActive: true }
            } as TabAddedEvent);
            
            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            initialTerminalId = grids[0].tree.root.data!.terminalId!;
        });

        it('should split pane right', () => {
            vi.spyOn(IdCreator, 'newTerminalId').mockReturnValue('term-2');
            const publishSpy = vi.spyOn(bus, 'publish');

            bus.publish({
                type: 'SplitPaneRight',
                payload: initialTerminalId
            } as SplitPaneRightAction);

            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            
            const root = grids[0].tree.root;
            expect(root.isLeaf).toBe(false);
            expect(root.data!.splitDirection).toBe('vertical');
            expect(root.left!.data!.terminalId).toBe(initialTerminalId);
            expect(root.right!.data!.terminalId).toBe('term-2');
            
            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'BlurTerminal',
                payload: initialTerminalId
            }));
        });

        it('should remove a pane', () => {
            vi.spyOn(IdCreator, 'newTerminalId').mockReturnValue('term-2');
            // Split first so we have something to remove that isn't root
            bus.publish({ type: 'SplitPaneRight', payload: initialTerminalId } as SplitPaneRightAction);
            
            const destroySpy = vi.spyOn(componentFactory, 'destroy');
            
            bus.publish({
                type: 'RemovePane',
                payload: 'term-2'
            } as RemovePaneAction);

            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            
            expect(grids[0].tree.root.isLeaf).toBe(true);
            expect(grids[0].tree.root.data!.terminalId).toBe(initialTerminalId);
            expect(destroySpy).toHaveBeenCalledWith('term-2');
        });

        it('should publish RemoveTab if root pane is removed', () => {
            const publishSpy = vi.spyOn(bus, 'publish');
            
            bus.publish({
                type: 'RemovePane',
                payload: initialTerminalId
            } as RemovePaneAction);

            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'RemoveTab',
                payload: tabId
            }));
        });

        it('should split pane down', () => {
            vi.spyOn(IdCreator, 'newTerminalId').mockReturnValue('term-2');
            bus.publish({
                type: 'SplitPaneDown',
                payload: initialTerminalId
            } as SplitPaneDownAction);

            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            
            const root = grids[0].tree.root;
            expect(root.isLeaf).toBe(false);
            expect(root.data!.splitDirection).toBe('horizontal');
            expect(root.left!.data!.terminalId).toBe(initialTerminalId);
            expect(root.right!.data!.terminalId).toBe('term-2');
        });

        it('should handle TerminalTitleChanged event', () => {
            const publishSpy = vi.spyOn(bus, 'publish');
            bus.publish({
                type: 'TerminalTitleChanged',
                payload: { oscCode: 0, terminalId: initialTerminalId, title: 'New Title' }
            } as TerminalTitleChangedEvent);

            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'TabTitleChanged',
                payload: { tabId, title: 'New Title' }
            }));
        });

        it('should publish FocusTerminal after delayed pane removal if focused', async () => {
            vi.spyOn(IdCreator, 'newTerminalId').mockReturnValue('term-2');
            bus.publish({ type: 'SplitPaneRight', payload: initialTerminalId } as SplitPaneRightAction);
            
            // Focus term-2
            bus.publish({ type: 'TerminalFocused', payload: 'term-2' } as TerminalFocusedEvent);
            
            const publishSpy = vi.spyOn(bus, 'publish');
            vi.useFakeTimers();
            
            bus.publish({
                type: 'RemovePane',
                payload: 'term-2'
            } as RemovePaneAction);

            vi.runAllTimers();
            
            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'FocusTerminal',
                payload: initialTerminalId
            }));
            
            vi.useRealTimers();
        });
    });

    describe('Config and Serialization', () => {
        it('should get and restore grid configs', () => {
            const tabId = 'tab-1';
            bus.publish({
                type: 'TabAdded',
                payload: { tabId, workingDir: '/home', isActive: true }
            } as TabAddedEvent);

            const configs = service.getGridConfigs();
            expect(configs.length).toBe(1);
            expect(configs[0].tabId).toBe(tabId);
            expect((configs[0].pane as TerminalConfig).workingDir).toBe('/home');

            service.removeGrid(tabId);
            service.restoreGrids(configs);

            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            expect(grids.length).toBe(1);
            expect(grids[0].tabId).toBe(tabId);
        });
    });

    describe('Focus Management', () => {
        it('should handle TerminalFocused event', () => {
            const tabId = 'tab-1';
            vi.spyOn(IdCreator, 'newTerminalId').mockReturnValue('term-1');
            bus.publish({
                type: 'TabAdded',
                payload: { tabId, isActive: true }
            } as TabAddedEvent);

            bus.publish({
                type: 'TerminalFocused',
                payload: 'term-1'
            } as TerminalFocusedEvent);

            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            expect(grids[0].tree.root.data!.isFocused).toBe(true);
        });

        it('should handle FocusActiveTerminal action', () => {
            const tabId = 'tab-1';
            vi.spyOn(IdCreator, 'newTerminalId').mockReturnValue('term-1');
            bus.publish({
                type: 'TabAdded',
                payload: { tabId, isActive: true }
            } as TabAddedEvent);

            // Mock focused state
            let grids: Grid[] = [];
            service.grids$.subscribe(g => grids = g);
            grids[0].tree.root.data!.isFocused = true;

            const publishSpy = vi.spyOn(bus, 'publish');
            bus.publish({
                type: 'FocusActiveTerminal'
            } as FocusActiveTerminalAction);

            expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'FocusTerminal',
                payload: 'term-1'
            }));
        });
    });
});
