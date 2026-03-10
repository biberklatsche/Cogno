import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetCommandSpecRegistry } from "./asset-command-spec.registry";

describe("AssetCommandSpecRegistry", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("loads command names and command specs from assets endpoints", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/src/app/assets/autocomplete/manifest.json")) {
                return {
                    ok: true,
                    json: async () => [
                        { name: "git", file: "git.json" },
                    ],
                } as Response;
            }
            if (url.endsWith("/src/app/assets/autocomplete/commands/git.json")) {
                return {
                    ok: true,
                    json: async () => ({
                        name: "git",
                        subcommands: [{ name: "commit" }],
                    }),
                } as Response;
            }
            return { ok: false, json: async () => ({}) } as Response;
        });
        vi.stubGlobal("fetch", fetchMock);

        const registry = new AssetCommandSpecRegistry();
        const names = await registry.commandNames();
        expect(names).toEqual(["git"]);

        const spec = await registry.get("git");
        const subs = (spec?.subcommands ?? []).map(v => typeof v === "string" ? v : v.name);
        expect(subs).toContain("commit");
    });
});
