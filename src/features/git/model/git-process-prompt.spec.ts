import { describe, expect, it } from "vitest";
import { classifyGitPrompt, isSecretPrompt } from "./git-process-prompt";

describe("classifyGitPrompt", () => {
  it.each([
    [
      "Enter passphrase for key '/home/l/.ssh/id_ed25519': ",
      "passphrase",
      "Enter passphrase for key '/home/l/.ssh/id_ed25519'",
    ],
    [
      "The authenticity of host 'github.com (140.82.121.4)' can't be established.\nED25519 key fingerprint is SHA256:abc.\nAre you sure you want to continue connecting (yes/no/[fingerprint])? ",
      "confirm",
      "The authenticity of host 'github.com (140.82.121.4)' can't be established.\nED25519 key fingerprint is SHA256:abc.\nAre you sure you want to continue connecting (yes/no/[fingerprint])?",
    ],
    ["git@host's password: ", "other", "git@host's password"],
    ["Enter PIN: ", "other", "Enter PIN"],
  ])("reads %j as %s", (prompt, kind, message) => {
    expect(classifyGitPrompt(prompt)).toEqual({ kind, message });
  });

  it("types everything hidden but the answer to a yes/no question", () => {
    expect(isSecretPrompt("passphrase")).toBe(true);
    expect(isSecretPrompt("other")).toBe(true);
    expect(isSecretPrompt("confirm")).toBe(false);
  });
});
