// src/store.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { rootStore, Store, createStore, upsertArray } from './store';

type Cfg = { a: number; b: string; nested?: { x: number } };

describe('RootStore + Store', () => {
    beforeEach(() => {
        // Reset rootStore state between tests
        rootStore.clearAllStores();
    });

    it('registers and reads state via Store.get()', () => {
        const s = new Store<Cfg>('cfg', { a: 1, b: 'x' });
        expect(s.get(st => st.a)).toBe(1);
        expect(s.get(st => st.b)).toBe('x');
        s.dispose();
    });

    it('select() emits only when values change (distinctUntilChanged)', async () => {
        const s = new Store<Cfg>('cfg', { a: 1, b: 'x' });
        const values: number[] = [];
        const sub = s.select(st => st.a).subscribe(v => values.push(v));

        // no change in "a" -> no emission
        s.update({ b: 'y' });
        // change in "a" -> emit
        s.update({ a: 2 });
        // same value -> no emission
        s.update({ a: 2 });

        expect(values).toEqual([1, 2]); // initial + changed
        sub.unsubscribe();
        s.dispose();
    });

    it('update() with Partial merges state', () => {
        const s = new Store<Cfg>('cfg', { a: 1, b: 'x' });
        s.update({ b: 'y' });
        expect(s.get(st => st)).toEqual({ a: 1, b: 'y' });
        s.dispose();
    });

    it('update() accepts functional form', () => {
        const s = new Store<Cfg>('cfg', { a: 1, b: 'x' });
        s.update(st => ({ a: st.a + 1 }));
        expect(s.get(st => st.a)).toBe(2);
        s.dispose();
    });

    it('dispose() removes Store from RootState', () => {
        const s = new Store<Cfg>('cfg', { a: 1, b: 'x' });
        s.dispose();
        expect(rootStore.getStoreIds()).not.toContain('cfg');
    });

    it('createStore() creates a working Store', () => {
        const s = createStore<Cfg>('cfg', { a: 7, b: 'p' });
        expect(s.get(st => st.a)).toBe(7);
        s.dispose();
    });

    it('onEvent()/sendEvent() works with filter', () =>
        new Promise<void>(resolve => {
            const s = new Store<Cfg>('cfg', { a: 1, b: 'x' });
            const sub = s
                .onEvent((e: Event) => e.type === 'custom')
                .subscribe(e => {
                    expect(e.type).toBe('custom');
                    sub.unsubscribe();
                    s.dispose();
                    resolve();
                });

            // filtered out
            s.sendEvent(new Event('ignored'));
            // this should pass the filter
            s.sendEvent(new Event('custom'));
        }));

    it('getStoreIds() lists all registered stores', () => {
        const s1 = new Store<Cfg>('one', { a: 1, b: 'x' });
        const s2 = new Store<Cfg>('two', { a: 2, b: 'y' });
        expect(rootStore.getStoreIds().sort()).toEqual(['one', 'two']);
        s1.dispose();
        s2.dispose();
    });

    it('clearAllStores() resets RootState with new BehaviorSubject', () => {
        const s = new Store<Cfg>('cfg', { a: 1, b: 'x' });
        rootStore.clearAllStores();

        // After reset, new store can register normally
        const s2 = new Store<Cfg>('cfg2', { a: 9, b: 'z' });
        expect(s2.get(st => st.a)).toBe(9);
        s2.dispose();
        s.dispose();
    });
});

describe('upsertArray()', () => {
    it('adds item if key not found', () => {
        const arr = [{ id: 1, v: 'a' }];
        const res = upsertArray('id', arr, { id: 2, v: 'b' });
        expect(res).toEqual([
            { id: 1, v: 'a' },
            { id: 2, v: 'b' }
        ]);
        // original array remains unchanged
        expect(arr).toEqual([{ id: 1, v: 'a' }]);
    });

    it('replaces item if key exists (immutability preserved)', () => {
        const arr = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }];
        const res = upsertArray('id', arr, { id: 2, v: 'B' });
        expect(res).toEqual([{ id: 1, v: 'a' }, { id: 2, v: 'B' }]);
        expect(res).not.toBe(arr); // should be a new array instance
    });
});
