// Vitest setup file
import "@angular/compiler";
import { PathFactory } from "@cogno/core-host";
import { baseFeatureShellPathAdapterDefinitions } from "@cogno/base-features";
import { afterEach, beforeEach, vi } from "vitest";

// Globally mock our Tauri wrapper modules to default implementations from TauriMockFactory
vi.mock('/packages/app-shell/_tauri/fs.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Fs: TauriMockFactory.createFs() };
});
vi.mock('/packages/app-shell/_tauri/db.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return TauriMockFactory.createDb();
});
vi.mock('/packages/app-shell/_tauri/pty.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { TauriPty: TauriMockFactory.createTauriPty() };
});
vi.mock('/packages/app-shell/_tauri/window.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { AppWindow: TauriMockFactory.createWindow() };
});
vi.mock('/packages/app-shell/_tauri/os.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { OS: TauriMockFactory.createOS() };
});
vi.mock('/packages/app-shell/_tauri/path.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Path: TauriMockFactory.createPath() };
});
vi.mock('/packages/app-shell/_tauri/logger.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Logger: TauriMockFactory.createLogger() };
});
vi.mock('/packages/app-shell/_tauri/clipboard.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Clipboard: TauriMockFactory.createClipboard() };
});
vi.mock('/packages/app-shell/_tauri/process.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Process: TauriMockFactory.createProcess() };
});
vi.mock('/packages/app-shell/_tauri/shells.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Shells: TauriMockFactory.createShells() };
});
vi.mock('/packages/app-shell/_tauri/default-config.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { DefaultConfig: TauriMockFactory.createDefaultConfig() };
});
vi.mock('/packages/app-shell/_tauri/cli-action.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { CliActionListener: TauriMockFactory.createCliAction() };
});
vi.mock('/packages/app-shell/_tauri/keyboard-layout.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { KeyboardLayout: TauriMockFactory.createKeyboardLayout() };
});
vi.mock('/packages/app-shell/_tauri/opener.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Opener: TauriMockFactory.createOpener() };
});
vi.mock('/packages/app-shell/_tauri/script.ts', async () => {
  const { TauriMockFactory } = await import('./packages/__test__/mocks/tauri-mock.factory');
  return { Script: TauriMockFactory.createScript() };
});

// Reset all mocks between tests to keep isolation similar to Jest
beforeEach(() => {
  PathFactory.setDefinitions([...baseFeatureShellPathAdapterDefinitions]);
});

afterEach(() => {
  vi.clearAllMocks();
});
