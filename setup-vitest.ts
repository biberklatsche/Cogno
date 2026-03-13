// Vitest setup file
import "@angular/compiler";
import { PathFactory } from "@cogno/core-host";
import { featureShellPathAdapterDefinitions } from "@cogno/features";
import { afterEach, beforeEach, vi } from "vitest";

// Globally mock our Tauri wrapper modules to default implementations from TauriMockFactory
vi.mock('/src/packages/app/_tauri/fs.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Fs: TauriMockFactory.createFs() };
});
vi.mock('/src/packages/app/_tauri/db.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return TauriMockFactory.createDb();
});
vi.mock('/src/packages/app/_tauri/pty.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { TauriPty: TauriMockFactory.createTauriPty() };
});
vi.mock('/src/packages/app/_tauri/window.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { AppWindow: TauriMockFactory.createWindow() };
});
vi.mock('/src/packages/app/_tauri/os.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { OS: TauriMockFactory.createOS() };
});
vi.mock('/src/packages/app/_tauri/path.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Path: TauriMockFactory.createPath() };
});
vi.mock('/src/packages/app/_tauri/logger.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Logger: TauriMockFactory.createLogger() };
});
vi.mock('/src/packages/app/_tauri/clipboard.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Clipboard: TauriMockFactory.createClipboard() };
});
vi.mock('/src/packages/app/_tauri/process.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Process: TauriMockFactory.createProcess() };
});
vi.mock('/src/packages/app/_tauri/shells.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Shells: TauriMockFactory.createShells() };
});
vi.mock('/src/packages/app/_tauri/default-config.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { DefaultConfig: TauriMockFactory.createDefaultConfig() };
});
vi.mock('/src/packages/app/_tauri/cli-action.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { CliActionListener: TauriMockFactory.createCliAction() };
});
vi.mock('/src/packages/app/_tauri/keyboard-layout.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { KeyboardLayout: TauriMockFactory.createKeyboardLayout() };
});
vi.mock('/src/packages/app/_tauri/opener.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Opener: TauriMockFactory.createOpener() };
});
vi.mock('/src/packages/app/_tauri/script.ts', async () => {
  const { TauriMockFactory } = await import('./src/packages/__test__/mocks/tauri-mock.factory');
  return { Script: TauriMockFactory.createScript() };
});

// Reset all mocks between tests to keep isolation similar to Jest
beforeEach(() => {
  PathFactory.setDefinitions([...featureShellPathAdapterDefinitions]);
});

afterEach(() => {
  vi.clearAllMocks();
});
