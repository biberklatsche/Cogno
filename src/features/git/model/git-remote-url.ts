/** What a remote url says about where it goes: the host, the transport, the credential key. */

/** The host a remote url names: `https://`, `ssh://`, or scp-like `git@host:path`. */
export function hostOf(url: string): string | null {
  const trimmed = url.trim();
  // A scheme without a host (`file:///path`) names no host at all.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)/i.exec(trimmed);
    return withScheme?.[1]?.toLowerCase() ?? null;
  }
  // Two characters at least: `C:\path` is a drive, not a host.
  const scpLike = /^(?:[^@/]+@)?([^:/\\]{2,}):/.exec(trimmed);
  return scpLike?.[1]?.toLowerCase() ?? null;
}

/** Whether a remote url goes over ssh; everything else asks for credentials. */
export function isSshUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(ssh|git):\/\//i.test(trimmed)) return true;
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && /^(?:[^@/]+@)?[^:/\\]{2,}:/.test(trimmed);
}

/**
 * The https url git keys credentials for this remote by: the remote's own
 * origin with its port, or the host alone for an ssh remote - the provider
 * CLIs store credentials under the https host of the same server.
 */
export function credentialUrlOf(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  const origin = /^https?:\/\/(?:[^@/]+@)?([^/]+)/i.exec(url.trim());
  return `https://${origin ? origin[1]?.toLowerCase() : host}`;
}
