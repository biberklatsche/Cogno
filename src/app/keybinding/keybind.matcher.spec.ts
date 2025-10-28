import { describe, it, expect, beforeEach } from 'vitest';
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

describe('KeybindingMatcher (linux)', () => {
  let matcher: KeybindingMatcher;

  beforeEach(() => {
    matcher = new KeybindingMatcher('linux');
    // Provide a minimal default keyCode mapping for letter keys used in tests
    matcher.initKeyCodeMapping({
      KeyA: 'A',
      KeyK: 'K'
    } as unknown as KeyboardMapping);
  });

  it('matches a simple keybinding with Control+Shift in any order in the binding string', () => {
    matcher.initBindings(['Shift+Ctrl+A=doA']);

    const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, shiftKey: true });
    const action = matcher.match(event);

    expect(action?.type).toBe('doA');
  });

  it('uses keyCodeMapping to resolve the main key from event.code', () => {
    const mapping: KeyboardMapping = { KeyY: 'Z' } as const; // e.g., on German layout Y key produces Z
    matcher.initKeyCodeMapping(mapping);
    matcher.initBindings(['Ctrl+Z=undo']);

    const event = makeEvent({ key: 'y', code: 'KeyY', ctrlKey: true });
    const action = matcher.match(event);

    expect(action?.type).toBe('undo');
  });

  it('supports Meta modifier on Linux using "Meta" keyword', () => {
    matcher.initBindings(['Meta+K=openCommandPalette']);

    const event = makeEvent({ key: 'k', code: 'KeyK', metaKey: true });
    const action = matcher.match(event);

    expect(action?.type).toBe('openCommandPalette');
  });

  it('should match Alt+Control and Control+Alt as same action', () => {
    matcher.initBindings(['Alt+Ctrl+A=doA']);
    const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.type).toBe('doA');
  });

  it('should support one trigger', () => {
    matcher.initBindings(['all:Alt+Ctrl+A=doA']);
    const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.type).toBe('doA');
    expect(action?.triggers).toContain('all');
  });

  it('should support many triggers', () => {
    matcher.initBindings(['all:unconsumed:performable:Alt+Ctrl+A=doA']);
    const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true });
    const action = matcher.match(event);
    expect(action?.type).toBe('doA');
    expect(action?.triggers).toContain('all');
    expect(action?.triggers).toContain('unconsumed');
    expect(action?.triggers).toContain('performable');
  });

    it('should support one arg', () => {
        matcher.initBindings(['all:Alt+Ctrl+A=doA:abc']);
        const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true });
        const action = matcher.match(event);
        expect(action?.type).toBe('doA');
        expect(action?.args).toContain('abc');
    });

    it('should support many args', () => {
        matcher.initBindings(['all:Alt+Ctrl+A=doA:a:b:c']);
        const event = makeEvent({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true });
        const action = matcher.match(event);
        expect(action?.type).toBe('doA');
        expect(action?.args).toContain('a');
        expect(action?.args).toContain('b');
        expect(action?.args).toContain('c');
    });
});

describe('KeybindingMatcher (macos)', () => {
  let matcher: KeybindingMatcher;

  beforeEach(() => {
    matcher = new KeybindingMatcher('macos');
    matcher.initKeyCodeMapping({
      KeyA: 'A',
      KeyK: 'K'
    } as unknown as KeyboardMapping);
  });

  it('maps metaKey to Command on macOS', () => {
    matcher.initBindings(['Command+K=openCommandPalette']);

    const event = makeEvent({ key: 'k', code: 'KeyK', metaKey: true });
    const action = matcher.match(event);

    expect(action?.type).toBe('openCommandPalette');
  });

  it('maps altKey to Option on macOS', () => {
    matcher.initBindings(['Option+A=optAction']);
    const event = makeEvent({ key: 'a', code: 'KeyA', altKey: true });
    const action = matcher.match(event);
    expect(action?.type).toBe('optAction');
  });

  it('maps ctrlKey to Control on macOS (not "Ctrl")', () => {
    matcher.initBindings(['Control+K=controlAction']);
    const event = makeEvent({ key: 'k', code: 'KeyK', ctrlKey: true });
    const action = matcher.match(event);
    expect(action?.type).toBe('controlAction');
  });

  it('supports combined modifiers with any order, using mac labels', () => {
    matcher.initBindings(['Option+Control+A=combo']);
    const event = makeEvent({ key: 'a', code: 'KeyA', altKey: true, ctrlKey: true });
    const action = matcher.match(event);
    expect(action?.type).toBe('combo');
  });
});
