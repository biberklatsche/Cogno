import { Injectable } from "@angular/core";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import {
  ShellIntegrationFileContract,
  ShellSupportDefinitionContract,
} from "@cogno/core/session/shells/shell-support";
import { Hosts } from "@cogno/platform/hosts";

const INTEGRATION_VERSION = "1.3.0";

/**
 * Puts the shell integration scripts where a shell started with integration
 * sources them: `shell-integration` in the Cogno home of the machine the
 * shell runs on. The scripts are this Cogno's; the machine - this one or a
 * connected host - only lays them down, and leaves them alone when they are
 * there in this version already.
 */
@Injectable({ providedIn: "root" })
export class ShellIntegrationWriter {
  constructor(
    private readonly hosts: Hosts,
    private readonly environment: Environment,
  ) {}

  /**
   * Makes sure the scripts of every supported shell are installed and current
   * on `host`, this machine when none is named. Which shells exist there does
   * not matter: a script for a shell that is not installed is a small file.
   */
  async ensure(
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
    host?: string,
  ): Promise<void> {
    try {
      await this.hosts.installShellIntegration(
        host,
        INTEGRATION_VERSION,
        this.filesOf(shellSupportDefinitions),
        this.environment.isDevMode(),
      );
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "ShellIntegrationWriter",
        context: { operation: "ensure", host },
      });
      throw error;
    }
  }

  /** Every script once: two shells may share a file. */
  private filesOf(
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
  ): ShellIntegrationFileContract[] {
    const filesByPath = new Map<string, ShellIntegrationFileContract>();
    for (const definition of shellSupportDefinitions) {
      for (const file of definition.integrationFiles) {
        if (!filesByPath.has(file.relativePath)) {
          filesByPath.set(file.relativePath, {
            relativePath: file.relativePath,
            content: file.content,
          });
        }
      }
    }
    return [...filesByPath.values()];
  }
}
