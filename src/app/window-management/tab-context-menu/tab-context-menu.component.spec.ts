import {
  clear,
  getKeyboardService,
  getKeytipService, getTabContextMenuService
} from '../../../../test/factory';
import {TabContextMenuComponent} from './tab-context-menu.component';
import {TabContextMenuService} from './+state/tab-context-menu.service';


describe('TabContextMenuComponent', () => {
  let component: TabContextMenuComponent;
  let service: TabContextMenuService;


  beforeEach(() => {
    clear();
    service = getTabContextMenuService();
    component = new TabContextMenuComponent(
      {nativeElement: {blur: () => {}, focus: () => {}}},
      getKeyboardService(),
      getKeytipService(),
      service
    );
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
