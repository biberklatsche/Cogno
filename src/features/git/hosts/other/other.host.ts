import { GitHostDefinition } from "../_shared/git-host";
import { pastePublicKeyStep } from "../_shared/ssh-key";

/** A host nobody here knows: the credential manager asks for name and password, or a token. */
export const OTHER_HOST: GitHostDefinition = {
  id: "other",
  label: "Other",
  owns: () => false,
  manager: () => true,
  token: "Use the password or token the host expects",
  sshKeyRegistration: (host) => pastePublicKeyStep(`where ${host} keeps them`),
};
