// Vitest setup file
import { afterEach, beforeEach, vi } from 'vitest';
import '@angular/compiler';
import { PathFactory } from '@cogno/core-host';
import { communityFeatureShellPathAdapterDefinitions } from '@cogno/community-features';
import { proFeatureShellPathAdapterDefinitions } from '@cogno/pro-features';

// Globally mock our Tauri wrapper modules to default implementations from TauriMockFactory
vi.mock('/src/app/src/_tauri/fs.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Fs: TauriMockFactory.createFs() };
});
vi.mock('/src/app/src/_tauri/db.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return TauriMockFactory.createDb();
});
vi.mock('/src/app/src/_tauri/pty.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { TauriPty: TauriMockFactory.createTauriPty() };
});
vi.mock('/src/app/src/_tauri/window.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { AppWindow: TauriMockFactory.createWindow() };
});
vi.mock('/src/app/src/_tauri/os.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { OS: TauriMockFactory.createOS() };
});
vi.mock('/src/app/src/_tauri/path.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Path: TauriMockFactory.createPath() };
});
vi.mock('/src/app/src/_tauri/logger.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Logger: TauriMockFactory.createLogger() };
});
vi.mock('/src/app/src/_tauri/clipboard.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Clipboard: TauriMockFactory.createClipboard() };
});
vi.mock('/src/app/src/_tauri/process.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Process: TauriMockFactory.createProcess() };
});
vi.mock('/src/app/src/_tauri/shells.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Shells: TauriMockFactory.createShells() };
});
vi.mock('/src/app/src/_tauri/default-config.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { DefaultConfig: TauriMockFactory.createDefaultConfig() };
});
vi.mock('/src/app/src/_tauri/cli-action.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { CliActionListener: TauriMockFactory.createCliAction() };
});
vi.mock('/src/app/src/_tauri/keyboard-layout.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { KeyboardLayout: TauriMockFactory.createKeyboardLayout() };
});
vi.mock('/src/app/src/_tauri/opener.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Opener: TauriMockFactory.createOpener() };
});
vi.mock('/src/app/src/_tauri/script.ts', async () => {
  const { TauriMockFactory } = await import('./src/app/__test__/mocks/tauri-mock.factory');
  return { Script: TauriMockFactory.createScript() };
});

// Reset all mocks between tests to keep isolation similar to Jest
beforeEach(() => {
  PathFactory.setDefinitions([
    ...communityFeatureShellPathAdapterDefinitions,
    ...proFeatureShellPathAdapterDefinitions,
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});
