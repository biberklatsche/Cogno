import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CliActionService } from './cli-action.service';
import { CliActionListener } from '@cogno/app-tauri/cli-action';
import { KeybindActionInterpreter } from '../keybinding/keybind-action.interpreter';
import { ActionFired } from '../action/action.models';

describe('CliActionService', () => {
  let service: CliActionService;
  let busMock: any;
  let destroyRefMock: any;
  let registerSpy: any;
  let unlistenMock: any;

  beforeEach(() => {
    unlistenMock = vi.fn();
    registerSpy = vi.spyOn(CliActionListener, 'register').mockResolvedValue(unlistenMock);
    
    busMock = {
      publish: vi.fn(),
    };
    
    destroyRefMock = {
      onDestroy: vi.fn(),
    };
  });

  it('should register a listener on initialization', () => {
    service = new CliActionService(busMock, destroyRefMock);
    expect(registerSpy).toHaveBeenCalled();
  });

  it('should parse and publish action when listener is triggered', async () => {
    service = new CliActionService(busMock, destroyRefMock);
    
    // Get the callback passed to register
    const callback = registerSpy.mock.calls[0][0];
    
    const testAction = 'test-action';
    const mockActionDef = { actionName: 'test-action' as any, trigger: undefined, args: [] };
    const parseSpy = vi.spyOn(KeybindActionInterpreter, 'parse').mockReturnValue(mockActionDef);
    
    callback(testAction);
    
    expect(parseSpy).toHaveBeenCalledWith(testAction);
    expect(busMock.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ActionFired',
      payload: 'test-action'
    }));
  });

  it('should call unlisten when DestroyRef.onDestroy is triggered', async () => {
    service = new CliActionService(busMock, destroyRefMock);
    
    // Wait for the register promise to resolve
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(destroyRefMock.onDestroy).toHaveBeenCalled();
    
    // Get the cleanup function passed to onDestroy
    const cleanup = destroyRefMock.onDestroy.mock.calls[0][0];
    cleanup();
    
    expect(unlistenMock).toHaveBeenCalled();
  });
});


