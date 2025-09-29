import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowButtonsComponent } from './window-buttons.component';
import { WindowButtonsService } from './+state/window-buttons.service';
import { Subject } from 'rxjs';
import {AppWindow} from "../../../__mocks__/_tauri-window";


describe('WindowButtonsComponent (class only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createServiceWithControlledMaximized(initialIsMaximized: boolean) {
    // Prepare a controllable windowSize$ before creating the service so the subscription uses it
    const size$ = new Subject<{ width: number; height: number }>();
    AppWindow.windowSize$ = size$.asObservable();

    // Control what isMaximized resolves to when subscription reacts to emissions
    // Vitest mock
    (AppWindow.isMaximized as any).mockResolvedValue(initialIsMaximized);

    const destroyRef: any = { onDestroy: vi.fn() };
    const service = new WindowButtonsService(destroyRef);

    // Trigger one emission so the service queries isMaximized and updates the signal
    size$.next({ width: 800, height: 600 });

    const flush = async () => {
      // Allow the async subscription callback to run and set the signal
      await Promise.resolve();
      await Promise.resolve();
    };

    return { service, size$, flush };
  }

  it('calls AppWindow.close() when close() is invoked', async () => {
    const { service, flush } = createServiceWithControlledMaximized(false);
    await flush();
    const component = new WindowButtonsComponent(service);

    component.close();

    expect(AppWindow.close).toHaveBeenCalledTimes(1);
  });

  it('calls AppWindow.minimize() when minimize() is invoked', async () => {
    const { service, flush } = createServiceWithControlledMaximized(false);
    await flush();
    const component = new WindowButtonsComponent(service);

    component.minimize();

    expect(AppWindow.minimize).toHaveBeenCalledTimes(1);
  });

  it('toggleMaximize() maximizes when not maximized', async () => {
    const { service, flush } = createServiceWithControlledMaximized(false);
    await flush();
    const component = new WindowButtonsComponent(service);

    expect(service.isMaximized()).toBe(false);

    component.toggleMaximize();

    expect(AppWindow.maximize).toHaveBeenCalledTimes(1);
    expect(AppWindow.unmaximize).not.toHaveBeenCalled();
  });

  it('toggleMaximize() unmaximizes when currently maximized', async () => {
    const { service, flush } = createServiceWithControlledMaximized(true);
    await flush();
    const component = new WindowButtonsComponent(service);

    expect(service.isMaximized()).toBe(true);

    component.toggleMaximize();

    expect(AppWindow.unmaximize).toHaveBeenCalledTimes(1);
    expect(AppWindow.maximize).not.toHaveBeenCalled();
  });

  it('service updates isMaximized based on windowSize$ emissions', async () => {
    const { service, size$, flush } = createServiceWithControlledMaximized(false);
    await flush();
    expect(service.isMaximized()).toBe(false);

    // Next emission should update according to current AppWindow.isMaximized() value
    (AppWindow.isMaximized as any).mockResolvedValueOnce(true);
    size$.next({ width: 1024, height: 768 });
    await flush();

    expect(service.isMaximized()).toBe(true);
  });
});
