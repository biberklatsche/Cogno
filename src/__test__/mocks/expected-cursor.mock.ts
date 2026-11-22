import { ExpectedCursor } from "@cogno/core/session/model/expected-cursor";

type WithInput = { input: { cursorIndex: number } };

/** Gives a session-model stand-in the model's expected-cursor behaviour. */
export function withExpectedCursor<T extends WithInput>(model: T) {
  const expectedCursor = new ExpectedCursor();
  return Object.defineProperties(model, {
    editingCursorIndex: { get: () => expectedCursor.resolve(model.input.cursorIndex) },
    expectCursorAt: {
      value: (index: number) => expectedCursor.expect(index, model.input.cursorIndex),
    },
    discardExpectedCursor: { value: () => expectedCursor.discard() },
  }) as T & {
    readonly editingCursorIndex: number;
    expectCursorAt(index: number): void;
    discardExpectedCursor(): void;
  };
}
