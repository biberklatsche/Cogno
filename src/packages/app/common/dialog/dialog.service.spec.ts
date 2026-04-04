import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DialogService } from './dialog.service';
import { ApplicationRef, Component, EnvironmentInjector, Injector } from '@angular/core';
import { DialogRef } from './dialog-ref';

// Mock Angular's createComponent
vi.mock('@angular/core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createComponent: vi.fn(),
  };
});

import { createComponent } from '@angular/core';

@Component({
  selector: 'app-test-content',
  standalone: true,
  template: '<div>Test Content</div>'
})
class TestContentComponent {}

describe('DialogService', () => {
  let service: DialogService;
  let appRefMock: any;
  let envInjectorMock: any;
  let injectorMock: any;
  let componentRefMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    appRefMock = {
      attachView: vi.fn(),
      detachView: vi.fn(),
    };
    envInjectorMock = {
        get: vi.fn(),
        runInContext: vi.fn((fn: any) => fn()),
    };
    injectorMock = {
      get: vi.fn(),
    };

    const hostEl = document.createElement('div');
    componentRefMock = {
      instance: {
        dialogRef: vi.fn().mockReturnValue(new DialogRef(1, vi.fn())),
        setInput: vi.fn(),
      },
      location: {
        nativeElement: hostEl,
      },
      hostView: {},
      destroy: vi.fn(),
      setInput: vi.fn(),
    };

    vi.mocked(createComponent).mockReturnValue(componentRefMock);

    service = new DialogService(
      appRefMock as ApplicationRef,
      envInjectorMock as EnvironmentInjector,
      injectorMock as Injector
    );

    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => node) as any);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a dialog container and return a DialogRef', () => {
    const dialogRef = service.open(TestContentComponent, { title: 'Test Dialog' });

    expect(dialogRef).toBeInstanceOf(DialogRef);
    expect(createComponent).toHaveBeenCalled();
    expect(appRefMock.attachView).toHaveBeenCalledWith(componentRefMock.hostView);
    expect(document.body.appendChild).toHaveBeenCalledWith(componentRefMock.location.nativeElement);
  });

  it('should handle TemplateRef content', () => {
    const templateRefMock = {} as any;
    const dialogRef = service.open(templateRefMock);

    expect(dialogRef).toBeDefined();
    expect(createComponent).toHaveBeenCalled();
  });

  it('should merge provided config with defaults', () => {
    service.open(TestContentComponent, { showCloseButton: true });

    expect(componentRefMock.setInput).toHaveBeenCalledWith('config', expect.objectContaining({
      hasBackdrop: true,
      showCloseButton: true,
    }));
  });

  it('should destroy the component and remove from DOM when closed', () => {
    const hostEl = componentRefMock.location.nativeElement;
    vi.spyOn(hostEl, 'remove');

    // We call open. Internally, a DialogRef is created.
    // But since we mock componentRefMock.instance.dialogRef,
    // we need to ensure that we can test the real behavior,
    // or at least that the destroy function created by the service is correct.
    
    // To test the internal 'destroy' function, we must allow the service
    // to create a DialogRef, and we must intercept it.
    // OR we mock the DialogRef constructor (difficult in JS/TS).
    
    // Simpler way: We look at what the service does with hostRef.setInput('dialogRef', ...).
    // There it passes the DialogRef it created to the component.
    
    let capturedDialogRef: DialogRef<any> | undefined;
    componentRefMock.setInput.mockImplementation((name: string, value: any) => {
      if (name === 'dialogRef') {
        capturedDialogRef = value;
      }
    });

    service.open(TestContentComponent);

    expect(capturedDialogRef).toBeDefined();
    
    // Jetzt schließen wir den Dialog über das eingefangene DialogRef
    capturedDialogRef?.close();

    expect(appRefMock.detachView).toHaveBeenCalledWith(componentRefMock.hostView);
    expect(componentRefMock.destroy).toHaveBeenCalled();
    expect(hostEl.remove).toHaveBeenCalled();
  });
});


