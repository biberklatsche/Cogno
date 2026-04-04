import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkerManager } from './marker-manager';
import { AppBus } from '../../../../app-bus/app-bus';
import { TerminalMockFactory } from '../../../../../__test__/mocks/terminal-mock.factory';
import {TerminalStateManager} from "../../state";
import { ContextMenuOverlayService } from '../../../../menu/context-menu-overlay/context-menu-overlay.service';

describe('MarkerManager', () => {
    let markerManager: MarkerManager;
    let stateManager: TerminalStateManager;
    let mockTerminal: any;
    let contextMenuOverlayService: Pick<ContextMenuOverlayService, 'openContextForElement'>;
    let mockBus: AppBus;

    beforeEach(() => {
        mockBus = new AppBus();
        vi.spyOn(mockBus, 'publish');
        stateManager = new TerminalStateManager(mockBus);
        stateManager.initialize('test-id', 'Bash' as any);
        contextMenuOverlayService = {
            openContextForElement: vi.fn(),
    };
        markerManager = new MarkerManager(stateManager, [], contextMenuOverlayService, mockBus);
        mockTerminal = TerminalMockFactory.createTerminal();
        mockTerminal.registerMarker = vi.fn().mockReturnValue({ dispose: vi.fn(), line: 0 });
        mockTerminal.registerDecoration = vi.fn().mockReturnValue({ 
            dispose: vi.fn(), 
            onRender: vi.fn(),
            onDispose: vi.fn()
        });
        markerManager.setTerminal(mockTerminal);
    });

    it('should create markers for lines starting with ^^#', () => {
        const line1 = TerminalMockFactory.createLine('^^#1 text');
        const line2 = TerminalMockFactory.createLine('other text');
        
        vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
            if (index === 0) return line1;
            if (index === 1) return line2;
            return null;
        });
        mockTerminal.buffer.active.length = 2;
        mockTerminal.rows = 10;
        mockTerminal.buffer.active.viewportY = 0;
        mockTerminal.buffer.active.baseY = 0;
        mockTerminal.buffer.active.cursorY = 0;

        markerManager.refreshMarkers();

        expect(mockTerminal.registerMarker).toHaveBeenCalledWith(0);
        expect(mockTerminal.registerDecoration).toHaveBeenCalled();
    });

    it('should not recreate existing markers', () => {
        const line = TerminalMockFactory.createLine('^^#1');
        vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue(line);
        mockTerminal.buffer.active.length = 1;
        mockTerminal.rows = 10;
        mockTerminal.buffer.active.viewportY = 0;
        mockTerminal.buffer.active.baseY = 0;
        mockTerminal.buffer.active.cursorY = 0;

        markerManager.refreshMarkers();
        markerManager.refreshMarkers();

        expect(mockTerminal.registerMarker).toHaveBeenCalledTimes(1);
    });

    it('should create multiple markers for multiple ^^# lines', () => {
        const line1 = TerminalMockFactory.createLine('^^#1 text');
        const line2 = TerminalMockFactory.createLine('^^#2 text');
        
        vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
            if (index === 5) return line1;
            if (index === 7) return line2;
            return null;
        });
        mockTerminal.buffer.active.length = 10;
        mockTerminal.rows = 10;
        mockTerminal.buffer.active.viewportY = 0;
        mockTerminal.buffer.active.baseY = 0;
        mockTerminal.buffer.active.cursorY = 10;

        markerManager.refreshMarkers();

        expect(mockTerminal.registerMarker).toHaveBeenCalledWith(5 - 10); // lineIndex - cursorYAbsolute
        expect(mockTerminal.registerMarker).toHaveBeenCalledWith(7 - 10);
        expect(mockTerminal.registerDecoration).toHaveBeenCalledTimes(2);
    });

    it('should use correct marker index when baseY is not 0', () => {
        const line1 = TerminalMockFactory.createLine('^^#1 text');
        
        vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
            if (index === 105) return line1;
            return null;
        });
        mockTerminal.buffer.active.length = 200;
        mockTerminal.rows = 10;
        mockTerminal.buffer.active.viewportY = 100;
        mockTerminal.buffer.active.baseY = 50;
        mockTerminal.buffer.active.cursorY = 20; // Absolute cursor Y = 50 + 20 = 70

        markerManager.refreshMarkers();

        // registerMarker nimmt den Offset relativ zum Cursor.
        // lineIndex = 105, cursorYAbsolute = 70 => offset = 105 - 70 = 35
        expect(mockTerminal.registerMarker).toHaveBeenCalledWith(35); 
    });

    it('should dispose old markers', () => {
        const lineWithCogno = TerminalMockFactory.createLine('^^#1');
        const lineWithoutCogno = TerminalMockFactory.createLine('no cogno');
        
        vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue(lineWithCogno);
        mockTerminal.buffer.active.length = 1;
        mockTerminal.rows = 10;
        mockTerminal.buffer.active.viewportY = 0;
        mockTerminal.buffer.active.baseY = 0;
        mockTerminal.buffer.active.cursorY = 0;

        const decorationMock = { 
            dispose: vi.fn(), 
            onRender: vi.fn(),
            onDispose: vi.fn()
        };
        mockTerminal.registerDecoration.mockReturnValue(decorationMock);

        markerManager.refreshMarkers();
        expect(mockTerminal.registerMarker).toHaveBeenCalledWith(0);
        expect(mockTerminal.registerMarker).toHaveBeenCalledTimes(1);

        vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue(lineWithoutCogno);
        markerManager.refreshMarkers();
        
        expect(decorationMock.dispose).toHaveBeenCalled();
    });

    it('should keep markers that are still in viewport', () => {
        const lineWithCogno = TerminalMockFactory.createLine('^^#1');
        const emptyLine = TerminalMockFactory.createLine(' ');
        vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
            if (index === 0) return lineWithCogno;
            return emptyLine;
        });
        mockTerminal.buffer.active.length = 100;
        mockTerminal.rows = 10;
        mockTerminal.buffer.active.viewportY = 0;
        mockTerminal.buffer.active.baseY = 0;
        mockTerminal.buffer.active.cursorY = 0;

        const decorationMock2 = { 
            dispose: vi.fn(), 
            onRender: vi.fn(),
            onDispose: vi.fn()
        };
        mockTerminal.registerDecoration.mockReturnValue(decorationMock2);

        markerManager.refreshMarkers();
        expect(mockTerminal.registerMarker).toHaveBeenCalledWith(0);
        expect(mockTerminal.registerMarker).toHaveBeenCalledTimes(1);

        // Scroll a bit, but line 0 is still in scan range (viewport 0-10, scan -20 to 30)
        mockTerminal.buffer.active.viewportY = 5;
        markerManager.refreshMarkers();

        expect(decorationMock2.dispose).not.toHaveBeenCalled();
    });
});





