import { describe, expect, it } from "vitest";
import { classifyProcessPrompt } from "./process-prompt";

describe("classifyProcessPrompt", () => {
  it.each([
    ["Username for 'https://github.com': ", "username", "Username for 'https://github.com'"],
    [
      "Password for 'https://lars@github.com': ",
      "password",
      "Password for 'https://lars@github.com'",
    ],
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
    ["Enter PIN: ", "other", "Enter PIN"],
  ])("reads %j as %s", (prompt, kind, message) => {
    expect(classifyProcessPrompt(prompt)).toEqual({ kind, message });
  });
});
