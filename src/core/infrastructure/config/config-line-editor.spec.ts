import { describe, expect, it } from "vitest";
import { ConfigLineEditor } from "./config-line-editor";

describe("ConfigLineEditor", () => {
  it("replaces a key in place and leaves everything else untouched", () => {
    const text = [
      "# my settings",
      "shell.default = zsh",
      "",
      "notification.channel.os.enabled = false  ",
      "notification.channel.app.enabled = true",
      "",
    ].join("\n");

    const result = ConfigLineEditor.set(text, { "notification.channel.os.enabled": "true" });

    expect(result).toBe(
      [
        "# my settings",
        "shell.default = zsh",
        "",
        "notification.channel.os.enabled = true",
        "notification.channel.app.enabled = true",
        "",
      ].join("\n"),
    );
  });

  it("puts a new key next to its closest relatives", () => {
    const text = [
      "shell.default = zsh",
      "notification.channel.app.enabled = true",
      "cursor.blink = false",
      "",
    ].join("\n");

    const result = ConfigLineEditor.set(text, { "notification.channel.os.enabled": "true" });

    expect(result.split("\n")).toEqual([
      "shell.default = zsh",
      "notification.channel.app.enabled = true",
      "notification.channel.os.enabled = true",
      "cursor.blink = false",
      "",
    ]);
  });

  it("appends a key without relatives at the end", () => {
    const result = ConfigLineEditor.set("shell.default = zsh\n", { "cursor.blink": "true" });
    expect(result).toBe("shell.default = zsh\ncursor.blink = true\n");
  });

  it("writes into an empty file", () => {
    expect(ConfigLineEditor.set("", { "cursor.blink": "true" })).toBe("cursor.blink = true\n");
  });

  it("removes duplicates of the key further down, which would override the first", () => {
    const text = "a.b = 1\n# note\na.b = 2\n";
    expect(ConfigLineEditor.set(text, { "a.b": "3" })).toBe("a.b = 3\n# note\n");
  });

  it("removes a key's lines and nothing else", () => {
    const text = "a.b = 1\n# note\nc.d = 2\na.b = 3\n";
    expect(ConfigLineEditor.set(text, { "a.b": null })).toBe("# note\nc.d = 2\n");
  });

  it("lists the keys the file sets", () => {
    expect([...ConfigLineEditor.keys("# a = 1\nb.c = 2\n\nd = [x]\n")]).toEqual(["b.c", "d"]);
  });

  it("does not mistake a commented-out line for the key", () => {
    const text = "# a.b = 1\n";
    expect(ConfigLineEditor.set(text, { "a.b": "2" })).toBe("# a.b = 1\na.b = 2\n");
  });
});
