import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ShellSupportDefinitionContract } from "@cogno/core/session/shells/shell-support";
import { Hosts } from "@cogno/platform/hosts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShellIntegrationWriter } from "./shell-integration.writer";

const definitions = [
  {
    shellType: "Bash",
    integrationFiles: [
      { relativePath: "common/base.sh", content: "base" },
      { relativePath: "bash/bootstrap.bash", content: "bash" },
    ],
  },
  {
    shellType: "ZSH",
    integrationFiles: [
      { relativePath: "common/base.sh", content: "base" },
      { relativePath: "zsh/.zshrc", content: "zsh" },
    ],
  },
] as unknown as ReadonlyArray<ShellSupportDefinitionContract>;

describe("ShellIntegrationWriter", () => {
  let installShellIntegration: ReturnType<typeof vi.fn>;
  let writer: ShellIntegrationWriter;

  beforeEach(() => {
    vi.restoreAllMocks();
    installShellIntegration = vi.fn().mockResolvedValue(undefined);
    writer = new ShellIntegrationWriter(
      { installShellIntegration } as unknown as Hosts,
      { isDevMode: () => true } as never,
    );
  });

  it("hands this machine the scripts of every supported shell, a shared one once", async () => {
    await writer.ensure(definitions);

    expect(installShellIntegration).toHaveBeenCalledWith(
      undefined,
      "1.3.0",
      [
        { relativePath: "common/base.sh", content: "base" },
        { relativePath: "bash/bootstrap.bash", content: "bash" },
        { relativePath: "zsh/.zshrc", content: "zsh" },
      ],
      true,
    );
  });

  it("hands a connected host the same scripts", async () => {
    await writer.ensure(definitions, "mac");

    expect(installShellIntegration).toHaveBeenCalledWith("mac", "1.3.0", expect.any(Array), true);
  });

  it("reports and rethrows when the scripts could not be laid down", async () => {
    const error = new Error("Permission denied");
    installShellIntegration.mockRejectedValue(error);
    const reported = vi.spyOn(ErrorReporter, "reportException").mockImplementation(() => undefined);

    await expect(writer.ensure(definitions, "mac")).rejects.toBe(error);

    expect(reported).toHaveBeenCalledWith(
      expect.objectContaining({ error, handled: true, source: "ShellIntegrationWriter" }),
    );
  });
});
