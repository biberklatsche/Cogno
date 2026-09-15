/** Human-friendly "how long ago" for the auto-save status tooltip (step 27g). */
export function relativeSavedTime(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) {
    return "gerade eben";
  }
  if (seconds < 60) {
    return `vor ${seconds} s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `vor ${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  return `vor ${hours} h`;
}
