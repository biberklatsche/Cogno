import { EffectRef, effect, Injectable, Injector } from "@angular/core";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/shared/contributions";
import { CodingAgentStartupService } from "./coding-agent-startup.service";
import { CodingAgentStatusService } from "./coding-agent-status.service";

const ATTENTION_BADGE_COLORS = {
  error: "var(--color-red)",
  question: "var(--color-yellow)",
} as const;

@Injectable({ providedIn: "root" })
export class CodingAgentsSideMenuLifecycle {
  constructor(
    private readonly startupService: CodingAgentStartupService,
    private readonly statusService: CodingAgentStatusService,
  ) {}

  create(
    injector: Injector,
    sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>,
  ): SideMenuFeatureLifecycleContract {
    let badgeEffect: EffectRef | undefined;

    return {
      onModeChange: (mode) => {
        badgeEffect?.destroy();
        badgeEffect = undefined;
        if (mode !== "on") return;
        // The dot on the menu entry says an agent needs the user, even while the panel is closed.
        badgeEffect = effect(
          () => {
            const attention = this.statusService.attention();
            sideMenuFeatureHandle.updateBadgeColor(
              attention ? ATTENTION_BADGE_COLORS[attention] : undefined,
            );
          },
          { injector },
        );
      },
      onOpen: () => {
        void this.startupService.rescan();
      },
      onFocus: () => {
        sideMenuFeatureHandle.registerKeybindListener(["Escape"], () => {
          sideMenuFeatureHandle.close();
        });
      },
      onBlur: () => {
        sideMenuFeatureHandle.unregisterKeybindListener();
      },
    };
  }
}
