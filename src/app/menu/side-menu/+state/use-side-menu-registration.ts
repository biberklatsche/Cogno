import {DestroyRef, effect, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {SideMenuItem, SideMenuService} from './side-menu.service';
import {AppBus} from '../../../app-bus/app-bus';
import {ConfigService} from '../../../config/+state/config.service';
import {ConfigTypes, FeatureMode} from '../../../config/+models/config.types';
import {Icon} from '../../../icons/+model/icon';

export type UseSideMenuRegistrationParams = {
  menuItem: SideMenuItem;
  configSelector: (config: ConfigTypes) => FeatureMode;
  onOpen: () => void;
  onClose: () => void;
  onConfigChange?: (mode: FeatureMode) => void;
};

export function useSideMenuRegistration(params: UseSideMenuRegistrationParams) {
  const sideMenuService = inject(SideMenuService);
  const bus = inject(AppBus);
  const config = inject(ConfigService);
  const ref = inject(DestroyRef);

  let keybindSubscription: Subscription | undefined;
  let isOpened = false;

  const addMenuItem = (hidden: boolean) => {
    sideMenuService.addMenuItem({ ...params.menuItem, hidden });
  };

  const removeMenuItem = () => {
    sideMenuService.removeMenuItem(params.menuItem.label);
  };

  const addKeybindHandler = () => {
    keybindSubscription?.unsubscribe();
    keybindSubscription = new Subscription();
    keybindSubscription.add(
      bus
        .on$({ type: 'ActionFired', path: ['app', 'action'] })
        .subscribe((event) => {
          switch (event.payload) {
            case params.menuItem.actionName: {
              sideMenuService.open(params.menuItem.label);
              (event as any).performed = true;
              break;
            }
          }
        })
    );
  };

  const removeKeybindHandler = () => {
    keybindSubscription?.unsubscribe();
  };

  // React to configuration
  config.config$
    .pipe(takeUntilDestroyed(ref))
    .subscribe((cfg) => {
      const mode = params.configSelector(cfg);
      switch (mode) {
        case 'off':
          params.onConfigChange?.('off');
          removeKeybindHandler();
          removeMenuItem();
          break;
        case 'hidden':
          params.onConfigChange?.('hidden');
          addMenuItem(true);
          addKeybindHandler();
          break;
        case 'visible':
          params.onConfigChange?.('visible');
          addMenuItem(false);
          addKeybindHandler();
          break;
      }
    });

  // React to side menu selection changes
  effect(() => {
    const selectedItem = sideMenuService.selectedItem();
    const newIsOpened = selectedItem?.label === params.menuItem.label;
    if (newIsOpened !== isOpened) {
      if (newIsOpened) {
        params.onOpen();
      } else {
        params.onClose();
      }
    }
    isOpened = newIsOpened;
  });

  const updateIcon = (icon: Icon) => {
    sideMenuService.addMenuItem({ ...params.menuItem, icon });
  };

  return { updateIcon };
}
