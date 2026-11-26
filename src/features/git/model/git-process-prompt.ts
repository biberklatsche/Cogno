/**
 * What the ssh git starts asks for, read from the prompt text it would print
 * on a terminal: a question to answer with yes or no (a host key), or
 * something to type hidden (a passphrase, a password, a PIN). Credentials for
 * https never come this way: git asks its credential helper for them
 * (ARCHITECTURE.md 2.1, "Anmeldungen").
 */
export type GitPrompt = {
  /** The prompt without its trailing colon and whitespace. */
  readonly message: string;
  /** A yes/no question; everything else is typed hidden. */
  readonly confirm: boolean;
};

export function classifyGitPrompt(prompt: string): GitPrompt {
  const message = prompt.trim().replace(/:\s*$/, "");
  return { message, confirm: /\(yes\/no(\/\[fingerprint\])?\)\??\s*$/i.test(message) };
}
