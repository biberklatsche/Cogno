export function sleep(durationInMilliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, durationInMilliseconds);
  });
}
