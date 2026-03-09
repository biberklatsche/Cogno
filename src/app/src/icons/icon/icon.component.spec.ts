import { describe, it, expect } from 'vitest';
import { IconComponent } from './icon.component';
import {
  mdiAbTesting,
  mdiClose,
  mdiGithub,
  mdiKeyboardOff,
  mdiSpiderThread
} from '@mdi/js';

describe('IconComponent', () => {
  it('should have mdiAbTesting as default icon', () => {
    const cmp = new IconComponent();
    expect(cmp.icon).toBe(mdiAbTesting);
  });

  it('should map known names to corresponding mdi icon paths', () => {
    const cmp = new IconComponent();

    cmp.name = 'mdiClose';
    expect(cmp.icon).toBe(mdiClose);

    cmp.name = 'mdiGithub';
    expect(cmp.icon).toBe(mdiGithub);

    cmp.name = 'mdiKeyboardOff';
    expect(cmp.icon).toBe(mdiKeyboardOff);

    cmp.name = 'mdiSpiderThread';
    expect(cmp.icon).toBe(mdiSpiderThread);
  });

  it('should fall back to mdiAbTesting when given an unknown name', () => {
    const cmp = new IconComponent();
    // Force an unknown name to trigger the default case
    (cmp as any).name = 'mdiUnknownValue';
    expect(cmp.icon).toBe(mdiAbTesting);
  });
});
