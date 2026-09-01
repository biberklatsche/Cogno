export function tokenMatchQuality(queryToken: string, commandToken: string): number {
  if (!queryToken || !commandToken) return 0;
  if (commandToken.startsWith(queryToken)) return 1.0;
  if (commandToken.includes(queryToken)) return 0.7;
  return isSubsequence(queryToken, commandToken) ? 0.5 : 0;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let j = 0;
  for (let i = 0; i < haystack.length && j < needle.length; i++) {
    if (haystack[i] === needle[j]) j++;
  }
  return j === needle.length;
}
