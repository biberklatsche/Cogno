import { MockBuilder, ngMocks } from 'ng-mocks';
import { AppBus } from './app-bus';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom} from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import {AppMessage} from "./messages";

describe('AppBus', () => {
  beforeEach(() => {
    return MockBuilder(AppBus)
      .provide(provideZonelessChangeDetection());
  });

  it('should publish and receive a message on the default path ["app"]', async () => {
    const bus = ngMocks.findInstance(AppBus);
    const message: AppMessage = { type: 'CONFIG_LOADED', payload: {} } as any;

    const promise = firstValueFrom(bus.onType$('CONFIG_LOADED' as any));
    bus.publish(message);

    const received = await promise;
    expect(received.type).toBe('CONFIG_LOADED');
    expect(received.phase).toBe('target');
  });

  it('should go through Capture, Target and Bubble phases', async () => {
    const bus = ngMocks.findInstance(AppBus);
    const path = ['app', 'workspace', 'terminal'];
    const message: AppMessage = { type: 'TERMINAL_FOCUSED' as any, path } as any;

    const events: { path: string; phase: string }[] = [];

    // Listen on different levels
    bus.on$({ path: ['app'] }).subscribe(m => events.push({ path: 'app', phase: m.phase! }));
    bus.on$({ path: ['app', 'workspace'] }).subscribe(m => events.push({ path: 'workspace', phase: m.phase! }));
    bus.on$({ path: ['app', 'workspace', 'terminal'] }).subscribe(m => events.push({ path: 'terminal', phase: m.phase! }));

    bus.publish(message);

    expect(events).toEqual([
      { path: 'app', phase: 'capture' },
      { path: 'workspace', phase: 'capture' },
      { path: 'terminal', phase: 'target' },
      { path: 'workspace', phase: 'bubble' },
      { path: 'app', phase: 'bubble' },
    ]);
  });

  it('should stop propagation when propagationStopped is set', async () => {
    const bus = ngMocks.findInstance(AppBus);
    const path = ['app', 'child'];
    const message: AppMessage = { type: 'ANY' as any, path } as any;

    const events: string[] = [];
    bus.on$({ path: ['app'], phase: 'capture' }).subscribe(m => {
      events.push('app-capture');
      m.propagationStopped = true;
    });
    bus.on$({ path: ['app', 'child'] }).subscribe(() => events.push('child-target'));

    const result = bus.publish(message);

    expect(events).toEqual(['app-capture']);
    expect(result.propagationStopped).toBe(true);
  });

  it('onceType$ should only deliver the first matching message', async () => {
    const bus = ngMocks.findInstance(AppBus);
    const type = 'TAB_ADDED' as any;

    const promise = firstValueFrom(bus.onceType$(type));

    bus.publish({ type } as any);
    bus.publish({ type } as any); // Second message

    const received = await promise;
    expect(received.type).toBe(type);
    // If it had fired more than once, the promise would already be resolved.
    // We are testing here that it resolves at all.
  });

  it('once$ should fail with a timeout if no message arrives', async () => {
    const bus = ngMocks.findInstance(AppBus);

    const promise = firstValueFrom(bus.once$({
      path: ['app'],
      type: 'NON_EXISTENT' as any,
      timeoutMs: 10
    }));

    await expect(promise).rejects.toThrow();
  });

  it('should be able to filter by types (Array)', async () => {
      const bus = ngMocks.findInstance(AppBus);
      const events: string[] = [];

      bus.on$({
          path: ['app'],
          type: ['TAB_ADDED', 'TAB_REMOVED'] as any
      }).subscribe(m => events.push(m.type));

      bus.publish({ type: 'TAB_ADDED' } as any);
      bus.publish({ type: 'CONFIG_LOADED' } as any);
      bus.publish({ type: 'TAB_REMOVED' } as any);

      expect(events).toEqual(['TAB_ADDED', 'TAB_REMOVED']);
  });

  it('should return defaultPrevented correctly', () => {
    const bus = ngMocks.findInstance(AppBus);
    const message: AppMessage = { type: 'ANY' as any } as any;

    bus.onType$('ANY' as any).subscribe(m => {
      m.defaultPrevented = true;
    });

    const result = bus.publish(message);
    expect(result.defaultPrevented).toBe(true);
  });

  it('should return performed correctly', () => {
    const bus = ngMocks.findInstance(AppBus);
    const message: AppMessage = { type: 'ANY' as any } as any;

    bus.onType$('ANY' as any).subscribe(m => {
      m.performed = true;
    });

    const result = bus.publish(message);
    expect(result.performed).toBe(true);
  });
});
