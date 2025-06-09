import { TestBed } from '@angular/core/testing';

import { SettingsFileService } from './settings-file.service';

describe('SettingsFileService', () => {
  let service: SettingsFileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsFileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
