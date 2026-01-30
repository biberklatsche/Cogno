import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StyleService } from './style.service';
import { ConfigServiceMock } from '../../__test__/mocks/config-service.mock';
import { getDestroyRef } from '../../__test__/test-factory';
import { Config } from '../config/+models/config';
import { Fs } from '../_tauri/fs';
import { Logger } from '../_tauri/logger';

// Mocking dependencies
vi.mock('../_tauri/fs', () => ({
  Fs: {
    convertFileSrc: vi.fn((path: string) => `mock-url://${path}`)
  }
}));

describe('StyleService', () => {
  let styleService: StyleService;
  let configService: ConfigServiceMock;
  let destroyRef = getDestroyRef();

  const baseConfig: Config = {
    color: {
      background: '1e1e1e',
      foreground: 'cccccc',
      highlight: '007acc',
      black: '000000',
      red: 'cd3131',
      green: '0dbc79',
      yellow: 'e5e510',
      blue: '2472c8',
      magenta: 'bc3fbc',
      cyan: '11a8cd',
      white: 'e5e5e5',
      bright_white: 'ffffff',
    },
    font: {
      size: 14,
      family: 'Fira Code',
      weight: 'normal',
      app: {
        family: 'Inter',
        size: 13
      }
    },
    cursor: {
      color: 'ffffff',
      width: 2,
      blink: true,
      style: 'bar'
    },
    padding: {
      top: 1,
      right: 1,
      bottom: 1,
      left: 1
    },
    menu: {
      opacity: 100
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigServiceMock();
    // document.documentElement.style.setProperty is used, let's clear it or spy on it
    vi.spyOn(document.documentElement.style, 'setProperty');
    vi.spyOn(document.body.style, 'setProperty');
    vi.spyOn(document.body.style, 'removeProperty');
    vi.spyOn(document.body.classList, 'add');
    vi.spyOn(document.body.classList, 'remove');
  });

  it('should initialize and subscribe to config changes', () => {
    styleService = new StyleService(configService, destroyRef);
    configService.setConfig(baseConfig);

    expect(Logger.info).toHaveBeenCalledWith('StyleService constructor');
    expect(document.documentElement.style.setProperty).toHaveBeenCalled();
  });

  describe('CSS Variables', () => {
    it('should set basic color variables', () => {
      styleService = new StyleService(configService, destroyRef);
      configService.setConfig(baseConfig);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color', '#1e1e1e');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--foreground-color', '#cccccc');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--highlight-color', '#007acc');
    });

    it('should handle light theme background factor', () => {
      const lightConfig = {
        ...baseConfig,
        color: { ...baseConfig.color, background: 'ffffff' } // Pure white
      };
      styleService = new StyleService(configService, destroyRef);
      configService.setConfig(lightConfig);

      // In a light theme, we expect different darken/lighten behavior
      // We check if it was called (logic verification via behavior)
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color', '#ffffff');
    });

    it('should set font variables correctly', () => {
      styleService = new StyleService(configService, destroyRef);
      configService.setConfig(baseConfig);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--font-size', '14px');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--font-family', baseConfig.font.family);
    });

    it('should set padding variables correctly', () => {
      styleService = new StyleService(configService, destroyRef);
      configService.setConfig(baseConfig);

      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--padding-xterm', '1rem 1rem 1rem 1rem');
    });
  });

  describe('Menu Opacity', () => {
    it('should calculate opacity for menu', () => {
      const configWithOpacity = {
        ...baseConfig,
        menu: { opacity: 50 }
      };
      styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configWithOpacity);

      // 50% of 255 is 128 (80 in hex)
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color-ct', '#1e1e1e80');
      // opacityDouble for 50% is 25% -> 64 (40 in hex)
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color-ct2', '#1e1e1e40');
    });

    it('should handle 100% opacity special case', () => {
        const configWithFullOpacity = {
            ...baseConfig,
            menu: { opacity: 100 }
        };
        styleService = new StyleService(configService, destroyRef);
        configService.setConfig(configWithFullOpacity);
  
        // FF is 255 (100%)
        expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color-ct', '#1e1e1eFF');
        expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color-ct2', '#1e1e1eFF');
      });
  });

  describe('Background Image', () => {
    it('should set background image properties when path is provided', () => {
      const configWithImage = {
        ...baseConfig,
        allow_transparency: true,
        background_image: {
          path: '/path/to/image.png',
          opacity: 50,
          blur: 5
        }
      };
      styleService = new StyleService(configService, destroyRef);
      configService.setConfig(configWithImage);

      expect(Fs.convertFileSrc).toHaveBeenCalledWith('/path/to/image.png');
      expect(document.body.style.setProperty).toHaveBeenCalledWith('--background-image', 'url("mock-url:///path/to/image.png")');
      expect(document.body.style.setProperty).toHaveBeenCalledWith('--background-blur', '5px');
      expect(document.body.classList.add).toHaveBeenCalledWith('has-background');
    });

    it('should remove background image properties when path is missing', () => {
      styleService = new StyleService(configService, destroyRef);
      
      // Start with image
      configService.setConfig({
        ...baseConfig,
        background_image: { path: '/some/path.png', opacity: 100, blur: 0 }
      });

      // Then remove it
      configService.setConfig({
        ...baseConfig,
        background_image: undefined
      });

      expect(document.body.classList.remove).toHaveBeenCalledWith('has-background');
      expect(document.body.style.removeProperty).toHaveBeenCalledWith('--background-image');
      expect(document.body.style.removeProperty).toHaveBeenCalledWith('--background-gradient');
      expect(document.body.style.removeProperty).toHaveBeenCalledWith('--background-blur');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing menu config by defaulting to 100% opacity', () => {
        const configNoMenu = { ...baseConfig, menu: undefined };
        styleService = new StyleService(configService, destroyRef);
        configService.setConfig(configNoMenu);

        expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color-ct', '#1e1e1eFF');
    });

    it('should handle zero opacity correctly', () => {
        const configZeroOpacity = { ...baseConfig, menu: { opacity: 0 } };
        styleService = new StyleService(configService, destroyRef);
        configService.setConfig(configZeroOpacity);

        expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--background-color-ct', '#1e1e1e00');
    });
  });
});
