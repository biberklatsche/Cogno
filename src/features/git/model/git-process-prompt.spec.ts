import { describe, expect, it } from "vitest";
import { classifyGitPrompt } from "./git-process-prompt";

describe("classifyGitPrompt", () => {
  it("reads a host key question as one to answer with yes or no", () => {
    const prompt =
      "The authenticity of host 'github.com (140.82.121.4)' can't be established.\nED25519 key fingerprint is SHA256:abc.\nAre you sure you want to continue connecting (yes/no/[fingerprint])? ";

    expect(classifyGitPrompt(prompt)).toEqual({ message: prompt.trim(), confirm: true });
  });

  it.each([
    [
      "Enter passphrase for key '/home/l/.ssh/id_ed25519': ",
      "Enter passphrase for key '/home/l/.ssh/id_ed25519'",
    ],
    ["git@host's password: ", "git@host's password"],
    ["Enter PIN: ", "Enter PIN"],
  ])("reads %j as something to type hidden", (prompt, message) => {
    expect(classifyGitPrompt(prompt)).toEqual({ message, confirm: false });
  });
});
