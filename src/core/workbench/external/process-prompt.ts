/**
 * What a process asks for, read from the prompt text git and ssh would print
 * on a terminal. The text decides how the dialog looks: a masked field for a
 * secret, a plain one for a name, yes/no for a question.
 */
export type ProcessPromptKind = "username" | "password" | "passphrase" | "confirm" | "other";

export type ProcessPrompt = {
  readonly kind: ProcessPromptKind;
  /** The prompt without its trailing colon and whitespace. */
  readonly message: string;
};

export function classifyProcessPrompt(prompt: string): ProcessPrompt {
  const message = prompt.trim().replace(/:\s*$/, "");
  if (/^Username for /i.test(message)) return { kind: "username", message };
  if (/^Password for /i.test(message)) return { kind: "password", message };
  if (/passphrase/i.test(message)) return { kind: "passphrase", message };
  if (/\(yes\/no(\/\[fingerprint\])?\)\??\s*$/i.test(message)) return { kind: "confirm", message };
  return { kind: "other", message };
}

/** Whether the answer is typed hidden. */
export function isSecretPrompt(kind: ProcessPromptKind): boolean {
  return kind === "password" || kind === "passphrase" || kind === "other";
}
