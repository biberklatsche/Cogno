import { BackendOsContract, ShellTypeContract } from "./filesystem.contract";

export interface ShellIntegrationFileContract {
  readonly relativePath: string;
  readonly content: string;
}

export interface ShellSupportDefinitionContract {
  readonly shellType: ShellTypeContract;
  readonly profileName: string;
  readonly defaultArgumentsByOs: Readonly<
    Partial<Record<BackendOsContract, ReadonlyArray<string>>>
  >;
  readonly sortWeightByOs: Readonly<Record<BackendOsContract, number>>;
  readonly integrationFiles: ReadonlyArray<ShellIntegrationFileContract>;
  readonly integrationTemplateShellType?: ShellTypeContract;
}
