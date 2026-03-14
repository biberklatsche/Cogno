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
    upsertCommandExecution: ReturnType<typeof vi.fn<HistoryRepository["upsertCommandExecution"]>>;
    upsertCommandTransition: ReturnType<typeof vi.fn<HistoryRepository["upsertCommandTransition"]>>;
};

function createRepositoryDouble(): HistoryRepositoryDouble {
    return {
        upsertWorkingDirectory: vi.fn().mockResolvedValue(undefined),
        upsertCommandExecution: vi.fn().mockResolvedValue(undefined),
        upsertCommandTransition: vi.fn().mockResolvedValue(undefined),
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

        expect(repositoryDouble.upsertCommandExecution).toHaveBeenNthCalledWith(1, "git pull", "/tmp");
        expect(repositoryDouble.upsertCommandExecution).toHaveBeenNthCalledWith(2, "docker compose build", "/tmp");
        expect(repositoryDouble.upsertCommandTransition).toHaveBeenCalledTimes(1);
        expect(repositoryDouble.upsertCommandTransition).toHaveBeenCalledWith(
            "git pull",
            "docker compose build"
        );
    });
});
