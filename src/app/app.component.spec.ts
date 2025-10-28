import { AppComponent } from './app.component';
import { describe, beforeEach, test, expect, vi } from 'vitest';
import {AppBus} from "./app-bus/app-bus";

// Unit test without Angular TestBed: verifies that AppComponent sends the expected commands on construction

describe('AppComponent', () => {
  let appBus: AppBus;

  beforeEach(() => {
    appBus = new AppBus();
  });

  test('should send LoadConfigCommand and WatchConfigCommand on init (constructor)', () => {
    const sendSpy = vi.spyOn(appBus, 'publish');

    // When we construct the component, it should immediately send the commands
    const component = new AppComponent(appBus);

    // Allow additional properties such as phase added by AppBus.publish
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'LoadConfigCommand' }));
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'WatchConfigCommand' }));
  });
});
