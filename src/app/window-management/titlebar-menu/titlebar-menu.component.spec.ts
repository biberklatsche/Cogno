import {
  clear,
  getKeyboardService,
  getKeytipService, getTitlebarMenuService
} from '../../../../test/factory';
import {TitlebarMenuComponent} from './titlebar-menu.component';
import {TitlebarMenuService} from './+state/titlebar-menu.service';


describe('TitlebarMenuComponent', () => {
  let component: TitlebarMenuComponent;
  let service: TitlebarMenuService;


  beforeEach(() => {
    clear();
    service = getTitlebarMenuService();
    component = new TitlebarMenuComponent(
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
