import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    CdAutocompleteQueryContextContract,
    FilesystemContract,
} from "@cogno/core-sdk";
import { FilesystemDirectorySuggestor } from "./filesystem-directory.suggestor";

function cdContext(fragment: string): CdAutocompleteQueryContextContract {
    return {
        mode: "cd",
        beforeCursor: `cd ${fragment}`,
        inputText: `cd ${fragment}`,
        cursorIndex: 3 + fragment.length,
        replaceStart: 3,
        replaceEnd: 3 + fragment.length,
        cwd: "/Users/larswolfram/projects",
        shellContext: { shellType: "Bash", backendOs: "macos" },
        fragment,
    };
}

describe("FilesystemDirectorySuggestor", () => {
    let filesystem: FilesystemContract;

    beforeEach(() => {
        filesystem = {
            normalizePath: vi.fn((path) => path),
            resolvePath: vi.fn((cwd, input) => {
                if (input.startsWith("/")) return input;
                return `${cwd.replace(/\/$/, "")}/${input}`.replace(/\/+/g, "/");
            }),
            list: vi.fn(),
            exists: vi.fn(),
            readTextFile: vi.fn(),
            toDisplayPath: vi.fn((path, cwd) => path.replace(cwd, "").replace(/^$/, ".") || "."),
            toRelativePath: vi.fn((path) => path),
        };
    });

    it("returns directory matches and excludes parent traversals", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "Users", path: "/Users", kind: "directory" },
            { name: "tmp", path: "/tmp", kind: "directory" },
            { name: "notes.txt", path: "/notes.txt", kind: "file" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path) => path);

        const suggestor = new FilesystemDirectorySuggestor(filesystem);
        const result = await suggestor.suggest(cdContext("u"));

        expect(result.some(r => r.label.toLowerCase().includes("users"))).toBe(true);
        expect(result.some(r => r.label.startsWith("../"))).toBe(false);
    });

    it("resolves absolute root fragments", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "Users", path: "/Users", kind: "directory" },
            { name: "tmp", path: "/tmp", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path) => path);

        const suggestor = new FilesystemDirectorySuggestor(filesystem);
        const result = await suggestor.suggest(cdContext("/"));

        expect(filesystem.list).toHaveBeenCalledWith("/", expect.anything(), { directoriesOnly: true });
        expect(result.some(r => r.label === "/Users")).toBe(true);
    });

    it("reuses cached dir results and narrows by prefix", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "Projects", path: "/Users/larswolfram/projects/Projects", kind: "directory" },
            { name: "Private", path: "/Users/larswolfram/projects/Private", kind: "directory" },
            { name: "tmp", path: "/Users/larswolfram/projects/tmp", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));

        const suggestor = new FilesystemDirectorySuggestor(filesystem);
        const first = await suggestor.suggest(cdContext("p"));
        const second = await suggestor.suggest(cdContext("pr"));

        expect(filesystem.list).toHaveBeenCalledTimes(1);
        expect(first.some(r => r.label.toLowerCase().includes("projects"))).toBe(true);
        expect(second.every(r => r.label.toLowerCase().includes("pr"))).toBe(true);
    });
});
