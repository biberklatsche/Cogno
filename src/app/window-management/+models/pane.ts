import {Tab} from './tab';

export class Pane {
  splitDirection?: SplitDirection;
  ratio?: number;
  tabs: Tab[] = [];
  isTopRightPane: boolean;
  isFirstPane: boolean;

  constructor(isFirstPane: boolean = false, isTopRightPane: boolean = false) {
    this.isFirstPane = isFirstPane;
    this.isTopRightPane = isTopRightPane;
  }
}

export type SplitDirection = 'horizontal' | 'vertical';
