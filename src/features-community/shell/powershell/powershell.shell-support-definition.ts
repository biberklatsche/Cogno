import { ShellSupportDefinitionContract } from "@cogno/core-sdk";
import powerShellIntegrationScript from "./integration.ps1.txt?raw";

export const powerShellShellSupportDefinition: ShellSupportDefinitionContract = {
  shellType: "PowerShell",
  profileName: "powershell",
  defaultArgumentsByOs: {
    windows: ["-NoLogo"],
    linux: ["-NoLogo"],
    macos: ["-NoLogo"],
  },
  sortWeightByOs: {
    windows: 1,
    linux: 4,
    macos: 4,
  },
  integrationFiles: [
    {
      relativePath: "pwsh/integration.ps1",
      content: powerShellIntegrationScript,
    },
  ],
};
