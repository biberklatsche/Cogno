import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    CdAutocompleteQueryContextContract,
    FilesystemContract,
    QueryContext,
} from "@cogno/core-api";
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

    it("returns directory matches for cd sorted dot", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: ".notes", path: "/.notes", kind: "directory" },
            { name: "files", path: "/files", kind: "directory" },
            { name: "users", path: "/users", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path) => path);

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: cdContext("s"),
            command: "cd",
            args: ["s"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["directory"],
                    appendSlashToDirectories: true,
                },
            },
        });

        expect(result[0].label.toLowerCase()).toEqual('/files/');
        expect(result[1].label.toLowerCase()).toEqual('/users/');
        expect(result[2].label.toLowerCase()).toEqual('/.notes/');

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

        expect(filesystem.list).toHaveBeenCalledWith("/", expect.anything(), {
            directoriesOnly: true,
            filesOnly: undefined,
            query: "",
            limit: 200,
        });
        expect(result.some(r => r.label === "/Users")).toBe(true);
    });

    it("caches query-specific results and narrows by prefix", async () => {
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

        expect(filesystem.list).toHaveBeenCalledTimes(2);
        expect(first.some(r => r.label.toLowerCase().includes("projects"))).toBe(true);
        expect(filesystem.list).toHaveBeenLastCalledWith(
            "/Users/larswolfram/projects",
            expect.anything(),
            {
                directoriesOnly: true,
                filesOnly: undefined,
                query: "pr",
                limit: 200,
            }
        );
        expect(second.some(r => r.label.toLowerCase().includes("projects"))).toBe(true);
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

    it("returns filesystem suggestions sorted by name", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "zeta.txt", path: "/Users/larswolfram/projects/zeta.txt", kind: "file" },
            { name: "alpha.txt", path: "/Users/larswolfram/projects/alpha.txt", kind: "file" },
            { name: "Beta.txt", path: "/Users/larswolfram/projects/Beta.txt", kind: "file" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: commandContext("cat "),
            command: "cat",
            args: [],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["file"],
                },
            },
        });

        expect(result.map((suggestion) => suggestion.label)).toEqual([
            "alpha.txt",
            "Beta.txt",
            "zeta.txt",
        ]);
    });

    it("uses backslashes for PowerShell directory labels", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "Users", path: "/Users", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path) => path);
        vi.mocked(filesystem.appendPathSeparator).mockImplementation((path) => `${path.replace(/\//g, "\\")}\\`);

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: {
                ...cdContext("u"),
                shellContext: { shellType: "PowerShell", backendOs: "windows" },
            },
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

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("\\Users\\");
        expect(result[0].insertText).toBe("\\Users\\");
    });

    it("keeps directory labels readable and escapes bash insert text for spaces", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "My Folder", path: "/Users/larswolfram/projects/My Folder", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));
        vi.mocked(filesystem.appendPathSeparator).mockImplementation((path) => `${path}/`);

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: cdContext("My\\ Fo"),
            command: "cd",
            args: ["My\\ Fo"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["directory"],
                    appendSlashToDirectories: true,
                },
            },
        });

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("My Folder/");
        expect(result[0].insertText).toBe("My\\ Folder/");
    });

    it("keeps directory labels readable and escapes powershell insert text for spaces", async () => {
        vi.mocked(filesystem.list).mockResolvedValue([
            { name: "My Folder", path: "/Users/My Folder", kind: "directory" },
        ]);
        vi.mocked(filesystem.toDisplayPath).mockImplementation((path) => path.replace(/\//g, "\\"));
        vi.mocked(filesystem.appendPathSeparator).mockImplementation((path) => `${path}\\`);

        const provider = new FilesystemSpecProvider(filesystem);
        const result = await provider.suggest({
            queryContext: {
                ...cdContext("My` Fo"),
                shellContext: { shellType: "PowerShell", backendOs: "windows" },
            },
            command: "cd",
            args: ["My` Fo"],
            binding: {
                providerId: "filesystem",
                params: {
                    kinds: ["directory"],
                    appendSlashToDirectories: true,
                },
            },
        });

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("\\Users\\My Folder\\");
        expect(result[0].insertText).toBe("\\Users\\My` Folder\\");
    });
});



