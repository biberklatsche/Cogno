import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";
import { featuresHooksEnabled, withFeaturesHooksEnabled } from "./codex-app-config";

const enabled = (text: string) => featuresHooksEnabled(parseToml(text) as Record<string, unknown>);

describe("featuresHooksEnabled", () => {
  it("is true only for features.hooks = true", () => {
    expect(enabled("[features]\nhooks = true\n")).toBe(true);
    expect(enabled("features.hooks = true\n")).toBe(true);
    expect(enabled("[features]\nhooks = false\n")).toBe(false);
    expect(enabled('model = "gpt"\n')).toBe(false);
    expect(enabled("")).toBe(false);
  });
});

describe("withFeaturesHooksEnabled", () => {
  it("appends a [features] table to a file without one, keeping the rest byte for byte", () => {
    const text = '# my config\nmodel = "gpt-5"\n\n[projects."c:\\\\x"]\ntrust_level = "trusted"\n';

    const result = withFeaturesHooksEnabled(text);

    expect(result).toBe(`${text}\n[features]\nhooks = true\n`);
    expect(enabled(result)).toBe(true);
  });

  it("adds the key to an existing [features] table, after its header", () => {
    const text = '[features]\nmulti_agent = true # keep\n\n[windows]\nsandbox = "elevated"\n';

    const result = withFeaturesHooksEnabled(text);

    expect(result).toBe(
      '[features]\nhooks = true\nmulti_agent = true # keep\n\n[windows]\nsandbox = "elevated"\n',
    );
  });

  it("replaces a hooks = false line in [features], and leaves a hooks key of another table alone", () => {
    const text = "[other]\nhooks = false\n\n[features]\n  hooks = false   # off\n[hooks.state]\n";

    const result = withFeaturesHooksEnabled(text);

    expect(result).toBe("[other]\nhooks = false\n\n[features]\nhooks = true\n[hooks.state]\n");
  });

  it("replaces a top-level dotted features.hooks key", () => {
    expect(withFeaturesHooksEnabled('features.hooks = false\nmodel = "x"\n')).toBe(
      'features.hooks = true\nmodel = "x"\n',
    );
  });

  it("keeps Windows line endings", () => {
    expect(withFeaturesHooksEnabled('model = "x"\r\n')).toBe(
      'model = "x"\r\n\r\n[features]\r\nhooks = true\r\n',
    );
  });

  it("starts an empty file with the table alone", () => {
    expect(withFeaturesHooksEnabled("")).toBe("[features]\nhooks = true\n");
  });
});
