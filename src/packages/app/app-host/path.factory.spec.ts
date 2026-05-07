import {
  BashPathAdapter,
  featureShellPathAdapterDefinitions,
  PowerShellPathAdapter,
  ZshPathAdapter,
} from "@cogno/features";
import { beforeAll, describe, expect, it } from "vitest";
import { PathFactory } from "./path.factory";

beforeAll(() => {
  PathFactory.setDefinitions([...featureShellPathAdapterDefinitions]);
});

describe("PathFactory", () => {
  it("should create BashPathAdapter", () => {
    expect(PathFactory.createAdapter({ shellType: "Bash", backendOs: "linux" })).toBeInstanceOf(
      BashPathAdapter,
    );
  });

  it("should create ZshPathAdapter", () => {
    expect(PathFactory.createAdapter({ shellType: "ZSH", backendOs: "macos" })).toBeInstanceOf(
      ZshPathAdapter,
    );
  });

  it("should create PowerShellPathAdapter", () => {
    expect(
      PathFactory.createAdapter({ shellType: "PowerShell", backendOs: "windows" }),
    ).toBeInstanceOf(PowerShellPathAdapter);
  });

  it("should throw error for unsupported shell type", () => {
    expect(() => PathFactory.createAdapter("Unsupported" as never)).toThrow(
      "Unsupported shell type: Unsupported",
    );
  });
});
