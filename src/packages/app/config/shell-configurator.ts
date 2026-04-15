import { Injectable } from "@angular/core";
import { OS, OsType } from "@cogno/app-tauri/os";
import { Shell, Shells } from "@cogno/app-tauri/shells";
import { ShellSupportDefinitionContract } from "@cogno/core-api";
import { Config, ShellType } from "./+models/config";
import { ShellProfile } from "./+models/shell-config";

@Injectable({ providedIn: "root" })
export class ShellConfigurator {
  /**
   * Detects available shells and writes them into config.shell.profiles
   * and sets config.shell.default + (optional) config.shell.order.
   */
  async apply(
    config: Config,
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
  ): Promise<void> {
    const installedShells = await Shells.load();
    const platform = OS.platform();
    const definitionsByShellType = this.createDefinitionsByShellType(shellSupportDefinitions);
    const supportedInstalledShells = installedShells.filter((shell) =>
      definitionsByShellType.has(shell.shell_type),
    );
    const sortedShells = supportedInstalledShells.sort((leftShell, rightShell) => {
      const leftDefinition = definitionsByShellType.get(leftShell.shell_type);
      const rightDefinition = definitionsByShellType.get(rightShell.shell_type);
      const leftWeight = leftDefinition?.sortWeightByOs[platform] ?? 99;
      const rightWeight = rightDefinition?.sortWeightByOs[platform] ?? 99;
      return leftWeight - rightWeight;
    });

    // Ensure new structure exists
    if (!config.shell) {
      config.shell = {
        default: "",
        order: [],
        profiles: {},
      };
    } else {
      config.shell.profiles ??= {};
      config.shell.order ??= [];
      // Leave default as it is (see below)
    }

    // Optional: only populate initially if no profiles exist yet
    // (to avoid overwriting user configuration)
    if (Object.keys(config.shell.profiles).length > 0) {
      return;
    }

    const order: string[] = [];

    for (const sh of sortedShells) {
      const shellDefinition = definitionsByShellType.get(sh.shell_type);
      if (!shellDefinition) continue;
      const profileName = this.makeUniqueProfileName(
        config.shell.profiles,
        shellDefinition.profileName,
      );
      config.shell.profiles[profileName] = this.createShellConfig(sh, shellDefinition, platform);
      order.push(profileName);
    }

    // Set default: if empty or invalid → first profile
    const hasDefault = !!config.shell.default && !!config.shell.profiles[config.shell.default];
    if (!hasDefault) {
      config.shell.default = order[0] ?? "";
    }

    // set order (only if you need UI order)
    config.shell.order = order;
  }

  private makeUniqueProfileName(
    profiles: Record<string, ShellProfile>,
    profileNameBase: string,
  ): string {
    if (!profiles[profileNameBase]) return profileNameBase;

    // Kollisionsfrei: zsh2, zsh3, ...
    let i = 2;
    while (profiles[`${profileNameBase}${i}`]) i++;
    return `${profileNameBase}${i}`;
  }

  private createShellConfig(
    shell: Shell,
    shellSupportDefinition: ShellSupportDefinitionContract,
    platform: OsType,
  ): ShellProfile {
    const defaultArguments = shellSupportDefinition.defaultArgumentsByOs[platform] ?? [];
    const argumentsCopy = [...defaultArguments];

    const base: ShellProfile = {
      shell_type: shell.shell_type,
      path: shell.path,
      args: argumentsCopy,
      env: {},
      working_dir: "~",
      load_user_rc: true,
      enable_shell_integration: true,
      inject_cogno_cli: true,
    };

    // TERM is set globally in environment_builder.rs for all shells.

    return base;
  }

  private createDefinitionsByShellType(
    shellSupportDefinitions: ReadonlyArray<ShellSupportDefinitionContract>,
  ): Map<ShellType, ShellSupportDefinitionContract> {
    const definitionsByShellType = new Map<ShellType, ShellSupportDefinitionContract>();
    for (const definition of shellSupportDefinitions) {
      definitionsByShellType.set(definition.shellType, definition);
    }
    return definitionsByShellType;
  }
}
