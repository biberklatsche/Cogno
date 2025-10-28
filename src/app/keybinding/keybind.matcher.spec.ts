import { describe, it, expect, test, beforeEach } from 'vitest';
import { KeybindingMatcher } from './keybind.matcher';
import type { KeyboardMapping } from './keyboard/keyboard-layouts/_.contribution';

function makeEvent(init: KeyboardEventInit & { key?: string; code?: string } = {}): KeyboardEvent {
  // Happy DOM supports KeyboardEvent with init
  const e = new KeyboardEvent('keydown', init);
  // Some environments don't reflect "code" from init; ensure presence via type cast
  Object.defineProperty(e, 'code', { value: init.code ?? '', configurable: true });
  Object.defineProperty(e, 'key', { value: init.key ?? '', configurable: true });
  return e;
}

describe('KeybindingMatcher', () => {
  let matcher: KeybindingMatcher;

  beforeEach(() => {
    matcher = new KeybindingMatcher();
    // Provide a minimal default keyCode mapping for letter keys used in tests
    matcher.initKeyCodeMapping({
      KeyA: 'A',
      KeyK: 'K'
    } as unknown as KeyboardMapping);
  });

  it('matches a simple keybinding with Control+Shift in any order in the binding string', () => {
    matcher.initBindings(['Shift+Control+A:doA']);

    const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, shiftKey: true });
    const action = matcher.match(event);

    expect(action).toBe('doA');
  });

  it('uses keyCodeMapping to resolve the main key from event.code', () => {
    const mapping: KeyboardMapping = { KeyY: 'Z' } as const; // e.g., on German layout Y key produces Z
    matcher.initKeyCodeMapping(mapping);
    matcher.initBindings(['Control+Z:undo']);

    const event = makeEvent({ key: 'y', code: 'KeyY', ctrlKey: true });
    const action = matcher.match(event);

    expect(action).toBe('undo');
  });

  it('supports Command (meta) modifier on platforms that provide metaKey', () => {
    matcher.initBindings(['Command+K:openCommandPalette']);

    const event = makeEvent({ key: 'k', code: 'KeyK', metaKey: true });
    const action = matcher.match(event);

    expect(action).toBe('openCommandPalette');
  });

  it('should match Alt+Control and Control+Alt as same action', () => {
    matcher.initBindings(['Alt+Control+A:doA']);
    const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action).toBe('doA');
  });

    it('u', () => {
        matcher.initBindings(['Alt+Control+A:doA']);
        const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true });
        const action = matcher.match(event);
        expect(action).toBe('doA');
    });
});
