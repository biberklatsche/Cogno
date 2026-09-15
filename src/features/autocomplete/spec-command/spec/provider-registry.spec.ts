import { describe, expect, it, vi } from "vitest";
import { SpecProviderRegistry } from "./provider-registry";
import type { SpecSuggestionProvider } from "./spec.types";

describe("SpecProviderRegistry", () => {
  it("keeps unconstrained providers eligible even when registered later", () => {
    const firstProvider: SpecSuggestionProvider = {
      id: "filesystem",
      suggest: vi.fn(),
    };
    const secondProvider: SpecSuggestionProvider = {
      id: "command-list",
      suggest: vi.fn(),
    };

    const registry = new SpecProviderRegistry([firstProvider, secondProvider]);

    const resolvedProvider = registry.resolve("command-list", {
      shellType: "ZSH",
      backendOs: "macos",
    });

    expect(resolvedProvider).toBe(secondProvider);
  });
});
