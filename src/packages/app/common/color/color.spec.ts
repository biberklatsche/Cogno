import { describe, expect, it } from "vitest";
import { Color } from "./color";

describe("Color", () => {
  it("should return no hex opacity if value is null or undefined", () => {
    expect(Color.getHexOpacity(null)).toEqual("");
    expect(Color.getHexOpacity(undefined)).toEqual("");
  });

  it("should return FF opacity if value is 100 or bigger", () => {
    expect(Color.getHexOpacity(100)).toEqual("FF");
    expect(Color.getHexOpacity(110)).toEqual("FF");
  });

  it("should return no opacity if value is 0 or smaller", () => {
    expect(Color.getHexOpacity(0)).toEqual("00");
    expect(Color.getHexOpacity(-1)).toEqual("00");
  });

  it("should return no opacity if value is <100 and >0 or smaller", () => {
    expect(Color.getHexOpacity(90)).toEqual("E6");
  });

  it("should return isLight false if color is black", () => {
    expect(Color.isLight("#000000")).toBeFalsy();
  });

  it("should return isLight true if color is white", () => {
    expect(Color.isLight("#ffffff")).toBeTruthy();
  });

  it("should return brightness between 0 and 1", () => {
    expect(Color.getBrightness("#000000")).toEqual(0);
    expect(Color.getBrightness("#ffffff")).toEqual(1);
  });

  it("should return isValid false if color is undefined", () => {
    expect(Color.isValid(undefined)).toBeFalsy();
  });

  it("should return isValid false if color is null", () => {
    expect(Color.isValid(null)).toBeFalsy();
  });

  it("should return isValid false if color is empty", () => {
    expect(Color.isValid("")).toBeFalsy();
  });

  it("should return isValid false if color does not start with #", () => {
    expect(Color.isValid("000000")).toBeFalsy();
  });

  it("should return isValid false if color is to short", () => {
    expect(Color.isValid("#00000")).toBeFalsy();
  });

  it("should return isValid true if color is valid", () => {
    expect(Color.isValid("#000000")).toBeTruthy();
  });

  it("should return a deterministic color name from text", () => {
    const firstColorName = Color.fromText("alpha");
    const secondColorName = Color.fromText("alpha");

    expect(secondColorName).toEqual(firstColorName);
    expect(["red", "green", "yellow", "blue", "magenta", "cyan", "grey"]).toContain(firstColorName);
  });

  it("should map text to multiple stable color buckets", () => {
    const discoveredColorNames = new Set<string>();

    for (let index = 0; index < 200; index++) {
      discoveredColorNames.add(Color.fromText(`value-${index}`));
    }

    expect(discoveredColorNames).toEqual(
      new Set(["red", "green", "yellow", "blue", "magenta", "cyan"]),
    );
  });

  it("should convert config colors to hex colors", () => {
    expect(Color.toHexColor(undefined)).toEqual("#000");
    expect(Color.toHexColor("ffffff")).toEqual("#ffffff");
  });
});
