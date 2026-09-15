import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Syntax-checks the shell integration script templates with the real shells
 * (`bash -n` / `zsh -n`). The .txt templates are executed verbatim on user
 * machines, so a typo ships as a broken terminal. Skipped when the shell is
 * not installed (e.g. zsh on Windows CI).
 */
const shellDir = join(__dirname);

function scriptsIn(subdir: string): string[] {
  return readdirSync(join(shellDir, subdir))
    .filter((name) => name.endsWith(".txt"))
    .map((name) => join(shellDir, subdir, name));
}

function shellAvailable(shell: string): boolean {
  return spawnSync(shell, ["--version"]).status === 0;
}

describe("shell integration script syntax", () => {
  describe.skipIf(!shellAvailable("bash"))("bash", () => {
    for (const script of scriptsIn("bash")) {
      it(`parses ${script.split("/").pop()}`, () => {
        const result = spawnSync("bash", ["-n", script], { encoding: "utf8" });
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
      });
    }
  });

  describe.skipIf(!shellAvailable("zsh"))("zsh", () => {
    for (const script of scriptsIn("zsh")) {
      it(`parses ${script.split("/").pop()}`, () => {
        const result = spawnSync("zsh", ["-n", script], { encoding: "utf8" });
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
      });
    }
  });
});
