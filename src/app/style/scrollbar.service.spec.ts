import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollbarService } from './scrollbar.service';
import { ConfigServiceMock } from '../../__test__/mocks/config-service.mock';
import { getDestroyRef } from '../../__test__/test-factory';
import { Config } from '../config/+models/config';

describe('ScrollbarService', () => {
  let scrollbarService: ScrollbarService;
  let configService: ConfigServiceMock;
  let destroyRef = getDestroyRef();

  const baseConfig: Config = {
    scrollbar: {
      visibility: 'auto'
    }
  } as Config;

  beforeEach(() => {
    vi.useFakeTimers();
    configService = new ConfigServiceMock();
    configService.setConfig(baseConfig);
    
    // Spy on document.body.classList
    vi.spyOn(document.body.classList, 'add');
    vi.spyOn(document.body.classList, 'remove');
    vi.spyOn(document.body.classList, 'contains');
    
    // Mock window.addEventListener/removeEventListener
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with default visibility "hidden" if not set in config', () => {
    configService.setConfig({ scrollbar: {} } as Config);
    scrollbarService = new ScrollbarService(configService, destroyRef);
    
    // The service calls setVisibility in constructor which calls init
    // If not set, it defaults to 'auto' in the subscription, but the property 'visibility' is initialized to 'hidden'
    // Actually, constructor calls this.init() (visibility='hidden') then subscribes and calls setVisibility
    
    expect(document.body.classList.remove).toHaveBeenCalledWith('scrolling');
  });

  it('should set visibility to "always" and add "scrolling" class', () => {
    configService.setConfig({
      scrollbar: { visibility: 'always' }
    } as Config);
    
    scrollbarService = new ScrollbarService(configService, destroyRef);
    
    expect(document.body.classList.add).toHaveBeenCalledWith('scrolling');
  });

  it('should set visibility to "hidden" and remove "scrolling" class', () => {
    configService.setConfig({
      scrollbar: { visibility: 'hidden' }
    } as Config);
    
    scrollbarService = new ScrollbarService(configService, destroyRef);
    
    expect(document.body.classList.remove).toHaveBeenCalledWith('scrolling');
  });

  describe('auto visibility', () => {
    beforeEach(() => {
      configService.setConfig({
        scrollbar: { visibility: 'auto' }
      } as Config);
      scrollbarService = new ScrollbarService(configService, destroyRef);
    });

    it('should register wheel event listener', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: true });
    });

    it('should add "scrolling" class on wheel event and remove after timeout', () => {
      // Trigger wheel event
      const wheelEvent = new WheelEvent('wheel');
      window.dispatchEvent(wheelEvent);

      expect(document.body.classList.add).toHaveBeenCalledWith('scrolling');

      // Fast-forward time
      vi.advanceTimersByTime(600);

      expect(document.body.classList.remove).toHaveBeenCalledWith('scrolling');
    });

    it('should reset timeout if multiple wheel events occur', () => {
      // Wir verwenden direkt Spies, die wir in jedem Schritt prüfen
      const removeSpy = vi.spyOn(document.body.classList, 'remove');
      const addSpy = vi.spyOn(document.body.classList, 'add');
      
      removeSpy.mockClear();
      addSpy.mockClear();

      window.dispatchEvent(new WheelEvent('wheel'));
      expect(addSpy).toHaveBeenCalledWith('scrolling');

      vi.advanceTimersByTime(300);
      window.dispatchEvent(new WheelEvent('wheel'));

      vi.advanceTimersByTime(300);
      // Erst 300ms seit dem letzten Event, das Timeout (600ms) sollte noch nicht abgelaufen sein.
      expect(removeSpy).not.toHaveBeenCalledWith('scrolling');

      vi.advanceTimersByTime(301); 
      // Jetzt sollte das Timeout abgelaufen sein.
      expect(removeSpy).toHaveBeenCalledWith('scrolling');
    });
  });

  describe('lifecycle', () => {
    it('should remove event listener on dispose', () => {
      configService.setConfig({ scrollbar: { visibility: 'auto' } } as Config);
      scrollbarService = new ScrollbarService(configService, destroyRef);
      
      scrollbarService.setVisibility('hidden');
      
      expect(window.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), false);
    });

    it('should cleanup on ngOnDestroy', () => {
      configService.setConfig({ scrollbar: { visibility: 'auto' } } as Config);
      scrollbarService = new ScrollbarService(configService, destroyRef);
      
      scrollbarService.ngOnDestroy();
      
      expect(window.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), false);
    });
  });
});
