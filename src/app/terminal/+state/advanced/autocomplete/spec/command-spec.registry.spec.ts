import { describe, expect, it } from "vitest";

import { CommandSpecRegistry } from "./command-spec.registry";
import { importFigSubsetSpecs } from "./importer/fig-lite.importer";
import { createCommandSpecsFixture } from "./testing/command-specs.fixture";

describe("CommandSpecRegistry defaults/importer", () => {
    it("loads fixture defaults", () => {
        const specs = createCommandSpecsFixture();
        const names = specs.map(v => v.name);
        expect(names).toContain("npm");
        expect(names).toContain("git");
        expect(names).toContain("docker");
        expect(names).toContain("Get-ChildItem");
    });

    it("deduplicates duplicate entries by command name and values", () => {
        const imported = importFigSubsetSpecs([
            { name: "foo", subcommands: ["a", "a", "b"], options: ["--x", "--x"] },
            { name: "foo", subcommands: ["c"] },
        ]);
        expect(imported).toHaveLength(1);
        expect(imported[0].subcommands).toEqual([{ name: "c" }]);
    });

    it("keeps secondary options from command specs", () => {
        const git = createCommandSpecsFixture().find(v => v.name === "git");
        expect(git).toBeDefined();
        expect(git!.subcommandOptions?.["commit"]).toContain("-a");
        expect(git!.subcommandOptions?.["commit"]).toContain("-m");
    });

    it("keeps provider bindings from specs", () => {
        const npm = createCommandSpecsFixture().find(v => v.name === "npm");
        expect(npm).toBeDefined();
        const run = (npm!.subcommands as any[]).find(v => (typeof v === "string" ? v === "run" : v.name === "run"));
        expect(run).toBeDefined();
        expect(run.providers?.some((p: any) => p.providerId === "npm-scripts")).toBe(true);
    });

    it("keeps shell constraints from command specs", () => {
        const psOnly = createCommandSpecsFixture().find(v => v.name === "Get-ChildItem");
        expect(psOnly).toBeDefined();
        expect(psOnly!.shells).toEqual(["PowerShell"]);
    });

    it("registry returns command specs by name", () => {
        const specs = createCommandSpecsFixture();
        const registry = new CommandSpecRegistry(specs);
        expect(registry.get("npm")?.name).toBe("npm");
        expect(registry.get("unknown")).toBeUndefined();
    });
});
