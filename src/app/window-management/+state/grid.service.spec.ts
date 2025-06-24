import {clear, getGridService, getKeyboardService, getSettingsService} from '../../../../../test/factory';
import {GridService} from './grid.service';
import {SettingsService} from '../../../+shared/services/settings/settings.service';
import {TestHelper} from '../../../../../test/helper';
import {KeyboardService} from '../../../+shared/services/keyboard/keyboard.service';
import {BinaryTree} from '../../common/tree/binary-tree';
import {TabType} from '../../../../../shared/models/models';
import {SplitDirection} from '../../../+shared/models/pane';

describe('GridServiceTests', () => {

  let gridService: GridService;
  let settingsService: SettingsService;
  let keyService: KeyboardService;

  beforeEach(() => {
    gridService = getGridService();
    settingsService = getSettingsService();
    keyService = getKeyboardService();
  });

  afterEach(() => {
    clear();
  })

  it('should be created', () => {
    expect(gridService).toBeTruthy();
  });

  it('should create new tab after settings are loaded', () => {
    settingsService.update(TestHelper.createSettingsResult());
    expect(gridService.getTree().root.data.tabs).toHaveLength(1);
  });

  it('should handle newTab shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('newTab'), true);

    expect(gridService.getTree().root.data.tabs).toHaveLength(2);

    expect(gridService.getTree().root.data.tabs.filter(t => t.isClosing)).toHaveLength(0);
  });

  it('should handle closeTab shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('closeTab'), true);

    expect(gridService.getTree().root.data.tabs).toHaveLength(0);
  });

  it('should handle closeAllTabs shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('closeAllTabs'), true);

    expect(gridService.getTree().root.data.tabs).toHaveLength(0);
  });

  it('should handle nextTab shortcut', () => {
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    expect(gridService.getTree().root.data.tabs).toHaveLength(3);
    expect(gridService.getTree().root.data.tabs[0].isSelected).toBeFalsy();
    expect(gridService.getTree().root.data.tabs[1].isSelected).toBeFalsy();
    expect(gridService.getTree().root.data.tabs[2].isSelected).toBeTruthy();
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('nextTab'), true);

    expect(gridService.getTree().root.data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.data.tabs[1].isSelected).toBeFalsy();
    expect(gridService.getTree().root.data.tabs[2].isSelected).toBeFalsy();
  });

  it('should handle previousTab shortcut', () => {
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    expect(gridService.getTree().root.data.tabs).toHaveLength(3);
    expect(gridService.getTree().root.data.tabs[0].isSelected).toBeFalsy();
    expect(gridService.getTree().root.data.tabs[1].isSelected).toBeFalsy();
    expect(gridService.getTree().root.data.tabs[2].isSelected).toBeTruthy();
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('previousTab'), true);

    expect(gridService.getTree().root.data.tabs[0].isSelected).toBeFalsy();
    expect(gridService.getTree().root.data.tabs[1].isSelected).toBeTruthy();
    expect(gridService.getTree().root.data.tabs[2].isSelected).toBeFalsy();
  });

  it('should handle splitAndMoveVertical shortcut', () => {
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('splitAndMoveVertical'), true);

    expect(gridService.getTree().root.children.length).toBe(2);
    expect(gridService.getTree().root.data.splitDirection).toBe(SplitDirection.Vertical);
    expect(gridService.getTree().root.children[0].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[0].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[0].data.tabs[0].tabType).toEqual(TabType.Terminal);
    expect(gridService.getTree().root.children[1].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[1].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[1].data.tabs[0].tabType).toEqual(TabType.About);
  });

  it('should handle splitAndMoveHorizontal shortcut', () => {
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('splitAndMoveHorizontal'), true);

    expect(gridService.getTree().root.children.length).toBe(2);
    expect(gridService.getTree().root.data.splitDirection).toBe(SplitDirection.Horizontal);
    expect(gridService.getTree().root.children[0].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[0].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[0].data.tabs[0].tabType).toEqual(TabType.Terminal);
    expect(gridService.getTree().root.children[1].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[1].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[1].data.tabs[0].tabType).toEqual(TabType.About);
  });

  it('should handle splitAndMoveHorizontal shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('splitVertical'), true);

    expect(gridService.getTree().root.children.length).toBe(2);
    expect(gridService.getTree().root.data.splitDirection).toBe(SplitDirection.Vertical);
    expect(gridService.getTree().root.children[0].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[0].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[0].data.tabs[0].tabType).toEqual(TabType.Terminal);
    expect(gridService.getTree().root.children[1].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[1].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[1].data.tabs[0].tabType).toEqual(TabType.Terminal);
  });

  it('should handle splitAndMoveHorizontal shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('splitHorizontal'), true);

    expect(gridService.getTree().root.children.length).toBe(2);
    expect(gridService.getTree().root.data.splitDirection).toBe(SplitDirection.Horizontal);
    expect(gridService.getTree().root.children[0].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[0].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[0].data.tabs[0].tabType).toEqual(TabType.Terminal);
    expect(gridService.getTree().root.children[1].data.tabs.length).toBe(1);
    expect(gridService.getTree().root.children[1].data.tabs[0].isSelected).toBeTruthy();
    expect(gridService.getTree().root.children[1].data.tabs[0].tabType).toEqual(TabType.Terminal);
  });

  it('should handle unsplit shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('splitHorizontal'), true);
    expect(gridService.getTree().root.children.length).toBe(2);
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('unsplit'), true);
    expect(gridService.getTree().root.children).toEqual([]);
    expect(gridService.getTree().root.data.tabs.length).toBe(2);
    expect(gridService.getTree().root.data.tabs[0].isSelected).toBeFalsy();
    expect(gridService.getTree().root.data.tabs[1].isSelected).toBeTruthy();
  });

  it('should handle swapPanes shortcut', () => {
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('splitAndMoveHorizontal'), true);
    expect(gridService.getTree().root.children[0].data.tabs[0].tabType).toEqual(TabType.Terminal);
    expect(gridService.getTree().root.children[1].data.tabs[0].tabType).toEqual(TabType.About);
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('swapPanes'), true);
    expect(gridService.getTree().root.children[0].data.tabs[0].tabType).toEqual(TabType.About);
    expect(gridService.getTree().root.children[1].data.tabs[0].tabType).toEqual(TabType.Terminal);
  });

  it('should handle openSettings shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('openSettings'), true);
    expect(gridService.getTree().root.data.tabs[1].tabType).toEqual(TabType.Settings);
  });

  it('should handle duplicateTab shortcut', () => {
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('duplicateTab'), true);
    expect(gridService.getTree().root.data.tabs[0].tabType).toEqual(TabType.Terminal);
    expect(gridService.getTree().root.data.tabs[1].tabType).toEqual(TabType.Terminal);
  });

  it('should handle closeOtherTabs shortcut', () => {
    gridService.addNewTab(BinaryTree.ROOT_KEY, TabType.About);
    keyService.handleShortcut(TestHelper.createKeyboardEventFromShortcut('closeOtherTabs'), true);
    expect(gridService.getTree().root.data.tabs.length).toEqual(1);
    expect(gridService.getTree().root.data.tabs[0].tabType).toEqual(TabType.About);
  });
})
