import { describe, it, expect, beforeAll } from "vitest";
import { PathFactory } from "./path.factory";
import {
  BashPathAdapter,
  PowerShellPathAdapter,
  ZshPathAdapter,
  communityFeatureShellPathAdapterDefinitions,
} from "@cogno/community-features";
import {
  FishPathAdapter,
  GitBashPathAdapter,
  proFeatureShellPathAdapterDefinitions,
} from "@cogno/pro-features";

beforeAll(() => {
  PathFactory.setDefinitions([
    ...communityFeatureShellPathAdapterDefinitions,
    ...proFeatureShellPathAdapterDefinitions,
  ]);
});

describe("PathFactory", () => {
  it("should create BashPathAdapter", () => {
    expect(PathFactory.createAdapter({ shellType: "Bash", backendOs: "linux" })).toBeInstanceOf(BashPathAdapter);
  });

  it("should create ZshPathAdapter", () => {
    expect(PathFactory.createAdapter({ shellType: "ZSH", backendOs: "macos" })).toBeInstanceOf(ZshPathAdapter);
  });

  it("should create FishPathAdapter", () => {
    expect(PathFactory.createAdapter({ shellType: "Fish", backendOs: "linux" })).toBeInstanceOf(FishPathAdapter);
  });

  it("should create PowerShellPathAdapter", () => {
    expect(PathFactory.createAdapter({ shellType: "PowerShell", backendOs: "windows" })).toBeInstanceOf(
      PowerShellPathAdapter,
    );
  });

  it("should create GitBashPathAdapter", () => {
    expect(PathFactory.createAdapter({ shellType: "GitBash", backendOs: "windows" })).toBeInstanceOf(
      GitBashPathAdapter,
    );
  });

  it("should throw error for unsupported shell type", () => {
    expect(() => PathFactory.createAdapter("Unsupported" as never)).toThrow("Unsupported shell type: Unsupported");
  });
});
