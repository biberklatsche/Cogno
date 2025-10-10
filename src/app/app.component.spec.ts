import { AppComponent } from './app.component';
import { describe, beforeEach, test, expect, vi } from 'vitest';
import { AppBus, CommandBus, EventBus } from './event-bus/event-bus';

// Unit test without Angular TestBed: verifies that AppComponent sends the expected commands on construction

describe('AppComponent', () => {
  let appBus: AppBus;

  beforeEach(() => {
    appBus = new AppBus(new EventBus(), new CommandBus());
  });

  test('should send LoadConfigCommand and WatchConfigCommand on init (constructor)', () => {
    const sendSpy = vi.spyOn(appBus, 'send');

    // When we construct the component, it should immediately send the commands
    const component = new AppComponent(appBus);

    expect(sendSpy).toHaveBeenCalledWith({ type: 'LoadConfigCommand' });
    expect(sendSpy).toHaveBeenCalledWith({ type: 'WatchConfigCommand' });
  });
});
