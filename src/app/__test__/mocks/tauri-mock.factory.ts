import { vi } from 'vitest';
import { Observable, Subject } from 'rxjs';

export class TauriMockFactory {
  static createTauriPty() {
    return {
      spawn: vi.fn().mockResolvedValue(undefined),
      kill: vi.fn().mockResolvedValue(undefined),
      resize: vi.fn().mockResolvedValue(undefined),
      onData: vi.fn().mockResolvedValue(() => {}),
      onExit: vi.fn().mockResolvedValue(() => {}),
      write: vi.fn().mockResolvedValue(undefined),
      executeShellAction: vi.fn().mockResolvedValue(undefined),
    };
  }

  static createScript() {
    return {
      read: vi.fn().mockResolvedValue('mock script content'),
    };
  }

  static createPath() {
    return {
      join: vi.fn().mockImplementation(async (...args) => args.join('/')),
      homeDir: vi.fn().mockResolvedValue('/mock/home'),
      exePath: vi.fn().mockResolvedValue('/mock/exe/path'),
      exeDir: vi.fn().mockResolvedValue('/mock/exe/dir'),
      macAppBundle: vi.fn().mockResolvedValue(null),
      cognoHomeDir: vi.fn().mockResolvedValue('/mock/cogno/home'),
      cognoConfigFilePath: vi.fn().mockResolvedValue('/mock/cogno/config.json'),
      cognoDbFilePath: vi.fn().mockResolvedValue('/mock/cogno/db.sqlite'),
    };
  }

  static createOS() {
    return {
      platform: vi.fn().mockReturnValue('macos'),
    };
  }

  static createClipboard() {
    return {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue('mock clipboard content'),
    };
  }

  static createFs() {
    return {
      readTextFile: vi.fn().mockResolvedValue(''),
      watchChanges$: vi.fn().mockReturnValue(new Observable()),
      exists: vi.fn().mockResolvedValue(true),
      convertFileSrc: vi.fn((path: string) => `mock://${path}`),
    };
  }

  static createDb() {
    return {
      Database: class {
        static async create() { return new this(); }
        execute = vi.fn().mockResolvedValue(undefined);
        query = vi.fn().mockResolvedValue([]);
        close = vi.fn().mockResolvedValue(undefined);
      }
    };
  }

  static createLogger() {
    return {
      debug: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockResolvedValue(undefined),
      warn: vi.fn().mockResolvedValue(undefined),
      error: vi.fn().mockResolvedValue(undefined),
    };
  }

  static createWindow() {
    return {
      isFocused: vi.fn().mockResolvedValue(true),
      isVisible: vi.fn().mockResolvedValue(true),
      isMaximized: vi.fn().mockResolvedValue(false),
      isMinimized: vi.fn().mockResolvedValue(false),
      close: vi.fn().mockResolvedValue(undefined),
      minimize: vi.fn().mockResolvedValue(undefined),
      unminimize: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn().mockResolvedValue(undefined),
      unmaximize: vi.fn().mockResolvedValue(undefined),
      windowSize$: new Observable(s => s.next({ width: 800, height: 600 })),
      onCloseRequested$: new Subject(),
      onFocusChanged$: new Observable(s => s.next(true)),
    };
  }

  static createProcess() {
    return {
      exit: vi.fn().mockResolvedValue(undefined),
      relaunch: vi.fn().mockResolvedValue(undefined),
    };
  }

  static createShells() {
    return {
      load: vi.fn().mockResolvedValue([]),
    };
  }

  static createDefaultConfig() {
    return {
      read: vi.fn().mockResolvedValue(''),
    };
  }

  static createCliAction() {
    return {
      register: vi.fn().mockResolvedValue(() => {}),
    };
  }

  static createOpener() {
    return {
      openPath: vi.fn().mockResolvedValue(undefined),
      openUrl: vi.fn().mockResolvedValue(undefined),
    };
  }

  static createKeyboardLayout() {
    return {
      load: vi.fn().mockResolvedValue({
        id: '00000407',
        name: 'German',
      }),
    };
  }
}
