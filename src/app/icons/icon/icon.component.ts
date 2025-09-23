import {Component, Input} from '@angular/core';
import {
    mdiAbTesting,
    mdiAccount,
    mdiAccountHeart,
    mdiAlert,
    mdiArrowDown,
    mdiArrowSplitHorizontal,
    mdiArrowSplitVertical,
    mdiArrowUp,
    mdiBomb,
    mdiBookmark,
    mdiBug,
    mdiCallMerge,
    mdiCallSplit,
    mdiCardsHeart,
    mdiCheck,
    mdiCheckboxBlankCircle,
    mdiCheckCircle,
    mdiChevronDown,
    mdiClose,
    mdiCloseBoxMultipleOutline,
    mdiCloseBoxOutline,
    mdiCloseNetworkOutline,
    mdiCodeBracesBox,
    mdiCog,
    mdiCogs,
    mdiConsole,
    mdiContentCopy,
    mdiDesktopClassic,
    mdiDotsVertical,
    mdiFolderMove,
    mdiFormatLetterCase,
    mdiFormatLetterMatches,
    mdiGit,
    mdiGithub,
    mdiInformation,
    mdiKeyboard,
    mdiKeyboardOff,
    mdiLanConnect,
    mdiLiquidSpot,
    mdiMonitor,
    mdiNuke,
    mdiOpenInNew,
    mdiPalette,
    mdiPercentBoxOutline,
    mdiPlus,
    mdiPowershell,
    mdiReddit,
    mdiRefreshAuto,
    mdiRegex,
    mdiRobot,
    mdiRobotOff,
    mdiRocketLaunch,
    mdiScanHelper,
    mdiSpeedometer,
    mdiSpiderThread,
    mdiSquareEditOutline,
    mdiStar,
    mdiStarOutline,
    mdiSwapHorizontal,
    mdiThemeLightDark,
    mdiThumbUp,
    mdiToyBrick,
    mdiTrashCanOutline,
    mdiViewCarousel,
    mdiViewDashboard,
    mdiWeatherNight,
    mdiWeatherSunny,
    mdiWindowMaximize,
    mdiWindowMinimize,
    mdiWindowRestore
} from '@mdi/js';
import {CommonModule} from '@angular/common';
import {Icon} from '../+models/icon';

@Component({
    selector: 'app-icon',
    styles: [`
    :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 100%
    }
    svg {
        fill: currentColor;
        height: 100%;
    }
  `],
    template: `
    <svg  viewBox="0 0 24 24" style="display:inline-block;">
      <path [attr.d]="icon" d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
    </svg>
  `,
    imports: [
        CommonModule
    ]
})
export class IconComponent {

  icon: string = mdiAbTesting;

