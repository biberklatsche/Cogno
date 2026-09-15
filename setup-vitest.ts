// Vitest setup file
import "@angular/compiler";
import { PathFactory } from "@cogno/core/session/exec/path.factory";
import { shellPathAdapterDefinitions } from "@cogno/core/session/shells/shell-definitions";
import { afterEach, beforeEach, vi } from "vitest";

// Reset all mocks between tests to keep isolation similar to Jest
beforeEach(() => {
  PathFactory.setDefinitions([...shellPathAdapterDefinitions]);
});

afterEach(() => {
  vi.clearAllMocks();
});
