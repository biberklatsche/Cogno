/**
 * What the ssh git starts asks for, read from the prompt text it would print
 * on a terminal. The text decides how the dialog looks: a masked field for a
 * secret, yes/no for a question. Credentials for https never come this way:
 * git asks its credential helper for them (ARCHITECTURE.md 2.1,
 * "Anmeldungen").
 */
export type GitPromptKind = "passphrase" | "confirm" | "other";

export type GitPrompt = {
  readonly kind: GitPromptKind;
  /** The prompt without its trailing colon and whitespace. */
  readonly message: string;
};

export function classifyGitPrompt(prompt: string): GitPrompt {
  const message = prompt.trim().replace(/:\s*$/, "");
  if (/passphrase/i.test(message)) return { kind: "passphrase", message };
  if (/\(yes\/no(\/\[fingerprint\])?\)\??\s*$/i.test(message)) return { kind: "confirm", message };
  return { kind: "other", message };
}

/** Whether the answer is typed hidden: everything but a yes/no question may be a secret. */
export function isSecretPrompt(kind: GitPromptKind): boolean {
  return kind !== "confirm";
}
