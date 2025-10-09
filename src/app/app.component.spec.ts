import { AppComponent } from './app.component';
import { ConfigService } from './config/+state/config.service';
import { DestroyRef } from '@angular/core';
import { describe, beforeEach, test, expect, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

describe('AppComponent', () => {
  let configService: ConfigService;
  const destroyRef: DestroyRef = {
    onDestroy: vi.fn((_cb: VoidFunction) => {}),
  } as unknown as DestroyRef;

  beforeEach(() => {
    configService = new ConfigService(destroyRef);
  });

  test('app should load settings on init', async () => {
    const settingsPromise = firstValueFrom(configService.config$);
    const component = new AppComponent(configService);
    const settings = await settingsPromise;
    expect(settings).toBeTruthy();
  });
});
