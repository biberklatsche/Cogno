import {ShellConfig} from './settings';

export interface Position {
  x: number;
  y: number;
}

export interface CursorPosition extends Position{
  windowX: number;
  windowY: number;
  appWindowX: number;
  appWindowY: number;
  height: number;
  width: number;
  line: number;
  offsetX: number;
}

export type InjectionType = 'Auto' | 'Manual' | 'Remote';

export enum ShellType {
  Bash = 'Bash',
  GitBash = 'GitBash',
  Powershell = 'Powershell',
  ZSH = 'ZSH'
}

export enum WindowState {
  Maximized = 'Maximized',
  Unmaximized = 'Unmaximized',

  FullScreen = 'FullScreen',
  Minimized = 'Minimized',
}

export interface ShellInfo {
  directory: string[];
  machine: string;
  user: string;
  timestamp: number;
  returnCode: number;
  branch: string;
  isDirty: boolean;
}

export interface RendererState {
  currentInput: {input: string; lines: {line: number; lineText: string}[]};
  cursorPosition: CursorPosition;
}

export enum TabType {
  Terminal, About, Settings, ReleaseNotes
}


export interface ElectronUpdateInfo {
  version?: string;
  releaseDate?: Date;
  isUpdateAvailable: boolean;
  isRunning: boolean;
  hasError: boolean;
  error: string;
}

export interface SessionData {
  id: string;
  type: SessionDataType;

  dimensions?: Dimensions;
  settings?: ShellConfig;

  ackLength?: number;

  data?: string;

  error?: string;
}

export enum SessionDataType {
  New, Exit, Input, Output, Resize, Closed, Error, Ack
}

export interface Dimensions {
  cols: number;
  rows: number;
}
