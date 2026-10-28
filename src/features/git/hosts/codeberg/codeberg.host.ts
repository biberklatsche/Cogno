import { GitHostDefinition } from "../_shared/git-host";
import { pastePublicKeyStep } from "../_shared/ssh-key";

/** codeberg.org (Forgejo). No CLI serves git there; a token or an ssh key does. */
export const CODEBERG_HOST: GitHostDefinition = {
  id: "codeberg",
  label: "Codeberg",
  owns: (host) => host === "codeberg.org",
  manager: () => true,
  token: "Create an access token under Settings → Applications, with write access to repositories",
  sshKeyRegistration: () => pastePublicKeyStep("under Settings → SSH / GPG Keys"),
};
