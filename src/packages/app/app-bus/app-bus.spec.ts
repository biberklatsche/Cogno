import { AppBus } from './app-bus';
import { firstValueFrom} from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import {AppMessage} from "./messages";

describe('AppBus', () => {
  let bus: AppBus;

  beforeEach(() => {
    bus = new AppBus();
  });

  it('should publish and receive a message on the default path ["app"]', async () => {
    const message: AppMessage = { type: 'Cut', payload: 'term1' };

    const promise = firstValueFrom(bus.onType$('Cut'));
    bus.publish(message);

    const received = await promise;
    expect(received.type).toBe('Cut');
    expect(received.phase).toBe('target');
  });

  it('should go through Capture, Target and Bubble phases', async () => {
    const path = ['app', 'workspace', 'terminal'];
    const message: AppMessage = { type: 'PtyInitialized', path, payload: { terminalId: 'term1', shellType: 'Bash' } };

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
    const path = ['app', 'child'];
    const message: AppMessage = { type: 'PtyInitialized', path, payload: { terminalId: 'term1', shellType: 'Bash' } };

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
    const type = 'ConfigLoaded';

    const promise = firstValueFrom(bus.onceType$(type));

    bus.publish({ type });
    bus.publish({ type }); // Second message

    const received = await promise;
    expect(received.type).toBe(type);
    // If it had fired more than once, the promise would already be resolved.
    // We are testing here that it resolves at all.
  });

  it('once$ should fail with a timeout if no message arrives', async () => {
    const promise = firstValueFrom(bus.once$({
      path: ['app'],
      type: 'ConfigLoaded',
      timeoutMs: 10
    }));

    await expect(promise).rejects.toThrow();
  });

  it('should be able to filter by types (Array)', async () => {
      const events: string[] = [];

      bus.on$({
          path: ['app'],
          type: ['TabAdded', 'TabRemoved']
      }).subscribe(m => events.push(m.type));

      bus.publish({ type: 'TabAdded', payload: { tabId: 't1', isActive: true } });
      bus.publish({ type: 'ConfigLoaded' });
      bus.publish({ type: 'TabRemoved', payload: 't1' });

      expect(events).toEqual(['TabAdded', 'TabRemoved']);
  });

  it('should return defaultPrevented correctly', () => {
    const message: AppMessage = { type: 'ConfigLoaded' };

    bus.onType$('ConfigLoaded').subscribe(m => {
      m.defaultPrevented = true;
    });

    const result = bus.publish(message);
    expect(result.defaultPrevented).toBe(true);
  });

  it('should return performed correctly', () => {
    const message: AppMessage = { type: 'ConfigLoaded' };

    bus.onType$('ConfigLoaded').subscribe(m => {
      m.performed = true;
    });

    const result = bus.publish(message);
    expect(result.performed).toBe(true);
  });
});


