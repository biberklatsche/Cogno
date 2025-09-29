import { AppComponent } from './app.component';
import { SettingsService } from './settings/+state/settings.service';
import { DestroyRef } from '@angular/core';
import { describe, beforeEach, test, expect, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

describe('AppComponent', () => {
  let settingsService: SettingsService;
  const destroyRef: DestroyRef = {
    onDestroy: vi.fn((_cb: VoidFunction) => {}),
  } as unknown as DestroyRef;

  beforeEach(() => {
    settingsService = new SettingsService(destroyRef);
  });

  test('app should load settings on init', async () => {
    const settingsPromise = firstValueFrom(settingsService.settings$);
    const component = new AppComponent(settingsService);
    const settings = await settingsPromise;
    expect(settings).toBeTruthy();
  });
});
