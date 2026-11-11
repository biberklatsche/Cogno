import { describe, expect, it } from "vitest";
import { fromPickerValue, normalizeHex, toCssColor, toPickerValue } from "./hex-color";

describe("hex colors as the config spells them", () => {
  it("accepts 3, 4, 6 and 8 digits with or without #", () => {
    expect(normalizeHex("2F8FDA")).toBe("2f8fda");
    expect(normalizeHex("#abc")).toBe("abc");
    expect(normalizeHex("2f8fda55")).toBe("2f8fda55");
    expect(normalizeHex("2f8fd")).toBeNull();
    expect(normalizeHex("blue")).toBeNull();
  });

  it("paints every form as CSS", () => {
    expect(toCssColor("abc")).toBe("#aabbcc");
    expect(toCssColor("abcd")).toBe("#aabbccdd");
    expect(toCssColor("2f8fda55")).toBe("#2f8fda55");
    expect(toCssColor("nope")).toBeNull();
  });

  it("gives the picker the RGB part and keeps the alpha on the way back", () => {
    expect(toPickerValue("2f8fda55")).toBe("#2f8fda");
    expect(fromPickerValue("#FF0000", "2f8fda55")).toBe("ff000055");
    expect(fromPickerValue("#ff0000", "2f8fda")).toBe("ff0000");
    expect(fromPickerValue("#ff0000", "")).toBe("ff0000");
  });
});
