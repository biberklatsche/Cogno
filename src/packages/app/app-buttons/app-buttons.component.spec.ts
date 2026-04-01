import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppButtonsComponent } from './app-buttons.component';
import { AppButtonsService } from './+state/app-buttons.service';
import { AppWindow } from '@cogno/app-tauri/window';
import { Subject } from 'rxjs';

describe('AppButtonsComponent', () => {
  let component: AppButtonsComponent;
  let service: AppButtonsService;
  let windowSize$: Subject<{ width: number, height: number }>;
  let busMock: any;
  let destroyRefMock: any;

  beforeEach(() => {
    windowSize$ = new Subject();
    // @ts-ignore
    AppWindow.windowSize$ = windowSize$;
    
    // Default mock implementations for AppWindow methods used in service
    vi.mocked(AppWindow.isMaximized).mockResolvedValue(false);
    vi.mocked(AppWindow.minimize).mockResolvedValue();
    vi.mocked(AppWindow.maximize).mockResolvedValue();
    vi.mocked(AppWindow.unmaximize).mockResolvedValue();

    busMock = {
      publish: vi.fn(),
      on$: vi.fn()
    };
    
    destroyRefMock = {
      onDestroy: vi.fn()
    };

    // Instantiate real service with mocked dependencies
    service = new AppButtonsService(destroyRefMock, busMock);
    
    // Instantiate component with the real service
    component = new AppButtonsComponent(service);
  });

  it('should call service.closeWindow when close is called', () => {
    const spy = vi.spyOn(service, 'closeWindow');
    component.close();
    expect(spy).toHaveBeenCalled();
  });

  it('should call service.minimizeWindow when minimize is called', () => {
    const spy = vi.spyOn(service, 'minimizeWindow');
    component.minimize();
    expect(spy).toHaveBeenCalled();
  });

  describe('toggleMaximize', () => {
    it('should call service.maximizeWindow when not maximized', async () => {
      // Ensure initial state is not maximized
      vi.mocked(AppWindow.isMaximized).mockResolvedValue(false);
      
      // We need to trigger a windowSize$ emission to update service state
      windowSize$.next({ width: 100, height: 100 });
      // Wait for async update in service
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(service.isMaximized()).toBe(false);

      const spyMaximize = vi.spyOn(service, 'maximizeWindow');
      
      component.toggleMaximize();
      
      expect(spyMaximize).toHaveBeenCalled();
    });

    it('should call service.unmaximizeWindow when maximized', async () => {
      // Set maximized state
      vi.mocked(AppWindow.isMaximized).mockResolvedValue(true);
      
      // Trigger update
      windowSize$.next({ width: 100, height: 100 });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(service.isMaximized()).toBe(true);

      const spyUnmaximize = vi.spyOn(service, 'unmaximizeWindow');
      
      component.toggleMaximize();
      
      expect(spyUnmaximize).toHaveBeenCalled();
    });
  });
});


