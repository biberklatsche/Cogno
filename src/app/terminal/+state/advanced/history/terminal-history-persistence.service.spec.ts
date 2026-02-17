import { describe, expect, it, vi } from "vitest";

import { TerminalHistoryPersistenceService } from "./terminal-history-persistence.service";

function flushActions(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

describe("TerminalHistoryPersistenceService", () => {
    it("deduplicates identical cwd updates", async () => {
        const service = new TerminalHistoryPersistenceService();
        const repo = {
            upsertWorkingDirectory: vi.fn().mockResolvedValue(undefined),
        };
        (service as any)._repo$.next(repo);

        service.onCwdChanged("/tmp");
        service.onCwdChanged("/tmp");
        service.onCwdChanged(" /tmp ");
        await flushActions();

        expect(repo.upsertWorkingDirectory).toHaveBeenCalledTimes(1);
        expect(repo.upsertWorkingDirectory).toHaveBeenCalledWith("/tmp");
    });

    it("persists only successful commands by default (return code 0)", async () => {
        const service = new TerminalHistoryPersistenceService();
        const repo = {
            upsertCommandExecution: vi.fn().mockResolvedValue(undefined),
        };
        (service as any)._repo$.next(repo);

        service.onCommandExecuted("npm test", "/tmp", 1);
        service.onCommandExecuted("npm test", "/tmp", 0);
        await flushActions();

        expect(repo.upsertCommandExecution).toHaveBeenCalledTimes(1);
        expect(repo.upsertCommandExecution).toHaveBeenCalledWith("npm test", "/tmp");
    });

    it("never persists cd commands", async () => {
        const service = new TerminalHistoryPersistenceService();
        const repo = {
            upsertCommandExecution: vi.fn().mockResolvedValue(undefined),
        };
        (service as any)._repo$.next(repo);

        service.setAllowedReturnCodesForCommand("cd", [0, 1, 2]);
        service.onCommandExecuted("cd ..", "/tmp", 0);
        await flushActions();

        expect(repo.upsertCommandExecution).not.toHaveBeenCalled();
    });

    it("supports per-command return code whitelist", async () => {
        const service = new TerminalHistoryPersistenceService();
        const repo = {
            upsertCommandExecution: vi.fn().mockResolvedValue(undefined),
        };
        (service as any)._repo$.next(repo);

        service.setAllowedReturnCodesForCommand("grep", [0, 1]);
        service.onCommandExecuted("grep foo file.txt", "/tmp", 1);
        service.onCommandExecuted("grep foo file.txt", "/tmp", 2);
        await flushActions();

        expect(repo.upsertCommandExecution).toHaveBeenCalledTimes(1);
        expect(repo.upsertCommandExecution).toHaveBeenCalledWith("grep foo file.txt", "/tmp");
    });
});
