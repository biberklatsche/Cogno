import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    CdAutocompleteQueryContextContract,
    FilesystemContract,
    QueryContext,
} from "@cogno/core-sdk";
import { FilesystemSpecProvider } from "./filesystem.spec-provider";

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

function commandContext(beforeCursor: string): QueryContext {
    return {
        mode: "command",
        beforeCursor,
        inputText: beforeCursor,
        cursorIndex: beforeCursor.length,
        replaceStart: 0,
        replaceEnd: beforeCursor.length,
        cwd: "/Users/larswolfram/projects",
        shellContext: { shellType: "Bash", backendOs: "macos" } as any,
        query: beforeCursor.trim(),
    };
}

describe("FilesystemSpecProvider", () => {
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
            toDisplayPath: vi.fn((path, cwd) => path.replace(`${cwd}/`, "").replace(/^$/, ".") || "."),
            appendPathSeparator: vi.fn((path) => `${path}/`),
            toRelativePath: vi.fn((path) => path),
        };
    });

    it("returns directory matches for cd and excludes files", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "Users", path: "/Users", kind: "directory" },
            { name: "tmp", path: "/tmp", kind: "directory" },
            { name: "notes.txt", path: "/notes.txt", kind: "file" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path) => path);

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: cdContext("u"),
            command: "cd",
            args: ["u"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["directory"],
                    appendSlashToDirectories: true,
                },
            },
        });

        expect(result.some(r => r.label.toLowerCase().includes("users/"))).toBe(true);
        expect(result.some(r => r.label === "/notes.txt")).toBe(false);
    });

    it("resolves absolute root fragments", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "Users", path: "/Users", kind: "directory" },
            { name: "tmp", path: "/tmp", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path) => path);

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: cdContext("/"),
            command: "cd",
            args: ["/"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["directory"],
                },
            },
        });

        expect(filesystem.list).toHaveBeenCalledWith("/", expect.anything(), { directoriesOnly: true, filesOnly: undefined });
        expect(result.some(r => r.label === "/Users")).toBe(true);
    });

    it("reuses cached dir results and narrows by prefix", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "Projects", path: "/Users/larswolfram/projects/Projects", kind: "directory" },
            { name: "Private", path: "/Users/larswolfram/projects/Private", kind: "directory" },
            { name: "tmp", path: "/Users/larswolfram/projects/tmp", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));

        const provider = new FilesystemSpecProvider(filesystem);
        const first = await provider.suggest({
            queryContext: cdContext("p"),
            command: "cd",
            args: ["p"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["directory"],
                },
            },
        });
        const second = await provider.suggest({
            queryContext: cdContext("pr"),
            command: "cd",
            args: ["pr"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["directory"],
                },
            },
        });

        expect(filesystem.list).toHaveBeenCalledTimes(1);
        expect(first.some(r => r.label.toLowerCase().includes("projects"))).toBe(true);
        expect(second.every(r => r.label.toLowerCase().includes("pr"))).toBe(true);
    });

    it("returns file matches for generic command contexts", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "notes.txt", path: "/Users/larswolfram/projects/notes.txt", kind: "file" },
            { name: "package.json", path: "/Users/larswolfram/projects/package.json", kind: "file" },
            { name: "Projects", path: "/Users/larswolfram/projects/Projects", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: commandContext("cat pa"),
            command: "cat",
            args: ["pa"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["file"],
                },
            },
        });

        expect(result.some(r => r.label === "package.json")).toBe(true);
        expect(result.some(r => r.label === "Projects")).toBe(false);
    });
});
