import { describe, expect, it, vi } from "vitest";

import { IPathAdapter } from "@cogno/core-sdk";
import { ShellContext } from "../model/models";
import { HistoryRepository } from "./history.repository";
import { TerminalHistoryPersistenceService } from "./terminal-history-persistence.service";

function flushActions(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

const shellContext: ShellContext = {
    shellType: "Bash",
    backendOs: "macos",
};

const pathAdapter: IPathAdapter = {
    normalize: (input: string) => input.trim(),
    render: (cognoPath: string) => cognoPath,
    parentOf: () => null,
    basenameOf: (cognoPath: string) => cognoPath.split("/").at(-1) ?? cognoPath,
    depthOf: (cognoPath: string) => cognoPath.split("/").filter(Boolean).length,
};

type HistoryRepositoryDouble = {
    upsertWorkingDirectory: ReturnType<typeof vi.fn<HistoryRepository["upsertWorkingDirectory"]>>;
    upsertCommandPatternExecution: ReturnType<typeof vi.fn<HistoryRepository["upsertCommandPatternExecution"]>>;
    upsertCommandExecution: ReturnType<typeof vi.fn<HistoryRepository["upsertCommandExecution"]>>;
    upsertCommandTransition: ReturnType<typeof vi.fn<HistoryRepository["upsertCommandTransition"]>>;
    deleteCommandPatternExecution: ReturnType<typeof vi.fn<HistoryRepository["deleteCommandPatternExecution"]>>;
    deleteCommandExecution: ReturnType<typeof vi.fn<HistoryRepository["deleteCommandExecution"]>>;
    searchCommandPatterns: ReturnType<typeof vi.fn<HistoryRepository["searchCommandPatterns"]>>;
    markCommandPatternsShown: ReturnType<typeof vi.fn<HistoryRepository["markCommandPatternsShown"]>>;
    markCommandPatternSelected: ReturnType<typeof vi.fn<HistoryRepository["markCommandPatternSelected"]>>;
};

function createRepositoryDouble(): HistoryRepositoryDouble {
    return {
        upsertWorkingDirectory: vi.fn().mockResolvedValue(undefined),
        upsertCommandPatternExecution: vi.fn().mockResolvedValue(undefined),
        upsertCommandExecution: vi.fn().mockResolvedValue(undefined),
        upsertCommandTransition: vi.fn().mockResolvedValue(undefined),
        deleteCommandPatternExecution: vi.fn().mockResolvedValue(undefined),
        deleteCommandExecution: vi.fn().mockResolvedValue(undefined),
        searchCommandPatterns: vi.fn().mockResolvedValue([]),
        markCommandPatternsShown: vi.fn().mockResolvedValue(undefined),
        markCommandPatternSelected: vi.fn().mockResolvedValue(undefined),
    };
}

async function createService(repositoryDouble: HistoryRepositoryDouble): Promise<TerminalHistoryPersistenceService> {
    vi.spyOn(HistoryRepository, "createForContext").mockResolvedValue(
        repositoryDouble as unknown as HistoryRepository
    );

    const service = new TerminalHistoryPersistenceService();
    service.initialize(shellContext, pathAdapter);
    await flushActions();
    return service;
}

describe("TerminalHistoryPersistenceService", () => {
    it("deduplicates identical cwd updates", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        service.onCwdChanged("/tmp");
        service.onCwdChanged("/tmp");
        service.onCwdChanged(" /tmp ");
        await flushActions();

        expect(repositoryDouble.upsertWorkingDirectory).toHaveBeenCalledTimes(1);
        expect(repositoryDouble.upsertWorkingDirectory).toHaveBeenCalledWith("/tmp");
    });

    it("persists only successful commands by default (return code 0)", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        service.onCommandExecuted({ command: "npm test", directory: "/tmp", returnCode: 1 });
        service.onCommandExecuted({ command: "npm test", directory: "/tmp", returnCode: 0 });
        await flushActions();

        expect(repositoryDouble.upsertCommandPatternExecution).toHaveBeenCalledTimes(1);
        expect(repositoryDouble.upsertCommandPatternExecution).toHaveBeenCalledWith("npm test");
        expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledTimes(1);
        expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledWith("npm test", "/tmp");
        expect(repositoryDouble.upsertCommandTransition).not.toHaveBeenCalled();
    });

    it("never persists cd commands", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        service.setAllowedReturnCodesForCommand("cd", [0, 1, 2]);
        service.onCommandExecuted({ command: "cd ..", directory: "/tmp", returnCode: 0 });
        await flushActions();

        expect(repositoryDouble.upsertCommandExecution).not.toHaveBeenCalled();
    });

    it("supports per-command return code whitelist", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        service.setAllowedReturnCodesForCommand("grep", [0, 1]);
        service.onCommandExecuted({ command: "grep foo file.txt", directory: "/tmp", returnCode: 1 });
        service.onCommandExecuted({ command: "grep foo file.txt", directory: "/tmp", returnCode: 2 });
        await flushActions();

        expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledTimes(1);
        expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledWith("grep foo file.txt", "/tmp");
    });

    it("persists transitions for consecutive successful commands", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        service.onCommandExecuted({ command: "git pull", directory: "/tmp", returnCode: 0 });
        service.onCommandExecuted({ command: "docker compose build", directory: "/tmp", returnCode: 0 });
        await flushActions();

        expect(repositoryDouble.upsertCommandPatternExecution).toHaveBeenNthCalledWith(1, "git pull");
        expect(repositoryDouble.upsertCommandPatternExecution).toHaveBeenNthCalledWith(2, "docker compose build");
        expect(repositoryDouble.upsertCommandExecution).toHaveBeenNthCalledWith(1, "git pull", "/tmp");
        expect(repositoryDouble.upsertCommandExecution).toHaveBeenNthCalledWith(2, "docker compose build", "/tmp");
        expect(repositoryDouble.upsertCommandTransition).toHaveBeenCalledTimes(1);
        expect(repositoryDouble.upsertCommandTransition).toHaveBeenCalledWith(
            "git pull",
            "docker compose build"
        );
    });

    it("learns command patterns during command ingest", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        repositoryDouble.searchCommandPatterns.mockResolvedValue([
            {
                signature: {
                    key: "stable:git|stable:commit|stable:-am|slot:0",
                    parts: [
                        { kind: "stable", value: "git" },
                        { kind: "stable", value: "commit" },
                        { kind: "stable", value: "-am" },
                        { kind: "slot", slotIndex: 0 },
                    ],
                },
                totalCount: 2,
                stableTokenCount: 3,
                nonOptionStableTokenCount: 2,
                variableSlotCount: 1,
                lastSeenAt: 123,
                shownCount: 0,
                selectedCount: 0,
                lastShownAt: undefined,
                lastSelectedAt: undefined,
                slotStatistics: [
                    {
                        slotIndex: 0,
                        totalCount: 2,
                        distinctValueCount: 2,
                        topValue: "fix bug",
                        topValueCount: 1,
                    },
                ],
            },
        ]);

        service.onCommandExecuted({ command: 'git commit -am "fix bug"', directory: "/tmp", returnCode: 0 });
        service.onCommandExecuted({ command: 'git commit -am "update readme"', directory: "/tmp", returnCode: 0 });
        await flushActions();

        const learnedPatterns = await service.searchCommandPatterns("git commit", 10);

        expect(repositoryDouble.upsertCommandPatternExecution).toHaveBeenNthCalledWith(1, 'git commit -am "fix bug"');
        expect(repositoryDouble.upsertCommandPatternExecution).toHaveBeenNthCalledWith(2, 'git commit -am "update readme"');
        expect(learnedPatterns).toHaveLength(1);
        expect(learnedPatterns[0].slotStatistics[0]).toMatchObject({
            totalCount: 2,
            distinctValueCount: 2,
        });
    });

    it("tracks shown and selected pattern feedback through the repository", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        service.markCommandPatternsShown(["pattern-a", "pattern-b", "pattern-a"]);
        service.markCommandPatternSelected("pattern-a");
        await flushActions();

        expect(repositoryDouble.markCommandPatternsShown).toHaveBeenCalledWith(["pattern-a", "pattern-b", "pattern-a"]);
        expect(repositoryDouble.markCommandPatternSelected).toHaveBeenCalledWith("pattern-a");
    });

    it("reduces learned command patterns when command executions are deleted", async () => {
        const repositoryDouble = createRepositoryDouble();
        const service = await createService(repositoryDouble);

        service.deleteCommandExecution('git commit -am "fix bug"', "/tmp");
        await flushActions();

        expect(repositoryDouble.deleteCommandPatternExecution).toHaveBeenCalledWith('git commit -am "fix bug"');
        expect(repositoryDouble.deleteCommandExecution).toHaveBeenCalledWith('git commit -am "fix bug"', "/tmp");
    });
});
