export class AutocompleteTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Provider did not respond within ${timeoutMs}ms.`);
    this.name = "AutocompleteTimeoutError";
  }
}

/** Rejects with `AutocompleteTimeoutError` when `promise` does not settle within `timeoutMs`. */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new AutocompleteTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
