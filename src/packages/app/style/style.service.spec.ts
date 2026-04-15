import { Fs } from "@cogno/app-tauri/fs";
import { Logger } from "@cogno/app-tauri/logger";
import { Path } from "@cogno/app-tauri/path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../__test__/mocks/config-service.mock";
import { getDestroyRef } from "../../__test__/test-factory";
import type { Config } from "../config/+models/config";
import { StyleService } from "./style.service";

vi.mock("@cogno/app-tauri/fs", () => ({
  Fs: {
    convertFileSrc: vi.fn((path: string) => `mock-url://${path}`),
  },
}));

vi.mock("@cogno/app-tauri/path", () => ({
  Path: {
    homeDir: vi.fn(async () => "/Users/tester"),
  },
}));

vi.mock("@cogno/app-tauri/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@cogno/app-tauri/os", () => ({
  OS: {
    platform: vi.fn(() => "macos"),
  },
}));

describe("StyleService", () => {
  let _styleService: StyleService;
  let configService: ConfigServiceMock;
  const destroyRef = getDestroyRef();

  const baseConfig: Config = {
    color: {
      background: "1e1e1e",
      foreground: "cccccc",
      highlight: "007acc",
      black: "000000",
      red: "cd3131",
      green: "0dbc79",
      yellow: "e5e510",
      blue: "2472c8",
      magenta: "bc3fbc",
      cyan: "11a8cd",
      white: "e5e5e5",
      bright_white: "ffffff",
    },
    font: {
      size: 14,
      family: "Fira Code",
      weight: "normal",
      app: {
        family: "Inter",
        size: 13,
      },
    },
    cursor: {
      color: "ffffff",
      width: 2,
      blink: true,
      style: "bar",
    },
    padding: {
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
    },
    menu: {
      opacity: 100,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigServiceMock();
    vi.spyOn(document.documentElement.style, "setProperty");
    vi.spyOn(document.body.style, "setProperty");
    vi.spyOn(document.body.style, "removeProperty");
    vi.spyOn(document.body.classList, "add");
    vi.spyOn(document.body.classList, "remove");
  });

  const waitForAsyncEffects = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it("should initialize and subscribe to config changes", () => {
    _styleService = new StyleService(configService, destroyRef);
    configService.setConfig(baseConfig);

    expect(Logger.info).toHaveBeenCalledWith("StyleService constructor");
    expect(document.documentElement.style.setProperty).toHaveBeenCalled();
  });

  describe("CSS Variables", () => {
    it("should set basic color variables", () => {
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(baseConfig);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color",
        "#1e1e1e",
      );
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--foreground-color",
        "#cccccc",
      );
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--highlight-color",
        "#007acc",
      );
    });

    it("should handle light theme background factor", () => {
      const lightConfig = {
        ...baseConfig,
        color: { ...baseConfig.color, background: "ffffff" },
      };
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(lightConfig);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color",
        "#ffffff",
      );
    });

    it("should set font variables correctly", () => {
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(baseConfig);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--font-size",
        "14px",
      );
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--font-family",
        baseConfig.font.family,
      );
    });

    it("should set padding variables correctly", () => {
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(baseConfig);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--padding-xterm",
        "1rem 1rem 1rem 1rem",
      );
    });
  });

  describe("Menu Opacity", () => {
    it("should calculate opacity for menu", () => {
      const configWithOpacity = {
        ...baseConfig,
        menu: { opacity: 50 },
      };
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configWithOpacity);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color-ct",
        "#1e1e1e80",
      );
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color-ct2",
        "#1e1e1e40",
      );
    });

    it("should handle 100% opacity special case", () => {
      const configWithFullOpacity = {
        ...baseConfig,
        menu: { opacity: 100 },
      };
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configWithFullOpacity);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color-ct",
        "#1e1e1eFF",
      );
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color-ct2",
        "#1e1e1eFF",
      );
    });
  });

  describe("Background Image", () => {
    it("should set background image properties when path is provided", async () => {
      const configWithImage = {
        ...baseConfig,
        terminal: {
          allow_transparency: true,
        },
        background_image: {
          path: "/path/to/image.png",
          opacity: 50,
          blur: 5,
        },
      };
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configWithImage);
      await waitForAsyncEffects();

      expect(Fs.convertFileSrc).toHaveBeenCalledWith("/path/to/image.png");
      expect(document.body.style.setProperty).toHaveBeenCalledWith(
        "--background-image",
        'url("mock-url:///path/to/image.png")',
      );
      expect(document.body.style.setProperty).toHaveBeenCalledWith("--background-blur", "5px");
      expect(document.body.classList.add).toHaveBeenCalledWith("has-background");
    });

    it("should resolve ~/ paths for background images", async () => {
      const configWithTildePath = {
        ...baseConfig,
        terminal: {
          allow_transparency: true,
        },
        background_image: {
          path: "~/.cogno-dev/background-image.png",
          opacity: 50,
          blur: 0,
        },
      };
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configWithTildePath);
      await waitForAsyncEffects();

      expect(Path.homeDir).toHaveBeenCalled();
      expect(Fs.convertFileSrc).toHaveBeenCalledWith(
        "/Users/tester/.cogno-dev/background-image.png",
      );
    });

    it("should remove background image properties when path is missing", async () => {
      _styleService = new StyleService(configService, destroyRef);

      configService.setConfig({
        ...baseConfig,
        background_image: { path: "/some/path.png", opacity: 100, blur: 0 },
      });
      await waitForAsyncEffects();

      configService.setConfig({
        ...baseConfig,
        background_image: undefined,
      });
      await waitForAsyncEffects();

      expect(document.body.classList.remove).toHaveBeenCalledWith("has-background");
      expect(document.body.style.removeProperty).toHaveBeenCalledWith("--background-image");
      expect(document.body.style.removeProperty).toHaveBeenCalledWith("--background-gradient");
      expect(document.body.style.removeProperty).toHaveBeenCalledWith("--background-blur");
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing menu config by defaulting to 100% opacity", () => {
      const configNoMenu = { ...baseConfig, menu: undefined };
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configNoMenu);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color-ct",
        "#1e1e1eFF",
      );
    });

    it("should handle zero opacity correctly", () => {
      const configZeroOpacity = { ...baseConfig, menu: { opacity: 0 } };
      _styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configZeroOpacity);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        "--background-color-ct",
        "#1e1e1e00",
      );
    });
  });
});
