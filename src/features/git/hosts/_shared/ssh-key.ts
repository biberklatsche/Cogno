import { GitAccessOption, GitAccessStep } from "./git-host";

/** Shows the public key for pasting it where the host keeps keys. */
export function pastePublicKeyStep(where: string): GitAccessStep {
  return {
    title: "Register the key",
    detail: `Paste the public key ${where}.`,
    commands: ["cat ~/.ssh/id_ed25519.pub"],
  };
}

/** Create a key, register it with the host, check. */
export function sshKeyOption(registration: GitAccessStep, host: string): GitAccessOption {
  return {
    title: "SSH key",
    detail: "Git uses the ssh of your shell. A key that works in the terminal works in Cogno.",
    steps: [
      {
        title: "Create a key",
        detail: "Skip this if you have one.",
        commands: ['ssh-keygen -t ed25519 -C "your@email"'],
      },
      registration,
      {
        title: "Check",
        detail: "Ssh greets you with your account name.",
        commands: [`ssh -T git@${host}`],
      },
    ],
  };
}
