import { describe, expect, it } from "vitest";

import { DEFAULT_COMMAND_SPECS } from "./command-spec.registry";
import { importFigSubsetSpecs } from "./importer/fig-lite.importer";

describe("CommandSpecRegistry defaults/importer", () => {
    it("loads imported fig subset defaults", () => {
        const names = DEFAULT_COMMAND_SPECS.map(v => v.name);
        expect(names).toContain("npm");
        expect(names).toContain("git");
        expect(names).toContain("docker");
        expect(names).toContain("kubectl");
    });

    it("deduplicates duplicate entries by command name and values", () => {
        const imported = importFigSubsetSpecs([
            { name: "foo", subcommands: ["a", "a", "b"], options: ["--x", "--x"] },
            { name: "foo", subcommands: ["c"] },
        ]);
        expect(imported).toHaveLength(1);
        expect(imported[0].subcommands).toEqual(["c"]);
    });
});

