import { AppButtonsService } from './app-buttons.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppWindow } from '../../_tauri/window';
import { Subject } from 'rxjs';

describe('AppButtonsService', () => {
  let service: AppButtonsService;
  let windowSize$: Subject<{ width: number, height: number }>;
  let busMock: any;
  let destroyRefMock: any;

  beforeEach(() => {
    windowSize$ = new Subject();
    // @ts-ignore
    AppWindow.windowSize$ = windowSize$;
    
    busMock = {
      publish: vi.fn(),
      on$: vi.fn()
    };
    
    destroyRefMock = {
      onDestroy: vi.fn()
    };

    service = new AppButtonsService(destroyRefMock, busMock);
  });

  it('should initialize isMaximized based on AppWindow.isMaximized when windowSize$ emits', async () => {
    vi.mocked(AppWindow.isMaximized).mockResolvedValue(true);
    
    // Trigger window size change
    windowSize$.next({ width: 1024, height: 768 });
    
    // Wait for async call in subscription
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(service.isMaximized()).toBe(true);
    expect(AppWindow.isMaximized).toHaveBeenCalled();
  });

  it('should publish close_window action when closeWindow is called', () => {
    service.closeWindow();
    
    expect(busMock.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ActionFired',
      payload: 'close_window'
    }));
  });

  it('should call AppWindow.minimize when minimizeWindow is called', () => {
    service.minimizeWindow();
    expect(AppWindow.minimize).toHaveBeenCalled();
  });

  it('should call AppWindow.maximize when maximizeWindow is called', () => {
    service.maximizeWindow();
    expect(AppWindow.maximize).toHaveBeenCalled();
  });

  it('should call AppWindow.unmaximize when unmaximizeWindow is called', () => {
    service.unmaximizeWindow();
    expect(AppWindow.unmaximize).toHaveBeenCalled();
  });
});
