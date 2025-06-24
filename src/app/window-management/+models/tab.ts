import {Icon} from '../../icons/+models/icon';
import {ShellConfig} from '../../settings/+models/settings';
import {SettingsSubMenus} from '../../settings/+models/ui';

export type Tab = DefaultTab | TerminalTab | SettingsTab;

export type TabType = 'about' | 'release-notes' | 'terminal' | 'settings';

export type BaseTab = {
  id: string;
  tabType: TabType;
  icon: Icon;
  name: string;
  subName?: string;
  isClosing: boolean;
  isLoading: boolean;
  hasError: boolean;
  isSelected: boolean;
  isCommandRunning: boolean;
  isAppRunning: boolean;
}

export type DefaultTab = BaseTab & {
  tabType: 'about' | 'release-notes';
}

export type TerminalTab = BaseTab & {
  tabType: 'terminal';
  config: ShellConfig;
  directory?: string[];
  path?: string;
}

export type SettingsTab = BaseTab & {
  tabType: 'settings';
  config: SettingsTabConfig;
}

export type SettingsTabConfig = {
  selectedSubMenu: SettingsSubMenus;
  filter?: string;
}
