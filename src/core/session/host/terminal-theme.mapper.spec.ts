import type { Config } from "@cogno/core/infrastructure/config/models/config";
import { describe, expect, it } from "vitest";
import { toTerminalTheme } from "./terminal-theme.mapper";

describe("toTerminalTheme", () => {
  it("maps white and bright white from their own config keys", () => {
    const theme = toTerminalTheme({
      color: { white: "aaaaaa", bright_white: "ffffff" },
    } as Config);

    expect(theme.white).toBe("#aaaaaa");
    expect(theme.brightWhite).toBe("#ffffff");
  });
});
