import { GitHostDefinition } from "../_shared/git-host";
import { pastePublicKeyStep } from "../_shared/ssh-key";

/** Azure DevOps, through the credential manager (Microsoft sign-in) or a PAT. */
export const AZURE_HOST: GitHostDefinition = {
  id: "azure",
  label: "Azure DevOps",
  owns: (host) =>
    host === "dev.azure.com" || host === "ssh.dev.azure.com" || host.endsWith(".visualstudio.com"),
  manager: () => true,
  token: "Create a personal access token with Code read and write",
  sshKeyRegistration: () => pastePublicKeyStep("in the user settings' SSH public keys"),
};
