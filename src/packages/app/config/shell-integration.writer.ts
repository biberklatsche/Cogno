import { Fs } from "@cogno/app-tauri/fs";
import { Logger } from "@cogno/app-tauri/logger";
import { Shells } from "@cogno/app-tauri/shells";
import { ShellSupportDefinitionContract, ShellTypeContract } from "@cogno/core-api";
import { Environment } from "../common/environment/environment";
import { ErrorReporter } from "../common/error/error-reporter";

const INTEGRATION_VERSION = "1.1.5";

/**
 * Manages shell integration scripts in ~/.cogno/shell-integration
 * (or ~/.cogno-dev/shell-integration in development mode)
 */
export class ShellIntegrationWriter {
  /**
   * Ensures shell integration scripts are installed and up-to-date.
   * Only installs scripts for shells that are available and supported in the active feature set.
   */
  static async ensure(
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
  ): Promise<void> {
    const integrationRoot = await ShellIntegrationWriter.getIntegrationRoot();

    const needsUpdate = await ShellIntegrationWriter.needsUpdate(integrationRoot);
    if (!needsUpdate) {
      return;
    }

    Logger.info("Installing/updating shell integration scripts...");

    try {
      const availableShells = await Shells.load();
      const availableShellTypes = new Set(availableShells.map((shell) => shell.shell_type));
      const definitionsByShellType =
        ShellIntegrationWriter.createDefinitionsByShellType(shellSupportDefinitions);

      Logger.info(`Found shells: ${Array.from(availableShellTypes).join(", ")}`);

      await ShellIntegrationWriter.createBaseDirectories(integrationRoot);
      await ShellIntegrationWriter.writeIntegrationFiles(
        integrationRoot,
        availableShellTypes,
        definitionsByShellType,
      );
      await ShellIntegrationWriter.writeVersion(integrationRoot);
      await ShellIntegrationWriter.logUpdate(integrationRoot);

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

  static async getIntegrationRoot(): Promise<string> {
    const cognoHome = Environment.configDir();
    return `${cognoHome}/shell-integration`;
  }

  private static createDefinitionsByShellType(
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
  ): Map<ShellTypeContract, ShellSupportDefinitionContract> {
    const definitionsByShellType = new Map<ShellTypeContract, ShellSupportDefinitionContract>();
    for (const definition of shellSupportDefinitions) {
      definitionsByShellType.set(definition.shellType, definition);
    }
    return definitionsByShellType;
  }

  private static async needsUpdate(integrationRoot: string): Promise<boolean> {
    const versionFile = `${integrationRoot}/VERSION`;

    if (!(await Fs.exists(versionFile))) {
      return true;
    }

    const currentVersion = await Fs.readTextFile(versionFile);
    return currentVersion.trim() !== INTEGRATION_VERSION;
  }

  private static async createBaseDirectories(integrationRoot: string): Promise<void> {
    const directories = [integrationRoot, `${integrationRoot}/logs`];

    for (const directory of directories) {
      if (!(await Fs.exists(directory))) {
        await Fs.mkdir(directory, { recursive: true });
      }
    }
  }

  private static async writeIntegrationFiles(
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

      const integrationFiles = ShellIntegrationWriter.resolveIntegrationFiles(
        shellDefinition,
        definitionsByShellType,
      );
      for (const integrationFile of integrationFiles) {
        if (writtenRelativePaths.has(integrationFile.relativePath)) {
          continue;
        }
        writtenRelativePaths.add(integrationFile.relativePath);

        const filePath = `${integrationRoot}/${integrationFile.relativePath}`;
        const directoryPath = ShellIntegrationWriter.getDirectoryPath(filePath);
        if (!(await Fs.exists(directoryPath))) {
          await Fs.mkdir(directoryPath, { recursive: true });
        }

        await Fs.writeTextFile(filePath, integrationFile.content);
      }
    }
  }

  private static resolveIntegrationFiles(
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

  private static getDirectoryPath(path: string): string {
    const separatorIndex = path.lastIndexOf("/");
    if (separatorIndex < 0) {
      return path;
    }
    return path.slice(0, separatorIndex);
  }

  private static async writeVersion(integrationRoot: string): Promise<void> {
    await Fs.writeTextFile(`${integrationRoot}/VERSION`, INTEGRATION_VERSION);
  }

  private static async logUpdate(integrationRoot: string): Promise<void> {
    const logFile = `${integrationRoot}/logs/updates.log`;
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    const entry = `[${timestamp}] Updated shell integration to version ${INTEGRATION_VERSION}\n`;

    let existing = "";
    if (await Fs.exists(logFile)) {
      existing = await Fs.readTextFile(logFile);
    }

    await Fs.writeTextFile(logFile, existing + entry);
  }
}
