import { Injectable } from "@angular/core";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { Fs } from "@cogno/platform/fs";
import { Logger } from "@cogno/platform/logger";
import { Shells } from "@cogno/platform/shells";
import { ShellSupportDefinitionContract } from "@cogno/shared/contributions";
import { ShellTypeContract } from "@cogno/shared/domain";

const INTEGRATION_VERSION = "1.2.0";

/**
 * Manages shell integration scripts in ~/.cogno/shell-integration
 * (or ~/.cogno-dev/shell-integration in development mode)
 */
@Injectable({ providedIn: "root" })
export class ShellIntegrationWriter {
  constructor(
    private readonly shells: Shells,
    private readonly environment: Environment,
    private readonly fs: Fs,
  ) {}

  /**
   * Ensures shell integration scripts are installed and up-to-date.
   * Only installs scripts for shells that are available and supported in the active feature set.
   */
  async ensure(
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
  ): Promise<void> {
    const integrationRoot = await this.getIntegrationRoot();

    const needsUpdate = await this.needsUpdate(integrationRoot);
    if (!needsUpdate) {
      return;
    }

    Logger.info("Installing/updating shell integration scripts...");

    try {
      const availableShells = await this.shells.load();
      const availableShellTypes = new Set(availableShells.map((shell) => shell.shell_type));
      const definitionsByShellType = this.createDefinitionsByShellType(shellSupportDefinitions);

      Logger.info(`Found shells: ${Array.from(availableShellTypes).join(", ")}`);

      await this.createBaseDirectories(integrationRoot);
      await this.writeIntegrationFiles(
        integrationRoot,
        availableShellTypes,
        definitionsByShellType,
      );
      await this.writeVersion(integrationRoot);
      await this.logUpdate(integrationRoot);

      Logger.info("Shell integration scripts installed successfully");
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "ShellIntegrationWriter",
        context: {
          operation: "ensure",
        },
      });
      throw error;
    }
  }

  async getIntegrationRoot(): Promise<string> {
    const cognoHome = this.environment.configDir();
    return `${cognoHome}/shell-integration`;
  }

  private createDefinitionsByShellType(
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
  ): Map<ShellTypeContract, ShellSupportDefinitionContract> {
    const definitionsByShellType = new Map<ShellTypeContract, ShellSupportDefinitionContract>();
    for (const definition of shellSupportDefinitions) {
      definitionsByShellType.set(definition.shellType, definition);
    }
    return definitionsByShellType;
  }

  private async needsUpdate(integrationRoot: string): Promise<boolean> {
    const versionFile = `${integrationRoot}/VERSION`;

    if (!(await this.fs.exists(versionFile))) {
      return true;
    }

    const currentVersion = await this.fs.readTextFile(versionFile);
    return currentVersion.trim() !== INTEGRATION_VERSION;
  }

  private async createBaseDirectories(integrationRoot: string): Promise<void> {
    const directories = [integrationRoot, `${integrationRoot}/logs`];

    for (const directory of directories) {
      if (!(await this.fs.exists(directory))) {
        await this.fs.mkdir(directory, { recursive: true });
      }
    }
  }

  private async writeIntegrationFiles(
    integrationRoot: string,
    availableShellTypes: ReadonlySet<ShellTypeContract>,
    definitionsByShellType: ReadonlyMap<ShellTypeContract, ShellSupportDefinitionContract>,
  ): Promise<void> {
    const writtenRelativePaths = new Set<string>();

    for (const shellType of availableShellTypes) {
      const shellDefinition = definitionsByShellType.get(shellType);
      if (!shellDefinition) {
        continue;
      }

      const integrationFiles = this.resolveIntegrationFiles(
        shellDefinition,
        definitionsByShellType,
      );
      for (const integrationFile of integrationFiles) {
        if (writtenRelativePaths.has(integrationFile.relativePath)) {
          continue;
        }
        writtenRelativePaths.add(integrationFile.relativePath);

        const filePath = `${integrationRoot}/${integrationFile.relativePath}`;
        const directoryPath = this.getDirectoryPath(filePath);
        if (!(await this.fs.exists(directoryPath))) {
          await this.fs.mkdir(directoryPath, { recursive: true });
        }

        await this.fs.writeTextFile(filePath, integrationFile.content);
      }
    }
  }

  private resolveIntegrationFiles(
    shellDefinition: ShellSupportDefinitionContract,
    definitionsByShellType: ReadonlyMap<ShellTypeContract, ShellSupportDefinitionContract>,
  ): ReadonlyArray<{ relativePath: string; content: string }> {
    const templateShellType = shellDefinition.integrationTemplateShellType;
    if (!templateShellType) {
      return shellDefinition.integrationFiles;
    }

    const templateDefinition = definitionsByShellType.get(templateShellType);
    if (!templateDefinition) {
      return shellDefinition.integrationFiles;
    }

    const filesByPath = new Map<string, { relativePath: string; content: string }>();

    for (const templateFile of templateDefinition.integrationFiles) {
      filesByPath.set(templateFile.relativePath, {
        relativePath: templateFile.relativePath,
        content: templateFile.content,
      });
    }

    for (const integrationFile of shellDefinition.integrationFiles) {
      filesByPath.set(integrationFile.relativePath, {
        relativePath: integrationFile.relativePath,
        content: integrationFile.content,
      });
    }

    return [...filesByPath.values()];
  }

  private getDirectoryPath(path: string): string {
    const separatorIndex = path.lastIndexOf("/");
    if (separatorIndex < 0) {
      return path;
    }
    return path.slice(0, separatorIndex);
  }

  private async writeVersion(integrationRoot: string): Promise<void> {
    await this.fs.writeTextFile(`${integrationRoot}/VERSION`, INTEGRATION_VERSION);
  }

  private async logUpdate(integrationRoot: string): Promise<void> {
    const logFile = `${integrationRoot}/logs/updates.log`;
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    const entry = `[${timestamp}] Updated shell integration to version ${INTEGRATION_VERSION}\n`;

    let existing = "";
    if (await this.fs.exists(logFile)) {
      existing = await this.fs.readTextFile(logFile);
    }

    await this.fs.writeTextFile(logFile, existing + entry);
  }
}
