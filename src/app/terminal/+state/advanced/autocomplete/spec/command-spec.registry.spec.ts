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
        expect(names).toContain("terraform");
        expect(names).toContain("aws");
        expect(names).toContain("gh");
        expect(names).toContain("cargo");
        expect(names).toContain("helm");
        expect(names).toContain("rg");
        expect(names).toContain("tmux");
        expect(names).toContain("sqlite3");
        expect(names).toContain("mvn");
        expect(names).toContain("gradle");
        expect(names).toContain("python");
        expect(names).toContain("dotnet");
        expect(names).toContain("pulumi");
        expect(names).toContain("vault");
        expect(names).toContain("redis-cli");
        expect(names).toContain("code");
        expect(names).toContain("docker-compose");
        expect(names).toContain("kustomize");
        expect(names).toContain("flux");
        expect(names).toContain("argocd");
        expect(names).toContain("nx");
        expect(names).toContain("turbo");
        expect(names).toContain("vite");
        expect(names).toContain("webpack");
        expect(names).toContain("esbuild");
        expect(names).toContain("op");
        expect(names).toContain("podman");
        expect(names).toContain("k3d");
        expect(names).toContain("sam");
        expect(names).toContain("composer");
        expect(names).toContain("rails");
        expect(names).toContain("dbt");
        expect(names).toContain("tar");
        expect(names).toContain("curl");
        expect(names).toContain("nmap");
        expect(names).toContain("terragrunt");
        expect(names).toContain("ansible-playbook");
        expect(names).toContain("kubectx");
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
        const git = DEFAULT_COMMAND_SPECS.find(v => v.name === "git");
        expect(git).toBeDefined();
        expect(git!.subcommandOptions?.commit).toContain("-a");
        expect(git!.subcommandOptions?.commit).toContain("-m");
        expect(git!.subcommandOptions?.rebase).toContain("--continue");
    });

    it("keeps provider bindings from specs", () => {
        const npm = DEFAULT_COMMAND_SPECS.find(v => v.name === "npm");
        expect(npm).toBeDefined();
        expect(npm!.providers?.some(p => p.providerId === "npm-scripts")).toBe(true);
        expect(npm!.providers?.[0]?.when?.firstArgIn).toContain("run");
    });

    it("keeps shell constraints from command specs", () => {
        const psOnly = DEFAULT_COMMAND_SPECS.find(v => v.name === "Get-ChildItem");
        expect(psOnly).toBeDefined();
        expect(psOnly!.shells).toEqual(["PowerShell"]);
    });
});
