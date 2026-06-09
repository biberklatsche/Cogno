import { Component, Input } from "@angular/core";
import {
  mdiAbTesting,
  mdiAlert,
  mdiArrowDown,
  mdiArrowLeft,
  mdiBell,
  mdiBellBadge,
  mdiBellCog,
  mdiCheck,
  mdiCheckCircle,
  mdiChevronDown,
  mdiChevronRight,
  mdiClose,
  mdiCog,
  mdiConsole,
  mdiContentCopy,
  mdiContentSaveOutline,
  mdiCropSquare,
  mdiDotsSquare,
  mdiDotsVertical,
  mdiFilter,
  mdiFolder,
  mdiGit,
  mdiInformation,
  mdiLoading,
  mdiMinus,
  mdiOpenInNew,
  mdiPaletteSwatch,
  mdiPencil,
  mdiPin,
  mdiPinOff,
  mdiPlus,
  mdiPowershell,
  mdiRefresh,
  mdiRobot,
  mdiRocketLaunch,
  mdiSend,
  mdiSpeedometer,
  mdiSquareEditOutline,
  mdiTooltipQuestion,
  mdiTrashCanOutline,
  mdiUndoVariant,
  mdiViewDashboard,
  mdiViewDashboardEdit
} from "@mdi/js";
import { Icon } from "../+model/icon";

@Component({
  selector: "app-icon",
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 100%;
      }

      svg {
        fill: currentColor;
        height: 100%;
      }
    `,
  ],
  template: `
    <svg viewBox="0 0 24 24" style="display:inline-block;">
      <path [attr.d]="icon" d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z" />
    </svg>
  `,
})
export class IconComponent {
  icon = mdiAbTesting;

  @Input()
  set name(icon: Icon) {
    switch (icon) {
      case "mdiAlert":
        this.icon = mdiAlert;
        break;
      case "mdiArrowDown":
        this.icon = mdiArrowDown;
        break;
      case "mdiBell":
        this.icon = mdiBell;
        break;
      case "mdiBellBadge":
        this.icon = mdiBellBadge;
        break;
      case "mdiBellCog":
        this.icon = mdiBellCog;
        break;
      case "mdiCheck":
        this.icon = mdiCheck;
        break;
      case "mdiCheckCircle":
        this.icon = mdiCheckCircle;
        break;
      case "mdiChevronDown":
        this.icon = mdiChevronDown;
        break;
      case "mdiChevronRight":
        this.icon = mdiChevronRight;
        break;
      case "mdiClose":
        this.icon = mdiClose;
        break;
      case "mdiConsole":
        this.icon = mdiConsole;
        break;
      case "mdiContentCopy":
        this.icon = mdiContentCopy;
        break;
      case "mdiContentSaveOutline":
        this.icon = mdiContentSaveOutline;
        break;
      case "mdiCropSquare":
        this.icon = mdiCropSquare;
        break;
      case "mdiDotsSquare":
        this.icon = mdiDotsSquare;
        break;
      case "mdiDotsVertical":
        this.icon = mdiDotsVertical;
        break;
      case "mdiFilter":
        this.icon = mdiFilter;
        break;
      case "mdiFolder":
        this.icon = mdiFolder;
        break;
      case "mdiGit":
        this.icon = mdiGit;
        break;
      case "mdiInformation":
        this.icon = mdiInformation;
        break;
      case "mdiLoading":
        this.icon = mdiLoading;
        break;
      case "mdiMinus":
        this.icon = mdiMinus;
        break;
      case "mdiOpenInNew":
        this.icon = mdiOpenInNew;
        break;
      case "mdiPaletteSwatch":
        this.icon = mdiPaletteSwatch;
        break;
      case "mdiPencil":
        this.icon = mdiPencil;
        break;
      case "mdiPin":
        this.icon = mdiPin;
        break;
      case "mdiPinOff":
        this.icon = mdiPinOff;
        break;
      case "mdiPlus":
        this.icon = mdiPlus;
        break;
      case "mdiPowershell":
        this.icon = mdiPowershell;
        break;
      case "mdiRefresh":
        this.icon = mdiRefresh;
        break;
      case "mdiRobot":
        this.icon = mdiRobot;
        break;
      case "mdiRocketLaunch":
        this.icon = mdiRocketLaunch;
        break;
      case "mdiSend":
        this.icon = mdiSend;
        break;
      case "mdiSpeedometer":
        this.icon = mdiSpeedometer;
        break;
      case "mdiSquareEditOutline":
        this.icon = mdiSquareEditOutline;
        break;
      case "mdiTrashCanOutline":
        this.icon = mdiTrashCanOutline;
        break;
      case "mdiUndoVariant":
        this.icon = mdiUndoVariant;
        break;
      case "mdiViewDashboard":
        this.icon = mdiViewDashboard;
        break;
      case "mdiViewDashboardEdit":
        this.icon = mdiViewDashboardEdit;
        break;
      case "mdiCog":
        this.icon = mdiCog;
        break;
      case "mdiArrowLeft":
        this.icon = mdiArrowLeft;
        break;
      case "mdiTooltipQuestion":
        this.icon = mdiTooltipQuestion;
        break;
      default:
        this.icon = mdiAbTesting;
        break;
    }
  }
}
