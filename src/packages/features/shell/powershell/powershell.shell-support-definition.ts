import { ShellSupportDefinitionContract } from "@cogno/core-api";
import powerShellBootstrapScript from "./bootstrap.ps1.txt?raw";
import powerShellLineEditorScript from "./line-editor.ps1.txt?raw";

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
      relativePath: "pwsh/bootstrap.ps1",
      content: powerShellBootstrapScript,
    },
    {
      relativePath: "pwsh/line-editor.ps1",
      content: powerShellLineEditorScript,
    },
  ],
};



