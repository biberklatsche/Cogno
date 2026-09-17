// Vitest setup file
import "@angular/compiler";
import { afterEach, vi } from "vitest";

// Reset all mocks between tests to keep isolation similar to Jest
afterEach(() => {
  vi.clearAllMocks();
});
