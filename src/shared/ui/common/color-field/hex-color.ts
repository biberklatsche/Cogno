/**
 * Hex colors as the config spells them: 3, 4, 6 or 8 digits, no `#`. Eight
 * digits carry alpha, which the native picker cannot hold; the field keeps it
 * across a pick.
 */
const HEX = /^[0-9a-fA-F]+$/;

/** The color without `#`, lower-case; null when it is not a hex color. */
export function normalizeHex(value: string): string | null {
  const digits = value.trim().replace(/^#/, "");
  if (![3, 4, 6, 8].includes(digits.length) || !HEX.test(digits)) return null;
  return digits.toLowerCase();
}

/** The six RGB digits, expanded from the short forms; alpha dropped. */
export function rgbDigits(hex: string): string {
  if (hex.length === 3 || hex.length === 4) {
    return hex
      .slice(0, 3)
      .split("")
      .map((digit) => digit + digit)
      .join("");
  }
  return hex.slice(0, 6);
}

/** The alpha digits, expanded from the short form; "" when opaque. */
export function alphaDigits(hex: string): string {
  if (hex.length === 4) return hex.slice(3).repeat(2);
  if (hex.length === 8) return hex.slice(6);
  return "";
}

/** What CSS can paint, `#rrggbb[aa]`; null when `value` is no hex color. */
export function toCssColor(value: string): string | null {
  const hex = normalizeHex(value);
  return hex ? `#${rgbDigits(hex)}${alphaDigits(hex)}` : null;
}

/** The picker's `#rrggbb` for a value; null when there is nothing to show. */
export function toPickerValue(value: string): string | null {
  const hex = normalizeHex(value);
  return hex ? `#${rgbDigits(hex)}` : null;
}

/** A picked `#rrggbb` written back the config's way, keeping the alpha the value had. */
export function fromPickerValue(picked: string, previous: string): string {
  const rgb = picked.replace(/^#/, "").toLowerCase();
  const previousHex = normalizeHex(previous);
  return rgb + (previousHex ? alphaDigits(previousHex) : "");
}
