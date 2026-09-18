import { CommandLogRepository } from "@cogno/core/command-log/command-log.repository";
import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { DatabaseAccess } from "@cogno/platform";
import type { IPathAdapter, ResolvedShellContextContract } from "@cogno/shared/domain";
import { describe, expect, it, vi } from "vitest";

import { SessionCommandLog } from "../command-log/session-command-log";
import { CommandRecorder } from "./command-recorder";

function flushActions(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const shellContext: ResolvedShellContextContract = {
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

// The repository is replaced wholesale, so the access object is never used.
const databaseAccess = {} as DatabaseAccess;

type CommandLogRepositoryDouble = {
  upsertWorkingDirectory: ReturnType<typeof vi.fn<CommandLogRepository["upsertWorkingDirectory"]>>;
  upsertCommandExecution: ReturnType<typeof vi.fn<CommandLogRepository["upsertCommandExecution"]>>;
  upsertCommandTransition: ReturnType<
    typeof vi.fn<CommandLogRepository["upsertCommandTransition"]>
  >;
  deleteCommandExecution: ReturnType<typeof vi.fn<CommandLogRepository["deleteCommandExecution"]>>;
  searchCommandPatterns: ReturnType<typeof vi.fn<CommandLogRepository["searchCommandPatterns"]>>;
  confirmLivePattern: ReturnType<typeof vi.fn<CommandLogRepository["confirmLivePattern"]>>;
  markCommandPatternSelected: ReturnType<
    typeof vi.fn<CommandLogRepository["markCommandPatternSelected"]>
  >;
};

function createRepositoryDouble(): CommandLogRepositoryDouble {
  return {
    upsertWorkingDirectory: vi.fn().mockResolvedValue(undefined),
    upsertCommandExecution: vi.fn().mockResolvedValue(undefined),
    upsertCommandTransition: vi.fn().mockResolvedValue(undefined),
    deleteCommandExecution: vi.fn().mockResolvedValue(undefined),
    searchCommandPatterns: vi.fn().mockResolvedValue([]),
    confirmLivePattern: vi.fn().mockResolvedValue(undefined),
    markCommandPatternSelected: vi.fn().mockResolvedValue(undefined),
  };
}

type Subject = { recorder: CommandRecorder; commandLog: SessionCommandLog };

async function createService(
  repositoryDouble: CommandLogRepositoryDouble,
  configService?: ConfigService,
): Promise<Subject> {
  vi.spyOn(CommandLogRepository, "createForContext").mockResolvedValue(
    repositoryDouble as unknown as CommandLogRepository,
  );

  const commandLog = new SessionCommandLog(databaseAccess);
  const recorder = new CommandRecorder(commandLog, undefined, undefined, configService);
  recorder.initialize(shellContext, pathAdapter);
  await flushActions();
  return { recorder, commandLog };
}

type HistorySettings = {
  max_entries?: number;
  ignore_commands_with_leading_space?: boolean;
  allowed_return_codes?: number[];
  allowed_return_codes_by_command?: Record<string, number[]>;
};

function createConfigServiceDouble(history: HistorySettings): ConfigService {
  return {
    config: { terminal: { history } },
  } as unknown as ConfigService;
}

describe("CommandRecorder", () => {
  it("deduplicates identical cwd updates", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    service.onCwdChanged("/tmp");
    service.onCwdChanged("/tmp");
    service.onCwdChanged(" /tmp ");
    await flushActions();

    expect(repositoryDouble.upsertWorkingDirectory).toHaveBeenCalledTimes(1);
    expect(repositoryDouble.upsertWorkingDirectory).toHaveBeenCalledWith("/tmp");
  });

  it("persists existing commands even when they exit non-zero", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    service.onCommandExecuted({
      command: "npm test",
      directory: "/tmp",
      returnCode: 1,
      commandExists: true,
    });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledTimes(1);
    expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledWith(
      "npm test",
      "/tmp",
      undefined,
      undefined,
      expect.any(Object),
    );
    expect(repositoryDouble.upsertCommandTransition).not.toHaveBeenCalled();
  });

  it("does not persist commands that the shell reports as missing", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    service.onCommandExecuted({
      command: "sdlfjhksdjf",
      directory: "/tmp",
      returnCode: 127,
      commandExists: false,
    });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).not.toHaveBeenCalled();
  });

  it("never persists cd commands", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    service.onCommandExecuted({ command: "cd ..", directory: "/tmp", returnCode: 0 });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).not.toHaveBeenCalled();
  });

  describe("allowed return codes", () => {
    const run = (
      service: CommandRecorder,
      command: string,
      returnCode: number | undefined,
      commandExists = true,
    ) => service.onCommandExecuted({ command, directory: "/tmp", returnCode, commandExists });
    const persisted = (repositoryDouble: CommandLogRepositoryDouble) =>
      repositoryDouble.upsertCommandExecution.mock.calls.map((call) => call[0]);

    it("keeps every return code while the list is empty (the default)", async () => {
      const repositoryDouble = createRepositoryDouble();
      const config = createConfigServiceDouble({ allowed_return_codes: [] });
      const { recorder } = await createService(repositoryDouble, config);

      run(recorder, "ls /nope", 1);
      run(recorder, "make", 2);
      await flushActions();

      expect(persisted(repositoryDouble)).toEqual(["ls /nope", "make"]);
    });

    it("keeps only the listed return codes once the list is set", async () => {
      const repositoryDouble = createRepositoryDouble();
      const config = createConfigServiceDouble({ allowed_return_codes: [0] });
      const { recorder } = await createService(repositoryDouble, config);

      run(recorder, "ls", 0);
      run(recorder, "ls /nope", 1);
      await flushActions();

      expect(persisted(repositoryDouble)).toEqual(["ls"]);
    });

    it("lets a command's own list win over the global one", async () => {
      const repositoryDouble = createRepositoryDouble();
      const config = createConfigServiceDouble({
        allowed_return_codes: [0],
        allowed_return_codes_by_command: { grep: [0, 1] },
      });
      const { recorder } = await createService(repositoryDouble, config);

      run(recorder, "grep foo file.txt", 1);
      run(recorder, "grep foo file.txt", 2);
      run(recorder, "ls /nope", 1);
      await flushActions();

      expect(persisted(repositoryDouble)).toEqual(["grep foo file.txt"]);
    });

    it("matches the command's list by its first word, ignoring case", async () => {
      const repositoryDouble = createRepositoryDouble();
      const config = createConfigServiceDouble({
        allowed_return_codes: [0],
        allowed_return_codes_by_command: { grep: [1] },
      });
      const { recorder } = await createService(repositoryDouble, config);

      run(recorder, "GREP -r foo .", 1);
      run(recorder, "sudo grep foo", 1);
      await flushActions();

      expect(persisted(repositoryDouble)).toEqual(["GREP -r foo ."]);
    });

    it("never keeps a command the shell reports as missing, whatever the list says", async () => {
      const repositoryDouble = createRepositoryDouble();
      const config = createConfigServiceDouble({ allowed_return_codes: [0, 127] });
      const { recorder } = await createService(repositoryDouble, config);

      run(recorder, "gti status", 127, false);
      await flushActions();

      expect(persisted(repositoryDouble)).toEqual([]);
    });

    it("drops a command without a return code while a list is set, keeps it while the list is empty", async () => {
      const repositoryDouble = createRepositoryDouble();
      const config = createConfigServiceDouble({ allowed_return_codes: [0] });
      const { recorder } = await createService(repositoryDouble, config);
      run(recorder, "ls", undefined);
      await flushActions();
      expect(persisted(repositoryDouble)).toEqual([]);

      const permissive = createRepositoryDouble();
      const { recorder: lenient } = await createService(permissive, createConfigServiceDouble({}));
      run(lenient, "ls", undefined);
      await flushActions();
      expect(persisted(permissive)).toEqual(["ls"]);
    });

    it("follows the config as it is at the time of the command", async () => {
      const repositoryDouble = createRepositoryDouble();
      const settings: HistorySettings = { allowed_return_codes: [] };
      const config = { config: { terminal: { history: settings } } } as unknown as ConfigService;
      const { recorder } = await createService(repositoryDouble, config);

      run(recorder, "make", 2);
      settings.allowed_return_codes = [0];
      run(recorder, "make", 2);
      await flushActions();

      expect(persisted(repositoryDouble)).toEqual(["make"]);
    });
  });

  it("persists transitions for consecutive successful commands", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    service.onCommandExecuted({ command: "git pull", directory: "/tmp", returnCode: 0 });
    service.onCommandExecuted({
      command: "docker compose build",
      directory: "/tmp",
      returnCode: 0,
    });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).toHaveBeenNthCalledWith(
      1,
      "git pull",
      "/tmp",
      undefined,
      undefined,
      expect.any(Object),
    );
    expect(repositoryDouble.upsertCommandExecution).toHaveBeenNthCalledWith(
      2,
      "docker compose build",
      "/tmp",
      undefined,
      undefined,
      expect.any(Object),
    );
    expect(repositoryDouble.upsertCommandTransition).toHaveBeenCalledTimes(1);
    expect(repositoryDouble.upsertCommandTransition).toHaveBeenCalledWith(
      "git pull",
      "docker compose build",
    );
  });

  it("does not write pattern rows during command ingest — patterns are only created on confirmation", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    service.onCommandExecuted({
      command: 'git commit -am "fix bug"',
      directory: "/tmp",
      returnCode: 0,
    });
    service.onCommandExecuted({
      command: 'git commit -am "update readme"',
      directory: "/tmp",
      returnCode: 0,
    });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledTimes(2);
    expect(repositoryDouble.confirmLivePattern).not.toHaveBeenCalled();
  });

  it("tracks selected pattern feedback through the repository", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { commandLog } = await createService(repositoryDouble);

    commandLog.markCommandPatternSelected("pattern-a");
    await flushActions();

    expect(repositoryDouble.markCommandPatternSelected).toHaveBeenCalledWith("pattern-a");
  });

  it("deletes command executions from history without touching pattern rows", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { commandLog } = await createService(repositoryDouble);

    commandLog.deleteCommandExecution('git commit -am "fix bug"', "/tmp");
    await flushActions();

    expect(repositoryDouble.deleteCommandExecution).toHaveBeenCalledWith(
      'git commit -am "fix bug"',
      "/tmp",
    );
  });

  it("passes the configured max_entries through to the repository", async () => {
    const repositoryDouble = createRepositoryDouble();
    const configService = createConfigServiceDouble({ max_entries: 500 });
    const { recorder: service } = await createService(repositoryDouble, configService);

    service.onCommandExecuted({ command: "npm test", directory: "/tmp", returnCode: 0 });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledWith(
      "npm test",
      "/tmp",
      undefined,
      500,
      expect.any(Object),
    );
  });

  it("does not persist a command with a leading space when ignore_commands_with_leading_space is enabled", async () => {
    const repositoryDouble = createRepositoryDouble();
    const configService = createConfigServiceDouble({ ignore_commands_with_leading_space: true });
    const { recorder: service } = await createService(repositoryDouble, configService);

    service.onCommandExecuted({ command: " secret-token-cmd", directory: "/tmp", returnCode: 0 });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).not.toHaveBeenCalled();
  });

  it("still persists a leading-space command when the setting is disabled", async () => {
    const repositoryDouble = createRepositoryDouble();
    const configService = createConfigServiceDouble({
      ignore_commands_with_leading_space: false,
    });
    const { recorder: service } = await createService(repositoryDouble, configService);

    service.onCommandExecuted({ command: " npm test", directory: "/tmp", returnCode: 0 });
    await flushActions();

    expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledWith(
      "npm test",
      "/tmp",
      undefined,
      undefined,
      expect.any(Object),
    );
  });

  it("stays silent and keeps the session going when there is no database", async () => {
    const repositoryDouble = createRepositoryDouble();
    const createForContext = vi
      .spyOn(CommandLogRepository, "createForContext")
      .mockResolvedValue(repositoryDouble as unknown as CommandLogRepository);

    const commandLog = new SessionCommandLog(undefined);
    const recorder = new CommandRecorder(commandLog);
    recorder.initialize(shellContext, pathAdapter);
    await flushActions();

    recorder.onCwdChanged("/tmp");
    recorder.onCommandExecuted({ command: "ls", directory: "/tmp", returnCode: 0 });
    await flushActions();

    expect(createForContext).not.toHaveBeenCalled();
    expect(repositoryDouble.upsertWorkingDirectory).not.toHaveBeenCalled();
    expect(repositoryDouble.upsertCommandExecution).not.toHaveBeenCalled();
    await expect(commandLog.getRecentCommands({ scope: "global" })).resolves.toEqual([]);
  });

  it("records an aborted command despite it having no return code (step 27b-2)", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    await service.recordAbortedCommand({
      command: "sleep 100",
      directory: "/tmp",
      duration: 4200,
      returnCode: undefined,
    });

    expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledTimes(1);
    expect(repositoryDouble.upsertCommandExecution).toHaveBeenCalledWith(
      "sleep 100",
      "/tmp",
      undefined,
      undefined,
      { durationMs: 4200, returnCode: undefined },
    );
  });

  it("still applies the text filters when recording an aborted command", async () => {
    const repositoryDouble = createRepositoryDouble();
    const { recorder: service } = await createService(repositoryDouble);

    await service.recordAbortedCommand({ command: "cd /tmp", directory: "/tmp" });
    await service.recordAbortedCommand({ command: "   ", directory: "/tmp" });

    expect(repositoryDouble.upsertCommandExecution).not.toHaveBeenCalled();
  });
});