  @Input()
  public set name(icon: Icon) {
    switch (icon) {
      case ('mdiSpiderThread'):
        this.icon = mdiSpiderThread;
        break;
      case ('mdiRefreshAuto'):
        this.icon = mdiRefreshAuto;
        break;
      case ('mdiBookmark'):
        this.icon = mdiBookmark;
        break;
      case ('mdiDotsVertical'):
        this.icon = mdiDotsVertical;
        break;
      case('mdiLiquidSpot'):
        this.icon = mdiLiquidSpot;
        break;
      case('mdiThemeLightDark'):
        this.icon = mdiThemeLightDark;
        break;
      case('mdiViewCarousel'):
        this.icon = mdiViewCarousel;
        break;
      case('mdiCallMerge'):
        this.icon = mdiCallMerge;
        break;
      case('mdiCallSplit'):
        this.icon = mdiCallSplit;
        break;
      case('mdiSwapHorizontal'):
        this.icon = mdiSwapHorizontal;
        break;
      case('mdiConsole'):
        this.icon = mdiConsole;
        break;
      case('mdiGit'):
        this.icon = mdiGit;
        break;
      case('mdiPowershell'):
        this.icon = mdiPowershell;
        break;
      case('mdiInformation'):
        this.icon = mdiInformation;
        break;
      case('mdiPalette'):
        this.icon = mdiPalette;
        break;
      case('mdiClose'):
        this.icon = mdiClose;
        break;
      case('mdiSpeedometer'):
        this.icon = mdiSpeedometer;
        break;
      case('mdiPlus'):
        this.icon = mdiPlus;
        break;
      case('mdiChevronDown'):
        this.icon = mdiChevronDown;
        break;
      case('mdiCog'):
        this.icon = mdiCog;
        break;
      case('mdiCogs'):
        this.icon = mdiCogs;
        break;
      case('mdiKeyboard'):
        this.icon = mdiKeyboard;
        break;
      case('mdiCodeBracesBox'):
        this.icon = mdiCodeBracesBox;
        break;
      case('mdiWindowMinimize'):
        this.icon = mdiWindowMinimize;
        break;
      case('mdiWindowRestore'):
        this.icon = mdiWindowRestore;
        break;
      case('mdiWindowMaximize'):
        this.icon = mdiWindowMaximize;
        break;
      case('mdiGithub'):
        this.icon = mdiGithub;
        break;
      case('mdiBug'):
        this.icon = mdiBug;
        break;
      case('mdiWeatherNight'):
        this.icon = mdiWeatherNight;
        break;
      case('mdiArrowSplitHorizontal'):
        this.icon = mdiArrowSplitHorizontal;
        break;
      case('mdiFolderMove'):
        this.icon = mdiFolderMove;
        break;
      case('mdiArrowSplitVertical'):
        this.icon = mdiArrowSplitVertical;
        break;
      case('mdiStar'):
        this.icon = mdiStar;
        break;
      case('mdiDesktopClassic'):
        this.icon = mdiDesktopClassic;
        break;
      case('mdiMonitor'):
        this.icon = mdiMonitor;
        break;
      case('mdiAccount'):
        this.icon = mdiAccount;
        break;
      case('mdiArrowUp'):
        this.icon = mdiArrowUp;
        break;
      case('mdiArrowDown'):
        this.icon = mdiArrowDown;
        break;
      case('mdiFormatLetterCase'):
        this.icon = mdiFormatLetterCase;
        break;
      case('mdiFormatLetterMatches'):
        this.icon = mdiFormatLetterMatches;
        break;
      case('mdiRegex'):
        this.icon = mdiRegex;
        break;
      case('mdiRocketLaunch'):
        this.icon = mdiRocketLaunch;
        break;
      case('mdiThumbUp'):
        this.icon = mdiThumbUp;
        break;
      case('mdiBomb'):
        this.icon = mdiBomb;
        break;
      case('mdiNuke'):
        this.icon = mdiNuke;
        break;
      case('mdiCheck'):
        this.icon = mdiCheck;
        break;
      case('mdiAlert'):
        this.icon = mdiAlert;
        break;
      case('mdiTrashCanOutline'):
        this.icon = mdiTrashCanOutline;
        break;
      case('mdiViewDashboard'):
        this.icon = mdiViewDashboard;
        break;
      case('mdiSquareEditOutline'):
        this.icon = mdiSquareEditOutline;
        break;
      case('mdiCloseBoxMultipleOutline'):
        this.icon = mdiCloseBoxMultipleOutline;
        break;
      case('mdiCloseBoxOutline'):
        this.icon = mdiCloseBoxOutline;
        break;
      case('mdiCloseNetworkOutline'):
        this.icon = mdiCloseNetworkOutline;
        break;
      case('mdiContentCopy'):
        this.icon = mdiContentCopy;
        break;
      case('mdiCheckCircle'):
        this.icon = mdiCheckCircle;
        break;
      case('mdiCheckboxBlankCircle'):
        this.icon = mdiCheckboxBlankCircle;
        break;
      case('mdiOpenInNew'):
        this.icon = mdiOpenInNew;
        break;
      case('mdiCardsHeart'):
        this.icon = mdiCardsHeart;
        break;
      case('mdiPercentBoxOutline'):
        this.icon = mdiPercentBoxOutline;
        break;
      case('mdiScanHelper'):
        this.icon = mdiScanHelper;
        break;
      case('mdiStarOutline'):
        this.icon = mdiStarOutline;
        break;
      case('mdiWeatherSunny'):
        this.icon = mdiWeatherSunny;
        break;
      case('mdiLanConnect'):
        this.icon = mdiLanConnect;
        break;
      case('mdiRobot'):
        this.icon = mdiRobot;
        break;
      case('mdiRobotOff'):
        this.icon = mdiRobotOff;
        break;
      case('mdiReddit'):
        this.icon = mdiReddit;
        break;
      case('mdiToyBrick'):
        this.icon = mdiToyBrick;
        break;
      case('mdiKeyboardOff'):
        this.icon = mdiKeyboardOff;
        break;
      case('mdiAccountHeart'):
        this.icon = mdiAccountHeart;
        break;
      default:
        this.icon = mdiAbTesting;
        break;
    }
  }
}
