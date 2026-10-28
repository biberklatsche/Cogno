/**
 * What git or ssh asks for, read from the prompt text they would print on a
 * terminal. The text decides how the dialog looks: a masked field for a
 * secret, a plain one for a name, yes/no for a question.
 */
export type GitPromptKind = "username" | "password" | "passphrase" | "confirm" | "other";

export type GitPrompt = {
  readonly kind: GitPromptKind;
  /** The prompt without its trailing colon and whitespace. */
  readonly message: string;
  /** The remote url git asks credentials for, quoted in its prompt. */
  readonly url?: string;
};

export function classifyGitPrompt(prompt: string): GitPrompt {
  const message = prompt.trim().replace(/:\s*$/, "");
  const url = /^(?:Username|Password) for '([^']+)'/i.exec(message)?.[1];
  if (/^Username for /i.test(message)) return { kind: "username", message, url };
  if (/^Password for /i.test(message)) return { kind: "password", message, url };
  if (/passphrase/i.test(message)) return { kind: "passphrase", message };
  if (/\(yes\/no(\/\[fingerprint\])?\)\??\s*$/i.test(message)) return { kind: "confirm", message };
  return { kind: "other", message };
}

/** Whether the answer is typed hidden. */
export function isSecretPrompt(kind: GitPromptKind): boolean {
  return kind === "password" || kind === "passphrase" || kind === "other";
}
